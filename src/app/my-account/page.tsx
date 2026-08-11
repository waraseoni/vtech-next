"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wrench, Loader2, AlertCircle, Phone, Mail, Inbox, Clock, BookOpen, TrendingUp, TrendingDown } from "lucide-react";

type ClientInfo = {
  id: number; name: string; contact: string; email: string; opening_balance: number; due: number;
};

type Job = {
  id: number; job_id: string; code?: string | null; item?: string | null; fault?: string | null;
  remark?: string | null; status: number; amount?: number | null;
  date_created?: string | null; date_completed?: string | null;
};

const STATUS: Record<number, { label: string; cls: string }> = {
  0: { label: "Pending",        cls: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  1: { label: "In Progress",    cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  2: { label: "Done",           cls: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
  3: { label: "Paid",           cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  4: { label: "Cancelled",      cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  5: { label: "Delivered",      cls: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
};

const inr = (v: number) => "₹" + Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function MyAccountPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<number | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [meRes, jobsRes] = await Promise.all([
          fetch("/api/client/me"),
          fetch("/api/client/jobs"),
        ]);
        if (meRes.status === 401 || jobsRes.status === 401) {
          router.replace("/login");
          return;
        }
        if (!meRes.ok) throw new Error("me failed");
        if (!jobsRes.ok) throw new Error("jobs failed");
        const meData = await meRes.json();
        const jobsData = await jobsRes.json();
        setClient(meData.client);
        setJobs(jobsData.jobs || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load nahi hua");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const filtered = filter === "all" ? jobs : jobs.filter(j => j.status === filter);

  const countFor = useCallback((s: number) => jobs.filter(j => j.status === s).length, [jobs]);

  const FilterChip = ({ value, label }: { value: number | "all"; label: string }) => (
    <button
      onClick={() => setFilter(value)}
      className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all ${
        filter === value
          ? "bg-blue-600 text-white"
          : "bg-[#111520] text-slate-500 hover:text-slate-300 border border-[#21293d]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
          <Wrench size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-white">{client?.name || "Meri Repairs"}</h1>
          <p className="text-slate-500 text-xs mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5"><Phone size={12} />{client?.contact || "—"}</span>
            <span className="flex items-center gap-1.5"><Mail size={12} />{client?.email || "—"}</span>
            {client && client.opening_balance !== 0 && (
              <span className="flex items-center gap-1.5 font-bold text-amber-400">Opening Balance: {inr(client.opening_balance)}</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Total Repairs</p>
          <p className="text-3xl font-black text-white">{jobs.length}</p>
        </div>
      </div>

      {/* Due / Advance summary + Ledger link */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`rounded-2xl p-5 border ${
          !client || client.due === 0
            ? "bg-[#161b27] border-[#21293d]"
            : client.due > 0
              ? "bg-red-500/10 border-red-500/30"
              : "bg-emerald-500/10 border-emerald-500/30"
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {client && client.due > 0 ? "Due Amount" : client && client.due < 0 ? "Advance (Aapka Balance)" : "Due Amount"}
            </p>
            {client && client.due !== 0 && (
              client.due > 0
                ? <TrendingUp size={16} className="text-red-400" />
                : <TrendingDown size={16} className="text-emerald-400" />
            )}
          </div>
          {loading ? (
            <p className="text-3xl font-black text-white mt-1">…</p>
          ) : (
            <p className={`text-3xl font-black mt-1 ${client && client.due < 0 ? "text-emerald-400" : client && client.due > 0 ? "text-red-400" : "text-white"}`}>
              {inr(client?.due ?? 0)}
            </p>
          )}
          <p className="text-[11px] text-slate-600 mt-1.5">
            Opening + Repairs + Sales + Loans − Payments
          </p>
        </div>

        <Link href="/my-account/ledger" className="group">
          <div className="rounded-2xl p-5 border border-[#21293d] bg-[#161b27] hover:border-blue-500/40 hover:bg-[#1a2234] transition-all h-full flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center">
                <BookOpen size={18} className="text-white" />
              </div>
              <div>
                <p className="font-black text-white">Meri Ledger</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Apna pura hisaab-kitaab dekhein / print karein</p>
              </div>
            </div>
            <p className="text-xs font-bold text-blue-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">Kholen →</p>
          </div>
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-3 rounded-xl">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterChip value="all" label={`All (${jobs.length})`} />
        {Object.entries(STATUS).map(([k, v]) => (
          <FilterChip key={k} value={parseInt(k)} label={`${v.label} (${countFor(parseInt(k))})`} />
        ))}
      </div>

      {/* Jobs */}
      {loading ? (
        <div className="h-40 flex items-center justify-center text-slate-600">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#161b27] border border-dashed border-[#21293d] rounded-2xl p-10 text-center">
          <Inbox size={28} className="mx-auto text-slate-700" />
          <p className="text-slate-500 font-bold text-sm mt-3">Koi repair nahi mili</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(j => {
            const st = STATUS[j.status] || STATUS[0];
            return (
              <div key={j.id} className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg font-black text-white">#{j.job_id}</span>
                    {j.code && <span className="text-[11px] font-bold text-slate-500">Code: {j.code}</span>}
                  </div>
                  <span className={`text-[10px] font-extrabold px-2 py-1 rounded border ${st.cls}`}>{st.label}</span>
                </div>

                <p className="text-slate-200 font-bold text-sm mt-3">{j.item || "Item nahi likha"}</p>
                {j.fault && <p className="text-slate-500 text-xs mt-1">{j.fault}</p>}
                {j.remark && <p className="text-slate-600 text-xs mt-1 italic">{j.remark}</p>}

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#1a2234]">
                  <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                    <Clock size={12} />
                    <span className="block">
                      Received: {fmtDate(j.date_created)}
                      {j.status === 5 && j.date_completed && (
                        <> · Delivered: {fmtDate(j.date_completed)}</>
                      )}
                    </span>
                  </div>
                  {j.amount != null && (
                    <span className="font-black text-white">{inr(j.amount)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
