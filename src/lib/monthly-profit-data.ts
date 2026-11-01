/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Monthly profit computation — single source of truth for
 * `/reports/monthly-profit` ka server first paint.
 *
 * Bucketing single-pass hai (O(N), loop me koi Intl.DateTimeFormat nahi) —
 * pehle 12 months × N rows filter karne se TBT regress hua tha (GATE-C).
 */

import { eachMonthOfInterval } from "date-fns/eachMonthOfInterval";
import { format } from "date-fns/format";
import { pageAll } from "./fetch-all";

type SupabaseLike = { from: (table: string) => any };
export type DbRow = Record<string, any>;

export type MonthlyData = {
  month: string;
  monthNum: number;
  repair: number;
  walkin: number;
  clientSales: number;
  revenue: number;
  commission: number;
  expenses: number;
  salaries: number;
  emi: number;
  discounts: number;
  totalExp: number;
  profit: number;
  margin: number;
};

export type MonthlyRawData = Record<string, DbRow[]>;

export type MonthlyProfitPayload = {
  data: MonthlyData[];
  rawData: MonthlyRawData;
};

const pageAllRows = (q: any) => pageAll<DbRow>(q);

const IST_MONTH_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
});
const istMonth = (iso: string) => IST_MONTH_FMT.format(new Date(iso));

export async function fetchMonthlyProfitData(
  supabase: SupabaseLike,
  year: number
): Promise<MonthlyProfitPayload> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const endTz = `${year}-12-31T23:59:59+05:30`;

  const [
    { data: transactions },
    { data: directSales },
    { data: clientPayments },
    { data: expenses },
    { data: loanPayments },
    { data: attendance },
    { data: mechanics },
    { data: clients },
    { data: lenders },
  ] = await Promise.all([
    pageAllRows(
      supabase
        .from("transaction_list")
        .select("id, code, client_name, amount, mechanic_commission_amount, date_completed")
        .eq("status", 5)
        .gte("date_completed", start)
        .lte("date_completed", endTz)
    ),
    pageAllRows(
      supabase
        .from("direct_sales")
        .select("id, sale_code, client_id, total_amount, date_created")
        .gte("date_created", start)
        .lte("date_created", end)
    ),
    pageAllRows(
      supabase
        .from("client_payments")
        .select("id, client_id, amount, discount, remarks, created_at")
        .gte("created_at", start)
        .lte("created_at", end)
    ),
    pageAllRows(
      supabase
        .from("expense_list")
        .select("id, amount, date_created, category, remarks")
        .gte("date_created", start)
        .lte("date_created", end)
    ),
    pageAllRows(
      supabase
        .from("loan_payments")
        .select("id, lender_id, amount_paid, payment_date, remarks")
        .gte("payment_date", start)
        .lte("payment_date", end)
    ),
    pageAllRows(
      supabase
        .from("attendance_list")
        .select("mechanic_id, curr_date, status")
        .gte("curr_date", start)
        .lte("curr_date", end)
    ),
    pageAllRows(
      supabase.from("mechanic_list").select("id, firstname, middlename, lastname, daily_salary")
    ),
    pageAllRows(supabase.from("client_list").select("id, firstname, middlename, lastname")),
    pageAllRows(supabase.from("lender_list").select("id, fullname")),
  ]);

  const months = eachMonthOfInterval({
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31),
  });

  type Buckets = {
    jobs: DbRow[];
    sales: DbRow[];
    pays: DbRow[];
    exps: DbRow[];
    emis: DbRow[];
    atts: DbRow[];
  };
  const buckets: Buckets[] = Array.from({ length: 12 }, () => ({
    jobs: [],
    sales: [],
    pays: [],
    exps: [],
    emis: [],
    atts: [],
  }));
  const bucketByDate = (rows: DbRow[] | null, dateField: string, key: keyof Buckets) => {
    for (const row of rows || []) {
      const m = Number(String(row[dateField]).slice(5, 7)) - 1;
      if (m >= 0 && m < 12) buckets[m][key].push(row);
    }
  };
  // transactions: IST month (date_completed); baaki: raw ISO prefix
  // (startsWith semantics preserved — same-year data query se guaranteed)
  for (const t of transactions || []) {
    const m = Number(istMonth(t.date_completed).slice(5, 7)) - 1;
    if (m >= 0 && m < 12) buckets[m].jobs.push(t);
  }
  bucketByDate(directSales, "date_created", "sales");
  bucketByDate(clientPayments, "created_at", "pays");
  bucketByDate(expenses, "date_created", "exps");
  bucketByDate(loanPayments, "payment_date", "emis");
  bucketByDate(attendance, "curr_date", "atts");
  const mechanicsById = new Map((mechanics || []).map((me) => [me.id, me]));

  const data: MonthlyData[] = months.map((mDate, idx) => {
    const mNum = idx + 1;
    const mName = format(mDate, "MMMM");
    const b = buckets[idx];

    const repair = b.jobs.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const commission = b.jobs.reduce(
      (s, t) => s + (parseFloat(t.mechanic_commission_amount) || 0),
      0
    );

    let walkin = 0;
    let clientSales = 0;
    for (const d of b.sales) {
      const amt = parseFloat(d.total_amount) || 0;
      if (!d.client_id || d.client_id === 0 || d.client_id === "") walkin += amt;
      else clientSales += amt;
    }

    const discounts = b.pays.reduce((s, p) => s + (parseFloat(p.discount) || 0), 0);
    const mExpenses = b.exps.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const emi = b.emis.reduce((s, lp) => s + (parseFloat(lp.amount_paid) || 0), 0);

    let salaries = 0;
    for (const att of b.atts) {
      const rate = mechanicsById.get(att.mechanic_id)?.daily_salary || 0;
      if (att.status === 1) salaries += rate;
      else if (att.status === 3) salaries += rate / 2;
    }

    const revenue = repair + walkin + clientSales;
    const totalExp = commission + mExpenses + salaries + emi + discounts;
    const profit = revenue - totalExp;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      month: mName,
      monthNum: mNum,
      repair,
      walkin,
      clientSales,
      revenue,
      commission,
      expenses: mExpenses,
      salaries,
      emi,
      discounts,
      totalExp,
      profit,
      margin,
    };
  });

  return {
    data,
    rawData: {
      transactions,
      directSales,
      clientPayments,
      expenses,
      loanPayments,
      attendance,
      mechanics,
      clients,
      lenders,
    },
  };
}
