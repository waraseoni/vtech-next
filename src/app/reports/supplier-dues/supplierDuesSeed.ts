import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `/reports/supplier-dues` ka neutral server seed — client ke load()
 * (system_info + fetchSupplierDues) ka read-only mirror.
 * `fetchSupplierDues` client module (`@/lib/supplierPayments`) me hai, isliye
 * yahan wahi queries inline ki gayi hain. Caller cookie+RLS client pass karta hai.
 */

export type SupplierDuesRow = {
  supplierId: number;
  name: string;
  billed: number;
  paid: number;
  outstanding: number;
};

export type SupplierDuesSeed = {
  firmName: string;
  rows: SupplierDuesRow[];
};

export async function fetchSupplierDuesSeed(supabase: SupabaseClient): Promise<SupplierDuesSeed> {
  const [sysRes, suppliersRes, paymentsRes, posRes] = await Promise.all([
    supabase.from("system_info").select("meta_field, meta_value"),
    supabase.from("suppliers").select("id, name").eq("delete_flag", 0).order("name"),
    supabase.from("supplier_payments").select("supplier_id, amount"),
    supabase.from("purchase_orders").select("supplier_id, total_amount"),
  ]);

  if (suppliersRes.error) throw suppliersRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  if (posRes.error) throw posRes.error;

  const info: Record<string, string> = {};
  (sysRes.data || []).forEach((r) => {
    info[r.meta_field] = r.meta_value;
  });

  const paidBySupplier: Record<number, number> = {};
  for (const p of (paymentsRes.data || []) as { supplier_id: number; amount: number }[]) {
    paidBySupplier[p.supplier_id] = (paidBySupplier[p.supplier_id] || 0) + Number(p.amount || 0);
  }

  const billedBySupplier: Record<number, number> = {};
  for (const po of (posRes.data || []) as { supplier_id: number; total_amount: number }[]) {
    billedBySupplier[po.supplier_id] =
      (billedBySupplier[po.supplier_id] || 0) + Number(po.total_amount || 0);
  }

  const rows = ((suppliersRes.data || []) as { id: number; name: string }[]).map((s) => {
    const billed = billedBySupplier[s.id] || 0;
    const paid = paidBySupplier[s.id] || 0;
    return {
      supplierId: s.id,
      name: s.name,
      billed,
      paid,
      outstanding: Math.round((billed - paid) * 100) / 100,
    };
  });

  return { firmName: info.name || "V-Technologies", rows };
}
