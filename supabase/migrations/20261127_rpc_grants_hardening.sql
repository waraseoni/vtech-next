-- D1 (K10) — RPC grants hardening (P0-1)
--
-- Root cause: RLS tables band ho gaye thi, par 26/28 public functions anon
-- ke liye EXECUTE-able the (SECURITY DEFINER → RLS bypass). Frontend me anon
-- key public hai → bina login financials, stock, client balances aur job ids
-- padhe ja sakte the; reset_sequence se arbitrary setval = DoS.
-- Ref: docs/plans/rpc_grants_hardening_plan.md (16 Nov live audit).
--
-- Layer 1: grants — anon/public hatao, authenticated + service_role do.
-- Layer 1b: trigger functions — direct grant hatao (trigger chalte rahenge).
-- Layer 2: guards — client-role authenticated users bhi staff RPCs na call karein.
--   Guard = is_frontend_staff() OR JWT role service_role (API routes).
--   Body same rakha gaya hai; sirf guard inject kiya gaya hai (behaviour 1:1).
--
-- reset_sequence: browser anon RPC hataya gaya — ab admin-only route
--   /api/admin/reset-sequence service-role se call karta hai + allowlist
--   (src/lib/resetSequence.ts). DB par sirf service_role ko grant hai.
--
-- Koi table / column / data statement NAHI — sirf functions + grants.
-- Grants to_regprocedure() se guard hain: missing function (jaise drop kiya
-- gaya inventory_sync_place_path) 42883 nahi deta — bas skip ho jata hai.
-- Idempotent: CREATE OR REPLACE + REVOKE/GRANT regrant; do baar chalana safe.
-- Owner apply karega (agent live DB write nahi karta).
--
-- Rollback (docs §8): function body wapas full-schema se copy karo; grants
--   ke liye `grant execute ... to anon;` wapas do.
--
-- Verify (apply ke baad):
--   select p.proname, has_function_privilege('anon', p.oid, 'execute') anon_ok
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public' and p.proname in (...)
--   order by 1;
--   Expected: sab staff RPCs par anon_ok = false.
--   anon REST POST /rest/v1/rpc/get_dashboard_stats → 401/403.
--   staff login → dashboard/clients/jobs/inventory/backup ✅; portal ✅.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- LAYER 1 — GRANTS
-- ═══════════════════════════════════════════════════════════════════════════
-- Layer 1 + 1b — grants (42883-safe).
-- REVOKE/GRANT ON FUNCTION fail hota hai (42883) jab function live DB me nahi
-- hai. Misal: inventory_sync_place_path() ko 20260925_i6_phase2_place_drop.sql
-- drop kar chuka hai — uska seedha REVOKE migration ko rok deta tha.
-- Isliye har statement to_regprocedure() se guarded hai: missing = skip,
-- baaki sab waisa hi (idempotent, do baar chalane par bhi yahi result).
do $$
declare
  sig text;
begin
  -- Staff-only RPCs: anon + public se hatao, authenticated + service_role do.
  foreach sig in array array[
    'public.get_dashboard_stats(text, text)',
    'public.get_clients_page_financials()',
    'public.get_monthly_revenue(integer)',
    'public.get_financial_summary(text, text)',
    'public.get_technician_metrics(text, text)',
    'public.get_inventory_stock(int8[])',
    'public.next_job_id()',
    'public.peek_next_job_id()',
    'public.save_direct_sale(integer, text, integer, integer, text, text, integer, text, jsonb)',
    'public.get_transactions_with_client_data(date, date)',
    'public.get_my_client_id()',
    'public.get_my_role()',
    'public.is_frontend_staff()'
  ]::text[] loop
    if to_regprocedure(sig) is not null then
      execute format('revoke all on function %s from public, anon', sig);
      execute format('grant execute on function %s to authenticated, service_role', sig);
    end if;
  end loop;

  -- reset_sequence: sirf service_role. Browser ab admin-only route use karta hai.
  sig := 'public.reset_sequence(text)';
  if to_regprocedure(sig) is not null then
    execute format('revoke all on function %s from public, anon, authenticated', sig);
    execute format('grant execute on function %s to service_role', sig);
  end if;

  -- Trigger functions: direct EXECUTE kisi ko nahi (trigger grant par depend nahi karta).
  foreach sig in array array[
    'public.handle_new_user()',
    'public.prevent_role_escalation()',
    'public.update_date_updated()',
    'public.touch_bom_templates()',
    'public.touch_client_contacts()',
    'public.touch_purchase_orders()',
    'public.touch_push_subscriptions()',
    'public.touch_supplier_contact_persons()',
    'public.touch_user_passkeys()',
    'public.inventory_sync_place_path()'  -- 20260925 me drop ho chuka hai → skip
  ]::text[] loop
    if to_regprocedure(sig) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', sig);
    end if;
  end loop;
