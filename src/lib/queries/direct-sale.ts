"use client";

import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface SaleItem {
  id: number;
  product_id: number;
  product_name: string;
  qty: number;
  price: number;
  total: number;
}

export interface Sale {
  id: number;
  sale_code: string;
  client_id: number | null;
  client_name: string | null;
  client_contact: string | null;
  client_address: string | null;
  mechanic_id: number;
  staff_name: string;
  total_amount: number;
  payment_mode: string;
  remarks: string | null;
  date_created: string;
  last_edited_by: number | null;
  last_edited_date: string | null;
  last_editor_name: string | null;
  items: SaleItem[];
}

export const directSaleKey = (id: number) => ["direct-sale", id] as const;

// Search hover se pehle bhi isi function ko call karke cache warm ho sakta hai,
// isliye queryFn page ke andar nahi — yahan module level par rakha hai.
export async function fetchDirectSale(saleId: number): Promise<Sale> {
  const { data: sd, error: se } = await supabase
    .from("direct_sales")
    .select("*")
    .eq("id", saleId)
    .single();
  if (se) throw se;

  const [clientRes, mechRes, editorRes, itemsRes] = await Promise.all([
    sd.client_id
      ? supabase
          .from("client_list")
          .select("firstname, middlename, lastname, contact, address")
          .eq("id", sd.client_id)
          .single()
      : Promise.resolve({ data: null }),
    sd.mechanic_id
      ? supabase
          .from("mechanic_list")
          .select("firstname, lastname")
          .eq("id", sd.mechanic_id)
          .single()
      : Promise.resolve({ data: null }),
    sd.last_edited_by && sd.last_edited_by !== 0
      ? supabase
          .from("mechanic_list")
          .select("firstname, lastname")
          .eq("id", sd.last_edited_by)
          .single()
      : Promise.resolve({ data: null }),
    supabase.from("direct_sale_items").select("id, product_id, qty, price").eq("sale_id", saleId),
  ]);

  const c = clientRes.data;
  const clientName = c ? [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ") : null;
  const mechName = mechRes.data ? `${mechRes.data.firstname} ${mechRes.data.lastname}` : "Admin";
  const editorName =
    sd.last_edited_by === 0
      ? "Admin"
      : editorRes.data
        ? `${editorRes.data.firstname} ${editorRes.data.lastname}`
        : null;

  const productIds = (itemsRes.data || []).map((i) => i.product_id);
  const pMap = new Map<number, string>();
  if (productIds.length) {
    const { data: prods } = await supabase
      .from("product_list")
      .select("id, name")
      .in("id", productIds);
    prods?.forEach((p) => pMap.set(p.id, p.name));
  }
  const items: SaleItem[] = (itemsRes.data || []).map((i) => ({
    ...i,
    product_name: pMap.get(i.product_id) || "Unknown",
    total: i.qty * i.price,
  }));

  return {
    ...sd,
    client_name: clientName,
    client_contact: c?.contact || null,
    client_address: c?.address || null,
    staff_name: mechName,
    last_editor_name: editorName,
    items,
  };
}

export function directSaleOptions(id: number) {
  return queryOptions<Sale>({
    queryKey: directSaleKey(id),
    queryFn: () => fetchDirectSale(id),
  });
}
