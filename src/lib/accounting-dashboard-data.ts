/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Accounting dashboard aggregation — single source of truth for
 * `/reports/accounting-dashboard` ka server first paint aur client refetch.
 *
 * PERF: pehle 2 sequential waves (12 + 16 queries) thi. Ab ek hi Promise.all
 * wave (21 queries) — duplicate reads merge ho gaye:
 *   * transaction_list period: 3 selects → 1
 *   * client_payments all-time: 2 → 1
 *   * direct_sales all-time: 3 → 1 (walkin null/0/'' local filter)
 *   * loan_payments all-time: 2 → 1
 *   * client_list: 2 → 1
 */

import { pageAll } from "./fetch-all";

type SupabaseLike = { from: (table: string) => any };
type Row = Record<string, any>;

const pageAllRows = async (q: any): Promise<Row[]> => (await pageAll<Row>(q)).data;
const num = (v: unknown) => Number(v) || 0;

export type AccountingDashboardData = {
  serviceRevenue: number;
  salesRevenue: number;
  walkinSales: number;
  totalRevenue: number;
  grossProfit: number;
  netProfit: number;
  commission: number;
  salaryEarned: number;
  shopExpenses: number;
  staffAdvances: number;
  loanEmis: number;
  totalExpenses: number;
  collections: number;
  discounts: number;
  cashInflow: number;
  cashOutflow: number;
  expenseCategories: { category: string; total: number }[];
  topCustomers: { name: string; total: number }[];
  cashOnHand: number;
  accountsReceivable: number;
  inventoryValue: number;
  loansPayable: number;
  stockItems: { name: string; qty: number; price: number; value: number }[];
};

export const EMPTY_ACCOUNTING_DASHBOARD: AccountingDashboardData = {
  serviceRevenue: 0,
  salesRevenue: 0,
  walkinSales: 0,
  totalRevenue: 0,
  grossProfit: 0,
  netProfit: 0,
  commission: 0,
  salaryEarned: 0,
  shopExpenses: 0,
  staffAdvances: 0,
  loanEmis: 0,
  totalExpenses: 0,
  collections: 0,
  discounts: 0,
  cashInflow: 0,
  cashOutflow: 0,
  expenseCategories: [],
  topCustomers: [],
  cashOnHand: 0,
  accountsReceivable: 0,
  inventoryValue: 0,
  loansPayable: 0,
  stockItems: [],
};

