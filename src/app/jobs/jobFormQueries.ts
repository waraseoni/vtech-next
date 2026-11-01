// ─── Job form master-data layer — server seed + client fallback ─────────────
// Pehle /jobs/new aur /jobs/[id]/edit mount par 7 sequential queries chalate
// the aur available stock browser me compute hota tha. Ab wahi queries server
// layout par EK Promise.all me chalti hain (src/lib/server-job-form.ts), aur
// yahan ka builder pure hai (dono runtimes safe — koi next/headers import nahi).
import type { SupabaseClient } from "@supabase/supabase-js";

export type JobFormClient = {
  id: number;
  firstname: string;
  middlename: string;
  lastname: string;
  contact: string;
  fullname: string;
};
export type JobFormMechanic = { id: number; fullname: string; commission_percent: number };
export type JobFormService = { id: number; name: string; price: number };
export type JobFormProduct = { id: number; name: string; price: number; available_stock: number };

export type JobFormMasters = {
  clients: JobFormClient[];
  mechanics: JobFormMechanic[];
  services: JobFormService[];
  products: JobFormProduct[];
};

export type JobFormSeed = JobFormMasters & {
  currentUserId: number;
  userRole: string;
};

/** Exact stock formula jo pehle form page me inline thi (koi semantic change nahi). */
export function buildAvailableStock(
  products: Array<{ id: number; name: string; price: number }>,
  inventory: Array<{ product_id: number; quantity: number | null }>,
  jobProducts: Array<{ product_id: number; qty: number | null; transaction_id: number }>,
  saleItems: Array<{ product_id: number; qty: number | null }>,
  cancelledIds: Set<number>
): JobFormProduct[] {
  const invMap: Record<number, number> = {};
  inventory.forEach((r) => {
    invMap[r.product_id] = (invMap[r.product_id] || 0) + (r.quantity || 0);
  });

  const jobSoldMap: Record<number, number> = {};
  jobProducts.forEach((r) => {
    if (!cancelledIds.has(r.transaction_id))
      jobSoldMap[r.product_id] = (jobSoldMap[r.product_id] || 0) + (r.qty || 0);
  });

  const saleSoldMap: Record<number, number> = {};
  saleItems.forEach((r) => {
    saleSoldMap[r.product_id] = (saleSoldMap[r.product_id] || 0) + (r.qty || 0);
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    available_stock: (invMap[p.id] || 0) - (jobSoldMap[p.id] || 0) - (saleSoldMap[p.id] || 0),
  }));
}

export async function fetchJobFormMasters(supabase: SupabaseClient): Promise<JobFormMasters> {
  // Nested join product_list→transaction_products→transaction_list PostgREST me
  // fail hota hai (composite key) — isliye wahi 4 flat queries jo pehle thi,
  // bas ab parallel.
  const [
    { data: cData },
    { data: mData },
    { data: sData },
    { data: pData },
    { data: invData },
    { data: tpData },
    { data: dsiData },
    { data: cancelledJobs },
  ] = await Promise.all([
    supabase
      .from("client_list")
      .select("id, firstname, middlename, lastname, contact")
      .eq("delete_flag", 0)
      .order("firstname"),
    supabase
      .from("mechanic_list")
      .select("id, firstname, middlename, lastname, commission_percent")
      .eq("delete_flag", 0)
      .eq("status", 1)
      .order("firstname"),
    supabase
      .from("service_list")
      .select("id, name, price")
      .eq("delete_flag", 0)
      .eq("status", 1)
      .order("name"),
    supabase
      .from("product_list")
      .select("id, name, price")
      .eq("delete_flag", 0)
      .eq("status", 1)
      .order("name"),
    supabase.from("inventory_list").select("product_id, quantity"),
    supabase.from("transaction_products").select("product_id, qty, transaction_id"),
    supabase.from("direct_sale_items").select("product_id, qty"),
    supabase.from("transaction_list").select("id").eq("status", 4),
  ]);

  const cancelledIds = new Set((cancelledJobs || []).map((j: { id: number }) => j.id));

  return {
    clients: (cData || []).map(
      (c: {
        id: number;
        firstname: string;
        middlename: string;
        lastname: string;
        contact: string;
      }) => ({
        ...c,
        fullname: [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" "),
      })
    ),
    mechanics: (mData || []).map(
      (m: {
        id: number;
        firstname: string;
        middlename: string;
        lastname: string;
        commission_percent: number | null;
      }) => ({
        id: m.id,
        fullname: [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" "),
        commission_percent: m.commission_percent || 0,
      })
    ),
    services: (sData || []) as JobFormService[],
    products: buildAvailableStock(
      (pData || []) as Array<{ id: number; name: string; price: number }>,
      (invData || []) as Array<{ product_id: number; quantity: number | null }>,
      (tpData || []) as Array<{
        product_id: number;
        qty: number | null;
        transaction_id: number;
      }>,
      (dsiData || []) as Array<{ product_id: number; qty: number | null }>,
      cancelledIds
    ),
  };
}
