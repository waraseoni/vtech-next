// ─── Sprint 3 #12: jobs list data layer ─────────────────────────────────────
// page.tsx se nikala hua list state + fetch machinery. Behavior 1:1 same hai —
// sirf ghar badla hai. UI state (selection, modals, dropdown, fab, WA,
// mobileView, sysInfo, userRole, stale alerts) page me hi rehta hai.
//
// Phase 4 P2: saari DB-query logic ab ./jobListQueries.ts (neutral) me hai —
// wahi module RSC server-jobs.ts bhi use karta hai. Yahin sirf UI state,
// debounce, URL-sync, localStorage aur (client-only!) in-flight dedupe rehta
// hai. RSC seed (initial) mile to mount-par fetch skip — waterfall khatam.
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchOpenPartCounts } from "@/lib/requiredParts";
import { logger } from "@/lib/logger";
import {
  computeJobStats,
  enrichJobRows,
  queryJobPage,
  queryJobSpots,
  queryStatusChangeLogs,
  searchClientsForTerm,
  seedMatchesFilters,
  type JobListStats,
  type JobSpot,
  type JobsListSeed,
  type Transaction,
} from "./jobListQueries";

export type { Transaction, JobListStats, JobSpot };

// fetchStatusChangeLogs — page/panels ke liye browser-client-bound wrapper
// (dual-era reader — docs/DATA_MIGRATION_NOTES.md; query jobListQueries me).
export const fetchStatusChangeLogs = (
  era: "legacy" | "modern",
  ids: string[]
): Promise<Array<{ meta_id: string; date_created: string }>> =>
  queryStatusChangeLogs(supabase, era, ids);

// PERF (lightning B2): fetchStats + fetchPage dono same debounced term par
// lagbhag ek saath client-search chalate the (= duplicate query). In-flight
// dedupe — dusra caller same promise share karta hai, settle par entry hat
// jati hai (stale cache NAHI — har naye term par fresh query).
// NOTE: ye map CLIENT-only hai (per-browser-session); server par per-request
// closure banao (cross-user cache = RLS leak).
const searchClientsInflight = new Map<string, Promise<string>>();

export function useJobList(initial?: JobsListSeed | null) {
  const searchParams = useSearchParams();

  // URL-driven state
  const urlDateFrom = searchParams.get("date_from") || "";
  const urlDateTo = searchParams.get("date_to") || "";
  const urlHideDelivered = searchParams.get("hide_delivered") === "1";

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

  // Debounced search — lazy init = localSearch: URL ?search= deep-link par
  // pehla fetch TURANT term ke saath (300ms flip ki wajah se duplicate refetch nahi).
  const [debouncedSearch, setDebouncedSearch] = useState(localSearch);

  // ── RSC seed (Phase 4 P2) ────────────────────────────────────────────────
  // Server ke filter-snapshot aur mount-time client filters match karein tabhi
  // seed use hota hai; warna (localStorage hide_delivered mismatch) drop karke
  // aaj jaisa client fetch chalega.
  const seed: JobsListSeed | null =
    initial &&
    seedMatchesFilters(initial.filterInputs, {
      search: localSearch,
      dateFrom: urlDateFrom,
      dateTo: urlDateTo,
      hideDelivered,
      status: statusFilter,
      spot: spotFilter,
    })
      ? initial
      : null;

  // Data (seed se initialize — pehla render hi final data)
  const [transactions, setTransactions] = useState<Transaction[]>(seed?.transactions ?? []);
  const [openPartCounts, setOpenPartCounts] = useState<Map<number, number>>(new Map());
  const [totalRows, setTotalRows] = useState(seed?.totalRows ?? 0);
  const [stats, setStats] = useState<JobListStats>(
    seed?.stats ?? { total: 0, pending: 0, progress: 0, completed: 0, totalAmt: 0 }
  );
  const [jobSpots, setJobSpots] = useState<JobSpot[]>(seed?.jobSpots ?? []);
  const [loading, setLoading] = useState(seed === null);
  const [hasLoaded, setHasLoaded] = useState(seed !== null);
  // Mount par in effects ko EK baar skip karna hai (seed consume) — refs
  // first-render value lete hain, baad me seed change ka asar nahi.
  const skipStatsFetch = useRef(seed !== null);
  const skipPageFetch = useRef(seed !== null);
  const skipSpotsFetch = useRef(seed !== null);

  // Pagination
  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);

  // Debounced search
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
    setJobSpots(await queryJobSpots(supabase));
  }, []);
  useEffect(() => {
    if (skipSpotsFetch.current) {
      skipSpotsFetch.current = false;
      return;
    }
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

  // ── Client search (Step 1: foreign key filtering) — deduped wrapper ──────
  const searchClients = useCallback(async (term: string) => {
    if (!term) return "";
    const inflight = searchClientsInflight.get(term);
    if (inflight) return inflight;
    const p = searchClientsForTerm(supabase, term);
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
      const s = await computeJobStats(
        supabase,
        {
          term: debouncedSearch.trim().toLowerCase(),
          dateFrom,
          dateTo,
          hideDelivered,
          status: statusFilter,
          spot: spotFilter,
        },
        searchClients
      );
      setStats(s);
    } catch (err) {
      logger.error("fetchStats error:", err);
    }
  }, [dateFrom, dateTo, hideDelivered, statusFilter, spotFilter, debouncedSearch, searchClients]);

  // ── Page rows (filter + pagination dependent) ─────────────────────────────
  const fetchPage = useCallback(async () => {
    try {
      setLoading(true);

      const { rows, count } = await queryJobPage(
        supabase,
        {
          term: debouncedSearch.trim().toLowerCase(),
          dateFrom,
          dateTo,
          hideDelivered,
          status: statusFilter,
          spot: spotFilter,
        },
        pageIndex,
        pageSize,
        searchClients
      );

      setTotalRows(count);

      if (!rows.length) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      setTransactions(await enrichJobRows(supabase, rows));
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
    if (skipStatsFetch.current) {
      skipStatsFetch.current = false;
      return;
    }
    fetchStats();
  }, [fetchStats]);
  useEffect(() => {
    if (skipPageFetch.current) {
      skipPageFetch.current = false;
      return;
    }
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
