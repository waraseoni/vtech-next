"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import {
  Loader2,
  Printer,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Wrench,
  Package,
  PackageCheck,
  IndianRupee,
  CalendarDays,
  User,
} from "lucide-react";

import { todayIST, formatIST, parseISTDate } from "@/lib/dateUtils";
import { SERVICE_STATUS } from "@/lib/status-colors";

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
const fmtDate = (v: string) =>
  formatIST(v.includes("T") ? v : v + "T00:00:00+05:30", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const fmtDateTime = (v: string) =>
  formatIST(v, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
const fmtTime = (v: string) => formatIST(v, { hour: "2-digit", minute: "2-digit", hour12: true });

const STATUS_MAP: Record<number, { label: string; color: string }> = Object.fromEntries(
  Object.entries(SERVICE_STATUS).map(([k, v]) => [Number(k), { label: v.label, color: v.cls }])
);

const statColors: Record<string, string> = {
  blue: "from-blue-500 to-blue-700 shadow-blue-500/20",
  emerald: "from-emerald-500 to-emerald-700 shadow-emerald-500/20",
  amber: "from-amber-500 to-amber-700 shadow-amber-500/20",
  violet: "from-violet-500 to-violet-700 shadow-violet-500/20",
};

function StatCard({
  icon,
  label,
  value,
  color = "blue",
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 min-w-0">
      <div
        className={`w-10 h-10 sm:w-11 sm:h-11 shrink-0 bg-gradient-to-br ${
          statColors[color] || statColors.blue
        } rounded-xl flex items-center justify-center text-white shadow-lg`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 truncate">
          {label}
        </p>
        <p className="text-sm sm:text-base font-black text-white truncate">{value}</p>
      </div>
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-slate-500">
      <Loader2 size={22} className="animate-spin text-blue-400" />
      <p className="mt-3 text-[10px] font-black uppercase tracking-widest">{label}</p>
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-slate-600">
      <PackageCheck size={24} className="text-slate-700" />
      <p className="mt-2 text-xs font-bold">{message}</p>
    </div>
  );
}

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totals = {
    count: jobs.length,
    delivered: jobs.filter((j) => j.status === 5).length,
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
    setTimeout(() => {
      popup.print();
      setTimeout(() => popup.close(), 300);
    }, 300);
  };

  return (
    <AdminPage>
      <div className="space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-3 justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 shrink-0 bg-gradient-to-br from-violet-500 to-violet-700 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Wrench size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                Daily Service Report
              </h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5 truncate">
                Jobs created per day
              </p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            disabled={loading || jobs.length === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 shrink-0 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:border-violet-500/40 hover:bg-[#151b28] disabled:opacity-40 disabled:pointer-events-none transition-all"
          >
            <Printer size={14} /> Print
          </button>
        </div>

        {/* Date navigation */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3 sm:p-4 flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => shiftDay(-1)}
              title="Previous day"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-[#0d1117] border border-[#21293d] text-slate-400 hover:text-white hover:border-violet-500/40 transition"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2">
              <Calendar size={14} className="text-violet-400/70 shrink-0" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-200 outline-none [color-scheme:dark]"
              />
            </div>
            <button
              onClick={() => shiftDay(1)}
              title="Next day"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-[#0d1117] border border-[#21293d] text-slate-400 hover:text-white hover:border-violet-500/40 transition"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setDate(todayIST())}
              className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:border-violet-500/40 transition"
            >
              Today
            </button>
          </div>
          <span className="text-xs font-black text-amber-400/90 tracking-wide ml-auto">
            {fmtDate(date)}
          </span>
        </div>

        {err && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
            {err}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={<Package size={18} />} label="Jobs" value={totals.count} color="blue" />
          <StatCard
            icon={<PackageCheck size={18} />}
            label="Delivered"
            value={totals.delivered}
            color="violet"
          />
          <StatCard
            icon={<IndianRupee size={18} />}
            label="Total Amount"
            value={inr(totals.amount)}
            color="emerald"
          />
          <StatCard
            icon={<CalendarDays size={18} />}
            label="Report Date"
            value={fmtDate(date)}
            color="amber"
          />
        </div>

        {/* Desktop table (inside print area) */}
        <div id="print-area" className="hidden md:block">
          <div className="hidden print:block mb-6">
            <h2 className="text-xl font-black">V-Technologies</h2>
            <p className="subtitle text-sm">Daily Service Report — {fmtDate(date)}</p>
          </div>
          {loading ? (
            <LoadingBlock label="Loading jobs..." />
          ) : jobs.length === 0 ? (
            <EmptyBlock message="No jobs found for this date." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#21293d]">
              <div className="overflow-auto max-h-[calc(100vh-340px)]">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="sticky top-0 z-10 bg-[#111520]">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <th className="text-left px-4 py-3.5">#</th>
                      <th className="text-left px-4 py-3.5">Code</th>
                      <th className="text-left px-4 py-3.5">Client</th>
                      <th className="text-left px-4 py-3.5">Created</th>
                      <th className="text-left px-4 py-3.5">Updated</th>
                      <th className="text-right px-4 py-3.5">Total</th>
                      <th className="text-center px-4 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2234]">
                    {jobs.map((job, i) => {
                      const st = STATUS_MAP[job.status] || {
                        label: "Unknown",
                        color: "bg-slate-500/10 text-slate-400 border-slate-500/20",
                      };
                      return (
                        <tr key={job.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-slate-600">{i + 1}</td>
                          <td className="px-4 py-3">
                            <span className="inline-block font-black text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-lg px-2 py-0.5 text-[11px]">
                              {job.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-200">{job.client_name}</td>
                          <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                            {fmtDateTime(job.date_created)}
                          </td>
                          <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                            {fmtDateTime(job.date_updated)}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-emerald-400">
                            {inr(job.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap border ${st.color}`}
                            >
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-10 bg-[#111520]">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-4 py-3 text-right" colSpan={5}>
                        Total
                      </th>
                      <th className="px-4 py-3 text-right text-emerald-400">
                        {inr(totals.amount)}
                      </th>
                      <th className="px-4 py-3 text-center text-slate-300">{totals.count} Jobs</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Mobile cards */}
        <div className="md:hidden">
          {loading ? (
            <LoadingBlock label="Loading jobs..." />
          ) : jobs.length === 0 ? (
            <EmptyBlock message="No jobs found for this date." />
          ) : (
            <div className="space-y-3">
              {jobs.map((job, i) => {
                const st = STATUS_MAP[job.status] || {
                  label: "Unknown",
                  color: "bg-slate-500/10 text-slate-400 border-slate-500/20",
                };
                return (
                  <div
                    key={job.id}
                    className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-100 truncate">{job.code}</p>
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                          #{i + 1} · {job.client_name}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap border ${st.color}`}
                        >
                          {st.label}
                        </span>
                        <p className="text-sm font-black text-emerald-400">{inr(job.amount)}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-[#1a2234] space-y-2 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-slate-400 min-w-0">
                          <User size={11} className="text-violet-300/70 shrink-0" />
                          <span className="truncate">{job.client_name}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-slate-500 shrink-0">
                          <CalendarDays size={11} className="text-slate-600" />
                          {fmtTime(job.date_created)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">
                          Created{" "}
                          <span className="text-slate-300 font-bold">
                            {fmtDateTime(job.date_created)}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
