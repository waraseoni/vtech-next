"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { todayIST } from "@/lib/dateUtils";
import { fetchSupplierDues } from "@/lib/supplierPayments";
import {
  ArrowLeft,
  Printer,
  RefreshCw,
  Search,
  Loader2,
  Landmark,
  Wallet,
  TrendingDown,
  Truck,
} from "lucide-react";
import Link from "next/link";

const fmtDay = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const inr = (n: number) =>
  "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SupplierDuesReport() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<
    { supplierId: number; name: string; billed: number; paid: number; outstanding: number }[]
  >([]);
  const [search, setSearch] = useState("");
  const [firmName, setFirmName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: sys }, dues] = await Promise.all([
        supabase.from("system_info").select("meta_field, meta_value"),
        fetchSupplierDues(),
      ]);
      const info: Record<string, string> = {};
      (sys || []).forEach((r) => (info[r.meta_field] = r.meta_value));
      setFirmName(info.name || "V-Technologies");
      setRows(dues);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, q]);

  const onlyDues = filtered.filter((r) => r.outstanding !== 0);
  const totalDues = onlyDues.reduce((s, r) => s + Math.abs(r.outstanding), 0);
  const totalBilled = filtered.reduce((s, r) => s + r.billed, 0);
  const totalPaid = filtered.reduce((s, r) => s + r.paid, 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* Print header (only visible when printing) */}
      <div className="hidden print:block">
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
          <div>
            <div className="text-2xl font-black">{firmName}</div>
            <div className="text-sm">Supplier Dues / Outstanding Balance</div>
          </div>
          <div className="text-right text-sm">Generated: {fmtDay.format(new Date(todayIST()))}</div>
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
              <Landmark size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Supplier Dues</h1>
              <p className="text-xs text-muted font-bold uppercase tracking-[0.3em]">
                Outstanding balances per supplier
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
        <div className="mt-5 relative">
          <div className="relative max-w-md">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Supplier naam dhoondo…"
              className="w-full pl-10 pr-4 py-3 bg-app border border-app rounded-2xl text-sm text-app-2 placeholder:text-app outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 no-print">
        <div className="bg-panel border border-app rounded-2xl p-4 text-center">
          <p className="text-[10px] font-black uppercase text-muted-2 tracking-widest">
            Total Billed
          </p>
          <p className="text-lg font-black text-app-2 mt-1">{inr(totalBilled)}</p>
        </div>
        <div className="bg-panel border border-app rounded-2xl p-4 text-center">
          <p className="text-[10px] font-black uppercase text-muted-2 tracking-widest">
            Total Paid
          </p>
          <p className="text-lg font-black text-teal-400 mt-1">{inr(totalPaid)}</p>
        </div>
        <div className="bg-panel border border-app rounded-2xl p-4 text-center">
          <p className="text-[10px] font-black uppercase text-muted-2 tracking-widest">
            Suppliers With Dues
          </p>
          <p className="text-lg font-black text-amber-400 mt-1">{onlyDues.length}</p>
        </div>
        <div className="bg-panel border border-app rounded-2xl p-4 text-center">
          <p className="text-[10px] font-black uppercase text-muted-2 tracking-widest">
            Total Outstanding
          </p>
          <p className="text-lg font-black text-blue-400 mt-1">{inr(totalDues)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-panel border border-app rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-panel-2">
                {["Supplier", "Total Billed", "Total Paid", "Outstanding", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[10px] font-black uppercase text-muted-2 tracking-widest text-left"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <Loader2 size={20} className="animate-spin text-emerald-400 mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-2 text-xs font-bold">
                    No suppliers found.
                  </td>
                </tr>
              ) : (
                [...filtered]
                  .sort((a, b) => Math.abs(b.outstanding) - Math.abs(a.outstanding))
                  .map((r) => (
                    <tr
                      key={r.supplierId}
                      className="border-t border-app/50 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/suppliers/${r.supplierId}`}
                          className="text-sm font-bold text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-2"
                        >
                          <Truck size={13} className="text-muted-2" /> {r.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-right font-bold text-app-2">
                        {inr(r.billed)}
                      </td>
                      <td className="px-4 py-3 text-xs text-right font-bold text-teal-400">
                        {inr(r.paid)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.outstanding === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400">
                            <Wallet size={11} /> SETTLED
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-black ${
                              r.outstanding > 0 ? "text-amber-400" : "text-red-400"
                            }`}
                          >
                            <TrendingDown size={12} />
                            {inr(r.outstanding)} {r.outstanding > 0 ? "due" : "advance"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/suppliers/${r.supplierId}`}
                          className="text-[10px] font-black uppercase tracking-widest text-muted hover:text-emerald-400 transition-colors"
                        >
                          Details →
                        </Link>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
