-- ════════════════════════════════════════════════════════════════════════
-- 20260912_rls_location_tables.sql
-- Location tables RLS lockdown — security hole close (live-verified 29 Aug 2026).
--
-- Problem (live anon probe, 29 Aug):
--   `20260817_product_level_location.sql` / `20260820_location_hierarchy.sql`
--   ne location tables par policies `CREATE POLICY ... USING (true)` (role =
--   `public` = anon samet) bana di thi. Ye tables RLS-hardening (20260910) ke
--   BAAD bani hain isliye hardening ne inhe kabhi cover nahi kiya.
--   LIVE CONFIRMED:
--     • locations         → anon SELECT 47 rows leak (zone/rack/bin/box/label)
--     • location_zones    → anon SELECT 3 rows + anon INSERT 201 SUCCESS
--     • location_racks/bins/boxes → policies `public` role, using(true) → anon-open
--   (`20260911_rls_lockdown.sql` ne product_locations gate kiya tha, par 5
--   location tables intentionally "alag follow-up" ke liye chhod di thi — lines
--   83–85 us file me.)
--
-- Fix (full idempotent):
--   Location tables (5) par purani `to public` policies drop karke, hardened
--   tables ke same `is_frontend_staff()` gate lagado — `rlslock_*_staff`
--   pattern (20260911 se) :
--       for all to authenticated  using (public.is_frontend_staff())
--                                 with check (public.is_frontend_staff())
--   App KABHI break nahi hoga:
--     • Saare location CRUD + full reads `/api/locations*` routes se hote hain
--       jo `getAdminSupabase()` (service-role, RLS-bypass) + `requireStaff()`
--       use karte hain → service_role RLS ignore karta hai, sab kaam chalega.
--     • Staff browser reads (inventory pages, dashboard) authenticated
--       `is_frontend_staff()` (admin/staff/developer) hain → pass karenge.
--     • Anon + ghost-authenticated user → ab 0 rows, insert/update blocked.
--
-- Apply: Supabase SQL Editor me run karo (ek baar, idempotent). Verify:
--   node scripts/verify-rls.cjs   +   scripts/check_rls.sql (Section 2 add)
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) RLS ON (idempotent) ──────────────────────────────────────────────
alter table public.locations        enable row level security;
alter table public.location_zones   enable row level security;
alter table public.location_racks   enable row level security;
alter table public.location_bins    enable row level security;
alter table public.location_boxes   enable row level security;

-- ── 2) Purani `to public` policies drop (idempotent) ────────────────────
do $$
declare p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'locations', 'location_zones', 'location_racks',
        'location_bins', 'location_boxes'
      )
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ── 3) Staff/Admin/Developer CRUD policies (is_frontend_staff gate) ─────
drop policy if exists rlslock_locations_staff on public.locations;
create policy rlslock_locations_staff on public.locations
  for all to authenticated
  using (public.is_frontend_staff())
  with check (public.is_frontend_staff());

drop policy if exists rlslock_location_zones_staff on public.location_zones;
create policy rlslock_location_zones_staff on public.location_zones
  for all to authenticated
  using (public.is_frontend_staff())
  with check (public.is_frontend_staff());

drop policy if exists rlslock_location_racks_staff on public.location_racks;
create policy rlslock_location_racks_staff on public.location_racks
  for all to authenticated
  using (public.is_frontend_staff())
  with check (public.is_frontend_staff());

drop policy if exists rlslock_location_bins_staff on public.location_bins;
create policy rlslock_location_bins_staff on public.location_bins
  for all to authenticated
  using (public.is_frontend_staff())
  with check (public.is_frontend_staff());

drop policy if exists rlslock_location_boxes_staff on public.location_boxes;
create policy rlslock_location_boxes_staff on public.location_boxes
  for all to authenticated
  using (public.is_frontend_staff())
  with check (public.is_frontend_staff());

-- ── 4) Reload PostgREST schema cache ─────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── 5) Report: location tables RLS status ────────────────────────────────
select relname as table, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('locations','location_zones','location_racks','location_bins','location_boxes')
order by relname;
