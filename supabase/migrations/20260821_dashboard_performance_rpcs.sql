-- ══════════════════════════════════════════════════════════════════════════════
-- DASHBOARD PERFORMANCE RPCs — 40+ client calls → 3 server calls
-- ══════════════════════════════════════════════════════════════════════════════
-- Run this migration in your CLIENT Supabase project (not the licensing one).
-- These functions run inside PostgreSQL — all aggregation server-side.

-- ──────────────────────────────────────────────────────────────────────────────
-- 1) get_dashboard_stats — job counts + client/mech count + today revenue
--    Replaces: ~17 separate count/select queries
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.get_dashboard_stats(
  p_today_start text,
  p_today_end   text
)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'totalJobs',       (select count(*) from public.transaction_list where del_status = 0),
    'pendingJobs',     (select count(*) from public.transaction_list where del_status = 0 and status = 0),
    'inProgressJobs',  (select count(*) from public.transaction_list where del_status = 0 and status = 1),
    'finishedJobs',    (select count(*) from public.transaction_list where del_status = 0 and status = 2),
    'paidJobs',        (select count(*) from public.transaction_list where del_status = 0 and status = 3),
    'cancelledJobs',   (select count(*) from public.transaction_list where del_status = 0 and status = 4),
    'deliveredJobs',   (select count(*) from public.transaction_list where del_status = 0 and status = 5),
    'totalClients',    (select count(*) from public.client_list where delete_flag = 0),
    'totalMechanics',  (select count(*) from public.mechanic_list where delete_flag = 0 and status = 1),
    'todayRepair',     (select coalesce(sum(amount), 0) from public.transaction_list where status = 5 and del_status = 0 and date_completed >= p_today_start::timestamptz and date_completed <= p_today_end::timestamptz),
    'todayDirect',     (select coalesce(sum(total_amount), 0) from public.direct_sales where date_created >= p_today_start::timestamptz and date_created <= p_today_end::timestamptz)
  ) into result;

  return result;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2) get_monthly_revenue — last N months revenue data
--    Replaces: 12-month loop with 24 sequential queries → 1 call
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.get_monthly_revenue(p_months int default 12)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  result jsonb;
  month_label text;
  month_revenue numeric;
  months_arr jsonb := '[]'::jsonb;
  i int;
  m_date date;
  m_start timestamptz;
  m_end timestamptz;
begin
  for i in 0 .. (p_months - 1) loop
    m_date := date_trunc('month', current_date) - (i || ' months')::interval;
    m_start := (date_trunc('month', m_date))::timestamptz;
    m_end   := (date_trunc('month', m_date) + interval '1 month - 1 second')::timestamptz;

    month_label := to_char(m_date, 'Mon YY');

    select coalesce(sum(repair_rev + direct_rev), 0) into month_revenue
    from (
      select coalesce(sum(amount), 0) as repair_rev, 0 as direct_rev
        from public.transaction_list
       where status = 5 and del_status = 0
         and date_completed >= m_start and date_completed <= m_end
      union all
      select 0 as repair_rev, coalesce(sum(total_amount), 0) as direct_rev
        from public.direct_sales
       where date_created >= m_start and date_created <= m_end
    ) t;

    months_arr := months_arr || jsonb_build_object(
      'month', month_label,
      'revenue', month_revenue
    );
  end loop;

  -- Reverse so oldest first
  result := (
    select jsonb_agg(elem)
    from (select elem from jsonb_array_elements(months_arr) with ordinality AS t(elem, pos) order by t.pos desc) sub
  );

  return coalesce(result, '[]'::jsonb);
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3) get_financial_summary — date-range financial summary
--    Replaces: ~12 separate queries for sales, parts, salary, expenses etc.
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.get_financial_summary(
  p_from text,
  p_to   text
)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  result jsonb;
  v_from timestamptz;
  v_to   timestamptz;
  v_repair_inc  numeric;
  v_direct_inc  numeric;
  v_total_sales numeric;
  v_parts_trans numeric;
  v_parts_direct numeric;
  v_parts_cost  numeric;
  v_discounts   numeric;
  v_salary      numeric;
  v_loan_paid   numeric;
  v_expenses    numeric;
  v_tx_ids      int[];
  v_ds_ids      int[];
