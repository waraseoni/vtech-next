import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `/inventory/purchase-orders` ka neutral server seed — page ke fetchPos ka
 * read-only mirror. Caller cookie+RLS client pass karta hai.
 */

export type PurchaseOrdersStatus =
  | "pending"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled";

export type PurchaseOrdersItem = {
  id: number;
  product_id: number;
  product_name: string;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number;
};

export type PurchaseOrdersPO = {
  id: number;
  po_code: string;
  supplier_id: number | null;
  contact_person_id?: number | null;
  transaction_id: number | null;
  supplier_name: string;
  supplier_phone: string;
  person_name?: string;
  status: PurchaseOrdersStatus;
  expected_date: string | null;
  notes: string;
  total_amount: number;
  received_date: string | null;
  date_created: string;
  items: PurchaseOrdersItem[];
};

export type PurchaseOrdersSeed = {
  pos: PurchaseOrdersPO[];
  firmName: string;
  firmMobile: string;
  firmAddress: string;
  ownerName: string;
};

export async function fetchPurchaseOrdersSeed(
  supabase: SupabaseClient
): Promise<PurchaseOrdersSeed> {
  const [poRes, supRes, personRes, sysRes] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select(
        "id, po_code, supplier_id, contact_person_id, transaction_id, status, expected_date, notes, total_amount, received_date, date_created"
      )
      .order("date_created", { ascending: false }),
    supabase.from("suppliers").select("id, name, contact").eq("delete_flag", 0),
    supabase
      .from("supplier_contact_persons")
      .select("id, supplier_id, name")
      .order("is_primary", { ascending: false }),
    supabase.from("system_info").select("meta_field, meta_value"),
  ]);
  if (poRes.error) throw poRes.error;

  const supplierMap = new Map(
    (supRes.data || []).map((s: { id: number; name: string; contact: string | null }) => [
      s.id,
      { name: s.name, phone: s.contact || "" },
    ])
  );
  const personById = new Map(
    (personRes.data || []).map((p) => [p.id, { supplier_id: p.supplier_id, name: p.name }])
  );
  const poRows = (poRes.data || []) as Array<{
    id: number;
    po_code: string;
    supplier_id: number | null;
    contact_person_id?: number | null;
    transaction_id: number | null;
    status: string;
    expected_date: string | null;
    notes: string;
    total_amount: number;
    received_date: string | null;
    date_created: string;
  }>;

  const itemMap = new Map<number, PurchaseOrdersItem[]>();
  if (poRows.length) {
    const { data: itRes } = await supabase
      .from("purchase_order_items")
      .select("*")
      .in(
        "purchase_order_id",
        poRows.map((p) => p.id)
      );
    const { data: prodRes } = await supabase
      .from("product_list")
      .select("id, name")
      .in("id", [...new Set((itRes || []).map((i) => i.product_id))]);
    const prodMap = new Map((prodRes || []).map((p) => [p.id, p.name]));
    (itRes || []).forEach((i) => {
      const list = itemMap.get(i.purchase_order_id) || [];
      list.push({
        id: i.id,
        product_id: i.product_id,
        product_name: prodMap.get(i.product_id) || `#${i.product_id}`,
        qty_ordered: i.qty_ordered,
        qty_received: i.qty_received,
        unit_cost: i.unit_cost,
      });
      itemMap.set(i.purchase_order_id, list);
    });
  }

  const sysInfo: Record<string, string> = {};
  (sysRes.data || []).forEach((r: { meta_field: string; meta_value: string }) => {
    sysInfo[r.meta_field] = r.meta_value;
  });

  let ownerName = "";
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      ownerName = prof?.full_name || user.user_metadata?.full_name || "";
    }
  } catch {
    /* ignore */
  }

  return {
    pos: poRows.map((p) => ({
      ...p,
      status: p.status as PurchaseOrdersStatus,
      supplier_name: p.supplier_id ? supplierMap.get(p.supplier_id)?.name || "Unknown" : "—",
      supplier_phone: p.supplier_id ? supplierMap.get(p.supplier_id)?.phone || "" : "",
      person_name:
        p.contact_person_id && personById.get(p.contact_person_id)
          ? personById.get(p.contact_person_id)!.name
          : undefined,
      items: itemMap.get(p.id) || [],
    })),
    firmName: sysInfo.name || "V-Technologies",
    firmMobile: sysInfo.contact || "",
    firmAddress: sysInfo.address || "",
    ownerName,
  };
}
