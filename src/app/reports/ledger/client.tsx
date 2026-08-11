"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isValid } from "date-fns";
import { addMonths, subMonths } from "date-fns";
import {
  BarChart3, TrendingUp, TrendingDown, Wallet, PiggyBank,
  ChevronLeft, ChevronRight, RefreshCw, Eye, Printer,
  Info, Package, X, AlertTriangle, ChevronRight as CRight,
  ArrowUpRight, ArrowDownRight, Wrench, ShoppingCart, Users,
  CreditCard, Award, Building2, Receipt, Tag, Landmark,
} from "lucide-react";

import { todayIST, formatIST, parseISTDate, startOfMonthIST, endOfMonthIST } from "@/lib/dateUtils";

// ── Timezone-safe helpers ─────────────────────────────────────────────────────
const getMonthStart = (d: Date): string => startOfMonthIST(d);
const getMonthEnd   = (d: Date): string => endOfMonthIST(d);

const safeFormatDate = (s: string): string => {
  if (!s) return "—";
  try {
    return formatIST(s, { day: "2-digit", month: "short", year: "numeric" });
  } catch { return s; }
};

// ── Number helper ─────────────────────────────────────────────────────────────
const toNum = (v: unknown): number => {
  const n = Number(v); return isNaN(n) ? 0 : n;
};

const rupee = (n: number, decimals = 0) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// ── Types ─────────────────────────────────────────────────────────────────────
type Transaction   = { id: number; job_id: string; date_completed: string; item: string; amount: number | string; mechanic_commission_amount: number | string; client_firstname?: string; client_middlename?: string; client_lastname?: string; mechanic_firstname?: string; mechanic_lastname?: string; };
type DirectSale    = { id: number; sale_code: string; total_amount: number | string; date_created: string; client_id: number | null; client_firstname?: string; client_lastname?: string; product_name?: string; quantity?: number; unit_price?: number | string; };
type ClientPayment = { id: number; client_id: number; amount: number | string; discount: number | string; payment_date: string; remarks: string | null; payment_method: string | null; client_firstname?: string; client_lastname?: string; };
type Commission    = { job_id: string; amount: number | string; mechanic_commission_amount: number | string; date_completed: string; mechanic_firstname?: string; mechanic_lastname?: string; };
type SalaryDetail  = { mechanic_name: string; full_days: number | string; half_days: number | string; total_days: number | string; daily_salary: number | string; salary_earned: number | string; };
type AdvancePayment = { date_paid: string; mechanic_name: string; amount: number | string; reason: string | null; payment_mode: string | null; };
type Expense       = { date_created: string; category: string; remarks: string; amount: number | string; payment_mode: string | null; reference: string | null; };
type LedgerEntry   = { date: string; category: string; details: string; type: "Cash In" | "Cash Out"; net_amount: number | string; discount_amount?: number | string; client_id?: number; client_fullname?: string; };
type StockItem     = { name: string; price: number | string; quantity: number | string; };
type ApiResponse   = {
  repairJobs: Transaction[]; walkinSales: DirectSale[]; clientSales: DirectSale[];
  clientPayments: ClientPayment[]; commissionData: Commission[]; salaryDetails: SalaryDetail[];
  advancePayments: AdvancePayment[]; expenses: Expense[]; ledgerEntries: LedgerEntry[];
  stockItems: StockItem[];
  jobIncome: number | string; walkinIncome: number | string; clientSalesIncome: number | string;
  clientPaymentsReceived: number | string; totalDiscountGiven: number | string;
  totalCommission: number | string; totalAdvanceGiven: number | string;
  totalOtherExpenses: number | string; totalEmiPaid: number | string;
  totalSalary: number | string; stockValue: number | string;
  staffLiability: number | string; loanOutstanding: number | string;
};
type Props = { fromDate?: string; toDate?: string; };

// ── Shared UI components ──────────────────────────────────────────────────────
const thCls = "px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 text-left bg-[#111520]";
const tdCls = "px-3 py-2.5 text-xs text-slate-400";
const trCls = "border-b border-[#21293d] hover:bg-white/[0.02] transition-colors";

function TBadge({ type }: { type: "Cash In" | "Cash Out" }) {
  return type === "Cash In"
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[9px] font-extrabold">{type}</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full text-[9px] font-extrabold">{type}</span>;
}

