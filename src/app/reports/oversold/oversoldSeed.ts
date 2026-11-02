import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `/reports/oversold` ka neutral server seed — client ke load()
 * (system_info + fetchStockByProducts + negative products) ka read-only mirror.
 * `get_inventory_stock` read-only RPC hi use hota hai (koi write nahi).
 * Caller cookie+RLS client pass karta hai.
 */

export type OversoldStockRow = {
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

export type OversoldRow = OversoldStockRow & { name: string };

export type OversoldSeed = {
  firmName: string;
  rows: OversoldRow[];
};

const toStockRow = (r: Record<string, unknown>): OversoldStockRow => ({
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

export async function fetchOversoldSeed(supabase: SupabaseClient): Promise<OversoldSeed> {
  const [sysRes, stockRes] = await Promise.all([
    supabase.from("system_info").select("meta_field, meta_value"),
    supabase.rpc("get_inventory_stock", {}),
  ]);

  if (stockRes.error) throw stockRes.error;

  const info: Record<string, string> = {};
  (sysRes.data || []).forEach((r) => {
    info[r.meta_field] = r.meta_value;
  });
  const firmName = info.name || "V-Technologies";

  const stockMap = new Map<number, OversoldStockRow>();
  ((stockRes.data || []) as Record<string, unknown>[]).forEach((r) => {
    const row = toStockRow(r);
    stockMap.set(row.product_id, row);
  });

  const ids = [...stockMap.values()].filter((s) => s.available < 0).map((s) => s.product_id);
  if (ids.length === 0) return { firmName, rows: [] };

  const { data: prods } = await supabase.from("product_list").select("id, name").in("id", ids);

  const nameMap = new Map<number, string>();
  (prods || []).forEach((p) => nameMap.set(p.id, p.name));

  const rows: OversoldRow[] = ids
    .map((id) => {
      const s = stockMap.get(id)!;
      return { ...s, name: nameMap.get(id) || `Product #${id}` };
    })
    .sort((a, b) => a.available - b.available); // most negative pehle

  return { firmName, rows };
}
