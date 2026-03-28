"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, TrendingUp, Wallet, Printer, ChevronLeft, ChevronRight, Info, ArrowUp, ArrowDown, Calendar } from "lucide-react";
import { startOfMonthIST, endOfMonthIST, todayIST } from "@/lib/dateUtils";

type LedgerEntry = {
  date: string;
  category: string;
  details: string;
  type: 'Cash In' | 'Cash Out';
  net_amount: number;
  client_id?: number | null;
  client_fullname?: string;
};

type LedgerData = {
  clientPaymentsReceived: number;
  walkinIncome: number;
  totalAdvanceGiven: number;
  totalOtherExpenses: number;
  totalEmiPaid: number;
  clientPayments: any[];
  walkinSales: any[];
  advancePayments: any[];
  expenses: any[];
  loanPayments: any[];
  ledgerEntries: LedgerEntry[];
};

const rupee = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CashFlowPage() {
  const searchParams = useSearchParams();
  const today = todayIST();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LedgerData | null>(null);
  const [from, setFrom] = useState(() => searchParams.get("from") || startOfMonthIST());
  const [to, setTo] = useState(() => searchParams.get("to") || endOfMonthIST());
  const [viewMode, setViewMode] = useState<"month" | "day">("month");

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

  const navigateDay = (dir: "prev" | "next") => {
    const currentFrom = new Date(from);
    if (dir === "prev") {
      currentFrom.setDate(currentFrom.getDate() - 1);
    } else {
      currentFrom.setDate(currentFrom.getDate() + 1);
    }
    const newFrom = currentFrom.toISOString().split('T')[0];
    setFrom(newFrom);
    setTo(newFrom);
    setViewMode("day");
  };

  const navigateMonth = (dir: "prev" | "next") => {
    const currentFrom = new Date(from);
    if (dir === "prev") {
      currentFrom.setMonth(currentFrom.getMonth() - 1);
    } else {
      currentFrom.setMonth(currentFrom.getMonth() + 1);
    }
    const d = new Date(currentFrom.getFullYear(), currentFrom.getMonth(), 1);
    setFrom(startOfMonthIST(d));
    setTo(endOfMonthIST(d));
    setViewMode("month");
  };

  const goToToday = () => {
    setFrom(startOfMonthIST());
    setTo(endOfMonthIST());
    setViewMode("month");
  };

  const dateLabel = from === to ? formatDate(from) : `${formatDate(from)} — ${formatDate(to)}`;

  // Calculate totals
  const totalCashInflow = (data?.clientPaymentsReceived || 0) + (data?.walkinIncome || 0);
  const totalCashOutflow = (data?.totalAdvanceGiven || 0) + (data?.totalOtherExpenses || 0) + (data?.totalEmiPaid || 0);
  const netCash = totalCashInflow - totalCashOutflow;

  const sortedEntries = data?.ledgerEntries?.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <div className="bg-[#161b27] border-b border-[#21293d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <TrendingUp size={26} className="text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight leading-none">
                  Cash Flow
                </h1>
                <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.2em] mt-1">
                  {dateLabel}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => navigateDay("prev")}
                className="p-2 bg-[#111520] border border-[#21293d] rounded-lg text-slate-500 hover:text-white hover:border-blue-500/40 transition-all"
                title="Previous Day">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => navigateDay("next")}
                className="p-2 bg-[#111520] border border-[#21293d] rounded-lg text-slate-500 hover:text-white hover:border-blue-500/40 transition-all"
                title="Next Day">
                <ChevronRight size={16} />
              </button>
              <button onClick={() => window.open(`/api/print-ledger?from=${from}&to=${to}`, "_blank")}
                className="ml-2 flex items-center gap-2 px-4 py-2.5 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 rounded-xl text-xs font-extrabold transition-all">
                <Printer size={13} /> Print
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="no-print bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4 inline-flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-2">
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-1.5">From</label>
              <input 
                type="date" 
                value={from} 
                onChange={e => { setFrom(e.target.value); setViewMode("day"); }}
                className="bg-[#111520] border border-[#21293d] text-slate-300 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500/40 transition-all" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-1.5">To</label>
              <input 
                type="date" 
                value={to} 
                onChange={e => setTo(e.target.value)}
                className="bg-[#111520] border border-[#21293d] text-slate-300 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-emerald-500/40 transition-all" 
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={goToToday}
              className="px-3 py-2 bg-[#111520] hover:bg-[#21293d] text-slate-500 hover:text-white rounded-xl text-xs font-extrabold transition-all">
              This Month
            </button>
            
            <div className="h-8 w-px bg-[#21293d]"></div>

            <button 
              onClick={() => navigateMonth("prev")}
              className="flex items-center gap-1 px-3 py-2 bg-[#111520] hover:bg-[#21293d] text-slate-500 hover:text-white rounded-xl text-xs font-extrabold transition-all">
              <ChevronLeft size={14} /> Prev Month
            </button>
            
            <button 
              onClick={() => navigateMonth("next")}
              className="flex items-center gap-1 px-3 py-2 bg-[#111520] hover:bg-[#21293d] text-slate-500 hover:text-white rounded-xl text-xs font-extrabold transition-all">
              Next Month <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* View Mode Indicator */}
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-[#161b27] border border-[#21293d] rounded-lg">
          <Calendar size={12} className="text-slate-500" />
          <span className="text-[10px] font-bold text-slate-500 uppercase">
            {viewMode === "day" ? "Day View" : "Month View"}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-blue-400" />
        </div>
      ) : data ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Total Cash In</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <ArrowUp size={14} className="text-emerald-400" />
                </div>
              </div>
              <p className="text-lg font-black text-emerald-400">{rupee(totalCashInflow)}</p>
            </div>

            <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Total Cash Out</span>
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <ArrowDown size={14} className="text-red-400" />
                </div>
              </div>
              <p className="text-lg font-black text-red-400">{rupee(totalCashOutflow)}</p>
            </div>

            <div className={`bg-[#161b27] border rounded-2xl p-4 ${netCash >= 0 ? "border-emerald-500/20" : "border-red-500/20"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Net Cash Flow</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${netCash >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                  <Wallet size={14} className={netCash >= 0 ? "text-emerald-400" : "text-red-400"} />
                </div>
              </div>
              <p className={`text-lg font-black ${netCash >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {rupee(netCash)}
              </p>
            </div>

            <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Closing Balance</span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Wallet size={14} className="text-blue-400" />
                </div>
              </div>
              <p className="text-lg font-black text-blue-400">{rupee(netCash)}</p>
            </div>
          </div>

          {/* Cash Flow Summary Table */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#21293d] bg-[#111520]">
              <Wallet size={13} className="text-blue-400" />
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Cash Flow Summary</span>
            </div>
            <table className="w-full">
              <tbody>
                <tr className="border-b border-[#21293d]">
                  <td colSpan={2} className="px-4 py-2 text-[9px] font-extrabold uppercase tracking-widest text-slate-700 bg-[#0f1520]">
                    Cash Inflow
                  </td>
                </tr>
                <tr className="border-b border-[#21293d]/50">
                  <td className="px-4 py-3 text-sm font-bold text-slate-200">Client Payments Received</td>
                  <td className="px-4 py-3 text-sm font-bold text-right text-emerald-400 tabular-nums">{rupee(data.clientPaymentsReceived)}</td>
                </tr>
                <tr className="border-b border-[#21293d]/50">
                  <td className="px-4 py-3 text-sm font-bold text-slate-200">Walk-in Direct Sales (Cash)</td>
                  <td className="px-4 py-3 text-sm font-bold text-right text-emerald-400 tabular-nums">{rupee(data.walkinIncome)}</td>
                </tr>
                <tr className="border-b border-[#21293d] bg-emerald-500/5">
                  <td className="px-4 py-2.5 text-xs font-extrabold text-emerald-400">Total Cash In</td>
                  <td className="px-4 py-2.5 text-xs font-black text-right text-emerald-400 tabular-nums">{rupee(totalCashInflow)}</td>
                </tr>

                <tr className="border-b border-[#21293d]">
                  <td colSpan={2} className="px-4 py-2 text-[9px] font-extrabold uppercase tracking-widest text-slate-700 bg-[#0f1520]">
                    Cash Outflow
                  </td>
                </tr>
                <tr className="border-b border-[#21293d]/50">
                  <td className="px-4 py-3 text-sm font-bold text-slate-200">Staff Advance / Salary Paid</td>
                  <td className="px-4 py-3 text-sm font-bold text-right text-red-400 tabular-nums">{rupee(data.totalAdvanceGiven)}</td>
                </tr>
                <tr className="border-b border-[#21293d]/50">
                  <td className="px-4 py-3 text-sm font-bold text-slate-200">Shop Expenses Paid</td>
                  <td className="px-4 py-3 text-sm font-bold text-right text-red-400 tabular-nums">{rupee(data.totalOtherExpenses)}</td>
                </tr>
                <tr className="border-b border-[#21293d]/50">
                  <td className="px-4 py-3 text-sm font-bold text-slate-200">Loan EMI Paid</td>
                  <td className="px-4 py-3 text-sm font-bold text-right text-red-400 tabular-nums">{rupee(data.totalEmiPaid || 0)}</td>
                </tr>
                <tr className="border-b border-[#21293d] bg-red-500/5">
                  <td className="px-4 py-2.5 text-xs font-extrabold text-red-400">Total Cash Out</td>
                  <td className="px-4 py-2.5 text-xs font-black text-right text-red-400 tabular-nums">{rupee(totalCashOutflow)}</td>
                </tr>

                <tr className="bg-blue-500/10">
                  <td className="px-4 py-3 text-sm font-black text-white">Net Cash Flow</td>
                  <td className={`px-4 py-3 text-sm font-black text-right tabular-nums ${netCash >= 0 ? "text-blue-400" : "text-red-400"}`}>
                    {rupee(netCash)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Detailed Transaction List */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#21293d] bg-[#111520]">
              <TrendingUp size={13} className="text-slate-500" />
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Transaction Details</span>
              <span className="ml-auto text-[10px] text-slate-600 font-bold">{sortedEntries.length} entries</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#0f1520]">
                    <th className="px-3 py-2.5 text-[9px] font-black uppercase text-slate-600 tracking-widest text-left">Date</th>
                    <th className="px-3 py-2.5 text-[9px] font-black uppercase text-slate-600 tracking-widest text-left">Category</th>
                    <th className="px-3 py-2.5 text-[9px] font-black uppercase text-slate-600 tracking-widest text-left">Details</th>
                    <th className="px-3 py-2.5 text-[9px] font-black uppercase text-slate-600 tracking-widest text-right">Cash In</th>
                    <th className="px-3 py-2.5 text-[9px] font-black uppercase text-slate-600 tracking-widest text-right">Cash Out</th>
                    <th className="px-3 py-2.5 text-[9px] font-black uppercase text-slate-600 tracking-widest text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-600 text-xs font-bold">No transactions found</td>
                    </tr>
                  ) : (
                    <>
                      {sortedEntries.map((entry, idx) => {
                        const prevBalance = idx === 0 ? 0 : sortedEntries.slice(0, idx).reduce((s, e) => 
                          s + (e.type === 'Cash In' ? e.net_amount : -e.net_amount), 0);
                        const balance = prevBalance + (entry.type === 'Cash In' ? entry.net_amount : -entry.net_amount);
                        const detailsComponent = entry.client_id ? (
                          <a href={`/clients/${entry.client_id}/view`} target="_blank" className="text-blue-400 hover:text-blue-300 hover:underline">
                            {entry.details}
                          </a>
                        ) : (
                          <span className="text-slate-300">{entry.details}</span>
                        );
                        return (
                          <tr key={idx} className="border-t border-[#21293d]/50 hover:bg-white/[0.02]">
                            <td className="px-3 py-2.5 text-xs text-slate-400">{formatDate(entry.date)}</td>
                            <td className="px-3 py-2.5">
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                                entry.type === 'Cash In' 
                                  ? 'bg-emerald-500/20 text-emerald-400' 
                                  : 'bg-red-500/20 text-red-400'
                              }`}>
                                {entry.category}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs">{detailsComponent}</td>
                            <td className="px-3 py-2.5 text-xs text-right text-emerald-400 font-bold">
                              {entry.type === 'Cash In' ? rupee(entry.net_amount) : ''}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-right text-red-400 font-bold">
                              {entry.type === 'Cash Out' ? rupee(entry.net_amount) : ''}
                            </td>
                            <td className={`px-3 py-2.5 text-xs text-right font-bold ${balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                              {rupee(balance)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-blue-500/30 bg-blue-500/5">
                        <td colSpan={3} className="px-3 py-2.5 text-xs font-black text-blue-400">Total</td>
                        <td className="px-3 py-2.5 text-xs text-right font-black text-emerald-400">{rupee(totalCashInflow)}</td>
                        <td className="px-3 py-2.5 text-xs text-right font-black text-red-400">{rupee(totalCashOutflow)}</td>
                        <td className={`px-3 py-2.5 text-xs text-right font-black ${netCash >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{rupee(netCash)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Note */}
          <div className="bg-[#161b27] border border-amber-500/15 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info size={12} className="text-amber-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">Notes</span>
            </div>
            <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1">
              <li>Cash Flow shows actual cash received and paid during the period.</li>
              <li>Repair revenue is counted when job is delivered, not when cash is received.</li>
              <li>Client Payments represent cash recovery against outstanding invoices.</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-slate-500">No data available</div>
      )}
    </div>
  );
}
