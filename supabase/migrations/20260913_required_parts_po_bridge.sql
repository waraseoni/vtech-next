-- =====================================================================
-- Required Parts → PO bridge (suppliers plan Phase B / P1)
-- 2026-09-13
--
-- 1) purchase_orders.transaction_id        — kis job ne ye PO trigger kiya
--                                            (display/trace; integer FK → transaction_list.id)
-- 2) job_required_parts.purchase_order_id  — required part kis PO se linked
--                                            (bigint FK → purchase_orders.id)
--
-- Additive + idempotent. Sath me hr conversion se pehle SQL Editor me run karo.
-- =====================================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS transaction_id integer
    REFERENCES public.transaction_list(id) ON DELETE SET NULL;

ALTER TABLE public.job_required_parts
  ADD COLUMN IF NOT EXISTS purchase_order_id bigint
    REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS po_transaction_idx
  ON public.purchase_orders(transaction_id);

CREATE INDEX IF NOT EXISTS jrp_po_idx
  ON public.job_required_parts(purchase_order_id);