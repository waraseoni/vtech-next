import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `/reports/stock-valuation` ka neutral server seed — client ke
 * fetchProductValuation / fetchLocationValuation / system_info reads ka
 * read-only mirror.
 *
 * `@/lib/stockValuation` / `@/lib/inventoryStock` browser singleton import
 * karte hain, isliye yahan wahi queries inline hain. Caller cookie+RLS client
 * pass karta hai (service-role NEVER).
 */

export type StockValuationProduct = {
  productId: number;
  name: string;
  description: string;
  hsn: string;
  available: number;
  avgCost: number;
  value: number;
  location: string;
};

export type StockValuationLocationLine = {
  productId: number;
  name: string;
  qty: number;
  value: number;
};

export type StockValuationLocation = {
  key: string;
  path: string;
  qty: number;
  value: number;
  productCount: number;
  products: StockValuationLocationLine[];
};

export type StockValuationSeed = {
  firmName: string;
  products: StockValuationProduct[];
  locations: StockValuationLocation[];
  locTotals: { totalValue: number; totalQty: number; totalLocations: number };
};

type StockRow = {
  available: number;
  avg_purchase_cost: number;
  place: string | null;
};

/** Product stock summary (same RPC contracts as lib/inventoryStock). */
async function fetchStockMap(
  supabase: SupabaseClient,
  ids: number[]
): Promise<Map<number, StockRow>> {
  const map = new Map<number, StockRow>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase.rpc("get_inventory_stock", { p_product_ids: ids });
  if (error) throw error;

  (data || []).forEach((r: Record<string, unknown>) => {
    map.set(Number(r.product_id ?? 0), {
      available: Number(r.available ?? 0),
      avg_purchase_cost: Number(r.avg_purchase_cost ?? 0),
      place: (r.place as string | null) ?? null,
    });
  });
  return map;
}

export async function fetchStockValuationSeed(
  supabase: SupabaseClient
): Promise<StockValuationSeed> {
  const [{ data: sys }, { data: pl }, { data: inv }, { data: allProducts }] = await Promise.all([
    supabase.from("system_info").select("meta_field, meta_value"),
    supabase
      .from("product_list")
      .select("id, name, description, hsn")
      .eq("delete_flag", 0)
      .eq("status", 1),
    supabase.from("inventory_list").select("product_id, quantity, purchase_cost, place"),
    supabase.from("product_list").select("id, name"),
  ]);

  const info: Record<string, string> = {};
  (sys || []).forEach((r) => (info[r.meta_field] = r.meta_value));

  // ── Product valuation: available × weighted avg purchase cost ──────────
  const productsList = pl || [];
  const stock = await fetchStockMap(
    supabase,
    productsList.map((p) => p.id)
  );

  const products: StockValuationProduct[] = productsList.map((p) => {
    const st = stock.get(p.id);
    const available = st?.available ?? 0;
    const avgCost = st?.avg_purchase_cost ?? 0;
    const value = available > 0 ? available * avgCost : 0;
    // `place` trigger-synced display path hi available hai (place_* drop
    // ho chuke hain) — lib fallback bhi isi par "No Location" deta hai.
    const location = (st?.place && st.place.trim()) || "No Location";

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
  products.sort((a, b) => b.value - a.value || b.available - a.available);

  // ── Location valuation: Σ(qty × purchase_cost) per shelf ───────────────
  const nameMap = new Map<number, string>((allProducts || []).map((p) => [p.id, p.name]));

  interface Agg {
    path: string;
    qty: number;
    value: number;
    products: Map<number, StockValuationLocationLine>;
  }
  const agg = new Map<string, Agg>();

  for (const r of inv || []) {
    // legacy `place` → zone fallback (lib/locations partsFromRow/locPath).
    const path = String(r.place || "").trim() || "No Location";
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

  const locations: StockValuationLocation[] = [...agg.values()].map((e) => {
    const locProducts = [...e.products.values()].sort((a, b) => b.value - a.value);
    return {
      key: e.path,
      path: e.path,
      qty: e.qty,
      value: e.value,
      productCount: locProducts.length,
      products: locProducts,
    };
  });
  locations.sort((a, b) => b.value - a.value || b.qty - a.qty);

  const totalValue = locations.reduce((s, r) => s + r.value, 0);
  const totalQty = locations.reduce((s, r) => s + r.qty, 0);

  return {
    firmName: info.name || "V-Technologies",
    products,
    locations,
    locTotals: { totalValue, totalQty, totalLocations: locations.length },
  };
}
