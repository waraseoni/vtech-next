import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDueMaps, balanceFromMaps } from "@/lib/client-due";
import { todayIST } from "@/lib/dateUtils";

/**
 * `/reports/delivered` (today, all clients) ka neutral server seed — client
 * ke fetchClients/fetchFirmInfo/fetchData ka read-only mirror.
 * Caller cookie+RLS client pass karta hai.
 */

export type DeliveredTransaction = {
  id: number;
  job_id: string;
  date_completed: string;
  item: string;
  amount: number;
  client_id: number;
  client_name: string;
  client_contact: string;
  client_image: string | null;
  mechanic_name: string;
  mechanic_image: string | null;
  opening_balance: number;
};

export type DeliveredClientTotals = { netBalance: number };

export type DeliveredSeed = {
  from: string;
  to: string;
  clientsList: { id: number; name: string }[];
  firmInfo: Record<string, string>;
  reportData: {
    transactions: DeliveredTransaction[];
    clientTotals: Record<number, DeliveredClientTotals>;
  };
};

export async function fetchDeliveredSeed(
  supabase: SupabaseClient,
  from = todayIST(),
  to = todayIST()
): Promise<DeliveredSeed> {
  const startDate = `${from}T00:00:00+05:30`;
  const endDate = `${to}T23:59:59+05:30`;

  const [clientsRes, firmRes, txRes] = await Promise.all([
    supabase.from("client_list").select("id, firstname, middlename, lastname").order("firstname"),
    supabase.from("system_info").select("meta_field, meta_value"),
    supabase
      .from("transaction_list")
      .select("id, job_id, date_completed, item, amount, client_name, mechanic_id")
      .eq("status", 5)
      .eq("del_status", 0)
      .gte("date_completed", startDate)
      .lte("date_completed", endDate)
      .order("date_completed", { ascending: false }),
  ]);

  if (txRes.error) throw txRes.error;

  const clientsList = (clientsRes.data || []).map((c) => ({
    id: c.id,
    name: `${c.firstname} ${c.middlename || ""} ${c.lastname || ""}`.replace(/\s+/g, " ").trim(),
  }));

  const firmInfo: Record<string, string> = {};
  (firmRes.data || []).forEach((r) => {
    firmInfo[r.meta_field] = r.meta_value;
  });

  const txData = txRes.data || [];
  if (txData.length === 0) {
    return { from, to, clientsList, firmInfo, reportData: { transactions: [], clientTotals: {} } };
  }

  const clientIds = [
    ...new Set(txData.map((t) => t.client_name).filter((id): id is number => id != null)),
  ];
  const mechIds = [...new Set(txData.map((t) => t.mechanic_id).filter(Boolean))];

  const [
    { data: clientsData },
    { data: billedData },
    { data: paymentsData },
    { data: salesData },
    { data: loansData },
    { data: mechData },
  ] = await Promise.all([
    clientIds.length > 0
      ? supabase
          .from("client_list")
          .select("id, firstname, middlename, lastname, contact, opening_balance, image_path")
          .in("id", clientIds)
      : Promise.resolve({ data: [] as never[] }),
    clientIds.length > 0
      ? supabase
          .from("transaction_list")
          .select("client_name, amount")
          .eq("status", 5)
          .eq("del_status", 0)
          .in("client_name", clientIds)
      : Promise.resolve({ data: [] as never[] }),
    clientIds.length > 0
      ? supabase
          .from("client_payments")
          .select("client_id, amount, discount, loan_id")
          .in("client_id", clientIds)
      : Promise.resolve({ data: [] as never[] }),
    clientIds.length > 0
      ? supabase.from("direct_sales").select("client_id, total_amount").in("client_id", clientIds)
      : Promise.resolve({ data: [] as never[] }),
    clientIds.length > 0
      ? supabase
          .from("client_loans")
          .select("id, client_id, total_payable")
          .eq("status", 1)
          .in("client_id", clientIds)
      : Promise.resolve({ data: [] as never[] }),
    mechIds.length > 0
      ? supabase
          .from("mechanic_list")
          .select("id, firstname, lastname, image_path")
          .in("id", mechIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const clientMap: Record<
    number,
    { name: string; contact: string; opening_balance: number; image_path: string | null }
  > = {};
  (clientsData || []).forEach((c) => {
    clientMap[c.id] = {
      name: `${c.firstname} ${c.middlename || ""} ${c.lastname || ""}`.replace(/\s+/g, " ").trim(),
      contact: c.contact || "",
      opening_balance: c.opening_balance || 0,
      image_path: c.image_path || null,
    };
  });
  const mechMap: Record<number, { name: string; image_path: string | null }> = {};
  (mechData || []).forEach((m) => {
    mechMap[m.id] = {
      name: `${m.firstname} ${m.lastname}`.trim(),
      image_path: m.image_path || null,
    };
  });

  const dueMaps = buildDueMaps({
    repairs: billedData,
    directSales: salesData,
    payments: paymentsData,
    loans: loansData,
  });
  const clientTotals: Record<number, DeliveredClientTotals> = {};
  clientIds.forEach((id) => {
    clientTotals[id] = {
      netBalance: balanceFromMaps(dueMaps, id, clientMap[id]?.opening_balance || 0),
    };
  });

  const transactions: DeliveredTransaction[] = txData.map((t) => {
    const client = clientMap[t.client_name] || {
      name: "Unknown",
      contact: "",
      opening_balance: 0,
      image_path: null,
    };
    const mech = t.mechanic_id ? mechMap[t.mechanic_id] : null;
    return {
      id: t.id,
      job_id: t.job_id,
      date_completed: t.date_completed,
      item: t.item,
      amount: t.amount || 0,
      client_id: t.client_name,
      client_name: client.name,
      client_contact: client.contact,
      client_image: client.image_path,
      mechanic_name: mech?.name || "Not Assigned",
      mechanic_image: mech?.image_path || null,
      opening_balance: client.opening_balance,
    };
  });

  return { from, to, clientsList, firmInfo, reportData: { transactions, clientTotals } };
}
