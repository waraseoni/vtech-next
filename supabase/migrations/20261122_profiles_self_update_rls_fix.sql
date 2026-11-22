-- ══════════════════════════════════════════════════════════════════════════════
-- PROFILES SELF-UPDATE RLS FIX — /profile "Save Profile" (mechanic link) fail
-- ══════════════════════════════════════════════════════════════════════════════
-- BUG (22 Nov 2026 report): /profile → "Link to Mechanic Profile" select karke
-- Save dabate hi error. PostgREST deta hai:
--     new row violates row-level security policy for table "profiles"
--   (code 42501 — UI me bas yahi message "update failed" jaisa dikhta hai)
--   Naam (full_name) save bhi isi tarah fail hota — dono ek hi form hain.
--
-- ROOT CAUSE — dono profiles UPDATE policies ka WITH CHECK ASYMMETRIC tha:
--     coalesce(client_id, -1) IS NOT DISTINCT FROM public.get_my_client_id()
--                                   ↑ LEFT me -1        ↑ RIGHT me NULL
--
--   * Staff/admin profiles rows /api/admin/create-user se banti hain:
--         .insert({ id, full_name, role })   -- client_id NAHI bharha jata → NULL
--   * Self-update me client_id unchanged rehta hai (NULL), to WITH CHECK:
--         LEFT : coalesce(NULL, -1)  = -1
--         RIGHT: get_my_client_id() = NULL
--         -1 IS NOT DISTINCT FROM NULL  →  FALSE  →  poora UPDATE block
--   * role clause me bhi same asymmetry (role-NULL legacy row par):
--         coalesce(role, '') = get_my_role()   →  '' vs NULL → fail
--
--   Kyun pehle nahi pakda: service-role routes (/api/user-avatar,
--   /api/admin/update-profile) RLS bypass karte hain — unka kaam chalta raha.
--   Sirf `/profile` ka save DIRECT PostgREST (RLS) se jaata tha → wahi fail.
--
-- FIX — symmetric NULL-safe compare (dono taraf same, coalesce hatao):
--     role      IS NOT DISTINCT FROM public.get_my_role()
--     client_id IS NOT DISTINCT FROM public.get_my_client_id()
--
-- SECURITY INTENT SAME (role + client_id immutable) aur pehle se STRICTER:
--   * nayi value purani se EXACT (NULL-safe) match — escalation impossible.
--   * (purana -1 → naya NULL) ab block, jo coalesce-form me chalta tha.
--   * ONLY behavior change: (purana NULL → naya NULL) ab ALLOW — yahi bug tha.
--   * Verify: old='staff' + new='admin' → 'admin' vs 'staff' → FALSE ✓ block.
--
-- Rollback (agar kabhi chahiye) — purani definitions wapas:
--   create policy rlslock_profiles_client_self_update on public.profiles
--     for update to authenticated using (id = auth.uid())
--     with check (id = auth.uid()
--       and coalesce(role, '') = public.get_my_role()
--       and coalesce(client_id, -1) is not distinct from public.get_my_client_id());
--   create policy rlslock_profiles_staff_update on public.profiles
--     for update to authenticated using (id = auth.uid())
--     with check (id = auth.uid() and public.is_frontend_staff()
--       and coalesce(role, '') = public.get_my_role()
--       and coalesce(client_id, -1) is not distinct from public.get_my_client_id());
--   (rollback ke baad /profile save wapas fail hoga — jaan-boojh kar.)
--
-- Scope: sirf client-side SELF-update. Service-role (admin APIs) par koi asar nahi.
-- Idempotent: DROP IF EXISTS + CREATE — kitni baar bhi chalao safe.
-- Live apply = OWNER APPROVAL (verify query neeche comment me).
-- ══════════════════════════════════════════════════════════════════════════════

drop policy if exists rlslock_profiles_client_self_update on public.profiles;
create policy rlslock_profiles_client_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role is not distinct from public.get_my_role()
    and client_id is not distinct from public.get_my_client_id()
  );

drop policy if exists rlslock_profiles_staff_update on public.profiles;
create policy rlslock_profiles_staff_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and public.is_frontend_staff()
    and role is not distinct from public.get_my_role()
    and client_id is not distinct from public.get_my_client_id()
  );

-- PostgREST schema cache refresh (policy change ke baad)
notify pgrst, 'reload schema';

-- ── Read-only verification (apply ke baad) ──────────────────────────────────
--   select policyname, cmd, qual, with_check
--     from pg_policies
--    where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE';
--   Expected: dono policies me `role is not distinct from ...` +
--             `client_id is not distinct from ...` dikhe, coalesce nahi.
