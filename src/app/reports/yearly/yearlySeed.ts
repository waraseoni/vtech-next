import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/fetch-all";
import { todayIST } from "@/lib/dateUtils";

/**
 * `/reports/yearly` (current year) ka neutral server seed — client ke 8
 * fetchList queries + monthly aggregation ka read-only mirror.
 * Caller cookie+RLS client pass karta hai (service-role NEVER).
 */

export type YearlyMonthData = {
  month: string;
  repair: number;
  walkin: number;
  clientSales: number;
  revenue: number;
  salary: number;
  commission: number;
  expenses: number;
  emi: number;
  discount: number;
  totalExp: number;
  profit: number;
  margin: number;
};

export type YearlySeed = { year: number; monthly: YearlyMonthData[] };

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const istMonth = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(iso));

type JobRow = {
  id: number;
  amount: number | string | null;
  mechanic_commission_amount: number | string | null;
  date_completed: string | null;
};
type SaleRow = {
  id: number;
  client_id: number | string | null;
  total_amount: number | string | null;
  date_created: string | null;
};
type PaymentRow = { id: number; discount: number | string | null; created_at: string | null };
type ExpenseRow = { amount: number | string | null; date_created: string | null };
type LoanPaymentRow = { amount_paid: number | string | null; payment_date: string | null };
type AttendanceRow = { mechanic_id: number; curr_date: string; status: number };
type MechanicRow = { id: number; daily_salary: number | string | null };
type SalaryHistoryRow = {
  mechanic_id: number;
  salary: number | string | null;
  effective_date: string;
};

export async function fetchYearlySeed(
  supabase: SupabaseClient,
  year = parseInt(todayIST().slice(0, 4))
): Promise<YearlySeed> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const endTz = `${year}-12-31T23:59:59+05:30`;

  const [jobs, sales, payments, expenseList, loanPayments, attendance, mechanics, salaryHistory] =
    await Promise.all([
      fetchAll<JobRow>(
        supabase
          .from("transaction_list")
          .select("id, amount, mechanic_commission_amount, date_completed")
          .eq("status", 5)
          .gte("date_completed", start)
          .lte("date_completed", endTz)
      ),
      fetchAll<SaleRow>(
        supabase
          .from("direct_sales")
          .select("id, client_id, total_amount, date_created")
          .gte("date_created", start)
          .lte("date_created", end)
      ),
      fetchAll<PaymentRow>(
        supabase
          .from("client_payments")
          .select("id, discount, created_at")
          .gte("created_at", start)
          .lte("created_at", end)
      ),
      fetchAll<ExpenseRow>(
        supabase
          .from("expense_list")
          .select("amount, date_created")
          .gte("date_created", start)
          .lte("date_created", end)
      ),
      fetchAll<LoanPaymentRow>(
        supabase
          .from("loan_payments")
          .select("amount_paid, payment_date")
          .gte("payment_date", start)
          .lte("payment_date", end)
      ),
      fetchAll<AttendanceRow>(
        supabase
          .from("attendance_list")
          .select("mechanic_id, curr_date, status")
          .in("status", [1, 3])
          .gte("curr_date", start)
          .lte("curr_date", end)
      ),
      fetchAll<MechanicRow>(
        supabase.from("mechanic_list").select("id, daily_salary").eq("status", 1)
      ),
      fetchAll<SalaryHistoryRow>(
        supabase
          .from("mechanic_salary_history")
          .select("mechanic_id, salary, effective_date")
          .order("effective_date", { ascending: false })
      ),
    ]);

  const getRate = (mechId: number, dateStr: string, defaultRate: number) => {
    const hist = (salaryHistory || []).find(
      (h) => h.mechanic_id === mechId && h.effective_date <= dateStr
    );
    return hist ? Number(hist.salary) : defaultRate;
  };

  const monthly: YearlyMonthData[] = MONTHS.map((mName, idx) => {
    const mStr = String(idx + 1).padStart(2, "0");
    const prefix = `${year}-${mStr}`;

    const mJobs = (jobs || []).filter(
      (t) => t.date_completed && istMonth(t.date_completed) === prefix
    );
    const repair = mJobs.reduce((s, t) => s + (parseFloat(String(t.amount)) || 0), 0);
    const commission = mJobs.reduce(
      (s, t) => s + (parseFloat(String(t.mechanic_commission_amount)) || 0),
      0
    );

    const mSales = (sales || []).filter((d) => String(d.date_created).startsWith(prefix));
    const walkin = mSales
      .filter((d) => !d.client_id || d.client_id === 0 || d.client_id === "")
      .reduce((s, d) => s + (parseFloat(String(d.total_amount)) || 0), 0);
    const clientSales = mSales
      .filter((d) => d.client_id && d.client_id !== 0 && d.client_id !== "")
      .reduce((s, d) => s + (parseFloat(String(d.total_amount)) || 0), 0);

    const discount = (payments || [])
      .filter((p) => String(p.created_at).startsWith(prefix))
      .reduce((s, p) => s + (parseFloat(String(p.discount)) || 0), 0);

    const expenses = (expenseList || [])
      .filter((e) => String(e.date_created).startsWith(prefix))
      .reduce((s, e) => s + (parseFloat(String(e.amount)) || 0), 0);

    const emi = (loanPayments || [])
      .filter((lp) => String(lp.payment_date).startsWith(prefix))
      .reduce((s, lp) => s + (parseFloat(String(lp.amount_paid)) || 0), 0);

    let salary = 0;
    (attendance || [])
      .filter((a) => String(a.curr_date).startsWith(prefix))
      .forEach((a) => {
        const mech = (mechanics || []).find((me) => me.id === a.mechanic_id);
        const rate = getRate(a.mechanic_id, a.curr_date, Number(mech?.daily_salary) || 0);
        salary += a.status === 3 ? rate / 2 : rate;
      });

    const revenue = repair + walkin + clientSales;
    const totalExp = salary + commission + expenses + emi + discount;
    const profit = revenue - totalExp;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      month: mName,
      repair,
      walkin,
      clientSales,
      revenue,
      salary,
      commission,
      expenses,
      emi,
      discount,
      totalExp,
      profit,
      margin,
    };
  });

  return { year, monthly };
}
