-- ═══════════════════════════════════════════════════════════════════════════
-- I4 — PO PARTIAL RECEIPT + AUTO-REORDER (isolated additive migration)
-- ---------------------------------------------------------------------------
-- Goals (per docs/plans/inventory_improvements_plan.md §4 / I4):
--   * Allow per-item partial receiving. Current flow is all-or-nothing
--     (client inserts inventory_list rows then flips status to 'received').
--   * New status 'partially_received' joins the existing status CHECK set.
--   * Defensive server-side validation: received qty can never exceed the
--     outstanding (qty_ordered − qty_received) per line — enforced inside an
--     atomic SECURITY DEFINER writer RPC (receive_po_receipt), NOT only client.
--   * Same writer semantics as before: a stock-in (−) row into inventory_list
--     per line + purchase_order_items.qty_received bump + PO status.
--
-- Delivery rule (lock by user): isolated file FIRST + fold into the
--   consolidated 20260913_final_full_schema_idempotent.sql before the final
--   `NOTIFY pgrst, 'reload schema';`.
--
-- Idempotent + re-run safe + zero data loss. Same composite pattern as the
-- consolidated file (guarded DO blocks, DROP→CREATE, guarded grants).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Extend purchase_orders.status CHECK to allow 'partially_received' ──
-- Inline-in-CREATE constraint won't re-run on an existing table, so guard by
-- definition: only replace if it's missing the new value. Idempotent + safe.
do $$
declare v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
    from pg_constraint
   where conrelid = 'public.purchase_orders'::regclass
     and conname = 'purchase_orders_status_check';
  if v_def is null or position('partially_received' in v_def) = 0 then
    alter table public.purchase_orders drop constraint if exists purchase_orders_status_check;
    alter table public.purchase_orders add constraint purchase_orders_status_check
      check (status = ANY (ARRAY['pending'::text, 'ordered'::text, 'partially_received'::text, 'received'::text, 'cancelled'::text]));
  end if;
end $$;

-- ── 2. Atomic writer RPC: receive_po_receipt ───────────────────────────────
-- SECURITY DEFINER + staff check. One transaction:
--   * validates each line qty <= outstanding (defensive, server-side)
--   * writes a stock-in row into inventory_list per line
--   * bumps purchase_order_items.qty_received
--   * sets PO status to 'partially_received' (any outstanding left) or
--     'received' (fully done) and stamps received_date once.
-- p_lines is a jsonb array of {"product_id": <int>, "qty": <int>}.
CREATE OR REPLACE FUNCTION public.receive_po_receipt(
    p_po_id bigint,
    p_lines jsonb
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

    for l in
        select (e->>'product_id')::bigint as product_id,
               (e->>'qty')::integer as qty
          from jsonb_array_elements(p_lines) e
    loop
        if l.product_id is null or l.qty is null or l.qty <= 0 then
            raise exception 'invalid line: product_id/qty required and qty > 0';
        end if;

        -- lock the outstanding row to prevent concurrent-receipt races
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

        -- stock-in row (quantity may be any received qty; negative never happens
        -- here because l.qty > 0)
        insert into public.inventory_list
            (product_id, quantity, stock_date, supplier_id, purchase_cost,
             purchase_order_id, date_created, date_updated)
        select l.product_id, l.qty, current_date, po.supplier_id, poi.unit_cost,
               p_po_id, now(), now()
          from public.purchase_orders po
          join public.purchase_order_items poi
            on poi.purchase_order_id = po.id and poi.product_id = l.product_id
         where po.id = p_po_id;

        -- bump received counter
        update public.purchase_order_items poi
           set qty_received = poi.qty_received + l.qty
         where poi.purchase_order_id = p_po_id
           and poi.product_id = l.product_id;
    end loop;

    -- status: any remaining outstanding => partially_received, else received
    select bool_or(poi.qty_ordered - poi.qty_received > 0) into v_any_open
      from public.purchase_order_items poi
     where poi.purchase_order_id = p_po_id;

    update public.purchase_orders po
       set status = case when coalesce(v_any_open, false) then 'partially_received' else 'received' end,
           received_date = coalesce(po.received_date, current_date)
     where po.id = p_po_id;

    return query
      select poi.id::bigint, poi.product_id::bigint, poi.qty_received, poi.qty_ordered - poi.qty_received
        from public.purchase_order_items poi
       where poi.purchase_order_id = p_po_id
       order by poi.id;
end;
$$;

REVOKE ALL ON FUNCTION public.receive_po_receipt(bigint, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.receive_po_receipt(bigint, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_po_receipt(bigint, jsonb) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
