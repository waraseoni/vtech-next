import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfMonthIST, todayIST } from "@/lib/dateUtils";

/**
 * `/reports/supplier-purchases` (this month) ka neutral server seed — client ke
 * load() (system_info + fetchSupplierPurchases) ka read-only mirror.
 * `@/lib/supplierPurchases` browser singleton use karta hai, isliye wahi queries
 * yahan inline hain. Caller cookie+RLS client pass karta hai.
 */

export type SupplierPurchaseProductLine = {
  productName: string;
  qtyOrdered: number;
  qtyReceived: number;
  amount: number;
};

export type SupplierPurchaseRow = {
  supplierId: number;
  name: string;
  poCount: number;
  qtyOrdered: number;
  qtyReceived: number;
  totalAmount: number;
  avgUnitCost: number;
  products: SupplierPurchaseProductLine[];
};

export type SupplierPurchasesSeed = {
  from: string;
  to: string;
  firmName: string;
  rows: SupplierPurchaseRow[];
  trend: { month: string; amount: number }[];
};

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

export async function fetchSupplierPurchasesSeed(
  supabase: SupabaseClient,
  from = startOfMonthIST(),
  to = todayIST()
): Promise<SupplierPurchasesSeed> {
  let poQuery = supabase
    .from("purchase_orders")
    .select("id, po_code, supplier_id, total_amount, date_created")
    .neq("status", "cancelled")
    .order("date_created", { ascending: true });

  if (from) poQuery = poQuery.gte("date_created", `${from}T00:00:00+05:30`);
  if (to) poQuery = poQuery.lte("date_created", `${to}T23:59:59+05:30`);

  const [sysRes, posRes, suppliersRes, itemsRes] = await Promise.all([
    supabase.from("system_info").select("meta_field, meta_value"),
    poQuery,
    supabase.from("suppliers").select("id, name").eq("delete_flag", 0),
    supabase
      .from("purchase_order_items")
      .select("purchase_order_id, product_id, qty_ordered, qty_received, unit_cost"),
  ]);

  if (posRes.error) throw posRes.error;
  if (itemsRes.error) throw itemsRes.error;

  const info: Record<string, string> = {};
  (sysRes.data || []).forEach((r) => {
    info[r.meta_field] = r.meta_value;
  });

  const poRows = (posRes.data || []) as PORow[];
  const supplierMap = new Map((suppliersRes.data || []).map((s) => [s.id, s.name]));

  const items = (itemsRes.data || []) as POItemRow[];
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
    { row: SupplierPurchaseRow; lines: Map<number | null, SupplierPurchaseProductLine> }
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
    from,
    to,
    firmName: info.name || "V-Technologies",
    rows,
    trend: [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount })),
  };
}
