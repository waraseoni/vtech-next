import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `/inventory/stocktake` ka neutral server seed — page ke do React Query
 * queries (products+stock, recent adjustments) ka read-only mirror.
 * Caller cookie+RLS client pass karta hai.
 */

export type StocktakeProduct = {
  id: number;
  name: string;
  barcode: string | null;
  alert_quantity: number | null;
};

export type StocktakeStockRow = {
  product_id: number;
  total_in: number;
  total_sold_job: number;
  total_sold_sale: number;
  total_sold: number;
  available: number;
  oversold: number;
  avg_purchase_cost: number;
  last_stock_date: string | null;
  place: string | null;
};

export type StocktakeRecentAdjustment = {
  id: number;
  product_id: number;
  delta: number;
  reason: string;
  remark: string | null;
  created_at: string | null;
  counted_qty: number | null;
};

export type StocktakeSeed = {
  productData: {
    products: StocktakeProduct[];
    stockMap: Map<number, StocktakeStockRow>;
  };
  recent: StocktakeRecentAdjustment[];
};

const toStockRow = (r: Record<string, unknown>): StocktakeStockRow => ({
  product_id: Number(r.product_id ?? 0),
  total_in: Number(r.total_in ?? 0),
  total_sold_job: Number(r.total_sold_job ?? 0),
  total_sold_sale: Number(r.total_sold_sale ?? 0),
  total_sold: Number(r.total_sold ?? 0),
  available: Number(r.available ?? 0),
  oversold: Number(r.oversold ?? 0),
  avg_purchase_cost: Number(r.avg_purchase_cost ?? 0),
  last_stock_date: (r.last_stock_date as string | null) ?? null,
  place: (r.place as string | null) ?? null,
});

export async function fetchStocktakeSeed(supabase: SupabaseClient): Promise<StocktakeSeed> {
  const [plRes, adjRes] = await Promise.all([
    supabase
      .from("product_list")
      .select("id, name, barcode, alert_quantity")
      .eq("delete_flag", 0)
      .order("name"),
    supabase
      .from("stock_adjustments")
      .select("id, product_id, delta, reason, remark, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  if (plRes.error) throw plRes.error;
  if (adjRes.error) throw adjRes.error;
  const adjRows = adjRes.data || [];

  const products: StocktakeProduct[] = (plRes.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    alert_quantity: p.alert_quantity,
  }));

  const ids = products.map((p) => p.id);
  const stockMap = new Map<number, StocktakeStockRow>();
  try {
    const { data } = await supabase.rpc(
      "get_inventory_stock",
      ids.length ? { p_product_ids: ids } : {}
    );
    ((data || []) as Record<string, unknown>[]).forEach((r) => {
      const row = toStockRow(r);
      stockMap.set(row.product_id, row);
    });
  } catch {
    // stock RPC fail ho to page bhi client par empty map hi use karta hai
  }

  const prodIds = [...new Set(adjRows.map((a) => a.product_id))];
  const countByProd = new Map<number, number>();
  if (prodIds.length > 0) {
    const { data: counts } = await supabase
      .from("stock_counts")
      .select("product_id, counted_qty")
      .in("product_id", prodIds);
    ((counts || []) as { product_id: number; counted_qty: number }[]).forEach((c) =>
      countByProd.set(c.product_id, c.counted_qty)
    );
  }

  const recent: StocktakeRecentAdjustment[] = adjRows.map((a) => ({
    id: a.id,
    product_id: a.product_id,
    delta: a.delta,
    reason: a.reason,
    remark: a.remark ?? null,
    created_at: a.created_at ?? null,
    counted_qty: countByProd.get(a.product_id) ?? null,
  }));

  return { productData: { products, stockMap }, recent };
}
