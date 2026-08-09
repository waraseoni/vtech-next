-- ============================================================================
-- scripts/fix_rls.sql
-- Client portal RLS fix — security gap close karne ke liye.
-- Problem (verify-rls.cjs se confirm):
--   - Profile-less authenticated user sab financial data padh sakta hai
--     (transaction_list, client_payments, direct_sales, client_loans)
--   - Client doosre client ki rows bhi padh sakta hai (isolation broken)
-- Karan: 20260809_client_portal.sql ke RLS sections (3-4) live me applied
-- nahi hue the — purani broad "authenticated can read all" policies abhi hain.
--
-- Ye script: RLS ON karta hai + purani policies hatakar sahi policies banata hai.
--   - Staff/Admin  → sab tables par full access (app waisa hi chalega)
--   - Client       → sirf apni transaction_list + client_payments rows
--   - Client       → direct_sales / client_loans par 0 access (portal me nahi dikhte)
--
-- SAFE hai: staff add-payment / direct-sale / loan inserts `for all ... staff`
-- policy ke under hi chalte hain — app ka kaam toot nahi sakta.
-- Apply: Supabase SQL Editor me run karo, phir `node scripts/verify-rls.cjs` se verify.
-- ============================================================================

-- ── 1) RLS ON ──────────────────────────────────────────────────────────────
alter table public.transaction_list enable row level security;
alter table public.client_payments  enable row level security;
alter table public.direct_sales     enable row level security;
alter table public.client_loans     enable row level security;

-- ── 2) In tables par purani policies hatana (sab broad policies) ──────────
do $$
declare p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('transaction_list','client_payments','direct_sales','client_loans')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ── 3) transaction_list ────────────────────────────────────────────────────
drop policy if exists portal_transaction_list_staff on public.transaction_list;
create policy portal_transaction_list_staff on public.transaction_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (true);

drop policy if exists portal_transaction_list_client_own on public.transaction_list;
create policy portal_transaction_list_client_own on public.transaction_list
  for select to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'client'
    and client_name ~ '^[0-9]+$'
    and client_name::bigint = (select client_id from public.profiles where id = auth.uid())
  );

-- ── 4) client_payments ─────────────────────────────────────────────────────
drop policy if exists portal_client_payments_staff on public.client_payments;
create policy portal_client_payments_staff on public.client_payments
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (true);

drop policy if exists portal_client_payments_client_own on public.client_payments;
create policy portal_client_payments_client_own on public.client_payments
  for select to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'client'
    and client_id = (select client_id from public.profiles where id = auth.uid())
  );

-- ── 5) direct_sales — sirf staff (client ko kuch nahi) ────────────────────
drop policy if exists portal_direct_sales_staff on public.direct_sales;
create policy portal_direct_sales_staff on public.direct_sales
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (true);

-- ── 6) client_loans — sirf staff (client ko kuch nahi) ────────────────────
drop policy if exists portal_client_loans_staff on public.client_loans;
create policy portal_client_loans_staff on public.client_loans
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (true);

-- ── 7) Verify: ab kitni policies hain ──────────────────────────────────────
select tablename, policyname, cmd, roles, qual
from pg_policies
where tablename in ('transaction_list','client_payments','direct_sales','client_loans')
order by tablename, policyname;
