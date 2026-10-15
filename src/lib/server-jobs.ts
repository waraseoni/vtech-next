import { getServerSupabase } from "@/lib/api-auth";
import {
  computeJobStats,
  enrichJobRows,
  queryJobPage,
  queryJobSpots,
  searchClientsForTerm,
  type JobsPageSeed,
} from "@/app/jobs/jobListQueries";
import { logger } from "@/lib/logger";

/**
 * Jobs list first-paint data layer (Phase 4 P2 — docs/plans/rsc_phase4_plan.md).
 *
 * Query semantics 100% shared hai `src/app/jobs/jobListQueries.ts` se (client
 * hook useJobList bhi wahi use karta hai) — drift impossible. G3 gate rule:
 * service-role NEVER for page reads — cookie+RLS server client.
 *
 * `hide_delivered` ka localStorage fallback SERVER ko nahi dikhta (URL se hi
 * padha jata hai) — client mount par filter-snapshot match karta hai, mismatch
 * par seed drop karke apna fetch chalta hai (aaj ka behaviour, no regression).
 */

type Sb = Awaited<ReturnType<typeof getServerSupabase>>;

/** useJobList ka default pageSize — server bhi wahi first page bhejta hai. */
const PAGE_SIZE = 25;

export type JobsSearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? "") : v || "";

export async function fetchJobsPageData(
  sp: JobsSearchParams,
  opts: { userRole: string }
): Promise<JobsPageSeed | null> {
  const supabase: Sb = await getServerSupabase();

  const rawSpot = first(sp.spot);
  const filterInputs = {
    search: first(sp.search),
    dateFrom: first(sp.date_from),
    dateTo: first(sp.date_to),
    hideDelivered: first(sp.hide_delivered) === "1",
    // Client ka statusFilter mount par hamesha "" hai (URL-sync nahi hota) —
    // snapshot bhi wahi.
    status: "" as const,
    spot: rawSpot && /^\d+$/.test(rawSpot) ? rawSpot : "",
  };
  const filters = {
    term: filterInputs.search.trim().toLowerCase(),
    dateFrom: filterInputs.dateFrom,
    dateTo: filterInputs.dateTo,
    hideDelivered: filterInputs.hideDelivered,
    status: filterInputs.status as number | "",
    spot: filterInputs.spot,
  };

  // searchClients in-flight dedupe — per-request CLOSURE (module-level map
  // server par cross-user RLS leak ho sakta hai — client-only concept).
  let clientsP: Promise<string> | null = null;
  const resolveClients = (term: string): Promise<string> => {
    if (!term) return Promise.resolve("");
    if (!clientsP) clientsP = searchClientsForTerm(supabase, term);
    return clientsP;
  };

  const listP = (async () => {
    try {
      const [{ rows, count }, stats] = await Promise.all([
        queryJobPage(supabase, filters, 0, PAGE_SIZE, resolveClients),
        computeJobStats(supabase, filters, resolveClients),
      ]);
      const transactions = await enrichJobRows(supabase, rows);
      return { transactions, totalRows: count, stats };
    } catch (e) {
      logger.warn("Jobs initial list fetch failed — body client-fetch karega:", e);
      return null;
    }
  })();

  const spotsP = (async () => {
    try {
      return await queryJobSpots(supabase);
    } catch (e) {
      logger.warn("Jobs spots fetch failed:", e);
      return [];
    }
  })();

  const sysInfoP = (async (): Promise<Record<string, string>> => {
    try {
      const { data } = await supabase.from("system_info").select("meta_field, meta_value");
      const info: Record<string, string> = {};
      (data || []).forEach((r: { meta_field: string; meta_value: string | null }) => {
        info[r.meta_field] = r.meta_value ?? "";
      });
      return info;
    } catch (e) {
      logger.warn("Jobs sysInfo fetch failed:", e);
      return {};
    }
  })();

  const mechP = (async (): Promise<Record<number, string>> => {
    try {
      const { data } = await supabase
        .from("mechanic_list")
        .select("id, firstname, middlename, lastname");
      const m: Record<number, string> = {};
      (data || []).forEach(
        (r: {
          id: number;
          firstname: string | null;
          middlename: string | null;
          lastname: string | null;
        }) => {
          m[r.id] = [r.firstname, r.middlename, r.lastname].filter(Boolean).join(" ").trim();
        }
      );
      return m;
    } catch (e) {
      logger.warn("Jobs mechanic names fetch failed:", e);
      return {};
    }
  })();

  const [list, jobSpots, sysInfo, mechNames] = await Promise.all([listP, spotsP, sysInfoP, mechP]);

  // List batch fail → seed absent (null) = client aaj jaisa khud fetch karega.
  if (!list) return null;

  return {
    filterInputs,
    transactions: list.transactions,
    totalRows: list.totalRows,
    stats: list.stats,
    jobSpots,
    sysInfo,
    mechNames,
    userRole: opts.userRole,
  };
}
