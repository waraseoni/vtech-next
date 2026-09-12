import { supabase } from "./supabase";

// ============================================================================
// supplierPurchases.ts — Supplier spending / purchase report (P3).
//
// Source: `purchase_orders` + `purchase_order_items` + `product_list`.
// Canceled POs (status 'cancelled') count nahi karte — vo purchase nahi hain.
// ============================================================================

export interface SupplierProductLine {
  productName: string;
  qtyOrdered: number;
  qtyReceived: number;
  amount: number;
}

export interface SupplierPurchaseRow {
  supplierId: number;
  name: string;
  poCount: number;
  qtyOrdered: number;
  qtyReceived: number;
  totalAmount: number;
  avgUnitCost: number;
  products: SupplierProductLine[];
}

export interface SupplierPurchaseReport {
  rows: SupplierPurchaseRow[];
  monthlyTrend: { month: string; amount: number }[];
}

interface PORow {
  id: number;
  po_code: string;
  supplier_id: number | null;
  total_amount: number;
  date_created: string;
}

interface POItemRow {
  purchase_order_id: number;
  product_id: number | null;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number;
}

/**
 * Per-supplier purchase aggregates (date range = IST day bounds).
 * `from`/`to` optional — omitting = full history.
 */
export async function fetchSupplierPurchases(
  from?: string,
  to?: string
): Promise<SupplierPurchaseReport> {
  let poQuery = supabase
    .from("purchase_orders")
    .select("id, po_code, supplier_id, total_amount, date_created")
    .eq("delete_flag", 0)
    .neq("status", "cancelled")
    .order("date_created", { ascending: true });

  if (from) poQuery = poQuery.gte("date_created", `${from}T00:00:00+05:30`);
  if (to) poQuery = poQuery.lte("date_created", `${to}T23:59:59+05:30`);

  const [{ data: pos }, { data: suppliers }, itemsRes] = await Promise.all([
    poQuery,
    supabase.from("suppliers").select("id, name").eq("delete_flag", 0),
    fetchAllPurchaseItems(),
  ]);

  const poRows = (pos || []) as PORow[];
  const supplierMap = new Map((suppliers || []).map((s) => [s.id, s.name]));

  const items = (itemsRes || []) as POItemRow[];
  const poIds = new Set(poRows.map((p) => p.id));
  const itemsByPo = new Map<number, POItemRow[]>();
  for (const it of items) {
    if (!poIds.has(it.purchase_order_id)) continue; // range filter ke bahar ka PO
    const list = itemsByPo.get(it.purchase_order_id) || [];
    list.push(it);
    itemsByPo.set(it.purchase_order_id, list);
  }

  const productsInScope = new Set<number | null>();
  for (const list of itemsByPo.values()) for (const it of list) productsInScope.add(it.product_id);
  const { data: prodRows } = await supabase
    .from("product_list")
    .select("id, name")
    .in(
      "id",
      [...productsInScope].filter((p): p is number => p != null)
    );
  const prodMap = new Map((prodRows || []).map((p) => [p.id, p.name]));

  // Monthly trend
  const monthMap = new Map<string, number>();
  for (const p of poRows) {
    const key = String(p.date_created).slice(0, 7); // YYYY-MM (date_created IST text)
    monthMap.set(key, (monthMap.get(key) || 0) + (p.total_amount || 0));
  }

  // Per-supplier aggregates
  const agg = new Map<
    number,
    { row: SupplierPurchaseRow; lines: Map<number | null, SupplierProductLine> }
  >();
  for (const p of poRows) {
    const sid = p.supplier_id ?? -1;
    let entry = agg.get(sid);
    if (!entry) {
      entry = {
        row: {
          supplierId: sid,
          name: supplierMap.get(sid) || (sid === -1 ? "No Supplier" : `#${sid}`),
          poCount: 0,
          qtyOrdered: 0,
          qtyReceived: 0,
          totalAmount: 0,
          avgUnitCost: 0,
          products: [],
        },
        lines: new Map(),
      };
      agg.set(sid, entry);
    }
    const { row, lines } = entry;
    row.poCount++;
    row.totalAmount += p.total_amount || 0;
    for (const it of itemsByPo.get(p.id) || []) {
      row.qtyOrdered += it.qty_ordered || 0;
      row.qtyReceived += it.qty_received || 0;
      if (it.product_id == null) continue; // product-less line (rare) — skip breakdown
      let pl = lines.get(it.product_id);
      if (!pl) {
        pl = {
          productName: prodMap.get(it.product_id) || `#${it.product_id}`,
          qtyOrdered: 0,
          qtyReceived: 0,
          amount: 0,
        };
        lines.set(it.product_id, pl);
      }
      pl.qtyOrdered += it.qty_ordered || 0;
      pl.qtyReceived += it.qty_received || 0;
      pl.amount += (it.qty_ordered || 0) * (it.unit_cost || 0);
    }
  }

  const rows = [...agg.values()]
    .map(({ row, lines }) => {
      row.products = [...lines.values()].sort((a, b) => b.amount - a.amount);
      row.avgUnitCost = row.qtyOrdered > 0 ? row.totalAmount / row.qtyOrdered : 0;
      return row;
    })
    .sort((a, b) => b.totalAmount - a.totalAmount);

  return {
    rows,
    monthlyTrend: [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount })),
  };
}

/** Purchase order items — chhoti shop (fewk POs), full fetch acceptable. */
export async function fetchAllPurchaseItems(): Promise<POItemRow[]> {
  const { data, error } = await supabase
    .from("purchase_order_items")
    .select("purchase_order_id, product_id, qty_ordered, qty_received, unit_cost");
  if (error) throw new Error(error.message);
  return (data || []) as POItemRow[];
}
