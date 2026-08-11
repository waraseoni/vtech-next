"use client";
import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Search, ChevronLeft, ChevronRight, RefreshCw, Eye, Trash2,
  Phone, Mail, MessageSquare, CheckCircle2,
  Inbox, CalendarDays, Filter, X, MailOpen, Clock, Plus,
} from "lucide-react";
import InquiryModal from "./components/InquiryModal";

import { formatIST, parseISTDate, startOfMonthIST, endOfMonthIST } from "@/lib/dateUtils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Inquiry {
  id: number;
  fullname: string;
  contact: string;
  email: string;
  message: string;
  status: 0 | 1;
  date_created: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// ── Date helpers (timezone-safe) ──────────────────────────────────────────
const firstOfMon  = (d = new Date()) => startOfMonthIST(d);
const lastOfMon   = (d = new Date()) => endOfMonthIST(d);
const shiftMon    = (s: string, n: number) => { const d = parseISTDate(s); return new Date(d.getFullYear(), d.getMonth() + n, 1); };
const fmtDate    = (s: string) => formatIST(s.split("T")[0], { day: "2-digit", month: "short", year: "numeric" });
const fmtTime    = (s: string) => formatIST(s, { hour: "2-digit", minute: "2-digit", hour12: true });
const daysAgo    = (s: string) => {
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
  return d === 0 ? "Today" : d === 1 ? "Yesterday" : `${d}d ago`;
};

