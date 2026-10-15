// ─── Jobs list query layer — SINGLE source of filter semantics ─────────────
// Phase 4 P2 (docs/plans/rsc_phase4_plan.md): ye logic pehle sirf useJobList
// (client) me tha. Ab DONO taraf yahin se chalta hai:
//   • useJobList.ts        — client (browser supabase + writeGuard proxy)
//   • lib/server-jobs.ts   — RSC first-paint (cookie+RLS server client)
// Drift = silent data bug (hsn-lesson) — koi bhi filter/query change YAHIN karo.
//
// ZERO server-only imports (next/server / api-auth BANNED) + ZERO browser APIs
// — neutral module dono runtimes me safe.
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDueMaps } from "@/lib/client-due";

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

/** Ek filter-snapshot — server seed + client state ka match-check isi se. */
export interface JobListFilters {
  term: string; // lowercased/debounced search ("" = none)
  dateFrom: string; // YYYY-MM-DD ("" = none)
  dateTo: string;
  hideDelivered: boolean;
  status: number | "";
  spot: string; // locations.id string ("" = none)
}

/** RAW filter inputs (URL-shape) — seed snapshot + client lazy-init isi se compare. */
export interface JobListFilterInputs {
  search: string; // raw (lowercase/trim term me badalne se PEHLE)
  dateFrom: string;
  dateTo: string;
  hideDelivered: boolean;
  status: number | "";
  spot: string;
}

/** RSC seed — list state jo server first-paint par bhejta hai. */
export interface JobsListSeed {
  filterInputs: JobListFilterInputs; // exact snapshot jo server ne queries me use kiya
  transactions: Transaction[];
  totalRows: number;
  stats: JobListStats;
  jobSpots: JobSpot[];
}

/** Page-level extras (JobsBody) — list seed ke saath. */
export interface JobsPageSeed extends JobsListSeed {
  sysInfo: Record<string, string>;
  mechNames: Record<number, string>;
  userRole: string;
}

/**
 * Server seed tabhi valid hai jab CLIENT ke mount-time filters usse match
 * karein. Mismatch (e.g. localStorage `jobs_hide_delivered=1` jo URL me nahi)
 * par seed DROP → client waise bhi apna fetch karega (aaj ka behaviour).
 */
export function seedMatchesFilters(
  seed: JobListFilterInputs,
  current: JobListFilterInputs
): boolean {
  return (
    seed.search === current.search &&
    seed.dateFrom === current.dateFrom &&
    seed.dateTo === current.dateTo &&
    seed.hideDelivered === current.hideDelivered &&
    seed.status === current.status &&
    seed.spot === current.spot
  );
}

/** Raw row jo queryJobPage deta hai — enrich ke baad full Transaction banta hai. */
export type RawTxnRow = Record<string, unknown> & { id: number };

