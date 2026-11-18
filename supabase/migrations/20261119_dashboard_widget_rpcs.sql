-- ══════════════════════════════════════════════════════════════════════════════
-- DASHBOARD WIDGET RPCs — recents (2 rounds → 1) + waiting (2 → 1)
-- ══════════════════════════════════════════════════════════════════════════════
-- KYUN
--   Dashboard ke do batches abhi bhi 2-2 SEQUENTIAL HTTP rounds lete the
--   (src/lib/server-dashboard.ts, src/lib/requiredParts.ts):
--
--   A) Recents (widgets batch):
--        1) transaction_list  (recent 5)      ~51 ms   ┐
--        2) client_payments   (recent 10)     ~50 ms   ├ parallel
--        3) phir client_list naam lookup      ~50 ms   ┘ → ~100 ms total
--      Naam lookup ke liye ids pehle round ke response se chahiye hote hain —
--      isliye ye do rounds thay. Ab join server par: 1 call.
--
--   B) Waiting summary:
--        1) job_required_parts (open)         ~50 ms
--        2) transaction_list   (.in(ids))     ~53 ms   → ~103 ms total
--      Doosri query ko ids pehli se chahiye — isliye sequential. Ab 1 call.
--
--   Measured (HTTP, staff JWT, RLS on): A 95-100 ms → expect ~55-60 ms,
--   B 99-103 ms → expect ~53-60 ms. Page TTFB inhi batches par max() leta hai.
--
-- FORMULA (unchanged — same numbers as TS)
--   Recents:
--     recentJobs     = transaction_list del_status=0 order id desc limit 5,
--                      client naam = client_list firstname+lastname (trim),
--                      na mile → 'Walk-in'. client_name is text (PHP legacy),
--                      digits nikaal ke client_list.id se join.
--     recentPayments = client_payments order payment_date desc, id desc limit 10,
--                      payment_mode null → 'Cash', client na mile → 'Unknown'.
--   Waiting:
--     parts = job_required_parts status in (0,1,2)
--     jobs  = transaction_list id in parts + status in (0,1,2,3) + del_status = 0
--     waitingParts = active jobs ke parts (sirf wahi jo jobs me hain)
--     orderedCount = unme status = 1, waitingCount = baaki (0 aur 2)
--     waitingJobs  = active jobs count
--     oldestDays   = sabse purane part se aaj tak (>= 0, poore din)
--     oldestJobId  = us part ka job_id (khaali → '#' + id), kuch na ho → null
--     Kuch bhi na ho → sab zeros / null.
--
-- SAFETY
--   - Read-only (STABLE), `security definer` + `is_frontend_staff()` guard
--     (wahi staff check jo policies me hai; client-portal users ko khaali).
--   - Koi table/column/data/constraint change nahi — sirf 2 naye functions.
--   - Grants: anon/PUBLIC ko execute nahi; sirf authenticated + service_role.
--
-- Apply: Supabase SQL Editor me run karo (ek baar, idempotent).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── A) Recent jobs + recent payments (client names samet) ───────────────────
create or replace function public.get_dashboard_recents()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with rj as (
    select t.id, t.job_id, t.client_name, t.item, t.amount, t.status,
           nullif(regexp_replace(t.client_name, '\D', '', 'g'), '')::bigint as client_pk
    from public.transaction_list t
    where t.del_status = 0
      and public.is_frontend_staff()
    order by t.id desc
    limit 5
  ),
  rp as (
    select p.id, p.amount, p.payment_mode, p.payment_date, p.client_id
    from public.client_payments p
    where public.is_frontend_staff()
    order by p.payment_date desc, p.id desc
    limit 10
  )
  select jsonb_build_object(
    'recentJobs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', rj.id,
          'job_id', rj.job_id,
          'client_name', coalesce(
            nullif(btrim(concat_ws(' ', c.firstname, c.lastname)), ''),
            'Walk-in'
          ),
          'item', rj.item,
          'amount', rj.amount,
          'status', rj.status
        )
        order by rj.id desc
      )
      from rj
      left join public.client_list c on c.id = rj.client_pk
    ), '[]'::jsonb),
    'recentPayments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', rp.id,
          'amount', rp.amount,
          'payment_mode', coalesce(rp.payment_mode::text, 'Cash'),
          'payment_date', rp.payment_date,
          'client_name', coalesce(
            nullif(btrim(concat_ws(' ', c2.firstname, c2.lastname)), ''),
            'Unknown'
          )
        )
        order by rp.payment_date desc, rp.id desc
      )
      from rp
      left join public.client_list c2 on c2.id = rp.client_id
    ), '[]'::jsonb)
  );
$$;

-- ── B) Waiting / required-parts summary ─────────────────────────────────────
create or replace function public.get_dashboard_waiting()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with parts as (
    select p.transaction_id, p.status, p.date_created
    from public.job_required_parts p
    where p.status in (0, 1, 2)
      and public.is_frontend_staff()
  ),
  jobs as (
    select t.id, t.job_id
    from public.transaction_list t
    where t.id in (select transaction_id from parts)
      and t.status in (0, 1, 2, 3)
      and t.del_status = 0
  ),
  active_parts as (
    select p.transaction_id, p.status, p.date_created
    from parts p
    where p.transaction_id in (select id from jobs)
  ),
  agg as (
    select
      count(*)::int as waiting_parts,
      count(*) filter (where ap.status = 1)::int as ordered_count,
      count(*) filter (where ap.status <> 1)::int as waiting_count,
      min(ap.date_created) as oldest_at,
      (array_agg(ap.transaction_id order by ap.date_created asc, ap.transaction_id asc))[1]
        as oldest_txn
    from active_parts ap
  )
  select case
    when (select waiting_parts from agg) = 0 then
      jsonb_build_object(
        'waitingJobs', 0,
        'waitingParts', 0,
        'orderedCount', 0,
        'waitingCount', 0,
        'oldestDays', 0,
        'oldestJobId', null
      )
    else
      jsonb_build_object(
        'waitingJobs', (select count(*)::int from jobs),
        'waitingParts', a.waiting_parts,
        'orderedCount', a.ordered_count,
        'waitingCount', a.waiting_count,
        'oldestDays', greatest(
          0,
          floor(extract(epoch from (now() - a.oldest_at)) / 86400)::int
        ),
        'oldestJobId', coalesce(
          (select nullif(j.job_id, '') from jobs j where j.id = a.oldest_txn),
          '#' || a.oldest_txn::text
        )
      )
  end
  from agg a;
$$;

revoke all on function public.get_dashboard_recents() from public;
revoke all on function public.get_dashboard_recents() from anon;
grant execute on function public.get_dashboard_recents() to authenticated;
grant execute on function public.get_dashboard_recents() to service_role;

revoke all on function public.get_dashboard_waiting() from public;
revoke all on function public.get_dashboard_waiting() from anon;
grant execute on function public.get_dashboard_waiting() to authenticated;
grant execute on function public.get_dashboard_waiting() to service_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- Verify (Supabase SQL Editor — 0 rows expected kyunki staff claim nahi hota):
--   select public.get_dashboard_recents();
--   select public.get_dashboard_waiting();
--   App ke andar (staff login) dashboard ke Recent Jobs / Recent Payments /
--   Waiting widgets ke numbers pehle jaise hi hone chahiye.
-- ──────────────────────────────────────────────────────────────────────────────
