"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Loader2, ChevronLeft, ChevronRight,
  Printer, TrendingUp, Eye, FileText, Calendar,
} from "lucide-react";

const inr = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type CommRow = {
  id: number;
  job_id: string;
  code: string | null;
  date_created: string;
  mechanic_id: number;
  m_name: string;
  service_amount: number;
  mechanic_commission_amount: number;
};

function CommissionContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month,      setMonthState] = useState(searchParams.get("month")       || currentMonth);
  const [mechanicId, setMechState]  = useState(searchParams.get("mechanic_id") || "all");
  const [loading,    setLoading]    = useState(true);
  const [rows,       setRows]       = useState<CommRow[]>([]);
  const [mechanics,  setMechanics]  = useState<{ id: number; name: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // URL sync helpers
  const setMonth = (m: string) => {
    setMonthState(m);
    const p = new URLSearchParams(searchParams.toString());
    p.set("month", m);
    router.replace("?" + p.toString(), { scroll: false });
  };
  const setMechanicId = (id: string) => {
    setMechState(id);
    const p = new URLSearchParams(searchParams.toString());
    id === "all" ? p.delete("mechanic_id") : p.set("mechanic_id", id);
    router.replace("?" + p.toString(), { scroll: false });
  };

  // ── fetchData — EXACT 9KB WORKING LOGIC — DO NOT CHANGE ──────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const from = `${month}-01T00:00:00`;
      const toDate = new Date(month + "-01");
      toDate.setMonth(toDate.getMonth() + 1);
      const to = toDate.toISOString().split("T")[0] + "T23:59:59";

      // 1. Parallel fetch: Mechanics and Transactions
      const [mechRes, txnRes] = await Promise.all([
        supabase
          .from("mechanic_list")
          .select("id, firstname, middlename, lastname")
          .eq("delete_flag", 0)
          .order("firstname"),
        (() => {
          let q = supabase
            .from("transaction_list")
            .select("id, job_id, code, date_created, mechanic_id, mechanic_commission_amount")
            .gte("date_created", from)
            .lte("date_created", to);
          if (mechanicId !== "all") q = q.eq("mechanic_id", parseInt(mechanicId));
          return q;
        })()
      ]);

      const mechData = mechRes.data || [];
      const txns = txnRes.data || [];

      setMechanics(
        mechData.map((m) => ({
          id: m.id,
          name: [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" "),
        }))
      );

      // 2. Batch fetch ALL services for these transactions
      const txnIds = txns.map(t => t.id);
      const svcMap: Record<number, number> = {};
      if (txnIds.length > 0) {
        // PostgREST limits IN clause, but for a month's worth of jobs, it's usually fine (<1000)
        const { data: svcs } = await supabase
          .from("transaction_services")
          .select("transaction_id, price")
          .in("transaction_id", txnIds);
        
        svcs?.forEach(s => {
          svcMap[s.transaction_id] = (svcMap[s.transaction_id] || 0) + (s.price || 0);
        });
      }

      // 3. Map everything in memory — NO more awaits in loop
      const enriched: CommRow[] = txns.map((t) => {
        const mech = mechData.find((m) => m.id === t.mechanic_id);
        const mechName = mech
          ? [mech.firstname, mech.middlename, mech.lastname].filter(Boolean).join(" ")
          : "Unknown";

        return {
          id:                         t.id,
          job_id:                     t.job_id || String(t.id),
          code:                       t.code || null,
          date_created:               t.date_created,
          mechanic_id:                t.mechanic_id,
          m_name:                     mechName,
          service_amount:             svcMap[t.id] || 0,
          mechanic_commission_amount: t.mechanic_commission_amount || 0,
        };
      });

      // Sort newest first + filter zero commission (as per original logic)
      enriched.sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
      setRows(enriched.filter((r) => r.mechanic_commission_amount > 0));
      setCurrentPage(1); // Reset to first page on new data
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [month, mechanicId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const navigate = (dir: "prev" | "next") => {
    const d = new Date(month + "-01");
    d.setMonth(d.getMonth() + (dir === "prev" ? -1 : 1));
    setMonth(d.toISOString().slice(0, 7));
  };

  const totalComm  = rows.reduce((s, r) => s + r.mechanic_commission_amount, 0);
  const monthLabel = new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // Per-mechanic summary
  const byMechanic = rows.reduce<Record<number, { name: string; total: number; jobs: number }>>(
    (acc, r) => {
      if (!acc[r.mechanic_id]) acc[r.mechanic_id] = { name: r.m_name, total: 0, jobs: 0 };
      acc[r.mechanic_id].total += r.mechanic_commission_amount;
      acc[r.mechanic_id].jobs  += 1;
      return acc;
    }, {}
  );
  const summary = Object.values(byMechanic).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
            <TrendingUp size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Commission History</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Staff commission report</p>
          </div>
        </div>
        <button onClick={() => window.open(`/api/print-mechanics-commission?month=${month}&mechanic_id=${mechanicId}`, "_blank")}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all">
          <Printer size={14} /> Print
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Month:</span>
          <button onClick={() => navigate("prev")}
            className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 hover:text-white transition-all">
            <ChevronLeft size={14} />
          </button>
          <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21293d] rounded-xl px-4 py-2">
            <Calendar size={14} className="text-slate-600" />
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-200 outline-none" />
          </div>
          <button onClick={() => navigate("next")}
            className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 hover:text-white transition-all">
            <ChevronRight size={14} />
          </button>

          <div className="h-6 w-px bg-[#21293d] mx-1" />

          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Staff:</span>
          <select value={mechanicId} onChange={(e) => setMechanicId(e.target.value)}
            className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500 transition-all">
            <option value="all">All Staff</option>
            {mechanics.map((m) => (
              <option key={m.id} value={String(m.id)}>{m.name}</option>
            ))}
          </select>

          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rows:</span>
          <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
            className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500 transition-all">
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>

          <span className="ml-auto text-sm font-black text-white hidden sm:block">{monthLabel}</span>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && mechanicId === "all" && summary.length > 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {summary.map((e) => (
            <div key={e.name} className="bg-[#161b27] border border-[#21293d] rounded-xl px-4 py-3">
              <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{e.name}</p>
              <p className="text-base font-black text-emerald-400 mt-1">{inr(e.total)}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">{e.jobs} jobs</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#21293d] flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-300">Commission Statement — {monthLabel}</h2>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-slate-500">Total Commission</p>
            <p className="text-lg font-black text-emerald-400">{inr(totalComm)}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={24} className="animate-spin text-blue-400" />
            <p className="text-slate-600 text-xs font-black uppercase tracking-wider">Loading...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
            <FileText size={36} className="text-slate-700" />
            <p className="text-sm font-bold">No commission records for this period</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#111520]">
                    {["#", "Date", "Job ID / Code", "Staff", "Service Amt", "Commission", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left last:text-center">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((r, i) => (
                    <tr key={r.id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5 text-xs text-slate-500">{i + 1}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(r.date_created).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-xs font-bold text-blue-400">#{r.job_id}</div>
                        {r.code && <div className="text-[10px] text-slate-600">{r.code}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold text-slate-200">{r.m_name}</td>
                      <td className="px-3 py-2.5 text-xs text-right text-slate-300">{inr(r.service_amount)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-black text-emerald-400">{inr(r.mechanic_commission_amount)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <a href={`/jobs/${r.id}/view`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-lg text-xs font-bold transition-all">
                          <Eye size={11} /> View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-blue-500/30 bg-blue-500/5">
                    <td colSpan={5} className="px-3 py-3 text-xs font-black text-slate-400 text-right">
                      Total Commission ({rows.length} jobs):
                    </td>
                    <td className="px-3 py-3 text-sm text-right font-black text-emerald-400">{inr(totalComm)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination Footer */}
            {rows.length > rowsPerPage && (
              <div className="bg-[#111520] px-5 py-3 flex items-center justify-between border-t border-[#21293d] flex-wrap gap-3">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, rows.length)} of {rows.length} records
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest px-3 border-x border-[#21293d] min-w-[120px] text-center">
                    Page {currentPage} of {Math.ceil(rows.length / rowsPerPage)}
                  </div>
                  <button onClick={() => setCurrentPage(prev => Math.min(Math.ceil(rows.length / rowsPerPage), prev + 1))} disabled={currentPage === Math.ceil(rows.length / rowsPerPage)}
                    className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CommissionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin text-blue-400" /></div>}>
      <CommissionContent />
    </Suspense>
  );
}