-- WhatsApp Template History Table
-- Run this SQL in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS wp_template_history (
  id BIGSERIAL PRIMARY KEY,
  template_key VARCHAR(100) NOT NULL,
  action VARCHAR(20) NOT NULL DEFAULT 'update',
  old_value TEXT DEFAULT NULL,
  new_value TEXT DEFAULT NULL,
  changed_by VARCHAR(150) DEFAULT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wp_template_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON wp_template_history FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_wpth_template_key ON wp_template_history(template_key);
