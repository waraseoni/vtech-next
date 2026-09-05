"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { todayIST } from "@/lib/dateUtils";
import { fetchWaitingPartsReport, type WaitingJobGroup } from "@/lib/requiredParts";
import {
  ArrowLeft,
  Printer,
  RefreshCw,
  Search,
  Loader2,
  PackageSearch,
  Clock,
  Phone,
  Truck,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";

const JOB_STATUS: Record<number, { label: string; cls: string }> = {
  0: { label: "Pending", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  1: { label: "In Progress", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  2: { label: "Done", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  3: { label: "Paid", cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
};

const PART_STATUS: Record<number, { label: string; cls: string }> = {
  0: { label: "Waiting", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  1: { label: "Ordered", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  2: { label: "Arrived", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
};

const fmtDay = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const fmtShort = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" });

export default function PartsPendingReport() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<WaitingJobGroup[]>([]);
  const [search, setSearch] = useState("");
  const [firmName, setFirmName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: sys }, report] = await Promise.all([
        supabase.from("system_info").select("meta_field, meta_value"),
        fetchWaitingPartsReport(),
      ]);
      const info: Record<string, string> = {};
      (sys || []).forEach((r) => (info[r.meta_field] = r.meta_value));
      setFirmName(info.name || "V-Technologies");
      setGroups(report);
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
    if (!q) return groups;
    return groups.filter((g) =>
      [String(g.job_id ?? ""), g.clientLabel, g.item, ...g.parts.map((p) => p.product_name)]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [groups, q]);

  const totalJobs = filtered.length;
  const partsWaiting = filtered.reduce(
    (s, g) => s + g.parts.filter((p) => p.status === 0).length,
    0
  );
  const partsOrdered = filtered.reduce(
    (s, g) => s + g.parts.filter((p) => p.status === 1).length,
    0
  );
  const sources = new Set(
    filtered.flatMap((g) => g.parts.map((p) => p.supplier_id || p.source_name)).filter(Boolean)
  ).size;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* Print header (only visible when printing) */}
      <div className="hidden print:block">
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
          <div>
            <div className="text-2xl font-black">{firmName}</div>
            <div className="text-sm">Waiting for Part Purchase — Jobs</div>
          </div>
          <div className="text-right text-sm">Generated: {fmtDay.format(new Date(todayIST()))}</div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] p-6 shadow-2xl relative overflow-hidden no-print">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div className="flex items-center gap-5">
            <Link
              href="/reports"
              className="w-12 h-12 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-2xl text-slate-500 hover:text-white hover:bg-amber-600/10 hover:border-amber-500/40 transition-all group"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-indigo-700 rounded-3xl flex items-center justify-center shadow-xl shadow-sky-500/20 ring-4 ring-sky-500/10">
              <PackageSearch size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Waiting for Parts</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.3em]">
                Jobs stuck on spare purchase
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="flex items-center gap-2 px-5 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-amber-600/20"
            >
              <Printer size={14} /> Print List
            </button>
          </div>
        </div>
        <div className="mt-5 relative">
          <div className="relative max-w-md">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Job #, client, item ya part dhoondo…"
              className="w-full bg-[#0d1117] border border-[#21293d] rounded-2xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-600 outline-none focus:border-sky-500/40 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 no-print">
        <div className="bg-gradient-to-br from-sky-600 to-indigo-800 rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">
            Jobs Waiting
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">{totalJobs}</div>
          <div className="text-[10px] sm:text-xs font-bold opacity-70 mt-1 truncate">
            Delivery rudhne par auto-out
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-700 rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">
            Saman Waiting
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">{partsWaiting}</div>
          <div className="text-[10px] sm:text-xs font-bold opacity-70 mt-1 truncate">
            Abhi kharidna baaki
          </div>
        </div>
        <div className="bg-gradient-to-br from-sky-500 to-cyan-700 rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">
            Ordered
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">{partsOrdered}</div>
          <div className="text-[10px] sm:text-xs font-bold opacity-70 mt-1 truncate">
            Supplier se order ho chuka
          </div>
        </div>
        <div className="bg-gradient-to-br from-violet-600 to-purple-800 rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">
            Sources
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">{sources}</div>
          <div className="text-[10px] sm:text-xs font-bold opacity-70 mt-1 truncate">
            Alag-alag kharidari jagah
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-sky-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] p-14 text-center">
          <PackageSearch size={40} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-500 font-bold">
            {groups.length === 0
              ? "Koi job spare ke wait me nahi hai 🎉"
              : "Kuch bhi search me nahi mila"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((g) => {
            const badge = JOB_STATUS[g.jobStatus] || JOB_STATUS[0];
            return (
              <div
                key={g.transaction_id}
                className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden break-inside-avoid"
              >
                {/* Group header */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 border-b border-[#21293d] bg-[#111520]/60">
                  <Link
                    href={`/jobs/${g.transaction_id}/view`}
                    className="flex items-center gap-3 group"
                  >
                    <span className="w-11 h-11 bg-sky-600/10 border border-sky-500/30 rounded-xl flex items-center justify-center text-sky-300 font-black text-sm group-hover:bg-sky-600/20 transition-colors">
                      {String(g.job_id ?? g.transaction_id).toUpperCase()}
                    </span>
                    <div>
                      <div className="text-white font-black group-hover:text-sky-300 transition-colors">
                        {g.clientLabel}
                      </div>
                      <div className="text-xs text-slate-500 font-bold truncate max-w-[50vw]">
                        {g.item || "—"}
                      </div>
                    </div>
                  </Link>
                  <span
                    className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold ml-auto">
                    <Clock size={12} />
                    Waiting since {fmtDay.format(new Date(g.oldestWait))}
                  </div>
                </div>

                {/* Part rows */}
                <div className="divide-y divide-[#21293d]">
                  {g.parts.map((p) => {
                    const pBadge = PART_STATUS[p.status] || PART_STATUS[0];
                    const partial = p.qty_received > 0 && p.qty_received < p.qty_needed;
                    return (
                      <div
                        key={p.id}
                        className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-2 px-5 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {p.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.photo_url}
                              alt={p.product_name}
                              className="w-9 h-9 rounded-lg object-cover border border-[#21293d] flex-shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-[#0d1117] border border-[#21293d] flex items-center justify-center flex-shrink-0">
                              <Truck size={14} className="text-slate-600" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate">
                              {p.product_name}
                            </div>
                            <div className="text-[11px] text-slate-500 font-bold flex items-center gap-2 flex-wrap">
                              <span>
                                Qty:{" "}
                                <span className={partial ? "text-amber-300" : "text-slate-300"}>
                                  {p.qty_received}
                                </span>{" "}
                                / {p.qty_needed}
                              </span>
                              {p.remark ? <span className="truncate">• {p.remark}</span> : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${pBadge.cls}`}
                          >
                            {pBadge.label}
                          </span>
                          {(p.supplier_id || p.source_name) && (
                            <span className="text-[11px] text-slate-400 font-bold">
                              {p.supplier_id ? g.supplierName || p.source_name : p.source_name}
                            </span>
                          )}
                          {p.phone && (
                            <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1">
                              <Phone size={11} /> {p.phone}
                            </span>
                          )}
                          {p.eta && (
                            <span className="text-[11px] text-sky-300 font-bold flex items-center gap-1">
                              <CalendarDays size={11} /> {fmtShort.format(new Date(p.eta))}
                            </span>
                          )}
                        </div>

                        <div className="md:justify-self-end">
                          <Link
                            href={`/jobs/${g.transaction_id}/view`}
                            className="text-[11px] font-bold text-sky-400 hover:text-sky-300 transition-colors no-print"
                          >
                            Open job →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
