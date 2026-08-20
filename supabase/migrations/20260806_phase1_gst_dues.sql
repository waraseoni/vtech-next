-- Phase 1 Parity Updates: HSN/SAC, Due Reminders, Owner
-- Run this SQL in Supabase SQL Editor

-- 1. product_list: HSN + alert_quantity columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_list' AND column_name = 'hsn'
  ) THEN
    ALTER TABLE product_list ADD COLUMN hsn VARCHAR(20) NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_list' AND column_name = 'alert_quantity'
  ) THEN
    ALTER TABLE product_list ADD COLUMN alert_quantity INT NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2. service_list: HSN/SAC column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_list' AND column_name = 'hsn'
  ) THEN
    ALTER TABLE service_list ADD COLUMN hsn VARCHAR(20) NOT NULL DEFAULT '';
  END IF;
END $$;

-- 3. client_list: opening balance + payment due tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_list' AND column_name = 'opening_balance'
  ) THEN
    ALTER TABLE client_list ADD COLUMN opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_list' AND column_name = 'payment_due_date'
  ) THEN
    ALTER TABLE client_list ADD COLUMN payment_due_date DATE DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_list' AND column_name = 'payment_due_remarks'
  ) THEN
    ALTER TABLE client_list ADD COLUMN payment_due_remarks TEXT DEFAULT NULL;
  END IF;
END $$;

-- 4. payment_reminders table
CREATE TABLE IF NOT EXISTS payment_reminders (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL,
  amount_due DECIMAL(15,2) NOT NULL DEFAULT 0,
  reminder_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  channel VARCHAR(50) DEFAULT 'System Alert',
  status VARCHAR(50) DEFAULT 'Sent',
  remarks TEXT DEFAULT NULL
);

ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON payment_reminders FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_client ON payment_reminders(client_id);

-- 5. system_info: firm owner (key-value row)
INSERT INTO system_info (meta_field, meta_value)
SELECT 'owner', ''
WHERE NOT EXISTS (SELECT 1 FROM system_info WHERE meta_field = 'owner');
