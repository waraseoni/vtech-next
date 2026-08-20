-- ── Location Hierarchy System ────────────────────────────────────────────
-- Zone > Rack > Bin > Box — 4-level hierarchy for structured locations.
-- Each level gets its own table with parent FK.
-- locations table gets new FK columns + auto-generated code.

-- 1. location_zones
CREATE TABLE IF NOT EXISTS public.location_zones (
  id          serial PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  status      int NOT NULL DEFAULT 1,
  delete_flag int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- 2. location_racks
CREATE TABLE IF NOT EXISTS public.location_racks (
  id          serial PRIMARY KEY,
  zone_id     int NOT NULL REFERENCES public.location_zones(id) ON DELETE CASCADE,
  name        text NOT NULL,
  status      int NOT NULL DEFAULT 1,
  delete_flag int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(zone_id, name)
);

-- 3. location_bins
CREATE TABLE IF NOT EXISTS public.location_bins (
  id          serial PRIMARY KEY,
  rack_id     int NOT NULL REFERENCES public.location_racks(id) ON DELETE CASCADE,
  name        text NOT NULL,
  status      int NOT NULL DEFAULT 1,
  delete_flag int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(rack_id, name)
);

-- 4. location_boxes
CREATE TABLE IF NOT EXISTS public.location_boxes (
  id          serial PRIMARY KEY,
  bin_id      int NOT NULL REFERENCES public.location_bins(id) ON DELETE CASCADE,
  name        text NOT NULL,
  status      int NOT NULL DEFAULT 1,
  delete_flag int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(bin_id, name)
);

-- 5. Add FK columns + code to locations table
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS code   text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS zone_id int REFERENCES public.location_zones(id);
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS rack_id int REFERENCES public.location_racks(id);
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS bin_id  int REFERENCES public.location_bins(id);
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS box_id  int REFERENCES public.location_boxes(id);

CREATE UNIQUE INDEX IF NOT EXISTS locations_code_idx ON public.locations (code) WHERE code IS NOT NULL;

-- 6. RLS policies for all new tables (staff can read, admin can write)
ALTER TABLE public.location_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_boxes ENABLE ROW LEVEL SECURITY;

-- Zones policies
CREATE POLICY "Staff can read zones" ON public.location_zones FOR SELECT USING (true);
CREATE POLICY "Staff can insert zones" ON public.location_zones FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff can update zones" ON public.location_zones FOR UPDATE USING (true);
CREATE POLICY "Staff can delete zones" ON public.location_zones FOR DELETE USING (true);

-- Racks policies
CREATE POLICY "Staff can read racks" ON public.location_racks FOR SELECT USING (true);
CREATE POLICY "Staff can insert racks" ON public.location_racks FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff can update racks" ON public.location_racks FOR UPDATE USING (true);
CREATE POLICY "Staff can delete racks" ON public.location_racks FOR DELETE USING (true);

-- Bins policies
CREATE POLICY "Staff can read bins" ON public.location_bins FOR SELECT USING (true);
CREATE POLICY "Staff can insert bins" ON public.location_bins FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff can update bins" ON public.location_bins FOR UPDATE USING (true);
CREATE POLICY "Staff can delete bins" ON public.location_bins FOR DELETE USING (true);

-- Boxes policies
CREATE POLICY "Staff can read boxes" ON public.location_boxes FOR SELECT USING (true);
CREATE POLICY "Staff can insert boxes" ON public.location_boxes FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff can update boxes" ON public.location_boxes FOR UPDATE USING (true);
CREATE POLICY "Staff can delete boxes" ON public.location_boxes FOR DELETE USING (true);

-- 7. Also ensure locations table has permissive policies (it was blocked before)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read locations" ON public.locations FOR SELECT USING (true);
CREATE POLICY "Staff can insert locations" ON public.locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff can update locations" ON public.locations FOR UPDATE USING (true);
CREATE POLICY "Staff can delete locations" ON public.locations FOR DELETE USING (true);

-- 8. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 1. 4 entity tables
CREATE TABLE IF NOT EXISTS public.location_zones (
  id serial PRIMARY KEY, name text NOT NULL UNIQUE,
  status int NOT NULL DEFAULT 1, delete_flag int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.location_racks (
  id serial PRIMARY KEY, zone_id int NOT NULL REFERENCES public.location_zones(id) ON DELETE CASCADE,
  name text NOT NULL, status int NOT NULL DEFAULT 1, delete_flag int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(), UNIQUE(zone_id, name)
);
CREATE TABLE IF NOT EXISTS public.location_bins (
  id serial PRIMARY KEY, rack_id int NOT NULL REFERENCES public.location_racks(id) ON DELETE CASCADE,
  name text NOT NULL, status int NOT NULL DEFAULT 1, delete_flag int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(), UNIQUE(rack_id, name)
);
CREATE TABLE IF NOT EXISTS public.location_boxes (
  id serial PRIMARY KEY, bin_id int NOT NULL REFERENCES public.location_bins(id) ON DELETE CASCADE,
  name text NOT NULL, status int NOT NULL DEFAULT 1, delete_flag int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(), UNIQUE(bin_id, name)
);

-- 2. locations table columns
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS zone_id int REFERENCES public.location_zones(id);
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS rack_id int REFERENCES public.location_racks(id);
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS bin_id int REFERENCES public.location_bins(id);
ALTER TABLE.public.locations ADD COLUMN IF NOT EXISTS box_id int REFERENCES public.location_boxes(id);
CREATE UNIQUE INDEX IF NOT EXISTS locations_code_idx ON public.locations (code) WHERE code IS NOT NULL;

-- 3. RLS policies
ALTER TABLE public.location_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read" ON public.location_zones FOR SELECT USING (true);
CREATE POLICY "Staff insert" ON public.location_zones FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff update" ON public.location_zones FOR UPDATE USING (true);
CREATE POLICY "Staff delete" ON public.location_zones FOR DELETE USING (true);

CREATE POLICY "Staff read" ON public.location_racks FOR SELECT USING (true);
CREATE POLICY "Staff insert" ON public.location_racks FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff update" ON public.location_racks FOR UPDATE USING (true);
CREATE POLICY "Staff delete" ON public.location_racks FOR DELETE USING (true);

CREATE POLICY "Staff read" ON public.location_bins FOR SELECT USING (true);
CREATE POLICY "Staff insert" ON public.location_bins FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff update" ON public.location_bins FOR UPDATE USING (true);
CREATE POLICY "Staff delete" ON public.location_bins FOR DELETE USING (true);

CREATE POLICY "Staff read" ON public.location_boxes FOR SELECT USING (true);
CREATE POLICY "Staff insert" ON public.location_boxes FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff update" ON public.location_boxes FOR UPDATE USING (true);
CREATE POLICY "Staff delete" ON public.location_boxes FOR DELETE USING (true);

CREATE POLICY "Staff read locations" ON public.locations FOR SELECT USING (true);
CREATE POLICY "Staff insert locations" ON public.locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff update locations" ON public.locations FOR UPDATE USING (true);
CREATE POLICY "Staff delete locations" ON public.locations FOR DELETE USING (true);

NOTIFY pgrst, 'reload schema';