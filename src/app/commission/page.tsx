"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, ChevronLeft, ChevronRight, Printer, BarChart2, Wrench } from "lucide-react";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
import { currentMonthIST, parseISTDate } from "@/lib/dateUtils";

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

  const currentMonth = currentMonthIST();
  const [month, setMonth] = useState(searchParams.get("month") || currentMonth);
  const [mechanicId, setMechanicId] = useState(searchParams.get("mechanic_id") || "all");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CommRow[]>([]);
  const [mechanics, setMechanics] = useState<{ id: number; name: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const from = `${month}-01T00:00:00+05:30`;
      const [year, m] = month.split("-").map(Number);
      const lastDay = new Date(year, m, 0).getDate();
      const to = `${month}-${String(lastDay).padStart(2, "0")}T23:59:59+05:30`;

      // 1. Parallel fetch
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

      // 2. Batch fetch services
      const txnIds = txns.map(t => t.id);
      const svcMap: Record<number, number> = {};
      if (txnIds.length > 0) {
        const { data: svcs } = await supabase
          .from("transaction_services")
          .select("transaction_id, price")
          .in("transaction_id", txnIds);
        
        svcs?.forEach(s => {
          svcMap[s.transaction_id] = (svcMap[s.transaction_id] || 0) + (s.price || 0);
        });
      }

      // 3. Enrich in memory
      const enriched: CommRow[] = txns.map((t) => {
        const mech = mechData.find((m) => m.id === t.mechanic_id);
        const mechName = mech ? [mech.firstname, mech.middlename, mech.lastname].filter(Boolean).join(" ") : "Unknown";
        
        return {
          id: t.id, 
          job_id: t.job_id || String(t.id), 
          code: t.code,
          date_created: t.date_created, 
          mechanic_id: t.mechanic_id,
          m_name: mechName, 
          service_amount: svcMap[t.id] || 0,
          mechanic_commission_amount: t.mechanic_commission_amount || 0,
        };
      });

      enriched.sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
      setRows(enriched);
      setCurrentPage(1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [month, mechanicId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const navigate = (dir: "prev" | "next") => {
    const d = parseISTDate(month + "-01");
    if (dir === "prev") d.setMonth(d.getMonth() - 1);
    else d.setMonth(d.getMonth() + 1);
    setMonth(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(d));
  };

  const totalComm = rows.reduce((s, r) => s + (r.mechanic_commission_amount || 0), 0);
  const monthLabel = parseISTDate(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white flex items-center gap-2">
            <BarChart2 size={18} className="text-blue-400" /> Mechanic Commission History
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Monthly commission breakdown</p>
        </div>
        <button onClick={() => window.open(`/api/print-commission?month=${month}&mechanic_id=${mechanicId}`, "_blank")}
          className="flex items-center gap-2 px-4 py-2 bg-[#161b27] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:border-blue-500/40 transition-all">
          <Printer size={13} /> Print
        </button>
      </div>

      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">Month</label>
            <div className="flex items-center gap-1">
              <button onClick={() => navigate("prev")}
                className="px-2 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-slate-400 hover:text-white hover:border-blue-500/40 transition-all">
                <ChevronLeft size={14} />
              </button>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50" />
              <button onClick={() => navigate("next")}
                className="px-2 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-slate-400 hover:text-white hover:border-blue-500/40 transition-all">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">Staff</label>
            <select value={mechanicId} onChange={(e) => setMechanicId(e.target.value)}
              className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50">
              <option value="all">All Staff</option>
              {mechanics.map((m) => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">Rows</label>
            <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
              className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50">
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
          <div className="flex-1 text-center">
            <span className="text-sm font-black text-white">Commission Statement — {monthLabel}</span>
          </div>
        </div>
      </div>

      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#111520]">
                {["#", "Date", "Job ID / Code", "Staff", "Service Amount", "Commission"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 size={20} className="animate-spin text-blue-400 mx-auto" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-600 text-xs font-bold">No commission records found</td></tr>
              ) : (
                <>
                  {rows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((r, i) => (
                    <tr key={r.id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5 text-xs text-slate-500 text-center">{(currentPage - 1) * rowsPerPage + i + 1}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-400">
                        {new Date(r.date_created).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-xs font-bold text-blue-400">#{r.job_id}</div>
                        <div className="text-[10px] text-slate-600">{r.code || "—"}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold text-slate-200">{r.m_name}</td>
                      <td className="px-3 py-2.5 text-xs text-right text-slate-300">{inr(r.service_amount)}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-black text-emerald-400">{inr(r.mechanic_commission_amount)}</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-blue-500/30 bg-blue-500/5">
                <td colSpan={4} className="px-3 py-3 text-xs font-black text-slate-400 text-right">Total Commission:</td>
                <td className="px-3 py-3" />
                <td className="px-3 py-3 text-sm text-right font-black text-emerald-400">{inr(totalComm)}</td>
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
