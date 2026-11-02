import type { SupabaseClient } from "@supabase/supabase-js";
import { locPath } from "@/lib/locations";

/**
 * `/inventory/locate` ka neutral server seed — page ke fetchData ka read-only
 * mirror (product list + product_locations + stock/sold aggregation).
 * Caller cookie+RLS client pass karta hai.
 */

export type LocateLocGroup = {
  parts: { zone: string; rack: string; bin: string; box: string };
  path: string;
  qty: number;
  rows: number;
  lastDate: string;
  poCodes: string[];
};

export type LocateProduct = {
  id: number;
  name: string;
  description: string;
  barcode: string | null;
  image_path: string | null;
  alert_quantity: number;
  available: number;
  total_in: number;
  groups: LocateLocGroup[];
  unlocatedQty: number;
  unlocatedPoCodes: string[];
};

export async function fetchLocateSeed(supabase: SupabaseClient): Promise<LocateProduct[]> {
  const { data: pl, error } = await supabase
    .from("product_list")
    .select("id, name, description, image_path, barcode, alert_quantity")
    .eq("delete_flag", 0)
    .order("name");
  if (error) throw error;
  if (!pl) return [];

  const ids = pl.map((p) => p.id);
  if (ids.length === 0) return [];

  const prodLocMap = new Map<number, { zone: string; rack: string; bin: string; box: string }[]>();
  const { data: plRows } = await supabase
    .from("product_locations")
    .select("product_id, locations!inner(zone, rack, bin, box)")
    .in("product_id", ids);
  ((plRows || []) as Array<{
    product_id: number;
    locations:
      | { zone?: string | null; rack?: string | null; bin?: string | null; box?: string | null }
      | Array<{
          zone?: string | null;
          rack?: string | null;
          bin?: string | null;
          box?: string | null;
        }>;
  }>).forEach((row) => {
    const loc = Array.isArray(row.locations) ? row.locations[0] : row.locations;
    const mapped = {
      zone: loc?.zone || "",
      rack: loc?.rack || "",
      bin: loc?.bin || "",
      box: loc?.box || "",
    };
    if (!locPath(mapped)) return;
    const arr = prodLocMap.get(row.product_id) || [];
    arr.push(mapped);
    prodLocMap.set(row.product_id, arr);
  });

  const [stockRes, jobRes, saleRes] = await Promise.all([
    supabase
      .from("inventory_list")
      .select("product_id, quantity, stock_date, purchase_order_id")
      .in("product_id", ids),
    supabase
      .from("transaction_products")
      .select("product_id, qty, transaction_id")
      .in("product_id", ids),
    supabase.from("direct_sale_items").select("product_id, qty").in("product_id", ids),
  ]);

  const allPoIds = [
    ...new Set((stockRes.data || []).map((r) => r.purchase_order_id).filter(Boolean)),
  ];
  const poCodeMap = new Map<number, string>();
  if (allPoIds.length) {
    const { data: poRows } = await supabase
      .from("purchase_orders")
      .select("id, po_code")
      .in("id", allPoIds);
    (poRows || []).forEach((r) => poCodeMap.set(r.id, r.po_code));
  }

  const txnIds = [...new Set((jobRes.data || []).map((i) => i.transaction_id))];
  let valid = new Set<number>();
  if (txnIds.length) {
    const { data: txns } = await supabase
      .from("transaction_list")
      .select("id")
      .in("id", txnIds)
      .neq("status", 4);
    valid = new Set((txns || []).map((t) => t.id));
  }
  const soldJob = new Map<number, number>();
  (jobRes.data || []).forEach((r) => {
    if (valid.has(r.transaction_id))
      soldJob.set(r.product_id, (soldJob.get(r.product_id) || 0) + (r.qty || 0));
  });
  const soldSale = new Map<number, number>();
  (saleRes.data || []).forEach((r) =>
    soldSale.set(r.product_id, (soldSale.get(r.product_id) || 0) + (r.qty || 0))
  );

  const byId = new Map<number, LocateProduct>();
  for (const p of pl) {
    const locs = prodLocMap.get(p.id) || [];
    const groups: LocateLocGroup[] = locs
      .map((loc) => {
        const parts = { zone: loc.zone, rack: loc.rack, bin: loc.bin, box: loc.box };
        const path = locPath(parts);
        return path ? { parts, path, qty: 0, rows: 0, lastDate: "", poCodes: [] } : null;
      })
      .filter(Boolean) as LocateLocGroup[];
    byId.set(p.id, {
      id: p.id,
      name: p.name,
      description: p.description || "",
      barcode: p.barcode || null,
      image_path: p.image_path || null,
      alert_quantity: p.alert_quantity || 5,
      available: 0,
      total_in: 0,
      groups,
      unlocatedQty: 0,
      unlocatedPoCodes: [],
    });
  }

  (stockRes.data || []).forEach((r) => {
    const prod = byId.get(r.product_id);
    if (!prod) return;
    const qty = r.quantity || 0;
    prod.total_in += qty;
    const poCode = r.purchase_order_id ? poCodeMap.get(r.purchase_order_id) : undefined;
    if (prod.groups.length > 0) {
      const g = prod.groups[0];
      g.qty += qty;
      g.rows++;
      if (String(r.stock_date) > g.lastDate) g.lastDate = String(r.stock_date);
      if (poCode && !g.poCodes.includes(poCode)) g.poCodes.push(poCode);
    } else {
      prod.unlocatedQty += qty;
      if (poCode && !prod.unlocatedPoCodes.includes(poCode)) prod.unlocatedPoCodes.push(poCode);
    }
  });

  const result: LocateProduct[] = [];
  for (const p of pl) {
    const prod = byId.get(p.id)!;
    prod.available = prod.total_in - (soldJob.get(p.id) || 0) - (soldSale.get(p.id) || 0);
    prod.groups.sort((a, b) => b.qty - a.qty || a.path.localeCompare(b.path));
    result.push(prod);
  }
  return result;
}
