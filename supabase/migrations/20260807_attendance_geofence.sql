-- Attendance GPS Geofencing: audit coordinates for self check-in/out.
-- Apply via Supabase SQL Editor (same as previous migrations).

-- 1) Coordinate columns on attendance_list (NULL by default, optional audit data)
ALTER TABLE attendance_list
  ADD COLUMN IF NOT EXISTS lat_in   DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lng_in   DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lat_out  DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lng_out  DOUBLE PRECISION DEFAULT NULL;

-- 2) Geofence config lives in system_info (key-value). Optional defaults:
INSERT INTO system_info (meta_field, meta_value)
SELECT v.k, v.v FROM (VALUES
  ('geofence_enabled', 'false'),
  ('geofence_lat',     ''),
  ('geofence_lng',     ''),
  ('geofence_radius_m', '200')
) AS v(k, v)
WHERE NOT EXISTS (SELECT 1 FROM system_info WHERE meta_field = v.k);
