-- Supplier Management Tables
-- Run this SQL in Supabase SQL Editor

-- 1. Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  contact VARCHAR(100) DEFAULT NULL,
  email VARCHAR(150) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  status SMALLINT NOT NULL DEFAULT 1,
  delete_flag SMALLINT NOT NULL DEFAULT 0,
  date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Product-Supplier pivot table (many-to-many)
CREATE TABLE IF NOT EXISTS spare_supplier (
  spare_id BIGINT NOT NULL,
  supplier_id BIGINT NOT NULL,
  PRIMARY KEY (spare_id, supplier_id)
);

-- 3. Add supplier_id to inventory_list if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_list' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE inventory_list ADD COLUMN supplier_id BIGINT DEFAULT NULL;
  END IF;
END $$;

-- Enable RLS (but allow all for now)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_supplier ENABLE ROW LEVEL SECURITY;

-- Permissive policies (same as other tables)
CREATE POLICY "Allow all" ON suppliers FOR ALL USING (true);
CREATE POLICY "Allow all" ON spare_supplier FOR ALL USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_delete_flag ON suppliers(delete_flag);
CREATE INDEX IF NOT EXISTS idx_spare_supplier_supplier ON spare_supplier(supplier_id);
