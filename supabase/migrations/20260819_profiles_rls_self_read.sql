-- ============================================================================
-- 20260819_profiles_rls_self_read.sql
--
-- Fix: profiles table par RLS enabled hai par galat/missing policies.
-- Original DB me RLS OFF hai to ye policies sirf naye DB par lagengi.
--
-- SELECT: sab authenticated users sabki profiles padh sakein (user lists,
--   activity logs, attendance, salary — sabko profiles chahiye).
-- UPDATE: staff/admin kisi ki bhi, user sirf apni (name/avatar).
-- INSERT/DELETE: sirf service_role se (setup API, admin create/delete user).
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Purani koi bhi profiles policy ho to drop karo (idempotent)
DO $$ BEGIN
  DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
  DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
  DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
  DROP POLICY IF EXISTS profiles_update_staff ON public.profiles;
  DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
END $$;

-- SELECT: sabko sabki profiles
CREATE POLICY profiles_select_all ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- UPDATE: staff/admin
CREATE POLICY profiles_update_staff ON public.profiles
  FOR UPDATE TO authenticated
  USING (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  WITH CHECK (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

-- UPDATE: user apni khud ki
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
