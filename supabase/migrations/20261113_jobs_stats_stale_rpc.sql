-- ══════════════════════════════════════════════════════════════════════════════
-- JOBS LIST RPCs — stats aggregate + stale-jobs scan (client-side scans → DB)
-- ══════════════════════════════════════════════════════════════════════════════
-- KYUN
--   1) get_jobs_stats(): /jobs ka "Quick Stats" har filter change par POORE
--      filtered dataset ko 1000-row chunks me browser me laata tha
--      (computeJobStats → N requests + client-side loop). Server-side aggregate
--      se rows transfer hi nahi hoti.
--   2) get_stale_jobs(): "7+ din se spot par pade Done/Paid jobs" alert 3
--      round-trips karta tha (300-row candidate scan + 2 activity_logs queries)
--      aur join client-side hota tha. Ab 1 RPC.
--
-- PARITY (unchanged — single source: src/app/jobs/jobListQueries.ts)
--   Filters bilkul wahi:
--     del_status = 0
--     date_created BETWEEN (from T00:00:00+05:30) AND (to T23:59:59+05:30)
--       ⚠ PostgREST `timestamp without time zone` column par offset ko CAST karta
--       hai (measured: 2026-10-25 ka count 4 aata hai, plain-cast se 9) — isliye
--       yahan `timestamptz ... at time zone 'UTC'` use kiya hai, taaki session TZ
--       se independent rahe.
--     hideDelivered → status <> 5
--     status        → status = p_status
--     spot          → location_id = p_spot::int
--     term          → job_id/code/item/fault/uniq_id/remark ILIKE %term% OR
--                     client_name IN (client_list matching name/contact)
--   Stats: total = rows, pending = status 0, progress = status 1,
--          completed = status IN (2,3,5), totalAmt = SUM(amount)
--
-- STALE-JOBS (dual-era rules — docs/DATA_MIGRATION_NOTES.md)
--   candidates: status IN (2,3), uniq_id <> '', date_updated < now-7d,
--               order date_updated asc, limit 300
--   last status-change = max(activity_logs.date_created) per key, jahan
--     legacy (PHP)  : module 'Transactions', action 'Transaction Status Changed',
--                     meta_id = transaction_list.id::text
--     modern (Next) : module 'Jobs', action 'Updated Job Status',
--                     meta_id = job_id
--   changed_at = legacy ?? modern ?? date_updated ?? date_created
--   sirf wahi rows jinke changed_at <= now - p_days, order changed_at asc,
--   limit p_limit, shape: [{id, job_id, item, uniq_id, days}]
--
-- SAFETY
--   - Koi schema/data change nahi — 2 naye read-only (stable) functions.
--     Koi table/column/data touch nahi hota (live data safe).
--   - `security definer` + restricted grants (Sept 2026 pattern): anon/PUBLIC ko
--     execute nahi, sirf authenticated + service_role.
--   - Limit/order/fallback chain client logic se 1:1 — koi nayi business rule nahi.
--
-- Apply: Supabase SQL Editor me run karo (ek baar). Verify section file ke end me.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Jobs list stats (1 aggregate row) ─────────────────────────────────────
create or replace function public.get_jobs_stats(
  p_term text default null,
  p_date_from text default null,
  p_date_to text default null,
  p_hide_delivered boolean default false,
  p_status int default null,
  p_spot text default null
)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with args as (
    select
      case when coalesce(p_term, '') = '' then null
           else '%' || lower(p_term) || '%' end as pat,
      case when coalesce(p_date_from, '') = '' then null
           else (p_date_from::timestamptz at time zone 'UTC') end as from_ts,
      case when coalesce(p_date_to, '') = '' then null
           else ((p_date_to || 'T23:59:59+05:30')::timestamptz at time zone 'UTC') end as to_ts,
      coalesce(p_hide_delivered, false) as hide_delivered,
      p_status as filt_status,
      case when coalesce(p_spot, '') ~ '^\d+$' then p_spot::int else null end as spot_id
  ),
  filtered as (
    select t.status, coalesce(t.amount, 0) as amount
    from public.transaction_list t
    cross join args a
    where t.del_status = 0
      and (a.from_ts is null or t.date_created >= a.from_ts)
      and (a.to_ts is null or t.date_created <= a.to_ts)
      and (not a.hide_delivered or t.status <> 5)
      and (a.filt_status is null or t.status = a.filt_status)
      and (a.spot_id is null or t.location_id = a.spot_id)
      and (
        a.pat is null
        or t.job_id ilike a.pat
        or t.code ilike a.pat
        or t.item ilike a.pat
        or t.fault ilike a.pat
        or t.uniq_id ilike a.pat
        or t.remark ilike a.pat
        or t.client_name in (
          select c.id::text
          from public.client_list c
          where c.firstname ilike a.pat
             or c.middlename ilike a.pat
             or c.lastname ilike a.pat
             or c.contact ilike a.pat
        )
      )
  )
  select jsonb_build_object(
    'total',     count(*),
    'pending',   count(*) filter (where status = 0),
    'progress',  count(*) filter (where status = 1),
    'completed', count(*) filter (where status in (2, 3, 5)),
    'totalAmt',  coalesce(sum(amount), 0)
  )
  from filtered;
