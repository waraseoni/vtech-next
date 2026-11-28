-- B2 — Brand switcher parity for /jobs Quick Stats.
--
-- UI/list query ab ?brand=<id>|untagged filter karte hain. `get_jobs_stats()`
-- ko bhi wahi filter chahiye, warna list aur Quick Stats alag-alag dikhenge.
-- Signature 6 → 7 args: purana 6-arg overload drop karke naya banaya jata hai.
-- Grants/volatility/security-definer wahi rahte hain. Koi table/column/index
-- change nahi; global job_id/counter/index untouched.
--
-- Owner apply karein; agent live DB write nahi karta.
--
-- Verify:
--   select public.get_jobs_stats(p_brand => '5') ->> 'total';
--   select public.get_jobs_stats(p_brand => 'untagged') ->> 'total';

drop function if exists public.get_jobs_stats(text, text, text, boolean, int, text);

create or replace function public.get_jobs_stats(
  p_term text default null,
  p_date_from text default null,
  p_date_to text default null,
  p_hide_delivered boolean default false,
  p_status int default null,
  p_spot text default null,
  p_brand text default null
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
      case when coalesce(p_spot, '') ~ '^\d+$' then p_spot::int else null end as spot_id,
      case when coalesce(p_brand, '') in ('', 'all') then null
           else lower(btrim(p_brand)) end as brand
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
        a.brand is null
        or (a.brand = 'untagged' and t.brand_id is null)
        or (a.brand ~ '^\d+$' and t.brand_id = a.brand::int)
      )
      and (
        a.pat is null
        or t.job_id ilike a.pat
        or t.brand_job_no ilike a.pat
        or t.code ilike a.pat
        or t.item ilike a.pat
        or t.item_name ilike a.pat
        or t.model ilike a.pat
        or t.serial_no ilike a.pat
        or t.brand_id in (
          select b.id from public.brands b
          where b.name ilike a.pat or b.code ilike a.pat
        )
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

revoke all on function public.get_jobs_stats(text, text, text, boolean, int, text, text) from public;
revoke all on function public.get_jobs_stats(text, text, text, boolean, int, text, text) from anon;
grant execute on function public.get_jobs_stats(text, text, text, boolean, int, text, text)
  to authenticated;
grant execute on function public.get_jobs_stats(text, text, text, boolean, int, text, text)
  to service_role;

notify pgrst, 'reload schema';
