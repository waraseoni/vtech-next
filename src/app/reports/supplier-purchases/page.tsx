"use client";

import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { todayIST, startOfMonthIST } from "@/lib/dateUtils";
import { fetchSupplierPurchases, type SupplierPurchaseRow } from "@/lib/supplierPurchases";
import {
  ArrowLeft,
  Printer,
  RefreshCw,
  Search,
  Loader2,
  ShoppingCart,
  Package,
  ChevronDown,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";

const fmtDay = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const inr = (n: number) =>
  "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtMonth = (k: string) => {
  const [y, m] = k.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
};

export default function SupplierPurchasesReport() {
  const today = todayIST();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SupplierPurchaseRow[]>([]);
  const [trend, setTrend] = useState<{ month: string; amount: number }[]>([]);
  const [search, setSearch] = useState("");
  const [firmName, setFirmName] = useState("");
  const [from, setFrom] = useState(startOfMonthIST());
  const [to, setTo] = useState(today);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: sys }, report] = await Promise.all([
        supabase.from("system_info").select("meta_field, meta_value"),
        fetchSupplierPurchases(from, to),
      ]);
      const info: Record<string, string> = {};
      (sys || []).forEach((r) => (info[r.meta_field] = r.meta_value));
      setFirmName(info.name || "V-Technologies");
      setRows(report.rows);
      setTrend(report.monthlyTrend);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, q]);

  const totalSpend = filtered.reduce((s, r) => s + r.totalAmount, 0);
  const totalPos = filtered.reduce((s, r) => s + r.poCount, 0);
  const totalQty = filtered.reduce((s, r) => s + r.qtyOrdered, 0);
  const avgUnit = totalQty > 0 ? totalSpend / totalQty : 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* Print header */}
      <div className="hidden print:block">
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
          <div>
            <div className="text-2xl font-black">{firmName}</div>
            <div className="text-sm">
              Supplier Purchases — {fmtDay.format(new Date(from))} to {fmtDay.format(new Date(to))}
            </div>
          </div>
          <div className="text-right text-sm">Generated: {fmtDay.format(new Date(today))}</div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-panel border border-app rounded-[2rem] p-6 shadow-2xl relative overflow-hidden no-print">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div className="flex items-center gap-5">
            <Link
              href="/reports"
              className="w-12 h-12 flex items-center justify-center bg-app border border-app rounded-2xl text-muted hover:text-white hover:bg-emerald-600/10 hover:border-emerald-500/40 transition-all group"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-500/10">
              <ShoppingCart size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Supplier Purchases</h1>
              <p className="text-xs text-muted font-bold uppercase tracking-[0.3em]">
                Kharidari summary per supplier
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="flex items-center gap-2 px-5 py-3 bg-app border border-app rounded-2xl text-xs font-black uppercase tracking-widest text-muted hover:text-white transition-all"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-600/20"
            >
              <Printer size={14} /> Print List
            </button>
          </div>
        </div>

        {/* Date range + search */}
        <div className="mt-5 flex flex-col lg:flex-row lg:items-end gap-4 relative">
          <div className="flex flex-wrap items-end gap-2.5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-muted-2 mb-1.5 flex items-center gap-1">
                <CalendarDays size={11} /> From
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => e.target.value && setFrom(e.target.value)}
                className="bg-app border border-app rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-muted-2 mb-1.5 flex items-center gap-1">
                <CalendarDays size={11} /> To
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => e.target.value && setTo(e.target.value)}
                className="bg-app border border-app rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 [color-scheme:dark]"
              />
            </div>
            <div className="flex items-center gap-1.5 pb-1">
              <button
                onClick={() => {
                  setFrom(today);
                  setTo(today);
                }}
                className={`px-3 py-2 rounded-lg text-[11px] font-black border transition-all ${
                  from === to && to === today
                    ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/40"
                    : "bg-app text-muted border-app hover:text-white"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => {
                  const t = new Date();
                  const f = new Date(t.getTime() - 6 * 86400000);
                  setFrom(
                    new Intl.DateTimeFormat("en-CA", {
                      timeZone: "Asia/Kolkata",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    }).format(f)
                  );
                  setTo(today);
                }}
                className="px-3 py-2 rounded-lg text-[11px] font-black border bg-app text-muted border-app hover:text-white transition-all"
              >
                7 Din
              </button>
              <button
                onClick={() => {
                  const t = new Date();
                  const f = new Date(t.getTime() - 29 * 86400000);
                  setFrom(
                    new Intl.DateTimeFormat("en-CA", {
                      timeZone: "Asia/Kolkata",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    }).format(f)
                  );
                  setTo(today);
                }}
                className="px-3 py-2 rounded-lg text-[11px] font-black border bg-app text-muted border-app hover:text-white transition-all"
              >
                30 Din
              </button>
              <button
                onClick={() => {
                  setFrom(startOfMonthIST());
                  setTo(today);
                }}
                className={`px-3 py-2 rounded-lg text-[11px] font-black border transition-all ${
                  from === startOfMonthIST() && to === today
                    ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/40"
                    : "bg-app text-muted border-app hover:text-white"
                }`}
              >
                This Month
              </button>
            </div>
          </div>
          <div className="relative lg:ml-auto lg:w-64">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Supplier dhoondo…"
              className="w-full bg-app border border-app rounded-2xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-muted-2 outline-none focus:border-emerald-500/40 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 no-print">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">
            Total Spend
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">{inr(totalSpend)}</div>
          <div className="text-[10px] sm:text-xs font-bold opacity-70 mt-1 truncate">
            Is period me khareeda
          </div>
        </div>
        <div className="bg-gradient-to-br from-sky-600 to-indigo-800 rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">
            Purchase Orders
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">{totalPos}</div>
          <div className="text-[10px] sm:text-xs font-bold opacity-70 mt-1 truncate">
            {filtered.length} suppliers active
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-700 rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">
            Qty Ordered
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">
            {totalQty.toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] sm:text-xs font-bold opacity-70 mt-1 truncate">
            Items ordered
          </div>
        </div>
        <div className="bg-gradient-to-br from-violet-600 to-purple-800 rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">
            Avg Unit Cost
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">{inr(avgUnit)}</div>
          <div className="text-[10px] sm:text-xs font-bold opacity-70 mt-1 truncate">
            Overall weighted
          </div>
        </div>
      </div>

      {/* Monthly trend */}
      {trend.length > 0 && (
        <div className="bg-panel border border-app rounded-2xl p-5 no-print">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-2">
              Monthly Spend
            </h3>
            <span className="text-[10px] text-muted-2 font-bold">
              {fmtDay.format(new Date(from))} → {fmtDay.format(new Date(to))}
            </span>
          </div>
          <div className="flex items-end gap-2 sm:gap-3 h-28">
            {trend.map((t) => {
              const max = Math.max(...trend.map((x) => x.amount), 1);
              const h = Math.max(6, Math.round((t.amount / max) * 100));
              return (
                <div key={t.month} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                  <div className="text-[9px] text-emerald-300 font-black">
                    ₹{Math.round(t.amount / 1000)}
                    {t.amount >= 1000 ? "k" : ""}
                  </div>
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600/80 to-teal-500/60 hover:from-emerald-500 hover:to-teal-400 transition-all"
                    style={{ height: `${h}%` }}
                    title={`${fmtMonth(t.month)} — ${inr(t.amount)}`}
                  />
                  <div className="text-[9px] text-muted font-bold truncate w-full text-center">
                    {fmtMonth(t.month)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-panel border border-app rounded-[2rem] overflow-hidden">
        <div className="px-6 py-4 border-b border-app flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-2">
            Supplier breakdown
          </h3>
          <span className="text-[10px] text-muted-2 font-bold">{filtered.length} suppliers</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-panel-2">
              <tr className="text-[10px] font-black uppercase tracking-widest text-muted-2">
                <th className="text-left px-5 py-3"></th>
                <th className="text-left px-4 py-3">Supplier</th>
                <th className="text-center px-4 py-3">POs</th>
                <th className="text-right px-4 py-3">Qty Ordered</th>
                <th className="text-right px-4 py-3">Qty Received</th>
                <th className="text-right px-4 py-3">Avg Unit Cost</th>
                <th className="text-right px-4 py-3">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Loader2 size={26} className="animate-spin text-emerald-400 inline" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-2 font-bold">
                    Is period me koi purchase nahi.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const open = expanded === String(r.supplierId);
                  return (
                    <Fragment key={r.supplierId}>
                      <tr
                        onDoubleClick={() => setExpanded(open ? null : String(r.supplierId))}
                        className="border-t border-app/50 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-5 py-3">
                          {r.products.length > 0 && (
                            <button
                              onClick={() => setExpanded(open ? null : String(r.supplierId))}
                              className="p-1 rounded-lg bg-white/5 text-muted hover:text-emerald-300 hover:bg-emerald-600/10 transition-colors"
                            >
                              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/suppliers/${r.supplierId}`}
                            className="text-sm font-bold text-white hover:text-emerald-300 transition-colors"
                          >
                            {r.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-app-2 font-bold">
                          {r.poCount}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-app-2">
                          {r.qtyOrdered.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted">
                          {r.qtyReceived.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-violet-300 font-bold">
                          {inr(r.avgUnitCost)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-emerald-300 font-black">
                          {inr(r.totalAmount)}
                        </td>
                      </tr>
                      {open && r.products.length > 0 && (
                        <tr key={`${r.supplierId}-breakdown`}>
                          <td colSpan={7} className="px-5 pb-4 bg-panel-2/60">
                            <div className="flex items-center gap-2 mb-2 text-[10px] font-black uppercase tracking-widest text-muted-2">
                              <Package size={11} /> Inhone kya-kya supply kiya
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-app">
                              <table className="w-full">
                                <thead className="bg-app">
                                  <tr className="text-[9px] font-black uppercase tracking-widest text-muted-2">
                                    <th className="text-left px-4 py-2">Product</th>
                                    <th className="text-right px-4 py-2">Qty Ordered</th>
                                    <th className="text-right px-4 py-2">Qty Received</th>
                                    <th className="text-right px-4 py-2">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.products.map((p) => (
                                    <tr
                                      key={p.productName}
                                      className="border-t border-app/40"
                                    >
                                      <td className="px-4 py-2 text-sm font-bold text-app-2">
                                        {p.productName}
                                      </td>
                                      <td className="px-4 py-2 text-right text-sm text-muted">
                                        {p.qtyOrdered.toLocaleString("en-IN")}
                                      </td>
                                      <td className="px-4 py-2 text-right text-sm text-muted">
                                        {p.qtyReceived.toLocaleString("en-IN")}
                                      </td>
                                      <td className="px-4 py-2 text-right text-sm text-emerald-300 font-bold">
                                        {inr(p.amount)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
