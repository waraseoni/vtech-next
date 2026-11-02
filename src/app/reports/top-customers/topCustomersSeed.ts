import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/fetch-all";
import { buildDueMaps, balanceFromMaps } from "@/lib/client-due";
import { todayIST, startOfMonthIST, endOfMonthIST } from "@/lib/dateUtils";

/**
 * `/reports/top-customers` (default: All Time) ka neutral server seed —
 * client ke fetchList/aggregation ka read-only mirror (same 8 queries,
 * same ordering/slicing, 1000-row paging via fetch-all).
 * Caller cookie+RLS client pass karta hai (service-role NEVER).
 */

export type TopCustomersFilterType = "monthly" | "yearly" | "all";

export type TopCustomer = {
  client_id: number;
  customer_name: string;
  image: string | null;
  contact: string | null;
  total_jobs: number;
  total_amount: number;
  total_payment: number;
  opening_balance: number;
  current_balance: number;
};

export type TopCustomersSeed = {
  filterType: TopCustomersFilterType;
  selYear: number;
  selMonth: number;
  rows: TopCustomer[];
};

export type TopCustomersSeedFilters = {
  filterType?: TopCustomersFilterType;
  selYear?: number;
  selMonth?: number;
};

type ClientRow = {
  id: number;
  firstname: string | null;
  middlename: string | null;
  lastname: string | null;
  contact: string | null;
  image_path: string | null;
  opening_balance: number | null;
};
type TxnRow = { client_name: number | string | null; amount: number | null };
type PaymentRow = {
  client_id: number | null;
  amount: number | null;
  discount: number | null;
  loan_id: number | null;
};
type SaleRow = { client_id: number | null; total_amount: number | null };
type LoanRow = { id: number; client_id: number | null; total_payable: number | null };

export async function fetchTopCustomersSeed(
  supabase: SupabaseClient,
  filters: TopCustomersSeedFilters = {}
): Promise<TopCustomersSeed> {
  const today = todayIST();
  const filterType: TopCustomersFilterType = filters.filterType ?? "all";
  const selYear = filters.selYear ?? parseInt(today.slice(0, 4));
  const selMonth = filters.selMonth ?? parseInt(today.slice(5, 7));

  let from: string, to: string;
  if (filterType === "monthly") {
    const d = new Date(selYear, selMonth - 1, 1);
    from = startOfMonthIST(d) + "T00:00:00+05:30";
    to = endOfMonthIST(d) + "T23:59:59+05:30";
  } else if (filterType === "yearly") {
    from = `${selYear}-01-01T00:00:00+05:30`;
    to = `${selYear}-12-31T23:59:59+05:30`;
  } else {
    from = "2000-01-01T00:00:00+05:30";
    to = "2099-12-31T23:59:59+05:30";
  }

  const [clients, allTxns, allPmts, allDirectSales, allLoans, dueTxns, dueDirectSales, duePmts] =
    await Promise.all([
      fetchAll<ClientRow>(
        supabase
          .from("client_list")
          .select("id, firstname, middlename, lastname, contact, image_path, opening_balance")
          .eq("delete_flag", 0)
      ),
      fetchAll<TxnRow>(
        supabase
          .from("transaction_list")
          .select("client_name, amount")
          .eq("status", 5)
          .gte("date_created", from)
          .lte("date_created", to)
      ),
      fetchAll<PaymentRow>(
        supabase
          .from("client_payments")
          .select("client_id, amount, discount, loan_id")
          .gte("payment_date", from.split("T")[0])
          .lte("payment_date", to.split("T")[0])
      ),
      fetchAll<SaleRow>(
        supabase
          .from("direct_sales")
          .select("client_id, total_amount")
          .gte("date_created", from)
          .lte("date_created", to)
      ),
      fetchAll<LoanRow>(
        supabase.from("client_loans").select("id, client_id, total_payable").eq("status", 1)
      ),
      fetchAll<TxnRow>(
        supabase.from("transaction_list").select("client_name, amount").eq("status", 5)
      ),
      fetchAll<SaleRow>(supabase.from("direct_sales").select("client_id, total_amount")),
      fetchAll<PaymentRow>(
        supabase.from("client_payments").select("client_id, amount, discount, loan_id")
      ),
    ]);

  const txnsByClient = new Map<number, { amount: number; count: number }>();
  const pmtsByClient = new Map<number, { amount: number }>();

  for (const t of allTxns || []) {
    if (!t.client_name) continue;
    const cId = parseInt(String(t.client_name), 10);
    const curr = txnsByClient.get(cId) || { amount: 0, count: 0 };
    curr.amount += t.amount || 0;
    curr.count += 1;
    txnsByClient.set(cId, curr);
  }

  for (const s of allDirectSales || []) {
    if (!s.client_id) continue;
    const cId = parseInt(String(s.client_id), 10);
    const curr = txnsByClient.get(cId) || { amount: 0, count: 0 };
    curr.amount += s.total_amount || 0;
    curr.count += 1;
    txnsByClient.set(cId, curr);
  }

  for (const p of allPmts || []) {
    if (!p.client_id) continue;
    const cId = parseInt(String(p.client_id), 10);
    const curr = pmtsByClient.get(cId) || { amount: 0 };
    curr.amount += (p.amount || 0) + (p.discount || 0);
    pmtsByClient.set(cId, curr);
  }

  const dueMaps = buildDueMaps({
    repairs: dueTxns,
    directSales: dueDirectSales,
    payments: duePmts,
    loans: allLoans,
  });

  const topRows: TopCustomer[] = [];
  for (const c of clients || []) {
    const tData = txnsByClient.get(c.id);
    const pData = pmtsByClient.get(c.id);

    const totalAmt = tData?.amount || 0;
    const totalPmt = pData?.amount || 0;

    if (totalAmt > 0 || totalPmt > 0) {
      const name = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ");
      const openingBalance = c.opening_balance || 0;
      topRows.push({
        client_id: c.id,
        customer_name: name,
        image: c.image_path || null,
        contact: c.contact,
        total_jobs: tData?.count || 0,
        total_amount: totalAmt,
        total_payment: totalPmt,
        opening_balance: openingBalance,
        current_balance: balanceFromMaps(dueMaps, c.id, openingBalance),
      });
    }
  }

  topRows.sort((a, b) => b.total_amount - a.total_amount);

  return { filterType, selYear, selMonth, rows: topRows.slice(0, 20) };
}
