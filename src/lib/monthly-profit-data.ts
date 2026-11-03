/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Monthly profit computation — single source of truth for
 * `/reports/monthly-profit` ka server first paint.
 *
 * Bucketing single-pass hai (O(N), loop me koi Intl.DateTimeFormat nahi) —
 * pehle 12 months × N rows filter karne se TBT regress hua tha (GATE-C).
 *
 * PAYLOAD SPLIT (3 Nov 2026): RSC first paint sirf 12 monthly buckets bhejta
 * hai. Raw rows (transactions/attendance/etc.) modal drill-down ke liye
 * `fetchMonthlyProfitRawData` se on-demand aate hain — pehle poora saal ka raw
 * data har page load ke HTML payload me chala jata tha.
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
};

export type MonthlyProfitRows = {
  transactions: DbRow[];
  directSales: DbRow[];
  clientPayments: DbRow[];
  expenses: DbRow[];
  loanPayments: DbRow[];
  attendance: DbRow[];
  mechanics: DbRow[];
  clients: DbRow[];
  lenders: DbRow[];
};

export type MonthlyDetailType =
  | "repair_jobs"
  | "commission"
  | "walkin_sales"
  | "client_sales"
  | "expenses"
  | "salaries"
  | "emi"
  | "discounts";

const pageAllRows = (q: any) => pageAll<DbRow>(q);

const IST_MONTH_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
});
const istMonth = (iso: string) => IST_MONTH_FMT.format(new Date(iso));

/** Saal ka poora raw data ek saath fetch karta hai (server + on-demand client). */
export async function fetchMonthlyProfitRows(
  supabase: SupabaseLike,
  year: number
): Promise<MonthlyProfitRows> {
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

  return {
    transactions: transactions || [],
    directSales: directSales || [],
    clientPayments: clientPayments || [],
    expenses: expenses || [],
    loanPayments: loanPayments || [],
    attendance: attendance || [],
    mechanics: mechanics || [],
    clients: clients || [],
    lenders: lenders || [],
  };
}