// ══════════════════════════════════════════════════════════════════════════════
function InquiriesPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [fromDate,     setFromDate]     = useState(searchParams.get("from") || firstOfMon());
  const [toDate,       setToDate]       = useState(searchParams.get("to")   || lastOfMon());
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read">(
    (searchParams.get("status") as "all" | "unread" | "read") || "all"
  );

  // BUG FIX: useState initializes only once on mount — when router.push changes
  // the URL, searchParams updates but state stays stale. Sync state from URL.
  useEffect(() => {
    setFromDate(searchParams.get("from") || firstOfMon());
    setToDate(searchParams.get("to")     || lastOfMon());
    setStatusFilter((searchParams.get("status") as "all" | "unread" | "read") || "all");
  }, [searchParams]);
  const [inquiries,    setInquiries]    = useState<Inquiry[]>([]);
  const [loading,      setLoading]      = useState(true);
  // BUG FIX 1: stats fetched from a second unrestricted query — stats were always
  // ALL-TIME totals regardless of date filter. Fixed: compute from filtered data
  // AND a separate all-time count query for the header badge
  const [allTimeStats, setAllTimeStats] = useState({ total: 0, unread: 0 });

  const [modalOpen,         setModalOpen]         = useState(false);
  const [selectedInquiryId, setSelectedInquiryId] = useState<number | null>(null);
  const [isMobile,          setIsMobile]          = useState(false);
  const [mobileSearch,      setMobileSearch]      = useState("");
  const [mobileStatus,      setMobileStatus]      = useState<"all" | "unread" | "read">("all");
  const [showFilterModal,   setShowFilterModal]   = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const h  = (e: MediaQueryList | MediaQueryListEvent) => setIsMobile(e.matches);
    h(mq); mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      // BUG FIX 2: date filter was using plain toDate string (e.g. "2024-03-31")
      // which misses entries on the last day. Fixed: use T23:59:59 end-of-day
      let q = supabase
        .from("message_list").select("*")
        .gte("date_created", `${fromDate}T00:00:00`)
        .lte("date_created", `${toDate}T23:59:59`)
        .order("status", { ascending: true })       // unread first
        .order("date_created", { ascending: false });

      if (statusFilter === "unread") q = q.eq("status", 0);
      if (statusFilter === "read")   q = q.eq("status", 1);

      const { data, error } = await q;
      if (error) throw error;
      setInquiries(data || []);

      // All-time unread badge (separate lightweight query)
      const { data: atData } = await supabase
        .from("message_list").select("status");
      if (atData) {
        setAllTimeStats({
          total:  atData.length,
          unread: atData.filter(r => r.status === 0).length,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, statusFilter]);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  const handleDelete = async (id: number) => {
    if (!confirm("Is inquiry ko permanently delete karna chahte hain?")) return;
    const { error } = await supabase.from("message_list").delete().eq("id", id);
    if (!error) fetchInquiries();
    else alert("Delete failed");
  };

  const handleView = (id: number) => {
    setSelectedInquiryId(id);
    setModalOpen(true);
  };

  const applyFilter = (from: string, to: string, status: "all" | "unread" | "read") => {
    setFromDate(from); setToDate(to); setStatusFilter(status);
    const p = new URLSearchParams();
    if (from)           p.set("from", from);
    if (to)             p.set("to", to);
    if (status !== "all") p.set("status", status);
    router.push(`/inquiries?${p.toString()}`);
  };

  const prevMonth    = () => { const d = shiftMon(fromDate, -1); applyFilter(firstOfMon(d), lastOfMon(d), statusFilter); };
  const nextMonth    = () => { const d = shiftMon(fromDate,  1); applyFilter(firstOfMon(d), lastOfMon(d), statusFilter); };
  const currMonth    = () => applyFilter(firstOfMon(), lastOfMon(), "all");
  const monthLabel   = formatIST(fromDate, { month: "long", year: "numeric" });

  // ── Filtered for mobile ───────────────────────────────────────────────────
  const filteredMobile = useMemo(() => {
    return inquiries.filter(i => {
      const q  = mobileSearch.toLowerCase();
      const ms = !q || [i.fullname, i.contact, i.email, i.message]
        .some(v => v.toLowerCase().includes(q));
      const st = mobileStatus === "all" ||
        (mobileStatus === "unread" && i.status === 0) ||
        (mobileStatus === "read"   && i.status === 1);
      return ms && st;
    });
  }, [inquiries, mobileSearch, mobileStatus]);

  // Derived stats from current filtered data
  const filteredStats = useMemo(() => ({
    total:  inquiries.length,
    unread: inquiries.filter(i => i.status === 0).length,
    read:   inquiries.filter(i => i.status === 1).length,
  }), [inquiries]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <MessageSquare size={28} className="text-blue-500/60" />
          </div>
          <div className="absolute inset-0 rounded-2xl border border-blue-500/40 animate-ping" />
        </div>
        <p className="text-slate-600 text-xs font-extrabold uppercase tracking-[0.3em]">Loading Inquiries...</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── MOBILE ───────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#0d1117] pb-24">

        {/* Mobile header */}
        <div className="bg-[#0d1117] border-b border-[#21293d] px-4 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                <MessageSquare size={16} className="text-blue-400" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white leading-none">Inquiries</h1>
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mt-0.5">{monthLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {allTimeStats.unread > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5 rounded-xl">
                  <Inbox size={11} className="text-blue-400" />
                  <span className="text-xs font-extrabold text-blue-400">{allTimeStats.unread} unread</span>
                </div>
              )}
              <Link href="/contact"
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-blue-500/20 transition-all">
                <Plus size={13} /> New
              </Link>
            </div>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Total",  value: filteredStats.total,  color: "text-slate-300" },
              { label: "Unread", value: filteredStats.unread, color: "text-blue-400"  },
              { label: "Read",   value: filteredStats.read,   color: "text-emerald-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 text-center">
                <div className={`text-base font-black ${color}`}>{value}</div>
                <div className="text-[9px] text-slate-700 font-bold uppercase tracking-widest">{label}</div>
              </div>
            ))}
          </div>

          {/* Month nav */}
          <div className="flex items-center gap-2 mb-3">
            <button onClick={prevMonth}
              className="w-8 h-8 bg-[#161b27] border border-[#21293d] rounded-lg flex items-center justify-center text-slate-500 hover:text-white transition-all">
              <ChevronLeft size={14} />
            </button>
            <button onClick={currMonth}
              className="flex-1 h-8 bg-[#161b27] border border-[#21293d] rounded-lg text-[11px] font-extrabold text-slate-500 hover:text-white transition-all">
              {monthLabel}
            </button>
            <button onClick={nextMonth}
              className="w-8 h-8 bg-[#161b27] border border-[#21293d] rounded-lg flex items-center justify-center text-slate-500 hover:text-white transition-all">
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Search row */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input type="text" placeholder="Search inquiries..." value={mobileSearch}
              onChange={e => setMobileSearch(e.target.value)}
              className="w-full pl-9 pr-10 py-2.5 bg-[#161b27] border border-[#21293d] text-slate-200 placeholder-slate-700 rounded-xl text-sm outline-none focus:border-blue-500/40 transition-all" />
            <button onClick={() => setShowFilterModal(true)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-[#111520] border border-[#21293d] p-1 rounded-lg text-slate-600">
              <Filter size={12} />
            </button>
          </div>

          {/* Status chips */}
          <div className="flex gap-2 mt-2.5">
            {(["all", "unread", "read"] as const).map(f => (
              <button key={f} onClick={() => setMobileStatus(f)}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-extrabold uppercase border transition-all ${
                  mobileStatus === f
                    ? f === "unread" ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                      : f === "read"   ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-white/5 border-white/10 text-white"
                    : "bg-[#161b27] border-[#21293d] text-slate-600"
                }`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="px-3 pt-3 space-y-2.5">
          {filteredMobile.map(inq => (
            <div key={inq.id}
              className={`bg-[#161b27] border rounded-2xl overflow-hidden transition-all ${
                inq.status === 0
                  ? "border-blue-500/20"
                  : "border-[#21293d]"
              }`}>
              <div className={`h-0.5 ${inq.status === 0 ? "bg-blue-500" : "bg-emerald-600/40"}`} />
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-sm font-extrabold text-white">{inq.fullname}</div>
                    <div className="text-[10px] text-slate-600 font-bold mt-0.5">{fmtDate(inq.date_created)} · {daysAgo(inq.date_created)}</div>
                  </div>
                  <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-extrabold border ${
                    inq.status === 0
                      ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  }`}>
                    {inq.status === 0 ? <><Inbox size={8} /> Unread</> : <><CheckCircle2 size={8} /> Read</>}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-3">
                  <span className="flex items-center gap-1"><Phone size={9} className="text-emerald-400" />{inq.contact}</span>
                  <span className="flex items-center gap-1 truncate"><Mail size={9} className="text-cyan-400" />{inq.email}</span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">{inq.message}</p>
                <div className="flex gap-2 pt-2.5 border-t border-[#21293d]">
                  <button onClick={() => handleView(inq.id)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-[#111520] border border-[#21293d] hover:border-blue-500/30 text-slate-500 hover:text-blue-400 rounded-xl text-[11px] font-extrabold transition-all">
                    <Eye size={12} /> View
                  </button>
                  <button onClick={() => handleDelete(inq.id)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-[#111520] border border-[#21293d] hover:border-red-500/30 text-slate-500 hover:text-red-400 rounded-xl text-[11px] font-extrabold transition-all">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredMobile.length === 0 && (
            <div className="py-20 text-center bg-[#161b27] border border-dashed border-[#21293d] rounded-2xl">
              <MessageSquare size={32} className="mx-auto text-slate-800 mb-3" />
              <p className="text-slate-600 font-bold text-sm">No inquiries found</p>
            </div>
          )}
        </div>

        {/* Mobile filter modal */}
        {showFilterModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end"
            onClick={() => setShowFilterModal(false)}>
            <div className="bg-[#161b27] border-t border-[#21293d] rounded-t-3xl w-full p-5 pb-8"
              onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-[#21293d] rounded-full mx-auto mb-5" />
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Filter</h3>
                <button onClick={() => setShowFilterModal(false)}
                  className="w-7 h-7 bg-[#111520] border border-[#21293d] rounded-lg flex items-center justify-center text-slate-500">
                  <X size={13} />
                </button>
              </div>
              <div className="space-y-4">
                {[{ label: "From", val: fromDate, set: setFromDate }, { label: "To", val: toDate, set: setToDate }].map(({ label, val, set }) => (
                  <div key={label}>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-1.5">{label}</label>
                    <input type="date" value={val} onChange={e => set(e.target.value)}
                      className="w-full bg-[#111520] border border-[#21293d] text-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none [color-scheme:dark]" />
                  </div>
                ))}
                <div className="flex gap-2.5 pt-1">
                  <button onClick={() => { setFromDate(firstOfMon()); setToDate(lastOfMon()); setShowFilterModal(false); }}
                    className="flex-1 py-2.5 bg-[#111520] border border-[#21293d] text-slate-400 rounded-xl text-sm font-extrabold">Reset</button>
                  <button onClick={() => { applyFilter(fromDate, toDate, statusFilter); setShowFilterModal(false); }}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-blue-500/20">Apply</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {modalOpen && selectedInquiryId && (
          <InquiryModal inquiryId={selectedInquiryId}
            onClose={() => setModalOpen(false)}
            onUpdate={() => { fetchInquiries(); setModalOpen(false); }} />
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── DESKTOP ───────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0d1117] pb-16 font-sans">

      {/* ── HERO HEADER ── */}
      <div className="relative overflow-hidden bg-[#0d1117] border-b border-[#21293d]">
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="absolute -top-20 left-1/3 w-80 h-80 bg-blue-600/6 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-5 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Title */}
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/25 flex-shrink-0">
                <MessageSquare size={26} className="text-white" />
                {allTimeStats.unread > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] bg-red-500 rounded-full border-2 border-[#0d1117] flex items-center justify-center">
                    <span className="text-[9px] font-black text-white px-1">{allTimeStats.unread}</span>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Inquiries</h1>
                <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.2em] mt-0.5">
                  {monthLabel} · {filteredStats.total} messages
                </p>
              </div>
            </div>

            {/* All-time unread alert + New Inquiry button */}
            <div className="flex items-center gap-2">
              {allTimeStats.unread > 0 && (
                <button onClick={() => applyFilter(firstOfMon(), lastOfMon(), "unread")}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 rounded-xl text-xs font-extrabold transition-all">
                  <Inbox size={13} />
                  {allTimeStats.unread} unread all-time — View all
                </button>
              )}
              <Link href="/contact"
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                <Plus size={15} /> New Inquiry
              </Link>
            </div>
          </div>

          {/* ── STAT CARDS ── */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { label: "This Period",  value: filteredStats.total,  icon: MessageSquare, color: "text-slate-300", grad: "from-slate-600/10 to-slate-700/5",    border: "border-slate-500/15"    },
              { label: "Unread",       value: filteredStats.unread, icon: Inbox,         color: "text-blue-400",  grad: "from-blue-600/15 to-blue-700/5",      border: "border-blue-500/20"     },
              { label: "Read",         value: filteredStats.read,   icon: MailOpen,      color: "text-emerald-400",grad:"from-emerald-600/15 to-emerald-700/5",border: "border-emerald-500/20" },
            ].map(({ label, value, icon: Icon, color, grad, border }) => (
              <div key={label}
                className={`bg-gradient-to-br ${grad} border ${border} rounded-2xl px-5 py-4 flex items-center gap-3 hover:scale-[1.02] transition-transform`}>
                <Icon size={18} className={`${color} flex-shrink-0`} />
                <div>
                  <div className={`text-2xl font-black ${color}`}>{value}</div>
                  <div className="text-[9px] text-slate-700 font-bold uppercase tracking-widest mt-0.5">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-4 space-y-4">

        {/* ── FILTER BAR ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            {[{ label: "From", val: fromDate, set: setFromDate }, { label: "To", val: toDate, set: setToDate }].map(({ label, val, set }) => (
              <div key={label}>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1"><CalendarDays size={9} /> {label}</span>
                </label>
                <input type="date" value={val} onChange={e => { set(e.target.value); applyFilter(label === "From" ? e.target.value : fromDate, label === "To" ? e.target.value : toDate, statusFilter); }}
                  className="bg-[#111520] border border-[#21293d] text-slate-300 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-blue-500/50 transition-all [color-scheme:dark]" />
              </div>
            ))}

            {/* Status filter pills */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-1.5">Status</label>
              <div className="flex gap-1.5">
                {(["all", "unread", "read"] as const).map(f => (
                  <button key={f} onClick={() => applyFilter(fromDate, toDate, f)}
                    className={`px-3.5 py-2 rounded-xl text-[11px] font-extrabold border transition-all capitalize ${
                      statusFilter === f
                        ? f === "unread" ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                          : f === "read"   ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-white/5 border-white/10 text-white"
                        : "bg-[#111520] border-[#21293d] text-slate-600 hover:text-slate-400"
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Month nav */}
            <div className="flex items-center gap-1.5 ml-auto">
              <button onClick={prevMonth}
                className="w-9 h-9 bg-[#111520] border border-[#21293d] hover:border-slate-600 text-slate-500 hover:text-white rounded-xl flex items-center justify-center transition-all">
                <ChevronLeft size={15} />
              </button>
              <button onClick={currMonth}
                className="flex items-center gap-1.5 px-3 h-9 bg-[#111520] border border-[#21293d] hover:border-blue-500/30 text-slate-500 hover:text-white rounded-xl text-xs font-bold transition-all">
                <RefreshCw size={11} /> This Month
              </button>
              <button onClick={nextMonth}
                className="w-9 h-9 bg-[#111520] border border-[#21293d] hover:border-slate-600 text-slate-500 hover:text-white rounded-xl flex items-center justify-center transition-all">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* ── TABLE ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#111520] border-b border-[#21293d]">
                {["#", "Inquirer", "Contact", "Date", "Message Preview", "Status", "Actions"].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 ${
                    i === 0 ? "text-left w-10" : i === 5 ? "text-center" : i === 6 ? "text-center" : "text-left"
                  }`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21293d]">
              {inquiries.map((inq, idx) => (
                <tr key={inq.id}
                  className={`group transition-colors ${
                    inq.status === 0 ? "bg-blue-500/[0.02] hover:bg-blue-500/[0.04]" : "hover:bg-white/[0.02]"
                  }`}>

                  {/* # */}
                  <td className="px-4 py-3.5 text-slate-700 text-xs">{idx + 1}</td>

                  {/* Inquirer */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black ${
                        inq.status === 0
                          ? "bg-blue-500/15 border border-blue-500/20 text-blue-400"
                          : "bg-slate-700/40 border border-[#21293d] text-slate-500"
                      }`}>
                        {inq.fullname.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className={`font-extrabold text-sm ${inq.status === 0 ? "text-white" : "text-slate-300"}`}>
                          {inq.fullname}
                        </div>
                        <div className="text-[10px] text-slate-600 truncate max-w-[140px]">{inq.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Contact */}
                  <td className="px-4 py-3.5">
                    <a href={`https://wa.me/91${inq.contact.replace(/\D/g, "")}`} target="_blank"
                      className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-bold">
                      <Phone size={10} /> {inq.contact}
                    </a>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3.5">
                    <div className="text-xs text-slate-400 font-medium">{fmtDate(inq.date_created)}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock size={9} className="text-slate-700" />
                      <span className="text-[10px] text-slate-600">{fmtTime(inq.date_created)}</span>
                    </div>
                    <div className="text-[9px] text-slate-700 mt-0.5">{daysAgo(inq.date_created)}</div>
                  </td>

                  {/* Message preview */}
                  <td className="px-4 py-3.5 max-w-xs">
                    <p className="text-xs text-slate-500 truncate leading-relaxed" title={inq.message}>
                      {inq.message}
                    </p>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                      inq.status === 0
                        ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    }`}>
                      {inq.status === 0
                        ? <><Inbox size={8} /> Unread</>
                        : <><CheckCircle2 size={8} /> Read</>
                      }
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5">
                    <div className="flex justify-center gap-1.5">
                      <button onClick={() => handleView(inq.id)}
                        className="p-1.5 bg-[#21293d] hover:bg-blue-600/30 border border-[#21293d] hover:border-blue-500/40 rounded-lg text-slate-600 hover:text-blue-400 transition-all" title="View">
                        <Eye size={13} />
                      </button>
                      <button onClick={() => handleDelete(inq.id)}
                        className="p-1.5 bg-[#21293d] hover:bg-red-600/20 border border-[#21293d] hover:border-red-500/40 rounded-lg text-slate-600 hover:text-red-400 transition-all" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {inquiries.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <MessageSquare size={36} className="mx-auto text-slate-800 mb-3" />
                    <p className="text-slate-600 font-bold text-sm">No inquiries found</p>
                    <p className="text-slate-700 text-xs mt-1">Try changing the date range or status filter</p>
                  </td>
                </tr>
              )}
            </tbody>

            {inquiries.length > 0 && (
              <tfoot>
                <tr className="bg-[#111520] border-t border-[#21293d]">
                  <td colSpan={5} className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                    {filteredStats.total} total · {filteredStats.unread} unread · {filteredStats.read} read
                  </td>
                  <td colSpan={2} className="px-4 py-3 text-[10px] text-slate-700 font-bold text-right">
                    {new Date(fromDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} →{" "}
                    {new Date(toDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {modalOpen && selectedInquiryId && (
        <InquiryModal
          inquiryId={selectedInquiryId}
          onClose={() => setModalOpen(false)}
          onUpdate={() => {
            fetchInquiries();
            // BUG FIX 5: Original closed modal on every update (including auto-read)
            // Now only keep open — user manually closes. Auto-read doesn't close it.
          }}
        />
      )}
    </div>
  );
}

export default function InquiriesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <InquiriesPageInner />
    </Suspense>
  );
}