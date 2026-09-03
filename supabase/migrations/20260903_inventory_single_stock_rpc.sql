-- ════════════════════════════════════════════════════════════════════════
-- 20260903_inventory_single_stock_rpc.sql
-- Inventory Initiative I1 — SINGLE SOURCE OF TRUTH for available stock.
--
-- Problem solved: the derived-stock formula was re-implemented manually in ≥5
-- frontend spots (SaleForm, dashboard, requirement-list, inventory/[id], list).
-- This RPC centralizes it server-side so every consumer reads ONE number.
--
-- Formula (matches existing behaviour exactly):
--   available = Σ inventory_list.quantity
--             − Σ transaction_products.qty  (jobs with transaction_list.status ≠ 4)
--             − Σ direct_sale_items.qty
--   oversold   = max(0, −available)
--   avg_cost   = weighted avg of inventory_list.purchase_cost (for valuation, I6)
--
-- FULLY IDEMPOTENT (CREATE OR REPLACE + REVOKE/GRANT regrant) and ADDITIVE-ONLY.
-- Apply: Supabase SQL Editor. Also mirrored into the consolidated full-schema file.
-- ════════════════════════════════════════════════════════════════════════

-- ── RPC: per-product stock summary (optionally scoped by product_ids) ──────
CREATE OR REPLACE FUNCTION public.get_inventory_stock(
    p_product_ids int8[] DEFAULT NULL
) RETURNS TABLE(
    product_id        bigint,
    total_in          bigint,
    total_sold_job    bigint,
    total_sold_sale   bigint,
    total_sold        bigint,
    available         bigint,
    oversold          bigint,
    avg_purchase_cost numeric,
    last_stock_date   date,
    place             text
)
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
AS $$
    WITH inv AS (
        SELECT product_id, SUM(quantity) AS total_in,
               COALESCE(NULLIF(SUM(CASE WHEN quantity > 0 THEN quantity * purchase_cost END), 0)
                        / NULLIF(SUM(CASE WHEN quantity > 0 THEN quantity END), 0), 0) AS avg_cost,
               MAX(stock_date) AS last_date,
               (array_agg(place ORDER BY stock_date DESC, id DESC))[1] AS place
        FROM public.inventory_list
        WHERE (p_product_ids IS NULL OR product_id = ANY (p_product_ids))
        GROUP BY product_id
    ),
    sold_job AS (
        SELECT tp.product_id, SUM(tp.qty) AS qty
        FROM public.transaction_products tp
        JOIN public.transaction_list t ON t.id = tp.transaction_id
        WHERE t.status <> 4
          AND (p_product_ids IS NULL OR tp.product_id = ANY (p_product_ids))
        GROUP BY tp.product_id
    ),
    sold_sale AS (
        SELECT product_id, SUM(qty) AS qty
        FROM public.direct_sale_items
        WHERE (p_product_ids IS NULL OR product_id = ANY (p_product_ids))
        GROUP BY product_id
    ),
    all_ids AS (
        SELECT product_id FROM inv
        UNION SELECT product_id FROM sold_job
        UNION SELECT product_id FROM sold_sale
    )
    SELECT a.product_id,
           COALESCE(i.total_in, 0)            AS total_in,
           COALESCE(j.qty, 0)                 AS total_sold_job,
           COALESCE(s.qty, 0)                 AS total_sold_sale,
           COALESCE(j.qty, 0) + COALESCE(s.qty, 0) AS total_sold,
           COALESCE(i.total_in, 0) - COALESCE(j.qty, 0) - COALESCE(s.qty, 0) AS available,
           GREATEST(0, COALESCE(j.qty, 0) + COALESCE(s.qty, 0) - COALESCE(i.total_in, 0)) AS oversold,
           COALESCE(i.avg_cost, 0)            AS avg_purchase_cost,
           i.last_date                        AS last_stock_date,
           i.place                            AS place
    FROM all_ids a
    LEFT JOIN inv  i ON i.product_id = a.product_id
    LEFT JOIN sold_job  j ON j.product_id = a.product_id
    LEFT JOIN sold_sale s ON s.product_id = a.product_id
    ORDER BY a.product_id;
$$;

-- ── Grants (regrant idempotent; only authenticated/service_role — NOT anon) ──
REVOKE ALL ON FUNCTION public.get_inventory_stock(int8[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_inventory_stock(int8[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inventory_stock(int8[]) TO service_role;