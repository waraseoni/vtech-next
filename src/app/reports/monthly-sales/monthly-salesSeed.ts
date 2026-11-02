import type { SupabaseClient } from "@supabase/supabase-js";
import { pageAll } from "@/lib/fetch-all";
import { currentMonthIST } from "@/lib/dateUtils";

/**
 * `/reports/monthly-sales` (current month) ka neutral server seed — client ke
 * fetchData ka read-only mirror. Caller cookie+RLS client pass karta hai.
 */

export type MonthlySalesRow = {
  date_updated: string;
  code: string | null;
  client_name: string;
  product_name: string;
  price: number;
  qty: number;
  total: number;
};

export type MonthlySalesSeed = { month: string; rows: MonthlySalesRow[] };

type TxnDoc = {
  id: number;
  code: string | null;
  client_name: number | string | null;
  status: number;
  date_updated: string;
};
type TpDoc = {
  transaction_id: number;
  product_id: number;
  product_name: string | null;
  price: number | null;
  qty: number | null;
};
type ClientDoc = {
  id: number;
  firstname: string | null;
  middlename: string | null;
  lastname: string | null;
};
type ProductDoc = { id: number; name: string | null };

export async function fetchMonthlySalesSeed(
  supabase: SupabaseClient,
  month = currentMonthIST()
): Promise<MonthlySalesSeed> {
  const from = `${month}-01T00:00:00+05:30`;
  const [year, m] = month.split("-").map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}T23:59:59+05:30`;

  const { data: txns } = await pageAll<TxnDoc>(
    supabase
      .from("transaction_list")
      .select("id, code, client_name, status, date_updated")
      .gte("date_updated", from)
      .lte("date_updated", to)
      .neq("status", 4)
  );

  const txnIds = [...new Set(txns?.map((t) => t.id) || [])];
  const { data: tpData } = txnIds.length
    ? await pageAll<TpDoc>(
        supabase
          .from("transaction_products")
          .select("transaction_id, product_id, product_name, price, qty")
          .in("transaction_id", txnIds)
      )
    : { data: [] as TpDoc[] };

  const { data: clients } = await pageAll<ClientDoc>(
    supabase.from("client_list").select("id, firstname, middlename, lastname").eq("delete_flag", 0)
  );

  const { data: products } = await pageAll<ProductDoc>(
    supabase.from("product_list").select("id, name").eq("delete_flag", 0)
  );

  const saleRows: MonthlySalesRow[] = [];
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
      product_name: product?.name || tp.product_name || "Unknown",
      price: tp.price || 0,
      qty: tp.qty || 1,
      total: (tp.price || 0) * (tp.qty || 1),
    });
  }
  saleRows.sort((a, b) => new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime());

  return { month, rows: saleRows };
}
