/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { pageAll } from "@/lib/fetch-all";
import { todayIST, parseISTDate, startOfMonthIST, endOfMonthIST } from "@/lib/dateUtils";

/**
 * `/reports/financial-report` (default = current month) ka neutral server seed.
 * Client ke saare supabase reads + stock/loan math ka exact read-only mirror.
 * Caller cookie+RLS client pass karta hai (service-role yahan kabhi nahi).
 */

type Row = Record<string, any>;
const pageAllRows = (q: any) => pageAll<Row>(q);

export type FinancialReportTotals = {
  service_rev: number;
  parts_rev: number;
  direct_sales_rev: number;
  expenses: number;
  emi_paid: number;
  advance_paid: number;
  stock_added_val: number;
  current_stock_val: number;
  loan_pending: number;
};

export type FinancialReportSeed = {
  from: string;
  to: string;
  data: FinancialReportTotals;
};

export async function fetchFinancialReportSeed(
  supabase: SupabaseClient,
  from = startOfMonthIST(parseISTDate(todayIST())),
  to = endOfMonthIST(parseISTDate(todayIST()))
): Promise<FinancialReportSeed> {
  const start = `${from}T00:00:00+05:30`;
  const end = `${to}T23:59:59+05:30`;

  // First get the transactions in range
  const { data: txRangeData } = await pageAllRows(
    supabase
      .from("transaction_list")
      .select("id")
      .eq("status", 5)
      .gte("date_completed", start)
      .lte("date_completed", end)
  );
  const txRangeIds = (txRangeData || []).map((t) => String(t.id));

  const [svcRes, partsRes, directRes, expenseRes, emiRes, advanceRes, stockAddRes] =
    await Promise.all([
      // Service Revenue (status 5 delivered)
      txRangeIds.length > 0
        ? pageAllRows(
            supabase.from("transaction_services").select("price").in("transaction_id", txRangeIds)
          )
        : Promise.resolve({ data: [] as Row[] }),
      // Parts Revenue (status 5 delivered)
      txRangeIds.length > 0
        ? pageAllRows(
            supabase
              .from("transaction_products")
              .select("qty, price")
              .in("transaction_id", txRangeIds)
          )
        : Promise.resolve({ data: [] as Row[] }),
      // Direct Sales
      pageAllRows(
        supabase
          .from("direct_sales")
          .select("total_amount")
          .gte("date_created", start)
          .lte("date_created", end)
      ),
      // Expenses
      pageAllRows(
        supabase
          .from("expense_list")
          .select("amount")
          .gte("date_created", start)
          .lte("date_created", end)
      ),
      // Loan EMIs Paid
      pageAllRows(
        supabase
          .from("loan_payments")
          .select("amount_paid")
          .gte("payment_date", start)
          .lte("payment_date", end)
      ),
      // Advances Paid
      pageAllRows(
        supabase
          .from("advance_payments")
          .select("amount")
          .gte("date_paid", start)
          .lte("date_paid", end)
      ),
      // Stock Added Value (Selling Price)
      pageAllRows(
        supabase
          .from("inventory_list")
          .select("product_id, quantity, stock_date")
          .gte("stock_date", start)
          .lte("stock_date", end)
      ),
    ]);

  // Resolve stock added value via product price map (avoid embed FK dependency)
  const { data: priceList } = await supabase.from("product_list").select("id, price");
  const priceMap = new Map((priceList || []).map((p) => [p.id, p.price || 0]));
  const stock_added_val = (stockAddRes.data || []).reduce(
    (s: number, r) => s + (r.quantity || 0) * (priceMap.get(r.product_id) || 0),
    0
  );

  // 2. Current Stock Value & Loan Pending (Overall, not range filtered)
  const [stockValRes, lendersRes, loanPaysRes] = await Promise.all([
    // Match PHP: all products (no delete_flag filter)
    supabase.from("product_list").select("id, price"),
    supabase.from("lender_list").select("id, emi_amount, tenure_months").eq("status", 1),
    supabase.from("loan_payments").select("lender_id, amount_paid"),
  ]);

  // Match PHP current stock calc: (inventory - transaction_products - direct_sale_items) * price per product
  // PHP does NOT filter transaction_products by status here, so include cancelled txn qty too.
  const [{ data: invAll }, { data: tpAll }, { data: dsAll }] = await Promise.all([
    supabase.from("inventory_list").select("product_id, quantity"),
    supabase.from("transaction_products").select("product_id, qty"),
    supabase.from("direct_sale_items").select("product_id, qty"),
  ]);

  const invMap: Record<number, number> = {};
  (invAll || []).forEach(
    (r) => (invMap[r.product_id] = (invMap[r.product_id] || 0) + (r.quantity || 0))
  );
  const soldMap: Record<number, number> = {};
  (tpAll || []).forEach(
    (r) => (soldMap[r.product_id] = (soldMap[r.product_id] || 0) + (r.qty || 0))
  );
  (dsAll || []).forEach(
    (r) => (soldMap[r.product_id] = (soldMap[r.product_id] || 0) + (r.qty || 0))
  );

  let currentStockVal = 0;
  (stockValRes.data || []).forEach((p) => {
    const qty = (invMap[p.id] || 0) - (soldMap[p.id] || 0);
    currentStockVal += qty * (p.price || 0);
  });

  // Calculate Debt
  let loanPending = 0;
  const paysByLender: Record<number, number> = {};
  (loanPaysRes.data || []).forEach(
    (p) => (paysByLender[p.lender_id] = (paysByLender[p.lender_id] || 0) + (p.amount_paid || 0))
  );
  (lendersRes.data || []).forEach((l) => {
    const totalToPay = (l.emi_amount || 0) * (l.tenure_months || 0);
    const paid = paysByLender[l.id] || 0;
    loanPending += totalToPay - paid;
  });

  const data: FinancialReportTotals = {
    service_rev: (svcRes.data || []).reduce((s, r) => s + (r.price || 0), 0),
    parts_rev: (partsRes.data || []).reduce((s, r) => s + (r.qty || 0) * (r.price || 0), 0),
    direct_sales_rev: (directRes.data || []).reduce((s, r) => s + (r.total_amount || 0), 0),
    expenses: (expenseRes.data || []).reduce((s, r) => s + (r.amount || 0), 0),
    emi_paid: (emiRes.data || []).reduce((s, r) => s + (r.amount_paid || 0), 0),
    advance_paid: (advanceRes.data || []).reduce((s, r) => s + (r.amount || 0), 0),
    stock_added_val,
    current_stock_val: currentStockVal,
    loan_pending: loanPending,
  };

  return { from, to, data };
}