$$;

revoke all on function public.get_jobs_stats(text, text, text, boolean, int, text) from public;
revoke all on function public.get_jobs_stats(text, text, text, boolean, int, text) from anon;
grant execute on function public.get_jobs_stats(text, text, text, boolean, int, text)
  to authenticated;
grant execute on function public.get_jobs_stats(text, text, text, boolean, int, text)
  to service_role;

-- ── 2. Stale jobs (7+ din se untouched Done/Paid) ────────────────────────────
create or replace function public.get_stale_jobs(
  p_days int default 7,
  p_limit int default 50
)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with args as (
    select
      greatest(coalesce(p_days, 7), 0) as days,
      greatest(coalesce(p_limit, 50), 0) as lim,
      now() as now_ts,
      (now() at time zone 'UTC') as now_utc
  ),
  -- Client ka candidate scan: 300 sabse purane Done/Paid (uniq_id ke saath).
  cands as (
    select t.id, t.job_id, t.item, t.uniq_id, t.date_created, t.date_updated
    from public.transaction_list t
    cross join args a
    where t.del_status = 0
      and t.status in (2, 3)
      and t.uniq_id <> ''
      and t.date_updated < a.now_utc - make_interval(days => a.days)
    order by t.date_updated asc
    limit 300
  ),
  -- Dono yug ke last status-change (dual-era keys, docs/DATA_MIGRATION_NOTES.md).
  logs as (
    select l.meta_id, max(l.date_created) as last_at
    from public.activity_logs l
    where (
        l.module = 'Transactions'
        and l.action = 'Transaction Status Changed'
        and l.meta_id in (select c.id::text from cands c)
      )
      or (
        l.module = 'Jobs'
        and l.action = 'Updated Job Status'
        and l.meta_id in (select c.job_id from cands c)
      )
    group by l.meta_id
  ),
  scored as (
    select
      c.id,
      c.job_id,
      c.item,
      coalesce(c.uniq_id, '') as uniq_id,
      coalesce(la.last_at, lb.last_at, c.date_updated, c.date_created) as changed_at,
      c.date_updated,
      a.now_ts,
      a.days
    from cands c
    cross join args a
    left join logs la on la.meta_id = c.id::text
    left join logs lb on lb.meta_id = c.job_id
  ),
  stale as (
    select *
    from scored s
    where s.changed_at is not null
      and s.changed_at <= (s.now_ts at time zone 'UTC') - make_interval(days => s.days)
    order by s.changed_at asc, s.date_updated asc, s.id asc
    limit (select lim from args)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'job_id', s.job_id,
        'item', s.item,
        'uniq_id', s.uniq_id,
        'days', floor(extract(epoch from (s.now_ts - (s.changed_at at time zone 'UTC'))) / 86400)::int
      )
      order by s.changed_at asc
    ),
    '[]'::jsonb
  )
  from stale s;
$$;

revoke all on function public.get_stale_jobs(int, int) from public;
revoke all on function public.get_stale_jobs(int, int) from anon;
grant execute on function public.get_stale_jobs(int, int) to authenticated;
grant execute on function public.get_stale_jobs(int, int) to service_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- Verify (Supabase SQL Editor):
--   select public.get_jobs_stats();                 -- {"total":N,"pending":N,...}
--   select public.get_jobs_stats(p_hide_delivered => true);
--   select public.get_jobs_stats(p_date_from => '2026-11-01', p_date_to => '2026-11-30');
--   select public.get_stale_jobs();                 -- [{id,job_id,item,uniq_id,days}]
--   -- cross-check: /jobs ke Quick Stats + stale alert ke numbers se match.
-- ──────────────────────────────────────────────────────────────────────────────
