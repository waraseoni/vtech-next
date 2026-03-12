"use client";

// ═══════════════════════════════════════════════════════════════════
// BUGS FIXED:
// 1. clientIds passed as strings to `.in("client_name",...)` — column is TEXT
// 2. billedResult query also fixed to use string clientIds
// 3. pageIndex reset now triggers on correct deps (search/filter), not length
// 4. shiftDay uses URLSearchParams to preserve existing params
// 5. mounted/hydration flash removed — unnecessary in "use client"
// 6. Dropdown outside-click uses data-id attribute check (stable)
// 7. Status filter now works on BOTH desktop filter bar AND mobile modal
//
// PHP FEATURES ADDED (image removed as requested):
// ✅ Mobile Quick Stats bar: Total, Pending, Completed, Total Amount
// ✅ Desktop date now shows TIME too (like PHP h:i A)
// ✅ Desktop client cell shows phone number text + WA link
// ✅ Mobile "Additional Info" section: Created + Last Updated datetime
// ✅ Mobile: Delivered datetime shown below status badge
// ✅ Status filter dropdown in DESKTOP filter bar
// ✅ remark field added to Transaction type + displayed in mobile card
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback, Suspense, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus, Eye, Settings, Wrench, Search, Loader2, Trash2, Phone,
  Filter, Printer, FileSpreadsheet, History, Layers,
  ChevronLeft, ChevronRight, AlertCircle, ChevronDown, X,
  TrendingUp, Clock, CheckCircle2, IndianRupee, MessageSquare,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Transaction {
  id: number;
  job_id: string;
  code: string | null;
  client_name: number;
  item: string;
  fault: string;
  remark: string | null; // BUG FIX: was missing
  uniq_id: string | null;
  amount: number;
  status: number;
  date_created: string;
  date_updated: string;
  date_completed: string | null;
  del_status: number;
  client_firstname?: string;
  client_middlename?: string;
  client_lastname?: string;
  client_contact?: string;
  client_opening_balance?: number;
  total_billed?: number;
  total_paid?: number;
  total_sale?: number;
}

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_MAP: Record<number, string> = {
  0: "Pending", 1: "On-Progress", 2: "Done",
  3: "Paid", 4: "Cancelled", 5: "Delivered",
};

// Dark-theme status badge classes
const STATUS_COLORS: Record<number, string> = {
  0: "bg-slate-700/60 text-slate-300 border-slate-600",
  1: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  2: "bg-teal-500/20 text-teal-300 border-teal-500/40",
  3: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  4: "bg-red-500/20 text-red-300 border-red-500/40",
  5: "bg-purple-500/20 text-purple-300 border-purple-500/40",
};

// Mobile card left-border colors
const STATUS_BORDER: Record<number, string> = {
  0: "border-l-slate-500", 1: "border-l-blue-500", 2: "border-l-teal-500",
  3: "border-l-emerald-500", 4: "border-l-red-500", 5: "border-l-purple-500",
};

