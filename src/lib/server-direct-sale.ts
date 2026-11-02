import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Direct-sale form ke masters (clients, mechanics, products + stock) ka neutral
 * server query. Page/layout apna cookie+RLS client pass karta hai — service-role
 * kabhi nahi. Edit mode me apni sale ke lines stock me wapas jud jaati hain
 * (bilkul purane client fetchProducts jaisa).
 */

export type DirectSaleFormProduct = {
  id: number;
  name: string;
  price: number;
  available_stock: number;
};

export type DirectSaleFormItem = {
  product_id: number;
  product_name: string;
  qty: number;
  price: number;
  original_qty: number;
  available_stock: number;
};

export type DirectSaleFormSeed = {
  userRole: "admin" | "staff";
  mechanicId: number | null;
  clients: { id: number; name: string }[];
  mechanics: { id: number; name: string }[];
  products: DirectSaleFormProduct[];
  sale?: {
    row: Record<string, unknown>;
    client_id: number | null;
    mechanic_id: number | null;
    payment_mode: string | null;
    remarks: string | null;
    items: DirectSaleFormItem[];
  };
};

export async function fetchSaleFormSeed(
  supabase: SupabaseClient,
  saleId?: number
): Promise<DirectSaleFormSeed> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userRole: "admin" | "staff" = "staff";
  let mechanicId: number | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, mechanic_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) {
      userRole = profile.role;
      mechanicId = profile.mechanic_id ?? null;
    }
  }

  const [{ data: cData }, { data: mData }, { data: pData }] = await Promise.all([
    supabase
      .from("client_list")
      .select("id, firstname, middlename, lastname")
      .eq("delete_flag", 0)
      .order("firstname"),
    supabase.from("mechanic_list").select("id, firstname, lastname").eq("status", 1).order("firstname"),
    supabase.from("product_list").select("id, name, price").eq("delete_flag", 0).eq("status", 1),
  ]);

  const clients = (cData || []).map((c: Record<string, unknown>) => ({
    id: Number(c.id),
    name: [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" "),
  }));
  const mechanics = (mData || []).map((m: Record<string, unknown>) => ({
    id: Number(m.id),
    name: `${m.firstname} ${m.lastname}`,
  }));

  const prods = (pData || []) as { id: number; name: string; price: number }[];
  let products: DirectSaleFormProduct[] = [];

  if (prods.length) {
    const ids = prods.map((p) => p.id);
    const [stockRes, ownRes] = await Promise.all([
      supabase.rpc("get_inventory_stock", { p_product_ids: ids }),
      saleId != null
        ? supabase
            .from("direct_sale_items")
            .select("product_id, qty")
            .eq("sale_id", saleId)
            .in("product_id", ids)
        : Promise.resolve({ data: null as Record<string, unknown>[] | null }),
    ]);

    const stockMap = new Map<number, number>();
    (stockRes.data || []).forEach((r: Record<string, unknown>) =>
      stockMap.set(Number(r.product_id), Number(r.available ?? 0))
    );
    const ownQty = new Map<number, number>();
    (ownRes.data || []).forEach((r: Record<string, unknown>) =>
      ownQty.set(Number(r.product_id), (ownQty.get(Number(r.product_id)) || 0) + Number(r.qty ?? 0))
    );

    products = prods.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      available_stock: (stockMap.get(p.id) ?? 0) + (saleId != null ? (ownQty.get(p.id) ?? 0) : 0),
    }));
  }

  const seed: DirectSaleFormSeed = { userRole, mechanicId, clients, mechanics, products };

  if (saleId != null) {
    const { data: sale, error } = await supabase
      .from("direct_sales")
      .select("*")
      .eq("id", saleId)
      .single();
    if (error || !sale) throw new Error(`Sale ${saleId} load failed`);

    const { data: itemRows, error: itemErr } = await supabase
      .from("direct_sale_items")
      .select("product_id, qty, price")
      .eq("sale_id", saleId);
    if (itemErr) throw itemErr;

    const items = (itemRows || []) as { product_id: number; qty: number; price: number }[];
    const productIds = [...new Set(items.map((i) => i.product_id))];
    const pMap = new Map<number, string>();
    if (productIds.length) {
      const { data: pNames } = await supabase
        .from("product_list")
        .select("id, name")
        .in("id", productIds);
      (pNames || []).forEach((p: Record<string, unknown>) =>
        pMap.set(Number(p.id), String(p.name))
      );
    }

    seed.sale = {
      row: sale as Record<string, unknown>,
      client_id: (sale.client_id as number | null) ?? null,
      mechanic_id: (sale.mechanic_id as number | null) ?? null,
      payment_mode: (sale.payment_mode as string | null) ?? null,
      remarks: (sale.remarks as string | null) ?? null,
      items: items.map((i) => ({
        product_id: i.product_id,
        product_name: pMap.get(i.product_id) || "Unknown Product",
        qty: i.qty,
        price: i.price,
        original_qty: i.qty,
        available_stock: products.find((p) => p.id === i.product_id)?.available_stock ?? 0,
      })),
    };
  }

  return seed;
}
