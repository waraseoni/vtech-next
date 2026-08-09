-- ============================================================================
-- scripts/check_rls.sql
-- Client portal RLS — ground-truth catalog check (Supabase SQL Editor me run karo)
-- Behavioral checks ke liye: node scripts/verify-rls.cjs
-- ============================================================================

-- ── 1) RLS enabled status ───────────────────────────────────────────────────
-- relrowsecurity = true  → RLS ON (achha)
-- relrowsecurity = false → RLS OFF (portal tables ke liye isse ON karna hai)
select relname as table, relrowsecurity as rls_enabled
from pg_class
where relname in ('transaction_list','client_payments','profiles','client_list','client_loans','direct_sales')
order by relname;

-- ── 2) Policies on portal tables ───────────────────────────────────────────
-- transaction_list + client_payments par ye 4 policies honi chahiye:
--   portal_transaction_list_staff, portal_transaction_list_client_own,
--   portal_client_payments_staff, portal_client_payments_client_own
select tablename, policyname, cmd as command, roles, qual, with_check
from pg_policies
where tablename in ('transaction_list','client_payments')
order by tablename, policyname;

-- ── 3) profiles.role CHECK constraint me 'client' hona chahiye ────────────
select conname, pg_get_constraintdef(oid) as constraint_def
from pg_constraint
where conname = 'profiles_role_check';

-- ── 4) Auto-profile trigger on auth.users ─────────────────────────────────
-- Trigger drop migration ke baad ye EMPTY aana chahiye.
-- Agar koi row aaye (on_auth_user_created / handle_new_user) to wapas
-- zombie staff profile banege — trigger drop migration run karo.
select tgname as trigger_name, p.proname as function_name
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal;

-- ── 5) Portal columns applied? ─────────────────────────────────────────────
select
  exists(select 1 from information_schema.columns
         where table_schema='public' and table_name='client_list' and column_name='login_allowed') as client_list_login_allowed,
  exists(select 1 from information_schema.columns
         where table_schema='public' and table_name='profiles' and column_name='client_id') as profiles_client_id;

-- ── 6) Ab kaunse clients portal ke liye eligible hain ──────────────────────
-- Valid email + login_allowed=true → inhi se client login kar payega.
-- ('not given' / phone-number wale emails ko client-emails.cjs se fix karo.)
select id, firstname, lastname, contact,
       case when email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' then 'VALID' else 'INVALID' end as email_status,
       email, login_allowed
from public.client_list
where delete_flag = 0
order by email_status, login_allowed desc, id;
