-- ============================================================================
-- 20260920_inventory_location_cleanup.sql
-- I6 location data-model cleanup — PHASE 1 (mapping completion + write symmetry)
--
-- Dual location model samajhein:
--   * LEGACY:  inventory_list.place (free text path) + place_zone/rack/bin/box
--   * NEW:     locations master + product_locations junction (product → location)
--
-- 20260817_product_level_location.sql ne ek backfill kiya tha (product_list +
-- partial inventory_list), lekin gaps bache: free-text `place` wali rows,
-- aur products jinka koi mapping nahi. Phase 1 wahi gaps band karta hai,
-- zero data loss, fully idempotent. Column DROP (place* removal) = Phase 2,
-- karne se pehle mapping verify + dedicated window chahiye (plan §I6).
--
-- Phase 1 me ye do kaam:
--   A) Har product (jiska koi product_locations mapping NAHI) ko ek canonical
--      location mile — priority:
--        1. inventory_list structured place_* (latest stock row)
--        2. inventory_list free-text place      (latest stock row)
--        3. product_list structured place_*
--      locations + product_locations dono me insert (ON CONFLICT safe).
--   B) `inventory_list` par BEFORE INSERT OR UPDATE trigger jo structured
--      columns use hone par `place` (derived path) auto-sync kare — jisse
--      purane screens (list/history/dashboard/RPC) bina change ke path
--      paayein aur writers kabhi drift na karein.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- A) Mapping completion — har unmapped product ko canonical location
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  p RECORD;
  loc_id integer;
  v_zone  text := '';
  v_rack  text := '';
  v_bin   text := '';
  v_box   text := '';
BEGIN
  FOR p IN
    SELECT pl.id AS product_id
    FROM public.product_list pl
    WHERE pl.delete_flag = 0
      AND NOT EXISTS (
        SELECT 1 FROM public.product_locations x WHERE x.product_id = pl.id
      )
  LOOP
    v_zone := ''; v_rack := ''; v_bin := ''; v_box := '';

    -- Priority 1: inventory_list structured place_* (latest stock row)
    SELECT i.place_zone, i.place_rack, i.place_bin, i.place_box
      INTO v_zone, v_rack, v_bin, v_box
      FROM public.inventory_list i
     WHERE i.product_id = p.product_id
       AND i.place_zone IS NOT NULL AND i.place_zone <> ''
     ORDER BY i.stock_date DESC NULLS LAST, i.id DESC
     LIMIT 1;

    -- Priority 2: inventory_list free-text place → zone (legacy convention)
    IF v_zone IS NULL OR v_zone = '' THEN
      SELECT i.place INTO v_zone
        FROM public.inventory_list i
       WHERE i.product_id = p.product_id
         AND i.place IS NOT NULL AND i.place <> ''
       ORDER BY i.stock_date DESC NULLS LAST, i.id DESC
       LIMIT 1;
      IF v_zone IS NOT NULL AND v_zone <> '' THEN
        v_rack := ''; v_bin := ''; v_box := '';
      END IF;
    END IF;

    -- Priority 3: product_list structured place_*
    IF v_zone IS NULL OR v_zone = '' THEN
      SELECT pl2.place_zone, pl2.place_rack, pl2.place_bin, pl2.place_box
        INTO v_zone, v_rack, v_bin, v_box
        FROM public.product_list pl2
       WHERE pl2.id = p.product_id;
    END IF;

    -- Location create + product link (ON CONFLICT safe, RETURNS id)
    IF v_zone IS NOT NULL AND v_zone <> '' THEN
      INSERT INTO public.locations (zone, rack, bin, box, label)
      VALUES (
        v_zone,
        COALESCE(v_rack, ''),
        COALESCE(v_bin, ''),
        COALESCE(v_box, ''),
        CONCAT_WS(' ▸ ', v_zone,
          NULLIF(COALESCE(v_rack, ''), ''),
          NULLIF(COALESCE(v_bin, ''), ''),
          NULLIF(COALESCE(v_box, ''), ''))
      )
      ON CONFLICT (zone, rack, bin, box) DO UPDATE SET zone = EXCLUDED.zone
      RETURNING id INTO loc_id;

      INSERT INTO public.product_locations (product_id, location_id)
      VALUES (p.product_id, loc_id)
      ON CONFLICT (product_id, location_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- B) Write symmetry — `place` derived path ko structured columns ke saath sync
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.inventory_sync_place_path()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Structured fields use ho rahe hain → `place` hamesha path = fields.
  -- (Writers jo sirf `place` set karte hain — record_stocktake, receive —
  --   untouched rehte hain, kyunki structured empty hai.)
  IF COALESCE(NEW.place_zone, '') <> ''
     OR COALESCE(NEW.place_rack, '') <> ''
     OR COALESCE(NEW.place_bin, '') <> ''
     OR COALESCE(NEW.place_box, '') <> '' THEN
    NEW.place := CONCAT_WS(' ▸ ',
      NULLIF(COALESCE(NEW.place_zone, ''), ''),
      NULLIF(COALESCE(NEW.place_rack, ''), ''),
      NULLIF(COALESCE(NEW.place_bin, ''), ''),
      NULLIF(COALESCE(NEW.place_box, ''), ''));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_inventory_place_sync ON public.inventory_list;
CREATE TRIGGER trig_inventory_place_sync
BEFORE INSERT OR UPDATE ON public.inventory_list
FOR EACH ROW EXECUTE FUNCTION public.inventory_sync_place_path();

-- ────────────────────────────────────────────────────────────────────────────
-- Grants + PostgREST schema reload
-- ────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.inventory_sync_place_path() TO public;

NOTIFY pgrst, 'reload schema';