// ── DUAL-ERA status-log reader — docs/DATA_MIGRATION_NOTES.md zaroor padho ──
// PHP yug ke logs aur naye Next.js ke logs activity_logs me ALAG conventions
// me rehte hain, isliye dono ko unke apne rules se query karna padta hai:
//   legacy (PHP):  module='Transactions', action='Transaction Status Changed',
//                  meta_id = transaction_list.id (internal PK)
//   modern (Next): module='Jobs', action='Updated Job Status',
//                  meta_id = job_id string ("28201" jaisa)
// Desc order aata hai → pehla hit per key hi latest hai. Naya code hamesha
// canonical transaction_list.id se log kare (writers), readers dono dekhein.
export async function queryStatusChangeLogs(
  supabase: SupabaseClient,
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

/** Step-1: search term se matching client ids (CSV) — "" no term, "-1" no match. */
export async function searchClientsForTerm(
  supabase: SupabaseClient,
  term: string
): Promise<string> {
  if (!term) return "";
  const { data: matchedClients } = await supabase
    .from("client_list")
    .select("id")
    .or(
      `firstname.ilike.%${term}%,middlename.ilike.%${term}%,lastname.ilike.%${term}%,contact.ilike.%${term}%`
    );
  return matchedClients?.map((c: { id: number }) => c.id).join(",") || "-1";
}

type ClientIdsResolver = (term: string) => Promise<string>;
const defaultResolver =
  (supabase: SupabaseClient): ClientIdsResolver =>
  (term) =>
    searchClientsForTerm(supabase, term);

function applyFilters(
  supabase: SupabaseClient,
  filters: JobListFilters,
  matchedClientIds: string,
  withCount: boolean,
  rangeFrom: number,
  rangeTo: number
) {
  let q = supabase
    .from("transaction_list")
    .select("status, amount", withCount ? { count: "exact" } : undefined)
    .eq("del_status", 0)
    .range(rangeFrom, rangeTo);
  if (filters.dateFrom) q = q.gte("date_created", `${filters.dateFrom}T00:00:00+05:30`);
  if (filters.dateTo) q = q.lte("date_created", `${filters.dateTo}T23:59:59+05:30`);
  if (filters.hideDelivered) q = q.neq("status", 5);
  if (filters.status !== "") q = q.eq("status", filters.status);
  if (filters.spot) q = q.eq("location_id", parseInt(filters.spot));
  if (filters.term)
    q = q.or(
      `job_id.ilike.%${filters.term}%,code.ilike.%${filters.term}%,item.ilike.%${filters.term}%,fault.ilike.%${filters.term}%,uniq_id.ilike.%${filters.term}%,remark.ilike.%${filters.term}%,client_name.in.(${matchedClientIds})`
    );
  return q;
}

/**
 * Exact stats over ALL filtered rows (chunked, N+1 queries — head chunk carries
 * the count). Filter-dependent only; pagination se independent.
 */
export async function computeJobStats(
  supabase: SupabaseClient,
  filters: JobListFilters,
  resolveClients: ClientIdsResolver = defaultResolver(supabase)
): Promise<JobListStats> {
  const term = filters.term;
  const matchedClientIds = await resolveClients(term);

  // Chunk 0 carries the exact total (same filters as the scan) — removes a
  // standalone full-table `count: exact` head round-trip (N+1 → N queries).
  // Baki chunks parallel. Results/behaviour unchanged.
  const buildStatsQuery = (rangeFrom: number, rangeTo: number, withCount = false) =>
    applyFilters(supabase, filters, matchedClientIds, withCount, rangeFrom, rangeTo);

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

  return { total, pending, progress, completed, totalAmt };
}

/** Filtered rows ka ek page (job_id desc — newest first) + exact total count. */
export async function queryJobPage(
  supabase: SupabaseClient,
  filters: JobListFilters,
  pageIndex: number,
  pageSize: number,
  resolveClients: ClientIdsResolver = defaultResolver(supabase)
): Promise<{ rows: RawTxnRow[]; count: number }> {
  const term = filters.term;
  const matchedClientIds = await resolveClients(term);

  let query = supabase.from("transaction_list").select("*", { count: "exact" }).eq("del_status", 0);
  if (filters.dateFrom) query = query.gte("date_created", `${filters.dateFrom}T00:00:00+05:30`);
  if (filters.dateTo) query = query.lte("date_created", `${filters.dateTo}T23:59:59+05:30`);
  if (filters.hideDelivered) query = query.neq("status", 5);
  if (filters.status !== "") query = query.eq("status", filters.status);
  if (filters.spot) query = query.eq("location_id", parseInt(filters.spot));
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
  return { rows: (pageRes.data || []) as RawTxnRow[], count: pageRes.count || 0 };
}

/**
 * Page rows → display-ready Transaction (client profile + due-maps + verified
 * status-change timestamps). Sirf current page ke clients par bulk queries.
 */
export async function enrichJobRows(
  supabase: SupabaseClient,
  pageTxns: RawTxnRow[]
): Promise<Transaction[]> {
  if (!pageTxns.length) return [];

  // Step 3: Fetch related data ONLY for the current page's clients (Extremely fast!)
  const clientIdsNum = [...new Set(pageTxns.map((t) => Number(t.client_name)))];
  const clientIdsStr = clientIdsNum.map(String);

  // Status-change timestamps — dono yug parallel query
  const logPromise = Promise.all([
    queryStatusChangeLogs(
      supabase,
      "legacy",
      pageTxns.map((t) => String(t.id))
    ),
    queryStatusChangeLogs(supabase, "modern", [
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
    supabase.from("direct_sales").select("client_id, total_amount").in("client_id", clientIdsNum),
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
  const clientMap = new Map(
    (clientsRes.data || []).map((c: { id: number }) => [c.id, c as Record<string, unknown>])
  );

  return pageTxns.map((txn) => {
    const cid = Number(txn.client_name);
    const client = clientMap.get(cid);
    // Status-date sirf VERIFIED sources se: Delivered → date_completed,
    // warna activity_logs ki last status-change entry (legacy key = txn id,
    // modern key = job_id — dono try karo). date_updated fallback NAHI:
    // sync/migration rows ko bulk touch kar deta hai (jhoothi aaj ki date).
    const statusDate =
      txn.status === 5 && txn.date_completed
        ? txn.date_completed
        : statusChangeMap.get(String(txn.id)) || statusChangeMap.get(String(txn.job_id)) || null;
    return {
      ...txn,
      client_firstname: (client?.firstname as string) || "",
      client_middlename: (client?.middlename as string) || "",
      client_lastname: (client?.lastname as string) || "",
      client_contact: (client?.contact as string) || "",
      client_image: (client?.image_path as string) || undefined,
      client_opening_balance: (client?.opening_balance as number) || 0,
      total_billed: m.repairBilled[cid] || 0,
      total_paid: m.servicePaid[cid] || 0,
      total_sale: m.directSalesBilled[cid] || 0,
      loan_due: (m.activeLoanGiven[cid] || 0) - (m.loanRepaid[cid] || 0),
      status_changed_at: statusDate,
    } as Transaction;
  });
}

/** Job spots (kind='job' locations) + live occupancy counts. */
export async function queryJobSpots(supabase: SupabaseClient): Promise<JobSpot[]> {
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
  (occRes.data || []).forEach((r: { location_id: number }) => {
    const lid = r.location_id;
    c[lid] = (c[lid] || 0) + 1;
  });
  return (locRes.data || [])
    .map((l: { id: number; rack: string | null }) => ({
      id: l.id,
      name: l.rack || "",
      count: c[l.id] || 0,
    }))
    .sort((a, b) => a.count - b.count || a.name.localeCompare(b.name));
}
