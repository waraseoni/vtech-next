"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2, TrendingUp, Wallet, Printer, ChevronLeft, ChevronRight,
  Info, ArrowUp, ArrowDown, Calendar, Filter, Download, Zap,
  TrendingDown, PieChart as PieChartIcon, Activity
} from "lucide-react";
import { startOfMonthIST, endOfMonthIST, formatIST, toISTDatePart } from "@/lib/dateUtils";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from "recharts";

type LedgerEntry = {
  date: string;
  category: string;
  details: string;
  type: 'Cash In' | 'Cash Out';
  net_amount: number;
  client_id?: number | null;
  client_fullname?: string;
};

type DbRow = ReturnType<typeof JSON.parse>;

type LedgerData = {
  clientPaymentsReceived: number;
  walkinIncome: number;
  totalAdvanceGiven: number;
  totalOtherExpenses: number;
  totalEmiPaid: number;
  clientPayments: DbRow[];
  walkinSales: DbRow[];
  advancePayments: DbRow[];
  expenses: DbRow[];
  loanPayments: DbRow[];
  ledgerEntries: LedgerEntry[];
};

const rupee = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

const COLORS = {
  inflow: ['#10b981', '#34d399', '#059669', '#6ee7b7'],
};

function CashFlowPageInner() {
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LedgerData | null>(null);
  const [from, setFrom] = useState(() => searchParams.get("from") || startOfMonthIST());
  const [to, setTo] = useState(() => searchParams.get("to") || endOfMonthIST());
  const [viewMode, setViewMode] = useState<"month" | "day">("month");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/reports/ledger?${params}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const f = searchParams.get("from");
    const t = searchParams.get("to");
    if (f && isValidDate(f)) setFrom(f);
    if (t && isValidDate(t)) setTo(t);
  }, [searchParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Detect theme for chart colors only
  useEffect(() => {
    const check = () => setTheme((document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark");
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const isDark = theme === "dark";

  const stats = useMemo(() => {
    if (!data) return null;
    const inflow = (data.clientPaymentsReceived || 0) + (data.walkinIncome || 0);
    const outflow = (data.totalAdvanceGiven || 0) + (data.totalOtherExpenses || 0) + (data.totalEmiPaid || 0);
    const net = inflow - outflow;

    const inflowDistribution = [
      { name: 'Client Payments', value: data.clientPaymentsReceived },
      { name: 'Walk-in Revenue', value: data.walkinIncome },
    ].filter(v => v.value > 0);

    const dailyDataMap: Record<string, { date: string; inflow: number; outflow: number; net: number }> = {};
    data.ledgerEntries.forEach(entry => {
      // Extract just the YYYY-MM-DD part for daily grouping
      const d = entry.date.split('T')[0].split(' ')[0];
      if (!dailyDataMap[d]) dailyDataMap[d] = { date: d, inflow: 0, outflow: 0, net: 0 };
      if (entry.type === 'Cash In') dailyDataMap[d].inflow += entry.net_amount;
      else dailyDataMap[d].outflow += entry.net_amount;
      dailyDataMap[d].net = dailyDataMap[d].inflow - dailyDataMap[d].outflow;
    });
    const trendData = Object.values(dailyDataMap).sort((a, b) => a.date.localeCompare(b.date));

    return { inflow, outflow, net, inflowDistribution, trendData };
  }, [data]);

  const sortedEntries = useMemo(() =>
    data?.ledgerEntries?.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [],
    [data]);

  const navigateDay = (dir: "prev" | "next") => {
    const d = new Date(from);
    d.setDate(d.getDate() + (dir === "next" ? 1 : -1));
    const s = toISTDatePart(d);
    setFrom(s); setTo(s); setViewMode("day");
  };

  const navigateMonth = (dir: "prev" | "next") => {
    const d = new Date(from);
    d.setMonth(d.getMonth() + (dir === "next" ? 1 : -1));
    const base = new Date(d.getFullYear(), d.getMonth(), 1);
    setFrom(startOfMonthIST(base)); setTo(endOfMonthIST(base)); setViewMode("month");
  };

  const dateLabel = from === to
    ? formatIST(from, { day: '2-digit', month: 'short', year: 'numeric' })
    : `${formatIST(from, { day: '2-digit', month: 'short' })} — ${formatIST(to, { day: '2-digit', month: 'short', year: 'numeric' })}`;

  // Chart colors change per theme
  const chartGrid = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.07)";
  const chartAxis = isDark ? "#64748b" : "#94a3b8";
  const tooltipBg = isDark ? "#161b27" : "#ffffff";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)";
  const tooltipColor = isDark ? "#f1f5f9" : "#0f172a";

  return (
    <div className="min-h-screen bg-[#161b27] text-slate-200 selection:bg-blue-500/30">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-[#21293d] bg-gradient-to-b from-[#111520] to-[#0d1117]">
        <div className="absolute -top-24 -left-20 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
        <div className="absolute top-40 -right-20 w-80 h-80 bg-emerald-600/5 blur-[120px] rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 animate-pulse" />
                <div className="w-14 h-14 rounded-2xl bg-[#111520] border border-[#21293d] flex items-center justify-center shadow-2xl relative z-10">
                  <Activity size={28} className="text-blue-400" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                  Cash Flow Insights
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">Live</span>
                </h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <Calendar size={13} className="text-slate-500 shrink-0" />
                  <p className="text-slate-400 text-sm font-semibold truncate">{dateLabel}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-[#111520]/50 p-1.5 rounded-2xl border-[#21293d] backdrop-blur-md">
              <div className="flex items-center gap-1 bg-[#111520] rounded-xl p-1 border-[#21293d]">
                <button onClick={() => navigateDay("prev")} className="p-2 hover:bg-[#21293d] rounded-lg text-slate-400 hover:text-white transition-all"><ChevronLeft size={18} /></button>
                <button onClick={() => navigateDay("next")} className="p-2 hover:bg-[#21293d] rounded-lg text-slate-400 hover:text-white transition-all"><ChevronRight size={18} /></button>
              </div>
              <button onClick={() => window.open(`/api/print-ledger?from=${from}&to=${to}`, "_blank")}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#111520] hover:bg-[#21293d] text-white border border-[#21293d] rounded-xl text-xs font-black transition-all shadow-lg active:scale-95">
                <Printer size={14} /> PRINT LEDGER
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between mb-8 gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-[#111520] border border-[#21293d] rounded-2xl p-1 pr-4 focus-within:border-blue-500/40 transition-all">
              <input type="date" value={from} onChange={e => { setFrom(e.target.value); setViewMode("day"); }}
                className="bg-transparent text-slate-300 px-3 py-2 text-sm outline-none w-[140px]" />
              <span className="text-slate-600 text-xs font-bold uppercase mx-1">to</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="bg-transparent text-slate-300 px-3 py-2 text-sm outline-none w-[140px]" />
            </div>
            <div className="hidden sm:flex items-center p-1 bg-[#111520] border border-[#21293d] rounded-2xl">
              <button onClick={() => { setFrom(startOfMonthIST()); setTo(endOfMonthIST()); setViewMode("month"); }}
                className="px-4 py-2 hover:bg-[#21293d] rounded-xl text-xs font-black text-slate-400 hover:text-white transition-all">THIS MONTH</button>
              <div className="h-4 w-px bg-[#21293d] mx-1" />
              <button onClick={() => navigateMonth("prev")} className="px-4 py-2 hover:bg-[#21293d] rounded-xl text-xs font-black text-slate-400 hover:text-white transition-all uppercase">Prev</button>
              <button onClick={() => navigateMonth("next")} className="px-4 py-2 hover:bg-[#21293d] rounded-xl text-xs font-black text-slate-400 hover:text-white transition-all uppercase">Next</button>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <Filter size={13} className="text-blue-400" />
            <span className="text-xs font-black text-blue-400 uppercase tracking-widest">{viewMode} VIEW</span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 animate-pulse" />
              <Loader2 size={40} className="animate-spin text-blue-500 relative z-10" />
            </div>
            <p className="text-slate-500 text-sm font-bold animate-pulse uppercase tracking-widest">Aggregating financial data...</p>
          </div>
        ) : stats ? (
          <div className="space-y-8">

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'CASH INFLOW',  value: stats.inflow,  icon: ArrowUp,  color: 'emerald' },
                { label: 'CASH OUTFLOW', value: stats.outflow, icon: ArrowDown, color: 'rose' },
                { label: 'NET POSITION', value: stats.net,     icon: Zap,       color: stats.net >= 0 ? 'blue' : 'amber' },
                { label: 'BOOK BALANCE', value: stats.net,     icon: Wallet,    color: 'purple' },
              ].map((stat, i) => {
                const cm: Record<string,string> = {
                  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
                  rose:    'bg-rose-500/10 border-rose-500/20 text-rose-400',
                  blue:    'bg-blue-500/10 border-blue-500/20 text-blue-400',
                  amber:   'bg-amber-500/10 border-amber-500/20 text-amber-400',
                  purple:  'bg-purple-500/10 border-purple-500/20 text-purple-400',
                };
                const bm: Record<string, string> = {
                  emerald: 'bg-emerald-500', rose: 'bg-rose-500', blue: 'bg-blue-500', amber: 'bg-amber-500', purple: 'bg-purple-500',
                };
                const lightColorMap: Record<string, string> = {
                  emerald: 'bg-grad-green text-white',
                  rose:    'bg-grad-red text-white',
                  blue:    'bg-grad-blue text-white',
                  amber:   'bg-grad-orange text-white',
                  purple:  'bg-grad-purple text-white',
                };
                return (
                  <div key={i} className="group relative">
                    <div className="relative bg-[#161b27] border border-[#21293d] rounded-3xl p-6 h-full transition-transform duration-300 group-hover:-translate-y-1 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{stat.label}</p>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${cm[stat.color]} html[data-theme='light'] &:${lightColorMap[stat.color]}`}>
                          <stat.icon size={18} />
                        </div>
                      </div>
                      <h3 className="text-3xl font-black text-white tabular-nums tracking-tighter">{rupee(stat.value)}</h3>
                      <div className="mt-4 h-1.5 w-full rounded-full bg-[#21293d]/30 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${bm[stat.color]} html[data-theme='light'] &:${lightColorMap[stat.color]}`} style={{ width: '65%' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Area Chart */}
              <div className="lg:col-span-2 bg-[#161b27] border border-[#21293d] rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                  <TrendingUp size={220} strokeWidth={1} />
                </div>
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <div>
                    <h4 className="text-lg font-black text-white">Daily Cash Movement</h4>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Inflow vs Net position</p>
                  </div>
                  <div className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-black text-slate-400 border border-white/5">
                    {stats.trendData.length} POINTS
                  </div>
                </div>
                <div className="h-[300px] relative z-10">
                  <ResponsiveContainer width="100%" minHeight={200} height="100%">
                    <AreaChart data={stats.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={isDark ? 0.3 : 0.15} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={isDark ? 0.3 : 0.15} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGrid} />
                      <XAxis dataKey="date" tickFormatter={d => formatIST(d, { day: '2-digit', month: 'short' })}
                        axisLine={false} tickLine={false} tick={{ fill: chartAxis, fontSize: 10, fontWeight: 700 }} minTickGap={30} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: chartAxis, fontSize: 10, fontWeight: 700 }} tickFormatter={v => `₹${v / 1000}k`} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '14px', color: tooltipColor, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}
                        labelFormatter={l => formatIST(String(l), { dateStyle: 'medium' })}
                        formatter={(v) => [rupee(Number(v)), '']}
                      />
                      <Area type="monotone" dataKey="inflow" stroke="#10b981" fillOpacity={1} fill="url(#colorInflow)" strokeWidth={3} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                      <Area type="monotone" dataKey="net"    stroke="#3b82f6" fillOpacity={1} fill="url(#colorNet)"    strokeWidth={3} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart */}
              <div className="bg-[#161b27] border border-[#21293d] rounded-3xl p-6 flex flex-col">
                <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-5 border-b border-white/5 pb-4 flex items-center justify-between">
                  Inflow Sources <PieChartIcon size={13} className="text-emerald-400" />
                </h4>
                <div className="flex-1 h-[200px]">
                  <ResponsiveContainer width="100%" minHeight={200} height="100%">
                    <PieChart>
                      <Pie data={stats.inflowDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={82}
                        paddingAngle={8} dataKey="value" stroke="none" cornerRadius={4}>
                        {stats.inflowDistribution.map((_, idx) => (
                          <Cell key={idx} fill={COLORS.inflow[idx % COLORS.inflow.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px', fontSize: '12px', color: tooltipColor }}
                        formatter={(v) => rupee(Number(v))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {stats.inflowDistribution.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.inflow[i % COLORS.inflow.length] }} />
                        <span className="text-slate-400 font-bold truncate max-w-[120px]">{item.name}</span>
                      </div>
                      <span className="text-emerald-400 font-black">{rupee(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary Tables */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#161b27] border border-[#21293d] rounded-3xl overflow-hidden">
                <div className="px-6 py-4 bg-emerald-500/5 border-b border-[#21293d] flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Revenue Breakdown</span>
                  <TrendingUp size={15} className="text-emerald-500/50" />
                </div>
                <table className="w-full">
                  <tbody>
                    {[
                      { label: 'Client Payments (Recovery)', value: data?.clientPaymentsReceived || 0 },
                      { label: 'Direct Sales (Walk-in)',     value: data?.walkinIncome || 0 },
                    ].map((row, i) => (
                      <tr key={i} className={`${i > 0 ? 'border-t border-[#21293d]/50' : ''} hover:bg-white/[0.02] transition-colors`}>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-300">{row.label}</td>
                        <td className="px-5 py-4 text-sm font-black text-right text-emerald-400 tabular-nums">{rupee(row.value)}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-500/10 border-t border-[#21293d]">
                      <td className="px-5 py-4 text-xs font-black text-emerald-400 uppercase tracking-widest">Gross Inflow</td>
                      <td className="px-5 py-4 text-base font-black text-right text-emerald-400 tabular-nums">{rupee(stats.inflow)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-[#161b27] border border-[#21293d] rounded-3xl overflow-hidden">
                <div className="px-6 py-4 bg-rose-500/5 border-b border-[#21293d] flex items-center justify-between">
                  <span className="text-xs font-black text-rose-400 uppercase tracking-widest">Expense Categories</span>
                  <TrendingDown size={15} className="text-rose-500/50" />
                </div>
                <table className="w-full">
                  <tbody>
                    {[
                      { label: 'Payroll & Advances',  value: data?.totalAdvanceGiven || 0 },
                      { label: 'Operating Expenses',   value: data?.totalOtherExpenses || 0 },
                      { label: 'Debt Servicing (EMI)', value: data?.totalEmiPaid || 0 },
                    ].map((row, i) => (
                      <tr key={i} className={`${i > 0 ? 'border-t border-[#21293d]/50' : ''} hover:bg-white/[0.02] transition-colors`}>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-300">{row.label}</td>
                        <td className="px-5 py-4 text-sm font-black text-right text-rose-400 tabular-nums">{rupee(row.value)}</td>
                      </tr>
                    ))}
                    <tr className="bg-rose-500/10 border-t border-[#21293d]">
                      <td className="px-5 py-4 text-xs font-black text-rose-400 uppercase tracking-widest">Gross Outflow</td>
                      <td className="px-5 py-4 text-base font-black text-right text-rose-400 tabular-nums">{rupee(stats.outflow)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Transaction Ledger */}
            <div className="bg-[#161b27] border border-[#21293d] rounded-[2.5rem] overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-7 py-6 bg-[#111520]/50 border-b border-[#21293d]">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#111520] flex items-center justify-center border border-[#21293d]">
                    <TrendingUp size={18} className="text-slate-400" />
                  </div>
                  <div>
                    <span className="text-base font-black text-white uppercase tracking-tight">Ledger Detail</span>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{sortedEntries.length} TRANSACTIONS</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 bg-[#111520] hover:bg-[#21293d] border border-[#21293d] rounded-xl text-[10px] font-black uppercase transition-all"><Download size={12} /> CSV</button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-[#111520] hover:bg-[#21293d] border border-[#21293d] rounded-xl text-[10px] font-black uppercase transition-all"><Printer size={12} /> PDF</button>
                </div>
              </div>
              <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#111520]">
                      {['Timeline', 'Classification', 'Entity & Context', 'Inflow', 'Outflow', 'Running Net'].map((h, i) => (
                        <th key={h} className={`px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-20">
                          <div className="flex flex-col items-center gap-3">
                            <Info size={32} className="text-slate-700" />
                            <p className="text-slate-600 text-sm font-bold uppercase tracking-widest">No records found</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <>
                        {sortedEntries.map((entry, idx) => {
                          const prevBal = sortedEntries.slice(0, idx).reduce((s, e) => s + (e.type === 'Cash In' ? e.net_amount : -e.net_amount), 0);
                          const bal = prevBal + (entry.type === 'Cash In' ? entry.net_amount : -entry.net_amount);
                          return (
                            <tr key={idx} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors group">
                              <td className="px-6 py-4">
                                <span className="text-xs font-bold text-slate-400 group-hover:text-blue-400 transition-colors">
                                  {formatIST(entry.date, { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`text-[9px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest ${
                                  entry.type === 'Cash In'
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                }`}>
                                  {entry.category}
                                </span>
                              </td>
                              <td className="px-6 py-4 max-w-xs">
                                {entry.client_id ? (
                                  <a href={`/clients/${entry.client_id}/view`} target="_blank"
                                    className="text-xs font-black text-slate-200 hover:text-blue-400 underline decoration-white/10 decoration-2 underline-offset-4 decoration-dotted">
                                    {entry.details}
                                  </a>
                                ) : (
                                  <span className="text-xs font-semibold text-slate-400">{entry.details}</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm text-right font-black tabular-nums text-emerald-400">
                                {entry.type === 'Cash In' ? rupee(entry.net_amount) : <span className="text-slate-700 opacity-40">——</span>}
                              </td>
                              <td className="px-6 py-4 text-sm text-right font-black tabular-nums text-rose-400">
                                {entry.type === 'Cash Out' ? rupee(entry.net_amount) : <span className="text-slate-700 opacity-40">——</span>}
                              </td>
                              <td className={`px-6 py-4 text-sm text-right font-black tabular-nums ${bal >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                                {rupee(bal)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="border-t border-[#21293d] bg-[#111520]">
                          <td colSpan={3} className="px-6 py-5 text-sm font-black text-white tracking-widest uppercase">Summary Period Totals</td>
                          <td className="px-6 py-5 text-sm text-right font-black text-emerald-400 tabular-nums">{rupee(stats.inflow)}</td>
                          <td className="px-6 py-5 text-sm text-right font-black text-rose-400 tabular-nums">{rupee(stats.outflow)}</td>
                          <td className={`px-6 py-5 text-sm text-right font-black tabular-nums ${stats.net >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>{rupee(stats.net)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info Note */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-transparent blur opacity-20 group-hover:opacity-40 transition duration-1000" />
              <div className="relative bg-[#161b27] border border-amber-500/10 rounded-3xl p-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <Info size={18} className="text-amber-500" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-black text-amber-500 uppercase tracking-widest">Accounting Protocol</p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
                    {[
                      "Cash Flow reflects realized liquidity, NOT accrual income.",
                      "Client Payments represent cash-handover for historical debt.",
                      "Repair revenue recognized upon physical asset delivery.",
                      "Direct sales impact cash flow immediately upon checkout.",
                    ].map((txt, i) => (
                      <li key={i} className="text-[11px] text-slate-500 font-medium flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        {txt}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-40 bg-[#161b27] rounded-3xl border border-[#21293d] border-dashed">
            <TrendingUp size={48} className="text-slate-700 mb-4" />
            <h3 className="text-xl font-black text-slate-500 uppercase tracking-widest">No Data Found</h3>
            <p className="text-slate-600 text-xs font-bold mt-2 uppercase tracking-wider">No transaction records for this period</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-40" />
      </div>
    </div>
  );
}

export default function CashFlowPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CashFlowPageInner />
    </Suspense>
  );
}
