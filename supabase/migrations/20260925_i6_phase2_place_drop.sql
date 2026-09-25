-- ============================================================================
-- 20260925_i6_phase2_place_drop.sql
-- I6 location data-model cleanup — PHASE 2 (legacy structured place DROP)
--
-- Best-practice order (2026-09-25 session):
--   1. App code se place_* reads hata diye (commit 801fe7d — stockValuation
--      selects + backup export lists) + Vercel redeploy FIRST.
--   2. Live-DB evidence: 97 active products, 43 mapped; 54 unmapped ke
--      55 inventory rows + product_list.place_* me ZERO legacy data
--      (DROP se zero data loss). Writers of place_*: NONE (app/SQL).
--   3. Ye migration: trigger drop (dropped cols reference karta hai —
--      bina iske har INSERT/UPDATE fail hoga) + 8 columns DROP.
--
-- KEPT (deliberate, documented deviation from checklist §I6):
--   * inventory_list.place (free-text display path) — 10+ app read-points +
--     get_inventory_stock RPC is par hain. Trigger ne ise structured se
--     sync rakha tha, isliye DROP ke baad display IDENTICAL rehta hai.
--   * get_inventory_stock RPC unchanged (latest inventory_list.place leta hai).
-- ============================================================================

-- Trigger pehle — ye NEW.place_zone/... reference karta hai; columns ke
-- saath rehta to har write fail hoti. Koi writer structured cols use nahi
-- karta (audit 2026-09-25), isliye trigger dead code ban chuka tha.
DROP TRIGGER IF EXISTS trig_inventory_place_sync ON public.inventory_list;
DROP FUNCTION IF EXISTS public.inventory_sync_place_path();

-- inventory_list: 4 structured DROP, `place` KEEP (display path).
ALTER TABLE public.inventory_list
  DROP COLUMN IF EXISTS place_zone,
  DROP COLUMN IF EXISTS place_rack,
  DROP COLUMN IF EXISTS place_bin,
  DROP COLUMN IF EXISTS place_box;

-- product_list: 4 structured DROP (`place` col is table me hai hi nahi).
ALTER TABLE public.product_list
  DROP COLUMN IF EXISTS place_zone,
  DROP COLUMN IF EXISTS place_rack,
  DROP COLUMN IF EXISTS place_bin,
  DROP COLUMN IF EXISTS place_box;

-- PostgREST schema cache reload (REST selects turant naye schema par).
NOTIFY pgrst, 'reload schema';