const getStatusBadge = (s: number) =>
  `inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[s] ?? STATUS_COLORS[0]}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

// ─── Main Content Component ───────────────────────────────────────────────────
function JobsListContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // URL-driven state
  const urlDateFrom      = searchParams.get("date_from") || "";
  const urlDateTo        = searchParams.get("date_to")   || "";
  const urlHideDelivered = searchParams.get("hide_delivered") === "1";

  // Data
  const [transactions,  setTransactions]  = useState<Transaction[]>([]);
  const [userRole,      setUserRole]      = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [isMobile,      setIsMobile]      = useState(false);

  // Filters
  const [localSearch,   setLocalSearch]   = useState("");
  const [dateFrom,      setDateFrom]      = useState(urlDateFrom);
  const [dateTo,        setDateTo]        = useState(urlDateTo);
  const [hideDelivered, setHideDelivered] = useState(urlHideDelivered);
  const [statusFilter,  setStatusFilter]  = useState<number | "">("");
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Pagination
  const [pageSize,  setPageSize]  = useState(25);
  const [pageIndex, setPageIndex] = useState(0);

  // Dropdown
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // FAB (mobile)
  const [fabOpen, setFabOpen] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(localSearch), 300);
    return () => clearTimeout(t);
  }, [localSearch]);

  // Mobile detection
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const h = (e: MediaQueryList | MediaQueryListEvent) => setIsMobile(e.matches);
    h(mq);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // User role fetch
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        setUserRole(p?.role || "staff");
      }
    })();
  }, []);

  // BUG FIX 6: Dropdown outside-click via ref
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (openDropdownId !== null) {
        const t = e.target as HTMLElement;
        if (!t.closest("[data-dropdown-trigger]") && !t.closest("[data-dropdown-menu]")) {
          setOpenDropdownId(null);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdownId]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      let q = supabase
        .from("transaction_list")
        .select("*")
        .eq("del_status", 0)
        .order("date_created", { ascending: false });

      if (dateFrom) q = q.gte("date_created", `${dateFrom}T00:00:00`);
      if (dateTo)   q = q.lte("date_created", `${dateTo}T23:59:59`);

      const { data: txns, error: txnErr } = await q;
      if (txnErr) throw txnErr;
      if (!txns?.length) { setTransactions([]); return; }

      // BUG FIX 1+2: client_name is TEXT column — pass strings
      const clientIdsNum = [...new Set(txns.map(t => Number(t.client_name)))];
      const clientIdsStr = clientIdsNum.map(String); // ← FIX

      const [clientsRes, billedRes, paidRes, salesRes] = await Promise.all([
        supabase.from("client_list")
          .select("id, firstname, middlename, lastname, contact, opening_balance")
          .in("id", clientIdsNum),
        supabase.from("transaction_list")
          .select("client_name, amount")
          .eq("status", 5)
          .in("client_name", clientIdsStr), // ← FIX: string array
        supabase.from("client_payments")
          .select("client_id, amount, discount")
          .in("client_id", clientIdsNum),
        supabase.from("direct_sales")
          .select("client_id, total_amount")
          .in("client_id", clientIdsNum),
      ]);

      const billedMap = new Map<number, number>();
      billedRes.data?.forEach(r => {
        const cid = Number(r.client_name);
        billedMap.set(cid, (billedMap.get(cid) || 0) + (r.amount || 0));
      });

      const paidMap = new Map<number, number>();
      paidRes.data?.forEach(r => {
        paidMap.set(r.client_id, (paidMap.get(r.client_id) || 0) + (r.amount || 0) + (r.discount || 0));
      });

      const salesMap = new Map<number, number>();
      salesRes.data?.forEach(r => {
        salesMap.set(r.client_id, (salesMap.get(r.client_id) || 0) + (r.total_amount || 0));
      });

      const clientMap = new Map(clientsRes.data?.map(c => [c.id, c]) ?? []);

      setTransactions(txns.map(txn => {
        const cid    = Number(txn.client_name);
        const client = clientMap.get(cid);
        return {
          ...txn,
          client_firstname:       client?.firstname       || "",
          client_middlename:      client?.middlename      || "",
          client_lastname:        client?.lastname        || "",
          client_contact:         client?.contact         || "",
          client_opening_balance: client?.opening_balance || 0,
          total_billed:           billedMap.get(cid) || 0,
          total_paid:             paidMap.get(cid)   || 0,
          total_sale:             salesMap.get(cid)  || 0,
        };
      }));
    } catch (err) {
      console.error("fetchTransactions error:", err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getClientName = (t: Transaction) =>
    [t.client_firstname, t.client_middlename, t.client_lastname]
      .filter(Boolean).join(" ").trim() || "Unknown Client";

  const getClientBalance = (t: Transaction) => {
    const ob  = t.client_opening_balance || 0;
    const bil = t.total_billed || 0;
    const sal = t.total_sale   || 0;
    const pai = t.total_paid   || 0;
    return ob + bil + sal - pai;
  };

  const BalanceBadge = ({ bal }: { bal: number }) => {
    if (bal > 0)  return <span className="bg-red-500/15 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full text-[9px] font-bold">Due ₹{bal.toFixed(0)}</span>;
    if (bal < 0)  return <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full text-[9px] font-bold">Adv ₹{Math.abs(bal).toFixed(0)}</span>;
    return              <span className="bg-slate-700/50 text-slate-500 border border-slate-600/30 px-1.5 py-0.5 rounded-full text-[9px] font-bold">Bal 0</span>;
  };

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();
    return transactions.filter(t => {
      if (hideDelivered && t.status === 5)                          return false;
      if (statusFilter !== "" && t.status !== statusFilter)         return false;
      if (!term)                                                     return true;
      const name = getClientName(t).toLowerCase();
      return (
        name.includes(term) ||
        (t.job_id?.toLowerCase() || "").includes(term) ||
        (t.code?.toLowerCase()   || "").includes(term) ||
        (t.item?.toLowerCase()   || "").includes(term) ||
        (t.fault?.toLowerCase()  || "").includes(term) ||
        (t.uniq_id?.toLowerCase()|| "").includes(term) ||
        (t.remark?.toLowerCase() || "").includes(term) ||
        STATUS_MAP[t.status]?.toLowerCase().includes(term)
      );
    });
  }, [transactions, debouncedSearch, hideDelivered, statusFilter]);

  // BUG FIX 3: Reset pageIndex on actual filter/search change, not on length change
  useEffect(() => { setPageIndex(0); }, [debouncedSearch, hideDelivered, statusFilter, dateFrom, dateTo]);

  const paginatedTransactions = useMemo(() => {
    const s = pageIndex * pageSize;
    return filteredTransactions.slice(s, s + pageSize);
  }, [filteredTransactions, pageIndex, pageSize]);

  const totalPages = Math.ceil(filteredTransactions.length / pageSize);

  // ── Quick Stats (PHP mobile-stats) ────────────────────────────────────────
  const stats = useMemo(() => {
    const shown = filteredTransactions;
    return {
      total:     shown.length,
      pending:   shown.filter(t => t.status === 0).length,
      progress:  shown.filter(t => t.status === 1).length,
      completed: shown.filter(t => [2, 3, 5].includes(t.status)).length,
      totalAmt:  shown.reduce((s, t) => s + (t.amount || 0), 0),
    };
  }, [filteredTransactions]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: number) => {
    if (userRole !== "admin") { alert("Permission Denied: Sirf Admin hi delete kar sakta hai!"); return; }
    if (!confirm("Kya aap pakka is job ko delete karna chahte hain?")) return;
    const { error } = await supabase.from("transaction_list").update({ del_status: 1 }).eq("id", id);
    if (!error) setTransactions(prev => prev.filter(t => t.id !== id));
    else alert("Delete failed: " + error.message);
  }, [userRole]);

  const sendWA = (txn: Transaction) => {
    const phone = txn.client_contact?.replace(/\D/g, "");
    if (!phone || phone.length < 10) { alert("Valid mobile number nahi mila!"); return; }
    const name   = getClientName(txn);
    const amt    = (txn.amount || 0).toLocaleString("en-IN");
    const biz    = "Vikram Jain, V-Technologies, Jabalpur, Mob. 9179105875";
    const id     = txn.job_id;
    const code   = txn.code || "";
    const item   = txn.item || "";

    const msgs: Record<number, string> = {
      0: `Namaste ${name} ji 🙏!\n\nAapka *${item}* repair ke liye register ho gaya hai. 📝\n\n📋 *Details:*\nJob ID: #${id}\nCode: #${code}\nStatus: *Received/Pending*\n\nHum jald hi aapke device ko check karke update denge. Dhanyavaad! ❤️\n\n${biz}`,
      1: `Namaste ${name} ji 🙏!\n\nAapke *${item}* (Job ID: #${id}) (Code: #${code}) par kaam shuru kar diya gaya hai. 🛠️\n\nStatus: *In-Progress/Repairing*\n\nHamare technician isse jald se jald theek karne ki koshish kar rahe hain. ✨\n\n${biz}`,
      2: `Namaste ${name} ji 🙏!\n\nKhushkhabri! Aapka *${item}* repair complete ho gaya hai. ✅\n\n📋 *Details:*\nJob ID: #${id}\nCode: #${code}\nBill Amount: *₹${amt}*\n\nAap workshop par aakar apna device collect kar sakte hain. 🛍️\n\nDhanyavaad! ❤️\n\n${biz}`,
      3: `Namaste ${name} ji 🙏!\n\nAapka *${item}* (Job ID: #${id}) (Code: #${code}) deliver kar diya gaya hai. 🏁\n\nTotal Paid: *₹${amt}*\n\nV-Technologies ki seva lene ke liye dhanyavaad. ⭐\n\n${biz}`,
      4: `Namaste ${name} ji 🙏!\n\nAapka Job ID: #${id} (Code: #${code}) (*${item}*) cancel kar diya gaya hai. ❌\n\nKripya adhik jankari ke liye workshop par sampark karein. 🙏\n\n${biz}`,
      5: `Namaste ${name} ji 🙏!\n\nAapka *${item}* (Job ID: #${id}) (Code: #${code}) deliver kar diya gaya hai. 🏁\n\nTotal Paid: *₹${amt}*\n\nV-Technologies ki seva lene ke liye dhanyavaad. ⭐\n\n${biz}`,
    };
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msgs[txn.status] || msgs[0])}`, "_blank");
  };

  const printReport = () => {
    const p = new URLSearchParams();
    if (dateFrom) p.append("date_from", dateFrom);
    if (dateTo)   p.append("date_to", dateTo);
    window.open(`/api/print-transactions?${p}`, "_blank");
  };

  const exportExcel = () => {
    const p = new URLSearchParams();
    if (dateFrom) p.append("date_from", dateFrom);
    if (dateTo)   p.append("date_to", dateTo);
    window.location.href = `/api/export-transactions?${p}`;
  };

  // BUG FIX 4: shiftDay preserves all existing URL params
  const shiftDay = (dir: number) => {
    const base = dateFrom ? new Date(dateFrom) : new Date();
    base.setDate(base.getDate() + dir);
    const nd = base.toISOString().split("T")[0];
    setDateFrom(nd);
    setDateTo(nd);
    const p = new URLSearchParams(searchParams.toString());
    p.set("date_from", nd);
    p.set("date_to", nd);
    router.push(`?${p}`);
  };

  const applyDesktopFilter = () => {
    const p = new URLSearchParams();
    if (dateFrom)      p.set("date_from", dateFrom);
    if (dateTo)        p.set("date_to", dateTo);
    if (hideDelivered) p.set("hide_delivered", "1");
    router.push(`?${p}`);
  };

  const applyMobileFilter = () => {
    const p = new URLSearchParams();
    if (dateFrom)      p.set("date_from", dateFrom);
    if (dateTo)        p.set("date_to", dateTo);
    if (hideDelivered) p.set("hide_delivered", "1");
    router.push(`?${p}`);
    setShowFilterModal(false);
  };

  const resetFilters = () => {
    setDateFrom(""); setDateTo(""); setHideDelivered(false);
    setStatusFilter(""); setLocalSearch("");
    router.push("/jobs");
    setShowFilterModal(false);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4 bg-[#0d1117]">
        <Loader2 className="animate-spin text-blue-500" size={44} />
        <p className="text-slate-600 font-bold uppercase tracking-[0.3em] text-xs">V-TECH: Loading...</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // DESKTOP VIEW
  // ══════════════════════════════════════════════════════════════════
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-[#0d1117] p-4 font-sans">
        <div className="max-w-[1600px] mx-auto space-y-4">

          {/* ── Header ── */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-lg shadow-blue-500/20">
                <Wrench className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-base font-bold text-white">Transaction History</h1>
                <p className="text-xs text-slate-500">
                  {userRole === "admin" ? "👑 Admin" : "👤 Staff"} • {filteredTransactions.length} records
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/jobs/new"  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"><Plus size={14} /> New</Link>
              <Link href="/jobs/old"  className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"><History size={14} /> Old</Link>
              <Link href="/jobs/bulk" className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"><Layers size={14} /> Bulk</Link>
            </div>
          </div>

          {/* ── Quick Stats Bar (PHP feature) ── */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: "Total Jobs",   value: stats.total,                   icon: TrendingUp,    color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
              { label: "Pending",      value: stats.pending,                  icon: Clock,         color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
              { label: "In Progress",  value: stats.progress,                 icon: Wrench,        color: "text-blue-300",    bg: "bg-blue-500/10 border-blue-400/20" },
              { label: "Completed",    value: stats.completed,                icon: CheckCircle2,  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
              { label: "Total Amount", value: `₹${stats.totalAmt.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className={`${bg} border rounded-xl px-4 py-3 flex items-center gap-3`}>
                <Icon size={18} className={color} />
                <div>
                  <div className={`text-lg font-black ${color}`}>{value}</div>
                  <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Filter Bar ── */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-4">
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="bg-[#0d1117] border border-[#21293d] text-white rounded-lg px-2.5 py-1.5 text-xs focus:border-blue-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="bg-[#0d1117] border border-[#21293d] text-white rounded-lg px-2.5 py-1.5 text-xs focus:border-blue-500 outline-none transition-all" />
              </div>
              {/* BUG FIX 7: Status filter in desktop bar (was missing) */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Status</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value ? parseInt(e.target.value) : "")}
                  className="bg-[#0d1117] border border-[#21293d] text-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:border-blue-500 outline-none transition-all">
                  <option value="">All Status</option>
                  {Object.entries(STATUS_MAP).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <button onClick={applyDesktopFilter}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all">
                <Filter size={13} /> Filter
              </button>
              <button onClick={resetFilters}
                className="bg-[#21293d] hover:bg-[#2a3550] text-slate-400 px-4 py-1.5 rounded-lg text-xs font-bold transition-all">
                Reset
              </button>
              <button onClick={() => shiftDay(-1)}
                className="bg-[#21293d] hover:bg-[#2a3550] text-slate-400 border border-[#21293d] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all">
                <ChevronLeft size={13} /> Prev
              </button>
              <button onClick={() => shiftDay(1)}
                className="bg-[#21293d] hover:bg-[#2a3550] text-slate-400 border border-[#21293d] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all">
                Next <ChevronRight size={13} />
              </button>
              <button onClick={printReport}
                className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all">
                <Printer size={13} /> Print
              </button>
              <button onClick={exportExcel}
                className="bg-teal-700 hover:bg-teal-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all">
                <FileSpreadsheet size={13} /> Excel
              </button>
              <label className="flex items-center gap-2 ml-auto bg-[#0d1117] border border-[#21293d] px-3 py-1.5 rounded-lg cursor-pointer">
                <input type="checkbox" checked={hideDelivered} onChange={e => setHideDelivered(e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
                <span className="text-xs font-bold text-slate-400">Hide Delivered</span>
              </label>
            </div>
          </div>

          {/* ── Search ── */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
            <input
              type="text" placeholder="Search by job ID, client, device, fault, code, status, remark..."
              value={localSearch} onChange={e => setLocalSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#161b27] border border-[#21293d] text-slate-200 placeholder-slate-600 rounded-xl text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
            />
            {localSearch && (
              <button onClick={() => setLocalSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                <X size={15} />
              </button>
            )}
          </div>

          {/* ── Table ── */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[4%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                  <col className="w-[18%]" />
                  <col className="w-[11%]" />
                  <col className="w-[10%]" />
                  <col className="w-[5%]" />
                  <col className="w-[7%]" />
                  <col className="w-[9%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead>
                  <tr className="bg-[#111520] border-b border-[#21293d]">
                    {["#", "Date/Time", "Job/Code", "Client", "Item", "Fault", "Loc", "Amount", "Status", "Actions"].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]">
                  {paginatedTransactions.map((txn, idx) => {
                    const clientName = getClientName(txn);
                    const balance    = getClientBalance(txn);
                    const phone      = txn.client_contact?.replace(/\D/g, "") || "";

                    return (
                      <tr key={txn.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-3 py-2.5 text-slate-600 text-xs">{pageIndex * pageSize + idx + 1}</td>

                        {/* Date + Time (PHP feature) */}
                        <td className="px-3 py-2.5">
                          <div className="text-xs text-slate-300 font-medium">{fmtDate(txn.date_created)}</div>
                          <div className="text-[10px] text-slate-600 mt-0.5">{fmtTime(txn.date_created)}</div>
                        </td>

                        <td className="px-3 py-2.5">
                          <div className="font-bold text-blue-400 text-xs">#{txn.job_id}</div>
                          {txn.code && <div className="text-slate-600 text-[10px] truncate">{txn.code}</div>}
                        </td>

                        {/* Client with phone number text (PHP feature) */}
                        <td className="px-3 py-2.5">
                          <Link href={`/clients/${txn.client_name}/view`}
                            className="font-bold text-slate-200 text-xs hover:text-blue-400 truncate block max-w-[160px] transition-colors"
                            title={clientName}>
                            {clientName}
                          </Link>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <BalanceBadge bal={balance} />
                            {phone && (
                              <a href={`https://wa.me/91${phone}`} target="_blank"
                                className="flex items-center gap-0.5 text-emerald-500 hover:text-emerald-400 text-[10px]">
                                <Phone size={10} />
                                <span className="hidden xl:inline">{txn.client_contact}</span>
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-2.5 text-xs text-slate-300 truncate" title={txn.item}>{txn.item}</td>
                        <td className="px-3 py-2.5 text-xs text-red-400 truncate" title={txn.fault}>{txn.fault}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">{txn.uniq_id || "—"}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-sm text-slate-200">₹{(txn.amount || 0).toFixed(0)}</td>

                        <td className="px-3 py-2.5 text-center">
                          <span className={getStatusBadge(txn.status)}>{STATUS_MAP[txn.status]}</span>
                          {txn.status === 5 && txn.date_completed && (
                            <div className="text-[9px] text-slate-600 mt-0.5">
                              {fmtDate(txn.date_completed)} {fmtTime(txn.date_completed)}
                            </div>
                          )}
                        </td>

                        {/* Dropdown Actions */}
                        <td className="px-3 py-2.5 relative">
                          <button
                            data-dropdown-trigger
                            onClick={() => setOpenDropdownId(openDropdownId === txn.id ? null : txn.id)}
                            className="bg-[#21293d] hover:bg-[#2a3550] border border-[#2a3550] text-slate-400 hover:text-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1 mx-auto transition-all"
                          >
                            Action <ChevronDown size={12} />
                          </button>
                          {openDropdownId === txn.id && (
                            <div data-dropdown-menu
                              className="absolute right-0 mt-1 w-44 bg-[#161b27] border border-[#21293d] rounded-xl shadow-2xl z-20 py-1 overflow-hidden">
                              {[
                                { href: `/jobs/${txn.id}`,          icon: Eye,      label: "View",       cls: "text-blue-400" },
                                { href: `/jobs/edit/${txn.id}`,     icon: Settings, label: "Edit",       cls: "text-indigo-400" },
                                { href: `/jobs/old-edit/${txn.id}`, icon: History,  label: "Old Edit",   cls: "text-cyan-400" },
                              ].map(({ href, icon: Icon, label, cls }) => (
                                <Link key={label} href={href}
                                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-white/[0.04] text-sm text-slate-400 hover:text-slate-200 transition-colors"
                                  onClick={() => setOpenDropdownId(null)}>
                                  <Icon size={13} className={cls} /> {label}
                                </Link>
                              ))}
                              <button onClick={() => { sendWA(txn); setOpenDropdownId(null); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-white/[0.04] text-sm text-slate-400 hover:text-emerald-400 transition-colors">
                                <Phone size={13} className="text-emerald-400" /> WhatsApp
                              </button>
                              <a href={`/api/print-bill?job_id=${txn.job_id}`} target="_blank"
                                className="flex items-center gap-2.5 px-4 py-2 hover:bg-white/[0.04] text-sm text-slate-400 hover:text-orange-400 transition-colors"
                                onClick={() => setOpenDropdownId(null)}>
                                <Printer size={13} className="text-orange-400" /> Print Bill
                              </a>
                              {userRole === "admin" && (
                                <>
                                  <hr className="my-1 border-[#21293d]" />
                                  <button onClick={() => { handleDelete(txn.id); setOpenDropdownId(null); }}
                                    className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-red-500/10 text-sm text-red-500 transition-colors">
                                    <Trash2 size={13} /> Delete
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-16 text-slate-600">
                        <AlertCircle className="mx-auto mb-2 text-slate-700" size={32} />
                        <p className="text-sm font-bold">No transactions found</p>
                        <p className="text-xs mt-1">Try adjusting filters</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            <div className="flex items-center justify-between border-t border-[#21293d] bg-[#111520] px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Show</span>
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPageIndex(0); }}
                  className="bg-[#0d1117] border border-[#21293d] text-slate-300 rounded-lg px-2 py-1 text-xs outline-none">
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={filteredTransactions.length}>All</option>
                </select>
                <span>entries • {filteredTransactions.length} total</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button onClick={() => setPageIndex(p => Math.max(p - 1, 0))} disabled={pageIndex === 0}
                  className="px-3 py-1.5 bg-[#21293d] border border-[#21293d] text-slate-400 rounded-lg disabled:opacity-30 hover:bg-[#2a3550] transition-all">
                  ← Prev
                </button>
                <span className="text-slate-500 px-2">Page {pageIndex + 1} / {totalPages || 1}</span>
                <button onClick={() => setPageIndex(p => Math.min(p + 1, totalPages - 1))} disabled={pageIndex >= totalPages - 1}
                  className="px-3 py-1.5 bg-[#21293d] border border-[#21293d] text-slate-400 rounded-lg disabled:opacity-30 hover:bg-[#2a3550] transition-all">
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // MOBILE VIEW
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0d1117] pb-28">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-900/90 to-[#0d1117]/95 backdrop-blur border-b border-[#21293d] p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600/20 border border-blue-600/30 p-1.5 rounded-full">
              <Wrench size={16} className="text-blue-400" />
            </div>
            <h1 className="text-sm font-black text-white tracking-wide">Transactions</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              {filteredTransactions.length} records
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
          <input type="text" placeholder="Search jobs, clients, items..."
            value={localSearch} onChange={e => setLocalSearch(e.target.value)}
            className="w-full pl-9 pr-10 py-2 bg-[#161b27] border border-[#21293d] text-slate-200 placeholder-slate-600 rounded-xl text-sm outline-none" />
          <button onClick={() => setShowFilterModal(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 p-1.5 rounded-lg text-white">
            <Filter size={13} />
          </button>
        </div>

        <div className="flex items-center justify-between mt-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
            <input type="checkbox" checked={hideDelivered} onChange={e => setHideDelivered(e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
            Hide Delivered
          </label>
          <div className="flex gap-1">
            <button onClick={() => shiftDay(-1)} className="text-[10px] bg-[#21293d] text-slate-400 px-2 py-1 rounded-lg flex items-center gap-0.5">
              <ChevronLeft size={11} /> Prev
            </button>
            <button onClick={() => shiftDay(1)} className="text-[10px] bg-[#21293d] text-slate-400 px-2 py-1 rounded-lg flex items-center gap-0.5">
              Next <ChevronRight size={11} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick Stats (PHP mobile-stats feature) ── */}
      <div className="grid grid-cols-3 gap-2 px-3 pt-3">
        {[
          { label: "Total",     value: stats.total,     color: "text-blue-400",    border: "border-blue-500/30",    bg: "bg-blue-500/5" },
          { label: "Pending",   value: stats.pending,   color: "text-amber-400",   border: "border-amber-500/30",   bg: "bg-amber-500/5" },
          { label: "Completed", value: stats.completed, color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/5" },
        ].map(({ label, value, color, border, bg }) => (
          <div key={label} className={`${bg} border ${border} rounded-xl py-2.5 text-center`}>
            <div className={`text-xl font-black ${color}`}>{value}</div>
            <div className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">{label}</div>
          </div>
        ))}
      </div>
      <div className="mx-3 mt-2 bg-purple-500/5 border border-purple-500/20 rounded-xl py-2 px-4 flex items-center justify-between">
        <span className="text-[10px] text-slate-600 font-bold uppercase">Total Amount</span>
        <span className="text-sm font-black text-purple-400">₹{stats.totalAmt.toLocaleString("en-IN")}</span>
      </div>

      {/* ── Search results indicator ── */}
      {debouncedSearch && (
        <div className="mx-3 my-2 bg-[#161b27] border border-[#21293d] p-2.5 rounded-xl flex justify-between items-center text-xs">
          <span className="text-slate-500">Found <strong className="text-blue-400">{filteredTransactions.length}</strong> results</span>
          <button onClick={() => setLocalSearch("")} className="text-slate-600 hover:text-slate-400"><X size={14} /></button>
        </div>
      )}

      {/* ── Transaction Cards ── */}
      <div className="p-3 space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="bg-[#161b27] border border-[#21293d] p-10 rounded-2xl text-center">
            <AlertCircle className="mx-auto text-slate-700 mb-2" size={36} />
            <p className="text-slate-500 text-sm font-bold">No transactions found</p>
            <p className="text-xs text-slate-600 mt-1">Adjust filters or search</p>
          </div>
        ) : (
          filteredTransactions.map(txn => {
            const clientName = getClientName(txn);
            const balance    = getClientBalance(txn);
            const phone      = txn.client_contact?.replace(/\D/g, "") || "";

            return (
              <div key={txn.id}
                className={`bg-[#161b27] rounded-2xl border border-[#21293d] border-l-4 overflow-hidden ${STATUS_BORDER[txn.status] || "border-l-slate-600"}`}>

                {/* Card Top */}
                <div className="flex justify-between items-start p-3 bg-gradient-to-r from-white/[0.02] to-transparent">
                  <div className="flex-1 min-w-0">
                    <Link href={`/jobs/${txn.id}`} className="font-black text-sm text-white hover:text-blue-400 transition-colors">
                      #{txn.job_id}
                    </Link>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
                        {txn.code || "No Code"}
                      </span>
                      <span className="text-[10px] text-slate-600">
                        {fmtDate(txn.date_created)}
                      </span>
                    </div>
                    {/* PHP feature: Delivered datetime under status */}
                    {txn.status === 5 && txn.date_completed && (
                      <div className="flex items-center gap-1 mt-1 text-[9px] text-emerald-500">
                        <CheckCircle2 size={9} />
                        Delivered: {fmtDateTime(txn.date_completed)}
                      </div>
                    )}
                  </div>
                  <span className={`${getStatusBadge(txn.status)} ml-2 flex-shrink-0`}>{STATUS_MAP[txn.status]}</span>
                </div>

                {/* Client Info */}
                <div className="px-3 py-2.5 border-t border-[#21293d]">
                  <Link href={`/clients/${txn.client_name}/view`}
                    className="font-bold text-sm text-slate-200 hover:text-blue-400 transition-colors block truncate">
                    {clientName}
                  </Link>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <BalanceBadge bal={balance} />
                    {phone && (
                      <a href={`https://wa.me/91${phone}`} target="_blank"
                        className="flex items-center gap-1 text-emerald-500 text-[10px] hover:text-emerald-400">
                        <Phone size={10} /> {txn.client_contact}
                      </a>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="px-3 py-2.5 border-t border-[#21293d] space-y-1.5 text-xs">
                  {[
                    { label: "Item/Model", value: txn.item, cls: "text-slate-300 font-bold" },
                    { label: "Fault/Issue", value: txn.fault, cls: "text-red-400" },
                    { label: "Location ID", value: txn.uniq_id || "—", cls: "text-slate-400" },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className="flex justify-between gap-2">
                      <span className="text-slate-600 flex-shrink-0">{label}:</span>
                      <span className={`${cls} text-right`}>{value}</span>
                    </div>
                  ))}
                  {txn.remark && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-600 flex-shrink-0 flex items-center gap-1">
                        <MessageSquare size={10} /> Remark:
                      </span>
                      <span className="text-slate-400 text-right">{txn.remark}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-sm pt-1 border-t border-[#21293d]">
                    <span className="text-slate-600">Bill Amount:</span>
                    <span className="text-emerald-400">₹{(txn.amount || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Additional Info (PHP feature) */}
                <div className="px-3 py-2 bg-[#111520] border-t border-[#21293d] space-y-1">
                  <div className="flex justify-between text-[9px]">
                    <span className="text-slate-700">Created:</span>
                    <span className="text-slate-600">{fmtDateTime(txn.date_created)}</span>
                  </div>
                  {txn.date_updated && txn.date_updated !== txn.date_created && (
                    <div className="flex justify-between text-[9px]">
                      <span className="text-slate-700">Last Updated:</span>
                      <span className="text-slate-600">{fmtDateTime(txn.date_updated)}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons (6 grid) */}
                <div className="grid grid-cols-3 gap-1.5 p-3 bg-[#111520] border-t border-[#21293d]">
                  {[
                    { href: `/jobs/${txn.id}`,          icon: Eye,      label: "View",     border: "border-blue-500/20",    text: "text-blue-400"    },
                    { href: null,                        icon: Phone,    label: "WhatsApp", border: "border-emerald-500/20", text: "text-emerald-400", onClick: () => sendWA(txn) },
                    { href: `/api/print-bill?job_id=${txn.job_id}`, icon: Printer, label: "Print", border: "border-orange-500/20", text: "text-orange-400", target: "_blank" },
                    { href: `/jobs/old-edit/${txn.id}`,  icon: History,  label: "Old Edit", border: "border-cyan-500/20",   text: "text-cyan-400"    },
                    { href: `/jobs/edit/${txn.id}`,      icon: Settings, label: "Edit",     border: "border-indigo-500/20", text: "text-indigo-400"  },
                  ].map(({ href, icon: Icon, label, border, text, onClick, target }) =>
                    href ? (
                      <a key={label} href={href} target={target}
                        className={`flex flex-col items-center p-2 bg-[#161b27] rounded-xl border ${border} ${text} text-[9px] font-bold gap-1 hover:opacity-80 transition-all`}>
                        <Icon size={14} /><span>{label}</span>
                      </a>
                    ) : (
                      <button key={label} onClick={onClick}
                        className={`flex flex-col items-center p-2 bg-[#161b27] rounded-xl border ${border} ${text} text-[9px] font-bold gap-1 hover:opacity-80 transition-all`}>
                        <Icon size={14} /><span>{label}</span>
                      </button>
                    )
                  )}
                  {userRole === "admin" && (
                    <button onClick={() => handleDelete(txn.id)}
                      className="flex flex-col items-center p-2 bg-[#161b27] rounded-xl border border-red-500/20 text-red-400 text-[9px] font-bold gap-1 hover:opacity-80 transition-all">
                      <Trash2 size={14} /><span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── FAB ── */}
      <div className="fixed bottom-20 right-4 z-20">
        <button onClick={() => setFabOpen(!fabOpen)}
          className="w-13 h-13 w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full shadow-xl shadow-blue-500/30 flex items-center justify-center text-white border border-blue-500/30 transition-all active:scale-95">
          <Plus size={22} className={`transition-transform ${fabOpen ? "rotate-45" : ""}`} />
        </button>
        {fabOpen && (
          <div className="absolute bottom-14 right-0 bg-[#161b27] border border-[#21293d] rounded-2xl shadow-2xl py-1.5 w-44 text-sm overflow-hidden">
            {[
              { href: "/jobs/new",  icon: Plus,          label: "Create New",   cls: "text-blue-400"    },
              { href: "/jobs/old",  icon: History,       label: "Old Jobs",     cls: "text-amber-400"   },
              { href: "/jobs/bulk", icon: Layers,        label: "Bulk Entry",   cls: "text-emerald-400" },
            ].map(({ href, icon: Icon, label, cls }) => (
              <Link key={label} href={href} onClick={() => setFabOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/[0.04] text-slate-400 hover:text-slate-200 transition-colors">
                <Icon size={14} className={cls} /> {label}
              </Link>
            ))}
            <hr className="my-1 border-[#21293d]" />
            <button onClick={() => { printReport(); setFabOpen(false); }}
              className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/[0.04] text-slate-400 w-full transition-colors">
              <Printer size={14} className="text-emerald-400" /> Print
            </button>
            <button onClick={() => { exportExcel(); setFabOpen(false); }}
              className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/[0.04] text-slate-400 w-full transition-colors">
              <FileSpreadsheet size={14} className="text-teal-400" /> Excel
            </button>
          </div>
        )}
      </div>

      {/* ── Filter Modal ── */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/70 z-30 flex items-center justify-center p-4">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-white">Filter Transactions</h3>
              <button onClick={() => setShowFilterModal(false)} className="text-slate-500 hover:text-slate-300">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: "From Date", value: dateFrom, set: setDateFrom },
                { label: "To Date",   value: dateTo,   set: setDateTo   },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
                  <input type="date" value={value} onChange={e => set(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#21293d] text-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500 transition-all" />
                </div>
              ))}
              {/* Mobile day nav in modal */}
              <div className="flex gap-2">
                <button onClick={() => shiftDay(-1)} className="flex-1 bg-[#21293d] text-slate-400 p-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                  <ChevronLeft size={13} /> Prev Day
                </button>
                <button onClick={() => shiftDay(1)} className="flex-1 bg-[#21293d] text-slate-400 p-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                  Next Day <ChevronRight size={13} />
                </button>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value ? parseInt(e.target.value) : "")}
                  className="w-full bg-[#0d1117] border border-[#21293d] text-slate-300 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500 transition-all">
                  <option value="">All Status</option>
                  {Object.entries(STATUS_MAP).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={resetFilters}
                  className="flex-1 bg-[#21293d] text-slate-400 p-2.5 rounded-xl text-sm font-bold transition-all hover:bg-[#2a3550]">
                  Reset
                </button>
                <button onClick={applyMobileFilter}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl text-sm font-bold transition-all">
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page Wrapper ─────────────────────────────────────────────────────────────
export default function JobsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d1117] gap-4">
        <Loader2 className="animate-spin text-blue-500" size={44} />
        <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.3em]">Loading...</p>
      </div>
    }>
      <JobsListContent />
    </Suspense>
  );
}