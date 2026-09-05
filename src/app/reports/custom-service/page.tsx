"use client";
import { useState, useEffect, useCallback, Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Loader2,
  Printer,
  Wrench,
  Package,
  ListChecks,
  IndianRupee,
  User,
  CalendarDays,
  Calendar,
  PackageCheck,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

import { todayIST, formatIST, startOfMonthIST, parseISTDate } from "@/lib/dateUtils";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const fmtDay = (v: string) =>
  formatIST(v.includes("T") ? v : v + "T00:00:00+05:30", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const fmtShort = (v: string) =>
  formatIST(v.includes("T") ? v : v + "T00:00:00+05:30", {
    day: "2-digit",
    month: "short",
  });

const statColors: Record<string, string> = {
  blue: "from-blue-500 to-blue-700 shadow-blue-500/20",
  emerald: "from-emerald-500 to-emerald-700 shadow-emerald-500/20",
  amber: "from-amber-500 to-amber-700 shadow-amber-500/20",
  violet: "from-violet-500 to-violet-700 shadow-violet-500/20",
};

type ServiceRow = {
  date_updated: string;
  code: string | null;
  client_name: string;
  service_name: string;
  description: string | null;
  price: number;
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

function CustomServiceContent() {
  const searchParams = useSearchParams();

  const [from, setFrom] = useState(searchParams.get("from") || startOfMonthIST());
  const [to, setTo] = useState(searchParams.get("to") || todayIST());
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ServiceRow[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const fromTs = `${from}T00:00:00+05:30`;
      const toTs = `${to}T23:59:59+05:30`;

      const { data: txns } = await supabase
        .from("transaction_list")
        .select("id, code, client_name, status, date_updated")
        .gte("date_updated", fromTs)
        .lte("date_updated", toTs)
        .in("status", [1, 2, 3, 5]);

      const txnIds = [...new Set(txns?.map((t) => t.id) || [])];
      const { data: tsData } = txnIds.length
        ? await supabase
            .from("transaction_services")
            .select("service_id, price, transaction_id")
            .in("transaction_id", txnIds)
        : { data: [] };

      const { data: clients } = await supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname")
        .eq("delete_flag", 0);
      const { data: services } = await supabase
        .from("service_list")
        .select("id, name, description")
        .eq("delete_flag", 0);

      const serviceRows: ServiceRow[] = [];
      for (const ts of tsData || []) {
        const txn = (txns || []).find((t) => t.id === ts.transaction_id);
        if (!txn) continue;
        const client = (clients || []).find((c) => c.id === txn.client_name);
        const service = (services || []).find((s) => s.id === ts.service_id);
        serviceRows.push({
          date_updated: txn.date_updated,
          code: txn.code,
          client_name: client
            ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ")
            : "Walk-in",
          service_name: service?.name || "Unknown",
          description: service?.description || null,
          price: ts.price || 0,
        });
      }
      serviceRows.sort(
        (a, b) => new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime()
      );
      setRows(serviceRows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const total = rows.reduce((s, r) => s + r.price, 0);
  const invoiceCount = new Set(rows.map((r) => r.code)).size;

  const applyRange = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
  };

  const setPreset = (preset: "today" | "week" | "month" | "year") => {
    const today = todayIST();
    if (preset === "today") return applyRange(today, today);
    if (preset === "week") {
      const d = parseISTDate(today);
      d.setDate(d.getDate() - 6);
      return applyRange(
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d),
        today
      );
    }
    if (preset === "month") return applyRange(startOfMonthIST(), today);
    return applyRange(`${today.slice(0, 4)}-01-01`, today);
  };

  const presets: { key: "today" | "week" | "month" | "year"; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "Last 7 Days" },
    { key: "month", label: "This Month" },
    { key: "year", label: "This Year" },
  ];

  const shiftMonth = (diff: number) => {
    const base = parseISTDate(from || startOfMonthIST());
    const d = new Date(base.getFullYear(), base.getMonth() + diff, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    applyRange(
      `${y}-${String(m).padStart(2, "0")}-01`,
      `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
    );
  };

  const resetRange = () => applyRange(startOfMonthIST(), todayIST());

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-3 justify-between">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 shrink-0 bg-gradient-to-br from-violet-500 to-violet-700 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Wrench size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-white leading-tight">
              Custom Service Report
            </h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5 truncate">
              Labor charges by date range
            </p>
          </div>
        </div>
        <button
          onClick={() => window.open(`/api/print-custom-service?from=${from}&to=${to}`, "_blank")}
          disabled={loading || rows.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 shrink-0 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:border-violet-500/40 hover:bg-[#151b28] disabled:opacity-40 disabled:pointer-events-none transition-all"
        >
          <Printer size={14} /> Print
        </button>
      </div>

      {/* Range filter */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2 sm:gap-3">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">
              From
            </label>
            <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2">
              <Calendar size={13} className="text-violet-400/70 shrink-0" />
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-200 outline-none [color-scheme:dark] w-full min-w-0"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">
              To
            </label>
            <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2">
              <Calendar size={13} className="text-violet-400/70 shrink-0" />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-200 outline-none [color-scheme:dark] w-full min-w-0"
              />
            </div>
          </div>
          <span className="hidden md:inline text-sm font-black text-white pb-2">
            {fmtShort(from)} — {fmtShort(to)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className="px-3 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-full text-[11px] font-bold text-slate-400 hover:text-white hover:border-violet-500/40 transition"
            >
              {p.label}
            </button>
          ))}
          <span className="w-px h-4 bg-[#21293d] mx-1 hidden sm:inline-block" />
          <button
            onClick={() => shiftMonth(-1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-full text-[11px] font-bold text-slate-400 hover:text-white hover:border-violet-500/40 transition"
          >
            <ChevronLeft size={13} /> Prev Month
          </button>
          <button
            onClick={() => shiftMonth(1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-full text-[11px] font-bold text-slate-400 hover:text-white hover:border-violet-500/40 transition"
          >
            Next Month <ChevronRight size={13} />
          </button>
          <button
            onClick={resetRange}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-full text-[11px] font-bold text-slate-400 hover:text-white hover:border-amber-500/40 transition"
          >
            <RotateCcw size={12} /> Reset
          </button>
          <span className="ml-auto text-[11px] font-black text-amber-400/90 md:hidden">
            {fmtShort(from)} — {fmtShort(to)}
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={<Package size={18} />} label="Invoices" value={invoiceCount} color="blue" />
        <StatCard
          icon={<ListChecks size={18} />}
          label="Services"
          value={rows.length}
          color="amber"
        />
        <StatCard
          icon={<IndianRupee size={18} />}
          label="Total Charges"
          value={inr(total)}
          color="emerald"
        />
        <StatCard
          icon={<CalendarDays size={18} />}
          label="Range"
          value={`${fmtShort(from)} — ${fmtShort(to)}`}
          color="violet"
        />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-[#21293d]">
        {loading ? (
          <LoadingBlock label="Loading services..." />
        ) : rows.length === 0 ? (
          <EmptyBlock message="No services found in this range." />
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-340px)]">
            <table className="w-full text-sm min-w-[780px]">
              <thead className="sticky top-0 z-10 bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <th className="text-left px-4 py-3.5">#</th>
                  <th className="text-left px-4 py-3.5">Date</th>
                  <th className="text-left px-4 py-3.5">Bill / Client</th>
                  <th className="text-left px-4 py-3.5">Service Name</th>
                  <th className="text-left px-4 py-3.5">Description</th>
                  <th className="text-right px-4 py-3.5">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-slate-600">{i + 1}</td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {fmtDay(r.date_updated)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-black text-violet-400">{r.code || "—"}</div>
                      <div className="text-xs text-slate-500">{r.client_name}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-100">{r.service_name}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">
                      {r.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-emerald-400">
                      {inr(r.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-3 text-right" colSpan={5}>
                    Total Service Charges ({fmtShort(from)} — {fmtShort(to)})
                  </th>
                  <th className="px-4 py-3 text-right text-emerald-400">{inr(total)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {loading ? (
          <LoadingBlock label="Loading services..." />
        ) : rows.length === 0 ? (
          <EmptyBlock message="No services found in this range." />
        ) : (
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={i} className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-100 truncate">{r.service_name}</p>
                    <p className="text-[10px] font-bold text-violet-400 mt-0.5">
                      #{i + 1} · {r.code || "—"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-black text-emerald-400">{inr(r.price)}</p>
                </div>
                {r.description && (
                  <p className="mt-2 text-[11px] text-slate-500 line-clamp-2">{r.description}</p>
                )}
                <div className="mt-3 pt-3 border-t border-[#1a2234] space-y-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-slate-400 min-w-0">
                      <User size={11} className="text-violet-300/70 shrink-0" />
                      <span className="truncate">{r.client_name}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-slate-500 shrink-0">
                      <CalendarDays size={11} className="text-slate-600" />
                      {fmtDay(r.date_updated)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomServicePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-blue-400" />
        </div>
      }
    >
      <CustomServiceContent />
    </Suspense>
  );
}