begin
  v_from := p_from::timestamptz;
  v_to   := (p_to || 'T23:59:59+05:30')::timestamptz;

  -- Repair + Direct income
  select coalesce(sum(amount), 0) into v_repair_inc
    from public.transaction_list
   where status = 5 and del_status = 0
     and date_completed >= v_from and date_completed <= v_to;

  select coalesce(sum(total_amount), 0) into v_direct_inc
    from public.direct_sales
   where date_created >= v_from and date_created <= v_to;

  v_total_sales := v_repair_inc + v_direct_inc;

  -- Parts cost — actual cost_price from products, fallback 90% of selling price
  select array_agg(id) into v_tx_ids
    from public.transaction_list
   where status = 5 and del_status = 0
     and date_completed >= v_from and date_completed <= v_to;

  select array_agg(id) into v_ds_ids
    from public.direct_sales
   where date_created >= v_from and date_created <= v_to;

  select coalesce(sum(
    tp.qty * case
      when p.cost_price is not null and p.cost_price > 0 then p.cost_price
      else tp.price * 0.9
    end
  ), 0) into v_parts_trans
  from public.transaction_products tp
  left join public.product_list p on p.id = tp.product_id
  where v_tx_ids is not null and tp.transaction_id = any(v_tx_ids);

  select coalesce(sum(
    di.qty * case
      when p.cost_price is not null and p.cost_price > 0 then p.cost_price
      else di.price * 0.9
    end
  ), 0) into v_parts_direct
  from public.direct_sale_items di
  left join public.product_list p on p.id = di.product_id
  where v_ds_ids is not null and di.sale_id = any(v_ds_ids);

  v_parts_cost := v_parts_trans + v_parts_direct;

  -- Discounts
  select coalesce(sum(discount), 0) into v_discounts
    from public.client_payments
   where payment_date >= p_from and payment_date <= p_to;

  -- Salary (attendance-based)
  select coalesce(sum(
    case
      when a.status = 1 then m.daily_salary
      when a.status = 3 then m.daily_salary / 2
      else 0
    end
  ), 0) into v_salary
  from public.attendance_list a
  join public.mechanic_list m on m.id = a.mechanic_id
  where a.curr_date >= p_from and a.curr_date <= p_to
    and a.status in (1, 3);

  -- Loan paid
  select coalesce(sum(amount_paid), 0) into v_loan_paid
    from public.loan_payments
   where payment_date >= p_from and payment_date <= p_to;

  -- Expenses
  select coalesce(sum(amount), 0) into v_expenses
    from public.expense_list
   where date_created >= v_from and date_created <= v_to;

  result := jsonb_build_object(
    'totalSales',   v_total_sales,
    'partsCost',    v_parts_cost,
    'grossProfit',  v_total_sales - v_parts_cost,
    'discounts',    v_discounts,
    'salary',       v_salary,
    'loanPaid',     v_loan_paid,
    'expenses',     v_expenses,
    'totalOutflow', v_discounts + v_salary + v_loan_paid + v_expenses,
    'netProfit',    (v_total_sales - v_parts_cost) - (v_discounts + v_salary + v_loan_paid + v_expenses)
  );

  return result;
end;
$$;

-- Grant access to authenticated users
grant execute on function public.get_dashboard_stats(text, text) to authenticated;
grant execute on function public.get_monthly_revenue(int) to authenticated;
grant execute on function public.get_financial_summary(text, text) to authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4) get_technician_metrics — per-mechanic productivity for a date range
--    Returns: jobs completed, revenue, commission, attendance breakdown
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.get_technician_metrics(
  p_from text,
  p_to   text
)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  result jsonb;
  v_from date := p_from::date;
  v_to   date := p_to::date;
begin
  select jsonb_agg(row_to_json(t)) into result
  from (
    select
      m.id,
      m.firstname || ' ' || coalesce(m.lastname, '') as name,
      m.designation,
      m.daily_salary,
      m.commission_percent,
      m.image_path,

      -- Jobs completed (status 5 = delivered)
      coalesce(job_stats.jobs_completed, 0) as jobs_completed,
      coalesce(job_stats.jobs_revenue, 0) as jobs_revenue,
      coalesce(job_stats.jobs_commission, 0) as jobs_commission,

      -- Attendance
      coalesce(att_stats.full_days, 0) as full_days,
      coalesce(att_stats.half_days, 0) as half_days,
      coalesce(att_stats.absent_days, 0) as absent_days,
      coalesce(att_stats.total_attended, 0) as total_attended,
      coalesce(att_stats.working_days, 0) as working_days,

      -- Salary earned (attendance-based)
      coalesce(att_stats.salary_earned, 0) as salary_earned,

      -- Avg repair time in hours (date_completed - date_created for delivered jobs)
      job_stats.avg_repair_hours

    from public.mechanic_list m

    left join lateral (
      select
        count(*) as jobs_completed,
        coalesce(sum(t.amount), 0) as jobs_revenue,
        coalesce(sum(t.mechanic_commission_amount), 0) as jobs_commission,
        case when count(*) > 0
          then round(extract(epoch from avg(t.date_completed - t.date_created)) / 3600, 1)
          else null
        end as avg_repair_hours
      from public.transaction_list t
      where t.mechanic_id = m.id
        and t.status = 5
        and t.del_status = 0
        and t.date_completed >= (v_from || 'T00:00:00+05:30')::timestamptz
        and t.date_completed <= ((v_to || 'T23:59:59+05:30')::timestamptz)
    ) job_stats on true

    left join lateral (
      select
        count(*) filter (where a.status = 1) as full_days,
        count(*) filter (where a.status = 3) as half_days,
        count(*) filter (where a.status = 2) as absent_days,
        count(*) filter (where a.status in (1, 3)) as total_attended,
        count(*) as working_days,
        coalesce(sum(
          case
            when a.status = 1 then m.daily_salary
            when a.status = 3 then m.daily_salary / 2
            else 0
          end
        ), 0) as salary_earned
      from public.attendance_list a
      where a.mechanic_id = m.id
        and a.curr_date >= v_from
        and a.curr_date <= v_to
    ) att_stats on true

    where m.delete_flag = 0 and m.status = 1
    order by job_stats.jobs_completed desc nulls last
  ) t;

  return coalesce(result, '[]'::jsonb);
end;
$$;

grant execute on function public.get_technician_metrics(text, text) to authenticated;
