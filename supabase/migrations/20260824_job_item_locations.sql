-- ============================================================================
-- 20260824_job_item_locations.sql
-- Job items ki physical location tracking — inventory ke `locations` master ka
-- reuse, bina kisi naye table ke.
--
-- Concept:
--   locations.kind = 'inventory' → permanent racks (spares/stock) [existing rows]
--   locations.kind = 'job'       → temporary spots (counter/shelf/tray) jahan
--                                  customer items repair-flow me rakhe jaate hain
--
-- transaction_list.location_id (nullable FK) source-of-truth hai.
-- Legacy `uniq_id` text column DUAL-WRITE ke liye rehta hai — jab bhi
-- location_id set ho, app uska readable path (sirf spot naam) uniq_id me
-- likhta hai, taaki purane screens/search/export bina badle kaam karein.
--
-- Backfill: live jobs ki purani non-empty uniq_id values ko kind='job'
-- location rows banakar link kar deta hai (purana data delete nahi hota).
-- Idempotent: baar baar run karne se error nahi aayega.
-- Apply: Supabase SQL Editor me run karo (ek baar).
-- ============================================================================

-- 1. locations.kind — 'inventory' | 'job' (default purane rows ke liye)
alter table public.locations
  add column if not exists kind text not null default 'inventory';

create index if not exists locations_kind_idx on public.locations (kind);

-- 2. transaction_list.location_id — nullable FK
alter table public.transaction_list
  add column if not exists location_id integer references public.locations(id);

create index if not exists transaction_list_location_idx
  on public.transaction_list (location_id);

-- 3. Backfill: live jobs ki uniq_id → kind='job' location rows (dupe-safe)
--    NOTE: locations.zone NOT NULL hai — job-spots ke liye '' (empty) use hota hai
insert into public.locations (zone, rack, kind)
select distinct '', t.uniq_id, 'job'
from public.transaction_list t
where t.del_status = 0
  and coalesce(t.uniq_id, '') <> ''
  and not exists (
    select 1 from public.locations l
    where l.kind = 'job' and l.rack = t.uniq_id and l.zone = ''
  );

-- 4. Link live jobs to their backfilled location rows
update public.transaction_list t
set location_id = l.id
from public.locations l
where l.kind = 'job'
  and l.rack = t.uniq_id
  and l.zone = ''
  and t.del_status = 0
  and coalesce(t.uniq_id, '') <> ''
  and t.location_id is null;

notify pgrst, 'reload schema';