end $$;

-- Verify: koi bhi listed function ka anon grant na bache (missing skip ho).

-- ═══════════════════════════════════════════════════════════════════════════
-- LAYER 2 — STAFF GUARDS (CREATE OR REPLACE, body same + guard)
-- ═══════════════════════════════════════════════════════════════════════════

-- Layer 2.1 — get_dashboard_stats: staff/service_role guard (body waisa hi)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_today_start text, p_today_end text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER STABLE
    AS $$
declare
  result jsonb;
begin
  if not (
    public.is_frontend_staff()
    or coalesce(
         nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
         ''
       ) = 'service_role'
  ) then
    raise exception 'permission denied for staff-only function' using errcode = '42501';
  end if;
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

-- Layer 2.2 — get_clients_page_financials: staff/service_role guard (body waisa hi)
create or replace function public.get_clients_page_financials()
returns jsonb
language plpgsql
security definer
stable
as $$
begin
  if not (
    public.is_frontend_staff()
    or coalesce(
         nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
         ''
       ) = 'service_role'
  ) then
    raise exception 'permission denied for staff-only function' using errcode = '42501';
  end if;
  return (
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
    done_agg as (
      select
        case when client_name ~ '^\d+$' then client_name::int else null end as client_id,
        coalesce(sum(amount), 0) as repair_done
      from public.transaction_list
      where status = 2
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
      select client_id from done_agg
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
          'repair_done', coalesce(dn.repair_done, 0),
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
    left join done_agg dn on dn.client_id = i.client_id
    left join direct_agg d on d.client_id = i.client_id
    left join service_pay_agg sp on sp.client_id = i.client_id
    left join loan_given_agg lg on lg.client_id = i.client_id
    left join loan_repaid_agg lr on lr.client_id = i.client_id
    left join last_txn_agg lt on lt.client_id = i.client_id
  );
end;
$$;

-- Layer 2.3 — get_monthly_revenue: staff/service_role guard (body waisa hi)
CREATE OR REPLACE FUNCTION public.get_monthly_revenue(p_months integer DEFAULT 12) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER STABLE
    AS $$
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
  if not (
    public.is_frontend_staff()
    or coalesce(
         nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
         ''
       ) = 'service_role'
  ) then
    raise exception 'permission denied for staff-only function' using errcode = '42501';
  end if;
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

  result := (
    select jsonb_agg(elem)
    from (select elem from jsonb_array_elements(months_arr) with ordinality AS t(elem, pos) order by t.pos desc) sub
  );

  return coalesce(result, '[]'::jsonb);
end;
$$;

-- Layer 2.4 — get_financial_summary: staff/service_role guard (body waisa hi)
CREATE OR REPLACE FUNCTION public.get_financial_summary(p_from text, p_to text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER STABLE
    AS $$
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
  if not (
    public.is_frontend_staff()
    or coalesce(
         nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
         ''
       ) = 'service_role'
  ) then
    raise exception 'permission denied for staff-only function' using errcode = '42501';
  end if;
  v_from := (p_from || 'T00:00:00+05:30')::timestamptz;
  v_to   := (p_to || 'T23:59:59+05:30')::timestamptz;

  select coalesce(sum(amount), 0) into v_repair_inc
    from public.transaction_list
   where status = 5 and del_status = 0
     and date_completed >= v_from and date_completed <= v_to;

  select coalesce(sum(total_amount), 0) into v_direct_inc
    from public.direct_sales
   where date_created >= v_from and date_created <= v_to;

  v_total_sales := v_repair_inc + v_direct_inc;

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

  select coalesce(sum(discount), 0) into v_discounts
    from public.client_payments
   where payment_date >= p_from and payment_date <= p_to;

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

  select coalesce(sum(amount_paid), 0) into v_loan_paid
    from public.loan_payments
   where payment_date >= p_from and payment_date <= p_to;

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

-- Layer 2.5 — get_technician_metrics: staff/service_role guard (body waisa hi)
CREATE OR REPLACE FUNCTION public.get_technician_metrics(p_from text, p_to text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER STABLE
    AS $$
declare
  result jsonb;
  v_from date := p_from::date;
  v_to   date := p_to::date;
begin
  if not (
    public.is_frontend_staff()
    or coalesce(
         nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
         ''
       ) = 'service_role'
  ) then
    raise exception 'permission denied for staff-only function' using errcode = '42501';
  end if;
  select jsonb_agg(row_to_json(t)) into result
  from (
    select
      m.id,
      m.firstname || ' ' || coalesce(m.lastname, '') as name,
      m.designation,
      m.daily_salary,
      m.commission_percent,
      m.image_path,

      coalesce(job_stats.jobs_completed, 0) as jobs_completed,
      coalesce(job_stats.jobs_revenue, 0) as jobs_revenue,
      coalesce(job_stats.jobs_commission, 0) as jobs_commission,

      coalesce(att_stats.full_days, 0) as full_days,
      coalesce(att_stats.half_days, 0) as half_days,
      coalesce(att_stats.absent_days, 0) as absent_days,
      coalesce(att_stats.total_attended, 0) as total_attended,
      coalesce(att_stats.working_days, 0) as working_days,

      coalesce(att_stats.salary_earned, 0) as salary_earned,

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

-- Layer 2.6 — get_inventory_stock: staff/service_role guard (body waisa hi)
CREATE OR REPLACE FUNCTION public.get_inventory_stock(
    p_product_ids int8[] DEFAULT NULL
) RETURNS TABLE(
    product_id        bigint,
    total_in          bigint,
    total_sold_job    bigint,
    total_sold_sale   bigint,
    total_sold        bigint,
    available         bigint,
    oversold          bigint,
    avg_purchase_cost numeric,
    last_stock_date   date,
    place             text
)
    language plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public
AS $$
-- RETURNS TABLE ke OUT vars (product_id, place) query ke columns se clash karte
-- the → plpgsql me 42702 "column reference is ambiguous" (original SQL fn me nahi tha).
-- use_column = unqualified naam hamesha table column, OUT var nahi.
#variable_conflict use_column
begin
  if not (
    public.is_frontend_staff()
    or coalesce(
         nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
         ''
       ) = 'service_role'
  ) then
    raise exception 'permission denied for staff-only function' using errcode = '42501';
  end if;
  return query
      WITH inv AS (
          SELECT product_id, SUM(quantity) AS total_in,
                 COALESCE(NULLIF(SUM(CASE WHEN quantity > 0 THEN quantity * purchase_cost END), 0)
                          / NULLIF(SUM(CASE WHEN quantity > 0 THEN quantity END), 0), 0) AS avg_cost,
                 MAX(stock_date) AS last_date,
                 (array_agg(place ORDER BY stock_date DESC, id DESC))[1] AS place
          FROM public.inventory_list
          WHERE (p_product_ids IS NULL OR product_id = ANY (p_product_ids))
          GROUP BY product_id
      ),
      sold_job AS (
          SELECT tp.product_id, SUM(tp.qty) AS qty
          FROM public.transaction_products tp
          JOIN public.transaction_list t ON t.id = tp.transaction_id
          WHERE t.status <> 4
            AND (p_product_ids IS NULL OR tp.product_id = ANY (p_product_ids))
          GROUP BY tp.product_id
      ),
      sold_sale AS (
          SELECT product_id, SUM(qty) AS qty
          FROM public.direct_sale_items
          WHERE (p_product_ids IS NULL OR product_id = ANY (p_product_ids))
          GROUP BY product_id
      ),
      all_ids AS (
          SELECT product_id FROM inv
          UNION SELECT product_id FROM sold_job
          UNION SELECT product_id FROM sold_sale
      )
      SELECT a.product_id,
             COALESCE(i.total_in, 0)            AS total_in,
             COALESCE(j.qty, 0)                 AS total_sold_job,
             COALESCE(s.qty, 0)                 AS total_sold_sale,
             COALESCE(j.qty, 0) + COALESCE(s.qty, 0) AS total_sold,
             COALESCE(i.total_in, 0) - COALESCE(j.qty, 0) - COALESCE(s.qty, 0) AS available,
             GREATEST(0, COALESCE(j.qty, 0) + COALESCE(s.qty, 0) - COALESCE(i.total_in, 0)) AS oversold,
             COALESCE(i.avg_cost, 0)            AS avg_purchase_cost,
             i.last_date                        AS last_stock_date,
             i.place                            AS place
      FROM all_ids a
      LEFT JOIN inv  i ON i.product_id = a.product_id
      LEFT JOIN sold_job  j ON j.product_id = a.product_id
      LEFT JOIN sold_sale s ON s.product_id = a.product_id
      ORDER BY a.product_id
;
end;
$$;

-- Layer 2.7 — next_job_id: staff/service_role guard (body waisa hi)
CREATE OR REPLACE FUNCTION public.next_job_id()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val integer;
BEGIN
  if not (
    public.is_frontend_staff()
    or coalesce(
         nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
         ''
       ) = 'service_role'
  ) then
    raise exception 'permission denied for staff-only function' using errcode = '42501';
  end if;
  UPDATE public.job_id_counter
  SET last_job_id = last_job_id + 1
  WHERE id = 1
  RETURNING last_job_id INTO next_val;

  IF next_val IS NULL THEN
    -- id=1 row missing (edge case) — max numeric job_id se seed, phir increment
    INSERT INTO public.job_id_counter (id, last_job_id)
    SELECT 1, GREATEST(
      COALESCE((SELECT MAX(CASE WHEN job_id ~ '^[0-9]+$' THEN job_id::BIGINT END)
                FROM public.transaction_list), 0),
      28100
    )
    ON CONFLICT (id) DO UPDATE
      SET last_job_id = public.job_id_counter.last_job_id + 1
    RETURNING last_job_id INTO next_val;
  END IF;

  RETURN next_val;
END;
$$;

-- Layer 2.8 — peek_next_job_id: staff/service_role guard (body waisa hi)
CREATE OR REPLACE FUNCTION public.peek_next_job_id()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val integer;
BEGIN
  if not (
    public.is_frontend_staff()
    or coalesce(
         nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
         ''
       ) = 'service_role'
  ) then
    raise exception 'permission denied for staff-only function' using errcode = '42501';
  end if;
  SELECT COALESCE(last_job_id, 0) + 1
    INTO next_val
    FROM public.job_id_counter
   WHERE id = 1;

  IF next_val IS NULL THEN
    SELECT GREATEST(COALESCE(MAX((job_id)::bigint), 0), 28100) + 1
      INTO next_val
      FROM public.transaction_list
     WHERE job_id ~ '^[0-9]+$';
  END IF;

  RETURN next_val;
END;
$$;

-- Layer 2.9 — reset_sequence: staff/service_role guard (body waisa hi)
CREATE OR REPLACE FUNCTION public.reset_sequence(table_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  seq_name text;
  max_id   bigint;
  new_val  bigint;
BEGIN
  if not (
    public.is_frontend_staff()
    or coalesce(
         nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
         ''
       ) = 'service_role'
  ) then
    raise exception 'permission denied for staff-only function' using errcode = '42501';
  end if;
  -- Is table ke 'id' column ki sequence dhundo
  SELECT pg_get_serial_sequence(table_name, 'id') INTO seq_name;

  IF seq_name IS NULL THEN
    RETURN 'SKIP: ' || table_name || ' (no sequence found)';
  END IF;

  -- Current max ID fetch karo
  EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM %I', table_name) INTO max_id;

  new_val := max_id + 1;

  -- Sequence reset karo
  PERFORM setval(seq_name, new_val, false);

  RETURN 'OK: ' || table_name || ' → next_id = ' || new_val;
END;
$$;

-- ── Post-apply verification (SQL editor) ────────────────────────────────────
-- anon ke paas koi bhi staff RPC execute na ho:
-- select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_ok
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('get_dashboard_stats','get_clients_page_financials',
--     'get_monthly_revenue','get_financial_summary','get_technician_metrics',
--     'get_inventory_stock','next_job_id','peek_next_job_id','reset_sequence')
-- order by 1;   -- sab false chahiye

NOTIFY pgrst, 'reload schema';
