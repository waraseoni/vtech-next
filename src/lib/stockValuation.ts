// ─── Stock Valuation Report (Initiative I6) ─────────────────────────────────
// Two honest views of "kitna paisa stock me pada hai":
//   1. fetchProductValuation()  — available × weighted avg purchase cost (RPC I1).
//      Sales ko exact kat ke "abhi sell karne layak value" deta hai.
//   2. fetchLocationValuation() — Σ(qty × purchase_cost) over inventory_list
//      grouped by place (zone ▸ rack ▸ bin ▸ box). Physically stock-in value
//      per shelf. Sales consumed ho chuki hain isliye per-location exact
//      "available" nahi derive hota — ye inbound kharid value dikhata hai.

import { supabase } from "./supabase";
import { fetchStockByProducts, type StockRow } from "./inventoryStock";
import { locPath, partsFromRow } from "./locations";

export interface ProductValuationRow {
  productId: number;
  name: string;
  description: string;
  hsn: string;
  available: number;
  avgCost: number;
  value: number;
  location: string;
}

export interface ProductValuationReport {
  rows: ProductValuationRow[];
  totalValue: number;
  totalUnits: number;
  inStockCount: number;
  outOfStockCount: number;
}

export interface LocationValuationLine {
  productId: number;
  name: string;
  qty: number;
  value: number;
}

export interface LocationValuationRow {
  key: string;
  path: string;
  qty: number;
  value: number;
  productCount: number;
  products: LocationValuationLine[];
}

export interface LocationValuationReport {
  rows: LocationValuationRow[];
  totalValue: number;
  totalQty: number;
  totalLocations: number;
  unassigned: number;
}

interface ProductRow {
  id: number;
  name: string;
  description: string | null;
  hsn: string | null;
  place_zone?: string | null;
  place_rack?: string | null;
  place_bin?: string | null;
  place_box?: string | null;
}

interface InvRow {
  product_id: number;
  quantity: number | null;
  purchase_cost: number | null;
  place?: string | null;
  place_zone?: string | null;
  place_rack?: string | null;
  place_bin?: string | null;
  place_box?: string | null;
}

/** Active products + stock basis value (available × avg purchase cost). */
export async function fetchProductValuation(): Promise<ProductValuationReport> {
  const { data: pl } = await supabase
    .from("product_list")
    .select("id, name, description, hsn, place_zone, place_rack, place_bin, place_box")
    .eq("delete_flag", 0)
    .eq("status", 1);

  const products = (pl || []) as ProductRow[];
  const ids = products.map((p) => p.id);
  const stock = ids.length ? await fetchStockByProducts(ids) : new Map<number, StockRow>();

  let totalValue = 0;
  let totalUnits = 0;
  let inStockCount = 0;
  let outOfStockCount = 0;

  const rows: ProductValuationRow[] = products.map((p) => {
    const st = stock.get(p.id);
    const available = st?.available ?? 0;
    const avgCost = st?.avg_purchase_cost ?? 0;
    const value = available > 0 ? available * avgCost : 0;
    const location =
      (st?.place && st.place.trim()) || locPath(partsFromRow(p as Parameters<typeof partsFromRow>[0])) || "No Location";

    if (available > 0) inStockCount++;
    else outOfStockCount++;
    totalValue += value;
    totalUnits += available;

    return {
      productId: p.id,
      name: p.name,
      description: p.description || "",
      hsn: p.hsn || "",
      available,
      avgCost,
      value,
      location,
    };
  });

  rows.sort((a, b) => b.value - a.value || b.available - a.available);

  return { rows, totalValue, totalUnits, inStockCount, outOfStockCount };
}

/** Physically stock-in value grouped by shelf location. */
export async function fetchLocationValuation(): Promise<LocationValuationReport> {
  const [{ data: inv }, { data: pl }] = await Promise.all([
    supabase
      .from("inventory_list")
      .select(
        "product_id, quantity, purchase_cost, place, place_zone, place_rack, place_bin, place_box"
      ),
    supabase.from("product_list").select("id, name"),
  ]);

  const nameMap = new Map<number, string>((pl || []).map((p) => [p.id, p.name]));

  interface Agg {
    path: string;
    qty: number;
    value: number;
    products: Map<number, LocationValuationLine>;
  }

  const agg = new Map<string, Agg>();

  for (const r of (inv || []) as InvRow[]) {
    const path =
      locPath(partsFromRow(r as Parameters<typeof partsFromRow>[0])).trim() || "No Location";
    const key = path || "__none__";
    const qty = Number(r.quantity ?? 0);
    const cost = Number(r.purchase_cost ?? 0);
    const v = qty * cost;

    let e = agg.get(key);
    if (!e) {
      e = { path, qty: 0, value: 0, products: new Map() };
      agg.set(key, e);
    }
    e.qty += qty;
    e.value += v;

    let line = e.products.get(r.product_id);
    if (!line) {
      line = {
        productId: r.product_id,
        name: nameMap.get(r.product_id) || `#${r.product_id}`,
        qty: 0,
        value: 0,
      };
      e.products.set(r.product_id, line);
    }
    line.qty += qty;
    line.value += v;
  }

  const rows: LocationValuationRow[] = [...agg.values()].map((e) => {
    const products = [...e.products.values()].sort((a, b) => b.value - a.value);
    return {
      key: e.path,
      path: e.path,
      qty: e.qty,
      value: e.value,
      productCount: products.length,
      products,
    };
  });

  rows.sort((a, b) => b.value - a.value || b.qty - a.qty);

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);

  return {
    rows,
    totalValue,
    totalQty,
    totalLocations: rows.length,
    unassigned: rows.filter((r) => r.path === "No Location").length,
  };
}