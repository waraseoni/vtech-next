-- ============================================================================
-- 20260816_inventory_locations.sql
-- Structured shelf/box location system for inventory ("Spare Finder").
--
-- Har stock-in row ab ek hierarchy par beth sakta hai:
--   Zone (kaunse area) ▸ Rack/Shelf (kaunsi almari) ▸ Bin (kaunsa section)
--   ▸ Box (kaunsa dibba/drawer)
--
-- `place` free-text column abhi bhi exist karta hai (legacy + derived). Jab
-- structured fields bhare jate hain to frontend `place` = "Zone ▸ Rack ▸ Bin ▸
-- Box" derived rakhta hai, taaki purani screens (inventory list, stock history,
-- dashboard) bina change ke kaam karti rahein.
--
-- Idempotent: baar baar run karne se error nahi aayega.
-- Apply: Supabase SQL Editor me run karo (ek baar).
-- ============================================================================

alter table public.inventory_list
  add column if not exists place_zone text;
alter table public.inventory_list
  add column if not exists place_rack text;
alter table public.inventory_list
  add column if not exists place_bin  text;
alter table public.inventory_list
  add column if not exists place_box  text;

-- Zone search (Spare Finder browse tree) fast banane ke liye.
create index if not exists inventory_list_place_zone_idx
  on public.inventory_list (place_zone);
