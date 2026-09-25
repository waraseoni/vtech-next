"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { fetchStockByProducts, type StockRow } from "@/lib/inventoryStock";
import { todayIST } from "@/lib/dateUtils";
import {
  ArrowLeft,
  Printer,
  RefreshCw,
  Search,
  Loader2,
  PackageX,
  AlertTriangle,
  Link2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "@/lib/toast";

// I5 — Oversold / Negative Stock report.
// Source: I1 single-stock RPC (`get_inventory_stock`) — ek hi canonical formula.
// Oversell allowed hai (design decision), ye report management ko dikhata hai
// ki kaunse products negative hain aur wo negative job se aaya ya sale se.

const fmtDay = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

interface OversoldRow extends StockRow {
  name: string;
}

export default function OversoldReport() {
  const today = todayIST();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OversoldRow[]>([]);
  const [firmName, setFirmName] = useState("");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: sys }, stockMap] = await Promise.all([
        supabase.from("system_info").select("meta_field, meta_value"),
        fetchStockByProducts(),
      ]);

      const info: Record<string, string> = {};
      (sys || []).forEach((r) => (info[r.meta_field] = r.meta_value));
      setFirmName(info.name || "V-Technologies");

      const ids = [...stockMap.values()].filter((s) => s.available < 0).map((s) => s.product_id);
      if (ids.length === 0) {
        setRows([]);
        return;
      }

      const { data: prods } = await supabase
        .from("product_list")
        .select("id, name")
        .in("id", ids);

      const nameMap = new Map<number, string>();
      (prods || []).forEach((p) => nameMap.set(p.id, p.name));

      const oversold: OversoldRow[] = ids
        .map((id) => {
          const s = stockMap.get(id)!;
          return { ...s, name: nameMap.get(id) || `Product #${id}` };
        })
        .sort((a, b) => a.available - b.available); // most negative pehle
      setRows(oversold);
    } catch (e) {
      console.error(e);
      toast.error("Stock load nahi ho paya");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const totalNegativeUnits = rows.reduce((s, r) => s + Math.abs(r.available), 0);
  const totalSoldJob = rows.reduce((s, r) => s + r.total_sold_job, 0);
  const totalSoldSale = rows.reduce((s, r) => s + r.total_sold_sale, 0);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, q]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* Print header */}
      <div className="hidden print:block">
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
          <div>
            <div className="text-2xl font-black">{firmName}</div>
            <div className="text-sm">
              Oversold / Negative Stock — as on {fmtDay.format(new Date(today))}
            </div>
          </div>
          <div className="text-right text-sm">Generated: {fmtDay.format(new Date(today))}</div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-panel border border-app rounded-[2rem] p-6 shadow-2xl relative overflow-hidden no-print">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div className="flex items-center gap-5">
            <Link
              href="/reports"
              className="w-12 h-12 flex items-center justify-center bg-app border border-app rounded-2xl text-muted hover:text-white hover:bg-red-600/10 hover:border-red-500/40 transition-all group"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-700 rounded-3xl flex items-center justify-center shadow-xl shadow-red-500/20 ring-4 ring-red-500/10">
              <PackageX size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Oversold Stock</h1>
              <p className="text-xs text-muted font-bold uppercase tracking-[0.3em]">
                Negative availability — jobs vs sales
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
              className="flex items-center gap-2 px-5 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-amber-600/20"
            >
              <Printer size={14} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-red-600 to-rose-900 rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">
            Products Negative
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">{rows.length}</div>
          <div className="text-[10px] text-red-200/70 font-bold mt-1">
            available &lt; 0 (canonical stock)
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-600 to-amber-900 rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">
            Negative Units
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">
            {totalNegativeUnits.toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-orange-200/70 font-bold mt-1">
            total shortfall across rows
          </div>
        </div>
        <div className="bg-gradient-to-br from-slate-600 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">
            Sold via Jobs
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">
            {totalSoldJob.toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-slate-300/70 font-bold mt-1">
            transaction_products (non-cancelled)
          </div>
        </div>
        <div className="bg-gradient-to-br from-cyan-600 to-cyan-900 rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">
            Sold via Sales
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">
            {totalSoldSale.toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-cyan-200/70 font-bold mt-1">direct_sale_items</div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 no-print">
        <div className="relative flex-1 max-w-md">
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product..."
            className="w-full bg-panel border border-app rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold text-app-2 outline-none focus:border-red-500/50 transition-all"
          />
        </div>
        <div className="text-[10px] font-black uppercase tracking-widest text-muted">
          {filtered.length} of {rows.length}
        </div>
      </div>

      {/* Table / states */}
      <div className="bg-panel border border-app rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 size={32} className="animate-spin text-red-500 mx-auto" />
            <p className="text-muted text-sm font-bold mt-3">Loading negative stock...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto">
              <PackageX size={30} className="text-emerald-400" />
            </div>
            <p className="text-white font-black text-lg mt-4">Koi negative stock nahi</p>
            <p className="text-muted text-sm font-bold mt-1">
              Sab products ka available 0 ya positive hai.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-panel-2 border-b border-app">
                  <th className="px-4 py-3.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-muted-2">
                    #
                  </th>
                  <th className="px-4 py-3.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-muted-2">
                    Product
                  </th>
                  <th className="px-4 py-3.5 text-right text-[10px] font-extrabold uppercase tracking-wider text-muted-2">
                    Stock In
                  </th>
                  <th className="px-4 py-3.5 text-right text-[10px] font-extrabold uppercase tracking-wider text-muted-2">
                    Sold (Jobs)
                  </th>
                  <th className="px-4 py-3.5 text-right text-[10px] font-extrabold uppercase tracking-wider text-muted-2">
                    Sold (Sales)
                  </th>
                  <th className="px-4 py-3.5 text-right text-[10px] font-extrabold uppercase tracking-wider text-muted-2">
                    Available
                  </th>
                  <th className="px-4 py-3.5 text-right text-[10px] font-extrabold uppercase tracking-wider text-muted-2">
                    Shortfall
                  </th>
                  <th className="px-4 py-3.5 text-left text-[10px] font-extrabold uppercase tracking-wider text-muted-2">
                    Location
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21293d]">
                {filtered.map((r, i) => (
                  <tr key={r.product_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs font-bold text-muted">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/inventory/${r.product_id}`}
                        className="text-xs font-black text-white hover:text-red-400 transition-colors inline-flex items-center gap-1.5"
                      >
                        {r.name}
                        <Link2 size={11} className="text-muted" />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-app-2">
                      {r.total_in.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-app-2">
                      {r.total_sold_job.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-app-2">
                      {r.total_sold_sale.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-black text-red-400">
                      {r.available}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] font-black text-red-400">
                        <AlertTriangle size={11} /> {Math.abs(r.available)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] font-bold text-muted truncate max-w-[200px]">
                      {r.place || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-panel-2 border-t border-app">
                  <td
                    colSpan={5}
                    className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-muted-2 text-right"
                  >
                    Total shortfall
                  </td>
                  <td className="px-4 py-3 text-right font-black text-red-400">
                    −{totalNegativeUnits.toLocaleString("en-IN")}
                  </td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Note */}
      <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 no-print">
        <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-500/90 font-bold leading-relaxed">
          Oversell allowed by design — ye report deliberate oversell ko shrinkage/typo se alag
          karne ke liye hai. Stock theek karne ke liye Inventory → Stock Use karein (physical count
          ke liye Inventory → Stocktake).
        </p>
      </div>
    </div>
  );
}