/** Pure aggregation — rows in, 12 monthly buckets out. */
export function computeMonthlyProfit(rows: MonthlyProfitRows, year: number): MonthlyData[] {
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
  const bucketByDate = (list: DbRow[], dateField: string, key: keyof Buckets) => {
    for (const row of list) {
      const m = Number(String(row[dateField]).slice(5, 7)) - 1;
      if (m >= 0 && m < 12) buckets[m][key].push(row);
    }
  };
  // transactions: IST month (date_completed); baaki: raw ISO prefix
  // (startsWith semantics preserved — same-year data query se guaranteed)
  for (const t of rows.transactions) {
    const m = Number(istMonth(t.date_completed).slice(5, 7)) - 1;
    if (m >= 0 && m < 12) buckets[m].jobs.push(t);
  }
  bucketByDate(rows.directSales, "date_created", "sales");
  bucketByDate(rows.clientPayments, "created_at", "pays");
  bucketByDate(rows.expenses, "date_created", "exps");
  bucketByDate(rows.loanPayments, "payment_date", "emis");
  bucketByDate(rows.attendance, "curr_date", "atts");
  const mechanicsById = new Map(rows.mechanics.map((me) => [me.id, me]));

  return months.map((mDate, idx) => {
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
}

/** Server first paint / year change — sirf monthly buckets (raw rows nahi). */
export async function fetchMonthlyProfitData(
  supabase: SupabaseLike,
  year: number
): Promise<MonthlyProfitPayload> {
  const rows = await fetchMonthlyProfitRows(supabase, year);
  return { data: computeMonthlyProfit(rows, year) };
}

/** Modal drill-down ke liye on-demand raw rows. */
export async function fetchMonthlyProfitRawData(
  supabase: SupabaseLike,
  year: number
): Promise<MonthlyRawData> {
  return { ...(await fetchMonthlyProfitRows(supabase, year)) };
}

const DETAIL_TITLES: Record<MonthlyDetailType, string> = {
  repair_jobs: "Repair Jobs (Delivered)",
  commission: "Mechanic Commission",
  walkin_sales: "Walk-in Direct Sales",
  client_sales: "Client Direct Sales",
  expenses: "Shop Expenses",
  salaries: "Staff Salaries",
  emi: "Loan EMI Payments",
  discounts: "Customer Discounts",
};

export const monthlyDetailTitle = (type: MonthlyDetailType, monthName: string, year: number) =>
  `${DETAIL_TITLES[type]} - ${monthName} ${year}`;

/** Pure modal-row builder — pehle MonthlyProfitBody me inline tha. */
export function buildMonthlyDetailRows(
  rawData: MonthlyRawData,
  type: MonthlyDetailType,
  year: number,
  monthNum: number
): DbRow[] {
  const prefix = `${year}-${monthNum.toString().padStart(2, "0")}`;

  // O(1) lookups — per-row .find O(R×C) tha (click pe thousands rows freeze)
  const clientsById = new Map((rawData.clients || []).map((c) => [c.id, c]));
  const mechanicsById = new Map((rawData.mechanics || []).map((m) => [m.id, m]));
  const lendersById = new Map((rawData.lenders || []).map((l) => [l.id, l]));
  const clientNameOf = (id: unknown, fallback: string) => {
    const c = clientsById.get(id as number);
    return c
      ? `${c.firstname} ${c.middlename || ""} ${c.lastname || ""}`.replace(/\s+/g, " ").trim()
      : fallback;
  };

  switch (type) {
    case "repair_jobs":
      return (rawData.transactions || [])
        .filter((t) => istMonth(t.date_completed) === prefix)
        .map((t) => ({
          ...t,
          client_name: clientNameOf(t.client_name, "Walk-in"),
        }));
    case "commission":
      return (rawData.transactions || [])
        .filter(
          (t) =>
            istMonth(t.date_completed) === prefix && parseFloat(t.mechanic_commission_amount) > 0
        )
        .map((t) => ({
          ...t,
          client_name: clientNameOf(t.client_name, "Walk-in"),
        }));
    case "walkin_sales":
      return (rawData.directSales || []).filter(
        (d) =>
          String(d.date_created).startsWith(prefix) &&
          (!d.client_id || d.client_id === 0 || d.client_id === "")
      );
    case "client_sales":
      return (rawData.directSales || [])
        .filter(
          (d) =>
            String(d.date_created).startsWith(prefix) &&
            d.client_id &&
            d.client_id !== 0 &&
            d.client_id !== ""
        )
        .map((d) => ({
          ...d,
          client_name: clientNameOf(d.client_id, "Unknown Client"),
        }));
    case "expenses":
      return (rawData.expenses || []).filter((e) => String(e.date_created).startsWith(prefix));
    case "salaries": {
      const mAtt = (rawData.attendance || []).filter((a) => String(a.curr_date).startsWith(prefix));
      const mechMap: Record<number, { name: string; full: number; half: number; rate: number }> =
        {};
      mAtt.forEach((att) => {
        const mech = mechanicsById.get(att.mechanic_id);
        if (!mech) return;
        if (!mechMap[mech.id]) {
          mechMap[mech.id] = {
            name:
              [mech.firstname, mech.middlename, mech.lastname].filter(Boolean).join(" ") ||
              `Mechanic #${mech.id}`,
            full: 0,
            half: 0,
            rate: mech.daily_salary || 0,
          };
        }
        if (att.status === 1) mechMap[mech.id].full += 1;
        else if (att.status === 3) mechMap[mech.id].half += 1;
      });
      return Object.values(mechMap).filter((m) => m.full > 0 || m.half > 0);
    }
    case "emi":
      return (rawData.loanPayments || [])
        .filter((lp) => String(lp.payment_date).startsWith(prefix))
        .map((lp) => ({
          ...lp,
          lender_name: lendersById.get(lp.lender_id)?.fullname || "Unknown Lender",
        }));
    case "discounts":
      return (rawData.clientPayments || [])
        .filter((cp) => String(cp.created_at).startsWith(prefix) && parseFloat(cp.discount) > 0)
        .map((cp) => ({
          ...cp,
          client_name: clientNameOf(cp.client_id, "Unknown Client"),
        }));
  }
}
