"use client";

import { useState, useEffect } from "react";
import {
  Loader2, Search, Printer, RotateCcw, Wrench, Package, AlertTriangle,
  CheckCircle2, Clock, Banknote, XCircle, PackageCheck, FileSearch,
} from "lucide-react";
import { WHATSAPP_LINK } from "../site";

type JobData = {
  id: number;
  job_id: string;
  code: string;
  item: string;
  fault: string;
  remark: string;
  status: number;
  amount: number;
  date_created: string;
};

type RecentJob = { id: number; job_id: string; code: string; item: string; status: number; date_created: string };

type Service = { service_name: string; price: number };
type Product = { product_name: string; qty: number; price: number; total: number };

const STATUS_CONFIG: Record<number, { label: string; color: string; bg: string; desc: string }> = {
  0: { label: "Pending", color: "#f59e0b", bg: "rgba(245,158,11,0.2)", desc: "Kaam shuru nahi hua hai" },
  1: { label: "On-Progress", color: "#667eea", bg: "rgba(102,126,234,0.2)", desc: "Kaam chal raha hai" },
  2: { label: "Done", color: "#3b82f6", bg: "rgba(59,130,246,0.2)", desc: "Kaam pura ho gaya hai" },
  3: { label: "Paid", color: "#10b981", bg: "rgba(16,185,129,0.2)", desc: "Payment ho chuka hai" },
  4: { label: "Cancelled", color: "#ef4444", bg: "rgba(239,68,68,0.2)", desc: "Transaction radd ho gaya" },
  5: { label: "Delivered", color: "#059669", bg: "rgba(5,150,105,0.2)", desc: "Aapko item mil chuka hai" },
};

const STATUS_ICON: Record<number, React.ReactNode> = {
  0: <Clock size={14} />,
  1: <Wrench size={14} />,
  2: <CheckCircle2 size={14} />,
  3: <Banknote size={14} />,
  4: <XCircle size={14} />,
  5: <PackageCheck size={14} />,
};

