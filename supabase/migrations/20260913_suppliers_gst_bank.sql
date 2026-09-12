-- ═══════════════════════════════════════════════════════════════════════════
-- P2 (suppliers plan) — Supplier form enrichment.
-- Provenance: suppliers_module_plan.md P2 — GSTIN / bank details / business
-- terms / city-state columns on `suppliers`. Bill-ready purchase data.
-- Idempotent → repeat run safe. Apply: Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS gstin         text,          -- GST Identification Number (15 char)
  ADD COLUMN IF NOT EXISTS bank_name     text,
  ADD COLUMN IF NOT EXISTS bank_account  text,
  ADD COLUMN IF NOT EXISTS bank_ifsc     text,
  ADD COLUMN IF NOT EXISTS credit_limit  numeric(12,2), -- max outstanding allowed (₹)
  ADD COLUMN IF NOT EXISTS payment_terms text,          -- "Net 30", "COD", "Credit 15 days"
  ADD COLUMN IF NOT EXISTS city          text,
  ADD COLUMN IF NOT EXISTS state         text;

-- ═══════════════════════════════════════════════════════════════════════════
-- PostgREST ke liye schema reload.
-- ═══════════════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';