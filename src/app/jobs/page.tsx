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

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { supabase, getCachedUser } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { todayIST, toISTString, parseISTDate, formatIST, dtLocalToIST } from "@/lib/dateUtils";
import { downloadBlob } from "@/lib/nativePrint";
import {
  Plus,
  Eye,
  Settings,
  Wrench,
  Search,
  Loader2,
  Trash2,
  Phone,
  Filter,
  Printer,
  FileSpreadsheet,
  History,
  Layers,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ChevronDown,
  X,
  TrendingUp,
  Clock,
  CheckCircle2,
  IndianRupee,
  MessageSquare,
  Square,
  CheckSquare,
  Zap,
  ArrowRight,
  User,
  PenSquare,
  FileText,
  MessageCircle,
  Truck,
  LayoutGrid,
  List,
  MapPin,
  Eraser,
  Briefcase,
  ScanEye,
} from "lucide-react";
import PageLoader from "@/components/PageLoader";
import WaPreviewModal from "@/components/WaPreviewModal";
import { JobPreviewPanel } from "./JobPreviewPanel";
import JobSpotPicker from "@/components/JobSpotPicker";
import WaitingPartsBadge from "@/components/WaitingPartsBadge";
import { substituteTemplate, firmVars, resolveTemplate } from "@/lib/whatsapp";
import { logActivity } from "@/lib/activity";
import { getNextJobId, bumpJobCounter } from "@/lib/jobIdCounter";
import { safeImageSrc } from "@/lib/image-utils";
import { JOB_STATUS } from "@/lib/status-colors";
import { logger } from "@/lib/logger";
import { toast } from "@/lib/toast";
import { requireAdmin } from "@/lib/requireAdmin";
import { CanWrite } from "@/lib/viewOnly";
import { useViewOnly } from "@/lib/viewOnly";

// ─── WhatsApp status template keys (PHP: pending=0, repairing=1, ready=2, delivered=3/5, cancelled=4) ─
const STATUS_WA_KEY: Record<number, string> = {
  0: "whatsapp_status_pending",
  1: "whatsapp_status_repairing",
  2: "whatsapp_status_ready",
  3: "whatsapp_status_delivered",
  4: "whatsapp_status_cancelled",
  5: "whatsapp_status_delivered",
};

// ─── Types ───────────────────────────────────────────────────────────────────
// Sprint 3 #12: list data-layer useJobList me — type + dual-era reader wahin se
import { useJobList, type Transaction, fetchStatusChangeLogs } from "./useJobList";

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_MAP: Record<number, string> = Object.fromEntries(
  Object.entries(JOB_STATUS).map(([k, v]) => [Number(k), v.label])
);

// fetchStatusChangeLogs useJobList se aata hai (dual-era reader — docs/DATA_MIGRATION_NOTES.md)

const STATUS_BORDER: Record<number, string> = {
  0: "border-l-slate-500",
  1: "border-l-blue-500",
  2: "border-l-teal-500",
  3: "border-l-emerald-500",
  4: "border-l-red-500",
  5: "border-l-purple-500",
};

const getStatusBadge = (s: number) => {
  const st = JOB_STATUS[s] ?? JOB_STATUS[0];
  return `inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.cls}`;
};

// Mini client avatar — jobs list cells/cards ke liye (photo ya initials)
const ClientMiniAvatar = ({ image, name }: { image?: string; name: string }) => {
  const src = safeImageSrc(image);
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={32}
        height={32}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0border border-white/10"
        
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 bg-gradient-to-br from-blue-600 to-blue-800">
      {name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join("")}
    </div>
  );
};

// ─── Sprint 3 #13: skeleton loaders (search/filter refetch — no full reload) ──
const TableSkeletonRows = ({ rows = 8 }: { rows?: number }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i} className="border-b border-app">
        <td colSpan={10} className="px-3 py-3">
          <div className="flex items-center gap-3 animate-pulse">
            <div className="w-4 h-4 rounded bg-panel-2 flex-shrink-0" />
            <div className="h-3 rounded bg-panel-2 flex-shrink-0 w-[7%]" />
            <div className="h-3 rounded bg-panel-2 flex-shrink-0 w-[9%]" />
            <div className="h-3 rounded bg-panel-2 w-[20%]" />
            <div className="h-3 rounded bg-panel-2 flex-shrink-0 w-[10%] hidden sm:block" />
            <div className="h-3 rounded bg-panel-2 flex-shrink-0 w-[8%] hidden md:block" />
            <div className="h-5 rounded-full bg-panel-2 flex-shrink-0 w-[8%] ml-auto" />
          </div>
        </td>
      </tr>
    ))}
  </>
);

const CardsSkeleton = ({ count = 4 }: { count?: number }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-panel rounded-2xl border border-app p-3 animate-pulse">
        <div className="h-4 rounded bg-panel-2 w-2/5" />
        <div className="h-3 rounded bg-panel-2 w-3/5 mt-2" />
        <div className="flex gap-2 mt-3">
          <div className="h-6 rounded-lg bg-panel-2 w-20" />
          <div className="h-6 rounded-lg bg-panel-2 w-20" />
          <div className="h-6 rounded-full bg-panel-2 w-16 ml-auto" />
        </div>
      </div>
    ))}
  </>
);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtDate = (d: string) => formatIST(d, { day: "2-digit", month: "2-digit", year: "numeric" });

