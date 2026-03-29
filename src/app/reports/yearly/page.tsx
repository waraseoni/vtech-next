"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2, Printer, ChevronLeft, ChevronRight, Calendar,
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Receipt
} from "lucide-react";
import { todayIST, parseISTDate } from "@/lib/dateUtils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type YearlyStats = {
  year: number;
  jobsCount: number;
  jobsAmount: number;
  salesCount: number;
  salesAmount: number;
  paymentsReceived: number;
  discountsGiven: number;
  expenses: number;
  profit: number;
  monthlyJobs: number[];
  monthlySales: number[];
  monthlyPayments: number[];
  monthlyExpenses: number[];
};

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 });

export default function YearlyReportPage() {
  const currentYear = parseInt(todayIST().slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<YearlyStats | null>(null);
  const [err, setErr] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const from = `${year}-01-01T00:00:00`;
      const to = `${year}-12-31T23:59:59`;

      const [jobsRes, salesRes, paymentsRes, expensesRes] = await Promise.all([
        supabase.from("transaction_list").select("id, amount, date_created")
          .eq("del_status", 0).in("status", [3, 5]).gte("date_created", from).lte("date_created", to),
        supabase.from("direct_sales").select("id, total_amount, date_created")
          .gte("date_created", from).lte("date_created", to),
        supabase.from("client_payments").select("amount, discount, payment_date")
          .gte("payment_date", startDate).lte("payment_date", endDate),
        supabase.from("expense_list").select("amount, date_created")
          .gte("date_created", from).lte("date_created", to),
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (salesRes.error) throw salesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (expensesRes.error) throw expensesRes.error;

      const jobs = jobsRes.data || [];
      const sales = salesRes.data || [];
      const payments = paymentsRes.data || [];
      const expenses = expensesRes.data || [];

      const jobsCount = jobs.length;
      const jobsAmount = jobs.reduce((s, j) => s + (j.amount || 0), 0);
      const salesCount = sales.length;
      const salesAmount = sales.reduce((s, s_) => s + (s_.total_amount || 0), 0);
      const paymentsReceived = payments.reduce((s, p) => s + (p.amount || 0), 0);
      const discountsGiven = payments.reduce((s, p) => s + (p.discount || 0), 0);
      const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
      const totalIncome = jobsAmount + salesAmount;
      const profit = totalIncome - totalExpenses;

      const monthlyJobs: number[] = Array(12).fill(0);
      const monthlySales: number[] = Array(12).fill(0);
      const monthlyPayments: number[] = Array(12).fill(0);
      const monthlyExpenses: number[] = Array(12).fill(0);

      jobs.forEach(j => {
        const d = j.date_created?.slice(0, 10);
        if (d) {
          const m = parseISTDate(d).getMonth();
          monthlyJobs[m] += j.amount || 0;
        }
      });
      sales.forEach(s => {
        const d = s.date_created?.slice(0, 10);
        if (d) {
          const m = parseISTDate(d).getMonth();
          monthlySales[m] += s.total_amount || 0;
        }
      });
      payments.forEach(p => {
        if (p.payment_date) {
          const m = parseISTDate(p.payment_date).getMonth();
          monthlyPayments[m] += (p.amount || 0) + (p.discount || 0);
        }
      });
      expenses.forEach(e => {
        if (e.date_created) {
          const d = e.date_created.slice(0, 10);
          const m = parseISTDate(d).getMonth();
          monthlyExpenses[m] += e.amount || 0;
        }
      });

      setStats({
        year,
        jobsCount,
        jobsAmount,
        salesCount,
        salesAmount,
        paymentsReceived,
        discountsGiven,
        expenses: totalExpenses,
        profit,
        monthlyJobs,
        monthlySales,
        monthlyPayments,
        monthlyExpenses,
      });
    } catch (e: any) {
      setErr(e.message);
    }
    setLoading(false);
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const shiftYear = (diff: number) => setYear(y => y + diff);

  const handlePrint = () => {
    if (!stats) return;
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return;
    popup.document.write(`<html><head><title>Yearly Report ${year}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111827}
        h2{text-align:center;margin-bottom:4px} .subtitle{text-align:center;color:#666;margin-bottom:20px}
        .summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
        .card{border:1px solid #ddd;padding:16px;border-radius:8px}
        .card-title{font-size:11px;color:#666;text-transform:uppercase;font-weight:600}
        .card-value{font-size:20px;font-weight:bold;margin-top:4px}
        .positive{color:#16a34a}.negative{color:#dc2626}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #ddd;padding:8px;font-size:12px}
        th{background:#f1f5f9;text-align:right}.text-left{text-align:left}
        @media print{body{padding:0}}
      </style></head><body>
      <h2>V-Technologies</h2>
      <p class="subtitle">Yearly Report — ${year}</p>
      <div class="summary-grid">
        <div class="card"><div class="card-title">Jobs</div><div class="card-value">${stats.jobsCount} <span class="positive">${inr(stats.jobsAmount)}</span></div></div>
        <div class="card"><div class="card-title">Sales</div><div class="card-value">${stats.salesCount} <span class="positive">${inr(stats.salesAmount)}</span></div></div>
        <div class="card"><div class="card-title">Total Income</div><div class="card-value positive">${inr(stats.jobsAmount + stats.salesAmount)}</div></div>
        <div class="card"><div class="card-title">Payments Received</div><div class="card-value positive">${inr(stats.paymentsReceived)}</div></div>
        <div class="card"><div class="card-title">Discounts</div><div class="card-value negative">${inr(stats.discountsGiven)}</div></div>
        <div class="card"><div class="card-title">Expenses</div><div class="card-value negative">${inr(stats.expenses)}</div></div>
        <div class="card"><div class="card-title">Net Profit/Loss</div><div class="card-value ${stats.profit >= 0 ? 'positive' : 'negative'}">${inr(stats.profit)}</div></div>
      </div>
      <table>
        <thead><tr><th class="text-left">Month</th><th>Jobs</th><th>Sales</th><th>Income</th><th>Payments</th><th>Expenses</th></tr></thead>
        <tbody>
          ${MONTHS.map((m, i) => `<tr>
            <td class="text-left">${m} ${year}</td>
            <td>${inr(stats.monthlyJobs[i])}</td>
            <td>${inr(stats.monthlySales[i])}</td>
            <td>${inr(stats.monthlyJobs[i] + stats.monthlySales[i])}</td>
            <td>${inr(stats.monthlyPayments[i])}</td>
            <td>${inr(stats.monthlyExpenses[i])}</td>
          </tr>`).join("")}
        </tbody>
        <tfoot><tr><th class="text-left">Total</th><th>${inr(stats.monthlyJobs.reduce((s, v) => s + v, 0))}</th><th>${inr(stats.monthlySales.reduce((s, v) => s + v, 0))}</th><th>${inr(stats.jobsAmount + stats.salesAmount)}</th><th>${inr(stats.paymentsReceived)}</th><th>${inr(stats.expenses)}</th></tr></tfoot>
      </table>
      </body></html>`);
    popup.document.close();
    setTimeout(() => { popup.print(); setTimeout(() => popup.close(), 300); }, 300);
  };

  return (
    <div className="min-h-screen bg-[#161b27] text-slate-200 p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white">Yearly Report</h1>
          <p className="text-sm text-slate-400 mt-1">Financial summary for {year}</p>
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
          <button onClick={handlePrint} disabled={!stats}
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
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
              <StatCard icon={<Receipt size={16} />} label="Jobs" value={`${stats.jobsCount}`} sub={inr(stats.jobsAmount)} color="blue" />
              <StatCard icon={<ShoppingCart size={16} />} label="Sales" value={`${stats.salesCount}`} sub={inr(stats.salesAmount)} color="purple" />
              <StatCard icon={<DollarSign size={16} />} label="Income" value="" sub={inr(stats.jobsAmount + stats.salesAmount)} color="emerald" />
              <StatCard icon={<TrendingUp size={16} />} label="Payments" value="" sub={inr(stats.paymentsReceived)} color="teal" />
              <StatCard icon={<TrendingDown size={16} />} label="Discounts" value="" sub={inr(stats.discountsGiven)} color="amber" />
              <StatCard icon={<TrendingDown size={16} />} label="Expenses" value="" sub={inr(stats.expenses)} color="rose" />
              <StatCard icon={stats.profit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />} label="Net Profit" value="" sub={inr(stats.profit)} color={stats.profit >= 0 ? "emerald" : "rose"} />
            </div>

            <div className="px-5 pb-5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Monthly Breakdown</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#111520]">
                    <tr className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      <th className="text-left px-4 py-3">Month</th>
                      <th className="text-right px-4 py-3">Jobs</th>
                      <th className="text-right px-4 py-3">Sales</th>
                      <th className="text-right px-4 py-3">Income</th>
                      <th className="text-right px-4 py-3">Payments</th>
                      <th className="text-right px-4 py-3">Expenses</th>
                      <th className="text-right px-4 py-3">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2234]">
                    {MONTHS.map((m, i) => {
                      const income = stats.monthlyJobs[i] + stats.monthlySales[i];
                      const profit = income - stats.monthlyExpenses[i];
                      return (
                        <tr key={m} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-bold text-slate-300">{m} {year}</td>
                          <td className="px-4 py-3 text-right text-blue-400">{inr(stats.monthlyJobs[i])}</td>
                          <td className="px-4 py-3 text-right text-purple-400">{inr(stats.monthlySales[i])}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-400">{inr(income)}</td>
                          <td className="px-4 py-3 text-right text-teal-400">{inr(stats.monthlyPayments[i])}</td>
                          <td className="px-4 py-3 text-right text-rose-400">{inr(stats.monthlyExpenses[i])}</td>
                          <td className={`px-4 py-3 text-right font-bold ${profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{inr(profit)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-[#111520]">
                    <tr className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      <td className="px-4 py-3">Total</td>
                      <td className="px-4 py-3 text-right text-blue-400">{inr(stats.monthlyJobs.reduce((s, v) => s + v, 0))}</td>
                      <td className="px-4 py-3 text-right text-purple-400">{inr(stats.monthlySales.reduce((s, v) => s + v, 0))}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400">{inr(stats.jobsAmount + stats.salesAmount)}</td>
                      <td className="px-4 py-3 text-right text-teal-400">{inr(stats.paymentsReceived)}</td>
                      <td className="px-4 py-3 text-right text-rose-400">{inr(stats.expenses)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${stats.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{inr(stats.profit)}</td>
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

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: "blue" | "purple" | "emerald" | "teal" | "amber" | "rose";
}) {
  const colors = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    teal: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };
  const textColors = {
    blue: "text-blue-400",
    purple: "text-purple-400",
    emerald: "text-emerald-400",
    teal: "text-teal-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
  };
  return (
    <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
      <div className={`inline-flex rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${colors[color]}`}>{label}</div>
      <p className="mt-3 text-lg font-bold text-white">{value}</p>
      {sub && <p className={`mt-1 text-sm font-semibold ${textColors[color]}`}>{sub}</p>}
    </div>
  );
}
