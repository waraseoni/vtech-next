-- ══════════════════════════════════════════════════════════════════════════════
-- DASHBOARD DUE-STATS RPC — 5 full-table scans → 1 server-side aggregate
-- ══════════════════════════════════════════════════════════════════════════════
-- KYUN
--   Dashboard ka "Due Reminders" widget har load par client-side pe 5 poore
--   tables padhta tha (pageAll = 1000-row pages):
--     client_list, transaction_list (status=5), direct_sales,
--     client_loans (status=1), client_payments
--   Measured (prod build, localhost): 400–950 ms per request batch, kai rows
--   (transaction_list offset=1000 page bhi). Aggregation client-side thi,
--   jabki ise DB me karna 10x sasta hai (row transfer hi nahi).
--
-- FORMULA (unchanged — single source: src/lib/client-due.ts)
--   balance = opening_balance
--           + SUM(transaction_list.amount)      status = 5   (delivered billed)
--           + SUM(direct_sales.total_amount)
--           - SUM(payments.amount + discount)   loan_id null/0 (service paid)
--           + SUM(client_loans.total_payable)   status = 1   (active loans)
--           - SUM(payments.amount + discount)   active loan ids (loan repaid)
--   balance > 0.01 wale clients hi due maane jate hain.
--   date buckets: overdue (days < 0), today (0), upcoming (1..7) — IST din
--   ke hisaab se, sirf un clients par jinka payment_due_date set hai.
--
-- SAFETY
--   - Koi schema/data change nahi — sirf ek naya read-only function (stable).
--     Koi table/column/data touch nahi hota (live data safe).
--   - `security definer` + restricted grants: anon/PUBLIC ko execute nahi,
--     sirf authenticated + service_role (Sept 2026 migrations ka pattern).
--   - Purana data purane rules se padha jata hai (client_name text → bigint,
--     PHP convention), naya kuch likha nahi jata.
--
-- Apply: Supabase SQL Editor me run karo (ek baar). Verify section file ke end me.
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function public.get_due_stats()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with active_loans as (
    select id, client_id, total_payable
    from public.client_loans
    where status = 1
  ),
  repair_agg as (
    select client_name::bigint as client_id,
           coalesce(sum(amount), 0) as repair_billed
    from public.transaction_list
    where status = 5 and client_name ~ '^\d+$'
    group by 1
  ),
  direct_agg as (
    select client_id,
           coalesce(sum(total_amount), 0) as direct_sales_billed
    from public.direct_sales
    group by client_id
  ),
  service_pay_agg as (
    select client_id,
           coalesce(sum(amount + coalesce(discount, 0)), 0) as service_paid
    from public.client_payments
    where loan_id is null or loan_id = 0
    group by client_id
  ),
  loan_given_agg as (
    select client_id,
           coalesce(sum(total_payable), 0) as active_loan_given
    from active_loans
    group by client_id
  ),
  loan_repaid_agg as (
    select cp.client_id,
           coalesce(sum(cp.amount + coalesce(cp.discount, 0)), 0) as loan_repaid
    from public.client_payments cp
    inner join active_loans al on al.id = cp.loan_id
    group by cp.client_id
  ),
  balances as (
    select
      c.id,
      c.payment_due_date,
      coalesce(c.opening_balance, 0)
        + coalesce(r.repair_billed, 0)
        + coalesce(d.direct_sales_billed, 0)
        - coalesce(sp.service_paid, 0)
        + coalesce(lg.active_loan_given, 0)
        - coalesce(lr.loan_repaid, 0) as balance
    from public.client_list c
    left join repair_agg      r  on r.client_id  = c.id
    left join direct_agg      d  on d.client_id  = c.id
    left join service_pay_agg sp on sp.client_id = c.id
    left join loan_given_agg  lg on lg.client_id = c.id
    left join loan_repaid_agg lr on lr.client_id = c.id
    where c.delete_flag = 0
  ),
  dues as (
    select
      balance,
      case
        when payment_due_date is null then null
        else payment_due_date - (now() at time zone 'Asia/Kolkata')::date
      end as days_diff
    from balances
    where balance > 0.01
  )
  select jsonb_build_object(
    'overdue',  count(*) filter (where days_diff < 0),
    'today',    count(*) filter (where days_diff = 0),
    'upcoming', count(*) filter (where days_diff between 1 and 7),
    'amount',   coalesce(sum(balance), 0)
  )
  from dues;
$$;

revoke all on function public.get_due_stats() from public;
revoke all on function public.get_due_stats() from anon;
grant execute on function public.get_due_stats() to authenticated;
grant execute on function public.get_due_stats() to service_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- Verify (Supabase SQL Editor):
--   select public.get_due_stats();
--   -- expected shape: {"overdue": N, "today": N, "upcoming": N, "amount": N}
--   -- cross-check: dashboard widget ke numbers se match hone chahiye.
-- ──────────────────────────────────────────────────────────────────────────────
