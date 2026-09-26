-- ============================================================================
-- 20260926_staff_geofence_permit.sql
-- Staff Geofence View-Only — Temporary Outside-Work Permit table
-- (docs/plans/staff_geofence_viewonly_plan.md §5 — Tier A soft, fail-closed)
--
--   * Per-user dynamic data hai isliye system_info key-value me NAHI — alag
--     table + periodic cleanup (plan §5.6).
--   * RLS: SELECT browser client se (staff apna permit + admin sab dekh sake —
--     is_frontend_staff() gate, repo pattern). INSERT/DELETE ke liye koi
--     authenticated policy NAHI → sirf service-role API route
--     (/api/admin/geofence-permit, requireAdmin) likh/sakta hai. Staff khud
--     ko permit nahi de sakta.
--   * Expiry hamesha DB time se: readers `expires_at > now()` filter karte
--     hain (plan §5.5) — client clock par trust nahi.
--
-- Follows repo conventions (20260922_bom_templates.sql mirror):
--   * bigint identity PK, guard-style idempotent constraints/indexes
--   * grants anon/authenticated/service_role
--   * idempotent: baar baar run safe
--
-- Apply: Supabase SQL Editor me run karo (ek baar). Verify:
--   select relname from pg_class
--   where relnamespace='public'::regnamespace and relname='staff_geofence_permit';
-- ============================================================================

-- ── 1) table ──────────────────────────────────────────────────────────────
create table if not exists public.staff_geofence_permit (
  id            bigint generated always as identity,
  user_id       uuid not null references auth.users(id) on delete cascade,
  mechanic_id   int null,                       -- optional: business staff mapping
  reason        text not null default '',       -- "client visit", "delivery", ...
  granted_by    uuid references auth.users(id), -- admin jisne diya (nullable: revoke-safe)
  granted_at    timestamptz not null default now(),
  expires_at    timestamptz not null,           -- timer end (authoritative)
  created_at    timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'staff_geofence_permit_pkey'
      and conrelid = 'public.staff_geofence_permit'::regclass
  ) then
    alter table only public.staff_geofence_permit
      add constraint staff_geofence_permit_pkey primary key (id);
  end if;
end $$;

create index if not exists staff_geofence_permit_user_idx
  on public.staff_geofence_permit(user_id);
create index if not exists staff_geofence_permit_expiry_idx
  on public.staff_geofence_permit(expires_at);

-- ── 2) RLS ────────────────────────────────────────────────────────────────
-- SELECT: frontend staff (apna permit check) + admin (list). INSERT/DELETE:
-- koi authenticated policy nahi — sirf service-role API (requireAdmin).
alter table public.staff_geofence_permit enable row level security;

drop policy if exists rlslock_geofence_permit_read on public.staff_geofence_permit;
create policy rlslock_geofence_permit_read on public.staff_geofence_permit
  for select to authenticated
  using (public.is_frontend_staff());

grant all on table public.staff_geofence_permit to anon;
grant all on table public.staff_geofence_permit to authenticated;
grant all on table public.staff_geofence_permit to service_role;
grant usage on sequence public.staff_geofence_permit_id_seq to anon, authenticated, service_role;

-- ── 3) Reload PostgREST schema cache ──────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── 4) Report ─────────────────────────────────────────────────────────────
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'staff_geofence_permit'
order by ordinal_position;
