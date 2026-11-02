/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { pageAll } from "@/lib/fetch-all";
import { todayIST } from "@/lib/dateUtils";

/**
 * `/reports/daily-income` (default = aaj) ka neutral server seed — client ke
 * supabase reads + totals/details ka exact read-only mirror.
 * Caller cookie+RLS client pass karta hai (service-role yahan kabhi nahi).
 */

type Row = Record<string, any>;
const pageAllRows = (q: any) => pageAll<Row>(q);

export type DailyIncomeTotals = {
  revenue_repair: number;
  revenue_sales: number;
  total_revenue: number;
  salary_earned: number;
  commission: number;
  discounts: number;
  expenses: number;
  loan_emi: number;
  total_business_expense: number;
  cash_payments: number;
  cash_spot_sales: number;
  total_cash_in: number;
  staff_advances: number;
  total_cash_out: number;
  net_cash_flow: number;
  net_profit: number;
};

export type DailyIncomeSeed = {
  from: string;
  to: string;
  data: DailyIncomeTotals;
  details: Record<string, Row[]>;
};

export async function fetchDailyIncomeSeed(
  supabase: SupabaseClient,
  from = todayIST(),
  to = todayIST()
): Promise<DailyIncomeSeed> {
  const start = `${from}T00:00:00+05:30`;
  const end = `${to}T23:59:59+05:30`;

  // 1. Repair jobs revenue (status 5, date_completed in range)
  const { data: repairs } = await pageAllRows(
    supabase
      .from("transaction_list")
      .select("job_id, item, client_name, mechanic_id, amount, date_completed")
      .eq("status", 5)
      .gte("date_completed", start)
      .lte("date_completed", end)
  );

  // 2. Direct sales (date_created in range)
  const { data: sales } = await pageAllRows(
    supabase
      .from("direct_sales")
      .select("id, sale_code, client_id, total_amount, payment_mode, remarks, date_created")
      .gte("date_created", start)
      .lte("date_created", end)
  );

  // 3. Attendance based salary earned
  const { data: attendance } = await pageAllRows(
    supabase
      .from("attendance_list")
      .select("mechanic_id, curr_date, status")
      .in("status", [1, 3])
      .gte("curr_date", from)
      .lte("curr_date", to)
  );
  const { data: mechanics } = await pageAllRows(
    supabase.from("mechanic_list").select("id, firstname, lastname, daily_salary")
  );
  const { data: salaryHistory } = await pageAllRows(
    supabase.from("mechanic_salary_history").select("mechanic_id, salary, effective_date")
  );

  // 4. Commission (status 5, date_completed in range)
  const { data: commRows } = await pageAllRows(
    supabase
      .from("transaction_list")
      .select("job_id, mechanic_id, amount, mechanic_commission_amount, date_completed")
      .eq("status", 5)
      .gte("date_completed", start)
      .lte("date_completed", end)
  );

  // 5. Discounts (client_payments, discount > 0, payment_date in range)
  const { data: discRows } = await pageAllRows(
    supabase
      .from("client_payments")
      .select("amount, discount, client_id, payment_date")
      .gt("discount", 0)
      .gte("payment_date", from)
      .lte("payment_date", to)
  );

  // 6. General expenses
  const { data: expenseRows } = await pageAllRows(
    supabase
      .from("expense_list")
      .select("id, amount, category, remarks, date_created")
      .gte("date_created", start)
      .lte("date_created", end)
  );

  // 7. Loan EMI paid to lenders
  const { data: loanRows } = await pageAllRows(
    supabase
      .from("loan_payments")
      .select("lender_id, amount_paid, payment_date, remarks")
      .gte("payment_date", from)
      .lte("payment_date", to)
  );

  // 8. Client payments (all, cash inflow)
  const { data: payRows } = await pageAllRows(
    supabase
      .from("client_payments")
      .select("client_id, amount, payment_mode, remarks, payment_date")
      .gte("payment_date", from)
      .lte("payment_date", to)
  );

  // 9. Staff advances
  const { data: advRows } = await pageAllRows(
    supabase
      .from("advance_payments")
      .select("mechanic_id, amount, reason, date_paid")
      .gte("date_paid", from)
      .lte("date_paid", to)
  );

  // Meta lookups
  const { data: clients } = await pageAllRows(
    supabase.from("client_list").select("id, firstname, middlename, lastname")
  );
  const { data: lenders } = await pageAllRows(supabase.from("lender_list").select("id, fullname"));

  const clientName = (id: number | string) => {
    const c = (clients || []).find((x) => x.id === id);
    return c ? [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ") : "Walk-in";
  };
  const mechName = (id: number | string) => {
    const m = (mechanics || []).find((x) => x.id === id);
    return m ? `${m.firstname} ${m.lastname}`.trim() : "Unknown";
  };
  const lenderName = (id: number | string) => {
    const l = (lenders || []).find((x) => x.id === id);
    return l ? l.fullname : "Unknown Lender";
  };

  // Salary earned (mirror PHP: rate from history <= curr_date, half day = rate/2)
  const histByMech: Record<number, Row[]> = {};
  (salaryHistory || []).forEach((h) => {
    (histByMech[h.mechanic_id] = histByMech[h.mechanic_id] || []).push(h);
  });
  Object.values(histByMech).forEach((list) =>
    list.sort((a, b) => a.effective_date.localeCompare(b.effective_date))
  );

  let salary_earned = 0;
  const salary_detail: Row[] = [];
  (attendance || []).forEach((a) => {
    const m = (mechanics || []).find((x) => x.id === a.mechanic_id);
    const history = (histByMech[a.mechanic_id] || []).filter(
      (h) => h.effective_date <= a.curr_date
    );
    const rate = history.length > 0 ? history[history.length - 1].salary : m?.daily_salary || 0;
    const earned = a.status === 3 ? rate / 2 : rate;
    salary_earned += earned;
    salary_detail.push({
      curr_date: a.curr_date,
      name: mechName(a.mechanic_id),
      status: a.status,
      rate,
      earned,
    });
  });

  const revenue_repair = (repairs || []).reduce((s, r) => s + (r.amount || 0), 0);
  const revenue_sales = (sales || []).reduce((s, r) => s + (r.total_amount || 0), 0);
  const commission = (commRows || []).reduce((s, r) => s + (r.mechanic_commission_amount || 0), 0);
  const discounts = (discRows || []).reduce((s, r) => s + (r.discount || 0), 0);
  const expenses = (expenseRows || []).reduce((s, r) => s + (r.amount || 0), 0);
  const loan_emi = (loanRows || []).reduce((s, r) => s + (r.amount_paid || 0), 0);
  const cash_payments = (payRows || []).reduce((s, r) => s + (r.amount || 0), 0);
  const spotSales = (sales || []).filter(
    (s) => s.client_id == null || s.client_id === 0 || s.client_id === ""
  );
  const cash_spot_sales = spotSales.reduce((s, r) => s + (r.total_amount || 0), 0);
  const staff_advances = (advRows || []).reduce((s, r) => s + (r.amount || 0), 0);

  const total_revenue = revenue_repair + revenue_sales;
  const total_business_expense = salary_earned + commission + discounts + expenses + loan_emi;
  const total_cash_in = cash_payments + cash_spot_sales;
  const total_cash_out = staff_advances + expenses + loan_emi;
  const net_cash_flow = total_cash_in - total_cash_out;
  const net_profit = total_revenue - total_business_expense;

  const data: DailyIncomeTotals = {
    revenue_repair,
    revenue_sales,
    total_revenue,
    salary_earned,
    commission,
    discounts,
    expenses,
    loan_emi,
    total_business_expense,
    cash_payments,
    cash_spot_sales,
    total_cash_in,
    staff_advances,
    total_cash_out,
    net_cash_flow,
    net_profit,
  };

  const details: Record<string, Row[]> = {
    repairs: (repairs || []).map((r) => ({
      ...r,
      client_name: clientName(r.client_name),
      mechanic_name: mechName(r.mechanic_id),
    })),
    sales: (sales || []).map((r) => ({
      ...r,
      client_name:
        r.client_id == null || r.client_id === 0 || r.client_id === ""
          ? "Walk-in"
          : clientName(r.client_id),
    })),
    salary: salary_detail,
    commission: (commRows || []).map((r) => ({ ...r, mechanic_name: mechName(r.mechanic_id) })),
    discounts: (discRows || []).map((r) => ({ ...r, client_name: clientName(r.client_id) })),
    expenses: expenseRows || [],
    loan: (loanRows || []).map((r) => ({ ...r, lender_name: lenderName(r.lender_id) })),
    payments: (payRows || []).map((r) => ({ ...r, client_name: clientName(r.client_id) })),
    spot: spotSales.map((r) => ({ ...r, client_name: "Walk-in" })),
    advances: (advRows || []).map((r) => ({ ...r, staff_name: mechName(r.mechanic_id) })),
  };

  return { from, to, data, details };
}
