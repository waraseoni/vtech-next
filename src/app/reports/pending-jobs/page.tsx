"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { pageAll } from "@/lib/fetch-all";
import {
  Clock,
  Search,
  Printer,
  MessageSquare,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Calendar,
  Smartphone,
  ChevronLeft,
  Hourglass,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
  RotateCcw,
  ListChecks,
} from "lucide-react";
import Link from "next/link";
import { formatIST, todayIST, currentMonthIST, parseISTDate } from "@/lib/dateUtils";
import { JOB_STATUS } from "@/lib/status-colors";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

type DbRow = ReturnType<typeof JSON.parse>;

const STATUS_MAP: Record<number, { label: string; class: string }> = Object.fromEntries(
  [0, 1, 2, 3].map((n) => [
    n,
    { label: JOB_STATUS[n]?.label ?? "Unknown", class: JOB_STATUS[n]?.cls ?? JOB_STATUS[0].cls },
  ])
);

/* ---- dd/mm/yyyy date helpers (internal storage stays YYYY-MM-DD) ---- */
const toDMY = (iso: string): string => (iso ? iso.split("-").reverse().join("/") : "");

const fromDMY = (dmy: string): string => {
  const m = dmy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  if (!dd || !mm || !y) return "";
  const dt = new Date(y, mm - 1, dd);
  if (dt.getFullYear() !== y || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return "";
  return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
};

const DMYDateField = ({ value, onChange }: { value: string; onChange: (iso: string) => void }) => {
  const [text, setText] = useState(toDMY(value));

  useEffect(() => {
    setText(toDMY(value));
  }, [value]);

  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let out = "";
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    else out = digits;
    setText(out);
    onChange(fromDMY(out));
  };

  return (
    <div className="relative">
      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
      <input
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={text}
        onChange={(e) => handle(e.target.value)}
        className="w-full pl-12 pr-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-sm text-slate-200 outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
      />
    </div>
  );
};

function PendingJobsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [from, setFrom] = useState(searchParams.get("from") || "");
  const [to, setTo] = useState(searchParams.get("to") || todayIST());
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [monthView, setMonthView] = useState(
    searchParams.get("period") ? searchParams.get("period") === "month" : false
  );
  const [anchorMonth, setAnchorMonth] = useState(searchParams.get("month") || currentMonthIST());
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<DbRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [mobileVisible, setMobileVisible] = useState(12);
  const mobileSentinelRef = useRef<HTMLDivElement | null>(null);

  const applyAll = () => {
    setMonthView(false);
    setFrom("");
    setTo(todayIST());
  };

  const applyMonth = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    setAnchorMonth(ym);
    setMonthView(true);
    setFrom(`${ym}-01`);
    setTo(`${ym}-${String(last).padStart(2, "0")}`);
  };

  const shiftMonth = (dir: number) => {
    const base = monthView ? anchorMonth : currentMonthIST();
    const d = parseISTDate(base + "-01");
    d.setMonth(d.getMonth() + dir);
    const ym = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
    }).format(d);
    applyMonth(ym);
  };

  const daysPending = (dateStr: string): number => {
    const created = new Date(
      dateStr.includes("T") ? dateStr : dateStr + "T00:00:00+05:30"
    ).getTime();
    const end = new Date(todayIST() + "T23:59:59+05:30").getTime();
    return Math.max(0, Math.round((end - created) / 86_400_000));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const end = `${to}T23:59:59+05:30`;

      let query = supabase
        .from("transaction_list")
        .select("*")
        .neq("status", 5) // Exclude Delivered
        .neq("status", 4) // Exclude Cancelled
        .eq("del_status", 0)
        .lte("date_created", end);

      // "All Time" (empty from) → no lower-bound filter, so NOTHING is excluded.
      if (from) {
        query = query.gte("date_created", `${from}T00:00:00+05:30`);
      }

      if (status !== "all") {
        query = query.eq("status", parseInt(status));
      }

      query = query.order("date_created", { ascending: false });

      const { data } = await pageAll(query);

      const pendingJobs = data || [];
      if (pendingJobs.length === 0) {
        setJobs([]);
        setLoading(false);
        return;
      }

      const clientIdsNum = [
        ...new Set(pendingJobs.map((t) => Number(t.client_name)).filter((id) => !isNaN(id))),
      ];

      const clientMap = new Map();
      if (clientIdsNum.length > 0) {
        const { data: clients, error: clientErr } = await supabase
          .from("client_list")
          .select("id, firstname, lastname, contact")
          .in("id", clientIdsNum);

        if (!clientErr && clients) {
          clients.forEach((c) => clientMap.set(c.id, c));
        }
      }

      const enrichedJobs = pendingJobs.map((job) => ({
        ...job,
        client: clientMap.get(Number(job.client_name)) || null,
      }));

      setJobs(enrichedJobs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [from, to, status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(searchParams.toString());
    p.set("from", from);
    p.set("to", to);
    p.set("status", status);
    p.set("period", monthView ? "month" : "all");
    p.set("month", anchorMonth);
    router.replace("?" + p.toString(), { scroll: false });
  };

  const filteredJobs = jobs.filter((j) => {
    const clientName = `${j.client?.firstname || ""} ${j.client?.lastname || ""}`.toLowerCase();
    const contact = (j.client?.contact || "").toLowerCase();
    const jobId = (j.job_id || "").toLowerCase();
    const item = (j.item || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      clientName.includes(query) ||
      contact.includes(query) ||
      jobId.includes(query) ||
      item.includes(query)
    );
  });

  const totalAmount = filteredJobs.reduce((s, j) => s + (parseFloat(j.amount) || 0), 0);

  const totalPending = filteredJobs.length;
  const overdueCount = filteredJobs.filter((j) => daysPending(j.date_created) > 7).length;
  const agingMax = filteredJobs.reduce((s, j) => Math.max(s, daysPending(j.date_created)), 0);

  const ageStyle = (days: number) => {
    if (days <= 3) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
    if (days <= 7) return "bg-amber-500/10 text-amber-400 border-amber-500/25";
    if (days <= 15) return "bg-orange-500/10 text-orange-400 border-orange-500/25";
    return "bg-red-500/10 text-red-400 border-red-500/25";
  };

  const shortDate = (d: string) =>
    new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const periodLabel = monthView
    ? new Date(anchorMonth + "-01").toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      })
    : !from
      ? "All Time"
      : `${shortDate(from)} – ${shortDate(to)}`;

  const effectiveSize = pageSize === 0 ? Math.max(filteredJobs.length, 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / effectiveSize));
  const safePage = Math.min(page, totalPages);
  const pageJobs = filteredJobs.slice((safePage - 1) * effectiveSize, safePage * effectiveSize);
  const mobileJobs = filteredJobs.slice(0, mobileVisible);

  // Pagination page-window: at most 5 page numbers, with ellipsis when needed.
  const MAX_PAGES = 5;
  const pageWindow = (): (number | "…")[] => {
    if (totalPages <= MAX_PAGES) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const half = Math.floor(MAX_PAGES / 2);
    let start = safePage - half;
    let end = safePage + half;
    if (start < 1) {
      start = 1;
      end = MAX_PAGES;
    }
    if (end > totalPages) {
      end = totalPages;
      start = totalPages - MAX_PAGES + 1;
    }
    const out: (number | "…")[] = [];
    if (start > 1) out.push(1);
    if (start > 2) out.push("…");
    for (let i = start; i <= end; i++) out.push(i);
    if (end < totalPages - 1) out.push("…");
    if (end < totalPages) out.push(totalPages);
    return out;
  };

  useEffect(() => {
    setPage(1);
    setMobileVisible(12);
  }, [searchQuery, status, from, to, monthView, pageSize]);

  useEffect(() => {
    document.title = "Jobs in Shop";
  }, []);

  // Mobile lazy-load: load more jobs when the sentinel scrolls into view.
  useEffect(() => {
    if (typeof window === "undefined" || !mobileSentinelRef.current) return;
    const el = mobileSentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setMobileVisible((v) => Math.min(v + 12, filteredJobs.length));
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [filteredJobs.length]);

  const sendWhatsApp = (job: DbRow) => {
    const phone = (job.client?.contact || "").replace(/\D/g, "");
    if (phone.length < 10) return alert("Valid mobile number nahi mila!");

    const clientName = `${job.client?.firstname || ""} ${job.client?.lastname || ""}`.trim();
    const amount = parseFloat(job.amount).toLocaleString("en-IN");
    const businessName = "Vikram Jain, V-Technologies, Jabalpur, Mob. 9179105875";
    let msg = "";

    switch (parseInt(job.status)) {
      case 0:
        msg = `Namaste ${clientName} ji 🙏!\n\nAapka *${job.item}* (Job ID: #${job.job_id}) humare workshop mein receive ho gaya hai. 🛠️\n\nEstimated amount: *₹${amount}*.\n\nKaam shuru hote hi aapko suchit kiya jayega. Dhanyavaad! ❤️\n\n${businessName}`;
        break;
      case 1:
        msg = `Namaste ${clientName} ji 🙏!\n\nAapke *${job.item}* (Job ID: #${job.job_id}) par kaam chal raha hai. ⚙️\n\nJald hi yeh taiyar ho jayega. Dhanyavaad! ❤️\n\n${businessName}`;
        break;
      case 2:
        msg = `Namaste ${clientName} ji 🙏!\n\nKhushkhabri! Aapka *${job.item}* (Job ID: #${job.job_id}) taiyar ho gaya hai. ✅\n\nTotal Amount: *₹${amount}*.\n\nAap kisi bhi samay aakar ise le sakte hain. Dhanyavaad! ❤️\n\n${businessName}`;
        break;
      default:
        msg = `Namaste ${clientName} ji 🙏!\n\nAapka Job ID: #${job.job_id} (${job.item}) pending status par hai. Hum jald hi sampark karenge. Dhanyavaad! ❤️\n\n${businessName}`;
    }

    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div className="flex items-center gap-5">
            <Link
              href="/reports"
              className="w-12 h-12 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-2xl text-slate-500 hover:text-white hover:bg-blue-600/10 hover:border-blue-500/40 transition-all group"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-700 rounded-3xl flex items-center justify-center shadow-xl shadow-amber-500/20 ring-4 ring-amber-500/10">
              <Clock size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Jobs in Shop</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.3em]">
                All jobs in the workshop (yet to be delivered)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-[#0d1117] border border-amber-500/20 px-6 py-3 rounded-2xl flex flex-col items-end">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                Total Shop Value
              </span>
              <span className="text-2xl font-black text-white">{inr(totalAmount)}</span>
            </div>
            <button
              onClick={() => window.print()}
              className="w-12 h-12 flex items-center justify-center bg-[#1e2637] border border-[#2a3550] hover:border-indigo-500/40 text-slate-400 hover:text-white rounded-2xl transition-all shadow-lg"
            >
              <Printer size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 no-print">
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 md:p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Jobs in Shop
            </p>
            <h3 className="text-xl md:text-2xl font-black text-white">{totalPending}</h3>
          </div>
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
            <ListChecks size={20} />
          </div>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 md:p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Value in Shop
            </p>
            <h3 className="text-xl md:text-2xl font-black text-amber-400">{inr(totalAmount)}</h3>
          </div>
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400">
            <Clock size={20} />
          </div>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 md:p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Overdue (&gt;7 days)
            </p>
            <h3 className="text-xl md:text-2xl font-black text-red-400">{overdueCount}</h3>
          </div>
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
            <AlertTriangle size={20} />
          </div>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 md:p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Oldest Job
            </p>
            <h3 className="text-xl md:text-2xl font-black text-blue-400">
              {totalPending ? `${agingMax}d` : "—"}
            </h3>
          </div>
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Hourglass size={20} />
          </div>
        </div>
      </div>

      {/* Filters Card (single box) */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] p-4 md:p-6 no-print shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21293d] rounded-2xl p-1 w-max">
            <button
              onClick={applyAll}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                !monthView
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => applyMonth(anchorMonth)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                monthView
                  ? "bg-amber-600 text-white shadow-md shadow-amber-900/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Monthly
            </button>
          </div>

          {monthView && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => shiftMonth(-1)}
                className="w-10 h-10 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-xl text-slate-400 hover:text-white hover:border-amber-500/50 hover:bg-[#1c2231] transition-all"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="month"
                value={anchorMonth}
                onChange={(e) => e.target.value && applyMonth(e.target.value)}
                className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-200 outline-none focus:border-amber-500/50 text-center [color-scheme:dark]"
              />
              <button
                onClick={() => shiftMonth(1)}
                className="w-10 h-10 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-xl text-slate-400 hover:text-white hover:border-amber-500/50 hover:bg-[#1c2231] transition-all"
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
              {anchorMonth !== currentMonthIST() && (
                <button
                  onClick={() => applyMonth(currentMonthIST())}
                  className="flex items-center gap-1.5 px-3 py-2 bg-transparent hover:bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-bold transition-all"
                  title="Go to current month"
                >
                  <RotateCcw size={13} /> Current
                </button>
              )}
            </div>
          )}

          <span
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 ${
              monthView
                ? "bg-amber-500/10 border border-amber-500/25 text-amber-400"
                : "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
            }`}
          >
            <Calendar size={13} />
            {periodLabel}
          </span>
        </div>

        <div className="h-px bg-[#21293d] mb-5" />

        <form
          onSubmit={handleFilter}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end"
        >
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] ml-2">
              Created From (dd/mm/yyyy)
            </label>
            <DMYDateField
              value={from}
              onChange={(v) => {
                setFrom(v);
                setMonthView(false);
              }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] ml-2">
              Created To (dd/mm/yyyy)
            </label>
            <DMYDateField
              value={to}
              onChange={(v) => {
                setTo(v);
                setMonthView(false);
              }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] ml-2">
              Job Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-sm text-slate-200 outline-none focus:border-amber-500 transition-all cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="0">Just Pending</option>
              <option value="1">In Progress</option>
              <option value="2">Finished (Unpaid)</option>
              <option value="3">Paid (Not Delivered)</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-amber-600/20"
          >
            Refresh Report
          </button>
        </form>

        <div className="relative mt-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
          <input
            type="text"
            placeholder="Search by Job ID, Client, Contact or Item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-sm text-slate-200 outline-none focus:border-amber-500 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-[#161b27] border border-[#21293d] rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#0d1117] text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">
              <tr>
                <th className="px-6 py-5">Job ID / Date</th>
                <th className="px-6 py-5">Client Details</th>
                <th className="px-6 py-5">Item & Reported Fault</th>
                <th className="px-6 py-5 text-center">Status</th>
                <th className="px-6 py-5 text-center">Aging</th>
                <th className="px-6 py-5 text-right">Est. Amount</th>
                <th className="px-6 py-5 text-center no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21293d]">
              {loading ? (
                Array(6)
                  .fill(0)
                  .map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="px-6 py-8">
                        <div className="h-4 bg-slate-800/50 rounded-full w-full"></div>
                      </td>
                    </tr>
                  ))
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-slate-600 italic">
                    No jobs in shop found for the selected criteria.
                  </td>
                </tr>
              ) : (
                pageJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <Link
                          href={`/jobs/${job.id}/view`}
                          className="text-white font-black hover:text-amber-500 transition-colors"
                        >
                          #{job.job_id}
                        </Link>
                        <span className="text-[10px] text-slate-500 mt-1 font-bold">
                          {formatIST(job.date_created, {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <Link
                          href={`/clients/${job.client_name}/view`}
                          className="text-slate-200 font-bold hover:text-blue-400 transition-colors"
                        >
                          {job.client?.firstname} {job.client?.lastname}
                        </Link>
                        <span className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                          <Smartphone size={10} className="text-slate-700" /> {job.client?.contact}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">{job.item}</span>
                        <span className="text-[10px] text-rose-500/80 mt-1 font-bold italic uppercase tracking-wider">
                          Fault: {job.fault}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span
                        className={`px-3 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${STATUS_MAP[job.status]?.class}`}
                      >
                        {STATUS_MAP[job.status]?.label}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${ageStyle(daysPending(job.date_created))}`}
                        title={`${daysPending(job.date_created)} day(s) since created`}
                      >
                        <Hourglass size={11} />
                        {daysPending(job.date_created)}d
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right font-black text-amber-500 text-base">
                      {inr(job.amount)}
                    </td>
                    <td className="px-6 py-5 no-print">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => sendWhatsApp(job)}
                          className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm group/btn"
                          title="WhatsApp Reminder"
                        >
                          <MessageSquare
                            size={16}
                            className="group-hover/btn:scale-110 transition-transform"
                          />
                        </button>
                        <Link
                          href={`/jobs/${job.id}/view`}
                          className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-sm group/btn"
                        >
                          <ChevronRight
                            size={16}
                            className="group-hover/btn:translate-x-0.5 transition-transform"
                          />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3 no-print">
        {loading ? (
          <div className="bg-[#161b27] border border-[#21293d] rounded-3xl overflow-hidden p-6">
            <Loader2 size={28} className="animate-spin text-amber-500 mx-auto" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-[#161b27] border border-[#21293d] rounded-3xl py-16 px-6 text-center text-slate-600 italic">
            No jobs in shop found for the selected criteria.
          </div>
        ) : (
          mobileJobs.map((job) => {
            const age = daysPending(job.date_created);
            return (
              <div
                key={job.id}
                className="bg-[#161b27] border border-[#21293d] rounded-3xl p-4 shadow-xl hover:border-amber-500/40 transition-all animate-in fade-in slide-in-from-bottom-2 duration-500"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <Link
                    href={`/jobs/${job.id}/view`}
                    className="text-white font-black text-base hover:text-amber-500 transition-colors leading-tight"
                  >
                    #{job.job_id}
                    <span className="block text-[10px] text-slate-500 font-bold mt-0.5">
                      {formatIST(job.date_created, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </Link>
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${ageStyle(age)}`}
                    >
                      <Hourglass size={10} /> {age}d old
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${STATUS_MAP[job.status]?.class}`}
                    >
                      {STATUS_MAP[job.status]?.label}
                    </span>
                  </div>
                </div>

                <div className="border-t border-[#21293d] pt-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/clients/${job.client_name}/view`}
                      className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors truncate"
                    >
                      {job.client?.firstname} {job.client?.lastname}
                    </Link>
                    <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                      <Smartphone size={11} className="text-slate-600" /> {job.client?.contact}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{job.item}</div>
                    <div className="text-[10px] text-rose-500/80 font-bold italic uppercase tracking-wider">
                      Fault: {job.fault}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-black text-amber-500">{inr(job.amount)}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => sendWhatsApp(job)}
                        className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                        title="WhatsApp Reminder"
                      >
                        <MessageSquare size={16} />
                      </button>
                      <Link
                        href={`/jobs/${job.id}/view`}
                        className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                      >
                        <ChevronRight size={16} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {!loading && filteredJobs.length > 0 && mobileVisible < filteredJobs.length && (
          <div ref={mobileSentinelRef} className="flex justify-center py-4">
            <Loader2 size={22} className="animate-spin text-amber-500" />
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredJobs.length > 0 && (
        <div className="hidden md:flex items-center justify-between flex-wrap gap-3 bg-[#161b27] border border-[#21293d] rounded-2xl p-3 no-print">
          <div className="flex items-center gap-3 flex-wrap px-2">
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Rows/page
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-[#0d1117] border border-[#21293d] rounded-lg px-2 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500/50"
              >
                <option value={10}>10</option>
                <option value={12}>12</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={0}>All</option>
              </select>
            </label>
            <p className="text-xs text-slate-500 font-bold">
              Showing{" "}
              <span className="text-slate-300">
                {filteredJobs.length > 0
                  ? `${(safePage - 1) * effectiveSize + 1}–${Math.min(safePage * effectiveSize, filteredJobs.length)}`
                  : "0–0"}
              </span>{" "}
              of <span className="text-slate-300">{filteredJobs.length}</span> jobs in shop
            </p>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(1)}
                disabled={safePage <= 1}
                className="w-9 h-9 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-xl text-slate-300 hover:text-white hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="First page"
              >
                <ChevronsLeft size={15} />
              </button>
              <button
                onClick={() => setPage(safePage - 1)}
                disabled={safePage <= 1}
                className="w-9 h-9 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-xl text-slate-300 hover:text-white hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              {pageWindow().map((n, idx) =>
                n === "…" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-9 h-9 flex items-center justify-center text-slate-600 text-xs font-bold select-none"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-black transition-all ${
                      n === safePage
                        ? "bg-amber-600 text-white shadow-md shadow-amber-900/20"
                        : "bg-[#0d1117] border border-[#21293d] text-slate-400 hover:text-white hover:border-amber-500/50"
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= totalPages}
                className="w-9 h-9 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-xl text-slate-300 hover:text-white hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Next page"
              >
                <ChevronRight size={15} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={safePage >= totalPages}
                className="w-9 h-9 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-xl text-slate-300 hover:text-white hover:border-amber-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Last page"
              >
                <ChevronsRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Print Only Table */}
      <div className="hidden print:block">
        <table className="w-full text-xs border-collapse text-black">
          <thead>
            <tr>
              {["Job ID", "Client", "Item / Fault", "Status", "Aging", "Amount"].map((h) => (
                <th
                  key={h}
                  className="border border-gray-300 bg-gray-100 px-2 py-2 text-left font-black uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredJobs.map((job) => (
              <tr key={job.id}>
                <td className="border border-gray-300 px-2 py-1.5 font-bold">
                  #{job.job_id}
                  <div className="text-[10px] text-gray-500 font-normal">
                    {formatIST(job.date_created, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </td>
                <td className="border border-gray-300 px-2 py-1.5">
                  {job.client?.firstname} {job.client?.lastname}
                  <div className="text-[10px] text-gray-500">{job.client?.contact}</div>
                </td>
                <td className="border border-gray-300 px-2 py-1.5">
                  {job.item}
                  <div className="text-[10px] text-gray-500">Fault: {job.fault}</div>
                </td>
                <td className="border border-gray-300 px-2 py-1.5">
                  {STATUS_MAP[job.status]?.label}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-center">
                  {daysPending(job.date_created)}d
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-right font-bold">
                  {inr(job.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-600 font-bold mt-3 text-center">
          Total Shop Value: {inr(totalAmount)} | Period: {periodLabel}
        </p>
      </div>
    </div>
  );
}

export default function PendingJobsReport() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-48">
          <Loader2 size={48} className="animate-spin text-amber-500" />
        </div>
      }
    >
      <PendingJobsContent />
    </Suspense>
  );
}
