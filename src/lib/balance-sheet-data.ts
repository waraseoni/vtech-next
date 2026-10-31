/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Shared balance-sheet computation — single source of truth for
 * `/api/reports/balancesheet` (screen) aur `/api/print-balancesheet` (print).
 *
 * Conventions (docs/DATA_MIGRATION_NOTES.md + src/lib/client-due.ts):
 *   * customer dues  = opening + billed txns (status 3/5) + direct sales
 *                      − service payments (loan_id null/0); loan EMIs yahan
 *                      nahi, wo alag "client loan" asset hain.
 *   * staff payable  = salary (history rate) + commission − advances.
 *   * position rows  = as-on date tak; P&L = from–to period.
 *   * cash           = cumulative inflows − outflows (estimated).
 */

import {
  computeCashFlow,
  previousPeriod,
  type CashFlow,
  type CashFlowInput,
} from "./balance-sheet";

type SupabaseLike = { from: (table: string) => any };
type Row = Record<string, any>;

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const dayOf = (v: unknown): string =>
  typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : "";

const onOrBefore = (v: unknown, day: string) => {
  const d = dayOf(v);
  return d !== "" && d <= day;
};
const inRange = (v: unknown, from: string, to: string) => {
  const d = dayOf(v);
  return d !== "" && d >= from && d <= to;
};
const isServicePayment = (loanId: unknown) => loanId == null || n(loanId) === 0;

async function fetchRows(
  sb: SupabaseLike,
  table: string,
  select: string,
  build?: (q: any) => any
): Promise<Row[]> {
  const out: Row[] = [];
  for (let page = 0; ; page++) {
    let q = sb.from(table).select(select);
    if (build) q = build(q);
    const { data, error } = await q.range(page * 1000, (page + 1) * 1000 - 1);
    if (error) {
      const msg = typeof error === "object" && error?.message ? error.message : String(error);
      throw new Error(`${table}: ${msg}`);
    }
    if (data?.length) out.push(...data);
    if (!data || data.length < 1000) break;
  }
  return out;
}

export type CustomerLedgerRow = {
  client_id: number;
  customer_name: string;
  contact: string | null;
  opening_balance: number;
  total_repair_amount: number;
  total_sales: number;
  total_payment: number;
  total_discount: number;
  current_balance: number;
  previous_transactions: number;
  total_jobs: number;
};

export type MechanicLedgerRow = {
  mechanic_id: number;
  mechanic_name: string;
  daily_salary: number;
  commission_percent: number;
  total_advance_amount: number;
  advance_in_period: number;
  total_days_worked: number;
  days_worked_in_period: number;
  total_salary_due: number;
  salary_due_in_period: number;
  total_commission: number;
  period_commission: number;
  balance_amount: number;
};

export type StockRow = {
  product_id: number;
  product_name: string;
  description: string;
  sale_price: number;
  total_stock_in: number;
  sold_quantity: number;
  remaining_stock: number;
  stock_value: number;
};

export type IncomeRow = { description: string; amount: number };
export type ExpenseRow = { expense_category: string | null; amount: number };

export type LoanRow = {
  lender_id: number;
  lender_name: string;
  contact: string;
  loan_amount: number;
  interest_rate: number;
  emi_amount: number;
  start_date: string;
  previous_payments: number;
  paid_in_period: number;
  total_paid: number;
  balance_amount: number;
  remaining_emis: number;
  status: string;
};

export type ClientLoanRow = {
  loan_id: number;
  client_id: number;
  client_name: string;
  loan_date: string;
  principal_amount: number;
  total_payable: number;
  emi_amount: number;
  paid: number;
  paid_in_period: number;
  outstanding: number;
  status: number;
};

export type TopCustomerRow = {
  client_id: number;
  customer_name: string;
  contact: string | null;
  previous_jobs: number;
  total_jobs: number;
  total_amount: number;
  total_payment_amount: number;
  opening_balance: number;
  current_balance: number;
};

export type PeriodSummary = {
  from: string;
  to: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
};

export type BalanceSheetSummary = {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  totalStockValue: number;
  totalMechBalance: number;
  totalLoanBalance: number;
  salaryEarned: number;
  commissionExpense: number;
  shopExpense: number;
  emiExpense: number;
  discountGiven: number;
  repairIncome: number;
  directSalesIncome: number;
  cashReceived: number;
  clientLoansGiven: number;
  clientLoanPrincipalGiven: number;
  purchasePayments: number;
  cashBalance: number;
  previous: PeriodSummary | null;
};

