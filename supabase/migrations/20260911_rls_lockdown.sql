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
--     → sirf admin/staff/developer CRUD (developer = dev-team, app ke
--       requireStaff/requireAdmin jaisa, sab staff data dikhna chahiye).
--       Client portal ko client_list/profiles par apna data (self) dikhta
--       hai — isliye client_self policies bhi.
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
-- App breaking nahi hoga: saare staff pages authenticated (staff/admin/
-- developer) ke roop me hi chalte hain aur in policies ke under hi query
-- karte hain. profiles self-update role/client_id immutable rakhta hai —
-- koi client/staff khud ko admin nahi bana sakta.
--
-- Apply: Supabase SQL Editor me run karo (ek baar, idempotent), phir
-- `node scripts/verify-rls.cjs` + scripts/check_rls.sql se verify.
--
-- ═══ LIVE-DB pre-flight (28 Aug 2026, PostgREST + service-role probe) ═══
--   • is shop project me `licenses`/`activations`/`client_credentials` tables
--     HAI NAHI (404) — wo central `vtech_licence` project me hain. Isliye
--     provision wale alters `to_regclass` guard me hain.
--   • Baaki sab target tables pe anon reads pehle se = 0 rows (RLS ON live) —
--     ye migration unhe "defense-in-depth" ke liye dubara role-gate karta hai.
--   • client_own policies (portal_transaction_list_client_own /
--     portal_client_payments_client_own) live present hain — section 6 inhe
--     DROP NAHI karta (sirf *_staff policies replace hoti hain), client portal
--     chalta rahega.
--   • HOLE LIVE CONFIRMED (client user ne apni token se client_payments par
--     INSERT @201 chalaya, marker row cleanup kar diya) → section 6 ka
--     `with check (true)` fix is DB par REAL kaam karta hai.
--   • developer role: purani policies me admin/staff hi tha → ye migration
--     developer ko bhi deta hai (app ke requireStaff/requireAdmin semantics).
--   • APP-BREAK AUDIT (browser/user-JWT path, 28 Aug): staff/admin/developer
--     ki saari UI reads+CRUD (jobs/clients/payments/inventory/reports...) in
--     19+portal+PO tables par hai → migration ki staff policies (all) inhe
--     cover karti hain. users/new + users/[id]/edit ki profiles writes
--     service-role /api/admin/* se hoti hain (browser sirf read) → safe.
--     Client portal sirf /api/client/* (service-role) → RLS se unaffected;
--     RootClient ke sirf profiles(own row)+system_info reads hai (system_info
--     migration me nahi hai). RPC (get_dashboard_stats etc.) untouched + tables
--     already locked → dashboard aaj kaam karta hai, waisa hi rahega.
--     → PROJECT BREAK NAHI HOGA. reCAP: sirf sachcha closing = with-check hole
--     (client forge) + staff self-escalation (rlslock_profiles_staff with-check).
--   • rlslock_profiles_staff ka with-check ab role/client_id IMMUTABLE rakhta
--     hai (target row bhi) — staff browser se khud ko admin nahi bana sakta.
--   • ══ SNAPSHOT-DUMP re-check (28 Aug, 62 policies wala pg_policies dump) ══
--     • profiles LIVE me escalation-open tha: "Allow users update own profile"
--       (auth.uid()=id, role/client_id free) → koi bhi khud ko admin bana leta
--       aaj. Section 4 inhe drop karke immutable versions deta hai.
--     • service_list + direct_sale_items LIVE me "Allow authenticated access"
--       (read+WRITE kisi bhi logged-in user ko) the → migration me values add
--       kar diye (staff gate) — warna ye hole client ko khula rehta.
--     • locations + location_zones/racks/boxes/bins LIVE me `to public` CRUD
--       policies hain (naam "Staff can..." par role = public = anon samet).
--       Ye intentionally is migration me NAHI — alag review/follow-up.
--   ════════════════════════════════════════════════════════════════════════

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
alter table public.service_list                   enable row level security;
alter table public.direct_sale_items              enable row level security;

-- Provisioning tables (licenses/activations/client_credentials) — SIRF service-
-- role (RLS ON + koi policy nahi → anon/authenticated = 0, service_role bypass).
-- NOTE (live-db check 2026-08-28): ye 3 tables is shop project me EXIST nahi
-- karti — wo central `vtech_licence` project me hain. `to_regclass` guard isliye
-- taki migration is DB par bhi bina crash chale aur license-wale project par bhi.
do $$
begin
  if to_regclass('public.licenses') is not null then
    alter table public.licenses enable row level security;
  end if;
  if to_regclass('public.activations') is not null then
    alter table public.activations enable row level security;
  end if;
  if to_regclass('public.client_credentials') is not null then
    alter table public.client_credentials enable row level security;
  end if;
end $$;

-- Portal financial / PO tables — idempotent RLS ON (kuch manual "step 1" fixes/
-- SQL editor se applied the; enable already hota to no-op, warna policies
-- bina RLS ke silent-inert reh kar hole khola chhod deti. Ye guarantee karta hai
-- ki section 6/7 ke policies actually enforce hon).
alter table public.transaction_list          enable row level security;
alter table public.client_payments           enable row level security;
alter table public.direct_sales              enable row level security;
alter table public.client_loans              enable row level security;
alter table public.purchase_orders           enable row level security;
alter table public.purchase_order_items      enable row level security;
alter table public.push_subscriptions        enable row level security;

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
        'mechanic_commission_history', 'service_list', 'direct_sale_items',
        'licenses', 'activations',
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
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

create policy rlslock_mechanic_list_staff on public.mechanic_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

create policy rlslock_expense_list_staff on public.expense_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

create policy rlslock_lender_list_staff on public.lender_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

create policy rlslock_loan_payments_staff on public.loan_payments
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

create policy rlslock_attendance_list_staff on public.attendance_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

create policy rlslock_inventory_list_staff on public.inventory_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

create policy rlslock_product_list_staff on public.product_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

create policy rlslock_product_locations_staff on public.product_locations
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

create policy rlslock_job_id_counter_staff on public.job_id_counter
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

create policy rlslock_transaction_products_staff on public.transaction_products
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

create policy rlslock_transaction_services_staff on public.transaction_services
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

create policy rlslock_transaction_images_staff on public.transaction_images
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

create policy rlslock_advance_payments_staff on public.advance_payments
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

create policy rlslock_mech_salary_staff on public.mechanic_salary_history
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

create policy rlslock_mech_commission_staff on public.mechanic_commission_history
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

-- (Live-dump finding 28 Aug: service_list + direct_sale_items "Allow authenticated
-- access" the = kisi bhi logged-in user ko read+write. Client ho to bhi! Staff UI
-- tables hain (service catalog, POS items) — isliye staff/admin/developer gate.)
create policy rlslock_service_list_staff on public.service_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

create policy rlslock_direct_sale_items_staff on public.direct_sale_items
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

-- ── 4) profiles — staff/admin select/update + client self read/update ─────
-- Note: profiles ka INSERT + DELETE sirf service-role hota hai (admin
-- create-user / delete-user API, client onboard upsert) — isliye authenticated
-- ko in tables par select/update se zyada nahi: koi bhi browser se role
-- escalate / user bana / delete nahi kar sakta.
create policy rlslock_profiles_staff on public.profiles
  for select, update to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (
    -- role/client_id immutable (target row bhi) — warna koi staff browser se update
    -- profiles set role='admin' chala ke khud ko admin bana leta. Admin ki role
    -- changes /api/admin/update-profile (service-role) se hoti hain, isse break nahi.
    coalesce(role, '') = coalesce((select p.role from public.profiles p where p.id = profiles.id), '')
    and coalesce(client_id, -1) is not distinct from coalesce((select p.client_id from public.profiles p where p.id = profiles.id), -1)
  );

create policy rlslock_profiles_client_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- Self-update: apna profile update allowed, par ROLE + CLIENT_ID immutable —
-- warna koi client/staff khud ko 'admin' bana leta (privilege escalation).
-- `role = (select role ...)` with-check me naye row vs purane row ki tulna hai;
-- client_id bhi apni current value par hi rah sakta hai.
create policy rlslock_profiles_client_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and coalesce(role, '') = coalesce((select role from public.profiles where id = auth.uid()), '')
    and coalesce(client_id, -1) is not distinct from coalesce((select client_id from public.profiles where id = auth.uid()), -1)
  );

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
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

drop policy if exists portal_client_payments_staff on public.client_payments;
create policy portal_client_payments_staff on public.client_payments
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

drop policy if exists portal_direct_sales_staff on public.direct_sales;
create policy portal_direct_sales_staff on public.direct_sales
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

drop policy if exists portal_client_loans_staff on public.client_loans;
create policy portal_client_loans_staff on public.client_loans
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

-- ── 7) Purchase orders + Push subscriptions — broad auth band karo ───────
drop policy if exists "Allow authenticated access" on public.purchase_orders;
create policy rlslock_purchase_orders_staff on public.purchase_orders
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

drop policy if exists "Allow authenticated access" on public.purchase_order_items;
create policy rlslock_purchase_order_items_staff on public.purchase_order_items
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

drop policy if exists "Allow authenticated access" on public.push_subscriptions;
create policy rlslock_push_subscriptions_staff on public.push_subscriptions
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff', 'developer'));

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
    'service_list','direct_sale_items',
    'licenses','activations','client_credentials',
    'transaction_list','client_payments','direct_sales','client_loans',
    'purchase_orders','purchase_order_items','push_subscriptions'
  )
order by relname;