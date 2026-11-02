import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfMonthIST, todayIST } from "@/lib/dateUtils";

/**
 * `/reports/custom-service` (this month) ka neutral server seed — client ke
 * fetchData ka read-only mirror. Caller cookie+RLS client pass karta hai.
 */

export type CustomServiceRow = {
  date_updated: string;
  code: string | null;
  client_name: string;
  service_name: string;
  description: string | null;
  price: number;
};

export type CustomServiceSeed = { from: string; to: string; rows: CustomServiceRow[] };

export async function fetchCustomServiceSeed(
  supabase: SupabaseClient,
  from = startOfMonthIST(),
  to = todayIST()
): Promise<CustomServiceSeed> {
  const fromTs = `${from}T00:00:00+05:30`;
  const toTs = `${to}T23:59:59+05:30`;

  const { data: txns } = await supabase
    .from("transaction_list")
    .select("id, code, client_name, status, date_updated")
    .gte("date_updated", fromTs)
    .lte("date_updated", toTs)
    .in("status", [1, 2, 3, 5]);

  const txnIds = [...new Set(txns?.map((t) => t.id) || [])];
  const { data: tsData } = txnIds.length
    ? await supabase
        .from("transaction_services")
        .select("service_id, price, transaction_id")
        .in("transaction_id", txnIds)
    : { data: [] as { service_id: number; price: number; transaction_id: number }[] };

  const { data: clients } = await supabase
    .from("client_list")
    .select("id, firstname, middlename, lastname")
    .eq("delete_flag", 0);
  const { data: services } = await supabase
    .from("service_list")
    .select("id, name, description")
    .eq("delete_flag", 0);

  const serviceRows: CustomServiceRow[] = [];
  for (const ts of tsData || []) {
    const txn = (txns || []).find((t) => t.id === ts.transaction_id);
    if (!txn) continue;
    const client = (clients || []).find((c) => c.id === txn.client_name);
    const service = (services || []).find((s) => s.id === ts.service_id);
    serviceRows.push({
      date_updated: txn.date_updated,
      code: txn.code,
      client_name: client
        ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ")
        : "Walk-in",
      service_name: service?.name || "Unknown",
      description: service?.description || null,
      price: ts.price || 0,
    });
  }
  serviceRows.sort(
    (a, b) => new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime()
  );

  return { from, to, rows: serviceRows };
}
