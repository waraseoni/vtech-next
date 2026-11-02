import type { SupabaseClient } from "@supabase/supabase-js";
import type { BomTemplate } from "@/lib/bomTemplates";

/**
 * `/inventory/bom-check` ka neutral server seed — catalog query + saved
 * templates (`/api/bom-templates` GET ka read-only mirror).
 * Caller cookie+RLS client pass karta hai.
 */

export type BomProduct = {
  id: number;
  name: string;
  description: string;
  barcode: string | null;
  alert_quantity: number;
  price: number;
};

export type BomSupplier = { id: number; name: string; contact: string };

export type BomCheckSeed = {
  templates: BomTemplate[];
  catalogData: {
    catalog: BomProduct[];
    suppliers: Map<number, BomSupplier[]>;
  };
};

export async function fetchBomCheckSeed(supabase: SupabaseClient): Promise<BomCheckSeed> {
  const [tplRes, plRes, suppliersRes, linkRes] = await Promise.all([
    supabase
      .from("bom_templates")
      .select("id, name, description, items, created_by, date_created, date_updated")
      .order("name", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("product_list")
      .select("id, name, description, barcode, alert_quantity, price")
      .eq("delete_flag", 0)
      .eq("status", 1),
    supabase.from("suppliers").select("id, name, contact").eq("delete_flag", 0).eq("status", 1),
    supabase.from("spare_supplier").select("spare_id, supplier_id"),
  ]);

  if (plRes.error) throw plRes.error;
  if (suppliersRes.error) throw suppliersRes.error;
  if (linkRes.error) throw linkRes.error;

  const catalog: BomProduct[] = (plRes.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description || "",
    barcode: p.barcode ?? null,
    alert_quantity: p.alert_quantity ?? 0,
    price: Number(p.price ?? 0),
  }));

  const suppById = new Map<number, BomSupplier>();
  (suppliersRes.data || []).forEach((s) =>
    suppById.set(s.id, { id: s.id, name: s.name, contact: s.contact || "" })
  );
  const bySpare = new Map<number, BomSupplier[]>();
  (linkRes.data || []).forEach((l) => {
    const s = suppById.get(l.supplier_id as number);
    if (!s) return;
    const arr = bySpare.get(l.spare_id as number) || [];
    arr.push(s);
    bySpare.set(l.spare_id as number, arr);
  });

  return {
    templates: tplRes.error ? [] : ((tplRes.data || []) as BomTemplate[]),
    catalogData: { catalog, suppliers: bySpare },
  };
}