export type BalanceSheetPayload = {
  period: { from: string; to: string; asOn: string };
  customerLedger: CustomerLedgerRow[];
  mechanicLedger: MechanicLedgerRow[];
  stockInventory: StockRow[];
  incomeSummary: IncomeRow[];
  expenseSummary: ExpenseRow[];
  loanLedger: LoanRow[];
  clientLoanLedger: ClientLoanRow[];
  topCustomers: TopCustomerRow[];
  cashFlow: CashFlow;
  summary: BalanceSheetSummary;
};

const fullName = (r: Row): string =>
  [r.firstname, r.middlename, r.lastname].filter(Boolean).join(" ").trim() || "Unknown";

export async function fetchBalanceSheetData(
  sb: SupabaseLike,
  params: { from: string; to: string; asOn?: string }
): Promise<BalanceSheetPayload> {
  const fromDay = params.from;
  const toDay = params.to;
  const asOnDay = params.asOn || params.to;

  const [
    clients,
    mechanics,
    products,
    lenders,
    salaryHistory,
    custTxns,
    repairTxns,
    payments,
    attendance,
    advances,
    inventory,
    walkinSales,
    clientSales,
    directSaleItems,
    transactionProducts,
    expenses,
    loanPayments,
    clientLoans,
    purchaseOrders,
  ] = await Promise.all([
    fetchRows(
      sb,
      "client_list",
      "id, firstname, middlename, lastname, contact, opening_balance",
      (q) => q.eq("delete_flag", 0)
    ),
    fetchRows(
      sb,
      "mechanic_list",
      "id, firstname, middlename, lastname, daily_salary, commission_percent",
      (q) => q.eq("delete_flag", 0)
    ),
    fetchRows(sb, "product_list", "id, name, description, price", (q) => q.eq("delete_flag", 0)),
    // lender_list me delete_flag column nahi hai (legacy schema) — filter mat lagao.
    fetchRows(
      sb,
      "lender_list",
      "id, fullname, contact, loan_amount, interest_rate, emi_amount, start_date, status"
    ),
    fetchRows(sb, "mechanic_salary_history", "mechanic_id, salary, effective_date"),
    fetchRows(sb, "transaction_list", "id, client_name, amount, date_created, status", (q) =>
      q.in("status", [3, 5])
    ),
    fetchRows(
      sb,
      "transaction_list",
      "id, amount, date_completed, mechanic_id, mechanic_commission_amount",
      (q) => q.eq("status", 5)
    ),
    fetchRows(sb, "client_payments", "id, client_id, loan_id, amount, discount, payment_date"),
    fetchRows(sb, "attendance_list", "mechanic_id, curr_date, status"),
    fetchRows(sb, "advance_payments", "mechanic_id, amount, date_paid"),
    fetchRows(sb, "inventory_list", "product_id, quantity, stock_date"),
    fetchRows(sb, "direct_sales", "id, total_amount, date_created", (q) =>
      q.or("client_id.is.null,client_id.eq.0")
    ),
    fetchRows(sb, "direct_sales", "id, total_amount, date_created, client_id", (q) =>
      q.not("client_id", "is", null).neq("client_id", 0)
    ),
    fetchRows(sb, "direct_sale_items", "product_id, qty, sale_id"),
    fetchRows(sb, "transaction_products", "transaction_id, product_id, qty"),
    fetchRows(sb, "expense_list", "category, amount, date_created"),
    fetchRows(sb, "loan_payments", "lender_id, amount_paid, payment_date"),
    fetchRows(
      sb,
      "client_loans",
      "id, client_id, principal_amount, total_payable, emi_amount, loan_date, status"
    ),
    fetchRows(sb, "purchase_orders", "total_amount, received_date", (q) =>
      q.eq("status", "received").not("received_date", "is", null)
    ),
  ]);

  // ── Salary rate (history effective_date ke hisaab se) ──
  const dailySalary: Record<number, number> = {};
  mechanics.forEach((m) => {
    dailySalary[Number(m.id)] = n(m.daily_salary);
  });
  const historyByMech: Record<number, { day: string; salary: number }[]> = {};
  salaryHistory.forEach((h) => {
    const mid = n(h.mechanic_id);
    const day = dayOf(h.effective_date);
    if (!mid || !day) return;
    (historyByMech[mid] ||= []).push({ day, salary: n(h.salary) });
  });
  Object.values(historyByMech).forEach((arr) => arr.sort((a, b) => (a.day < b.day ? -1 : 1)));

  const rateFor = (mechanicId: number, day: string): number => {
    let rate = dailySalary[mechanicId] || 0;
    for (const h of historyByMech[mechanicId] || []) {
      if (h.day <= day) rate = h.salary;
      else break;
    }
    return rate;
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  CUSTOMER LEDGER (service dues only)
  // ═══════════════════════════════════════════════════════════════════════
  type ClientAgg = {
    txnBefore: number;
    txnAsOf: number;
    txnPeriod: number;
    txnCountBefore: number;
    txnCountPeriod: number;
    salesBefore: number;
    salesAsOf: number;
    salesPeriod: number;
    payBefore: number;
    payAsOf: number;
    payPeriodAmount: number;
    payPeriodDiscount: number;
  };
  const blankAgg = (): ClientAgg => ({
    txnBefore: 0,
    txnAsOf: 0,
    txnPeriod: 0,
    txnCountBefore: 0,
    txnCountPeriod: 0,
    salesBefore: 0,
    salesAsOf: 0,
    salesPeriod: 0,
    payBefore: 0,
    payAsOf: 0,
    payPeriodAmount: 0,
    payPeriodDiscount: 0,
  });
  const custAgg: Record<number, ClientAgg> = {};
  const custAggFor = (id: number) => (custAgg[id] ||= blankAgg());

  custTxns.forEach((t) => {
    const cid = parseInt(String(t.client_name ?? ""), 10);
    if (Number.isNaN(cid)) return;
    const d = dayOf(t.date_created);
    if (!d) return;
    const amount = n(t.amount);
    const a = custAggFor(cid);
    if (d < fromDay) {
      a.txnBefore += amount;
      a.txnCountBefore++;
    }
    if (d <= asOnDay) a.txnAsOf += amount;
    if (d >= fromDay && d <= toDay) {
      a.txnPeriod += amount;
      a.txnCountPeriod++;
    }
  });

  payments.forEach((p) => {
    if (!isServicePayment(p.loan_id)) return;
    const cid = n(p.client_id);
    if (!cid) return;
    const d = dayOf(p.payment_date);
    if (!d) return;
    const credit = n(p.amount) + n(p.discount);
    const a = custAggFor(cid);
    if (d < fromDay) a.payBefore += credit;
    if (d <= asOnDay) a.payAsOf += credit;
    if (d >= fromDay && d <= toDay) {
      a.payPeriodAmount += n(p.amount);
      a.payPeriodDiscount += n(p.discount);
    }
  });

  clientSales.forEach((s) => {
    const cid = n(s.client_id);
    if (!cid) return;
    const d = dayOf(s.date_created);
    if (!d) return;
    const amount = n(s.total_amount);
    const a = custAggFor(cid);
    if (d < fromDay) a.salesBefore += amount;
    if (d <= asOnDay) a.salesAsOf += amount;
    if (d >= fromDay && d <= toDay) a.salesPeriod += amount;
  });

  const customerLedger: CustomerLedgerRow[] = clients
    .map((c) => {
      const a = custAgg[Number(c.id)] || blankAgg();
      const ob = n(c.opening_balance);
      const opening = ob + a.txnBefore + a.salesBefore - a.payBefore;
      const current = ob + a.txnAsOf + a.salesAsOf - a.payAsOf;
      return {
        client_id: Number(c.id),
        customer_name: fullName(c),
        contact: c.contact || null,
        opening_balance: opening,
        total_repair_amount: a.txnPeriod,
        total_sales: a.salesPeriod,
        total_payment: a.payPeriodAmount,
        total_discount: a.payPeriodDiscount,
        current_balance: current,
        previous_transactions: a.txnCountBefore,
        total_jobs: a.txnCountPeriod,
      };
    })
    .filter(
      (c) =>
        c.opening_balance !== 0 ||
        c.current_balance !== 0 ||
        c.total_repair_amount > 0 ||
        c.total_sales > 0 ||
        c.total_payment > 0 ||
        c.total_discount > 0
    )
    .sort((a, b) => (a.customer_name < b.customer_name ? -1 : 1));

  // ═══════════════════════════════════════════════════════════════════════
  //  MECHANIC LEDGER
  // ═══════════════════════════════════════════════════════════════════════
  const attendanceByMech: Record<number, Row[]> = {};
  attendance.forEach((a) => {
    if (a.status !== 1 && a.status !== 3) return;
    const mid = n(a.mechanic_id);
    if (!mid) return;
    (attendanceByMech[mid] ||= []).push(a);
  });

  const advAsOf: Record<number, number> = {};
  const advPeriod: Record<number, number> = {};
  advances.forEach((a) => {
    const mid = n(a.mechanic_id);
    if (!mid) return;
    const d = dayOf(a.date_paid);
    if (!d) return;
    if (d <= asOnDay) advAsOf[mid] = (advAsOf[mid] || 0) + n(a.amount);
    if (d >= fromDay && d <= toDay) advPeriod[mid] = (advPeriod[mid] || 0) + n(a.amount);
  });

  const commAsOf: Record<number, number> = {};
  const commPeriod: Record<number, number> = {};
  repairTxns.forEach((t) => {
    const mid = n(t.mechanic_id);
    if (!mid) return;
    const d = dayOf(t.date_completed);
    if (!d) return;
    if (d <= asOnDay) commAsOf[mid] = (commAsOf[mid] || 0) + n(t.mechanic_commission_amount);
    if (d >= fromDay && d <= toDay)
      commPeriod[mid] = (commPeriod[mid] || 0) + n(t.mechanic_commission_amount);
  });

  const mechanicLedger: MechanicLedgerRow[] = mechanics
    .map((m) => {
      const mid = Number(m.id);
      let daysAsOf = 0;
      let daysPeriod = 0;
      let salaryAsOf = 0;
      let salaryPeriod = 0;
      for (const a of attendanceByMech[mid] || []) {
        const d = dayOf(a.curr_date);
        if (!d) continue;
        const factor = a.status === 3 ? 0.5 : 1;
        const pay = rateFor(mid, d) * factor;
        if (d <= asOnDay) {
          daysAsOf += factor;
          salaryAsOf += pay;
        }
        if (d >= fromDay && d <= toDay) {
          daysPeriod += factor;
          salaryPeriod += pay;
        }
      }
      const totalCommission = commAsOf[mid] || 0;
      const commissionInPeriod = commPeriod[mid] || 0;
      return {
        mechanic_id: mid,
        mechanic_name: fullName(m),
        daily_salary: n(m.daily_salary),
        commission_percent: n(m.commission_percent),
        total_advance_amount: advAsOf[mid] || 0,
        advance_in_period: advPeriod[mid] || 0,
        total_days_worked: daysAsOf,
        days_worked_in_period: daysPeriod,
        total_salary_due: salaryAsOf,
        salary_due_in_period: salaryPeriod,
        total_commission: totalCommission,
        period_commission: commissionInPeriod,
        balance_amount: salaryAsOf + totalCommission - (advAsOf[mid] || 0),
      };
    })
    .filter(
      (m) => m.balance_amount !== 0 || m.days_worked_in_period > 0 || m.period_commission > 0
    );

  // ═══════════════════════════════════════════════════════════════════════
  //  STOCK (as-on)
  // ═══════════════════════════════════════════════════════════════════════
  const stockIn: Record<number, number> = {};
  inventory.forEach((i) => {
    if (!onOrBefore(i.stock_date, asOnDay)) return;
    const pid = n(i.product_id);
    stockIn[pid] = (stockIn[pid] || 0) + n(i.quantity);
  });

  const saleDate: Record<number, string> = {};
  [...walkinSales, ...clientSales].forEach((s) => {
    const d = dayOf(s.date_created);
    if (d) saleDate[n(s.id)] = d;
  });

  const dsAsOf: Record<number, number> = {};
  const dsPeriod: Record<number, number> = {};
  directSaleItems.forEach((item) => {
    const d = saleDate[n(item.sale_id)];
    if (!d) return;
    const pid = n(item.product_id);
    if (d <= asOnDay) dsAsOf[pid] = (dsAsOf[pid] || 0) + n(item.qty);
    if (d >= fromDay && d <= toDay) dsPeriod[pid] = (dsPeriod[pid] || 0) + n(item.qty);
  });

  const txnMeta: Record<number, { status: number; day: string }> = {};
  custTxns.forEach((t) => {
    txnMeta[n(t.id)] = { status: n(t.status), day: dayOf(t.date_created) };
  });

  const tpAsOf: Record<number, number> = {};
  const tpPeriod: Record<number, number> = {};
  transactionProducts.forEach((tp) => {
    const meta = txnMeta[n(tp.transaction_id)];
    if (!meta || (meta.status !== 3 && meta.status !== 5) || !meta.day) return;
    const pid = n(tp.product_id);
    if (meta.day <= asOnDay) tpAsOf[pid] = (tpAsOf[pid] || 0) + n(tp.qty);
    if (meta.day >= fromDay && meta.day <= toDay) tpPeriod[pid] = (tpPeriod[pid] || 0) + n(tp.qty);
  });

  const stockInventory: StockRow[] = products
    .map((p) => {
      const pid = Number(p.id);
      const totalIn = stockIn[pid] || 0;
      const remaining = Math.max(0, totalIn - (dsAsOf[pid] || 0) - (tpAsOf[pid] || 0));
      const price = n(p.price);
      return {
        product_id: pid,
        product_name: p.name,
        description: p.description || "",
        sale_price: price,
        total_stock_in: totalIn,
        sold_quantity: (dsPeriod[pid] || 0) + (tpPeriod[pid] || 0),
        remaining_stock: remaining,
        stock_value: remaining * price,
      };
    })
    .filter((p) => p.total_stock_in > 0)
    .sort((a, b) => a.remaining_stock - b.remaining_stock);

  // ═══════════════════════════════════════════════════════════════════════
  //  INCOME / EXPENSE (period) + previous period
  // ═══════════════════════════════════════════════════════════════════════
  const sumRepair = (from: string, to: string) =>
    repairTxns.reduce((s, t) => (inRange(t.date_completed, from, to) ? s + n(t.amount) : s), 0);
  const sumCommission = (from: string, to: string) =>
    repairTxns.reduce(
      (s, t) => (inRange(t.date_completed, from, to) ? s + n(t.mechanic_commission_amount) : s),
      0
    );
  const sumSales = (rows: Row[], from: string, to: string) =>
    rows.reduce((s, r) => (inRange(r.date_created, from, to) ? s + n(r.total_amount) : s), 0);
  const sumSalary = (from: string, to: string) =>
    attendance.reduce((s, a) => {
      if (a.status !== 1 && a.status !== 3) return s;
      const d = dayOf(a.curr_date);
      if (!d || d < from || d > to) return s;
      return s + rateFor(n(a.mechanic_id), d) * (a.status === 3 ? 0.5 : 1);
    }, 0);
  const sumExpenses = (from: string, to: string) =>
    expenses.reduce((s, e) => (inRange(e.date_created, from, to) ? s + n(e.amount) : s), 0);
  const sumEmi = (from: string, to: string) =>
    loanPayments.reduce(
      (s, p) => (inRange(p.payment_date, from, to) ? s + n(p.amount_paid) : s),
      0
    );
  const sumDiscount = (from: string, to: string) =>
    payments.reduce((s, p) => (inRange(p.payment_date, from, to) ? s + n(p.discount) : s), 0);
  const sumCashReceived = (from: string, to: string) =>
    payments.reduce((s, p) => (inRange(p.payment_date, from, to) ? s + n(p.amount) : s), 0);

  const repairIncome = sumRepair(fromDay, toDay);
  const walkinIncome = sumSales(walkinSales, fromDay, toDay);
  const clientSalesIncome = sumSales(clientSales, fromDay, toDay);
  const directSalesIncome = walkinIncome + clientSalesIncome;

  const incomeSummary: IncomeRow[] = [
    { description: "रिपेयर आय (Repair Income)", amount: round2(repairIncome) },
    { description: "वॉक-इन बिक्री (Walk-in Sales)", amount: round2(walkinIncome) },
    { description: "ग्राहक बिक्री (Client Sales)", amount: round2(clientSalesIncome) },
    { description: "कुल सीधी बिक्री (Total Direct Sales)", amount: round2(directSalesIncome) },
  ];

  const expenseMap: Record<string, number> = {};
  expenses.forEach((e) => {
    if (!inRange(e.date_created, fromDay, toDay)) return;
    const key = e.category || "Uncategorized";
    expenseMap[key] = (expenseMap[key] || 0) + n(e.amount);
  });
  const expenseSummary: ExpenseRow[] = Object.entries(expenseMap)
    .map(([expense_category, amount]) => ({ expense_category, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);

  const salaryEarned = sumSalary(fromDay, toDay);
  const commissionExpense = sumCommission(fromDay, toDay);
  const shopExpense = sumExpenses(fromDay, toDay);
  const emiExpense = sumEmi(fromDay, toDay);
  const discountGiven = sumDiscount(fromDay, toDay);
  const totalIncome = repairIncome + directSalesIncome;
  const totalExpenses = salaryEarned + commissionExpense + shopExpense + emiExpense + discountGiven;
  const netProfit = totalIncome - totalExpenses;

  const prev = previousPeriod(fromDay, toDay);
  const previous: PeriodSummary | null = prev
    ? (() => {
        const prevIncome =
          sumRepair(prev.from, prev.to) +
          sumSales(walkinSales, prev.from, prev.to) +
          sumSales(clientSales, prev.from, prev.to);
        const prevExpenses =
          sumSalary(prev.from, prev.to) +
          sumCommission(prev.from, prev.to) +
          sumExpenses(prev.from, prev.to) +
          sumEmi(prev.from, prev.to) +
          sumDiscount(prev.from, prev.to);
        return {
          from: prev.from,
          to: prev.to,
          totalIncome: round2(prevIncome),
          totalExpenses: round2(prevExpenses),
          netProfit: round2(prevIncome - prevExpenses),
        };
      })()
    : null;

  // ═══════════════════════════════════════════════════════════════════════
  //  LENDER LOANS
  // ═══════════════════════════════════════════════════════════════════════
  const loanPrev: Record<number, number> = {};
  const loanPeriod: Record<number, number> = {};
  const loanAsOf: Record<number, number> = {};
  loanPayments.forEach((p) => {
    const lid = n(p.lender_id);
    if (!lid) return;
    const d = dayOf(p.payment_date);
    if (!d) return;
    if (d < fromDay) loanPrev[lid] = (loanPrev[lid] || 0) + n(p.amount_paid);
    if (d >= fromDay && d <= toDay) loanPeriod[lid] = (loanPeriod[lid] || 0) + n(p.amount_paid);
    if (d <= asOnDay) loanAsOf[lid] = (loanAsOf[lid] || 0) + n(p.amount_paid);
  });

  const loanLedger: LoanRow[] = lenders
    .filter((l) => l.start_date && dayOf(l.start_date) <= asOnDay)
    .map((l) => {
      const lid = Number(l.id);
      const loanAmount = n(l.loan_amount);
      const totalPaid = loanAsOf[lid] || 0;
      const balance = loanAmount - totalPaid;
      const emi = n(l.emi_amount);
      return {
        lender_id: lid,
        lender_name: l.fullname || "Lender",
        contact: l.contact || "",
        loan_amount: loanAmount,
        interest_rate: n(l.interest_rate),
        emi_amount: emi,
        start_date: dayOf(l.start_date),
        previous_payments: loanPrev[lid] || 0,
        paid_in_period: loanPeriod[lid] || 0,
        total_paid: totalPaid,
        balance_amount: balance,
        remaining_emis: emi > 0 ? Math.ceil(Math.max(0, balance) / emi) : 0,
        status: n(l.status) === 1 ? "सक्रिय" : n(l.status) === 2 ? "पूर्ण" : "अन्य",
      };
    })
    .filter((l) => l.total_paid > 0 || l.balance_amount !== 0);

  // ═══════════════════════════════════════════════════════════════════════
  //  CLIENT LOANS GIVEN (asset)
  // ═══════════════════════════════════════════════════════════════════════
  const clientNameById: Record<number, string> = {};
  clients.forEach((c) => {
    clientNameById[Number(c.id)] = fullName(c);
  });

  const loanPaidAsOf: Record<number, number> = {};
  const loanPaidPeriod: Record<number, number> = {};
  payments.forEach((p) => {
    if (isServicePayment(p.loan_id)) return;
    const lid = n(p.loan_id);
    if (!lid) return;
    const d = dayOf(p.payment_date);
    if (!d) return;
    const credit = n(p.amount) + n(p.discount);
    if (d <= asOnDay) loanPaidAsOf[lid] = (loanPaidAsOf[lid] || 0) + credit;
    if (d >= fromDay && d <= toDay) loanPaidPeriod[lid] = (loanPaidPeriod[lid] || 0) + credit;
  });

  const clientLoanLedger: ClientLoanRow[] = clientLoans
    .filter((l) => n(l.status) === 1 && onOrBefore(l.loan_date, asOnDay))
    .map((l) => {
      const lid = Number(l.id);
      const paid = loanPaidAsOf[lid] || 0;
      return {
        loan_id: lid,
        client_id: n(l.client_id),
        client_name: clientNameById[n(l.client_id)] || "Unknown",
        loan_date: dayOf(l.loan_date),
        principal_amount: n(l.principal_amount),
        total_payable: n(l.total_payable),
        emi_amount: n(l.emi_amount),
        paid,
        paid_in_period: loanPaidPeriod[lid] || 0,
        outstanding: Math.max(0, n(l.total_payable) - paid),
        status: n(l.status),
      };
    })
    .filter((l) => l.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  // ═══════════════════════════════════════════════════════════════════════
  //  CASH FLOW (estimated, as-on)
  // ═══════════════════════════════════════════════════════════════════════
  const cashInput: CashFlowInput = {
    servicePayments: payments.filter((p) => isServicePayment(p.loan_id)),
    clientLoanRepayments: payments.filter((p) => !isServicePayment(p.loan_id)),
    directSales: [...walkinSales, ...clientSales],
    lenderLoans: lenders,
    expenses,
    lenderPayments: loanPayments,
    mechanicAdvances: advances,
    clientLoansGiven: clientLoans,
    purchases: purchaseOrders,
    asOn: asOnDay,
  };
  const cashFlow = computeCashFlow(cashInput);

  const topCustomers: TopCustomerRow[] = customerLedger
    .filter((c) => c.total_repair_amount > 0 || Math.abs(c.current_balance) > 0)
    .sort((a, b) => b.total_repair_amount - a.total_repair_amount)
    .slice(0, 10)
    .map((c) => ({
      client_id: c.client_id,
      customer_name: c.customer_name,
      contact: c.contact,
      previous_jobs: c.previous_transactions,
      total_jobs: c.total_jobs,
      total_amount: c.total_repair_amount,
      total_payment_amount: c.total_payment,
      opening_balance: c.opening_balance,
      current_balance: c.current_balance,
    }));

  const totalStockValue = stockInventory.reduce((s, p) => s + p.stock_value, 0);
  const totalMechBalance = mechanicLedger.reduce((s, m) => s + m.balance_amount, 0);
  const totalLoanBalance = loanLedger.reduce((s, l) => s + l.balance_amount, 0);
  const clientLoansGiven = clientLoanLedger.reduce((s, l) => s + l.outstanding, 0);
  const clientLoanPrincipalGiven = clientLoans.reduce(
    (s, l) => (onOrBefore(l.loan_date, asOnDay) ? s + n(l.principal_amount) : s),
    0
  );
  const purchasePayments = purchaseOrders.reduce(
    (s, p) => (onOrBefore(p.received_date, asOnDay) ? s + n(p.total_amount) : s),
    0
  );

  return {
    period: { from: fromDay, to: toDay, asOn: asOnDay },
    customerLedger,
    mechanicLedger,
    stockInventory,
    incomeSummary,
    expenseSummary,
    loanLedger,
    clientLoanLedger,
    topCustomers,
    cashFlow,
    summary: {
      totalIncome: round2(totalIncome),
      totalExpenses: round2(totalExpenses),
      netProfit: round2(netProfit),
      totalStockValue: round2(totalStockValue),
      totalMechBalance: round2(totalMechBalance),
      totalLoanBalance: round2(totalLoanBalance),
      salaryEarned: round2(salaryEarned),
      commissionExpense: round2(commissionExpense),
      shopExpense: round2(shopExpense),
      emiExpense: round2(emiExpense),
      discountGiven: round2(discountGiven),
      repairIncome: round2(repairIncome),
      directSalesIncome: round2(directSalesIncome),
      cashReceived: round2(sumCashReceived(fromDay, toDay)),
      clientLoansGiven: round2(clientLoansGiven),
      clientLoanPrincipalGiven: round2(clientLoanPrincipalGiven),
      purchasePayments: round2(purchasePayments),
      cashBalance: cashFlow.balance,
      previous,
    },
  };
}
