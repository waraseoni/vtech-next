-- ============================================================================
-- 20260927_activity_geo_tags.sql
-- Staff geofence — per-write location tagging on activity_logs
-- (docs/plans/staff_geofence_viewonly_plan.md §Phase 6 — user demand)
--
--   * Bahar se hua kaam (permit/outside) activity entry ke saath location
--     rakhe taaki jobs/activity history me dikhe "kahan se hua".
--   * Office se hua kaam bilkul as-is (NULLs) — purane readers/renderers
--     untouched (DATA_MIGRATION_NOTES writer rule: naya convention sirf
--     naye logs me; purana data same dikhega).
--   * Nullable + IF NOT EXISTS → purani rows NULL, koi backfill nahi,
--     koi break nahi. Code me fallback bhi hai (columns na hon to plain
--     insert retry) taaki deploy-order safe rahe.
--
-- Apply: Supabase SQL Editor me run karo (ek baar). Verify: neeche report.
-- ============================================================================

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS geo_lat double precision DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS geo_lng double precision DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS geo_distance_m integer DEFAULT NULL;

-- ── Report ────────────────────────────────────────────────────────────────
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'activity_logs'
  and column_name in ('geo_lat', 'geo_lng', 'geo_distance_m')
order by ordinal_position;

-- ── Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
