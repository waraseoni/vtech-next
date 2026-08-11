"use client";

// ═══════════════════════════════════════════════════════════════════
// Combined Invoice Page
// Select a client → choose multiple jobs → print one combined invoice
// Migrated from PHP: admin/transactions/combined_invoice_select.php
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  Users, Search, CheckSquare, Square, Printer, ArrowLeft,
  Loader2, FileText, ChevronRight, X,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Client {
  id: number;
  firstname: string;
  middlename?: string;
  lastname: string;
  contact: string;
  address?: string;
}

interface Transaction {
  id: number;
  job_id: string;
  code: string | null;
  item: string;
  fault: string;
  amount: number;
  status: number;
  date_created: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: "Pending",     color: "#94a3b8", bg: "#94a3b820" },
  1: { label: "In Progress", color: "#f59e0b", bg: "#f59e0b20" },
  2: { label: "Done",        color: "#06b6d4", bg: "#06b6d420" },
  3: { label: "Paid",        color: "#10b981", bg: "#10b98120" },
  4: { label: "Cancelled",   color: "#ef4444", bg: "#ef444420" },
  5: { label: "Delivered",   color: "#3b82f6", bg: "#3b82f620" },
};

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(iso));
}

function inr(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0 });
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function CombinedInvoicePage() {

  // ── Step 1: Client selection ─────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1);
  const [clientSearch, setClientSearch] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // ── Step 2: Job selection ────────────────────────────────────────
  const [jobs, setJobs] = useState<Transaction[]>([]);
  const [jobLoading, setJobLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [billType, setBillType] = useState<"non_gst" | "gst">("non_gst");
  const [statusFilter, setStatusFilter] = useState<number | "">("");

  // ── Search clients ───────────────────────────────────────────────
  const searchClients = useCallback(async (q: string) => {
    if (!q.trim()) { setClients([]); return; }
    setClientLoading(true);
    const like = `%${q}%`;
    const { data } = await supabase
      .from("client_list")
      .select("id, firstname, middlename, lastname, contact, address")
      .eq("delete_flag", 0)
      .or(`firstname.ilike.${like},middlename.ilike.${like},lastname.ilike.${like},contact.ilike.${like}`)
      .order("firstname")
      .limit(20);
    setClients((data as Client[]) || []);
    setClientLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchClients(clientSearch), 300);
    return () => clearTimeout(t);
  }, [clientSearch, searchClients]);

  // Load all clients on mount
  useEffect(() => {
    (async () => {
      setClientLoading(true);
      const { data } = await supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname, contact, address")
        .eq("delete_flag", 0)
        .order("firstname")
        .limit(50);
      setClients((data as Client[]) || []);
      setClientLoading(false);
    })();
  }, []);

  // ── Load jobs for selected client ────────────────────────────────
  const loadJobs = useCallback(async (clientId: number) => {
    setJobLoading(true);
    let q = supabase
      .from("transaction_list")
      .select("id, job_id, code, item, fault, amount, status, date_created")
      .eq("client_name", String(clientId))
      .neq("status", 4) // exclude cancelled
      .eq("del_status", 0)
      .order("date_created", { ascending: false });

    if (statusFilter !== "") q = q.eq("status", statusFilter);

    const { data } = await q;
    setJobs((data as Transaction[]) || []);
    setJobLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client select hone par jobs fetch; loading init sync legit
    if (selectedClient) loadJobs(selectedClient.id);
  }, [selectedClient, loadJobs]);

  // ── Select client → go to step 2 ────────────────────────────────
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setSelectedIds(new Set());
    setStep(2);
  };

  // ── Job checkbox toggle ──────────────────────────────────────────
  const toggleJob = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const filtered = filteredJobs;
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(j => j.id)));
    }
  };

  // ── Filter jobs by status ────────────────────────────────────────
  const filteredJobs = statusFilter !== ""
    ? jobs.filter(j => j.status === statusFilter)
    : jobs;

  // ── Print combined invoice ───────────────────────────────────────
  const printCombinedInvoice = () => {
    if (selectedIds.size === 0) {
      alert("Pehle koi job(s) select karo!");
      return;
    }
    const ids = [...selectedIds].join(",");
    const url = `/api/print-combined-invoice?ids=${ids}&bill_type=${billType}`;
    window.open(url, "_blank");
  };

  // ── Helpers ──────────────────────────────────────────────────────
  const getClientName = (c: Client) =>
    [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ").trim();

  const selectedTotal = [...selectedIds].reduce((sum, id) => {
    const job = jobs.find(j => j.id === id);
    return sum + (job?.amount || 0);
  }, 0);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-4 font-sans">
      <div className="max-w-4xl mx-auto space-y-4">

        {/* ── Header ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-4 flex items-center gap-4">
          <Link href="/jobs" className="p-2 bg-[#21293d] hover:bg-[#2a3550] rounded-lg transition-all">
            <ArrowLeft size={18} className="text-slate-400" />
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2.5 bg-gradient-to-br from-violet-600 to-violet-700 rounded-lg shadow-lg shadow-violet-500/20">
              <FileText className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Combined Invoice</h1>
              <p className="text-xs text-slate-500">Ek client ke multiple jobs ka combined bill print karo</p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className={`px-3 py-1.5 rounded-lg border ${step === 1 ? "bg-violet-600 border-violet-500 text-white" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}>
              1. Client
            </span>
            <ChevronRight size={14} className="text-slate-600" />
            <span className={`px-3 py-1.5 rounded-lg border ${step === 2 ? "bg-violet-600 border-violet-500 text-white" : "bg-[#21293d] border-[#21293d] text-slate-600"}`}>
              2. Jobs
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            STEP 1 — Select Client
        ══════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="bg-[#161b27] border border-[#21293d] rounded-xl overflow-hidden">
            {/* Search bar */}
            <div className="p-4 border-b border-[#21293d]">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                <input
                  type="text"
                  placeholder="Client ka naam ya phone number search karo..."
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-[#0d1117] border border-[#21293d] text-white placeholder-slate-600 rounded-xl text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 outline-none transition-all"
                  autoFocus
                />
                {clientSearch && (
                  <button onClick={() => setClientSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Client list */}
            <div className="divide-y divide-[#21293d]">
              {clientLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="animate-spin text-violet-500" size={32} />
                </div>
              ) : clients.length === 0 ? (
                <div className="text-center py-16 text-slate-600">
                  <Users size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-bold">Koi client nahi mila</p>
                  <p className="text-xs mt-1">Naam ya phone number se search karo</p>
                </div>
              ) : (
                clients.map(client => (
                  <button
                    key={client.id}
                    onClick={() => handleSelectClient(client)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-all text-left group"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/30 transition-all">
                      <span className="text-white font-black text-sm">
                        {client.firstname?.[0]?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm group-hover:text-violet-300 transition-colors">
                        {getClientName(client)}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                        {client.contact && <span>📞 {client.contact}</span>}
                        {client.address && <span className="truncate max-w-[200px]">📍 {client.address}</span>}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-600 group-hover:text-violet-400 transition-colors flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            STEP 2 — Select Jobs
        ══════════════════════════════════════════════════════════ */}
        {step === 2 && selectedClient && (
          <>
            {/* Client Header */}
            <div className="bg-gradient-to-r from-violet-600/20 to-indigo-600/10 border border-violet-500/30 rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/30">
                <span className="text-white font-black text-lg">
                  {selectedClient.firstname?.[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="font-black text-white text-lg">{getClientName(selectedClient)}</div>
                <div className="text-sm text-violet-300 mt-0.5 flex items-center gap-3">
                  {selectedClient.contact && <span>📞 {selectedClient.contact}</span>}
                </div>
              </div>
              <button
                onClick={() => { setStep(1); setSelectedClient(null); setJobs([]); setSelectedIds(new Set()); }}
                className="px-4 py-2 bg-[#21293d] hover:bg-[#2a3550] text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <X size={13} /> Change Client
              </button>
            </div>

            {/* Controls Bar */}
            <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-4 flex flex-wrap items-center gap-3">
              {/* Select all */}
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white transition-colors"
              >
                {selectedIds.size === filteredJobs.length && filteredJobs.length > 0
                  ? <CheckSquare size={18} className="text-violet-400" />
                  : <Square size={18} className="text-slate-600" />
                }
                {selectedIds.size === filteredJobs.length && filteredJobs.length > 0 ? "Deselect All" : "Select All"}
              </button>

              <div className="h-6 w-px bg-[#21293d]" />

              {/* Status filter */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Filter:</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value === "" ? "" : parseInt(e.target.value))}
                  className="bg-[#0d1117] border border-[#21293d] text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:border-violet-500 outline-none"
                >
                  <option value="">All Status</option>
                  {Object.entries(STATUS_MAP).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div className="h-6 w-px bg-[#21293d]" />

              {/* Bill type */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Bill:</label>
                <div className="flex rounded-lg overflow-hidden border border-[#21293d]">
                  <button
                    onClick={() => setBillType("non_gst")}
                    className={`px-3 py-1.5 text-xs font-bold transition-all ${billType === "non_gst" ? "bg-cyan-600 text-white" : "bg-[#0d1117] text-slate-500 hover:text-slate-300"}`}
                  >
                    Retail
                  </button>
                  <button
                    onClick={() => setBillType("gst")}
                    className={`px-3 py-1.5 text-xs font-bold transition-all ${billType === "gst" ? "bg-red-600 text-white" : "bg-[#0d1117] text-slate-500 hover:text-slate-300"}`}
                  >
                    GST
                  </button>
                </div>
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Selected count + Print */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-slate-500 font-bold">{selectedIds.size} job{selectedIds.size > 1 ? "s" : ""} selected</div>
                    <div className="text-sm font-black text-emerald-400">{inr(selectedTotal)}</div>
                  </div>
                  <button
                    onClick={printCombinedInvoice}
                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-violet-600/25 transition-all"
                  >
                    <Printer size={16} />
                    Print Invoice
                  </button>
                </div>
              )}
            </div>

            {/* Jobs List */}
            <div className="bg-[#161b27] border border-[#21293d] rounded-xl overflow-hidden">
              {jobLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="animate-spin text-violet-500" size={32} />
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="text-center py-16 text-slate-600">
                  <FileText size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-bold">Is client ke liye koi job nahi mili</p>
                  <p className="text-xs mt-1">Filter change karke dekho ya naya job create karo</p>
                </div>
              ) : (
                <div className="divide-y divide-[#21293d]">
                  {filteredJobs.map(job => {
                    const isSelected = selectedIds.has(job.id);
                    const sc = STATUS_MAP[job.status] || STATUS_MAP[0];
                    return (
                      <div
                        key={job.id}
                        onClick={() => toggleJob(job.id)}
                        className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-all hover:bg-white/[0.02] ${isSelected ? "bg-violet-600/8 border-l-2 border-l-violet-500" : "border-l-2 border-l-transparent"}`}
                      >
                        {/* Checkbox */}
                        <div className="flex-shrink-0">
                          {isSelected
                            ? <CheckSquare size={20} className="text-violet-400" />
                            : <Square size={20} className="text-slate-700" />
                          }
                        </div>

                        {/* Job info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-blue-400 text-sm">#{job.job_id}</span>
                            {job.code && (
                              <span className="text-slate-600 text-xs">{job.code}</span>
                            )}
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ backgroundColor: sc.bg, color: sc.color }}
                            >
                              {sc.label}
                            </span>
                          </div>
                          <div className="text-sm text-slate-300 font-semibold mt-0.5 truncate">{job.item}</div>
                          <div className="text-xs text-red-400 mt-0.5 truncate">{job.fault}</div>
                        </div>

                        {/* Amount + Date */}
                        <div className="text-right flex-shrink-0">
                          <div className="font-black text-white text-base">{inr(job.amount || 0)}</div>
                          <div className="text-[10px] text-slate-600 mt-0.5">{fmtDate(job.date_created)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary footer (sticky) */}
            {selectedIds.size > 0 && (
              <div className="sticky bottom-4 bg-[#0d1117]/90 backdrop-blur-xl border border-violet-500/40 rounded-2xl p-4 flex items-center gap-4 shadow-2xl shadow-violet-900/30">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    {[...selectedIds].map(id => {
                      const j = jobs.find(x => x.id === id);
                      if (!j) return null;
                      return (
                        <div key={id} className="flex items-center gap-1.5 bg-[#161b27] border border-[#21293d] rounded-lg px-2.5 py-1.5">
                          <span className="text-blue-400 font-black text-xs">#{j.job_id}</span>
                          <span className="text-white font-bold text-xs">{inr(j.amount)}</span>
                          <button
                            onClick={e => { e.stopPropagation(); toggleJob(id); }}
                            className="text-slate-600 hover:text-red-400 transition-colors ml-0.5"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Selected</div>
                  <div className="text-2xl font-black text-emerald-400">{inr(selectedTotal)}</div>
                </div>
                <button
                  onClick={printCombinedInvoice}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white px-6 py-3 rounded-xl font-black text-sm shadow-2xl shadow-violet-600/30 transition-all"
                >
                  <Printer size={18} />
                  Print Combined Invoice
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
