-- ══════════════════════════════════════════════════════════════════════════════
-- SERVICE CENTER FIELDS + DEVICE IDENTITY MASTERS (22 Nov 2026)
-- ══════════════════════════════════════════════════════════════════════════════
-- Source plans:
--   docs/plans/service_center_data_model_plan_2026-11-21.md (v2 §§2.1-2.5)
--   docs/plans/job_device_identity_ux_plan_2026-11-24.md     (§6)
--
-- Kaam:
--   1. 5 master tables: brands, service_types, brand_job_counters (P4 tak unused),
--      device_models (brand-linked), device_identifiers (serial/IMEI/chassis).
--   2. transaction_list me 9 NULLABLE columns — `item` text NOT NULL **unchanged**.
--   3. `service_center_mode` KV row (default autonomous) — koi naya table nahi.
--   4. RLS = is_frontend_staff() (authenticated) + anon ko koi grant nahi = deny.
--   5. moddatetime triggers, indexes, NOTIFY pgrst.
--
-- NON-NEGOTIABLE (purana plan §11):
--   * backfill NAHI — legacy ~2370 rows ka `item` jaisa ka taisa rahega.
--   * har naya column NULLABLE — old backup restore par row fail nahi hoga.
--   * global `job_id` / next_job_id() / partial unique index ko HATH NAHI lagana.
--   * deactivate-only (is_active=false) — master rows hard-delete nahi.
--
-- Idempotent: kitni baar bhi chalao safe. Live apply = OWNER APPROVAL (SQL Editor).
-- Rollback: niche ke DROP statements comments me hain (sirf tab jab columns khali hon).
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Master tables ─────────────────────────────────────────────────────────

create table if not exists public.brands (
  id             serial primary key,
  name           text not null unique,
  code           varchar(10) unique,
  is_authorized  boolean not null default false,
  authorized_no  text,
  logo_url       text,
  support_phone  text,
  support_email  text,
  is_active      boolean not null default true,
  date_created   timestamptz default now(),
  date_updated   timestamptz default now()
);

create table if not exists public.service_types (
  id         serial primary key,
  name       text not null unique,
  sort_order smallint not null default 0,
  is_active  boolean not null default true
);

-- Vikalp B blueprint (P4 — brand numbering). Abhi koi code is table ko use nahi karta.
create table if not exists public.brand_job_counters (
  brand_id             integer primary key references public.brands(id) on delete cascade,
  last_sequence_number integer not null default 0,
  prefix               varchar(10) not null,
  date_updated         timestamptz default CURRENT_TIMESTAMP
);

-- UX plan §6: model brand se linked (galat brand-model combo rokne ke liye).
create table if not exists public.device_models (
  id           serial primary key,
  name         text not null,
  brand_id     integer references public.brands(id) on delete restrict,
  is_active    boolean not null default true,
  date_created timestamptz default now(),
  date_updated timestamptz default now()
);

-- UX plan §6: value = trim + upper(serial / IMEI / chassis / vehicle no).
create table if not exists public.device_identifiers (
  id           serial primary key,
  value        text not null unique,
  note         text,
  is_active    boolean not null default true,
  last_used    timestamptz,
  date_created timestamptz default now(),
  date_updated timestamptz default now()
);

comment on table public.device_identifiers is
  'Searchable identifier registry (serial / IMEI / chassis / vehicle). App trim+upper karke likhti hai; duplicate par soft warning, hard constraint nahi.';

-- ── 2. transaction_list — additive columns only ─────────────────────────────
-- `item` ko chhua tak nahi (not null, text, legacy container + derived preview).

alter table public.transaction_list add column if not exists brand_id integer references public.brands(id) on delete set null;
alter table public.transaction_list add column if not exists item_category text;
alter table public.transaction_list add column if not exists model text;
alter table public.transaction_list add column if not exists serial_no text;
alter table public.transaction_list add column if not exists service_type_id integer references public.service_types(id) on delete set null;
alter table public.transaction_list add column if not exists warranty_status text;
alter table public.transaction_list add column if not exists warranty_until date;
alter table public.transaction_list add column if not exists warranty_claim_no text;
alter table public.transaction_list add column if not exists warranty_claim_status text;

comment on column public.transaction_list.item is
  'Legacy + derived label. Kabhi rename/drop mat karo; naye device fields se compose kiya jata hai (deviceIdentity.ts).';
comment on column public.transaction_list.serial_no is
  'UI label = Identifier. Free-text bhi allow (master me na ho to direct type), warning soft hai.';

-- Search/filter ke liye (jobListQueries.ts:193,315; useNavbarSearch.ts:113,116).
create index if not exists transaction_list_brand_id_idx
  on public.transaction_list (brand_id) where brand_id is not null;

-- Inline add-new dedupe (JobSpotPicker pattern) ke liye case-insensitive guards.
create index if not exists device_models_active_brand_idx
  on public.device_models (brand_id, name) where is_active;
create unique index if not exists device_models_active_name_uniq
  on public.device_models (coalesce(brand_id, 0), lower(btrim(name))) where is_active;
create unique index if not exists device_identifiers_value_norm_uniq
  on public.device_identifiers (upper(btrim(value)));

-- ── 3. Seeds (ON CONFLICT / DO block — idempotent) ───────────────────────────

insert into public.service_types (name, sort_order) values
  ('Repair', 0),
  ('New Installation', 10),
  ('Warranty Claim', 20),
  ('AMC / Service Visit', 30),
  ('PDI / Delivery', 40),
  ('Inspection / Estimate', 50)
on conflict (name) do nothing;

