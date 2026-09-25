// ─── Sprint 3 #12: jobs list data layer ─────────────────────────────────────
// page.tsx se nikala hua list state + fetch machinery. Behavior 1:1 same hai —
// sirf ghar badla hai. UI state (selection, modals, dropdown, fab, WA,
// mobileView, sysInfo, userRole, stale alerts) page me hi rehta hai.
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { buildDueMaps } from "@/lib/client-due";
import { fetchOpenPartCounts } from "@/lib/requiredParts";
import { logger } from "@/lib/logger";

export interface Transaction {
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
  status_changed_at: string | null;
  del_status: number;
  mechanic_id?: number | null;
  location_id?: number | null;
  client_firstname?: string;
  client_middlename?: string;
  client_lastname?: string;
  client_contact?: string;
  client_image?: string;
  client_opening_balance?: number;
  total_billed?: number;
  total_paid?: number;
  total_sale?: number;
  loan_due?: number;
}

export interface JobListStats {
  total: number;
  pending: number;
  progress: number;
  completed: number;
  totalAmt: number;
}

export interface JobSpot {
  id: number;
  name: string;
  count: number;
}

// PERF (lightning B2): fetchStats + fetchPage dono same debounced term par
// lagbhag ek saath client-search chalate the (= duplicate query). In-flight
// dedupe — dusra caller same promise share karta hai, settle par entry hat
// jati hai (stale cache NAHI — har naye term par fresh query).
const searchClientsInflight = new Map<string, Promise<string>>();

// ── DUAL-ERA status-log reader — docs/DATA_MIGRATION_NOTES.md zaroor padho ──
// PHP yug ke logs aur naye Next.js ke logs activity_logs me ALAG conventions
// me rehte hain, isliye dono ko unke apne rules se query karna padta hai:
//   legacy (PHP):  module='Transactions', action='Transaction Status Changed',
//                  meta_id = transaction_list.id (internal PK)
//   modern (Next): module='Jobs', action='Updated Job Status',
//                  meta_id = job_id string ("28201" jaisa)
// Desc order aata hai → pehla hit per key hi latest hai. Naya code hamesha
// canonical transaction_list.id se log kare (writers), readers dono dekhein.
export async function fetchStatusChangeLogs(
  era: "legacy" | "modern",
  ids: string[]
): Promise<Array<{ meta_id: string; date_created: string }>> {
  if (!ids.length) return [];
  const cfg =
    era === "legacy"
      ? { module: "Transactions", action: "Transaction Status Changed" }
      : { module: "Jobs", action: "Updated Job Status" };
  const { data } = await supabase
    .from("activity_logs")
    .select("meta_id, date_created")
    .eq("module", cfg.module)
    .eq("action", cfg.action)
    .in("meta_id", ids)
    .order("date_created", { ascending: false });
  return (data || []) as Array<{ meta_id: string; date_created: string }>;
}

