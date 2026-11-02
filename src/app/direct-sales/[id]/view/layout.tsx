import type { SupabaseClient } from "@supabase/supabase-js";
import { loadStaffSeed } from "@/lib/server-seed";
import { ServerSeedProvider } from "@/app/components/ServerSeed";

export const dynamic = "force-dynamic";

export type DirectSaleInvoiceItem = {
  id: number;
  product_id: number;
  product_name: string;
  qty: number;
  price: number;
  total: number;
};

export type DirectSaleInvoiceSeed = {
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
  items: DirectSaleInvoiceItem[];
};

async function fetchInvoiceSeed(
  supabase: SupabaseClient,
  saleId: number
): Promise<DirectSaleInvoiceSeed> {
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

  const itemRows = (itemsRes.data || []) as {
    id: number;
    product_id: number;
    qty: number;
    price: number;
  }[];
  const productIds = itemRows.map((i) => i.product_id);
  const pMap = new Map<number, string>();
  if (productIds.length) {
    const { data: prods } = await supabase
      .from("product_list")
      .select("id, name")
      .in("id", productIds);
    (prods || []).forEach((p: Record<string, unknown>) => pMap.set(Number(p.id), String(p.name)));
  }

  const items: DirectSaleInvoiceItem[] = itemRows.map((i) => ({
    ...i,
    product_name: pMap.get(i.product_id) || "Unknown",
    total: i.qty * i.price,
  }));

  return {
    ...(sd as Record<string, unknown>),
    client_name: clientName,
    client_contact: c?.contact || null,
    client_address: c?.address || null,
    staff_name: mechName,
    last_editor_name: editorName,
    items,
  } as DirectSaleInvoiceSeed;
}

export default async function ViewSaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const saleId = Number(id);
  const seed = Number.isFinite(saleId)
    ? await loadStaffSeed("Direct sale invoice", (supabase) => fetchInvoiceSeed(supabase, saleId))
    : null;

  return (
    <ServerSeedProvider seedKey="direct-sale-view" data={seed}>
      {children}
    </ServerSeedProvider>
  );
}
