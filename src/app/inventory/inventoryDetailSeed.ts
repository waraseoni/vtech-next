import type { SupabaseClient } from "@supabase/supabase-js";
import { stockValue } from "@/lib/inventory";

/**
 * `/inventory/[id]` ka neutral server seed — page ke fetchData + location
 * hierarchy queries ka read-only mirror. Caller cookie+RLS client pass karta hai.
 */

export type InventoryDetailProduct = {
  id: number;
  name: string;
  description: string;
  cost_price: number;
  price: number;
  image_path: string | null;
  alert_quantity?: number;
  barcode?: string | null;
};

export type InventoryDetailStockIn = {
  id: number;
  quantity: number;
  place: string | null;
  stock_date: string;
  supplier_id?: number | null;
  purchase_order_id?: number | null;
};

export type InventoryDetailStockOut = {
  id: number;
  date: string;
  reference: string;
  type: "Repair Job" | "Direct Sale";
  client_name: string;
  qty: number;
  price: number;
  total: number;
  link: string;
};

export type InventoryDetailHierarchy = {
  zones: { id: number; name: string }[];
  racks: { id: number; name: string; zone_id: number }[];
  bins: { id: number; name: string; rack_id: number }[];
  boxes: { id: number; name: string; bin_id: number }[];
};

export type InventoryDetailSeed = {
  data: {
    product: InventoryDetailProduct | null;
    productLocations: { id: number; zone: string; rack: string; bin: string; box: string }[];
    stockIn: InventoryDetailStockIn[];
    poCodes: Map<number, string>;
    stockOut: InventoryDetailStockOut[];
    stats: {
      totalIn: number;
      totalSold: number;
      available: number;
      revenue: number;
      stockValue: number;
    };
  };
  hierarchy: InventoryDetailHierarchy;
};

