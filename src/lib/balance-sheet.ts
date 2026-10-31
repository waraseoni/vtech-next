/**
 * Balance sheet (chittha) grouping — pure functions, no DB.
 *
 * Sign conventions (API se):
 *   customerLedger.current_balance  +ve = ग्राहक उधार (asset), −ve = ग्राहक अग्रिम (liability)
 *   mechanicLedger.balance_amount   +ve = स्टाफ बकाया (liability), −ve = स्टाफ अग्रिम (asset)
 *   loanLedger.balance_amount       +ve = लेंडर लोन बकाया (liability), −ve = लेंडर अग्रिम (asset)
 *   cashFlow.balance                +ve = नकद/बैंक (asset), −ve = ओवरड्राफ्ट (liability)
 */

export type DetailTab =
  | "customer"
  | "mechanic"
  | "inventory"
  | "income"
  | "expense"
  | "top_customers"
  | "loan"
  | "client_loan"
  | "cash";

export type StatementRow = {
  key: string;
  label: string;
  amount: number;
  count: number;
  tab: DetailTab;
};

export type BalanceSheetInput = {
  customers: ReadonlyArray<{ current_balance: number }>;
  mechanics: ReadonlyArray<{ balance_amount: number }>;
  loans: ReadonlyArray<{ balance_amount: number }>;
  stock: ReadonlyArray<{ stock_value: number }>;
  /** Estimated cash/bank position as on date; negative means overdraft. */
  cash?: number;
  /** Outstanding client loans (money given, abhi tak wapas nahi aaya). */
  clientLoans?: ReadonlyArray<{ outstanding: number }>;
};

export type BalanceSheetStatement = {
  assets: StatementRow[];
  liabilities: StatementRow[];
  totalAssets: number;
  totalLiabilities: number;
  capital: number;
};

export type CashFlowItem = { key: string; label: string; amount: number };

export type CashFlow = {
  inflow: CashFlowItem[];
  outflow: CashFlowItem[];
  totalInflow: number;
  totalOutflow: number;
  balance: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : Number.isFinite(Number(v)) ? Number(v) : 0;

const dayOf = (v: unknown): string =>
  typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : "";

function splitBySign(rows: ReadonlyArray<{ value: number }>) {
  let positive = 0;
  let positiveCount = 0;
  let negative = 0;
  let negativeCount = 0;
  for (const r of rows) {
    const v = num(r.value);
    if (v > 0) {
      positive += v;
      positiveCount++;
    } else if (v < 0) {
      negative += -v;
      negativeCount++;
    }
  }
  return { positive, positiveCount, negative, negativeCount };
}

export function buildBalanceSheet(input: BalanceSheetInput): BalanceSheetStatement {
  const stockValue = input.stock.reduce((s, r) => s + Math.max(0, num(r.stock_value)), 0);
  const stockCount = input.stock.length;

  const customers = splitBySign(input.customers.map((c) => ({ value: c.current_balance })));
  const mechanics = splitBySign(input.mechanics.map((m) => ({ value: m.balance_amount })));
  const loans = splitBySign(input.loans.map((l) => ({ value: l.balance_amount })));
  const clientLoans = splitBySign((input.clientLoans || []).map((l) => ({ value: l.outstanding })));
  const cash = num(input.cash);

  const assets: StatementRow[] = [];
  if (cash >= 0) {
    assets.push({
      key: "cash",
      label: "नकद/बैंक (अनुमानित)",
      amount: round2(cash),
      count: 0,
      tab: "cash",
    });
  }
  assets.push(
    {
      key: "stock",
      label: "स्टॉक (माल)",
      amount: round2(stockValue),
      count: stockCount,
      tab: "inventory",
    },
    {
      key: "receivable",
      label: "ग्राहक उधार",
      amount: round2(customers.positive),
      count: customers.positiveCount,
      tab: "customer",
    }
  );
  if (clientLoans.positive > 0) {
    assets.push({
      key: "client_loan",
      label: "क्लाइंट लोन बकाया",
      amount: round2(clientLoans.positive),
      count: clientLoans.positiveCount,
      tab: "client_loan",
    });
  }
  if (mechanics.negative > 0) {
    assets.push({
      key: "staff_advance",
      label: "स्टाफ अग्रिम",
      amount: round2(mechanics.negative),
      count: mechanics.negativeCount,
      tab: "mechanic",
    });
  }
  if (loans.negative > 0) {
    assets.push({
      key: "lender_advance",
      label: "लेंडर को अग्रिम",
      amount: round2(loans.negative),
      count: loans.negativeCount,
      tab: "loan",
    });
  }

  const liabilities: StatementRow[] = [];
  if (cash < 0) {
    liabilities.push({
      key: "cash_overdraft",
      label: "नकद ओवरड्राफ्ट (अनुमानित)",
      amount: round2(-cash),
      count: 0,
      tab: "cash",
    });
  }
  if (customers.negative > 0) {
    liabilities.push({
      key: "client_advance",
      label: "ग्राहक अग्रिम",
      amount: round2(customers.negative),
      count: customers.negativeCount,
      tab: "customer",
    });
  }
  liabilities.push(
    {
      key: "staff_payable",
      label: "स्टाफ बकाया",
      amount: round2(mechanics.positive),
      count: mechanics.positiveCount,
      tab: "mechanic",
    },
    {
      key: "lender_loan",
      label: "लेंडर लोन बकाया",
      amount: round2(loans.positive),
      count: loans.positiveCount,
      tab: "loan",
    }
  );

  const totalAssets = round2(assets.reduce((s, r) => s + r.amount, 0));
  const totalLiabilities = round2(liabilities.reduce((s, r) => s + r.amount, 0));

  return {
    assets,
    liabilities,
    totalAssets,
    totalLiabilities,
    capital: round2(totalAssets - totalLiabilities),
  };
}

const DAY_MS = 86_400_000;

/** Previous comparison window — calendar month/year jab range poora ho, warna same length. */
export function previousPeriod(
  fromDay: string,
  toDay: string
): { from: string; to: string } | null {
  const from = new Date(`${fromDay}T00:00:00Z`);
  const to = new Date(`${toDay}T00:00:00Z`);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to < from) return null;
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const isYear =
    from.getUTCMonth() === 0 &&
    from.getUTCDate() === 1 &&
    to.getUTCMonth() === 11 &&
    to.getUTCDate() === 31;

  const nextDay = new Date(to.getTime() + DAY_MS);
  const isMonth = from.getUTCDate() === 1 && nextDay.getUTCDate() === 1;

  if (isYear) {
    return { from: `${from.getUTCFullYear() - 1}-01-01`, to: `${from.getUTCFullYear() - 1}-12-31` };
  }
  if (isMonth) {
    const prevEnd = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 0));
    const prevStart = new Date(Date.UTC(prevEnd.getUTCFullYear(), prevEnd.getUTCMonth(), 1));
    return { from: iso(prevStart), to: iso(prevEnd) };
  }

  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
  const prevTo = new Date(from.getTime() - DAY_MS);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * DAY_MS);
  return { from: iso(prevFrom), to: iso(prevTo) };
}

