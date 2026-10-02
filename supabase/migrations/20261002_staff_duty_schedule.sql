-- ============================================================================
-- 20261002_staff_duty_schedule.sql
-- Staff Duty Schedule — per-staff default duty time + HISTORY
-- (docs/ATTENDANCE_DUTY_HOURS_PLAN.md §Part B — Phase P2)
--
-- Kyun: attendance/salary ab tak sirf shop-level office hours par chalti thi.
-- Ab har staff ki apni duty (start/end) ho, aur EFFECTIVE-DATED HISTORY ho —
-- "aaj se kya hai" aur "ab tak kya tha" dono dikhen. Salary history
-- (mechanic_salary_history) bilkul isi pattern ki hai — wahi convention.
--
-- P2 decisions (plan ke against do deliberate simplifications):
--   1. APPEND-ONLY + effective_from — `effective_to` column NAHI. Range
--      read-time derive hota hai (is row ka effective_from .. next-naye row ka
--      effective_from - 1). Faida: client write ek hi INSERT/UPSERT hai —
--      "purani row close karo + nayi insert karo" wali do-step race nahi
--      (client-side transaction available nahi hai).
--   2. RLS se likhai admin/developer tak — service-role API route ki zaroorat
--      nahi. Duty pay se juda hai, isliye staff khud apni duty change na kar
--      sake (UI gate: MechanicsBody duty section sirf admin ko dikhata hai).
--      SELECT sab staff ko — report/attendance page duty dikha sake.
--
-- Schema notes:
--   * duty_start/duty_end = time (attendance_list.time_in/time_out ke same
--     type) → PostgREST "HH:MM:SS" deta hai; src/lib/duty.ts normTime() se
--     "HH:MM" banata hai.
--   * UNIQUE (mechanic_id, effective_from) → ek din me ek hi row; save
--     `on conflict do update` (upsert) use karta hai.
--   * Koi start<end check NAHI — overnight duty (22:00-06:00) valid hai.
--   * break_minutes abhi UI me nahi (default 0), P3 engine use karega.
--
-- Follows repo conventions (20260926_staff_geofence_permit.sql mirror):
--   * bigint identity PK, guard-style idempotent constraints/indexes
--   * grants anon/authenticated/service_role
--   * idempotent: baar baar run safe
--
-- Apply: Supabase SQL Editor me run karo (ek baar). Verify:
--   select id, mechanic_id, duty_start, duty_end, effective_from
--   from public.staff_duty_schedule order by effective_from desc;
-- ============================================================================

-- ── 1) table ──────────────────────────────────────────────────────────────
create table if not exists public.staff_duty_schedule (
  id             bigint generated always as identity,
  mechanic_id    int not null references public.mechanic_list(id) on delete cascade,
  duty_start     time not null default '10:00',
  duty_end       time not null default '20:00',
  break_minutes  int not null default 0,
  effective_from date not null default CURRENT_DATE,
  note           text not null default '',
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  constraint staff_duty_schedule_break_ck check (break_minutes >= 0),
  constraint staff_duty_schedule_mech_from_uniq unique (mechanic_id, effective_from)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'staff_duty_schedule_pkey'
      and conrelid = 'public.staff_duty_schedule'::regclass
  ) then
    alter table only public.staff_duty_schedule
      add constraint staff_duty_schedule_pkey primary key (id);
  end if;
end $$;

create index if not exists staff_duty_schedule_lookup_idx
  on public.staff_duty_schedule(mechanic_id, effective_from desc);

-- ── 2) RLS ────────────────────────────────────────────────────────────────
-- SELECT: frontend staff (attendance/report duty dikhe).
-- INSERT/UPDATE/DELETE: sirf admin/developer (profiles.role) — duty salary se
-- juda hai, staff khud apni duty change na kar sake. Fail-closed: bina
-- profiles row ke (ya bina admin role ke) write RLS hi block kar dega.
alter table public.staff_duty_schedule enable row level security;

drop policy if exists rlslock_staff_duty_schedule_read on public.staff_duty_schedule;
create policy rlslock_staff_duty_schedule_read on public.staff_duty_schedule
  for select to authenticated
  using (public.is_frontend_staff());

drop policy if exists rlslock_staff_duty_schedule_ins on public.staff_duty_schedule;
create policy rlslock_staff_duty_schedule_ins on public.staff_duty_schedule
  for insert to authenticated
  with check (
    public.is_frontend_staff()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'developer')
    )
  );

drop policy if exists rlslock_staff_duty_schedule_upd on public.staff_duty_schedule;
create policy rlslock_staff_duty_schedule_upd on public.staff_duty_schedule
  for update to authenticated
  using (
    public.is_frontend_staff()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'developer')
    )
  )
  with check (
    public.is_frontend_staff()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'developer')
    )
  );

drop policy if exists rlslock_staff_duty_schedule_del on public.staff_duty_schedule;
create policy rlslock_staff_duty_schedule_del on public.staff_duty_schedule
  for delete to authenticated
  using (
    public.is_frontend_staff()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'developer')
    )
  );

grant all on table public.staff_duty_schedule to anon;
grant all on table public.staff_duty_schedule to authenticated;
grant all on table public.staff_duty_schedule to service_role;
grant usage on sequence public.staff_duty_schedule_id_seq to anon, authenticated, service_role;

-- ── 3) Reload PostgREST schema cache ──────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── 4) Report ─────────────────────────────────────────────────────────────
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'staff_duty_schedule'
order by ordinal_position;
