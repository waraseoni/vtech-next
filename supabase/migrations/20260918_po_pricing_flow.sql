-- ═══════════════════════════════════════════════════════════════════════════
-- PO Pricing Flow: PO me price nahi, receive ke waqt price enter ho
--
-- Changes:
--   1) purchase_orders.expenses — total PO-level expenses (freight etc.)
--   2) receive_po_receipt RPC — ab accept karta hai unit_cost + sell_price
--      per line. Expenses ko per-unit me distribute karke inventory_list me
--      purchase_cost me dalta hai. product_list.cost_price weighted avg se
--      update hota hai. product_list.price (sell price) first receive pe set.
--
-- Idempotent + re-run safe. Apply: Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Add expenses column to purchase_orders ──────────────────────────────
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS expenses NUMERIC(12,2) DEFAULT 0;

-- ── 2. Updated receive_po_receipt RPC ──────────────────────────────────────
-- p_lines: [{"product_id": <int>, "qty": <int>, "unit_cost": <num>, "sell_price": <num>}]
-- p_expenses: total PO-level expenses (distributed per-unit across all lines)
CREATE OR REPLACE FUNCTION public.receive_po_receipt(
    p_po_id bigint,
    p_lines jsonb,
    p_expenses numeric DEFAULT 0
)
RETURNS TABLE(
    item_id bigint,
    product_id bigint,
    qty_total_received integer,
    outstanding_after integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
    l record;
    v_outstanding integer;
    v_any_open boolean := false;
    v_po_supplier_id bigint;
    v_total_received numeric := 0;
    v_new_purchase_cost numeric;
    v_old_qty integer;
    v_old_cost numeric;
    v_new_qty integer;
    v_total_expenses_per_unit numeric;
    v_existing_sell_price numeric;
begin
    if not public.is_frontend_staff() then
        raise exception 'permission denied: staff only';
    end if;
    if p_po_id is null then
        raise exception 'po_id is required';
    end if;
    if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
        raise exception 'lines is required (non-empty array)';
    end if;

    -- fetch supplier_id from PO
    select po.supplier_id into v_po_supplier_id
      from public.purchase_orders po where po.id = p_po_id;

    -- total qty being received (to distribute expenses per-unit)
    select coalesce(sum((e->>'qty')::numeric), 0) into v_total_received
      from jsonb_array_elements(p_lines) e;

    -- per-unit expense distribution
    if v_total_received > 0 and p_expenses > 0 then
        v_total_expenses_per_unit := p_expenses / v_total_received;
    else
        v_total_expenses_per_unit := 0;
    end if;

    for l in
        select (e->>'product_id')::bigint as product_id,
               (e->>'qty')::integer as qty,
               coalesce((e->>'unit_cost')::numeric, 0) as unit_cost,
               coalesce((e->>'sell_price')::numeric, 0) as sell_price
          from jsonb_array_elements(p_lines) e
    loop
        if l.product_id is null or l.qty is null or l.qty <= 0 then
            raise exception 'invalid line: product_id/qty required and qty > 0';
        end if;

        -- lock outstanding row
        select poi.qty_ordered - poi.qty_received into v_outstanding
          from public.purchase_order_items poi
         where poi.purchase_order_id = p_po_id
           and poi.product_id = l.product_id
         for update;

        if v_outstanding is null then
            raise exception 'PO line not found: product % on PO %', l.product_id, p_po_id;
        end if;
        if l.qty > v_outstanding then
            raise exception 'receiving % for product % exceeds outstanding %', l.qty, l.product_id, v_outstanding;
        end if;

        -- calculate per-unit purchase cost including distributed expenses
        v_new_purchase_cost := l.unit_cost + v_total_expenses_per_unit;

        -- stock-in row with calculated purchase cost
        INSERT INTO public.inventory_list
            (product_id, quantity, stock_date, supplier_id, purchase_cost,
             courier_charges, purchase_order_id, date_created, date_updated)
        VALUES (
            l.product_id, l.qty, current_date, v_po_supplier_id,
            v_new_purchase_cost,
            v_total_expenses_per_unit * l.qty,
            p_po_id, now(), now()
        );

        -- bump received counter
        UPDATE public.purchase_order_items poi
           SET qty_received = poi.qty_received + l.qty,
               unit_cost = CASE
                 WHEN poi.unit_cost = 0 OR poi.unit_cost IS NULL THEN l.unit_cost
                 ELSE poi.unit_cost
               END
         WHERE poi.purchase_order_id = p_po_id
           AND poi.product_id = l.product_id;

        -- ── Weighted Average Cost Update on product_list ──
        -- get current total qty and weighted avg cost from inventory
        SELECT
          COALESCE(SUM(il.quantity), 0),
          COALESCE(
            CASE WHEN SUM(il.quantity) > 0
              THEN SUM(il.quantity * il.purchase_cost) / SUM(il.quantity)
              ELSE 0
            END, 0
        ) INTO v_old_qty, v_old_cost
        FROM public.inventory_list il
        WHERE il.product_id = l.product_id;

        -- new weighted avg (including this receipt)
        v_new_qty := v_old_qty; -- already includes the just-inserted row
        if v_new_qty > 0 then
            UPDATE public.product_list
               SET cost_price = (v_old_cost)
             WHERE id = l.product_id;
        end if;

        -- ── Sell Price: first receive pe set, baad me preserve ──
        SELECT pl.price INTO v_existing_sell_price
          FROM public.product_list pl WHERE pl.id = l.product_id;

        if (v_existing_sell_price IS NULL OR v_existing_sell_price = 0) AND l.sell_price > 0 then
            UPDATE public.product_list
               SET price = l.sell_price
             WHERE id = l.product_id;
        end if;
    end loop;

    -- update PO expenses
    UPDATE public.purchase_orders po
       SET expenses = p_expenses
     WHERE po.id = p_po_id;

    -- status: any remaining outstanding => partially_received, else received
    SELECT bool_or(poi.qty_ordered - poi.qty_received > 0) INTO v_any_open
      FROM public.purchase_order_items poi
     WHERE poi.purchase_order_id = p_po_id;

    UPDATE public.purchase_orders po
       SET status = CASE WHEN coalesce(v_any_open, false) THEN 'partially_received' ELSE 'received' END,
           received_date = coalesce(po.received_date, current_date),
           total_amount = (
             SELECT COALESCE(SUM(poi2.qty_received * poi2.unit_cost), 0)
             FROM public.purchase_order_items poi2
             WHERE poi2.purchase_order_id = p_po_id
           )
     WHERE po.id = p_po_id;

    RETURN QUERY
      SELECT poi.id::bigint, poi.product_id::bigint, poi.qty_received, poi.qty_ordered - poi.qty_received
        FROM public.purchase_order_items poi
       WHERE poi.purchase_order_id = p_po_id
       ORDER BY poi.id;
end;
$$;

REVOKE ALL ON FUNCTION public.receive_po_receipt(bigint, jsonb, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.receive_po_receipt(bigint, jsonb, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_po_receipt(bigint, jsonb, numeric) TO service_role;

NOTIFY pgrst, 'reload schema';