export async function fetchInventoryDetailSeed(
  supabase: SupabaseClient,
  productId: number
): Promise<InventoryDetailSeed | null> {
  const [prodRes, stockRes, jobRes, saleRes] = await Promise.all([
    supabase.from("product_list").select("*").eq("id", productId).single(),
    supabase
      .from("inventory_list")
      .select("*")
      .eq("product_id", productId)
      .order("stock_date", { ascending: false }),
    supabase
      .from("transaction_products")
      .select("qty, price, transaction_id")
      .eq("product_id", productId),
    supabase
      .from("direct_sale_items")
      .select("qty, price, sale_id")
      .eq("product_id", productId),
  ]);

  if (prodRes.error || !prodRes.data) return null;
  const prod = prodRes.data as InventoryDetailProduct;

  const [{ data: plRows }, zonesRes, racksRes, binsRes, boxesRes] = await Promise.all([
    supabase
      .from("product_locations")
      .select("locations!inner(zone, rack, bin, box)")
      .eq("product_id", productId),
    supabase.from("location_zones").select("id, name").eq("delete_flag", 0),
    supabase.from("location_racks").select("id, name, zone_id").eq("delete_flag", 0),
    supabase.from("location_bins").select("id, name, rack_id").eq("delete_flag", 0),
    supabase.from("location_boxes").select("id, name, bin_id").eq("delete_flag", 0),
  ]);

  const mappedLocs: { id: number; zone: string; rack: string; bin: string; box: string }[] = (
    (plRows || []) as Array<{
      locations:
        | { zone?: string | null; rack?: string | null; bin?: string | null; box?: string | null }
        | Array<{
            zone?: string | null;
            rack?: string | null;
            bin?: string | null;
            box?: string | null;
          }>;
    }>
  ).map((row, i) => {
    const loc = Array.isArray(row.locations) ? row.locations[0] : row.locations;
    return {
      id: i,
      zone: loc?.zone || "",
      rack: loc?.rack || "",
      bin: loc?.bin || "",
      box: loc?.box || "",
    };
  });

  const stockInData = (stockRes.data || []) as InventoryDetailStockIn[];
  const totalIn = stockInData.reduce((s, r) => s + r.quantity, 0);

  const poIds = [
    ...new Set(
      stockInData.map((r) => r.purchase_order_id).filter((id): id is number => Boolean(id))
    ),
  ];
  const poCodes = new Map<number, string>();
  if (poIds.length) {
    const { data: poRows } = await supabase
      .from("purchase_orders")
      .select("id, po_code")
      .in("id", poIds);
    (poRows || []).forEach((r) => poCodes.set(r.id, r.po_code));
  }

  const jobItems = (jobRes.data || []) as {
    qty: number;
    price: number;
    transaction_id: number;
  }[];
  const saleItems = (saleRes.data || []) as { qty: number; price: number; sale_id: number }[];

  const jobTxns = jobItems.length
    ? (
        await supabase
          .from("transaction_list")
          .select("id, date_created, job_id, code, status, client_name")
          .in(
            "id",
            jobItems.map((i) => i.transaction_id)
          )
          .neq("status", 4)
      ).data || []
    : [];
  const sales = saleItems.length
    ? (
        await supabase
          .from("direct_sales")
          .select("id, date_created, sale_code, client_id")
          .in(
            "id",
            saleItems.map((i) => i.sale_id)
          )
      ).data || []
    : [];

  const cids = [
    ...new Set([
      ...jobTxns.map((t) => Number(t.client_name)),
      ...sales.map((s) => s.client_id).filter((id): id is number => Boolean(id)),
    ]),
  ];
  const clients = cids.length
    ? (
        await supabase
          .from("client_list")
          .select("id, firstname, middlename, lastname")
          .in("id", cids)
      ).data || []
    : [];
  const cMap = new Map(
    clients.map((c) => [
      c.id,
      [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" "),
    ])
  );

  const jobOut: InventoryDetailStockOut[] = [];
  const tMap = new Map(jobTxns.map((t) => [t.id, t]));
  jobItems.forEach((item) => {
    const t = tMap.get(item.transaction_id);
    if (t)
      jobOut.push({
        id: t.id,
        date: t.date_created,
        reference: t.job_id || t.code,
        type: "Repair Job",
        client_name: cMap.get(Number(t.client_name)) || "N/A",
        qty: item.qty,
        price: item.price,
        total: item.qty * item.price,
        link: `/jobs/${t.id}/view`,
      });
  });

  const saleOut: InventoryDetailStockOut[] = [];
  const sMap = new Map(sales.map((s) => [s.id, s]));
  saleItems.forEach((item) => {
    const s = sMap.get(item.sale_id);
    if (s)
      saleOut.push({
        id: s.id,
        date: s.date_created,
        reference: s.sale_code,
        type: "Direct Sale",
        client_name: cMap.get(s.client_id as number) || "Walk-in",
        qty: item.qty,
        price: item.price,
        total: item.qty * item.price,
        link: `/direct-sales/${s.id}/view`,
      });
  });

  const allOut = [...jobOut, ...saleOut].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const totalSold = allOut.reduce((s, o) => s + o.qty, 0);
  const revenue = allOut.reduce((s, o) => s + o.total, 0);
  const available = totalIn - totalSold;

  return {
    data: {
      product: prod,
      productLocations: mappedLocs,
      stockIn: stockInData,
      poCodes,
      stockOut: allOut,
      stats: { totalIn, totalSold, available, revenue, stockValue: stockValue(available, prod?.price) },
    },
    hierarchy: {
      zones: (zonesRes.data || []) as unknown as InventoryDetailHierarchy["zones"],
      racks: (racksRes.data || []) as unknown as InventoryDetailHierarchy["racks"],
      bins: (binsRes.data || []) as unknown as InventoryDetailHierarchy["bins"],
      boxes: (boxesRes.data || []) as unknown as InventoryDetailHierarchy["boxes"],
    },
  };
}
