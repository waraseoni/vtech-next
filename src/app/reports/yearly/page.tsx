"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2, Printer, ChevronLeft, ChevronRight, Calendar,
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Receipt
} from "lucide-react";
import { todayIST } from "@/lib/dateUtils";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type MonthData = {
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

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type DbRow = ReturnType<typeof JSON.parse>;

type SupaBuilder = {
  eq: (column: string, value: unknown) => SupaBuilder;
  gte: (column: string, value: unknown) => SupaBuilder;
  lte: (column: string, value: unknown) => SupaBuilder;
  in: (column: string, values: unknown[]) => SupaBuilder;
  order: (column: string, opts?: { ascending?: boolean }) => SupaBuilder;
  range: (from: number, to: number) => PromiseLike<{ data: DbRow[] | null; error: unknown }>;
};

const istMonth = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(new Date(iso));

export default function YearlyReportPage() {
  const currentYear = parseInt(todayIST().slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ year: number; monthly: MonthData[] } | null>(null);
  const [err, setErr] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;
      const endTz = `${year}-12-31T23:59:59+05:30`;

      const fetchList = async (table: string, select: string, builder: (q: SupaBuilder) => SupaBuilder) => {
        const list: DbRow[] = [];
        let page = 0;
        while (true) {
          let q: SupaBuilder = supabase.from(table).select(select) as unknown as SupaBuilder;
          q = builder(q);
          const { data, error } = await q.range(page * 1000, (page + 1) * 1000 - 1);
          if (error) throw error;
          if (data && data.length > 0) list.push(...data);
          if (!data || data.length < 1000) break;
          page++;
        }
        return list;
      };

      const [jobs, sales, payments, expenseList, loanPayments, attendance, mechanics, salaryHistory] = await Promise.all([
        fetchList("transaction_list", "id, amount, mechanic_commission_amount, date_completed", q => q.eq("status", 5).gte("date_completed", start).lte("date_completed", endTz)),
        fetchList("direct_sales", "id, client_id, total_amount, date_created", q => q.gte("date_created", start).lte("date_created", end)),
        fetchList("client_payments", "id, discount, created_at", q => q.gte("created_at", start).lte("created_at", end)),
        fetchList("expense_list", "amount, date_created", q => q.gte("date_created", start).lte("date_created", end)),
        fetchList("loan_payments", "amount_paid, payment_date", q => q.gte("payment_date", start).lte("payment_date", end)),
        fetchList("attendance_list", "mechanic_id, curr_date, status", q => q.in("status", [1, 3]).gte("curr_date", start).lte("curr_date", end)),
        fetchList("mechanic_list", "id, daily_salary", q => q.eq("status", 1)),
        fetchList("mechanic_salary_history", "mechanic_id, salary, effective_date", q => q.order("effective_date", { ascending: false }))
      ]);

      const getRate = (mechId: number, dateStr: string, defaultRate: number) => {
        const hist = (salaryHistory || []).find(h => h.mechanic_id === mechId && h.effective_date <= dateStr);
        return hist ? hist.salary : defaultRate;
      };

      const monthly: MonthData[] = MONTHS.map((mName, idx) => {
        const mStr = String(idx + 1).padStart(2, "0");
        const prefix = `${year}-${mStr}`;

        const mJobs = (jobs || []).filter(t => istMonth(t.date_completed) === prefix);
        const repair = mJobs.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        const commission = mJobs.reduce((s, t) => s + (parseFloat(t.mechanic_commission_amount) || 0), 0);

        const mSales = (sales || []).filter(d => String(d.date_created).startsWith(prefix));
        const walkin = mSales.filter(d => !d.client_id || d.client_id === 0 || d.client_id === "")
          .reduce((s, d) => s + (parseFloat(d.total_amount) || 0), 0);
        const clientSales = mSales.filter(d => d.client_id && d.client_id !== 0 && d.client_id !== "")
          .reduce((s, d) => s + (parseFloat(d.total_amount) || 0), 0);

        const discount = (payments || [])
          .filter(p => String(p.created_at).startsWith(prefix))
          .reduce((s, p) => s + (parseFloat(p.discount) || 0), 0);

        const expenses = (expenseList || [])
          .filter(e => String(e.date_created).startsWith(prefix))
          .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

        const emi = (loanPayments || [])
          .filter(lp => String(lp.payment_date).startsWith(prefix))
          .reduce((s, lp) => s + (parseFloat(lp.amount_paid) || 0), 0);

        let salary = 0;
        (attendance || []).filter(a => String(a.curr_date).startsWith(prefix)).forEach(a => {
          const mech = (mechanics || []).find(me => me.id === a.mechanic_id);
          const rate = getRate(a.mechanic_id, a.curr_date, mech?.daily_salary || 0);
          salary += (a.status === 3 ? rate / 2 : rate);
        });

        const revenue = repair + walkin + clientSales;
        const totalExp = salary + commission + expenses + emi + discount;
        const profit = revenue - totalExp;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

        return { month: mName, repair, walkin, clientSales, revenue, salary, commission, expenses, emi, discount, totalExp, profit, margin };
      });

      setStats({ year, monthly });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [year]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch mount effect; loading init sync legit hai
  useEffect(() => { fetchData(); }, [fetchData]);

  const shiftYear = (diff: number) => setYear(y => y + diff);

  const totals = (stats?.monthly || []).reduce((acc, m) => ({
    repair: acc.repair + m.repair,
    walkin: acc.walkin + m.walkin,
    clientSales: acc.clientSales + m.clientSales,
    revenue: acc.revenue + m.revenue,
    salary: acc.salary + m.salary,
    commission: acc.commission + m.commission,
    expenses: acc.expenses + m.expenses,
    emi: acc.emi + m.emi,
    discount: acc.discount + m.discount,
    totalExp: acc.totalExp + m.totalExp,
    profit: acc.profit + m.profit
  }), { repair: 0, walkin: 0, clientSales: 0, revenue: 0, salary: 0, commission: 0, expenses: 0, emi: 0, discount: 0, totalExp: 0, profit: 0 });

  const cellCls = "px-3 py-3 text-right font-bold text-slate-300";

  return (
    <div className="min-h-screen bg-[#161b27] text-slate-200 p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white">Monthly Profit/Loss Report</h1>
          <p className="text-sm text-slate-400 mt-1">Month-wise financial summary for {year}</p>
        </div>
      </div>

      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#21293d] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => shiftYear(-1)} className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 transition">
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21293d] rounded-xl px-4 py-2">
              <Calendar size={16} className="text-slate-500" />
              <span className="text-sm font-bold text-white">{year}</span>
            </div>
            <button onClick={() => shiftYear(1)} disabled={year >= currentYear}
              className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 transition disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronRight size={18} />
            </button>
            <button onClick={() => setYear(currentYear)} className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1a2234] transition">
              This Year
            </button>
          </div>
          <button onClick={() => window.print()} disabled={!stats}
            className="flex items-center gap-2 px-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1a2234] transition disabled:opacity-50">
            <Printer size={14} /> Print
          </button>
        </div>

        {err && <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm">{err}</div>}

        {loading ? (
          <div className="px-5 py-16 text-center">
            <Loader2 size={32} className="animate-spin text-blue-500 mx-auto mb-3" />
            <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Loading...</p>
          </div>
        ) : stats ? (
          <>
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
              <StatCard icon={<Receipt size={16} />} label="Repair Income" sub={inr(totals.repair)} color="blue" />
              <StatCard icon={<ShoppingCart size={16} />} label="Total Sales" sub={inr(totals.walkin + totals.clientSales)} color="purple" />
              <StatCard icon={<DollarSign size={16} />} label="Total Revenue" sub={inr(totals.revenue)} color="emerald" />
              <StatCard icon={<TrendingDown size={16} />} label="Salary + Commission" sub={inr(totals.salary + totals.commission)} color="amber" />
              <StatCard icon={<TrendingDown size={16} />} label="Total Expenses" sub={inr(totals.totalExp)} color="rose" />
              <StatCard icon={totals.profit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />} label="Net Profit" sub={inr(totals.profit)} color={totals.profit >= 0 ? "emerald" : "rose"} />
            </div>

            <div className="px-5 pb-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#111520]">
                    <tr className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      <th className="text-left px-3 py-3 sticky left-0 bg-[#111520]">Month</th>
                      <th className="text-right px-3 py-3" title="Income from delivered repair jobs">Repair Income</th>
                      <th className="text-right px-3 py-3" title="Walk-in direct sales">Walk-in</th>
                      <th className="text-right px-3 py-3" title="Client direct sales">Client Sales</th>
                      <th className="text-right px-3 py-3 text-emerald-400" title="Total income">Revenue</th>
                      <th className="text-right px-3 py-3 text-amber-400" title="Salaries paid (history rates)">Salary</th>
                      <th className="text-right px-3 py-3 text-amber-400" title="Mechanic commissions">Commission</th>
                      <th className="text-right px-3 py-3" title="Other shop expenses">Expenses</th>
                      <th className="text-right px-3 py-3" title="Loan EMI payments">EMI</th>
                      <th className="text-right px-3 py-3 text-rose-400" title="Discounts given">Discount</th>
                      <th className="text-right px-3 py-3 text-rose-400" title="Total expenses">Total Exp.</th>
                      <th className="text-right px-3 py-3" title="Revenue minus expenses">Net Profit</th>
                      <th className="text-right px-3 py-3">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2234]">
                    {stats.monthly.map((row) => (
                      <tr key={row.month} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-3 font-bold text-slate-300 sticky left-0 bg-[#161b27]">{row.month} {year}</td>
                        <td className={`${cellCls} text-blue-400`}>{inr(row.repair)}</td>
                        <td className={`${cellCls} text-purple-400`}>{inr(row.walkin)}</td>
                        <td className={`${cellCls} text-purple-400`}>{inr(row.clientSales)}</td>
                        <td className="px-3 py-3 text-right font-bold text-emerald-400">{inr(row.revenue)}</td>
                        <td className={`${cellCls} text-amber-400`}>{inr(row.salary)}</td>
                        <td className={`${cellCls} text-amber-400`}>{inr(row.commission)}</td>
                        <td className={`${cellCls} text-slate-400`}>{inr(row.expenses)}</td>
                        <td className={`${cellCls} text-slate-400`}>{inr(row.emi)}</td>
                        <td className={`${cellCls} text-rose-400`}>{inr(row.discount)}</td>
                        <td className="px-3 py-3 text-right font-black text-rose-400">{inr(row.totalExp)}</td>
                        <td className={`px-3 py-3 text-right font-black ${row.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{inr(row.profit)}</td>
                        <td className="px-3 py-3 text-right">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black border ${
                            row.margin > 20 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            row.margin > 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>{row.margin.toFixed(1)}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#111520]">
                    <tr className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      <td className="px-3 py-3 sticky left-0 bg-[#111520]">Grand Total</td>
                      <td className="px-3 py-3 text-right text-blue-400">{inr(totals.repair)}</td>
                      <td className="px-3 py-3 text-right text-purple-400">{inr(totals.walkin)}</td>
                      <td className="px-3 py-3 text-right text-purple-400">{inr(totals.clientSales)}</td>
                      <td className="px-3 py-3 text-right font-black text-emerald-400">{inr(totals.revenue)}</td>
                      <td className="px-3 py-3 text-right text-amber-400">{inr(totals.salary)}</td>
                      <td className="px-3 py-3 text-right text-amber-400">{inr(totals.commission)}</td>
                      <td className="px-3 py-3 text-right text-slate-400">{inr(totals.expenses)}</td>
                      <td className="px-3 py-3 text-right text-slate-400">{inr(totals.emi)}</td>
                      <td className="px-3 py-3 text-right text-rose-400">{inr(totals.discount)}</td>
                      <td className="px-3 py-3 text-right font-black text-rose-400">{inr(totals.totalExp)}</td>
                      <td className={`px-3 py-3 text-right font-black ${totals.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{inr(totals.profit)}</td>
                      <td className="px-3 py-3 text-right font-black text-white">{totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="px-5 py-16 text-center text-slate-500 text-sm">No data available.</div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, sub, color }: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  color: "blue" | "purple" | "emerald" | "amber" | "rose";
}) {
  const colors = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };
  const textColors = {
    blue: "text-blue-400",
    purple: "text-purple-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
  };
  return (
    <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
      <div className={`inline-flex rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${colors[color]}`}>{label}</div>
      <p className={`mt-3 text-lg font-bold ${textColors[color]}`}>{sub}</p>
    </div>
  );
}
