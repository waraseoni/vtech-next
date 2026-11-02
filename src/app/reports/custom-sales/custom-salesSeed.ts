import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfMonthIST, todayIST } from "@/lib/dateUtils";

/**
 * `/reports/custom-sales` (this month) ka neutral server seed — client ke
 * fetchData ka read-only mirror. Caller cookie+RLS client pass karta hai.
 */

export type CustomSalesRow = {
  date_updated: string;
  code: string | null;
  client_name: string;
  product_name: string;
  price: number;
  qty: number;
  total: number;
};

export type CustomSalesSeed = { from: string; to: string; rows: CustomSalesRow[] };

export async function fetchCustomSalesSeed(
  supabase: SupabaseClient,
  from = startOfMonthIST(),
  to = todayIST()
): Promise<CustomSalesSeed> {
  const fromTs = `${from}T00:00:00+05:30`;
  const toTs = `${to}T23:59:59+05:30`;

  const { data: txns } = await supabase
    .from("transaction_list")
    .select("id, code, client_name, status, date_updated")
    .gte("date_updated", fromTs)
    .lte("date_updated", toTs)
    .in("status", [1, 2, 3, 5]);

  const txnIds = [...new Set(txns?.map((t) => t.id) || [])];
  const { data: tpData } = txnIds.length
    ? await supabase
        .from("transaction_products")
        .select("transaction_id, product_id, price, qty")
        .in("transaction_id", txnIds)
    : { data: [] as { transaction_id: number; product_id: number; price: number; qty: number }[] };

  const { data: clients } = await supabase
    .from("client_list")
    .select("id, firstname, middlename, lastname")
    .eq("delete_flag", 0);
  const { data: products } = await supabase
    .from("product_list")
    .select("id, name")
    .eq("delete_flag", 0);

  const saleRows: CustomSalesRow[] = [];
  for (const tp of tpData || []) {
    const txn = (txns || []).find((t) => t.id === tp.transaction_id);
    if (!txn) continue;
    const client = (clients || []).find((c) => c.id === txn.client_name);
    const product = (products || []).find((p) => p.id === tp.product_id);
    saleRows.push({
      date_updated: txn.date_updated,
      code: txn.code,
      client_name: client
        ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ")
        : "Walk-in",
      product_name: product?.name || "Unknown",
      price: tp.price || 0,
      qty: tp.qty || 1,
      total: (tp.price || 0) * (tp.qty || 1),
    });
  }
  saleRows.sort((a, b) => new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime());

  return { from, to, rows: saleRows };
}