const fmtDateTime = (d: string) =>
  formatIST(d, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

const fmtTime = (d: string) => formatIST(d, { hour: "2-digit", minute: "2-digit", hour12: true });

// ─── Main Content Component ───────────────────────────────────────────────────
function JobsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Sprint 3 #12: list data-layer (filters + fetch + pagination) useJobList me.
  // Yahan sirf UI state rehta hai — behavior 1:1 same.
  const {
    transactions,
    setTransactions,
    openPartCounts,
    totalRows,
    stats,
    loading,
    hasLoaded,
    localSearch,
    setLocalSearch,
    debouncedSearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    hideDelivered,
    setHideDelivered,
    statusFilter,
    setStatusFilter,
    spotFilter,
    setSpotFilter,
    jobSpots,
    loadJobSpots,
    pageSize,
    setPageSize,
    pageIndex,
    setPageIndex,
    paginatedTransactions,
    filteredTransactions,
    totalPages,
    fetchStats,
    fetchPage,
  } = useJobList();

  const { viewOnly } = useViewOnly();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [sysInfo, setSysInfo] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("system_info").select("meta_field, meta_value");
      if (data) {
        const info: Record<string, string> = {};
        data.forEach((r) => {
          info[r.meta_field] = r.meta_value;
        });
        setSysInfo(info);
      }
    })();
  }, []);

  // Filters + pagination + list data — useJobList me (upar destructure dekho)
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkMoveId, setBulkMoveId] = useState<number | null>(null);
  const [bulkMoveName, setBulkMoveName] = useState("");
  // Per-job spot edit (row me spot chhota change button) — single job ka spot badlo
  const [spotEditTxn, setSpotEditTxn] = useState<Transaction | null>(null);
  const [spotPickId, setSpotPickId] = useState<number | null>(null);
  const [spotPickName, setSpotPickName] = useState("");
  const [savingSpot, setSavingSpot] = useState(false);
  // Delivered-but-spotted jobs ka one-click cleanup
  const [spotCleaning, setSpotCleaning] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Dropdown
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  // FAB (mobile)
  const [fabOpen, setFabOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  // FAB menu bahar click / Escape par auto-close
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) setFabOpen(false);
    };
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFabOpen(false);
    };
    if (fabOpen) {
      document.addEventListener("mousedown", h);
      document.addEventListener("keydown", k);
    }
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [fabOpen]);

  // ── Mobile view toggle (PHP: transactions_view localStorage) ──
  const [mobileView, setMobileView] = useState<"card" | "table">("card");
  useEffect(() => {
    const saved = localStorage.getItem("transactions_view");
    if (saved === "card" || saved === "table") setMobileView(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("transactions_view", mobileView);
  }, [mobileView]);

  // ── Mechanic names (job id/code ke neeche assigned mechanic dikhane ke liye) ──
  const [mechNames, setMechNames] = useState<Record<number, string>>({});
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("mechanic_list")
        .select("id, firstname, middlename, lastname");
      if (!data) return;
      const m: Record<number, string> = {};
      data.forEach((r) => {
        m[r.id] = [r.firstname, r.middlename, r.lastname].filter(Boolean).join(" ").trim();
      });
      setMechNames(m);
    })();
  }, []);

  // ── Job spots + URL-sync — useJobList me (filter state wahin hai) ──

  // ── Stale alert: Done/Paid items jo 7+ din se spot par pade hain ──
  const [staleOpen, setStaleOpen] = useState(false);
  const [staleSeen, setStaleSeen] = useState(false);
  const [staleItems, setStaleItems] = useState<
    Array<{
      id: number;
      job_id: string;
      item: string;
      uniq_id: string;
      days: number;
    }>
  >([]);
  const loadStale = useCallback(async () => {
    try {
      // NOTE: transaction_list.status_changed_at column DB me exist nahi karta —
      // stale time activity_logs se derive hota hai (dual-era helper, upar).
      // Logs na mile to fallback date_updated (sirf stale-DETECTION ke liye).
      const now = Date.now();
      const cutoffIso = new Date(now - 7 * 86400000).toISOString();

      const { data: cands, error: candErr } = await supabase
        .from("transaction_list")
        .select("id, job_id, item, uniq_id, date_created, date_updated")
        .eq("del_status", 0)
        .in("status", [2, 3])
        .neq("uniq_id", "")
        .lt("date_updated", cutoffIso)
        .order("date_updated", { ascending: true })
        .limit(300);
      if (candErr) throw candErr;
      const list = cands || [];
      if (!list.length) {
        setStaleItems([]);
        return;
      }

      // Har job ki LAST status-change time — dono yug parallel
      const [legacyRows, modernRows] = await Promise.all([
        fetchStatusChangeLogs(
          "legacy",
          list.map((t) => String(t.id))
        ),
        fetchStatusChangeLogs("modern", [
          ...new Set(list.map((t) => String(t.job_id || "")).filter(Boolean)),
        ]),
      ]);
      const logMap = new Map<string, string>();
      for (const log of [...legacyRows, ...modernRows]) {
        const k = String(log.meta_id);
        if (!logMap.has(k)) logMap.set(k, log.date_created);
      }

      setStaleItems(
        list
          .map((t) => {
            const changedAt =
              logMap.get(String(t.id)) ??
              logMap.get(String(t.job_id)) ??
              t.date_updated ??
              t.date_created;
            const ts = new Date(changedAt || "").getTime();
            return {
              id: t.id,
              job_id: t.job_id,
              item: t.item,
              uniq_id: t.uniq_id || "",
              ts,
              days: Math.floor((now - ts) / 86400000),
            };
          })
          .filter((it) => it.ts > 0 && now - it.ts >= 7 * 86400000)
          .sort((a, b) => a.ts - b.ts)
          .slice(0, 50)
          .map((it) => ({
            id: it.id,
            job_id: it.job_id,
            item: it.item,
            uniq_id: it.uniq_id,
            days: it.days,
          }))
      );
    } catch (err) {
      logger.error("loadStale error:", err);
    }
  }, []);
  useEffect(() => {
    loadStale();
  }, [loadStale]);

  // ── NEW: Quick Create Modal ───────────────────────────────
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  // ── NEW: Bulk Status Update ──────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkDeliverDate, setBulkDeliverDate] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");

  // Selected jobs ka current status distribution (bulk bar me dikhata hai)
  const selectedStatusCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    transactions.forEach((t) => {
      if (selectedIds.has(t.id)) counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return counts;
  }, [transactions, selectedIds]);

  // ── Bulk WhatsApp Report (PHP: index.php sendBulkWhatsAppReport) ──
  const [waModal, setWaModal] = useState(false);
  const [waText, setWaText] = useState("");
  const [waEdited, setWaEdited] = useState(false);
  const [waGroups, setWaGroups] = useState<
    Array<{ phone: string; fullname: string; rows: Transaction[] }>
  >([]);
  // Sprint 3 #14: single-send preview (row WA button → preview modal, not direct open)
  const [singleWa, setSingleWa] = useState<{ phone: string; msg: string } | null>(null);

  // Sprint 4 #19: master-detail preview (?preview=<id>, xl slide-over)
  const previewParam = searchParams.get("preview");
  const previewId =
    previewParam && /^\d+$/.test(previewParam) ? Number(previewParam) : null;
  const openPreview = (id: number) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("preview", String(id));
    router.push(`/jobs?${p.toString()}`, { scroll: false });
  };
  const closePreview = () => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("preview");
    const qs = p.toString();
    router.push(`/jobs${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  // ── NEW: Quick Status Change ─────────────────────────────
  const [statusChangeLoading, setStatusChangeLoading] = useState<number | null>(null);

  // Debounced search — useJobList me (fetch wahin hai)

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
      const {
        data: { user },
      } = await getCachedUser();
      if (user) {
        const { data: p } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
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

  // ── Client search + Quick Stats + Page fetch — useJobList me ──

  // (fetchPage + auto-refresh triggers — useJobList me)

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getClientName = (t: Transaction) =>
    [t.client_firstname, t.client_middlename, t.client_lastname].filter(Boolean).join(" ").trim() ||
    "Unknown Client";

  const getClientBalance = (t: Transaction) => {
    const ob = t.client_opening_balance || 0;
    const bil = t.total_billed || 0;
    const sal = t.total_sale || 0;
    const pai = t.total_paid || 0;
    const ln = t.loan_due || 0;
    return ob + bil + sal + ln - pai;
  };

  const BalanceBadge = ({ bal }: { bal: number }) => {
    if (bal > 0)
      return (
        <span className="bg-red-500/15 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
          Due {"\u20B9"}
          {bal.toFixed(0)}
        </span>
      );
    if (bal < 0)
      return (
        <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
          Adv {"\u20B9"}
          {Math.abs(bal).toFixed(0)}
        </span>
      );
    return (
      <span className="bg-slate-700/50 text-muted border border-muted/30 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
        Bal 0
      </span>
    );
  };

  // (pageIndex reset + derived lists + openPartCounts — useJobList me)

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (id: number) => {
      if (!requireAdmin(userRole, "delete")) return;
      if (!confirm("Kya aap pakka is job ko delete karna chahte hain?")) return;
      const { error } = await supabase
        .from("transaction_list")
        .update({ del_status: 1 })
        .eq("id", id);
      if (!error) {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        fetchStats();
      } else toast.error("Delete failed: " + error.message);
    },
    // setTransactions useJobList ke useState se hai (stable identity) — deps me
    // rakhna safe hai, callback recreate nahi hoga.
    [userRole, fetchStats, setTransactions]
  );

  // ── Quick Status Change (Sprint 3 #13: optimistic) ──────────────────────────
  // UI turant update hoti hai; server fail ho to rollback + error toast.
  const quickStatusChange = async (id: number, newStatus: number) => {
    const prevTxn = transactions.find((t) => t.id === id);
    const updates: Record<string, unknown> = {
      status: newStatus,
      date_updated: toISTString(),
    };
    if (newStatus === 5) {
      updates.date_completed = toISTString();
    }
    // Optimistic: pehle local state badlo, phir server confirm karo
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? ({ ...t, ...updates } as Transaction) : t))
    );
    setStatusChangeLoading(id);
    const { error } = await supabase.from("transaction_list").update(updates).eq("id", id);

    if (!error) {
      fetchStats();
    } else {
      // Rollback: purana row wapas lao
      if (prevTxn) {
        setTransactions((prev) => prev.map((t) => (t.id === id ? prevTxn : t)));
      }
      toast.error("Status update failed: " + error.message);
    }
    setStatusChangeLoading(null);
  };

  // ── Bulk Status Update ─────────────────────────────────────────────────────
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedTransactions.map((t) => t.id)));
    }
  };

  const bulkUpdateStatus = async (newStatus: number) => {
    if (selectedIds.size === 0) {
      toast.error("Select jobs first!");
      return;
    }
    if (!confirm(`${selectedIds.size} jobs ka status change karein?`)) return;

    // Deliver par spot khali karna — occupancy sahi rakhne ke liye
    let clearLocation = false;
    if (newStatus === 5) {
      clearLocation = confirm(
        "Items client ko deliver ho rahe hain — unki location (spot) bhi khali kar dein?"
      );
    }

    setBulkActionLoading(true);
    // PHP parity: Delivered → set date_completed (delivery datetime); others → clear it.
    // datetime-local value par +05:30 stamp zaroori hai warna Postgres use UTC maan ke
    // date agle din dikhati hai.
    const updates: Record<string, unknown> = {
      status: newStatus,
      date_updated: toISTString(),
      date_completed: newStatus === 5 ? dtLocalToIST(bulkDeliverDate) || toISTString() : null,
    };
    if (clearLocation) {
      updates.uniq_id = "";
      updates.location_id = null;
    }

    const ids = [...selectedIds];
    const { error } = await supabase.from("transaction_list").update(updates).in("id", ids);

    if (!error) {
      setTransactions((prev) =>
        prev.map((t) => (selectedIds.has(t.id) ? ({ ...t, ...updates } as Transaction) : t))
      );
      setSelectedIds(new Set());
      setBulkDeliverDate("");
      setBulkStatus("");
      const statusName = STATUS_MAP[newStatus] || String(newStatus);
      for (const id of ids) {
        const txn = transactions.find((t) => t.id === id);
        const oldStatus =
          (txn?.status != null ? STATUS_MAP[txn.status] : null) || String(txn?.status ?? "?");
        // Canonical PK hi meta_id — job_id string nahi (docs/DATA_MIGRATION_NOTES.md)
        await logActivity(
          "Updated Job Status",
          "Jobs",
          id,
          `Job #${txn?.job_id || id} | ${oldStatus} → ${statusName} | ${txn?.item || ""}`
        );
      }
      await logActivity(
        "Bulk Status Update",
        "Jobs",
        undefined,
        `${ids.length} job(s) updated to "${statusName}"`
      );
      fetchStats();
      loadJobSpots();
      loadStale();
    } else {
      toast.error("Bulk update failed: " + error.message);
    }
    setBulkActionLoading(false);
  };

  // ── Bulk Move: selected jobs ko dusre spot par le jao ──────────────
  const applyBulkMove = async () => {
    if (bulkMoveId == null) {
      toast.error("Pehle spot chuno!");
      return;
    }
    setBulkActionLoading(true);
    const ids = [...selectedIds];
    const { error } = await supabase
      .from("transaction_list")
      .update({ location_id: bulkMoveId, uniq_id: bulkMoveName, date_updated: toISTString() })
      .in("id", ids);
    if (!error) {
      setTransactions((prev) =>
        prev.map((t) =>
          selectedIds.has(t.id)
            ? ({ ...t, location_id: bulkMoveId, uniq_id: bulkMoveName } as Transaction)
            : t
        )
      );
      for (const id of ids) {
        const txn = transactions.find((t) => t.id === id);
        // Canonical PK hi meta_id — job_id string nahi (docs/DATA_MIGRATION_NOTES.md)
        await logActivity(
          "Moved Job Item",
          "Jobs",
          id,
          `Job #${txn?.job_id || id} → ${bulkMoveName} | ${txn?.item || ""}`
        );
      }
      setSelectedIds(new Set());
      setBulkMoveOpen(false);
      setBulkMoveId(null);
      setBulkMoveName("");
      loadJobSpots();
    } else {
      toast.error("Move failed: " + error.message);
    }
    setBulkActionLoading(false);
  };

  // ── Per-job spot edit (row ka "Change" button) ──
  const openSpotEdit = (t: Transaction) => {
    setSpotEditTxn(t);
    setSpotPickId(t.location_id ?? null);
    setSpotPickName(t.uniq_id || "");
  };

  const handleSpotSave = async () => {
    if (!spotEditTxn) return;
    setSavingSpot(true);
    const t = spotEditTxn;
    const { error } = await supabase
      .from("transaction_list")
      .update({ location_id: spotPickId, uniq_id: spotPickName, date_updated: toISTString() })
      .eq("id", t.id);
    if (!error) {
      setTransactions((prev) =>
        prev.map((x) =>
          x.id === t.id
            ? ({ ...x, location_id: spotPickId, uniq_id: spotPickName } as Transaction)
            : x
        )
      );
      await logActivity(
        "Moved Job Item",
        "Jobs",
        t.id,
        `Job #${t.job_id || t.id} → ${spotPickName || "No Spot"} | ${t.item || ""}`
      );
      setSpotEditTxn(null);
      loadJobSpots();
    } else {
      toast.error("Spot update failed: " + error.message);
    }
    setSavingSpot(false);
  };

  // ── Delivered jobs jinki spot abhi bhi lagi hai — sab ek saath clear ──────
  const clearDeliveredSpots = async () => {
    if (spotCleaning) return;
    setSpotCleaning(true);
    try {
      // Count: location_id set hai YA uniq_id text bacha hai
      const [{ count: cLoc }, { count: cTxt }] = await Promise.all([
        supabase
          .from("transaction_list")
          .select("id", { count: "exact", head: true })
          .eq("del_status", 0)
          .eq("status", 5)
          .not("location_id", "is", null),
        supabase
          .from("transaction_list")
          .select("id", { count: "exact", head: true })
          .eq("del_status", 0)
          .eq("status", 5)
          .neq("uniq_id", ""),
      ]);
      const total = (cLoc || 0) + (cTxt || 0);
      if (total === 0) {
        toast.success("Sab saaf hai! Koi delivered job aisa nahi jiski location abhi bachi ho.");
        return;
      }
      if (!confirm(`${total} delivered job(s) ki location abhi bhi lagi hai — sab clear kar dein?`))
        return;
      // Do pass: (1) location_id wale, (2) sirf purana uniq_id text wale
      const { error: e1 } = await supabase
        .from("transaction_list")
        .update({ uniq_id: "", location_id: null, date_updated: toISTString() })
        .eq("del_status", 0)
        .eq("status", 5)
        .not("location_id", "is", null);
      const { error: e2 } = await supabase
        .from("transaction_list")
        .update({ uniq_id: "", date_updated: toISTString() })
        .eq("del_status", 0)
        .eq("status", 5)
        .neq("uniq_id", "");
      if (e1 || e2) throw new Error((e1 || e2)!.message);
      fetchStats();
      fetchPage();
      loadJobSpots();
      toast.success(`${total} job(s) ki location clear ho gayi — spots ab bilkul saaf hain.`);
    } catch (err) {
      toast.error("Spot cleanup failed: " + (err as Error).message);
    } finally {
      setSpotCleaning(false);
    }
  };

  // ── Bulk WhatsApp Report (PHP parity) ──────────────────────────────
  const buildBulkWAMessage = (rows: Transaction[], fullname: string) => {
    const fv = firmVars(sysInfo);
    const businessName = `${fv.firm_owner}, ${fv.firm_name}, ${fv.firm_address}, Mob. ${fv.firm_phone}`;
    const statText = ["Pending", "On-Progress", "Done", "Paid", "Cancelled", "Delivered"];
    let msg =
      `Namaste ${fullname} ji 🙏!\n\n` +
      `Aapke repair jobs ki current status update neeche di gayi hai:\n\n` +
      `----------------------------\n`;
    let totalSum = 0;
    rows.forEach((row, i) => {
      const st = statText[row.status] || "Pending";
      const amt = row.amount || 0;
      totalSum += amt;
      msg +=
        `${i + 1}. *${row.item}*\n` +
        `   Job ID: #${row.job_id}\n` +
        `   Code: #${row.code || ""}\n` +
        `   Status: *${st}*\n`;
      if (row.status === 2 || row.status === 3 || row.status === 5) {
        msg += `   Amount: \u20B9${amt.toLocaleString("en-IN")}\n`;
      }
      msg += `\n`;
    });
    msg +=
      `----------------------------\n` +
      `*Grand Total: \u20B9${totalSum.toLocaleString("en-IN")}*\n\n` +
      `Kripya kisi bhi jankari ke liye workshop par sampark karein. 🙏\n\n` +
      `${businessName}`;
    return msg;
  };

  const openBulkWhatsApp = () => {
    if (selectedIds.size === 0) {
      toast.error("Select jobs first!");
      return;
    }
    const selected = transactions.filter((t) => selectedIds.has(t.id));
    const groups: Array<{ phone: string; fullname: string; rows: Transaction[] }> = [];
    const groupMap = new Map<string, { phone: string; fullname: string; rows: Transaction[] }>();
    selected.forEach((row) => {
      const phone = (row.client_contact || "").replace(/\D/g, "");
      if (phone.length < 10) return;
      let g = groupMap.get(phone);
      if (!g) {
        g = { phone, fullname: getClientName(row), rows: [] };
        groupMap.set(phone, g);
        groups.push(g);
      }
      g.rows.push(row);
    });
    if (groups.length === 0) {
      toast.error("Selected jobs me koi valid mobile number nahi mila");
      return;
    }
    setWaGroups(groups);
    setWaEdited(false);
    setWaText(buildBulkWAMessage(groups[0].rows, groups[0].fullname));
    setWaModal(true);
  };

  const sendBulkWA = () => {
    if (waGroups.length === 0) return;
    const msg = waText;
    if (waGroups.length > 1 && !waEdited) {
      // Har client ko uski apni jobs ke saath alag message
      waGroups.forEach((g) => {
        window.open(
          `https://wa.me/91${g.phone}?text=${encodeURIComponent(buildBulkWAMessage(g.rows, g.fullname))}`,
          "_blank"
        );
      });
    } else {
      // Single client ya user-ne-edit-kia → same text sabko
      waGroups.forEach((g) => {
        window.open(`https://wa.me/91${g.phone}?text=${encodeURIComponent(msg)}`, "_blank");
      });
    }
    setWaModal(false);
  };

  const openCombinedInvoice = (billType: "gst" | "non_gst") => {
    if (selectedIds.size === 0) {
      toast.error("Select jobs first!");
      return;
    }
    const ids = [...selectedIds].join(",");
    window.open(`/api/print-combined-invoice?ids=${ids}&bill_type=${billType}`, "_blank");
  };

  // ── Quick Create Job ───────────────────────────────────────────────────────
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);
  // Re-entrancy guard — double click / Enter double submit / slow network par
  // do calls chalti hain to in-flight me ek hi baar data insert hoga.
  const quickCreateRef = useRef(false);
  const [quickForm, setQuickForm] = useState({
    clientName: "",
    contact: "",
    item: "",
    fault: "",
    mechanicId: "",
  });
  const [quickClients, setQuickClients] = useState<
    Array<{
      id: number;
      firstname: string;
      middlename?: string;
      lastname: string;
      contact: string;
    }>
  >([]);
  const [quickClientSearch, setQuickClientSearch] = useState("");
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickClientId, setQuickClientId] = useState<number | null>(null);
  const [quickMechanics, setQuickMechanics] = useState<
    Array<{
      id: number;
      firstname: string;
      middlename?: string;
      lastname: string;
    }>
  >([]);

  useEffect(() => {
    const loadClientsAndMechanics = async () => {
      const [clientsRes, mechanicsRes] = await Promise.all([
        supabase
          .from("client_list")
          .select("id, firstname, middlename, lastname, contact")
          .eq("delete_flag", 0)
          .order("firstname"),
        supabase
          .from("mechanic_list")
          .select("id, firstname, middlename, lastname")
          .eq("delete_flag", 0)
          .eq("status", 1)
          .order("firstname"),
      ]);
      if (clientsRes.data) setQuickClients(clientsRes.data);
      if (mechanicsRes.data) setQuickMechanics(mechanicsRes.data);
    };
    if (showQuickCreate) loadClientsAndMechanics();
  }, [showQuickCreate]);

  const filteredQuickClients = quickClients.filter((c) => {
    const name = `${c.firstname} ${c.middlename || ""} ${c.lastname}`.toLowerCase();
    return name.includes(quickClientSearch.toLowerCase()) || c.contact.includes(quickClientSearch);
  });

  const handleQuickCreate = async () => {
    if (quickCreateRef.current) return;
    if (!quickForm.item.trim()) {
      toast.error("Item/Model zaroori hai!");
      return;
    }
    if (!quickForm.fault.trim()) {
      toast.error("Fault description zaroori hai!");
      return;
    }
    if (!quickForm.mechanicId) {
      toast.error("Mechanic select karo!");
      return;
    }

    quickCreateRef.current = true;
    setQuickCreateLoading(true);
    try {
      // Generate job code
      const todayStr = todayIST();
      const datePrefix = todayStr.replace(/-/g, "");
      const { count: todayCount } = await supabase
        .from("transaction_list")
        .select("id", { count: "exact", head: true })
        .gte("date_created", todayStr + "T00:00:00+05:30");
      const dailySeq = String((todayCount || 0) + 1).padStart(2, "0");

      const nextJobId = await getNextJobId();

      const { data, error } = await supabase
        .from("transaction_list")
        .insert({
          user_id: 1,
          client_name: quickClientId ? String(quickClientId) : null,
          mechanic_id: parseInt(quickForm.mechanicId),
          code: `${datePrefix}${dailySeq}`,
          job_id: String(nextJobId),
          item: quickForm.item.trim(),
          fault: quickForm.fault.trim(),
          remark: "",
          uniq_id: "",
          amount: 0,
          status: 0,
          del_status: 0,
          date_created: toISTString(),
          date_updated: toISTString(),
        })
        .select("id")
        .single();

      if (error) throw error;

      // Update counter
      await bumpJobCounter(nextJobId);

      setShowQuickCreate(false);
      setQuickForm({ clientName: "", contact: "", item: "", fault: "", mechanicId: "" });
      setQuickClientId(null);
      fetchStats();
      fetchPage();
      router.push(`/jobs/${data.id}/edit`);
    } catch (e) {
      toast.error("Error: " + (e instanceof Error && e.message ? e.message : "Unknown error"));
    } finally {
      quickCreateRef.current = false;
      setQuickCreateLoading(false);
    }
  };

  const sendWA = (txn: Transaction) => {
    const phone = txn.client_contact?.replace(/\D/g, "");
    if (!phone || phone.length < 10) {
      toast.error("Valid mobile number nahi mila!");
      return;
    }
    const name = getClientName(txn);
    const key = STATUS_WA_KEY[txn.status] || "whatsapp_status_pending";
    const tpl = resolveTemplate(sysInfo, key);
    const msg = substituteTemplate(tpl, {
      client_name: name,
      item: txn.item || "",
      job_id: txn.job_id,
      code: txn.code || "",
      amount: "₹" + (txn.amount || 0).toLocaleString("en-IN"),
      ...firmVars(sysInfo),
    });
    // Sprint 3 #14: preview modal se guzro — direct open nahi
    setSingleWa({ phone, msg });
  };

  const printReport = () => {
    const p = new URLSearchParams();
    if (dateFrom) p.append("date_from", dateFrom);
    if (dateTo) p.append("date_to", dateTo);
    window.open(`/api/print-transactions?${p}`, "_blank");
  };

  const exportExcel = async () => {
    const p = new URLSearchParams();
    if (dateFrom) p.append("date_from", dateFrom);
    if (dateTo) p.append("date_to", dateTo);
    // Download trigger (file response), page navigation nahi — isliye fetch+blob
    const res = await fetch(`/api/export-transactions?${p}`);
    if (res.ok) {
      const blob = await res.blob();
      downloadBlob(blob, `transactions_${todayIST()}.xls`);
    } else {
      toast.error("Export fail hua. Dobara try karein.");
    }
  };

  // BUG FIX 4: shiftDay preserves all existing URL params
  const shiftDay = (dir: number) => {
    const base = dateFrom ? parseISTDate(dateFrom) : parseISTDate(todayIST());
    base.setDate(base.getDate() + dir);
    // Use manual formatting instead of toISOString() to avoid UTC conversion issues
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, "0");
    const d = String(base.getDate()).padStart(2, "0");
    const nd = `${y}-${m}-${d}`;
    setDateFrom(nd);
    setDateTo(nd);
    const p = new URLSearchParams(searchParams.toString());
    p.set("date_from", nd);
    p.set("date_to", nd);
    router.push(`?${p}`);
  };

  const applyDesktopFilter = () => {
    const p = new URLSearchParams();
    if (dateFrom) p.set("date_from", dateFrom);
    if (dateTo) p.set("date_to", dateTo);
    if (hideDelivered) p.set("hide_delivered", "1");
    router.push(`?${p}`);
  };

  const applyMobileFilter = () => {
    const p = new URLSearchParams();
    if (dateFrom) p.set("date_from", dateFrom);
    if (dateTo) p.set("date_to", dateTo);
    if (hideDelivered) p.set("hide_delivered", "1");
    router.push(`?${p}`);
    setShowFilterModal(false);
  };

  const resetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setHideDelivered(false);
    setStatusFilter("");
    setLocalSearch("");
    setSpotFilter("");
    try {
      localStorage.removeItem("jobs_hide_delivered");
    } catch {}
    router.push("/jobs");
    setShowFilterModal(false);
  };

  // ── Bulk Action Bar + WhatsApp Modal (shared desktop + mobile) ────────────
  const bulkActionBar = selectedIds.size > 0 && (
    <div
      className="fixed bottom-5 left-1/2 z-[60] rounded-2xl px-3 py-2.5 flex flex-col md:flex-row flex-wrap items-center justify-center gap-2 md:gap-3 w-[calc(100%-2rem)] md:min-w-[300px] md:max-w-[95vw] bg-white dark:bg-panel border border-app-2 dark:border-app shadow-2xl text-app dark:text-white"
      style={{
        transform: "translateX(-50%)",
        animation: "bulkBarPop 0.35s cubic-bezier(0.34,1.56,0.64,1)",
      }}
    >
      {/* Row 1: info + status + datetime */}
      <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
        <span className="bg-indigo-600 !text-white rounded-full px-2.5 py-0.5 font-bold text-xs whitespace-nowrap shadow-sm">
          {selectedIds.size} selected
        </span>

        {/* Current status of selected jobs */}
        {Object.entries(selectedStatusCounts).map(([s, n]) => (
          <span
            key={s}
            className={`${getStatusBadge(Number(s))} whitespace-nowrap`}
            title="Current status"
          >
            {STATUS_MAP[Number(s)]}
            {n > 1 ? ` ×${n}` : ""}
          </span>
        ))}

        <select
          value={bulkStatus}
          onChange={(e) => {
            const v = e.target.value;
            setBulkStatus(v);
            if (v === "5" && !bulkDeliverDate) {
              // IST clock se prefill (browser-local nahi) — "YYYY-MM-DDTHH:mm"
              setBulkDeliverDate(toISTString().slice(0, 16));
            }
          }}
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none cursor-pointer flex-1 md:flex-none md:min-w-[130px] bg-app border border-app text-app-2 focus:border-blue-500 transition-all [color-scheme:dark]"
        >
          <option value="" disabled>
            -- New Status --
          </option>
          <option value="0">Pending</option>
          <option value="1">On-Progress</option>
          <option value="2">Done</option>
          <option value="3">Paid</option>
          <option value="4">Cancelled</option>
          <option value="5">Delivered</option>
        </select>
        {bulkStatus === "5" && (
          <input
            type="datetime-local"
            value={bulkDeliverDate}
            onChange={(e) => setBulkDeliverDate(e.target.value)}
            title="Delivery Date & Time"
            className="rounded-lg px-2.5 py-1.5 text-xs outline-none cursor-pointer flex-1 md:flex-none bg-app border border-app text-app-2 focus:border-blue-500 transition-all [color-scheme:dark]"
          />
        )}
      </div>

      {/* Row 2: actions */}
      <div className="flex items-center flex-wrap gap-1.5 md:gap-3">
        <button
          onClick={() => {
            if (!bulkStatus) {
              toast.error("Please select a status first");
              return;
            }
            bulkUpdateStatus(Number(bulkStatus));
          }}
          disabled={bulkActionLoading || viewOnly}
          className={`!text-white border-none rounded-lg px-3 md:px-5 py-1.5 md:py-2 font-bold text-xs md:text-sm cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center gap-1 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 shadow-sm ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={viewOnly ? "Bulk status change sirf office ke andar se possible hai." : undefined}
        >
          <CheckCircle2 size={13} className="!text-white" />{" "}
          {bulkActionLoading ? "Applying..." : "Apply"}
        </button>

        <button
          onClick={() => {
            setBulkMoveId(null);
            setBulkMoveName("");
            setBulkMoveOpen(true);
          }}
          disabled={bulkActionLoading || viewOnly}
          title={viewOnly ? "Bulk move sirf office ke andar se possible hai." : "Selected jobs ko dusre spot par le jao"}
          className={`!text-white border-none rounded-lg px-3 md:px-4 py-1.5 md:py-2 font-bold text-xs md:text-sm cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center gap-1 whitespace-nowrap bg-amber-600 hover:bg-amber-700 shadow-sm ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <MapPin size={13} className="!text-white" /> Move
        </button>

        <button
          onClick={openBulkWhatsApp}
          disabled={viewOnly}
          className={`!text-white border-none rounded-lg px-3 md:px-4 py-1.5 md:py-2 font-bold text-xs md:text-sm cursor-pointer transition-opacity hover:opacity-90 flex items-center gap-1 whitespace-nowrap bg-[#25d366] hover:bg-[#20ba5a] shadow-sm ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={viewOnly ? "Bulk WA report sirf office ke andar se possible hai." : undefined}
        >
          <MessageCircle size={13} className="!text-white" /> WA Report
        </button>

        <button
          onClick={() => openCombinedInvoice("non_gst")}
          disabled={viewOnly}
          className={`!text-white border-none rounded-lg px-3 md:px-4 py-1.5 md:py-2 font-bold text-xs md:text-sm cursor-pointer transition-opacity hover:opacity-90 flex items-center gap-1 whitespace-nowrap bg-slate-600 hover:bg-slate-700 shadow-sm ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={viewOnly ? "Bulk estimate sirf office ke andar se possible hai." : undefined}
        >
          <FileText size={13} className="!text-white" /> Estimate
        </button>

        <button
          onClick={() => {
            setSelectedIds(new Set());
            setBulkStatus("");
            setBulkDeliverDate("");
          }}
          className="bg-panel-2 hover:bg-panel-2 dark:bg-white/15 dark:hover:bg-white/25 text-app dark:text-white border border-app-2 dark:border-white/30 rounded-lg px-2.5 md:px-3.5 py-1.5 md:py-2 text-xs md:text-sm cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap"
        >
          <X size={13} /> Clear
        </button>
      </div>
    </div>
  );

  // ── Bulk Move Modal (shared desktop + mobile) ────────────────────────────
  const bulkMoveModal = bulkMoveOpen && (
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !bulkActionLoading && setBulkMoveOpen(false)}
    >
      <div
        className="w-full max-w-xs bg-panel border border-app rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="font-black text-white text-sm flex items-center gap-1.5">
            <MapPin size={14} className="text-amber-400" /> Move {selectedIds.size} Job(s)
          </p>
          <button
            onClick={() => setBulkMoveOpen(false)}
            className="text-muted hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-[10px] text-muted-2 font-bold uppercase tracking-wider mb-3">
          Naya Spot chuno
        </p>
        <JobSpotPicker
          value={bulkMoveId}
          onSelect={(id, spot) => {
            setBulkMoveId(id);
            setBulkMoveName(spot?.name || "");
          }}
        />
        <button
          onClick={applyBulkMove}
          disabled={bulkMoveId == null || bulkActionLoading}
          className="mt-4 w-full bg-amber-600 hover:bg-amber-700 !text-white font-bold text-xs py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {bulkActionLoading ? "Moving…" : `${selectedIds.size} Job(s) Move karo`}
        </button>
      </div>
    </div>
  );

  // ── Per-job Spot Edit Modal (row ka chhota "Change" button) ──
  const spotEditModal = spotEditTxn && (
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !savingSpot && setSpotEditTxn(null)}
    >
      <div
        className="w-full max-w-xs bg-panel border border-app rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="font-black text-white text-sm flex items-center gap-1.5">
            <MapPin size={14} className="text-amber-400" /> Spot — Job #{spotEditTxn.job_id}
          </p>
          <button
            onClick={() => !savingSpot && setSpotEditTxn(null)}
            className="text-muted hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-[10px] text-muted-2 font-bold uppercase tracking-wider mb-3">
          Is job ka spot chuno (ya hatao)
        </p>
        <JobSpotPicker
          value={spotPickId}
          onSelect={(id, spot) => {
            setSpotPickId(id);
            setSpotPickName(spot?.name || "");
          }}
        />
        <button
            onClick={handleSpotSave}
            disabled={savingSpot || viewOnly}
            className={`mt-4 w-full bg-amber-600 hover:bg-amber-700 !text-white font-bold text-xs py-2.5 rounded-lg transition-colors disabled:opacity-50 ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={viewOnly ? "Spot change sirf office ke andar se possible hai." : undefined}
          >
            {savingSpot ? "Saving…" : "Spot Save karo"}
          </button>
      </div>
    </div>
  );

  // ── Stale Banner + Modal — Done/Paid items jo 7+ din se spot par hain ─────
  const dismissStale = () => {
    setStaleOpen(false);
    setStaleSeen(true);
  };
  const staleBanner = staleItems.length > 0 && !staleOpen && !staleSeen && (
    <button
      onClick={() => setStaleOpen(true)}
      className="w-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-amber-400 transition-colors cursor-pointer"
    >
      <AlertCircle size={14} />
      {staleItems.length} repaired item{staleItems.length === 1 ? "" : "s"} 7+ din se spot par pade
      hain — dekho
    </button>
  );
  const staleModal = staleOpen && (
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={dismissStale}
    >
      <div
        className="w-full max-w-md bg-panel border border-app rounded-2xl overflow-hidden shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-app bg-amber-500/10">
          <p className="font-black text-amber-400 text-sm flex items-center gap-1.5">
            <AlertCircle size={15} /> {staleItems.length} item(s) spot par atke hain (7+ din)
          </p>
          <button onClick={dismissStale} className="text-muted hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto divide-y divide-[#21293d]">
          {staleItems.map((t) => (
            <Link
              key={t.id}
              href={`/jobs/${t.id}/view`}
              className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/[0.04] no-underline transition-colors"
            >
              <span className="font-black text-blue-400 text-xs">#{t.job_id}</span>
              <span className="text-app-2 text-xs truncate flex-1">{t.item}</span>
              <span className="text-[10px] text-amber-400/90 font-medium flex-shrink-0 flex items-center gap-0.5">
                <MapPin size={9} /> {t.uniq_id}
              </span>
              <span className="text-[10px] text-red-400 font-bold flex-shrink-0">{t.days}d</span>
            </Link>
          ))}
          {staleItems.length === 0 && (
            <p className="text-center text-muted-2 text-xs py-8">Sab clear hai!</p>
          )}
        </div>
        <div className="px-5 py-3 border-t border-app">
          <p className="text-[10px] text-muted-2">
            Tip: deliver hone par location khali karo, ya abhi Move karke ready-shelf par rakho.
          </p>
        </div>
      </div>
    </div>
  );

  // Sprint 3 #14: shared preview modal (bubble preview + editor + Copy/Send)
  const bulkWaModal = waModal && (
    <WaPreviewModal
      title="Send WhatsApp Message"
      note={
        waGroups.length > 1
          ? `Ye message ${waGroups.length} clients ko send hoga — har client ko uski apni jobs ke saath. Message edit karne par same text sabko jayega.`
          : undefined
      }
      message={waText}
      onMessageChange={(v) => {
        setWaText(v);
        setWaEdited(true);
      }}
      onSend={() => sendBulkWA()}
      onClose={() => setWaModal(false)}
    />
  );

  const singleWaModal = singleWa && (
    <WaPreviewModal
      title="Send WhatsApp Message"
      message={singleWa.msg}
      onMessageChange={(v) => setSingleWa({ ...singleWa, msg: v })}
      onSend={(finalText) => {
        window.open(
          `https://wa.me/91${singleWa.phone}?text=${encodeURIComponent(finalText)}`,
          "_blank"
        );
        setSingleWa(null);
      }}
      onClose={() => setSingleWa(null)}
    />
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  // Full-screen spinner ONLY on the very first load. Later refetches (search/
  // filter changes) keep the page mounted and show a subtle inline indicator
  // instead — otherwise every keystroke unmounts to a full-screen spinner and
  // looks like a page reload.
  if (loading && !hasLoaded) {
    return <PageLoader icon={Briefcase} label="v-tech: loading..." tone="blue" />;
  }

  // ══════════════════════════════════════════════════════════════════
  // -- Shared pagination (table + mobile card view dono me same pager) --
  const paginationBar = (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-panel-2 px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Show</span>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPageIndex(0);
          }}
          className="bg-app border border-app text-app-2 rounded-lg px-2 py-1 text-xs outline-none"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span>
          Page {pageIndex + 1} of {totalPages || 1} • {totalRows} Total Jobs
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setPageIndex((p) => Math.max(p - 1, 0))}
          disabled={pageIndex === 0}
          className="px-3 py-1.5 bg-panel-2 border border-app text-muted rounded-lg disabled:opacity-30 hover:bg-[#2a3550] transition-all"
        >
          ← Prev
        </button>
        <span className="text-muted px-2">
          Page {pageIndex + 1} / {totalPages || 1}
        </span>
        <button
          onClick={() => setPageIndex((p) => Math.min(p + 1, totalPages - 1))}
          disabled={pageIndex >= totalPages - 1}
          className="px-3 py-1.5 bg-panel-2 border border-app text-muted rounded-lg disabled:opacity-30 hover:bg-[#2a3550] transition-all"
        >
          Next →
        </button>
      </div>
    </div>
  );

  // -- Shared Table (desktop + mobile card/table toggle) ------------
  const tableSection = (
    <div className="bg-panel border border-app rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed min-w-[1000px]">
          <colgroup>
            <col className="w-[3%]" />
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
            <tr className="bg-panel-2 border-b border-app">
              <th className="px-3 py-3 text-center">
                <button
                  onClick={toggleSelectAll}
                  title="Select All / Clear"
                  className="text-muted hover:text-blue-400 transition-colors"
                >
                  {selectedIds.size === paginatedTransactions.length &&
                  paginatedTransactions.length > 0 ? (
                    <CheckSquare size={14} />
                  ) : (
                    <Square size={14} />
                  )}
                </button>
              </th>
              {[
                "#",
                "Date/Time",
                "Job/Code",
                "Client",
                "Item",
                "Fault",
                "Loc",
                "Amount",
                "Status",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-muted-2"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21293d]">
            {/* Sprint 3 #13: refetch par stale rows ki jagah skeleton */}
            {!(loading && hasLoaded) &&
              paginatedTransactions.map((txn, idx) => {
              const clientName = getClientName(txn);
              const balance = getClientBalance(txn);
              const phone = txn.client_contact?.replace(/\D/g, "") || "";

              return (
                <tr
                  key={txn.id}
                  className={`hover:bg-white/[0.02] transition-colors ${selectedIds.has(txn.id) ? "bg-blue-500/[0.06]" : ""}`}
                >
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => toggleSelect(txn.id)}
                      title="Select / Deselect"
                      className="text-muted hover:text-blue-400 transition-colors"
                    >
                      {selectedIds.has(txn.id) ? <CheckSquare size={13} /> : <Square size={13} />}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-muted-2 text-xs">
                    {pageIndex * pageSize + idx + 1}
                  </td>

                  {/* Date + Time (PHP feature) */}
                  <td className="px-3 py-2.5">
                    <div className="text-xs text-app-2 font-medium">
                      {fmtDate(txn.date_created)}
                    </div>
                    <div className="text-[10px] text-muted-2 mt-0.5">
                      {fmtTime(txn.date_created)}
                    </div>
                  </td>

                  <td className="px-3 py-2.5">
                    <Link
                      href={`/jobs/${txn.id}/view`}
                      className="font-bold text-blue-400 hover:text-blue-300 text-xs transition-colors no-underline"
                    >
                      #{txn.job_id}
                    </Link>
                    {txn.status <= 3 && (openPartCounts.get(txn.id) || 0) > 0 && (
                      <WaitingPartsBadge count={openPartCounts.get(txn.id)!} />
                    )}
                    {txn.code && (
                      <Link
                        href={`/jobs/${txn.id}/view`}
                        className="block text-muted-2 hover:text-muted text-[10px] truncate transition-colors no-underline mt-0.5"
                      >
                        {txn.code}
                      </Link>
                    )}
                    {txn.mechanic_id != null && mechNames[txn.mechanic_id] && (
                      <div
                        className="text-[9px] font-medium text-muted truncate max-w-[110px] mt-0.5"
                        title={`Mechanic: ${mechNames[txn.mechanic_id]}`}
                      >
                        {mechNames[txn.mechanic_id]}
                      </div>
                    )}
                  </td>

                  {/* Client with avatar + phone number text (PHP feature) */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <ClientMiniAvatar image={txn.client_image} name={clientName} />
                      <div className="min-w-0">
                        <Link
                          href={`/clients/${txn.client_name}/view`}
                          className="font-bold text-app-2 text-xs hover:text-blue-400 truncate block max-w-[150px] transition-colors"
                          title={clientName}
                        >
                          {clientName}
                        </Link>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <BalanceBadge bal={balance} />
                          {phone && (
                            <a
                              href={`tel:${txn.client_contact}`}
                              className="flex items-center gap-0.5 text-blue-400 hover:text-blue-300 text-[10px]"
                              title="Call client"
                            >
                              <Phone size={10} />
                              <span className="hidden xl:inline">{txn.client_contact}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-2.5 text-xs text-app-2 truncate" title={txn.item}>
                    {txn.item}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-red-400 truncate" title={txn.fault}>
                    {txn.fault}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      {txn.uniq_id ? (
                        <Link
                          href={`/jobs?search=${encodeURIComponent(txn.uniq_id)}`}
                          title={`Spot: ${txn.uniq_id} \u2014 is spot ke sab items`}
                          className="flex items-center gap-1 text-amber-400/90 hover:text-amber-300 no-underline transition-colors"
                        >
                          <MapPin size={10} className="flex-shrink-0" />
                          <span className="truncate max-w-[120px]">{txn.uniq_id}</span>
                        </Link>
                      ) : (
                        <span className="text-muted-2">{"\u2014"}</span>
                      )}
                      <button
                        onClick={() => openSpotEdit(txn)}
                        title={viewOnly ? "Spot edit sirf office ke andar se possible hai." : "Spot set karo / badlo"}
                        disabled={viewOnly}
                        className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-md border border-app-2 bg-white/[0.02] text-muted hover:text-amber-400 hover:border-amber-500/40 transition-all ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <PenSquare size={11} />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-sm text-app-2">
                    {"\u20B9"}
                    {(txn.amount || 0).toFixed(0)}
                  </td>

                  <td className="px-3 py-2.5 text-center">
                    <span className={getStatusBadge(txn.status)}>{STATUS_MAP[txn.status]}</span>
                    {txn.status_changed_at && (
                      <div className="text-[9px] text-muted-2 mt-0.5">
                        {fmtDate(txn.status_changed_at)} {fmtTime(txn.status_changed_at)}
                      </div>
                    )}
                  </td>

                  {/* Dropdown Actions */}
                  <td className="px-3 py-2.5 relative">
                    <button
                      data-dropdown-trigger
                      onClick={() => setOpenDropdownId(openDropdownId === txn.id ? null : txn.id)}
                      className="bg-panel-2 hover:bg-[#2a3550] border border-app-2 text-muted hover:text-app-2 rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1 mx-auto transition-all"
                    >
                      Action <ChevronDown size={12} />
                    </button>
                    {openDropdownId === txn.id && (
                      <div
                        data-dropdown-menu
                        className="absolute right-0 mt-1 w-44 bg-panel border border-app rounded-xl shadow-2xl z-20 py-1 overflow-hidden"
                      >
                        {/* Sprint 4 #19: xl slide-over preview (mobile par panel nahi) */}
                        <button
                          onClick={() => {
                            openPreview(txn.id);
                            setOpenDropdownId(null);
                          }}
                          className="hidden xl:flex w-full items-center gap-2.5 px-4 py-2 hover:bg-white/[0.04] text-sm text-muted hover:text-purple-400 transition-colors"
                        >
                          <ScanEye size={13} className="text-purple-400" /> Preview
                        </button>
                        {[
                          {
                            href: `/jobs/${txn.id}/view`,
                            icon: Eye,
                            label: "View",
                            cls: "text-blue-400",
                          },
                          {
                            href: `/jobs/${txn.id}/edit`,
                            icon: Settings,
                            label: "Edit",
                            cls: "text-indigo-400",
                          },
                          {
                            href: `/jobs/${txn.id}/old`,
                            icon: History,
                            label: "Old Edit",
                            cls: "text-cyan-400",
                          },
                        ].map(({ href, icon: Icon, label, cls }) => (
                          <Link
                            key={label}
                            href={href}
                            className="flex items-center gap-2.5 px-4 py-2 hover:bg-white/[0.04] text-sm text-muted hover:text-app-2 transition-colors"
                            onClick={() => setOpenDropdownId(null)}
                          >
                            <Icon size={13} className={cls} /> {label}
                          </Link>
                        ))}
                        <button
                          onClick={() => {
                            sendWA(txn);
                            setOpenDropdownId(null);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-white/[0.04] text-sm text-muted hover:text-emerald-400 transition-colors"
                        >
                          <Phone size={13} className="text-emerald-400" /> WhatsApp
                        </button>
                        <a
                          href={`/api/print-bill?job_id=${txn.job_id}`}
                          target="_blank"
                          className="flex items-center gap-2.5 px-4 py-2 hover:bg-white/[0.04] text-sm text-muted hover:text-orange-400 transition-colors"
                          onClick={() => setOpenDropdownId(null)}
                        >
                          <Printer size={13} className="text-orange-400" /> Print Bill
                        </a>
                        <a
                          href={`/api/print-bill?job_id=${txn.job_id}&type=thermal`}
                          target="_blank"
                          className="flex items-center gap-2.5 px-4 py-2 hover:bg-white/[0.04] text-sm text-muted hover:text-yellow-400 transition-colors"
                          onClick={() => setOpenDropdownId(null)}
                        >
                          <Printer size={13} className="text-yellow-400" /> Thermal Receipt
                        </a>
                        {userRole === "admin" && (
                          <>
                            <hr className="my-1 border-app" />
                            <button
                              onClick={() => {
                                handleDelete(txn.id);
                                setOpenDropdownId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-red-500/10 text-sm text-red-500 transition-colors"
                            >
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
            {loading && hasLoaded && <TableSkeletonRows rows={8} />}
            {!loading && filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-16 text-muted-2">
                  <AlertCircle className="mx-auto mb-2 text-app" size={32} />
                  <p className="text-sm font-bold">No transactions found</p>
                  <p className="text-xs mt-1">Try adjusting filters</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination (shared) ── */}
      <div className="border-t border-app">{paginationBar}</div>
    </div>
  );
  // DESKTOP VIEW
  // ══════════════════════════════════════════════════════════════════
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-app p-4 font-sans">
        <div className="max-w-[1600px] mx-auto space-y-4">
          {/* ── Header ── */}
          <div className="bg-panel border border-app rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-lg shadow-blue-500/20">
                <Wrench className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-base font-bold text-white">Transaction History</h1>
                <p className="text-xs text-muted">
                  {userRole === "admin" ? "👑 Admin" : "👤 Staff"} • {totalRows} records
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href="/jobs/new"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Plus size={14} /> New
              </Link>
              <Link
                href="/jobs/old"
                className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <History size={14} /> Old
              </Link>
              <Link
                href="/jobs/bulk"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Layers size={14} /> Bulk
              </Link>
              <Link
                href="/jobs/bulk-edit"
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <PenSquare size={14} /> Bulk Edit
              </Link>
            </div>
          </div>

          {/* ── Quick Stats Bar (PHP feature) ── */}
          <div className={`grid gap-3 ${userRole === "admin" ? "grid-cols-5" : "grid-cols-4"}`}>
            {[
              {
                label: "Total Jobs",
                value: stats.total,
                icon: TrendingUp,
                color: "text-blue-400",
                bg: "bg-blue-500/10 border-blue-500/20",
              },
              {
                label: "Pending",
                value: stats.pending,
                icon: Clock,
                color: "text-amber-400",
                bg: "bg-amber-500/10 border-amber-500/20",
              },
              {
                label: "In Progress",
                value: stats.progress,
                icon: Wrench,
                color: "text-blue-300",
                bg: "bg-blue-500/10 border-blue-400/20",
              },
              {
                label: "Completed",
                value: stats.completed,
                icon: CheckCircle2,
                color: "text-emerald-400",
                bg: "bg-emerald-500/10 border-emerald-500/20",
              },
              ...(userRole === "admin"
                ? [
                    {
                      label: "Total Amount",
                      value: `\u20B9${stats.totalAmt.toLocaleString("en-IN")}`,
                      icon: IndianRupee,
                      color: "text-purple-400",
                      bg: "bg-purple-500/10 border-purple-500/20",
                    },
                  ]
                : []),
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                className={`${bg} border rounded-xl px-4 py-3 flex items-center gap-3`}
              >
                <Icon size={18} className={color} />
                <div>
                  <div className={`text-lg font-black ${color}`}>{value}</div>
                  <div className="text-[10px] text-muted-2 font-bold uppercase tracking-wider">
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stale alert — 7+ din se spot par pade Done/Paid items */}
          {staleBanner}

          {/* ── Filter Bar ── */}
          <div className="bg-panel border border-app rounded-xl p-4">
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <div>
                <label className="block text-[10px] font-bold text-muted-2 uppercase mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-app border border-app text-white rounded-lg px-2.5 py-1.5 text-xs focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-2 uppercase mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-app border border-app text-white rounded-lg px-2.5 py-1.5 text-xs focus:border-blue-500 outline-none transition-all"
                />
              </div>
              {/* BUG FIX 7: Status filter in desktop bar (was missing) */}
              <div>
                <label className="block text-[10px] font-bold text-muted-2 uppercase mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value ? parseInt(e.target.value) : "")}
                  className="bg-app border border-app text-app-2 rounded-lg px-2.5 py-1.5 text-xs focus:border-blue-500 outline-none transition-all"
                >
                  <option value="">All Status</option>
                  {Object.entries(STATUS_MAP).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              {/* Spot filter — "kahan rakha hai?" (khali spots pehle, count ke saath) */}
              <div>
                <label className="block text-[10px] font-bold text-muted-2 uppercase mb-1">
                  Spot
                </label>
                <select
                  value={spotFilter}
                  onChange={(e) => setSpotFilter(e.target.value)}
                  title="Job items ki physical location"
                  className="bg-app border border-app text-app-2 rounded-lg px-2.5 py-1.5 text-xs focus:border-blue-500 outline-none transition-all max-w-[170px]"
                >
                  <option value="">All Spots</option>
                  {jobSpots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.count})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={applyDesktopFilter}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Filter size={13} /> Filter
              </button>
              <Link
                href="/jobs/spot-labels"
                title="Har spot ka printable QR label \u2014 scan karke us spot ke items khulenge"
                className="bg-panel-2 hover:bg-[#2a3550] text-muted px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all no-underline"
              >
                <MapPin size={13} /> QR
              </Link>
<button
                onClick={clearDeliveredSpots}
                disabled={spotCleaning || viewOnly}
                title={viewOnly ? "Spot clean sirf office ke andar se possible hai." : "Delivered jobs jinki location abhi bhi lagi hai — sab ek saath khali karo"}
                className={`bg-panel-2 hover:bg-[#2a3550] text-muted px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-60 ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {spotCleaning ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Eraser size={13} />
                )}{" "}
                Spot Clean
              </button>
              <button
                onClick={resetFilters}
                className="bg-panel-2 hover:bg-[#2a3550] text-muted px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
              >
                Reset
              </button>
              <button
                onClick={() => shiftDay(-1)}
                disabled={viewOnly}
                className={`bg-panel-2 hover:bg-[#2a3550] text-muted border border-app px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={viewOnly ? "Date change sirf office ke andar se possible hai." : undefined}
              >
                <ChevronLeft size={13} /> Prev
              </button>
              <button
                onClick={() => shiftDay(1)}
                disabled={viewOnly}
                className={`bg-panel-2 hover:bg-[#2a3550] text-muted border border-app px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={viewOnly ? "Date change sirf office ke andar se possible hai." : undefined}
              >
                Next <ChevronRight size={13} />
              </button>
              <button
                onClick={printReport}
                className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Printer size={13} /> Print
              </button>
              <button
                onClick={exportExcel}
                className="bg-teal-700 hover:bg-teal-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <FileSpreadsheet size={13} /> Excel
              </button>
              <Link
                href="/reports/delivered"
                className="bg-cyan-700 hover:bg-cyan-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Truck size={13} /> Delivered Report
              </Link>
              <label className="flex items-center gap-2 ml-auto bg-app border border-app px-3 py-1.5 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideDelivered}
                  onChange={(e) => setHideDelivered(e.target.checked)}
                  className="w-3.5 h-3.5 accent-blue-500"
                />
                <span className="text-xs font-bold text-muted">Hide Delivered</span>
              </label>
            </div>
          </div>

          {/* ── Search ── */}
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2"
              size={16}
            />
            <input
              type="text"
              placeholder="Search by job ID, client, device, fault, code, status, remark..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-panel border border-app text-app-2 placeholder-slate-600 rounded-xl text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
            />
            {localSearch && (
              <button
                onClick={() => setLocalSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-2 hover:text-muted"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Subtle inline loading indicator (search/filter refetch — no full reload) */}
          {loading && hasLoaded && (
            <div className="flex items-center gap-2 text-[11px] font-bold text-blue-400 px-1 py-1.5">
              <Loader2 size={12} className="animate-spin" /> Searching...
            </div>
          )}

          {/* ── Table (shared with mobile card/table toggle) ── */}
          {tableSection}
        </div>
        {bulkActionBar}
        {bulkWaModal}
        {singleWaModal}
        {bulkMoveModal}
        {spotEditModal}
        {staleModal}
        {/* Sprint 4 #19: master-detail preview (xl slide-over) */}
        {previewId !== null && (
          <JobPreviewPanel
            jobId={previewId}
            onClose={closePreview}
            onStatusChange={quickStatusChange}
            onSendWA={sendWA}
          />
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // MOBILE VIEW
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen theme-body pb-28">
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-[var(--app-panel)] via-[var(--app-hover)] to-[var(--app-panel)] backdrop-blur border-b border-[var(--app-border)] p-3">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600/20 border border-blue-600/30 p-1.5 rounded-full">
              <Wrench size={16} className="text-blue-400" />
            </div>
            <h1 className="text-sm font-black text-[var(--app-text)] tracking-wide">
              Transactions
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase">
              {totalRows} records
            </span>
            <Link
              href="/jobs/spot-labels"
              title="Spot QR labels"
              className="bg-[var(--app-panel-2)] hover:bg-[var(--app-hover)] text-[var(--app-text-2)] px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] font-bold no-underline transition-all"
            >
              <MapPin size={11} /> QR
            </Link>
            <Link
              href="/reports/delivered"
              title="Delivered Report"
              className="bg-[#48bb78] hover:bg-[#3da968] text-white px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] font-bold no-underline transition-all"
            >
              <Truck size={11} /> Delivered
            </Link>
            <div className="flex items-center gap-0.5 bg-[var(--app-panel-2)] border border-[var(--app-border)] p-0.5 rounded-lg">
              <button
                onClick={() => setMobileView("card")}
                className={`p-1 rounded transition-all ${mobileView === "card" ? "bg-blue-600 text-white" : "text-[var(--app-muted)]"}`}
                title="Card View"
              >
                <LayoutGrid size={12} />
              </button>
              <button
                onClick={() => setMobileView("table")}
                className={`p-1 rounded transition-all ${mobileView === "table" ? "bg-blue-600 text-white" : "text-[var(--app-muted)]"}`}
                title="Table View"
              >
                <List size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)] z-10 pointer-events-none"
            size={14}
          />
          <input
            type="text"
            placeholder="Search jobs, clients, items..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="theme-input w-full pl-9 pr-10 py-2 rounded-xl text-sm outline-none placeholder:text-[var(--app-muted-2)]"
          />
          <button
            onClick={() => setShowFilterModal(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 p-1.5 rounded-lg text-white"
          >
            <Filter size={13} />
          </button>
        </div>

        {/* Subtle inline loading indicator (search/filter refetch — no full reload) */}
        {loading && hasLoaded && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 mt-1.5">
            <Loader2 size={11} className="animate-spin" /> Searching...
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <label className="flex items-center gap-1.5 text-xs text-[var(--app-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={hideDelivered}
              onChange={(e) => setHideDelivered(e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-500"
            />
            Hide Delivered
          </label>
          <CanWrite message="Date change sirf office ke andar se possible hai.">
            <div className="flex gap-1">
              <button
                onClick={() => shiftDay(-1)}
                disabled={viewOnly}
                className={`text-[10px] bg-[var(--app-panel-2)] hover:bg-[var(--app-hover)] text-[var(--app-muted)] px-2 py-1 rounded-lg flex items-center gap-0.5 transition-colors ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={viewOnly ? "Date change sirf office ke andar se possible hai." : undefined}
              >
                <ChevronLeft size={11} /> Prev
              </button>
              <button
                onClick={() => shiftDay(1)}
                disabled={viewOnly}
                className={`text-[10px] bg-[var(--app-panel-2)] hover:bg-[var(--app-hover)] text-[var(--app-muted)] px-2 py-1 rounded-lg flex items-center gap-0.5 transition-colors ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={viewOnly ? "Date change sirf office ke andar se possible hai." : undefined}
              >
                Next <ChevronRight size={11} />
              </button>
            </div>
          </CanWrite>
        </div>
        {/* Selected Date Range Display */}
        {(dateFrom || dateTo) && (
          <div className="mt-2 text-center">
            <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg">
              {dateFrom === dateTo
                ? dateFrom
                : dateFrom && dateTo
                  ? `${dateFrom} → ${dateTo}`
                  : dateFrom || dateTo}
            </span>
          </div>
        )}
      </div>

      {/* ── Quick Stats (PHP mobile-stats feature) ── */}
      <div className="grid grid-cols-3 gap-2 px-3 pt-3">
        {[
          {
            label: "Total",
            value: stats.total,
            color: "text-blue-400",
            border: "border-blue-500/30",
            bg: "bg-blue-500/5",
          },
          {
            label: "Pending",
            value: stats.pending,
            color: "text-amber-400",
            border: "border-amber-500/30",
            bg: "bg-amber-500/5",
          },
          {
            label: "Completed",
            value: stats.completed,
            color: "text-emerald-400",
            border: "border-emerald-500/30",
            bg: "bg-emerald-500/5",
          },
        ].map(({ label, value, color, border, bg }) => (
          <div key={label} className={`${bg} border ${border} rounded-xl py-2.5 text-center`}>
            <div className={`text-xl font-black ${color}`}>{value}</div>
            <div className="text-[9px] text-muted-2 font-bold uppercase tracking-widest mt-0.5">
              {label}
            </div>
          </div>
        ))}
      </div>
      {userRole === "admin" && (
        <div className="mx-3 mt-2 bg-purple-500/5 border border-purple-500/20 rounded-xl py-2 px-4 flex items-center justify-between">
          <span className="text-[10px] text-muted-2 font-bold uppercase">Total Amount</span>
          <span className="text-sm font-black text-purple-400">
            {"\u20B9"}
            {stats.totalAmt.toLocaleString("en-IN")}
          </span>
        </div>
      )}

      {/* Stale alert (mobile) — 7+ din se spot par pade Done/Paid items */}
      {staleBanner && <div className="mx-3 mt-2">{staleBanner}</div>}

      {/* ── Search results indicator ── */}
      {debouncedSearch && (
        <div className="mx-3 my-2 bg-panel border border-app p-2.5 rounded-xl flex justify-between items-center text-xs">
          <span className="text-muted">
            Found <strong className="text-blue-400">{totalRows}</strong> results
          </span>
          <button
            onClick={() => setLocalSearch("")}
            className="text-muted-2 hover:text-muted"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Card / Table view (PHP: transactions_view toggle) ── */}
      {mobileView === "table" ? (
        <div className="p-3">{tableSection}</div>
      ) : (
        <div className="p-3 space-y-3">
          {/* Sprint 3 #13: refetch par skeleton cards */}
          {loading && hasLoaded ? (
            <CardsSkeleton count={4} />
          ) : paginatedTransactions.length === 0 ? (
            <div className="bg-panel border border-app p-10 rounded-2xl text-center">
              <AlertCircle className="mx-auto text-app mb-2" size={36} />
              <p className="text-muted text-sm font-bold">No transactions found</p>
              <p className="text-xs text-muted-2 mt-1">Adjust filters or search</p>
            </div>
          ) : (
            paginatedTransactions.map((txn) => {
              const clientName = getClientName(txn);
              const balance = getClientBalance(txn);
              const phone = txn.client_contact?.replace(/\D/g, "") || "";

              return (
                <div
                  key={txn.id}
                  className={`bg-panel rounded-2xl border border-app border-l-4 overflow-hidden ${STATUS_BORDER[txn.status] || "border-l-slate-600"} ${selectedIds.has(txn.id) ? "ring-2 ring-blue-500/50" : ""}`}
                >
                  {/* Card Top */}
                  <div className="flex justify-between items-start p-3 bg-gradient-to-r from-white/[0.02] to-transparent">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {/* Checkbox for bulk select */}
                      <button
                        onClick={() => toggleSelect(txn.id)}
                        className={`mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          selectedIds.has(txn.id)
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-app hover:border-muted"
                        }`}
                      >
                        {selectedIds.has(txn.id) && <CheckCircle2 size={12} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/jobs/${txn.id}/view`}
                          className="font-black text-sm text-white hover:text-blue-400 transition-colors"
                        >
                          #{txn.job_id}
                        </Link>
                        {txn.status <= 3 && (openPartCounts.get(txn.id) || 0) > 0 && (
                          <WaitingPartsBadge count={openPartCounts.get(txn.id)!} />
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <Link
                            href={`/jobs/${txn.id}/view`}
                            className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full text-[9px] font-bold no-underline hover:bg-blue-500/20 transition-colors"
                          >
                            {txn.code || "No Code"}
                          </Link>
                          <span className="text-[10px] text-muted-2">
                            {fmtDate(txn.date_created)}
                          </span>
                        </div>
                        {txn.mechanic_id != null && mechNames[txn.mechanic_id] && (
                          <div
                            className="text-[9px] font-medium text-muted truncate mt-0.5"
                            title={`Mechanic: ${mechNames[txn.mechanic_id]}`}
                          >
                            {mechNames[txn.mechanic_id]}
                          </div>
                        )}
                        {txn.status_changed_at && (
                          <div className="flex items-center gap-1 mt-1 text-[9px] text-muted">
                            <Clock size={9} />
                            {STATUS_MAP[txn.status]}: {fmtDateTime(txn.status_changed_at)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`${getStatusBadge(txn.status)} flex-shrink-0`}>
                        {STATUS_MAP[txn.status]}
                      </span>
                      {/* Quick Status Buttons */}
                      <div className="flex gap-1 flex-wrap justify-end">
{txn.status === 0 && (
                            <button
                              onClick={() => quickStatusChange(txn.id, 1)}
                              disabled={statusChangeLoading === txn.id || viewOnly}
                              className={`px-1.5 py-0.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 rounded text-[9px] font-bold flex items-center gap-0.5 transition-all ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={viewOnly ? "Job status change sirf office ke andar se possible hai." : undefined}
                            >
                              {statusChangeLoading === txn.id ? (
                                <Loader2 size={9} className="animate-spin" />
                              ) : (
                                <ArrowRight size={9} />
                              )}{" "}
                              Progress
                            </button>
                          )}
                          {txn.status === 1 && (
                            <button
                              onClick={() => quickStatusChange(txn.id, 2)}
                              disabled={statusChangeLoading === txn.id || viewOnly}
                              className={`px-1.5 py-0.5 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-400 rounded text-[9px] font-bold flex items-center gap-0.5 transition-all ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={viewOnly ? "Job status change sirf office ke andar se possible hai." : undefined}
                            >
                              {statusChangeLoading === txn.id ? (
                                <Loader2 size={9} className="animate-spin" />
                              ) : (
                                <ArrowRight size={9} />
                              )}{" "}
                              Done
                            </button>
                          )}
                          {txn.status === 2 && (
                            <button
                              onClick={() => quickStatusChange(txn.id, 5)}
                              disabled={statusChangeLoading === txn.id || viewOnly}
                              className={`px-1.5 py-0.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-400 rounded text-[9px] font-bold flex items-center gap-0.5 transition-all ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={viewOnly ? "Job status change sirf office ke andar se possible hai." : undefined}
                            >
                              {statusChangeLoading === txn.id ? (
                                <Loader2 size={9} className="animate-spin" />
                              ) : (
                                <ArrowRight size={9} />
                              )}{" "}
                              Deliver
                            </button>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Client Info */}
                  <div className="px-3 py-2.5 border-t border-app flex items-center gap-2.5">
                    <ClientMiniAvatar image={txn.client_image} name={clientName} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/clients/${txn.client_name}/view`}
                        className="font-bold text-sm text-app-2 hover:text-blue-400 transition-colors block truncate"
                      >
                        {clientName}
                      </Link>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <BalanceBadge bal={balance} />
                        {phone && (
                          <a
                            href={`tel:${txn.client_contact}`}
                            className="flex items-center gap-1 text-blue-400 text-[10px] hover:text-blue-300"
                            title="Call client"
                          >
                            <Phone size={10} /> {txn.client_contact}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="px-3 py-2.5 border-t border-app space-y-1.5 text-xs">
                    {[
                      { label: "Item/Model", value: txn.item, cls: "text-app-2 font-bold" },
                      { label: "Fault/Issue", value: txn.fault, cls: "text-red-400" },
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="flex justify-between gap-2">
                        <span className="text-muted-2 flex-shrink-0">{label}:</span>
                        <span className={`${cls} text-right`}>{value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between gap-2 items-center">
                      <span className="text-muted-2 flex-shrink-0">Spot:</span>
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="text-amber-400/90 text-right truncate">
                          {txn.uniq_id || "\u2014"}
                        </span>
                        <button
                          onClick={() => openSpotEdit(txn)}
                          title="Spot set karo / badlo"
                          className="inline-flex items-center justify-center p-1 rounded-md border border-app-2 bg-white/[0.02] text-muted hover:text-amber-400 hover:border-amber-500/40 transition-all flex-shrink-0"
                        >
                          <PenSquare size={10} />
                        </button>
                      </span>
                    </div>
                    {txn.remark && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-2 flex-shrink-0 flex items-center gap-1">
                          <MessageSquare size={10} /> Remark:
                        </span>
                        <span className="text-muted text-right">{txn.remark}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-sm pt-1 border-t border-app">
                      <span className="text-muted-2">Bill Amount:</span>
                      <span className="text-emerald-400">
                        {"\u20B9"}
                        {(txn.amount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Additional Info (PHP feature) */}
                  <div className="px-3 py-2 bg-panel-2 border-t border-app space-y-1">
                    <div className="flex justify-between text-[9px]">
                      <span className="text-app">Created:</span>
                      <span className="text-muted-2">{fmtDateTime(txn.date_created)}</span>
                    </div>
                    {txn.date_updated && txn.date_updated !== txn.date_created && (
                      <div className="flex justify-between text-[9px]">
                        <span className="text-app">Last Updated:</span>
                        <span className="text-muted-2">{fmtDateTime(txn.date_updated)}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons (6 grid + delete full-width) */}
                  <div className="p-3 bg-panel-2 border-t border-app space-y-1.5">
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        {
                          href: `/jobs/${txn.id}/view`,
                          icon: Eye,
                          label: "View",
                          border: "border-blue-500/20",
                          text: "text-blue-400",
                        },
                        {
                          href: null,
                          icon: Phone,
                          label: "WhatsApp",
                          border: "border-emerald-500/20",
                          text: "text-emerald-400",
                          onClick: () => sendWA(txn),
                        },
                        {
                          href: `/api/print-bill?job_id=${txn.job_id}`,
                          icon: Printer,
                          label: "Print",
                          border: "border-orange-500/20",
                          text: "text-orange-400",
                          target: "_blank",
                        },
                        {
                          href: `/api/print-bill?job_id=${txn.job_id}&type=thermal`,
                          icon: Printer,
                          label: "Thermal",
                          border: "border-yellow-500/20",
                          text: "text-yellow-400",
                          target: "_blank",
                        },
                        {
                          href: `/jobs/${txn.id}/old`,
                          icon: History,
                          label: "Old Edit",
                          border: "border-cyan-500/20",
                          text: "text-cyan-400",
                        },
                        {
                          href: `/jobs/${txn.id}/edit`,
                          icon: Settings,
                          label: "Edit",
                          border: "border-indigo-500/20",
                          text: "text-indigo-400",
                        },
                      ].map(({ href, icon: Icon, label, border, text, onClick, target }) =>
                        href ? (
                          <a
                            key={label}
                            href={href}
                            target={target}
                            className={`flex flex-col items-center p-2 bg-panel rounded-xl border ${border} ${text} text-[9px] font-bold gap-1 hover:opacity-80 active:scale-95 transition-all`}
                          >
                            <Icon size={14} />
                            <span>{label}</span>
                          </a>
                        ) : (
                          <button
                            key={label}
                            onClick={onClick}
                            className={`flex flex-col items-center p-2 bg-panel rounded-xl border ${border} ${text} text-[9px] font-bold gap-1 hover:opacity-80 active:scale-95 transition-all`}
                          >
                            <Icon size={14} />
                            <span>{label}</span>
                          </button>
                        )
                      )}
                    </div>
                    <button
                        onClick={() => handleDelete(txn.id)}
                        disabled={viewOnly}
                        className={`w-full flex items-center justify-center gap-1.5 p-2 bg-red-500/10 rounded-xl border border-red-500/25 text-red-400 text-[9px] font-bold hover:bg-red-500/20 active:scale-[0.98] transition-all ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={viewOnly ? "Job delete sirf office ke andar se possible hai." : undefined}
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                  </div>
                </div>
              );
            })
          )}
          {/* ── Card view pagination (table wala shared pager) ── */}
          {!(loading && hasLoaded) && paginatedTransactions.length > 0 && (
            <div className="rounded-2xl border border-app overflow-hidden">
              {paginationBar}
            </div>
          )}
        </div>
      )}

      {/* ── FAB ── */}
      <div ref={fabRef} className="fixed bottom-[136px] right-4 z-[60] flex flex-col gap-3 items-end">
        <button
          onClick={() => setFabOpen(!fabOpen)}
          className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full shadow-xl shadow-blue-500/30 flex items-center justify-center text-white border border-blue-500/30 transition-all active:scale-95"
        >
          <Plus size={22} className={`transition-transform ${fabOpen ? "rotate-45" : ""}`} />
        </button>
        {fabOpen && (
          <div className="absolute bottom-14 right-0 bg-white dark:bg-panel border-2 border-blue-500/40 dark:border-blue-500/50 ring-1 ring-blue-500/30 dark:ring-blue-400/30 rounded-2xl shadow-2xl shadow-black/25 dark:shadow-blue-500/10 py-1.5 w-44 text-sm overflow-hidden">
            {[
              {
                action: () => setShowQuickCreate(true),
                icon: Zap,
                label: "Quick Create",
                cls: "text-blue-600 dark:text-blue-400",
              },
              {
                href: "/jobs/new",
                icon: Plus,
                label: "Create New",
                cls: "text-blue-500 dark:text-blue-300",
              },
              {
                href: "/jobs/old",
                icon: History,
                label: "Old Jobs",
                cls: "text-amber-600 dark:text-amber-400",
              },
              {
                href: "/jobs/bulk",
                icon: Layers,
                label: "Bulk Entry",
                cls: "text-emerald-600 dark:text-emerald-400",
              },
              {
                href: "/jobs/bulk-edit",
                icon: PenSquare,
                label: "Bulk Edit",
                cls: "text-purple-600 dark:text-purple-400",
              },
            ].map(({ href, action, icon: Icon, label, cls }) =>
              href ? (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setFabOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-panel-2 dark:hover:bg-white/[0.04] text-app dark:text-muted hover:text-app dark:hover:text-app-2 transition-colors"
                >
                  <Icon size={14} className={cls} /> {label}
                </Link>
              ) : (
                <button
                  key={label}
                  onClick={() => {
                    action?.();
                    setFabOpen(false);
                  }}
                  className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-panel-2 dark:hover:bg-white/[0.04] text-app dark:text-muted hover:text-app dark:hover:text-app-2 transition-colors w-full"
                >
                  <Icon size={14} className={cls} /> {label}
                </button>
              )
            )}
            <hr className="my-1 border-app-2 dark:border-app" />
            <button
              onClick={() => {
                printReport();
                setFabOpen(false);
              }}
              className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-panel-2 dark:hover:bg-white/[0.04] text-app dark:text-muted w-full transition-colors"
            >
              <Printer size={14} className="text-emerald-600 dark:text-emerald-400" /> Print
            </button>
            <button
              onClick={() => {
                exportExcel();
                setFabOpen(false);
              }}
              className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-panel-2 dark:hover:bg-white/[0.04] text-app dark:text-muted w-full transition-colors"
            >
              <FileSpreadsheet size={14} className="text-teal-600 dark:text-teal-400" /> Excel
            </button>
          </div>
        )}
      </div>

      {/* ── Quick Create Modal ── */}
      {showQuickCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-panel border border-app-2 dark:border-app rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-panel border-b border-app-2 dark:border-app flex items-center justify-between p-4 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
                  <Zap size={18} className="!text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-app dark:text-white">Quick Create Job</h3>
                  <p className="text-xs text-muted">Create job instantly</p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickCreate(false)}
                className="w-8 h-8 flex items-center justify-center bg-panel-2 hover:bg-panel-2 dark:bg-panel-2 dark:hover:bg-panel-2 rounded-lg text-muted hover:text-app dark:hover:text-white transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              {/* Client Selection */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-muted mb-1.5">
                  <User size={12} className="inline mr-1" />
                  Client (Optional)
                </label>
                {quickClientId ? (
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-panel-2 border border-app-2 dark:border-app rounded-xl px-3 py-2.5">
                    <span className="text-sm text-app dark:text-white font-medium">
                      {quickClients.find((c) => c.id === quickClientId)?.firstname}{" "}
                      {quickClients.find((c) => c.id === quickClientId)?.lastname}
                    </span>
                    <button
                      onClick={() => setQuickClientId(null)}
                      className="text-muted hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => setQuickClientOpen(!quickClientOpen)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-panel-2 border border-app-2 dark:border-app rounded-xl text-sm text-left hover:border-muted dark:hover:border-muted transition-all"
                    >
                      <span className="text-muted">Search client...</span>
                      <ChevronDown size={14} className="text-muted" />
                    </button>
                    {quickClientOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-panel border border-app-2 dark:border-app rounded-xl shadow-2xl z-20 p-2">
                        <input
                          autoFocus
                          placeholder="Search by name or contact..."
                          value={quickClientSearch}
                          onChange={(e) => setQuickClientSearch(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-panel-2 border border-app-2 dark:border-app rounded-lg text-app dark:text-white text-sm outline-none mb-2"
                        />
                        <div className="max-h-40 overflow-y-auto space-y-0.5">
                          {filteredQuickClients.length === 0 ? (
                            <p className="text-muted text-xs text-center py-4">
                              Koi client nahi mila
                            </p>
                          ) : (
                            filteredQuickClients.map((c) => (
                              <div
                                key={c.id}
                                onClick={() => {
                                  setQuickClientId(c.id);
                                  setQuickClientOpen(false);
                                  setQuickClientSearch("");
                                }}
                                className="px-3 py-2 rounded-lg hover:bg-panel-2 dark:hover:bg-white/5 cursor-pointer transition-all"
                              >
                                <div className="text-sm font-bold text-app dark:text-white">
                                  {c.firstname} {c.lastname}
                                </div>
                                <div className="text-xs text-muted">{c.contact}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Item */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-muted mb-1.5">
                  Item / Model <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. iPhone 15, Samsung S24"
                  value={quickForm.item}
                  onChange={(e) => setQuickForm((p) => ({ ...p, item: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-panel-2 border border-app-2 dark:border-app rounded-xl text-app dark:text-white text-sm placeholder:text-muted dark:placeholder:text-app outline-none focus:border-blue-500"
                />
              </div>

              {/* Fault */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-muted mb-1.5">
                  Fault Reported <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Screen broken, Battery drain"
                  value={quickForm.fault}
                  onChange={(e) => setQuickForm((p) => ({ ...p, fault: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-panel-2 border border-app-2 dark:border-app rounded-xl text-app dark:text-white text-sm placeholder:text-muted dark:placeholder:text-app outline-none focus:border-blue-500"
                />
              </div>

              {/* Mechanic */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-muted mb-1.5">
                  Mechanic <span className="text-red-500">*</span>
                </label>
                <select
                  value={quickForm.mechanicId}
                  onChange={(e) => setQuickForm((p) => ({ ...p, mechanicId: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-panel-2 border border-app-2 dark:border-app rounded-xl text-app dark:text-white text-sm outline-none focus:border-blue-500"
                >
                  <option value="">Select Mechanic</option>
                  {quickMechanics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstname} {m.lastname}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-slate-50 dark:bg-panel border-t border-app-2 dark:border-app p-4 flex gap-3">
              <button
                onClick={handleQuickCreate}
                disabled={quickCreateLoading}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 !text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                {quickCreateLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin !text-white" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Zap size={16} className="!text-white" />
                    Create Job
                  </>
                )}
              </button>
              <button
                onClick={() => setShowQuickCreate(false)}
                className="px-6 py-3 bg-panel-2 hover:bg-panel-2 dark:bg-panel-2 dark:hover:bg-panel-2 border border-app-2 dark:border-app text-app dark:text-muted rounded-xl font-bold text-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkActionBar}
      {bulkWaModal}
      {singleWaModal}
      {bulkMoveModal}
      {spotEditModal}
      {staleModal}
      {/* ── Filter Modal ── */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-panel border border-app-2 dark:border-app rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-app dark:text-white">Filter Transactions</h3>
              <button
                onClick={() => setShowFilterModal(false)}
                className="text-muted hover:text-muted-2 dark:hover:text-app-2"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: "From Date", value: dateFrom, set: setDateFrom },
                { label: "To Date", value: dateTo, set: setDateTo },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="block text-xs font-bold text-muted mb-1">{label}</label>
                  <input
                    type="date"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-app border border-app-2 dark:border-app text-app dark:text-app-2 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              ))}
              <CanWrite message="Date change sirf office ke andar se possible hai.">
              {/* Mobile day nav in modal */}
              <div className="flex gap-2">
                <button
                  onClick={() => shiftDay(-1)}
                  disabled={viewOnly}
                  className={`flex-1 bg-panel-2 hover:bg-panel-2 dark:bg-panel-2 dark:hover:bg-[#2a3550] text-app dark:text-muted p-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={viewOnly ? "Date change sirf office ke andar se possible hai." : undefined}
                >
                  <ChevronLeft size={13} /> Prev Day
                </button>
                <button
                  onClick={() => shiftDay(1)}
                  disabled={viewOnly}
                  className={`flex-1 bg-panel-2 hover:bg-panel-2 dark:bg-panel-2 dark:hover:bg-[#2a3550] text-app dark:text-muted p-2 rounded-xl text-xs font-bold flex items_center justify-center gap-1 transition-colors ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={viewOnly ? "Date change sirf office ke andar se possible hai." : undefined}
                >
                  Next Day <ChevronRight size={13} />
                </button>
              </div>
            </CanWrite>
              <div>
                <label className="block text-xs font-bold text-muted mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value ? parseInt(e.target.value) : "")}
                  className="w-full bg-slate-50 dark:bg-app border border-app-2 dark:border-app text-app dark:text-app-2 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500 transition-all"
                >
                  <option value="">All Status</option>
                  {Object.entries(STATUS_MAP).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1">
                  Spot (Location)
                </label>
                <select
                  value={spotFilter}
                  onChange={(e) => setSpotFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-app border border-app-2 dark:border-app text-app dark:text-app-2 rounded-xl p-2.5 text-sm outline-none focus:border-blue-500 transition-all"
                >
                  <option value="">All Spots</option>
                  {jobSpots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.count})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={clearDeliveredSpots}
                disabled={spotCleaning || viewOnly}
                className={`w-full bg-panel-2 hover:bg-panel-2 dark:bg-panel-2 dark:hover:bg-[#2a3550] text-app dark:text-muted p-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-60 ${viewOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={viewOnly ? "Spot clean sirf office ke andar se possible hai." : undefined}
              >
                {spotCleaning ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Eraser size={14} />
                )}
                {spotCleaning ? "Clean ho raha hai…" : "Delivered Spots Clean karo"}
              </button>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={resetFilters}
                  className="flex-1 bg-panel-2 hover:bg-panel-2 dark:bg-panel-2 dark:hover:bg-[#2a3550] text-app dark:text-muted p-2.5 rounded-xl text-sm font-bold transition-all"
                >
                  Reset
                </button>
                <button
                  onClick={applyMobileFilter}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 !text-white p-2.5 rounded-xl text-sm font-bold transition-all"
                >
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
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen bg-app gap-4">
          <Loader2 className="animate-spin text-blue-500" size={44} />
          <p className="text-muted-2 text-xs font-bold uppercase tracking-[0.3em]">Loading...</p>
        </div>
      }
    >
      <JobsListContent />
    </Suspense>
  );
}
