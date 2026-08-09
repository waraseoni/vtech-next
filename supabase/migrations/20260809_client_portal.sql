-- ============================================================================
-- 20260809_client_portal.sql
-- Client Portal — Phase 1 (DB). Step 1 security fixes alag se applied hai.
--
-- Kya karta hai:
--  1. client_list.login_allowed — admin toggle (sirf select clients portal login karein)
--  2. profiles.client_id — client ko profile se link (service-role API set karta hai)
--  3. RLS (defense-in-depth) — browser client se koi bhi client
--     doosre clients ka transaction/payment data nahi padh sakta.
--     PRIMARY isolation API guards hai (Phase 4), ye sirf backup layer.
--
-- NOTE:
--  - RLS policies authenticated staff/admin ko full access deti hain
--    (profile-less authenticated user block ho sakta hai — profile zaroori hai).
--  - Agar in tables par koi purani broad "authenticated -> all" policy ho,
--    usse review karo (clients usko bypass karke data padh sakte hain).
--  - Ager kisi browser route ne RLS-disable hone ki expectation me query ki ho
--    to wo ab policy ke under hi chalega (staff full, client own).
-- ============================================================================

-- ── 1) Admin decide kare kaun client portal use kar sakta hai ───────────────
alter table public.client_list
  add column if not exists login_allowed boolean not null default false;

-- ── 2) profiles me client link (FK) ─────────────────────────────────────────
alter table public.profiles
  add column if not exists client_id bigint references public.client_list(id);

-- ── 3) RLS — transaction_list (repairs) ─────────────────────────────────────
alter table public.transaction_list enable row level security;

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

-- ── 4) RLS — client_payments (payments) ────────────────────────────────────
alter table public.client_payments enable row level security;

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

-- ── 5) profiles.role CHECK constraint me 'client' add karo ⭐───────────────
-- Purana constraint sirf admin/staff allow karta tha — portal ke liye role="client"
-- insert karne par "violates check constraint profiles_role_check" error aata tha.
-- (Service-role bhi is check ke under aata hai — check constraint RLS/trigger nahi
--  hai jo service-role bypass kare.)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'staff', 'client'));
