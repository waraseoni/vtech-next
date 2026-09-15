-- ═══════════════════════════════════════════════════════════════════════════
-- Required-Parts receive sync (job_required_parts_waiting_tracking plan M8)
-- PO receive hote hi uske linked required parts auto-update:
--   qty_received += received qty (FIFO, sabse purana open part pehle)
--   fill hote hi status = 2 (Arrived) → parts-pending report se auto-out
-- Provenance: receive_po_receipt (20260915_po_partial_receipt.sql) ko extend.
-- Atomic: sapne hi transaction me chalata hai (SECURITY DEFINER writer RPC).
-- Idempotent → repeat run safe. Apply: Supabase SQL Editor.
-- Activity log intentionally NOT added (server-side batch; ko nadi alag entries).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.receive_po_receipt(
    p_po_id bigint,
    p_lines jsonb
)
returns table(
    item_id bigint,
    product_id bigint,
    qty_total_received integer,
    outstanding_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    l record;
    jrp record;
    v_outstanding integer;
    v_any_open boolean := false;
    v_still integer;
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

        insert into public.inventory_list
            (product_id, quantity, stock_date, supplier_id, purchase_cost,
             purchase_order_id, date_created, date_updated)
        select l.product_id, l.qty, current_date, po.supplier_id, poi.unit_cost,
               p_po_id, now(), now()
          from public.purchase_orders po
          join public.purchase_order_items poi
            on poi.purchase_order_id = po.id and poi.product_id = l.product_id
         where po.id = p_po_id;

        update public.purchase_order_items poi
           set qty_received = poi.qty_received + l.qty
         where poi.purchase_order_id = p_po_id
           and poi.product_id = l.product_id;

        -- P1/M8 receive-sync: is PO se linked required parts ki qty_received
        -- aur status bhardo. FIFO (date_created asc) — sabse purana open part
        -- pehle. Part fill hote hi status = 2 (Arrived) → report se auto-out.
        v_still := l.qty;
        for jrp in
            select j.id,
                   (j.qty_needed - j.qty_received) as rem
              from public.job_required_parts j
             where j.purchase_order_id = p_po_id
               and j.product_id = l.product_id
               and j.status < 2
               and j.qty_received < j.qty_needed
             order by j.date_created asc, j.id asc
             for update
        loop
            if v_still <= 0 then
                exit;
            end if;
            if jrp.rem >= v_still then
                update public.job_required_parts j
                   set qty_received = j.qty_received + v_still,
                       status = case
                         when j.qty_received + v_still >= j.qty_needed then 2
                         else j.status
                       end
                 where j.id = jrp.id;
                v_still := 0;
            else
                update public.job_required_parts j
                   set qty_received = j.qty_received + jrp.rem,
                       status = 2
                 where j.id = jrp.id;
                v_still := v_still - jrp.rem;
            end if;
        end loop;
    end loop;

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

revoke all on function public.receive_po_receipt(bigint, jsonb) from public;
grant execute on function public.receive_po_receipt(bigint, jsonb) to authenticated;
grant execute on function public.receive_po_receipt(bigint, jsonb) to service_role;

notify pgrst, 'reload schema';