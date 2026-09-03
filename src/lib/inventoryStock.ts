// ─── Inventory stock via single-source RPC (Initiative I1) ───────────────────
// Centralizes client access to `get_inventory_stock` so every page reads ONE
// server-computed number instead of re-deriving the formula inline.
// Server RPC: supabase/migrations/20260903_inventory_single_stock_rpc.sql

import { supabase } from "@/lib/supabase";

export interface StockRow {
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
}

/**
 * Fetch per-product stock summary for the given product ids (or all if empty).
 * Returns a Map keyed by product_id. Results are the authoritative derived stock.
 */
export const fetchStockByProducts = async (ids: number[] = []): Promise<Map<number, StockRow>> => {
  const args = ids.length ? { p_product_ids: ids } : {};
  const { data, error } = await supabase.rpc("get_inventory_stock", args);
  if (error) throw error;
  const raw: Record<string, unknown>[] = data || [];
  const rows: StockRow[] = raw.map((r) => {
    const row: StockRow = {
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
    };
    return row;
  });
  const map = new Map<number, StockRow>();
  rows.forEach((r) => map.set(r.product_id, r));
  return map;
};

/** Single-product convenience: returns the StockRow or undefined. */
export const fetchStockByProduct = async (id: number): Promise<StockRow | undefined> =>
  (await fetchStockByProducts([id])).get(id);