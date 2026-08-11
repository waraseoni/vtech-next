"use client";

import { useEffect, useState, useCallback } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { Loader2, Printer, ChevronLeft, ChevronRight, Calendar } from "lucide-react";

import { todayIST, formatIST, parseISTDate } from "@/lib/dateUtils";

type Job = {
  id: number;
  code: string;
  client_name: string;
  mechanic_id: number | null;
  amount: number;
  status: number;
  date_created: string;
  date_updated: string;
};

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const fmtDate = (v: string) => formatIST(v.includes("T") ? v : v + "T00:00:00+05:30", { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (v: string) => formatIST(v, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Pending", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  1: { label: "Accepted", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  2: { label: "In Progress", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  3: { label: "Ready", color: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  4: { label: "Cancelled", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  5: { label: "Delivered", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
};

export default function DailyServiceReportPage() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [date, setDate] = useState(todayIST());
  const [err, setErr] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const { data, error } = await supabase
        .from("transaction_list")
        .select("id, code, client_name, mechanic_id, amount, status, date_created, date_updated")
        .eq("del_status", 0)
        .gte("date_created", date + "T00:00:00+05:30")
        .lte("date_created", date + "T23:59:59+05:30")
        .order("date_created", { ascending: true });
      if (error) throw error;
      setJobs((data || []) as Job[]);
    } catch (e) {
      const err = e as { message?: string; details?: string };
      setErr(err.message || err.details || JSON.stringify(e));
    }
    setLoading(false);
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totals = {
    count: jobs.length,
    amount: jobs.reduce((s, j) => s + (j.amount || 0), 0),
  };

  const shiftDay = (diff: number) => {
    const d = parseISTDate(date);
    d.setDate(d.getDate() + diff);
    setDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d));
  };

  const handlePrint = () => {
    const printContent = document.getElementById("print-area")?.innerHTML;
    if (!printContent) return;
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return;
    popup.document.write(`<html><head><title>Daily Service Report - ${fmtDate(date)}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111827}
        h2{text-align:center;margin-bottom:4px} .subtitle{text-align:center;color:#666;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #ddd;padding:8px;font-size:13px}
        th{background:#f1f5f9;text-align:left;font-weight:600}
        .text-right{text-align:right}.text-center{text-align:center}
        tfoot th{background:#f1f5f9;text-align:right;font-size:14px}
        @media print{body{padding:0}}
      </style></head><body>${printContent}</body></html>`);
    popup.document.close();
    setTimeout(() => { popup.print(); setTimeout(() => popup.close(), 300); }, 300);
  };

  return (
    <AdminPage title="Daily Service" subtitle="Jobs created per day">
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => shiftDay(-1)} className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 transition">
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21293d] rounded-xl px-4 py-2">
              <Calendar size={14} className="text-slate-600" />
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="bg-transparent text-sm text-slate-200 outline-none" />
            </div>
            <button onClick={() => shiftDay(1)} className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 transition">
              <ChevronRight size={16} />
            </button>
            <button onClick={() => setDate(todayIST())} className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1a2234] transition">
              Today
            </button>
          </div>
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1a2234] transition">
            <Printer size={14} /> Print
          </button>
        </div>

        <div className="px-5 py-3 border-b border-[#1a2234] bg-[#0d1117]/50 grid grid-cols-3 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-600">
          <div>Jobs: <span className="text-slate-300 font-bold ml-1">{totals.count}</span></div>
          <div>Total: <span className="text-emerald-400 font-bold ml-1">{inr(totals.amount)}</span></div>
          <div>Date: <span className="text-slate-300 font-bold ml-1">{fmtDate(date)}</span></div>
        </div>

        {err && <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">{err}</div>}

        <div id="print-area">
          <div className="hidden print:block mb-6">
            <h2 className="text-xl font-black">V-Technologies</h2>
            <p className="subtitle text-sm">Daily Service Report — {fmtDate(date)}</p>
          </div>

          {loading ? (
            <div className="px-5 py-12 text-center">
              <Loader2 size={24} className="animate-spin text-slate-600 mx-auto mb-2" />
              <p className="text-slate-600 text-xs font-extrabold uppercase tracking-widest">Loading...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-600 text-sm">No jobs found for this date.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#111520]">
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                    <th className="text-left px-4 py-3">#</th>
                    <th className="text-left px-4 py-3">Code</th>
                    <th className="text-left px-4 py-3">Client ID</th>
                    <th className="text-left px-4 py-3">Created</th>
                    <th className="text-left px-4 py-3">Updated</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-center px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2234]">
                  {jobs.map((job, i) => {
                    const st = STATUS_LABELS[job.status] || { label: "Unknown", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" };
                    return (
                      <tr key={job.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3.5 text-slate-600">{i + 1}</td>
                        <td className="px-4 py-3.5 font-black text-blue-400">{job.code}</td>
                        <td className="px-4 py-3.5 text-slate-300 font-bold">{job.client_name}</td>
                        <td className="px-4 py-3.5 text-slate-400">{fmtDateTime(job.date_created)}</td>
                        <td className="px-4 py-3.5 text-slate-400">{fmtDateTime(job.date_updated)}</td>
                        <td className="px-4 py-3.5 text-right font-black text-emerald-400">{inr(job.amount)}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-[#111520]">
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                    <th className="px-4 py-3 text-right" colSpan={5}>Total</th>
                    <th className="px-4 py-3 text-right text-emerald-400">{inr(totals.amount)}</th>
                    <th className="px-4 py-3 text-center">{totals.count} Jobs</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