export async function fetchAccountingDashboardData(
  supabase: SupabaseLike,
  { from, to }: { from: string; to: string }
): Promise<AccountingDashboardData> {
  const sTs = `${from}T00:00:00+05:30`;
  const eTs = `${to}T23:59:59+05:30`;

  const [
    periodJobs,
    periodSales,
    attendance,
    { data: mechanics },
    { data: salaryHist },
    periodPayments,
    periodExpenses,
    periodAdvances,
    periodLoanEmis,
    { data: clients },
    paymentsAll,
    salesAll,
    expensesAll,
    advancesAll,
    loanPaysAll,
    inventoryAsOn,
    { data: products },
    serviceJobsAll,
    clientLoans,
    { data: lenders },
    inventoryAll,
  ] = await Promise.all([
    // Period: service revenue + commission + top-customer grouping (ek hi rows)
    pageAllRows(
      supabase
        .from("transaction_list")
        .select("amount, mechanic_commission_amount, client_name")
        .eq("status", 5)
        .gte("date_completed", sTs)
        .lte("date_completed", eTs)
    ),
    pageAllRows(
      supabase
        .from("direct_sales")
        .select("total_amount, client_id")
        .gte("date_created", sTs)
        .lte("date_created", eTs)
    ),
    pageAllRows(
      supabase
        .from("attendance_list")
        .select("mechanic_id, curr_date, status")
        .gte("curr_date", from)
        .lte("curr_date", to)
        .in("status", [1, 3])
    ),
    supabase.from("mechanic_list").select("id, daily_salary"),
    supabase.from("mechanic_salary_history").select("mechanic_id, salary, effective_date"),
    pageAllRows(
      supabase
        .from("client_payments")
        .select("amount, discount, payment_date")
        .gte("payment_date", sTs)
        .lte("payment_date", eTs)
    ),
    pageAllRows(
      supabase
        .from("expense_list")
        .select("amount, category")
        .gte("date_created", sTs)
        .lte("date_created", eTs)
    ),
    pageAllRows(
      supabase.from("advance_payments").select("amount").gte("date_paid", sTs).lte("date_paid", eTs)
    ),
    pageAllRows(
      supabase
        .from("loan_payments")
        .select("amount_paid, payment_date")
        .gte("payment_date", sTs)
        .lte("payment_date", eTs)
    ),
    // Names (sab clients) + opening balance (delete_flag=0) — ek hi read
    supabase.from("client_list").select("id, firstname, lastname, opening_balance, delete_flag"),
    // All-time (as-of `to`) aggregates
    pageAllRows(
      supabase.from("client_payments").select("amount, discount").lte("payment_date", eTs)
    ),
    pageAllRows(
      supabase.from("direct_sales").select("total_amount, client_id").lte("date_created", eTs)
    ),
    pageAllRows(supabase.from("expense_list").select("amount").lte("date_created", eTs)),
    pageAllRows(supabase.from("advance_payments").select("amount").lte("date_paid", eTs)),
    // Unbounded (old behaviour): loansPayable all-time repaid dikhata hai;
    // cashOnHand ke liye neeche `eTs` tak locally filter hota hai.
    pageAllRows(supabase.from("loan_payments").select("amount_paid, payment_date")),
    pageAllRows(
      supabase.from("inventory_list").select("quantity, product_id").lte("stock_date", eTs)
    ),
    supabase.from("product_list").select("id, price, name"),
    pageAllRows(
      supabase.from("transaction_list").select("amount").eq("status", 5).lte("date_completed", eTs)
    ),
    pageAllRows(
      supabase.from("client_loans").select("total_payable").eq("status", 1).lte("loan_date", eTs)
    ),
    supabase.from("lender_list").select("loan_amount").eq("status", 1),
    pageAllRows(supabase.from("inventory_list").select("quantity, product_id")),
  ]);

  const serviceRevenue = periodJobs.reduce((s, r) => s + num(r.amount), 0);
  const salesRevenue = periodSales.reduce((s, r) => s + num(r.total_amount), 0);
  const walkinSales = periodSales
    .filter((r) => r.client_id === null || r.client_id === 0 || r.client_id === "")
    .reduce((s, r) => s + num(r.total_amount), 0);
  const totalRevenue = serviceRevenue + salesRevenue;
  const commission = periodJobs.reduce((s, r) => s + num(r.mechanic_commission_amount), 0);

  // Salary earned — attendance-based with salary history override
  const mechRate = new Map<number, number>();
  (mechanics || []).forEach((m: Row) => mechRate.set(m.id, num(m.daily_salary)));
  const histMap = new Map<number, { salary: number; effective_date: string }[]>();
  (salaryHist || []).forEach((h: Row) => {
    const arr = histMap.get(h.mechanic_id) || [];
    arr.push({ salary: num(h.salary), effective_date: h.effective_date || "" });
    histMap.set(h.mechanic_id, arr);
  });
  histMap.forEach((arr) =>
    arr.sort((a, b) => (b.effective_date || "").localeCompare(a.effective_date || ""))
  );
  let salaryEarned = 0;
  attendance.forEach((a) => {
    const hist = histMap.get(a.mechanic_id) || [];
    const rate =
      hist.find((h) => !h.effective_date || h.effective_date <= a.curr_date)?.salary ??
      mechRate.get(a.mechanic_id) ??
      0;
    salaryEarned += a.status === 3 ? rate / 2 : rate;
  });

  const collections = periodPayments.reduce((s, r) => s + num(r.amount), 0);
  const discounts = periodPayments.reduce((s, r) => s + num(r.discount), 0);
  const shopExpenses = periodExpenses.reduce((s, r) => s + num(r.amount), 0);
  const staffAdvances = periodAdvances.reduce((s, r) => s + num(r.amount), 0);
  const loanEmis = periodLoanEmis.reduce((s, r) => s + num(r.amount_paid), 0);

  const totalBusinessExpense = salaryEarned + commission + shopExpenses + loanEmis + discounts;
  const grossProfit = totalRevenue - commission;
  const netProfit = totalRevenue - totalBusinessExpense;
  const cashInflow = collections + walkinSales;
  const cashOutflow = staffAdvances + shopExpenses + loanEmis;

  // Expense breakdown by category
  const catMap = new Map<string, number>();
  periodExpenses.forEach((r) =>
    catMap.set(r.category || "Other", (catMap.get(r.category || "Other") || 0) + num(r.amount))
  );
  const expenseCategories = [...catMap.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  // Top 5 customers
  const custMap = new Map<string, number>();
  const clientName = new Map<number, string>();
  (clients || []).forEach((c: Row) =>
    clientName.set(c.id, [c.firstname, c.lastname].filter(Boolean).join(" ").trim())
  );
  periodJobs.forEach((r) => {
    const id = String(r.client_name);
    custMap.set(id, (custMap.get(id) || 0) + num(r.amount));
  });
  const topCustomers = [...custMap.entries()]
    .map(([id, total]) => ({ name: clientName.get(Number(id)) || "Walk-in", total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // ── Assets & Liabilities as of end date ──
  const eTsMs = new Date(eTs).getTime();
  const loanPaysToDate = loanPaysAll.filter((r) => {
    const t = r.payment_date ? new Date(r.payment_date).getTime() : NaN;
    return Number.isFinite(t) && t <= eTsMs;
  });
  const cashOnHand =
    paymentsAll.reduce((s, r) => s + num(r.amount), 0) +
    salesAll
      .filter((r) => r.client_id === null || r.client_id === 0 || r.client_id === "")
      .reduce((s, r) => s + num(r.total_amount), 0) -
    expensesAll.reduce((s, r) => s + num(r.amount), 0) -
    advancesAll.reduce((s, r) => s + num(r.amount), 0) -
    loanPaysToDate.reduce((s, r) => s + num(r.amount_paid), 0);

  const prodPrice = new Map<number, number>();
  (products || []).forEach((p: Row) => prodPrice.set(p.id, num(p.price)));
  const inventoryValue = inventoryAsOn.reduce(
    (s, r) => s + num(r.quantity) * (prodPrice.get(r.product_id) || 0),
    0
  );

  const openingBalance = (clients || [])
    .filter((c: Row) => c.delete_flag === 0)
    .reduce((s: number, c: Row) => s + num(c.opening_balance), 0);
  const accountsReceivable =
    openingBalance +
    serviceJobsAll.reduce((s, r) => s + num(r.amount), 0) +
    salesAll.reduce((s, r) => s + num(r.total_amount), 0) +
    clientLoans.reduce((s: number, r: Row) => s + num(r.total_payable), 0) -
    paymentsAll.reduce((s, r) => s + num(r.amount) + num(r.discount), 0);

  const loansPayable =
    (lenders || []).reduce((s: number, r: Row) => s + num(r.loan_amount), 0) -
    loanPaysAll.reduce((s, r) => s + num(r.amount_paid), 0);

  // Inventory health — top 5 stock items
  const prodName = new Map<number, string>();
  (products || []).forEach((p: Row) => prodName.set(p.id, p.name || "Unknown"));
  const stockMap = new Map<number, number>();
  inventoryAll.forEach((r: Row) =>
    stockMap.set(r.product_id, (stockMap.get(r.product_id) || 0) + num(r.quantity))
  );
  const stockItems = [...stockMap.entries()]
    .filter(([, qty]) => qty > 0)
    .map(([pid, qty]) => ({
      name: prodName.get(pid) || "Unknown",
      qty,
      price: prodPrice.get(pid) || 0,
      value: qty * (prodPrice.get(pid) || 0),
    }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  return {
    serviceRevenue,
    salesRevenue,
    walkinSales,
    totalRevenue,
    grossProfit,
    netProfit,
    commission,
    salaryEarned,
    shopExpenses,
    staffAdvances,
    loanEmis,
    totalExpenses: totalBusinessExpense,
    collections,
    discounts,
    cashInflow,
    cashOutflow,
    expenseCategories,
    topCustomers,
    cashOnHand,
    accountsReceivable,
    inventoryValue,
    loansPayable,
    stockItems,
  };
}