// BUG FIX 3: Modal — original had stale onClose closure because onClose was in
// useEffect deps array. If parent recreates the callback inline, effect re-runs.
// Fix: use useRef to hold latest onClose without re-registering listener.
function Modal({ title, icon: Icon, children, onClose }: {
  title: string; icon?: React.ElementType;
  children: React.ReactNode; onClose: () => void;
}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []); // empty deps — safe because we use ref

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#21293d] bg-[#111520] rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-2.5">
            {Icon && <div className="w-7 h-7 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center"><Icon size={13} className="text-blue-400" /></div>}
            <h3 className="text-sm font-extrabold text-white">{title}</h3>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 bg-[#21293d] hover:bg-white/10 border border-[#21293d] rounded-lg flex items-center justify-center text-slate-500 hover:text-white transition-all">
            <X size={13} />
          </button>
        </div>
        <div className="overflow-auto flex-1 p-1">
          <table className="w-full text-sm border-collapse">{children}</table>
        </div>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, trend }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; trend?: "up" | "down" | "neutral";
}) {
  const ring = { up: "border-emerald-500/20 bg-emerald-500/5", down: "border-red-500/20 bg-red-500/5", neutral: "border-[#21293d] bg-[#111520]" }[trend ?? "neutral"];
  return (
    <div className={`border rounded-2xl p-4 flex flex-col gap-2 ${ring}`}>
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon size={16} className="opacity-80" />
        </div>
        {trend === "up" && <ArrowUpRight size={14} className="text-emerald-400" />}
        {trend === "down" && <ArrowDownRight size={14} className="text-red-400" />}
      </div>
      <div>
        <div className="text-xl font-black text-white leading-none">{value}</div>
        <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-600 mt-1">{label}</div>
        {sub && <div className="text-[10px] text-slate-700 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ── Section row in P&L / Cash tables ─────────────────────────────────────────
function PRow({ label, value, sub, onClick, colorClass = "text-slate-300" }: {
  label: string; value: number; sub?: string;
  onClick?: () => void; colorClass?: string;
}) {
  return (
    <tr className="border-b border-[#21293d] hover:bg-white/[0.02] transition-colors group">
      <td className={`px-4 py-2.5 text-xs ${colorClass}`}>
        {onClick
          ? <button onClick={onClick} className="flex items-center gap-1.5 hover:text-blue-400 transition-colors text-left">
              <Eye size={10} className="text-slate-700 group-hover:text-blue-400 flex-shrink-0" />
              {label}
            </button>
          : <span>{label}</span>
        }
        {sub && <div className="text-[10px] text-slate-700 mt-0.5 ml-4">{sub}</div>}
      </td>
      <td className={`px-4 py-2.5 text-xs text-right font-bold tabular-nums ${colorClass}`}>
        {rupee(value, 2)}
      </td>
    </tr>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function LedgerReportClient({ fromDate, toDate }: Props) {
  const router = useRouter();

  // BUG FIX 4: 'today' must be inside component to get fresh value per render
  // (was already inside, confirmed — keeping explicit)
  const [from, setFrom] = useState(() => fromDate || getMonthStart(parseISTDate(todayIST())));
  const [to,   setTo]   = useState(() => toDate   || getMonthEnd(parseISTDate(todayIST())));

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [data,    setData]    = useState<ApiResponse | null>(null);
  const [showStock, setShowStock] = useState(false);

  // Modal toggles
  const [modal, setModal] = useState<string | null>(null);
  const openModal  = (id: string) => setModal(id);
  const closeModal = () => setModal(null);

  // BUG FIX 5: Original handleFilter called router.push AND state was already set,
  // causing useEffect[fetchData] to fire twice (once for state change, once for
  // URL-driven re-mount). Fix: router.push only, let URL→state sync drive fetch.
  // BUT since this is a client component with local state, we just call fetchData
  // directly and push URL for shareability — no double fetch.
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/ledger?from=${from}&to=${to}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Server error ${res.status}: ${txt}`);
      }
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report load karne mein error aayi");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // BUG FIX 6: goToMonth — original used parseISO which can shift date in IST.
  // Fix: use parseISTDate for 'YYYY-MM-DD' strings.
  const goToMonth = (dir: "prev" | "next") => {
    // Fix: Parse date string directly to avoid UTC timezone shift (parseISTDate issue)
    const [year, month] = from.split('-').map(Number);
    const base = new Date(year, month - 1, 1);
    if (!isValid(base)) return;
    const newBase = dir === "prev" ? subMonths(base, 1) : addMonths(base, 1);
    setFrom(getMonthStart(newBase));
    setTo(getMonthEnd(newBase));
  };

  const resetMonth = () => {
    const todayStr = todayIST(); // "YYYY-MM-DD" — no timezone shift
    const [y, m] = todayStr.split('-').map(Number);
    const now = new Date(y, m - 1, 1);
    setFrom(getMonthStart(now));
    setTo(getMonthEnd(now));
  };

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    // Update URL for shareability but don't re-trigger fetch (useEffect handles it)
    router.replace(`/reports/ledger?from=${from}&to=${to}`, { scroll: false });
  };

  const displayFrom = safeFormatDate(from);
  const displayTo   = safeFormatDate(to);
  const monthLabel  = formatIST(from, { month: "long", year: "numeric" });

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <BarChart3 size={28} className="text-emerald-500/60" />
          </div>
          <div className="absolute inset-0 rounded-2xl border border-emerald-500/40 animate-ping" />
        </div>
        <p className="text-slate-600 text-xs font-extrabold uppercase tracking-[0.3em]">Loading Ledger...</p>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-6">
        <div className="bg-[#161b27] border border-red-500/20 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <h3 className="text-white font-extrabold text-lg mb-2">Report Load Failed</h3>
          <p className="text-slate-500 text-sm mb-5">{error}</p>
          <button onClick={fetchData}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-extrabold text-sm transition-all">
            Dobara Koshish Karo
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ── Computed values ────────────────────────────────────────────────────────
  const {
    repairJobs = [], walkinSales = [], clientSales = [], clientPayments = [],
    commissionData = [], salaryDetails = [], advancePayments = [],
    expenses = [], ledgerEntries = [], stockItems = [],
  } = data;

  const jobIncome              = toNum(data.jobIncome);
  const walkinIncome           = toNum(data.walkinIncome);
  const clientSalesIncome      = toNum(data.clientSalesIncome);
  const clientPaymentsReceived = toNum(data.clientPaymentsReceived);
  const totalDiscountGiven     = toNum(data.totalDiscountGiven);
  const totalCommission        = toNum(data.totalCommission);
  const totalAdvanceGiven      = toNum(data.totalAdvanceGiven);
  const totalOtherExpenses     = toNum(data.totalOtherExpenses);
  const totalEmiPaid           = toNum(data.totalEmiPaid);
  const totalSalary            = toNum(data.totalSalary);
  const stockValue             = toNum(data.stockValue);
  const staffLiability         = toNum(data.staffLiability);
  const loanOutstanding        = Math.max(0, toNum(data.loanOutstanding));

  const totalIncome          = jobIncome + walkinIncome + clientSalesIncome;
  const totalBusinessExpense = totalSalary + totalCommission + totalOtherExpenses + totalEmiPaid + totalDiscountGiven;
  const netProfit            = totalIncome - totalBusinessExpense;
  const totalCashInflow      = clientPaymentsReceived + walkinIncome;
  const totalCashOutflow     = totalAdvanceGiven + totalOtherExpenses + totalEmiPaid;
  const netCash              = totalCashInflow - totalCashOutflow;
  const totalAssets          = stockValue + netCash;
  const totalLiabilities     = staffLiability + loanOutstanding;
  const capital              = totalAssets - totalLiabilities;

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] pb-20 font-sans">

      {/* ═══════════════════════════════════════════ HERO HEADER */}
      <div className="relative overflow-hidden bg-[#0d1117] border-b border-[#21293d]">
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="absolute -top-20 left-1/4 w-96 h-96 bg-emerald-600/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-10 right-1/4 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-700 mb-4 font-bold uppercase tracking-wider">
            <span>Reports</span><CRight size={9} /><span className="text-slate-500">Ledger & Cash Flow</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/25 flex-shrink-0">
                <BarChart3 size={26} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight leading-none">
                  Business Ledger
                </h1>
                <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.2em] mt-1">
                  {monthLabel} · Cash Flow & P&L
                </p>
              </div>
            </div>

            <button onClick={() => window.open(`/api/print-ledger?from=${from}&to=${to}`, "_blank")}
              className="no-print flex items-center gap-2 px-4 py-2.5 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 rounded-xl text-xs font-extrabold transition-all">
              <Printer size={13} /> Print Report
            </button>
          </div>

          {/* ─── STAT CARDS ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <StatCard label="Net Revenue"    value={rupee(totalIncome)}          sub="Repair + all sales"    icon={TrendingUp}   color="bg-emerald-500/10 text-emerald-400" trend="up" />
            <StatCard label="Total Expenses" value={rupee(totalBusinessExpense)} sub="Salary+Comm+Exp+EMI"   icon={TrendingDown}  color="bg-red-500/10 text-red-400"     trend="down" />
            <StatCard label="Cash Received"  value={rupee(totalCashInflow)}      sub="Payments + walk-in"   icon={Wallet}        color="bg-blue-500/10 text-blue-400"   trend="up" />
            <StatCard
              label={netProfit >= 0 ? "Net Profit" : "Net Loss"}
              value={rupee(netProfit)}
              sub={netProfit >= 0 ? "Faayda" : "Nuksan"}
              icon={PiggyBank}
              color={netProfit >= 0 ? "bg-indigo-500/10 text-indigo-400" : "bg-yellow-500/10 text-yellow-400"}
              trend={netProfit >= 0 ? "up" : "down"}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">

        {/* ═══════════════════════════════════════════ FILTER BAR */}
        <form onSubmit={handleFilter}
          className="no-print bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4">
          <div className="flex flex-wrap gap-3 items-end">
            {[{ label: "From", val: from, set: setFrom }, { label: "To", val: to, set: setTo }].map(({ label, val, set }) => (
              <div key={label}>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-1.5">{label}</label>
                <input type="date" required value={val} onChange={e => set(e.target.value)}
                  className="bg-[#111520] border border-[#21293d] text-slate-300 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500/40 transition-all [color-scheme:dark]" />
              </div>
            ))}

            <div className="flex items-end gap-1.5 flex-wrap">
              <button type="submit"
                className="flex items-center gap-1.5 px-4 h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-500/20 transition-all">
                Apply Filter
              </button>
              <button type="button" onClick={() => goToMonth("prev")}
                className="w-[38px] h-[38px] bg-[#111520] border border-[#21293d] hover:border-slate-600 text-slate-500 hover:text-white rounded-xl flex items-center justify-center transition-all">
                <ChevronLeft size={14} />
              </button>
              <button type="button" onClick={resetMonth}
                className="flex items-center gap-1.5 px-3 h-[38px] bg-[#111520] border border-[#21293d] hover:border-slate-600 text-slate-500 hover:text-white rounded-xl text-xs font-bold transition-all">
                <RefreshCw size={11} /> This Month
              </button>
              <button type="button" onClick={() => goToMonth("next")}
                className="w-[38px] h-[38px] bg-[#111520] border border-[#21293d] hover:border-slate-600 text-slate-500 hover:text-white rounded-xl flex items-center justify-center transition-all">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </form>

        {/* ═══════════════════════════════════════════ P&L + CASH FLOW */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* P&L */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#21293d] bg-[#111520]">
              <TrendingUp size={13} className="text-emerald-400" />
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Business Performance (P&L)</span>
            </div>
            <table className="w-full">
              <tbody>
                {/* Revenue section */}
                <tr className="border-b border-[#21293d]">
                  <td colSpan={2} className="px-4 py-2 text-[9px] font-extrabold uppercase tracking-widest text-slate-700 bg-[#0f1520]">
                    Revenue (कमाई)
                  </td>
                </tr>
                <PRow label="Repair Jobs Income"   value={jobIncome}         colorClass="text-slate-300" onClick={() => openModal("repair")} />
                <PRow label="Walk-in Direct Sales" value={walkinIncome}      colorClass="text-slate-300" onClick={() => openModal("walkin")} />
                <PRow label="Client Direct Sales"  value={clientSalesIncome} colorClass="text-slate-300" onClick={() => openModal("clientsales")} />
                <tr className="border-b border-[#21293d] bg-emerald-500/5">
                  <td className="px-4 py-2.5 text-xs font-extrabold text-emerald-400">Net Revenue</td>
                  <td className="px-4 py-2.5 text-xs font-black text-right text-emerald-400 tabular-nums">{rupee(totalIncome, 2)}</td>
                </tr>

                {/* Expense section */}
                <tr className="border-b border-[#21293d]">
                  <td colSpan={2} className="px-4 py-2 text-[9px] font-extrabold uppercase tracking-widest text-slate-700 bg-[#0f1520]">
                    Expenses (खर्च)
                  </td>
                </tr>
                <PRow label="Staff Salaries"         value={totalSalary}          colorClass="text-red-400/80" onClick={() => openModal("salaries")} />
                <PRow label="Mechanic Commission"     value={totalCommission}       colorClass="text-red-400/80" onClick={() => openModal("commission")} />
                <PRow label="Shop Expenses"           value={totalOtherExpenses}    colorClass="text-red-400/80" onClick={() => openModal("shopexp")} />
                <PRow label="Loan EMI Payments"       value={totalEmiPaid}          colorClass="text-red-400/80" />
                <PRow label="Customer Discount Given" value={totalDiscountGiven}    colorClass="text-red-400/80" onClick={() => openModal("discount")} />
                <tr className="border-b border-[#21293d] bg-red-500/5">
                  <td className="px-4 py-2.5 text-xs font-extrabold text-red-400">Total Expenses</td>
                  <td className="px-4 py-2.5 text-xs font-black text-right text-red-400 tabular-nums">{rupee(totalBusinessExpense, 2)}</td>
                </tr>

                {/* Net profit */}
                <tr className={netProfit >= 0 ? "bg-emerald-500/10" : "bg-yellow-500/10"}>
                  <td className="px-4 py-3 text-sm font-black text-white">Net Profit / Loss</td>
                  <td className={`px-4 py-3 text-sm font-black text-right tabular-nums ${netProfit >= 0 ? "text-emerald-400" : "text-yellow-400"}`}>
                    {rupee(netProfit, 2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Cash Flow */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#21293d] bg-[#111520]">
              <Wallet size={13} className="text-blue-400" />
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Cash Flow (नकदी प्रवाह)</span>
            </div>
            <table className="w-full">
              <tbody>
                <tr className="border-b border-[#21293d]">
                  <td colSpan={2} className="px-4 py-2 text-[9px] font-extrabold uppercase tracking-widest text-slate-700 bg-[#0f1520]">
                    Cash Inflow (नकद आय)
                  </td>
                </tr>
                <PRow label="Client Payments Received"     value={clientPaymentsReceived} colorClass="text-emerald-400/80" onClick={() => openModal("clientpay")} />
                <PRow label="Walk-in Direct Sales (Cash)"  value={walkinIncome}           colorClass="text-emerald-400/80" onClick={() => openModal("walkin")} />
                <tr className="border-b border-[#21293d] bg-emerald-500/5">
                  <td className="px-4 py-2.5 text-xs font-extrabold text-emerald-400">Total Cash In</td>
                  <td className="px-4 py-2.5 text-xs font-black text-right text-emerald-400 tabular-nums">{rupee(totalCashInflow, 2)}</td>
                </tr>

                <tr className="border-b border-[#21293d]">
                  <td colSpan={2} className="px-4 py-2 text-[9px] font-extrabold uppercase tracking-widest text-slate-700 bg-[#0f1520]">
                    Cash Outflow (नकद भुगतान)
                  </td>
                </tr>
                <PRow label="Staff Advance / Salary Paid" value={totalAdvanceGiven}   colorClass="text-red-400/80" onClick={() => openModal("advance")} />
                <PRow label="Shop Expenses Paid"          value={totalOtherExpenses}   colorClass="text-red-400/80" onClick={() => openModal("shopexp")} />
                <PRow label="Loan EMI Paid"               value={totalEmiPaid}         colorClass="text-red-400/80" />
                <tr className="border-b border-[#21293d] bg-red-500/5">
                  <td className="px-4 py-2.5 text-xs font-extrabold text-red-400">Total Cash Out</td>
                  <td className="px-4 py-2.5 text-xs font-black text-right text-red-400 tabular-nums">{rupee(totalCashOutflow, 2)}</td>
                </tr>

                <tr className="bg-blue-500/10">
                  <td className="px-4 py-3 text-sm font-black text-white">Net Cash Flow</td>
                  <td className={`px-4 py-3 text-sm font-black text-right tabular-nums ${netCash >= 0 ? "text-blue-400" : "text-red-400"}`}>
                    {rupee(netCash, 2)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Note box */}
            <div className="mx-4 mb-4 mt-3 bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Info size={11} className="text-amber-400" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">Notes</span>
              </div>
              <ul className="space-y-0.5 text-[10px] text-slate-600 list-disc list-inside">
                <li>Repair revenue counted when job is delivered.</li>
                <li>Client Payments = cash recovery, not new revenue.</li>
                <li>Customer discounts counted as business expense.</li>
                <li><Eye size={9} className="inline" /> icon click karo details ke liye.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════ LEDGER TABLE */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#21293d] bg-[#111520]">
            <div className="flex items-center gap-2">
              <Receipt size={13} className="text-slate-500" />
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Transaction Ledger</span>
              <span className="text-[9px] text-slate-700 ml-1">{displayFrom} — {displayTo}</span>
            </div>
            <div className="flex gap-1.5">
              <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[9px] font-extrabold">Cash In</span>
              <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full text-[9px] font-extrabold">Cash Out</span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  {["Date", "Category", "Details", "Cash In", "Cash Out", "Balance"].map((h, i) => (
                    <th key={h} className={`${thCls} ${i >= 3 ? "text-right" : ""} border-b border-[#21293d]`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-600 text-sm">Is period mein koi transaction nahi mila.</td></tr>
                ) : (() => {
                  let bal = 0;
                  return ledgerEntries.map((e, idx) => {
                    const amt = toNum(e.net_amount);
                    if (e.type === "Cash In") bal += amt; else bal -= amt;
                    // BUG FIX 7: key={idx} causes issues when list updates.
                    // Use composite key with date+category+idx for stability.
                    return (
                      <tr key={`${e.date}-${e.category}-${idx}`} className={`border-b border-[#21293d] transition-colors ${e.type === "Cash In" ? "hover:bg-emerald-500/[0.02]" : "hover:bg-red-500/[0.02]"}`}>
                        <td className={`${tdCls} whitespace-nowrap`}>{safeFormatDate(e.date)}</td>
                        <td className={tdCls}><TBadge type={e.type} /></td>
                        <td className={`${tdCls} max-w-xs`}>
                          {e.client_fullname
                            ? <Link href={`/clients/${e.client_id}/view`} className="text-blue-400 hover:text-blue-300 transition-colors">{e.client_fullname}</Link>
                            : <span>{e.details}</span>
                          }
                          {toNum(e.discount_amount) > 0 && (
                            <span className="text-red-400/60 text-[10px] ml-1">(-{rupee(toNum(e.discount_amount), 2)})</span>
                          )}
                        </td>
                        <td className={`${tdCls} text-right tabular-nums text-emerald-400 font-bold`}>
                          {e.type === "Cash In" ? rupee(amt, 2) : "—"}
                        </td>
                        <td className={`${tdCls} text-right tabular-nums text-red-400 font-bold`}>
                          {e.type === "Cash Out" ? rupee(amt, 2) : "—"}
                        </td>
                        <td className={`${tdCls} text-right tabular-nums font-black ${bal >= 0 ? "text-blue-400" : "text-red-400"}`}>
                          {rupee(bal, 2)}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* Footer totals */}
          <div className="flex flex-wrap justify-between items-center gap-3 px-4 py-3 border-t border-[#21293d] bg-[#111520]">
            {[
              { label: "Total Cash In",   value: totalCashInflow,  cls: "text-emerald-400" },
              { label: "Total Cash Out",  value: totalCashOutflow, cls: "text-red-400" },
              { label: "Closing Balance", value: netCash,          cls: netCash >= 0 ? "text-blue-400" : "text-red-400" },
            ].map(({ label, value, cls }) => (
              <div key={label} className="text-[10px]">
                <span className="text-slate-600 font-bold">{label}: </span>
                <span className={`font-black tabular-nums ${cls}`}>{rupee(value, 2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════ EXPENSE + ADVANCE */}
        <div className="grid md:grid-cols-2 gap-4">
          {[
            {
              title: "Shop Expense Details", icon: Building2,
              rows: expenses,
              cols: ["Date", "Description", "Amount"],
              empty: "Koi expense nahi mila.",
              renderRow: (e: Expense, i: number) => (
                <tr key={i} className={trCls}>
                  <td className={`${tdCls} whitespace-nowrap`}>{safeFormatDate(e.date_created)}</td>
                  <td className={tdCls}>{e.remarks || e.category}</td>
                  <td className={`${tdCls} text-right text-red-400 font-bold tabular-nums`}>{rupee(toNum(e.amount), 2)}</td>
                </tr>
              ),
              total: totalOtherExpenses, totalCls: "text-red-400",
            },
            {
              title: "Staff Advance List", icon: Users,
              rows: advancePayments,
              cols: ["Date", "Staff", "Amount"],
              empty: "Koi advance nahi mila.",
              renderRow: (a: AdvancePayment, i: number) => (
                <tr key={i} className={trCls}>
                  <td className={`${tdCls} whitespace-nowrap`}>{safeFormatDate(a.date_paid)}</td>
                  <td className={tdCls}>{a.mechanic_name}</td>
                  <td className={`${tdCls} text-right text-amber-400 font-bold tabular-nums`}>{rupee(toNum(a.amount), 2)}</td>
                </tr>
              ),
              total: totalAdvanceGiven, totalCls: "text-amber-400",
            },
          ].map(({ title, icon: Icon, rows, cols, empty, renderRow, total, totalCls }) => (
            <div key={title} className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#21293d] bg-[#111520]">
                <Icon size={12} className="text-slate-500" />
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">{title}</span>
              </div>
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr>{cols.map((c, i) => <th key={c} className={`${thCls} border-b border-[#21293d] ${i === cols.length - 1 ? "text-right" : ""}`}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.length === 0
                      ? <tr><td colSpan={3} className="py-8 text-center text-slate-600 text-xs">{empty}</td></tr>
                      : rows.map((r, i) => renderRow(r as Expense & AdvancePayment, i))
                    }
                  </tbody>
                  {rows.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-[#21293d] bg-[#111520]">
                        <td colSpan={2} className="px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-600 text-right">Total</td>
                        <td className={`px-3 py-2.5 text-xs font-black text-right tabular-nums ${totalCls}`}>{rupee(total, 2)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════════ TRADING + BALANCE SHEET */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Trading / P&L */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#21293d] bg-[#111520]">
              <BarChart3 size={12} className="text-slate-500" />
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">व्यापारिक खाता (Trading/P&L)</span>
            </div>
            <table className="w-full">
              <tbody>
                <tr className="border-b border-[#21293d]"><td colSpan={2} className="px-4 py-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-700 bg-[#0f1520]">आय (Income)</td></tr>
                <PRow label="सर्विस राजस्व"   value={jobIncome}           colorClass="text-slate-400" />
                <PRow label="वॉक-इन बिक्री"   value={walkinIncome}        colorClass="text-slate-400" />
                <PRow label="ग्राहक बिक्री"    value={clientSalesIncome}   colorClass="text-slate-400" />
                <tr className="border-b border-[#21293d] bg-emerald-500/5"><td className="px-4 py-2.5 text-xs font-extrabold text-emerald-400">शुद्ध आय</td><td className="px-4 py-2.5 text-xs font-black text-right text-emerald-400 tabular-nums">{rupee(totalIncome, 2)}</td></tr>

                <tr className="border-b border-[#21293d]"><td colSpan={2} className="px-4 py-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-700 bg-[#0f1520]">व्यय (Expenses)</td></tr>
                <PRow label="वेतन"           value={totalSalary}         colorClass="text-slate-400" />
                <PRow label="कमीशन"          value={totalCommission}     colorClass="text-slate-400" />
                <PRow label="दुकान खर्च"     value={totalOtherExpenses}  colorClass="text-slate-400" />
                <PRow label="लोन किस्त"      value={totalEmiPaid}        colorClass="text-slate-400" />
                <PRow label="ग्राहक छूट"     value={totalDiscountGiven}  colorClass="text-slate-400" />
                <tr className="border-b border-[#21293d] bg-red-500/5"><td className="px-4 py-2.5 text-xs font-extrabold text-red-400">कुल व्यय</td><td className="px-4 py-2.5 text-xs font-black text-right text-red-400 tabular-nums">{rupee(totalBusinessExpense, 2)}</td></tr>

                <tr className={netProfit >= 0 ? "bg-emerald-500/10" : "bg-yellow-500/10"}>
                  <td className="px-4 py-3 text-sm font-black text-white">शुद्ध लाभ/हानि</td>
                  <td className={`px-4 py-3 text-sm font-black text-right tabular-nums ${netProfit >= 0 ? "text-emerald-400" : "text-yellow-400"}`}>{rupee(netProfit, 2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Balance Sheet */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#21293d] bg-[#111520]">
              <Landmark size={12} className="text-slate-500" />
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">चिट्ठा (Balance Sheet)</span>
            </div>
            <table className="w-full">
              <tbody>
                <tr className="border-b border-[#21293d]"><td colSpan={2} className="px-4 py-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-700 bg-[#0f1520]">संपत्ति (Assets)</td></tr>
                <PRow label="स्टॉक मूल्य"   value={stockValue} colorClass="text-slate-400" />
                <PRow label="नकद शेष"        value={netCash}    colorClass="text-slate-400" />
                <tr className="border-b border-[#21293d] bg-blue-500/5"><td className="px-4 py-2.5 text-xs font-extrabold text-blue-400">कुल संपत्ति</td><td className="px-4 py-2.5 text-xs font-black text-right text-blue-400 tabular-nums">{rupee(totalAssets, 2)}</td></tr>

                <tr className="border-b border-[#21293d]"><td colSpan={2} className="px-4 py-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-700 bg-[#0f1520]">दायित्व (Liabilities)</td></tr>
                <PRow label="स्टाफ बकाया"    value={staffLiability}   colorClass="text-red-400/80" />
                <PRow label="लोन बकाया"      value={loanOutstanding}  colorClass="text-red-400/80" />
                <tr className="border-b border-[#21293d] bg-red-500/5"><td className="px-4 py-2.5 text-xs font-extrabold text-red-400">कुल दायित्व</td><td className="px-4 py-2.5 text-xs font-black text-right text-red-400 tabular-nums">{rupee(totalLiabilities, 2)}</td></tr>

                <tr className="bg-indigo-500/10">
                  <td className="px-4 py-3 text-sm font-black text-white">पूंजी (Capital)</td>
                  <td className={`px-4 py-3 text-sm font-black text-right tabular-nums ${capital >= 0 ? "text-indigo-400" : "text-red-400"}`}>{rupee(capital, 2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══════════════════════════════════════════ INFO BOX */}
        <div className="no-print bg-[#161b27] border border-amber-500/15 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info size={12} className="text-amber-400" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">सुझाव (Notes)</span>
          </div>
          <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1">
            <li>Balance Sheet अनुमानित है — सटीक चिट्ठा के लिए सभी लेनदेन रिकॉर्ड करें।</li>
            <li>Revenue जॉब डिलीवर होने पर माना जाता है, भुगतान मिलने पर नहीं।</li>
            <li>Client Payments नकद आवक है, नई आय नहीं।</li>
            <li>ग्राहक को दी गई छूट व्यवसायिक खर्च में जोड़ी गई है।</li>
          </ul>
        </div>

        {/* ═══════════════════════════════════════════ CALCULATION SUMMARY */}
        <div className="bg-[#161b27] border border-blue-500/15 rounded-2xl p-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Info size={12} className="text-blue-400" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-400">Calculation Summary</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] font-mono">
            <div className="bg-slate-900/50 rounded-lg p-2">
              <p className="text-blue-400 font-bold mb-1">P&L (Profit & Loss)</p>
              <div className="text-slate-500 space-y-0.5">
                <div><span className="text-emerald-400">Net Revenue</span> = Repair Jobs + Walk-in Sales + Client Sales</div>
                <div><span className="text-red-400">Total Expenses</span> = Staff Salary + Mechanic Commission + Shop Expenses + Loan EMI + Discount</div>
                <div><span className="text-cyan-400">Net Profit</span> = Net Revenue − Total Expenses</div>
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2">
              <p className="text-blue-400 font-bold mb-1">Cash Flow</p>
              <div className="text-slate-500 space-y-0.5">
                <div><span className="text-emerald-400">Total Cash In</span> = Client Payments + Walk-in Sales</div>
                <div><span className="text-red-400">Total Cash Out</span> = Staff Advance + Shop Expenses + Loan EMI</div>
                <div><span className="text-amber-400">Net Cash Flow</span> = Total Cash In − Total Cash Out</div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════ STOCK TOGGLE */}
        <div className="no-print">
          <button onClick={() => setShowStock(p => !p)}
            className="flex items-center gap-2.5 px-4 py-2.5 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] hover:border-blue-500/30 text-slate-500 hover:text-blue-400 rounded-xl text-xs font-extrabold transition-all">
            <Package size={13} />
            {showStock ? "Hide" : "Show"} Detailed Stock Table
            <ChevronRight size={12} className={`transition-transform ${showStock ? "rotate-90" : ""}`} />
          </button>
        </div>

        {showStock && (
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#21293d] bg-[#111520]">
              <Package size={12} className="text-slate-500" />
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Detailed Stock Report</span>
              <span className="ml-auto text-[10px] text-slate-600 font-bold">Total: {rupee(stockValue, 2)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["#", "Product Name", "Qty", "Unit Price", "Total Value"].map((h, i) => (
                      <th key={h} className={`${thCls} border-b border-[#21293d] ${i >= 2 ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stockItems.length === 0
                    ? <tr><td colSpan={5} className="py-10 text-center text-slate-600 text-xs">Koi stock nahi mila.</td></tr>
                    : stockItems.map((item, idx) => (
                      <tr key={idx} className={trCls}>
                        <td className={`${tdCls} text-slate-700`}>{idx + 1}</td>
                        <td className={tdCls}>{item.name}</td>
                        <td className={`${tdCls} text-right tabular-nums`}>{toNum(item.quantity).toLocaleString()}</td>
                        <td className={`${tdCls} text-right tabular-nums`}>{rupee(toNum(item.price), 2)}</td>
                        <td className={`${tdCls} text-right tabular-nums font-bold text-slate-300`}>{rupee(toNum(item.price) * toNum(item.quantity), 2)}</td>
                      </tr>
                    ))
                  }
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#21293d] bg-[#111520]">
                    <td colSpan={4} className="px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-600 text-right">Grand Total Stock Value</td>
                    <td className="px-3 py-2.5 text-xs font-black text-right text-blue-400 tabular-nums">{rupee(stockValue, 2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════ MODALS */}

      {/* Repair Jobs */}
      {modal === "repair" && (
        <Modal title={`Repair Jobs — ${displayFrom} to ${displayTo}`} icon={Wrench} onClose={closeModal}>
          <thead><tr>{["Job Code","Client","Items","Mechanic","Amount","Commission","Completed"].map(h=><th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {repairJobs.length === 0 ? <tr><td colSpan={7} className="py-10 text-center text-slate-600">Koi repair job nahi mili.</td></tr>
              : repairJobs.map(j => (
                <tr key={j.id} className={trCls}>
                  <td className={tdCls}>{j.job_id}</td>
                  <td className={tdCls}>{[j.client_firstname,j.client_middlename,j.client_lastname].filter(Boolean).join(" ")}</td>
                  <td className={tdCls}>{j.item}</td>
                  <td className={tdCls}>{j.mechanic_firstname} {j.mechanic_lastname}</td>
                  <td className={`${tdCls} text-right text-emerald-400 font-bold tabular-nums`}>{rupee(toNum(j.amount),2)}</td>
                  <td className={`${tdCls} text-right text-amber-400 font-bold tabular-nums`}>{rupee(toNum(j.mechanic_commission_amount),2)}</td>
                  <td className={`${tdCls} whitespace-nowrap`}>{safeFormatDate(j.date_completed)}</td>
                </tr>
              ))}
          </tbody>
          {repairJobs.length > 0 && <tfoot><tr className="border-t border-[#21293d] bg-[#111520]"><td colSpan={4} className={`${tdCls} text-right font-extrabold`}>Total</td><td className={`${tdCls} text-right text-emerald-400 font-black tabular-nums`}>{rupee(jobIncome,2)}</td><td className={`${tdCls} text-right text-amber-400 font-black tabular-nums`}>{rupee(totalCommission,2)}</td><td /></tr></tfoot>}
        </Modal>
      )}

      {/* Walk-in Sales */}
      {modal === "walkin" && (
        <Modal title={`Walk-in Sales — ${displayFrom} to ${displayTo}`} icon={ShoppingCart} onClose={closeModal}>
          <thead><tr>{["Invoice","Product","Qty","Unit Price","Total","Date"].map(h=><th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {walkinSales.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-slate-600">Koi walk-in sale nahi mili.</td></tr>
              : walkinSales.map(s => (
                <tr key={s.id} className={trCls}>
                  <td className={tdCls}>{s.sale_code}</td>
                  <td className={tdCls}>{s.product_name||"Multiple Items"}</td>
                  <td className={`${tdCls} text-right`}>{s.quantity||"—"}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{s.unit_price?rupee(toNum(s.unit_price),2):"—"}</td>
                  <td className={`${tdCls} text-right text-emerald-400 font-bold tabular-nums`}>{rupee(toNum(s.total_amount),2)}</td>
                  <td className={`${tdCls} whitespace-nowrap`}>{safeFormatDate(s.date_created)}</td>
                </tr>
              ))}
          </tbody>
          {walkinSales.length > 0 && <tfoot><tr className="border-t border-[#21293d] bg-[#111520]"><td colSpan={4} className={`${tdCls} text-right font-extrabold`}>Total</td><td className={`${tdCls} text-right text-emerald-400 font-black tabular-nums`}>{rupee(walkinIncome,2)}</td><td /></tr></tfoot>}
        </Modal>
      )}

      {/* Client Sales */}
      {modal === "clientsales" && (
        <Modal title={`Client Sales — ${displayFrom} to ${displayTo}`} icon={Users} onClose={closeModal}>
          <thead><tr>{["Invoice","Client","Product","Qty","Unit Price","Total","Date"].map(h=><th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {clientSales.length === 0 ? <tr><td colSpan={7} className="py-10 text-center text-slate-600">Koi client sale nahi mili.</td></tr>
              : clientSales.map(s => (
                <tr key={s.id} className={trCls}>
                  <td className={tdCls}>{s.sale_code}</td>
                  <td className={tdCls}>{s.client_firstname} {s.client_lastname}</td>
                  <td className={tdCls}>{s.product_name||"Multiple Items"}</td>
                  <td className={`${tdCls} text-right`}>{s.quantity||"—"}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{s.unit_price?rupee(toNum(s.unit_price),2):"—"}</td>
                  <td className={`${tdCls} text-right text-emerald-400 font-bold tabular-nums`}>{rupee(toNum(s.total_amount),2)}</td>
                  <td className={`${tdCls} whitespace-nowrap`}>{safeFormatDate(s.date_created)}</td>
                </tr>
              ))}
          </tbody>
          {clientSales.length > 0 && <tfoot><tr className="border-t border-[#21293d] bg-[#111520]"><td colSpan={5} className={`${tdCls} text-right font-extrabold`}>Total</td><td className={`${tdCls} text-right text-emerald-400 font-black tabular-nums`}>{rupee(clientSalesIncome,2)}</td><td /></tr></tfoot>}
        </Modal>
      )}

      {/* Client Payments */}
      {modal === "clientpay" && (
        <Modal title={`Client Payments — ${displayFrom} to ${displayTo}`} icon={CreditCard} onClose={closeModal}>
          <thead><tr>{["Client","Date","Net Received","Discount","Total Bill","Remarks","Method"].map(h=><th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {clientPayments.length === 0 ? <tr><td colSpan={7} className="py-10 text-center text-slate-600">Koi payment nahi mili.</td></tr>
              : clientPayments.map(p => (
                <tr key={p.id} className={trCls}>
                  <td className={tdCls}>{p.client_firstname} {p.client_lastname}</td>
                  <td className={`${tdCls} whitespace-nowrap`}>{safeFormatDate(p.payment_date)}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{rupee(toNum(p.amount),2)}</td>
                  <td className={`${tdCls} text-right text-red-400 tabular-nums`}>{rupee(toNum(p.discount),2)}</td>
                  <td className={`${tdCls} text-right text-emerald-400 font-bold tabular-nums`}>{rupee(toNum(p.amount)+toNum(p.discount),2)}</td>
                  <td className={tdCls}>{p.remarks||"—"}</td>
                  <td className={tdCls}>{p.payment_method||"Cash"}</td>
                </tr>
              ))}
          </tbody>
          {clientPayments.length > 0 && <tfoot><tr className="border-t border-[#21293d] bg-[#111520]"><td colSpan={2} className={`${tdCls} text-right font-extrabold`}>Total</td><td className={`${tdCls} text-right text-emerald-400 font-black tabular-nums`}>{rupee(clientPaymentsReceived,2)}</td><td className={`${tdCls} text-right text-red-400 font-black tabular-nums`}>{rupee(totalDiscountGiven,2)}</td><td colSpan={3}/></tr></tfoot>}
        </Modal>
      )}

      {/* Commission */}
      {modal === "commission" && (
        <Modal title={`Mechanic Commission — ${displayFrom} to ${displayTo}`} icon={Award} onClose={closeModal}>
          <thead><tr>{["Job Code","Mechanic","Job Amount","Commission","Comm %","Completed"].map(h=><th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {commissionData.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-slate-600">Koi commission nahi mila.</td></tr>
              : commissionData.map((c,i) => {
                const amt=toNum(c.amount), comm=toNum(c.mechanic_commission_amount);
                return <tr key={i} className={trCls}>
                  <td className={tdCls}>{c.job_id}</td>
                  <td className={tdCls}>{c.mechanic_firstname} {c.mechanic_lastname}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{rupee(amt,2)}</td>
                  <td className={`${tdCls} text-right text-amber-400 font-bold tabular-nums`}>{rupee(comm,2)}</td>
                  <td className={`${tdCls} text-right`}>{amt>0?((comm/amt)*100).toFixed(1):0}%</td>
                  <td className={`${tdCls} whitespace-nowrap`}>{safeFormatDate(c.date_completed)}</td>
                </tr>;
              })}
          </tbody>
          {commissionData.length > 0 && <tfoot><tr className="border-t border-[#21293d] bg-[#111520]"><td colSpan={3} className={`${tdCls} text-right font-extrabold`}>Total</td><td className={`${tdCls} text-right text-amber-400 font-black tabular-nums`}>{rupee(totalCommission,2)}</td><td colSpan={2}/></tr></tfoot>}
        </Modal>
      )}

      {/* Discount */}
      {modal === "discount" && (
        <Modal title={`Customer Discounts — ${displayFrom} to ${displayTo}`} icon={Tag} onClose={closeModal}>
          <thead><tr>{["Client","Date","Amount Paid","Discount","Disc %","Remarks"].map(h=><th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {clientPayments.filter(p=>toNum(p.discount)>0).length===0
              ? <tr><td colSpan={6} className="py-10 text-center text-slate-600">Koi discount nahi mila.</td></tr>
              : clientPayments.filter(p=>toNum(p.discount)>0).map(p=>{
                const amt=toNum(p.amount),disc=toNum(p.discount);
                return <tr key={p.id} className={trCls}>
                  <td className={tdCls}>{p.client_firstname} {p.client_lastname}</td>
                  <td className={`${tdCls} whitespace-nowrap`}>{safeFormatDate(p.payment_date)}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{rupee(amt,2)}</td>
                  <td className={`${tdCls} text-right text-red-400 font-bold tabular-nums`}>{rupee(disc,2)}</td>
                  <td className={`${tdCls} text-right`}>{(amt+disc)>0?((disc/(amt+disc))*100).toFixed(1):0}%</td>
                  <td className={tdCls}>{p.remarks||"—"}</td>
                </tr>;
              })}
          </tbody>
        </Modal>
      )}

      {/* Staff Salaries */}
      {modal === "salaries" && (
        <Modal title={`Staff Salaries — ${displayFrom} to ${displayTo}`} icon={Users} onClose={closeModal}>
          <thead><tr>{["Mechanic","Full Days","Half Days","Total Days","Daily Rate","Earned"].map(h=><th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {salaryDetails.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-slate-600">Koi salary detail nahi mili.</td></tr>
              : salaryDetails.map((s,i) => (
                <tr key={i} className={trCls}>
                  <td className={tdCls}>{s.mechanic_name}</td>
                  <td className={`${tdCls} text-right`}>{toNum(s.full_days)}</td>
                  <td className={`${tdCls} text-right`}>{toNum(s.half_days)}</td>
                  <td className={`${tdCls} text-right`}>{toNum(s.total_days).toFixed(1)}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{rupee(toNum(s.daily_salary),2)}</td>
                  <td className={`${tdCls} text-right text-amber-400 font-bold tabular-nums`}>{rupee(toNum(s.salary_earned),2)}</td>
                </tr>
              ))}
          </tbody>
          {salaryDetails.length > 0 && <tfoot><tr className="border-t border-[#21293d] bg-[#111520]"><td colSpan={5} className={`${tdCls} text-right font-extrabold`}>Total</td><td className={`${tdCls} text-right text-amber-400 font-black tabular-nums`}>{rupee(totalSalary,2)}</td></tr></tfoot>}
        </Modal>
      )}

      {/* Staff Advance */}
      {modal === "advance" && (
        <Modal title={`Staff Advance Payments — ${displayFrom} to ${displayTo}`} icon={Users} onClose={closeModal}>
          <thead><tr>{["Date","Staff","Amount","Reason","Mode"].map(h=><th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {advancePayments.length === 0 ? <tr><td colSpan={5} className="py-10 text-center text-slate-600">Koi advance nahi mila.</td></tr>
              : advancePayments.map((a,i) => (
                <tr key={i} className={trCls}>
                  <td className={`${tdCls} whitespace-nowrap`}>{safeFormatDate(a.date_paid)}</td>
                  <td className={tdCls}>{a.mechanic_name}</td>
                  <td className={`${tdCls} text-right text-red-400 font-bold tabular-nums`}>{rupee(toNum(a.amount),2)}</td>
                  <td className={tdCls}>{a.reason||"—"}</td>
                  <td className={tdCls}>{a.payment_mode||"Cash"}</td>
                </tr>
              ))}
          </tbody>
          {advancePayments.length > 0 && <tfoot><tr className="border-t border-[#21293d] bg-[#111520]"><td colSpan={2} className={`${tdCls} text-right font-extrabold`}>Total</td><td className={`${tdCls} text-right text-red-400 font-black tabular-nums`}>{rupee(totalAdvanceGiven,2)}</td><td colSpan={2}/></tr></tfoot>}
        </Modal>
      )}

      {/* Shop Expenses */}
      {modal === "shopexp" && (
        <Modal title={`Shop Expenses — ${displayFrom} to ${displayTo}`} icon={Building2} onClose={closeModal}>
          <thead><tr>{["Date","Category","Description","Amount","Mode","Reference"].map(h=><th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {expenses.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-slate-600">Koi expense nahi mila.</td></tr>
              : expenses.map((e,i) => (
                <tr key={i} className={trCls}>
                  <td className={`${tdCls} whitespace-nowrap`}>{safeFormatDate(e.date_created)}</td>
                  <td className={tdCls}>{e.category}</td>
                  <td className={tdCls}>{e.remarks}</td>
                  <td className={`${tdCls} text-right text-red-400 font-bold tabular-nums`}>{rupee(toNum(e.amount),2)}</td>
                  <td className={tdCls}>{e.payment_mode||"Cash"}</td>
                  <td className={tdCls}>{e.reference||"—"}</td>
                </tr>
              ))}
          </tbody>
          {expenses.length > 0 && <tfoot><tr className="border-t border-[#21293d] bg-[#111520]"><td colSpan={3} className={`${tdCls} text-right font-extrabold`}>Total</td><td className={`${tdCls} text-right text-red-400 font-black tabular-nums`}>{rupee(totalOtherExpenses,2)}</td><td colSpan={2}/></tr></tfoot>}
        </Modal>
      )}

      {/* Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          [class*="bg-[#"] { background: white !important; }
          [class*="border-[#"] { border-color: #e5e7eb !important; }
          [class*="text-slate"] { color: #374151 !important; }
          [class*="text-emerald"] { color: #059669 !important; }
          [class*="text-red"] { color: #dc2626 !important; }
          [class*="text-blue"] { color: #2563eb !important; }
        }
      `}</style>
    </div>
  );
}