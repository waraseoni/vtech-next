-- ════════════════════════════════════════════════════════════════════════
-- 20260911_rls_lockdown.sql
-- RLS lockdown — baaki sab public tables par bhi RLS (defense-in-depth).
--
-- Problem (20260911 audit):
--   Frontend bundle me PUBLIC anon key hota hai; bina RLS ke table REST API
--   se anon + authenticated dono ke liye bilkul khule rehte hain. 20260910 ke
--   hardening ne sirf 7 tables cover kiye — ye migration baaki tables ko bhi
--   band karta hai:
--
--   • Staff business tables (client_list, mechanic_list, expense_list, ...)
--     → sirf admin/staff CRUD. Client portal ko client_list/profiles par
--       apna data (self) dikhta hai — isliye client_self policies bhi.
--   • licenses / activations / client_credentials (seller/developer/provision)
--     → SIRF service-role (RLS ON, koi anon/auth policy nahi). App inhe
--       sirf service-role libs (license-admin.ts, client-creds.ts) se touch
--       karta hai — service_role RLS bypass karta hai, sab kaam chalega.
--   • Purana `with check (true)` hole band kiya (transaction_list,
--     client_payments, direct_sales, client_loans, purchase_orders,
--     purchase_order_items, push_subscriptions) — ab insert/update bhi role
--     gated hai; koi client arbitrary financial rows forge nahi kar sakta.
--   • push_subscriptions par user-own policy (har user sirf apne device
--     ka sub), staff sab dekh sakta hai (admin send ke liye).
--
-- App breaking nahi hoga: saare staff pages authenticated (staff/admin) ke
-- roop me hi chalte hain aur in policies ke under hi query karte hain.
--
-- Apply: Supabase SQL Editor me run karo (ek baar, idempotent), phir
-- `node scripts/verify-rls.cjs` + scripts/check_rls.sql se verify.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) RLS ON (idempotent) ──────────────────────────────────────────────
alter table public.client_list                    enable row level security;
alter table public.profiles                       enable row level security;
alter table public.mechanic_list                  enable row level security;
alter table public.expense_list                   enable row level security;
alter table public.lender_list                    enable row level security;
alter table public.loan_payments                  enable row level security;
alter table public.attendance_list                enable row level security;
alter table public.inventory_list                 enable row level security;
alter table public.product_list                   enable row level security;
alter table public.product_locations              enable row level security;
alter table public.job_id_counter                 enable row level security;
alter table public.transaction_products           enable row level security;
alter table public.transaction_services           enable row level security;
alter table public.transaction_images             enable row level security;
alter table public.advance_payments               enable row level security;
alter table public.mechanic_salary_history        enable row level security;
alter table public.mechanic_commission_history    enable row level security;

-- Provisioning tables — SIRF service-role (RLS ON + koi policy nahi
-- → anon/authenticated ko access = 0, service_role bypass karta hai).
alter table public.licenses          enable row level security;
alter table public.activations       enable row level security;
alter table public.client_credentials enable row level security;

-- ── 2) Purani policies hatao (Allow-all / broad auth / duplicate) ───────
do $$
declare p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'client_list', 'profiles', 'mechanic_list', 'expense_list',
        'lender_list', 'loan_payments', 'attendance_list', 'inventory_list',
        'product_list', 'product_locations', 'job_id_counter',
        'transaction_products', 'transaction_services', 'transaction_images',
        'advance_payments', 'mechanic_salary_history',
        'mechanic_commission_history', 'licenses', 'activations',
        'client_credentials'
      )
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ── 3) Staff/Admin business CRUD policies ───────────────────────────────
-- Role check: profile wala authenticated user hi — anon/ghost authenticated user
-- ko in tables par kuch nahi (using + with check dono role-gated).

create policy rlslock_client_list_staff on public.client_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_mechanic_list_staff on public.mechanic_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_expense_list_staff on public.expense_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_lender_list_staff on public.lender_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_loan_payments_staff on public.loan_payments
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_attendance_list_staff on public.attendance_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_inventory_list_staff on public.inventory_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_product_list_staff on public.product_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_product_locations_staff on public.product_locations
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_job_id_counter_staff on public.job_id_counter
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_transaction_products_staff on public.transaction_products
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_transaction_services_staff on public.transaction_services
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_transaction_images_staff on public.transaction_images
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_advance_payments_staff on public.advance_payments
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_mech_salary_staff on public.mechanic_salary_history
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_mech_commission_staff on public.mechanic_commission_history
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

-- ── 4) profiles — staff/admin full CRUD + client self read/update ────────
-- Note: profiles ka INSERT sirf service-role hota hai (admin create-user API,
-- client onboard upsert) — isliye authenticated me insert policy NAHI hai,
-- koi bhi client/staff browser se role escalate nahi kar sakta.
create policy rlslock_profiles_staff on public.profiles
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_profiles_client_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy rlslock_profiles_client_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ── 5) client_list — client ko sirf apna record ──────────────────────────
create policy rlslock_client_list_client_self on public.client_list
  for select to authenticated
  using (
    coalesce((select role from public.profiles where id = auth.uid()), '') = 'client'
    and id = (select client_id from public.profiles where id = auth.uid())
  );

-- ── 6) Portal financial tables — `with check (true)` hole band karo ───────
-- Ab insert/update bhi sirf staff/admin (client kabhi forge nahi kar sakta).
drop policy if exists portal_transaction_list_staff on public.transaction_list;
create policy portal_transaction_list_staff on public.transaction_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

drop policy if exists portal_client_payments_staff on public.client_payments;
create policy portal_client_payments_staff on public.client_payments
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

drop policy if exists portal_direct_sales_staff on public.direct_sales;
create policy portal_direct_sales_staff on public.direct_sales
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

drop policy if exists portal_client_loans_staff on public.client_loans;
create policy portal_client_loans_staff on public.client_loans
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

-- ── 7) Purchase orders + Push subscriptions — broad auth band karo ───────
drop policy if exists "Allow authenticated access" on public.purchase_orders;
create policy rlslock_purchase_orders_staff on public.purchase_orders
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

drop policy if exists "Allow authenticated access" on public.purchase_order_items;
create policy rlslock_purchase_order_items_staff on public.purchase_order_items
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

drop policy if exists "Allow authenticated access" on public.push_subscriptions;
create policy rlslock_push_subscriptions_staff on public.push_subscriptions
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

create policy rlslock_push_subscriptions_self on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 8) Report: lockdown se cover hue tables ──────────────────────────────
select relname as table, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'client_list','profiles','mechanic_list','expense_list','lender_list',
    'loan_payments','attendance_list','inventory_list','product_list',
    'product_locations','job_id_counter','transaction_products',
    'transaction_services','transaction_images','advance_payments',
    'mechanic_salary_history','mechanic_commission_history',
    'licenses','activations','client_credentials'
  )
order by relname;