insert into public.brands (name, code, is_authorized, is_active)
values ('General / Unbranded', 'GEN', false, true)
on conflict (name) do nothing;

-- system_info me meta_field par UNIQUE nahi hai (sirf id PK) — isliye DO block.
do $$
begin
  if not exists (select 1 from public.system_info where meta_field = 'service_center_mode') then
    insert into public.system_info (meta_field, meta_value) values ('service_center_mode', 'autonomous');
  end if;
end $$;

-- ── 4. RLS — authenticated staff only; anon = NO policy + NO grant = deny ────

alter table public.brands enable row level security;
alter table public.service_types enable row level security;
alter table public.brand_job_counters enable row level security;
alter table public.device_models enable row level security;
alter table public.device_identifiers enable row level security;

drop policy if exists rlslock_brands_staff on public.brands;
create policy rlslock_brands_staff on public.brands to authenticated
  using (public.is_frontend_staff()) with check (public.is_frontend_staff());

drop policy if exists rlslock_service_types_staff on public.service_types;
create policy rlslock_service_types_staff on public.service_types to authenticated
  using (public.is_frontend_staff()) with check (public.is_frontend_staff());

drop policy if exists rlslock_brand_job_counters_staff on public.brand_job_counters;
create policy rlslock_brand_job_counters_staff on public.brand_job_counters to authenticated
  using (public.is_frontend_staff()) with check (public.is_frontend_staff());

drop policy if exists rlslock_device_models_staff on public.device_models;
create policy rlslock_device_models_staff on public.device_models to authenticated
  using (public.is_frontend_staff()) with check (public.is_frontend_staff());

drop policy if exists rlslock_device_identifiers_staff on public.device_identifiers;
create policy rlslock_device_identifiers_staff on public.device_identifiers to authenticated
  using (public.is_frontend_staff()) with check (public.is_frontend_staff());

-- Grants: service-role + authenticated (browser inline-add ke liye); anon ko kuch nahi.
revoke all on table public.brands from anon;
grant all on table public.brands to authenticated;
grant all on table public.brands to service_role;
revoke all on sequence public.brands_id_seq from anon;
grant all on sequence public.brands_id_seq to authenticated;
grant all on sequence public.brands_id_seq to service_role;

revoke all on table public.service_types from anon;
grant all on table public.service_types to authenticated;
grant all on table public.service_types to service_role;
revoke all on sequence public.service_types_id_seq from anon;
grant all on sequence public.service_types_id_seq to authenticated;
grant all on sequence public.service_types_id_seq to service_role;

revoke all on table public.brand_job_counters from anon;
grant all on table public.brand_job_counters to authenticated;
grant all on table public.brand_job_counters to service_role;
-- brand_job_counters ka PK brand_id hai — alag sequence nahi hoti.

revoke all on table public.device_models from anon;
grant all on table public.device_models to authenticated;
grant all on table public.device_models to service_role;
revoke all on sequence public.device_models_id_seq from anon;
grant all on sequence public.device_models_id_seq to authenticated;
grant all on sequence public.device_models_id_seq to service_role;

revoke all on table public.device_identifiers from anon;
grant all on table public.device_identifiers to authenticated;
grant all on table public.device_identifiers to service_role;
revoke all on sequence public.device_identifiers_id_seq from anon;
grant all on sequence public.device_identifiers_id_seq to authenticated;
grant all on sequence public.device_identifiers_id_seq to service_role;

-- ── 5. moddatetime triggers ──────────────────────────────────────────────────

drop trigger if exists update_brands_timestamp on public.brands;
create trigger update_brands_timestamp before update on public.brands
  for each row execute function extensions.moddatetime('date_updated');

drop trigger if exists update_device_models_timestamp on public.device_models;
create trigger update_device_models_timestamp before update on public.device_models
  for each row execute function extensions.moddatetime('date_updated');

drop trigger if exists update_device_identifiers_timestamp on public.device_identifiers;
create trigger update_device_identifiers_timestamp before update on public.device_identifiers
  for each row execute function extensions.moddatetime('date_updated');

-- PostgREST schema cache refresh
notify pgrst, 'reload schema';

commit;

-- ── Read-only verification (apply ke baad, SQL Editor me) ────────────────────
--   select column_name, is_nullable, data_type
--     from information_schema.columns
--    where table_schema='public' and table_name='transaction_list'
--      and column_name in ('item','brand_id','model','serial_no','service_type_id');
--   Expected: item = NO (NOT NULL, text), baaki sab YES.
--   select tablename from pg_tables where schemaname='public'
--     and tablename in ('brands','service_types','device_models','device_identifiers');
--   select policyname, cmd from pg_policies where schemaname='public'
--     and tablename in ('brands','service_types','device_models','device_identifiers');
--   Expected: sirf authenticated policies; anon ke liye koi row nahi.
--
-- ── Rollback (sirf jab naye columns/tables khali hon — owner approval se) ────
--   drop table if exists public.device_identifiers;
--   drop table if exists public.device_models;
--   drop table if exists public.brand_job_counters;
--   drop table if exists public.service_types;
--   drop table if exists public.brands;
--   alter table public.transaction_list
--     drop column if exists warranty_claim_status, drop column if exists warranty_claim_no,
--     drop column if exists warranty_until, drop column if exists warranty_status,
--     drop column if exists service_type_id, drop column if exists serial_no,
--     drop column if exists model, drop column if exists item_category,
--     drop column if exists brand_id;
--   delete from public.system_info where meta_field = 'service_center_mode';
--   notify pgrst, 'reload schema';
