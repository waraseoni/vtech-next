-- Phase 3 Parity Updates: attendance_list check-in/out time columns
-- Port of PHP attendance module (time_in / time_out tracking)
-- Run this SQL in Supabase SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_list' AND column_name = 'time_in'
  ) THEN
    ALTER TABLE attendance_list ADD COLUMN time_in TIME DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_list' AND column_name = 'time_out'
  ) THEN
    ALTER TABLE attendance_list ADD COLUMN time_out TIME DEFAULT NULL;
  END IF;
END $$;
