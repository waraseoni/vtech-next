"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isValid } from "date-fns/isValid";
import { addMonths } from "date-fns/addMonths";
import { subMonths } from "date-fns/subMonths";
import {
  Store,
  TrendingUp,
  TrendingDown,
  Package,
  Scale,
  PieChart,
  Info,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Printer,
} from "lucide-react";
import { todayIST, formatIST, parseISTDate, startOfMonthIST, endOfMonthIST } from "@/lib/dateUtils";

const getMonthStart = (d: Date): string => startOfMonthIST(d);
const getMonthEnd = (d: Date): string => endOfMonthIST(d);

const rupee = (n: number, decimals = 0) =>
  "₹" +
  n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const inr = (n: number) =>
  (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

type Totals = {
  totalSales: number;
  repairIncome: number;
  walkinIncome: number;
  clientSalesIncome: number;
  partSalesValue: number;
  partsCost: number;
  useCostAssumption: boolean;
  grossProfit: number;
  totalSalary: number;
  totalCommission: number;
  totalShopExpenses: number;
  totalEmiPaid: number;
  totalDiscountGiven: number;
  totalAdvanceGiven: number;
  totalIndirectExpenses: number;
  netProfit: number;
};

type BalanceSheet = {
  assetStock: number;
  assetCash: number;
  liabilityLoan: number;
  liabilityStaff: number;
  liabilityExpenses: number;
  netWorth: number;
};

type Counts = {
  deliveredJobs: number;
  walkinSales: number;
  clientSales: number;
  expenses: number;
  emiPayments: number;
};

type ApiResponse = {
  period: { from: string; to: string };
  totals: Totals;
  balanceSheet: BalanceSheet;
  counts: Counts;
};

type Props = { fromDate?: string; toDate?: string };

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tone: "blue" | "emerald" | "indigo" | "amber" | "red" | "purple";
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    indigo: "bg-indigo-500/10 text-indigo-400",
    amber: "bg-amber-500/10 text-amber-400",
    red: "bg-red-500/10 text-red-400",
    purple: "bg-purple-500/10 text-purple-400",
  };
  return (
    <div className="bg-[#161b27] border border-[#21293d] rounded-3xl p-5 shadow-xl group hover:border-indigo-500/30 transition-all">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-xl ${tones[tone]}`}>
          <Icon size={16} />
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{label}</p>
          {sub && (
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">{sub}</p>
          )}
        </div>
      </div>
      <h3 className="text-xl font-black text-white">{value}</h3>
    </div>
  );
}

function PRow({
  label,
  value,
  tone = "text-slate-300",
  sub,
}: {
  label: string;
  value: number;
  tone?: string;
  sub?: string;
}) {
  return (
    <tr className="border-b border-[#21293d] hover:bg-white/[0.01] transition-colors">
      <td className="px-6 py-3 text-sm text-slate-400">
        {label}
        {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
      </td>
      <td className={`px-6 py-3 text-right font-black tabular-nums ${tone}`}>{rupee(value, 2)}</td>
    </tr>
  );
}

export default function VyaparDarpanClient({ fromDate, toDate }: Props) {
  const router = useRouter();

  const [from, setFrom] = useState(() => fromDate || getMonthStart(parseISTDate(todayIST())));
  const [to, setTo] = useState(() => toDate || getMonthEnd(parseISTDate(todayIST())));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/vyapar-darpan?from=${from}&to=${to}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Server error ${res.status}: ${txt}`);
      }
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setData(result as ApiResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report load karne mein error aayi");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const goToMonth = (dir: "prev" | "next") => {
    const [year, month] = from.split("-").map(Number);
    const base = new Date(year, month - 1, 1);
    if (!isValid(base)) return;
    const newBase = dir === "prev" ? subMonths(base, 1) : addMonths(base, 1);
    setFrom(getMonthStart(newBase));
    setTo(getMonthEnd(newBase));
  };

  const resetMonth = () => {
    const [y, m] = todayIST().split("-").map(Number);
    const now = new Date(y, m - 1, 1);
    setFrom(getMonthStart(now));
    setTo(getMonthEnd(now));
  };

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    router.replace(`/reports/vyapar-darpan?from=${from}&to=${to}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-[#0d1117] flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Store size={28} className="text-indigo-500/60" />
          </div>
          <div className="absolute inset-0 rounded-2xl border border-indigo-500/40 animate-ping" />
        </div>
        <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.3em]">
          Polishing the Mirror...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] bg-[#0d1117] flex items-center justify-center p-6">
        <div className="bg-[#161b27] border border-red-500/20 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <h3 className="text-white font-extrabold text-lg mb-2">Report Load Failed</h3>
          <p className="text-slate-500 text-sm mb-5">{error}</p>
          <button
            onClick={fetchData}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-extrabold text-sm transition-all"
          >
            Dobara Koshish Karo
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const t = data.totals;
  const bs = data.balanceSheet;

  return (
    <div className="min-h-screen bg-[#0d1117] pb-20 font-sans">
      {/* ══════════ HEADER ══════════ */}
      <div className="relative overflow-hidden bg-[#0d1117] border-b border-[#21293d]">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/reports"
                className="w-11 h-11 flex items-center justify-center bg-[#161b27] border border-[#21293d] rounded-xl text-slate-500 hover:text-white hover:border-indigo-500/40 transition-all flex-shrink-0"
              >
                <ArrowLeft size={18} />
              </Link>
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-blue-800 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/25 flex-shrink-0">
                <Store size={26} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight leading-none">
                  Vyapar Darpan
                </h1>
                <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.2em] mt-1">
                  {formatIST(from, { month: "long", year: "numeric" })} · Business Mirror
                </p>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="no-print flex items-center gap-2 px-4 py-2.5 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] hover:border-indigo-500/30 text-slate-400 hover:text-indigo-400 rounded-xl text-xs font-extrabold transition-all"
            >
              <Printer size={13} /> Print Analysis
            </button>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <StatCard
              label="Kul Bikri"
              value={rupee(t.totalSales)}
              sub="Total Sales"
              icon={TrendingUp}
              tone="blue"
            />
            <StatCard
              label="Sakal Laabh"
              value={rupee(t.grossProfit)}
              sub="Gross Profit"
              icon={DollarSign}
              tone="emerald"
            />
            <StatCard
              label="Shuddh Laabh"
              value={rupee(t.netProfit)}
              sub="Net Profit"
              icon={PieChart}
              tone={t.netProfit >= 0 ? "indigo" : "red"}
            />
            <StatCard
              label="Stock Value"
              value={rupee(bs.assetStock)}
              sub="Inventory Asset"
              icon={Package}
              tone="amber"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* ══════════ FILTER BAR ══════════ */}
        <form
          onSubmit={handleFilter}
          className="no-print bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4"
        >
          <div className="flex flex-wrap gap-3 items-end">
            {[
              { label: "Darpan Start", val: from, set: setFrom },
              { label: "Darpan End", val: to, set: setTo },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-1.5">
                  {label}
                </label>
                <input
                  type="date"
                  required
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  className="bg-[#111520] border border-[#21293d] text-slate-300 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-indigo-500/40 transition-all [color-scheme:dark]"
                />
              </div>
            ))}
            <div className="flex items-end gap-1.5 flex-wrap">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 h-[38px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-indigo-500/20 transition-all"
              >
                Refresh Analysis
              </button>
              <button
                type="button"
                onClick={() => goToMonth("prev")}
                className="w-[38px] h-[38px] bg-[#111520] border border-[#21293d] hover:border-slate-600 text-slate-500 hover:text-white rounded-xl flex items-center justify-center transition-all"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={resetMonth}
                className="flex items-center gap-1.5 px-3 h-[38px] bg-[#111520] border border-[#21293d] hover:border-slate-600 text-slate-500 hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                <RefreshCw size={11} /> This Month
              </button>
              <button
                type="button"
                onClick={() => goToMonth("next")}
                className="w-[38px] h-[38px] bg-[#111520] border border-[#21293d] hover:border-slate-600 text-slate-500 hover:text-white rounded-xl flex items-center justify-center transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </form>

        {/* ══════════ VYAPARIK KHATA (P&L) ══════════ */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#21293d] bg-[#111520]">
              <TrendingUp size={13} className="text-blue-400" />
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                व्यापारिक खाता (Trading / P&L)
              </span>
            </div>
            <table className="w-full">
              <tbody>
                <tr className="border-b border-[#21293d]">
                  <td
                    colSpan={2}
                    className="px-4 py-2 text-[9px] font-extrabold uppercase tracking-widest text-slate-700 bg-[#0f1520]"
                  >
                    आय (Income) — {inr(data.counts.deliveredJobs)} repair jobs ·{" "}
                    {inr(data.counts.walkinSales + data.counts.clientSales)} sales
                  </td>
                </tr>
                <PRow
                  label="Repair Income"
                  value={t.repairIncome}
                  sub="Delivered jobs (status=5)"
                />
                <PRow label="Walk-in Sales" value={t.walkinIncome} />
                <PRow label="Client Direct Sales" value={t.clientSalesIncome} sub="Credit sales" />
                <tr className="border-b border-[#21293d] bg-blue-500/5">
                  <td className="px-6 py-2.5 text-xs font-extrabold text-blue-400">Kul Bikri</td>
                  <td className="px-6 py-2.5 text-xs font-black text-right text-blue-400 tabular-nums">
                    {rupee(t.totalSales, 2)}
                  </td>
                </tr>
                <tr className="border-b border-[#21293d]">
                  <td
                    colSpan={2}
                    className="px-4 py-2 text-[9px] font-extrabold uppercase tracking-widest text-slate-700 bg-[#0f1520]"
                  >
                    माल की लागत (Cost of Parts)
                  </td>
                </tr>
                <PRow
                  label="Parts Sold Value"
                  value={t.partSalesValue}
                  sub="Billed parts value (qty x price)"
                />
                <PRow
                  label="Estimated Parts Cost"
                  value={-t.partsCost}
                  tone="text-red-400"
                  sub={t.useCostAssumption ? "90% conservative assumption" : "Actual purchase cost"}
                />
                <tr className="bg-emerald-500/10">
                  <td className="px-6 py-3 text-sm font-black text-white">
                    Sakal Laabh (Gross Profit)
                  </td>
                  <td className="px-6 py-3 text-sm font-black text-right text-emerald-400 tabular-nums">
                    {rupee(t.grossProfit, 2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Anya Kharche */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#21293d] bg-[#111520]">
              <TrendingDown size={13} className="text-red-400" />
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                अन्य खर्चे (Indirect Expenses)
              </span>
            </div>
            <table className="w-full">
              <tbody>
                <PRow
                  label="Staff Salary"
                  value={-t.totalSalary}
                  tone="text-red-400"
                  sub="Attendance-based (full + half days)"
                />
                <PRow
                  label="Mechanic Commission"
                  value={-t.totalCommission}
                  tone="text-red-400"
                  sub="On delivered jobs"
                />
                <PRow label="Shop Expenses" value={-t.totalShopExpenses} tone="text-red-400" />
                <PRow label="Loan EMI Paid" value={-t.totalEmiPaid} tone="text-red-400" />
                <PRow label="Client Discounts" value={-t.totalDiscountGiven} tone="text-red-400" />
                <PRow label="Staff Advances" value={-t.totalAdvanceGiven} tone="text-red-400" />
                <tr className="bg-red-500/5">
                  <td className="px-6 py-3 text-sm font-black text-red-400 uppercase text-xs tracking-widest">
                    Total Indirect Expenses
                  </td>
                  <td className="px-6 py-3 text-sm font-black text-right text-red-400 tabular-nums">
                    {rupee(t.totalIndirectExpenses, 2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ══════════ SHUDDH LABH + CHITTHA ══════════ */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Shuddh Labh / Final Chittha */}
          <div
            className={`rounded-[1.5rem] p-6 text-white relative overflow-hidden shadow-2xl ${
              t.netProfit >= 0
                ? "bg-gradient-to-br from-emerald-600 to-teal-800"
                : "bg-gradient-to-br from-red-600 to-rose-800"
            }`}
          >
            <div className="absolute top-0 right-0 p-6 opacity-10">
              {t.netProfit >= 0 ? <CheckCircle2 size={100} /> : <AlertTriangle size={100} />}
            </div>
            <div className="relative text-center">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-80 mb-4">
                Shuddh Laabh · Period Savings
              </h3>
              <h2 className="text-4xl font-black tracking-tighter mb-4">{rupee(t.netProfit, 2)}</h2>
              <div className="h-px bg-white/10 mb-4" />
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="opacity-60 uppercase">Gross Profit</span>
                  <span>{rupee(t.grossProfit)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="opacity-60 uppercase">All Expenses</span>
                  <span>{rupee(t.totalIndirectExpenses)}</span>
                </div>
              </div>
              <div className="mt-5 py-3 px-5 bg-black/10 rounded-2xl text-[11px] font-bold border border-white/10">
                {t.netProfit >= 0
                  ? "Aapka vyapar sahi disha mein hai. Labh se savings bant raha hai."
                  : "Savdhan! Kharchon par niyantran ki zaroorat hai. Net profit negative hai."}
              </div>
            </div>
          </div>

          {/* Chittha (Balance Sheet) */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#21293d] bg-[#111520]">
              <Scale size={13} className="text-indigo-400" />
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                चिट्ठा (Balance Sheet)
              </span>
            </div>
            <table className="w-full">
              <tbody>
                <tr className="border-b border-[#21293d]">
                  <td
                    colSpan={2}
                    className="px-4 py-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-700 bg-[#0f1520]"
                  >
                    संपत्ति (Assets)
                  </td>
                </tr>
                <PRow label="Stock Value" value={bs.assetStock} sub="Inventory x sale price" />
                <PRow
                  label="Savings (Period Profit)"
                  value={bs.assetCash}
                  sub="Positive net profit as capital"
                />
                <tr className="border-b border-[#21293d] bg-blue-500/5">
                  <td className="px-6 py-2.5 text-xs font-extrabold text-blue-400">
                    Total Assets (Sampatti)
                  </td>
                  <td className="px-6 py-2.5 text-xs font-black text-right text-blue-400 tabular-nums">
                    {rupee(bs.assetStock + bs.assetCash, 2)}
                  </td>
                </tr>
                <tr className="border-b border-[#21293d]">
                  <td
                    colSpan={2}
                    className="px-4 py-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-700 bg-[#0f1520]"
                  >
                    दायित्व (Liabilities)
                  </td>
                </tr>
                <PRow label="Outstanding Loan" value={-bs.liabilityLoan} tone="text-red-400" />
                <PRow
                  label="Staff Liability (due)"
                  value={-bs.liabilityStaff}
                  tone="text-red-400"
                />
                <tr className="border-b border-[#21293d] bg-red-500/5">
                  <td className="px-6 py-2.5 text-xs font-extrabold text-red-400">
                    Total Liabilities (Dindari)
                  </td>
                  <td className="px-6 py-2.5 text-xs font-black text-right text-red-400 tabular-nums">
                    {rupee(bs.liabilityLoan + bs.liabilityStaff, 2)}
                  </td>
                </tr>
                <tr className="bg-indigo-500/10">
                  <td className="px-6 py-3 text-sm font-black text-white">
                    Asli Value (Net Worth)
                  </td>
                  <td
                    className={`px-6 py-3 text-sm font-black text-right tabular-nums ${
                      bs.netWorth >= 0 ? "text-indigo-400" : "text-red-400"
                    }`}
                  >
                    {rupee(bs.netWorth, 2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ══════════ BREAKDOWN CARDS ══════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Delivered Jobs",
              value: String(data.counts.deliveredJobs),
              color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
            },
            {
              label: "Walk-in Sales",
              value: String(data.counts.walkinSales),
              color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
            },
            {
              label: "Client Sales",
              value: String(data.counts.clientSales),
              color: "bg-purple-500/10 border-purple-500/20 text-purple-400",
            },
            {
              label: "Expenses / EMIs",
              value: String(data.counts.expenses + data.counts.emiPayments),
              color: "bg-red-500/10 border-red-500/20 text-red-400",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 flex items-center gap-3"
            >
              <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`} />
              <div>
                <div className="text-xl font-black text-white leading-none">{value}</div>
                <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-600 mt-1">
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ══════════ METHODOLOGY NOTE ══════════ */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-3xl p-6 flex items-start gap-4 text-blue-400/80 text-xs font-bold leading-relaxed shadow-xl">
          <Info size={24} className="flex-shrink-0" />
          <div className="space-y-2">
            <p className="uppercase tracking-widest text-[10px] font-black">Darpan Methodology</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Revenue tabhi gina jata hai jab repair job <b>Delivered</b> (status=5) ho — bhugtan
                milne par nahi.
              </li>
              <li>
                Parts cost {t.useCostAssumption ? "90% conservative assumption" : "actual cost"} se
                matla gi jati hai.
              </li>
              <li>Balanced sheet: Stock + Savings (Assets) vs Loans + Staff dues (Liabilities).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
