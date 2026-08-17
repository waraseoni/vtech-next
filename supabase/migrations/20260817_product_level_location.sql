-- ============================================================================
-- 20260817_product_level_location.sql
-- Location Master System: locations table + product_locations junction table.
--
-- Architecture:
--   locations        = master list of all physical locations in shop
--   product_locations = which products are at which locations (many-to-many)
--
-- Idempotent: baar baar run karne se error nahi aayega.
-- ============================================================================

-- ── 1. locations table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.locations (
  id          serial PRIMARY KEY,
  zone        text NOT NULL,
  rack        text NOT NULL DEFAULT '',
  bin         text NOT NULL DEFAULT '',
  box         text NOT NULL DEFAULT '',
  label       text,
  status      int NOT NULL DEFAULT 1,
  delete_flag int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(zone, rack, bin, box)
);

CREATE INDEX IF NOT EXISTS locations_zone_idx ON public.locations (zone);

-- ── 2. product_locations junction table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_locations (
  product_id  int NOT NULL REFERENCES public.product_list(id) ON DELETE CASCADE,
  location_id int NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (product_id, location_id)
);

CREATE INDEX IF NOT EXISTS product_locations_product_idx ON public.product_locations (product_id);
CREATE INDEX IF NOT EXISTS product_locations_location_idx ON public.product_locations (location_id);

-- ── 3. Migrate data from product_list.place_* → locations + product_locations ─
-- Auto-generate locations from existing product_list place data, then link.
DO $$
DECLARE
  r RECORD;
  loc_id int;
BEGIN
  FOR r IN
    SELECT DISTINCT place_zone, place_rack, place_bin, place_box
    FROM public.product_list
    WHERE place_zone IS NOT NULL AND place_zone != ''
  LOOP
    -- Insert location if not exists
    INSERT INTO public.locations (zone, rack, bin, box, label)
    VALUES (
      r.place_zone,
      COALESCE(r.place_rack, ''),
      COALESCE(r.place_bin, ''),
      COALESCE(r.place_box, ''),
      CONCAT_WS(' ▸ ', r.place_zone,
        NULLIF(COALESCE(r.place_rack, ''), ''),
        NULLIF(COALESCE(r.place_bin, ''), ''),
        NULLIF(COALESCE(r.place_box, ''), ''))
    )
    ON CONFLICT (zone, rack, bin, box) DO UPDATE SET zone = EXCLUDED.zone
    RETURNING id INTO loc_id;

    -- Link products to this location
    INSERT INTO public.product_locations (product_id, location_id)
    SELECT pl.id, loc_id
    FROM public.product_list pl
    WHERE pl.place_zone = r.place_zone
      AND COALESCE(pl.place_rack, '') = COALESCE(r.place_rack, '')
      AND COALESCE(pl.place_bin, '')  = COALESCE(r.place_bin, '')
      AND COALESCE(pl.place_box, '')  = COALESCE(r.place_box, '')
    ON CONFLICT (product_id, location_id) DO NOTHING;
  END LOOP;
END $$;

-- ── 4. Also migrate from inventory_list legacy place data ────────────────────
-- For products that have stock entries with location but no product_list location.
DO $$
DECLARE
  r RECORD;
  loc_id int;
BEGIN
  FOR r IN
    SELECT DISTINCT il.product_id, il.place_zone, il.place_rack, il.place_bin, il.place_box
    FROM public.inventory_list il
    INNER JOIN public.product_list pl ON pl.id = il.product_id
    WHERE il.place_zone IS NOT NULL AND il.place_zone != ''
      AND pl.place_zone IS NULL
  LOOP
    INSERT INTO public.locations (zone, rack, bin, box, label)
    VALUES (
      r.place_zone,
      COALESCE(r.place_rack, ''),
      COALESCE(r.place_bin, ''),
      COALESCE(r.place_box, ''),
      CONCAT_WS(' ▸ ', r.place_zone,
        NULLIF(COALESCE(r.place_rack, ''), ''),
        NULLIF(COALESCE(r.place_bin, ''), ''),
        NULLIF(COALESCE(r.place_box, ''), ''))
    )
    ON CONFLICT (zone, rack, bin, box) DO UPDATE SET zone = EXCLUDED.zone
    RETURNING id INTO loc_id;

    INSERT INTO public.product_locations (product_id, location_id)
    VALUES (r.product_id, loc_id)
    ON CONFLICT (product_id, location_id) DO NOTHING;
  END LOOP;
END $$;

-- ── 5. Reload Supabase PostgREST schema cache ───────────────────────────────
NOTIFY pgrst, 'reload schema';
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS delete_flag int NOT NULL DEFAULT 0;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS status int NOT NULL DEFAULT 1;