-- ============================================================================
-- 20260819_profiles_rls_self_read.sql
--
-- Fix: profiles table par RLS enabled hai par koi SELECT policy nahi hai.
-- Isse cookie-based client (requireAdmin/requireStaff/requireClient) profiles
-- read nahi kar paata — login ke baad role null milta hai, LicenseGate/
-- sidebar sab galat kaam karta hai.
--
-- Solution: authenticated user apni OWN profile read kar sake (self-read).
-- service_role ko hamesha allow karte hain (admin operations ke liye).
-- ============================================================================

-- 1. Agar profiles par RLS nahi hai to enable karo
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Purani koi bhi profiles policy ho to drop karo (idempotent)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_self_read') THEN
    DROP POLICY profiles_self_read ON public.profiles;
  END IF;
END $$;

-- 3. Self-read: authenticated user apni profile padh sakta hai
CREATE POLICY profiles_self_read ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- 4. Agar update ki zaroorat aaye to bhi (full_name, avatar_url)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_self_update') THEN
    DROP POLICY profiles_self_update ON public.profiles;
  END IF;
END $$;

CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
