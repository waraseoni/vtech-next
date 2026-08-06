-- Phase 3 Parity Updates: product_list barcode column
-- Run this SQL in Supabase SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_list' AND column_name = 'barcode'
  ) THEN
    ALTER TABLE product_list ADD COLUMN barcode VARCHAR(100) DEFAULT NULL;
  END IF;
END $$;