export default function JobStatusPage() {
  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState<"job_id" | "code">("job_id");
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<JobData | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [view, setView] = useState<"detailed" | "compact" | "timeline">("detailed");
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/job-status?recent=1")
      .then(r => r.json())
      .then((d) => {
        setRecentJobs(d.recent || []);
        setRecentLoading(false);
      })
      .catch(() => setRecentLoading(false));
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) { setError("Job ID ya Code daalo!"); return; }

    setLoading(true);
    setError("");
    setJob(null);

    try {
      const qs = new URLSearchParams();
      if (searchType === "job_id") qs.set("job_id", search.trim());
      else qs.set("code", search.trim());

      const res = await fetch(`/api/public/job-status?${qs.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError("Error: " + (data.error || res.status));
        setLoading(false);
        return;
      }

      const txn = data.job;
      if (!txn) {
        setError("Job nahi mila! Sahi Job ID ya Code daalo.");
        setLoading(false);
        return;
      }

      setJob({
        id: txn.id,
        job_id: txn.job_id,
        code: txn.code,
        item: txn.item,
        fault: txn.fault,
        remark: txn.remark,
        status: txn.status,
        amount: txn.amount,
        date_created: txn.date_created,
      });

      setServices(data.services || []);
      setProducts(data.products || []);

    } catch (e) {
      setError((e instanceof Error && e.message ? e.message : "") || "Search mein error aayi!");
    } finally {
      setLoading(false);
    }
  };

  const statusInfo = job ? STATUS_CONFIG[job.status] || { label: "Unknown", color: "#6b7280", bg: "rgba(107,114,128,0.2)", desc: "Status unknown" } : null;
  const totalServices = services.reduce((s, sv) => s + sv.price, 0);
  const totalProducts = products.reduce((s, p) => s + p.total, 0);

  return (
    <>
      {/* ═══ HERO ═════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.10),transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:py-16">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-4">
            <FileSearch size={13} /> Track Repair
          </span>
          <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] max-w-3xl">
            Apne repair ka status — <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">bina login ke dekhein</span>
          </h1>
          <p className="mt-4 text-[14px] sm:text-base text-slate-400 max-w-2xl">
            Apna Job ID ya Repair Code daalkar turant status, amount aur timeline check karein.
          </p>
        </div>
      </section>

      <div className="min-h-screen py-10 sm:py-14 px-4">
        {/* ══ SEARCH FORM ═══════════════════════════════════════════════ */}
        {!job && (
          <div className="max-w-xl mx-auto">
            <div className="rounded-3xl p-6 sm:p-8 bg-white/[0.03] border border-white/[0.08]">
              {/* Search Type Toggle */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                {(["job_id", "code"] as const).map(t => (
                  <button key={t} type="button" onClick={() => { setSearchType(t); setError(""); }}
                    className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      searchType === t
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                        : "bg-white/[0.04] text-slate-500 hover:text-slate-300"
                    }`}>
                    {t === "job_id" ? "Job ID" : "Repair Code"}
                  </button>
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-3 rounded-xl mb-5">
                  <AlertTriangle size={15} className="shrink-0" /> {error}
                </div>
              )}

              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={searchType === "job_id" ? "Enter Job ID (e.g. 27950)" : "Enter Repair Code (e.g. 2026032001)"}
                  className="flex-1 min-w-0 px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.1] text-sm text-white font-medium placeholder:text-slate-600 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
                <button type="submit" disabled={loading}
                  className="shrink-0 flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-black shadow-lg shadow-blue-600/25 disabled:opacity-60 active:scale-95 transition-all">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  <span className="hidden sm:inline">Search</span>
                </button>
              </form>

              <p className="text-[11px] text-slate-600 mt-4">
                E.g. Job ID <button onClick={() => { setSearch("27950"); setSearchType("job_id"); }} className="text-blue-400 hover:underline">27950</button> ya Code{" "}
                <button onClick={() => { setSearch("2026032001"); setSearchType("code"); }} className="text-blue-400 hover:underline">2026032001</button>
              </p>
            </div>

            {/* Recent Jobs for reference */}
            {!recentLoading && recentJobs.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-bold mb-3 text-slate-400">Recent Jobs (for reference)</h3>
                <div className="rounded-3xl overflow-hidden bg-white/[0.03] border border-white/[0.08]">
                  {recentJobs.map(j => (
                    <button key={j.id} onClick={() => { setSearch(j.job_id); setSearchType("job_id"); setError(""); }}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition text-left border-b border-white/[0.05] last:border-b-0">
                      <div className="min-w-0">
                        <span className="font-bold text-blue-400">#{j.job_id}</span>
                        <span className="text-xs ml-2 text-slate-500 truncate">{j.item}</span>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold shrink-0"
                        style={{ background: STATUS_CONFIG[j.status]?.bg || "rgba(255,255,255,0.1)", color: STATUS_CONFIG[j.status]?.color || "#94a3b8" }}>
                        {STATUS_CONFIG[j.status]?.label || "Unknown"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ JOB STATUS DISPLAY ═══════════════════════════════════════ */}
        {job && statusInfo && (
          <div className="max-w-4xl mx-auto">
            {/* Back + Actions */}
            <div className="flex items-center justify-between mb-5 gap-3">
              <button onClick={() => { setJob(null); setSearch(""); setError(""); setServices([]); setProducts([]); }}
                className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl text-blue-400 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 active:scale-95 transition-all">
                <RotateCcw size={15} /> Search Again
              </button>
              <button onClick={() => window.open(`/api/print-job-status?job_id=${job.job_id}`, "_blank")}
                className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/10 active:scale-95 transition-all">
                <Printer size={14} /> Print
              </button>
            </div>

            {/* Status Overview Card */}
            <div className="rounded-3xl overflow-hidden bg-white/[0.03] border border-white/[0.08] mb-8"
              style={{ borderTop: `4px solid ${statusInfo.color}` }}>
              <div className="flex items-center justify-between p-5 sm:p-6 bg-gradient-to-br from-blue-600/10 to-cyan-600/5">
                <div>
                  <h2 className="font-display text-lg sm:text-xl font-black">Job Status Tracker</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Job #{job.job_id} | Code: {job.code} | {job.date_created}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm sm:text-base font-black whitespace-nowrap"
                  style={{ background: statusInfo.bg, border: `2px solid ${statusInfo.color}`, color: statusInfo.color }}>
                  {STATUS_ICON[job.status]}
                  {statusInfo.label}
                </div>
              </div>

              {/* View Tabs */}
              <div className="grid grid-cols-3 gap-1 p-3 border-b border-white/[0.08]">
                {(["detailed", "compact", "timeline"] as const).map(tab => (
                  <button key={tab} onClick={() => setView(tab)}
                    className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      view === tab ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" : "bg-white/[0.03] text-slate-500 hover:text-slate-300"
                    }`}>
                    {tab === "detailed" ? "Detailed" : tab === "compact" ? "Compact" : "Timeline"}
                  </button>
                ))}
              </div>

              <div className="p-5 sm:p-6">
                {/* DETAILED VIEW */}
                {view === "detailed" && (
                  <div className="space-y-6">
                    {/* Info Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Job Number", value: job.job_id },
                        { label: "Repair Code", value: job.code },
                        { label: "Item", value: job.item },
                        { label: "Fault", value: job.fault },
                      ].map(info => (
                        <div key={info.label} className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">{info.label}</p>
                          <p className="font-bold text-sm break-words">{info.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Services */}
                    {services.length > 0 && (
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-black mb-3 text-blue-400">
                          <Wrench size={14} /> Services Provided
                        </h3>
                        <div className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06]">
                          {services.map((sv, i) => (
                            <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-white/[0.05] last:border-b-0">
                              <span className="text-sm">{sv.service_name}</span>
                              <span className="font-bold text-blue-400">₹{sv.price.toLocaleString("en-IN")}</span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center px-4 py-3 font-black bg-blue-500/5 border-t border-white/[0.08]">
                            <span className="text-sm">Total Services</span>
                            <span className="text-blue-400">₹{totalServices.toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Products */}
                    {products.length > 0 && (
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-black mb-3 text-emerald-400">
                          <Package size={14} /> Products Used
                        </h3>
                        <div className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06]">
                          {products.map((p, i) => (
                            <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-white/[0.05] last:border-b-0">
                              <div>
                                <span className="text-sm font-bold">{p.product_name}</span>
                                <span className="text-xs ml-2 text-slate-500">Qty: {p.qty}</span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-bold text-emerald-400">₹{p.total.toLocaleString("en-IN")}</span>
                                <span className="text-xs block text-slate-500">₹{p.price.toLocaleString("en-IN")} each</span>
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-between items-center px-4 py-3 font-black bg-emerald-500/5 border-t border-white/[0.08]">
                            <span className="text-sm">Total Products</span>
                            <span className="text-emerald-400">₹{totalProducts.toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Amount */}
                    <div className="text-center p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-2 border-emerald-500/40">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Total Payable Amount</p>
                      <p className="font-display text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                        ₹{job.amount.toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs mt-2 text-slate-500">Includes all services and products</p>
                    </div>

                    {/* Remarks */}
                    {job.remark && (
                      <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Additional Remarks</p>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{job.remark}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* COMPACT VIEW */}
                {view === "compact" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Job Number", value: job.job_id },
                          { label: "Repair Code", value: job.code },
                          { label: "Item", value: job.item },
                          { label: "Fault", value: job.fault },
                        ].map(info => (
                          <div key={info.label} className="rounded-xl p-3.5 bg-white/[0.03] border border-white/[0.06]">
                            <p className="text-[10px] font-black uppercase text-slate-500">{info.label}</p>
                            <p className="font-bold text-sm mt-0.5 break-words">{info.value}</p>
                          </div>
                        ))}
                      </div>
                      {services.length > 0 && (
                        <div className="rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.06]">
                          {services.map((sv, i) => (
                            <div key={i} className="flex justify-between px-4 py-2.5 border-b border-white/[0.05] last:border-b-0">
                              <span className="text-sm">{sv.service_name}</span>
                              <span className="text-sm font-bold text-blue-400">₹{sv.price.toLocaleString("en-IN")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-center p-5 rounded-2xl" style={{ background: statusInfo.bg, border: `1px solid ${statusInfo.color}` }}>
                      <p className="text-[10px] font-black uppercase" style={{ color: statusInfo.color }}>Current Status</p>
                      <p className="text-xl font-black mt-1" style={{ color: statusInfo.color }}>{statusInfo.label}</p>
                      <p className="text-xs mt-1 opacity-90" style={{ color: statusInfo.color }}>{statusInfo.desc}</p>
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-xs text-slate-400">Total Amount</p>
                        <p className="text-xl font-black text-emerald-400 mt-0.5">₹{job.amount.toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* TIMELINE VIEW */}
                {view === "timeline" && (
                  <div className="relative pl-7" style={{ borderLeft: "2px solid rgba(59,130,246,0.3)" }}>
                    {[0, 1, 2, 3, 5].map(step => {
                      const info = STATUS_CONFIG[step] || STATUS_CONFIG[0];
                      const isCompleted = step < job.status;
                      const isCurrent = step === job.status;
                      return (
                        <div key={step} className="relative mb-6">
                          <div className="absolute -left-[33px] top-1 w-3.5 h-3.5 rounded-full"
                            style={{
                              background: isCompleted ? "#10b981" : isCurrent ? statusInfo.color : "#374151",
                              boxShadow: isCurrent ? `0 0 0 4px ${statusInfo.bg}` : isCompleted ? "0 0 0 4px rgba(16,185,129,0.2)" : "none",
                            }} />
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold" style={{ color: isCompleted ? "#10b981" : isCurrent ? statusInfo.color : "#94a3b8" }}>
                              {info.label}
                            </span>
                            {isCurrent && <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: statusInfo.bg, color: statusInfo.color }}>Current</span>}
                          </div>
                          <p className="text-xs text-slate-500">{info.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp help */}
            <a href={WHATSAPP_LINK("Hello, meri job ka status dekhna hai. Job ID: " + job.job_id)} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/25 text-[#4ade80] text-sm font-black active:scale-[0.99] transition-transform mb-4">
              Job ke baare mein koi sawaal? WhatsApp par poochhein
            </a>
          </div>
        )}
      </div>
    </>
  );
}
