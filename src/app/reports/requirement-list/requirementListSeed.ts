import type { SupabaseClient } from "@supabase/supabase-js";
import { alertThreshold } from "@/lib/inventory";

/**
 * `/reports/requirement-list` ka neutral server seed — client ke fetchData ka
 * read-only mirror. `@/lib/inventoryStock` server par import nahi hota (wo
 * browser singleton rakhta hai), isliye stock RPC yahan inline call hota hai.
 * Caller cookie+RLS client pass karta hai; yahan koi write nahi hoti.
 */

export type RequirementSupplier = { id: number; name: string; contact: string };

export type RequirementItem = {
  id: number;
  name: string;
  description: string;
  price: number;
  hsn: string;
  alert_quantity: number;
  effective_alert: number;
  current_stock: number;
  need_to_order: number;
  suppliers: RequirementSupplier[];
};

export type RequirementListSeed = {
  firmName: string;
  items: RequirementItem[];
};

type ProductRow = {
  id: number;
  name: string | null;
  description: string | null;
  price: number | string | null;
  hsn: string | null;
  alert_quantity: number | string | null;
};
type SupplierRow = { id: number; name: string | null; contact: string | null };
type SpareSupplierRow = { spare_id: number; supplier_id: number };

export async function fetchRequirementListSeed(
  supabase: SupabaseClient
): Promise<RequirementListSeed> {
  const { data: sys } = await supabase.from("system_info").select("meta_field, meta_value");
  const info: Record<string, string> = {};
  (sys || []).forEach((r) => {
    info[r.meta_field] = r.meta_value;
  });
  const firmName = info.name || "V-Technologies";

  const { data: pl } = await supabase
    .from("product_list")
    .select("id, name, description, price, hsn, alert_quantity")
    .eq("delete_flag", 0)
    .eq("status", 1);

  const products = (pl || []) as ProductRow[];
  if (products.length === 0) return { firmName, items: [] };

  const ids = products.map((p) => p.id);

  // Stock: single-source RPC (same as fetchStockByProducts) — read-only.
  const [stockRes, linkRes, suppRes] = await Promise.all([
    supabase.rpc("get_inventory_stock", ids.length ? { p_product_ids: ids } : {}),
    supabase.from("spare_supplier").select("spare_id, supplier_id").in("spare_id", ids),
    supabase.from("suppliers").select("id, name, contact").eq("delete_flag", 0).eq("status", 1),
  ]);

  if (stockRes.error) throw stockRes.error;

  // available = Number(row.available ?? 0) — fetchStockByProducts ki mapping.
  const stockMap = new Map<number, number>();
  ((stockRes.data || []) as Record<string, unknown>[]).forEach((r) => {
    stockMap.set(Number(r.product_id ?? 0), Number(r.available ?? 0));
  });

  const supplierMap = new Map<number, RequirementSupplier[]>();
  const suppById = new Map<number, RequirementSupplier>();
  ((suppRes.data || []) as SupplierRow[]).forEach((s) =>
    suppById.set(s.id, { id: s.id, name: s.name || "", contact: s.contact || "" })
  );
  ((linkRes.data || []) as SpareSupplierRow[]).forEach((l) => {
    const s = suppById.get(l.supplier_id);
    if (!s) return;
    const arr = supplierMap.get(l.spare_id) || [];
    arr.push(s);
    supplierMap.set(l.spare_id, arr);
  });

  const built: RequirementItem[] = products.map((p) => {
    const current_stock = stockMap.get(p.id) ?? 0;
    const alertQty = Number(p.alert_quantity) || 0;
    const effective_alert = alertThreshold(alertQty);
    return {
      id: p.id,
      name: p.name || "",
      description: p.description || "",
      price: Number(p.price) || 0,
      hsn: p.hsn || "",
      alert_quantity: alertQty,
      effective_alert,
      current_stock,
      need_to_order: Math.max(0, effective_alert - current_stock),
      suppliers: supplierMap.get(p.id) || [],
    };
  });

  return { firmName, items: built.filter((i) => i.current_stock <= i.effective_alert) };
}