function sumAsOf<T>(
  rows: ReadonlyArray<T>,
  amount: (r: T) => number,
  date: (r: T) => unknown,
  asOn: string
): number {
  let total = 0;
  for (const r of rows) {
    const d = dayOf(date(r));
    if (d && d <= asOn) total += num(amount(r));
  }
  return total;
}

export type CashFlowInput = {
  servicePayments: ReadonlyArray<{ amount?: unknown; payment_date?: unknown }>;
  clientLoanRepayments: ReadonlyArray<{ amount?: unknown; payment_date?: unknown }>;
  directSales: ReadonlyArray<{ total_amount?: unknown; date_created?: unknown }>;
  lenderLoans: ReadonlyArray<{ loan_amount?: unknown; start_date?: unknown }>;
  expenses: ReadonlyArray<{ amount?: unknown; date_created?: unknown }>;
  lenderPayments: ReadonlyArray<{ amount_paid?: unknown; payment_date?: unknown }>;
  mechanicAdvances: ReadonlyArray<{ amount?: unknown; date_paid?: unknown }>;
  clientLoansGiven: ReadonlyArray<{ principal_amount?: unknown; loan_date?: unknown }>;
  purchases: ReadonlyArray<{ total_amount?: unknown; received_date?: unknown }>;
  asOn: string;
};

/**
 * Estimated cash/bank position — cumulative inflows minus outflows till `asOn`.
 * Owner capital/drawings aur paid-purchase records missing hain, isliye
 * "estimated" label ke bina ise final cash mat samjho.
 */
export function computeCashFlow(input: CashFlowInput): CashFlow {
  const inflow: CashFlowItem[] = [
    {
      key: "service_payments",
      label: "ग्राहक भुगतान (सेवा)",
      amount: sumAsOf(
        input.servicePayments,
        (r) => num(r.amount),
        (r) => r.payment_date,
        input.asOn
      ),
    },
    {
      key: "loan_repayments",
      label: "क्लाइंट लोन किस्त",
      amount: sumAsOf(
        input.clientLoanRepayments,
        (r) => num(r.amount),
        (r) => r.payment_date,
        input.asOn
      ),
    },
    {
      key: "direct_sales",
      label: "सीधी बिक्री",
      amount: sumAsOf(
        input.directSales,
        (r) => num(r.total_amount),
        (r) => r.date_created,
        input.asOn
      ),
    },
    {
      key: "lender_loans",
      label: "लेंडर से लोन",
      amount: sumAsOf(
        input.lenderLoans,
        (r) => num(r.loan_amount),
        (r) => r.start_date,
        input.asOn
      ),
    },
  ];

  const outflow: CashFlowItem[] = [
    {
      key: "shop_expenses",
      label: "दुकान खर्च",
      amount: sumAsOf(
        input.expenses,
        (r) => num(r.amount),
        (r) => r.date_created,
        input.asOn
      ),
    },
    {
      key: "lender_payments",
      label: "लेंडर लोन भुगतान",
      amount: sumAsOf(
        input.lenderPayments,
        (r) => num(r.amount_paid),
        (r) => r.payment_date,
        input.asOn
      ),
    },
    {
      key: "mechanic_advances",
      label: "मैकेनिक अग्रिम",
      amount: sumAsOf(
        input.mechanicAdvances,
        (r) => num(r.amount),
        (r) => r.date_paid,
        input.asOn
      ),
    },
    {
      key: "client_loans",
      label: "क्लाइंट लोन दिए",
      amount: sumAsOf(
        input.clientLoansGiven,
        (r) => num(r.principal_amount),
        (r) => r.loan_date,
        input.asOn
      ),
    },
    {
      key: "purchases",
      label: "खरीद (received PO)",
      amount: sumAsOf(
        input.purchases,
        (r) => num(r.total_amount),
        (r) => r.received_date,
        input.asOn
      ),
    },
  ];

  const totalInflow = round2(inflow.reduce((s, r) => s + r.amount, 0));
  const totalOutflow = round2(outflow.reduce((s, r) => s + r.amount, 0));
  return {
    inflow,
    outflow,
    totalInflow,
    totalOutflow,
    balance: round2(totalInflow - totalOutflow),
  };
}
