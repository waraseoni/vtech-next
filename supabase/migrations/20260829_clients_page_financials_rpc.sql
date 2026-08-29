-- ══════════════════════════════════════════════════════════════════════════════
-- CLIENTS PAGE PERFORMANCE RPC — 5 full-table scans → 1 server-side aggregate
-- ══════════════════════════════════════════════════════════════════════════════
-- Matches PHP client list formula (see src/lib/client-due.ts):
--   balance = opening + repair_billed + direct_sales − service_paid
--             + active_loan_given − loan_repaid
-- Run in your client Supabase project (same as dashboard RPCs).

create or replace function public.get_clients_page_financials()
returns jsonb
language sql
security definer
stable
as $$
  with active_loans as (
    select id, client_id, total_payable
    from public.client_loans
    where status = 1
  ),
  repair_agg as (
    select
      case when client_name ~ '^\d+$' then client_name::int else null end as client_id,
      coalesce(sum(amount), 0) as repair_billed
    from public.transaction_list
    where status = 5
    group by 1
    having case when client_name ~ '^\d+$' then client_name::int else null end is not null
  ),
  direct_agg as (
    select
      client_id,
      coalesce(sum(total_amount), 0) as direct_sales_billed
    from public.direct_sales
    group by client_id
  ),
  service_pay_agg as (
    select
      client_id,
      coalesce(sum(amount + coalesce(discount, 0)), 0) as service_paid
    from public.client_payments
    where loan_id is null or loan_id = 0
    group by client_id
  ),
  loan_given_agg as (
    select
      client_id,
      coalesce(sum(total_payable), 0) as active_loan_given
    from active_loans
    group by client_id
  ),
  loan_repaid_agg as (
    select
      cp.client_id,
      coalesce(sum(cp.amount + coalesce(cp.discount, 0)), 0) as loan_repaid
    from public.client_payments cp
    inner join active_loans al on al.id = cp.loan_id
    group by cp.client_id
  ),
  last_txn_agg as (
    select
      case when client_name ~ '^\d+$' then client_name::int else null end as client_id,
      max(date_created) as last_txn_date
    from public.transaction_list
    group by 1
    having case when client_name ~ '^\d+$' then client_name::int else null end is not null
  ),
  all_ids as (
    select client_id from repair_agg
    union
    select client_id from direct_agg
    union
    select client_id from service_pay_agg
    union
    select client_id from loan_given_agg
    union
    select client_id from loan_repaid_agg
    union
    select client_id from last_txn_agg
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'client_id', i.client_id,
        'repair_billed', coalesce(r.repair_billed, 0),
        'direct_sales_billed', coalesce(d.direct_sales_billed, 0),
        'service_paid', coalesce(sp.service_paid, 0),
        'active_loan_given', coalesce(lg.active_loan_given, 0),
        'loan_repaid', coalesce(lr.loan_repaid, 0),
        'last_txn_date', lt.last_txn_date
      )
      order by i.client_id
    ),
    '[]'::jsonb
  )
  from all_ids i
  left join repair_agg r on r.client_id = i.client_id
  left join direct_agg d on d.client_id = i.client_id
  left join service_pay_agg sp on sp.client_id = i.client_id
  left join loan_given_agg lg on lg.client_id = i.client_id
  left join loan_repaid_agg lr on lr.client_id = i.client_id
  left join last_txn_agg lt on lt.client_id = i.client_id;
$$;

grant execute on function public.get_clients_page_financials() to authenticated;