export function useJobList() {
  const searchParams = useSearchParams();

  // URL-driven state
  const urlDateFrom = searchParams.get("date_from") || "";
  const urlDateTo = searchParams.get("date_to") || "";
  const urlHideDelivered = searchParams.get("hide_delivered") === "1";

  // Data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [openPartCounts, setOpenPartCounts] = useState<Map<number, number>>(new Map());
  const [totalRows, setTotalRows] = useState(0);
  const [stats, setStats] = useState<JobListStats>({
    total: 0,
    pending: 0,
    progress: 0,
    completed: 0,
    totalAmt: 0,
  });
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Filters
  // Lazy init from URL (?search=) — QR labels / spot-links isi se deep-link karte hain
  const [localSearch, setLocalSearch] = useState(() => searchParams.get("search") || "");
  const [dateFrom, setDateFrom] = useState(urlDateFrom);
  const [dateTo, setDateTo] = useState(urlDateTo);
  // Lazy init: URL param > localStorage last choice. Synchronous init zaroori hai
  // taaki PEHLA fetch hi filtered ho (restore-effect race se delivered leak nahi hoga).
  const [hideDelivered, setHideDelivered] = useState<boolean>(() => {
    const p = searchParams.get("hide_delivered");
    if (p !== null) return p === "1";
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("jobs_hide_delivered") === "1";
      } catch {
        return false;
      }
    }
    return urlHideDelivered;
  });
  const [statusFilter, setStatusFilter] = useState<number | "">("");
  // Spot filter: locations.id (kind='job') — "kahan rakha hai?" ek click me
  // Lazy init from URL (?spot=<id>) — exact location filter, search se zyada precise
  const [spotFilter, setSpotFilter] = useState<string>(() => {
    const p = searchParams.get("spot");
    return p && /^\d+$/.test(p) ? p : "";
  });
  const [jobSpots, setJobSpots] = useState<JobSpot[]>([]);

  // Pagination
  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(localSearch), 300);
    return () => clearTimeout(t);
  }, [localSearch]);

  // ── Hide Delivered yaad rakhna (localStorage) — refresh par last choice rahe ──
  // Restore lazy-init me hota hai (upar); yahan sirf har change persist karo.
  useEffect(() => {
    try {
      localStorage.setItem("jobs_hide_delivered", hideDelivered ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [hideDelivered]);

  // ── Job spots (kind='job' locations) + live occupancy counts ──
  const loadJobSpots = useCallback(async () => {
    const [locRes, occRes] = await Promise.all([
      supabase.from("locations").select("id, rack").eq("kind", "job").eq("zone", "").order("rack"),
      supabase
        .from("transaction_list")
        .select("location_id")
        .eq("del_status", 0)
        .not("status", "in", "(4,5)")
        .not("location_id", "is", null),
    ]);
    const c: Record<number, number> = {};
    (occRes.data || []).forEach((r) => {
      const lid = r.location_id as number;
      c[lid] = (c[lid] || 0) + 1;
    });
    setJobSpots(
      (locRes.data || [])
        .map((l) => ({ id: l.id, name: l.rack || "", count: c[l.id] || 0 }))
        .sort((a, b) => a.count - b.count || a.name.localeCompare(b.name))
    );
  }, []);
  useEffect(() => {
    loadJobSpots();
  }, [loadJobSpots]);

  // URL se aaya spot id agar DB me exist nahi karta (deleted spot ka purana QR/link)
  // to filter khud reset ho jaye — blank list atki na rahe
  useEffect(() => {
    if (spotFilter && jobSpots.length > 0 && !jobSpots.some((s) => String(s.id) === spotFilter)) {
      setSpotFilter("");
    }
  }, [jobSpots, spotFilter]);

  // Same-route navigation par bhi URL params apply ho — Loc/QR links /jobs?search=X
  // ya ?spot=X par le jaate hain; useState lazy-init sirf mount par chalta hai,
  // isliye param CHANGE hone par state sync karni zaroori hai.
  const urlSearch = searchParams.get("search") || "";
  const urlSpot = searchParams.get("spot");
  useEffect(() => {
    setLocalSearch(urlSearch);
  }, [urlSearch]);
  useEffect(() => {
    setSpotFilter(urlSpot && /^\d+$/.test(urlSpot) ? urlSpot : "");
  }, [urlSpot]);

  // ── Client search (Step 1: foreign key filtering) ─────────────────────────
  const searchClients = useCallback(async (term: string) => {
    if (!term) return "";
    const inflight = searchClientsInflight.get(term);
    if (inflight) return inflight;
    const p = (async () => {
      const { data: matchedClients } = await supabase
        .from("client_list")
        .select("id")
        .or(
          `firstname.ilike.%${term}%,middlename.ilike.%${term}%,lastname.ilike.%${term}%,contact.ilike.%${term}%`
        );
      return matchedClients?.map((c) => c.id).join(",") || "-1";
    })();
    searchClientsInflight.set(term, p);
    try {
      return await p;
    } finally {
      if (searchClientsInflight.get(term) === p) searchClientsInflight.delete(term);
    }
  }, []);

  // ── Quick Stats (exact — no 2k-row cap). Filter-dependent only: NOT re-run
  //    on pagination, so page changes skip the full-dataset stats scan. ──────
  const fetchStats = useCallback(async () => {
    try {
      const term = debouncedSearch.trim().toLowerCase();
      const matchedClientIds = await searchClients(term);

      const buildStatsQuery = (rangeFrom: number, rangeTo: number, withCount = false) => {
        let q = supabase
          .from("transaction_list")
          .select("status, amount", withCount ? { count: "exact" } : undefined)
          .eq("del_status", 0)
          .range(rangeFrom, rangeTo);
        if (dateFrom) q = q.gte("date_created", `${dateFrom}T00:00:00+05:30`);
        if (dateTo) q = q.lte("date_created", `${dateTo}T23:59:59+05:30`);
        if (hideDelivered) q = q.neq("status", 5);
        if (statusFilter !== "") q = q.eq("status", statusFilter);
        if (spotFilter) q = q.eq("location_id", parseInt(spotFilter));
        if (term)
          q = q.or(
            `job_id.ilike.%${term}%,code.ilike.%${term}%,item.ilike.%${term}%,fault.ilike.%${term}%,uniq_id.ilike.%${term}%,remark.ilike.%${term}%,client_name.in.(${matchedClientIds})`
          );
        return q;
      };

      // Chunk 0 carries the exact total (same filters as the scan) — removes a
      // standalone full-table `count: exact` head round-trip (N+1 → N queries).
      // Baki chunks parallel. Results/behaviour unchanged.
      const { data: head, count } = await buildStatsQuery(0, 999, true);
      const total = count || 0;
      const headRows = (head || []) as Array<{ status: number; amount: number }>;

      const chunkCount = Math.max(1, Math.ceil(total / 1000));
      const restChunks: Array<Array<{ status: number; amount: number }>> = [];
      if (chunkCount > 1) {
        const rest = await Promise.all(
          Array.from({ length: chunkCount - 1 }, (_, i) =>
            buildStatsQuery((i + 1) * 1000, (i + 1) * 1000 + 999)
          )
        );
        rest.forEach((r) =>
          restChunks.push((r.data || []) as Array<{ status: number; amount: number }>)
        );
      }

      const chunks = [headRows, ...restChunks];

      let pending = 0;
      let progress = 0;
      let completed = 0;
      let totalAmt = 0;
      for (const rows of chunks) {
        for (const t of rows) {
          totalAmt += t.amount || 0;
          if (t.status === 0) pending += 1;
          else if (t.status === 1) progress += 1;
          else if (t.status === 2 || t.status === 3 || t.status === 5) completed += 1;
        }
      }

      setStats({ total, pending, progress, completed, totalAmt });
    } catch (err) {
      logger.error("fetchStats error:", err);
    }
  }, [dateFrom, dateTo, hideDelivered, statusFilter, spotFilter, debouncedSearch, searchClients]);

  // ── Page rows (filter + pagination dependent) ─────────────────────────────
  const fetchPage = useCallback(async () => {
    try {
      setLoading(true);

      const term = debouncedSearch.trim().toLowerCase();
      const matchedClientIds = await searchClients(term);

      // Apply Filters
      let query = supabase
        .from("transaction_list")
        .select("*", { count: "exact" })
        .eq("del_status", 0);
      if (dateFrom) query = query.gte("date_created", `${dateFrom}T00:00:00+05:30`);
      if (dateTo) query = query.lte("date_created", `${dateTo}T23:59:59+05:30`);
      if (hideDelivered) query = query.neq("status", 5);
      if (statusFilter !== "") query = query.eq("status", statusFilter);
      if (spotFilter) query = query.eq("location_id", parseInt(spotFilter));
      if (term) {
        query = query.or(
          `job_id.ilike.%${term}%,code.ilike.%${term}%,item.ilike.%${term}%,fault.ilike.%${term}%,uniq_id.ilike.%${term}%,remark.ilike.%${term}%,client_name.in.(${matchedClientIds})`
        );
      }

      const from = pageIndex * pageSize;
      const to = from + pageSize - 1;
      // Sort by job_id (newest job first) — date_created ties/backdates and looks "random".
      // Note: job_id is stored as TEXT; cast sorting (job_id::bigint) is not supported by this
      // PostgREST version. All job_ids are currently uniform-width numeric so text sort == numeric sort.
      query = query.order("job_id", { ascending: false }).range(from, to);

      const pageRes = await query;
      if (pageRes.error) throw pageRes.error;

      setTotalRows(pageRes.count || 0);

      const pageTxns = pageRes.data || [];
      if (!pageTxns.length) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      // Step 3: Fetch related data ONLY for the current page's clients (Extremely fast!)
      const clientIdsNum = [...new Set(pageTxns.map((t) => Number(t.client_name)))];
      const clientIdsStr = clientIdsNum.map(String);

      // Status-change timestamps — dono yug parallel query (helper upar dekho)
      const logPromise = Promise.all([
        fetchStatusChangeLogs(
          "legacy",
          pageTxns.map((t) => String(t.id))
        ),
        fetchStatusChangeLogs("modern", [
          ...new Set(pageTxns.map((t) => String(t.job_id || "")).filter(Boolean)),
        ]),
      ]).then(([legacyRows, modernRows]) => ({ data: [...legacyRows, ...modernRows] }));

      const [clientsRes, billedRes, paidRes, salesRes, loansRes, logsRes] = await Promise.all([
        supabase
          .from("client_list")
          .select("id, firstname, middlename, lastname, contact, opening_balance, image_path")
          .in("id", clientIdsNum),
        // Only Delivered (5) jobs count toward balance — canonical PHP formula
        supabase
          .from("transaction_list")
          .select("client_name, amount")
          .eq("status", 5)
          .neq("del_status", 1)
          .in("client_name", clientIdsStr),
        supabase
          .from("client_payments")
          .select("client_id, amount, discount, loan_id")
          .in("client_id", clientIdsNum),
        supabase
          .from("direct_sales")
          .select("client_id, total_amount")
          .in("client_id", clientIdsNum),
        // Active loans only — closed loans balance me count nahi hote
        supabase
          .from("client_loans")
          .select("id, client_id, total_payable")
          .eq("status", 1)
          .in("client_id", clientIdsNum),
        logPromise,
      ]);

      // Build latest status change map (activity_logs returns ordered desc, keep first per job)
      const statusChangeMap = new Map<string, string>();
      for (const log of logsRes?.data || []) {
        const k = String(log.meta_id);
        if (!statusChangeMap.has(k)) {
          statusChangeMap.set(k, log.date_created);
        }
      }

      const m = buildDueMaps({
        repairs: billedRes.data,
        directSales: salesRes.data,
        payments: paidRes.data,
        loans: loansRes.data,
      });
      const clientMap = new Map(clientsRes.data?.map((c) => [c.id, c]) ?? []);

      setTransactions(
        pageTxns.map((txn) => {
          const cid = Number(txn.client_name);
          const client = clientMap.get(cid);
          // Status-date sirf VERIFIED sources se: Delivered → date_completed,
          // warna activity_logs ki last status-change entry (legacy key = txn id,
          // modern key = job_id — dono try karo). date_updated fallback NAHI:
          // sync/migration rows ko bulk touch kar deta hai (jhoothi aaj ki date).
          const statusDate =
            txn.status === 5 && txn.date_completed
              ? txn.date_completed
              : statusChangeMap.get(String(txn.id)) ||
                statusChangeMap.get(String(txn.job_id)) ||
                null;
          return {
            ...txn,
            client_firstname: client?.firstname || "",
            client_middlename: client?.middlename || "",
            client_lastname: client?.lastname || "",
            client_contact: client?.contact || "",
            client_image: client?.image_path || undefined,
            client_opening_balance: client?.opening_balance || 0,
            total_billed: m.repairBilled[cid] || 0,
            total_paid: m.servicePaid[cid] || 0,
            total_sale: m.directSalesBilled[cid] || 0,
            loan_due: (m.activeLoanGiven[cid] || 0) - (m.loanRepaid[cid] || 0),
            status_changed_at: statusDate,
          };
        })
      );
    } catch (err) {
      logger.error("fetchPage error:", err);
    } finally {
      setHasLoaded(true);
      setLoading(false);
    }
  }, [
    dateFrom,
    dateTo,
    hideDelivered,
    statusFilter,
    spotFilter,
    debouncedSearch,
    pageIndex,
    pageSize,
    searchClients,
  ]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);
  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  // BUG FIX 3: Reset pageIndex on actual filter/search change
  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch, hideDelivered, statusFilter, spotFilter, dateFrom, dateTo]);

  // We already have the paginated transactions from the server!
  const paginatedTransactions = transactions;
  const filteredTransactions = transactions; // For backwards compatibility with other UI components
  const totalPages = Math.ceil(totalRows / pageSize);

  useEffect(() => {
    const ids = paginatedTransactions.map((t) => t.id);
    if (ids.length === 0) {
      setOpenPartCounts(new Map());
      return;
    }
    let alive = true;
    fetchOpenPartCounts(ids)
      .then((m) => {
        if (alive) setOpenPartCounts(m);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  return {
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
  };
}
