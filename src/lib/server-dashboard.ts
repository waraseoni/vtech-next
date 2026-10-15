import { getServerSupabase } from "@/lib/api-auth";
import { pageAll } from "@/lib/fetch-all";
import { todayIST, startOfMonthIST, endOfMonthIST } from "@/lib/dateUtils";
import { fetchStockByProducts, type StockRow } from "@/lib/inventoryStock";
import { fetchWaitingSummary, type WaitingSummary } from "@/lib/requiredParts";
import { logger } from "@/lib/logger";
import {
  STATUS_META,
  type DashboardInitialData,
  type LowStockItem,
  type Profile,
  type RecentJob,
  type RecentPayment,
  type RevenuePoint,
  type Stat,
  type StatusPoint,
} from "@/lib/dashboard-shared";

/**
 * Dashboard first-paint data layer (Phase 4 P1 — docs/plans/rsc_phase4_plan.md).
 *
 * Ye poora logic pehle `DashboardBody` ke mount-`useEffect` me chalta tha
 * (hydration → 5-6 sequential batches → setState = waterfall). Ab render-time
 * par server par chalta hai AUR sab ek saath (`Promise.all`), phir body ko
 * props milte hain — first HTML me hi numbers.
 *
 * G3 gate rule: service-role NEVER for page reads. Cookie+RLS server client
 * (`getServerSupabase`) use hota hai — bilkul wahi queries/behaviour jo
 * browser client page par karta tha (RPC fast-path + legacy fallbacks samet).
 * `product_locations` ka direct read `is_frontend_staff()` RLS policy se
 * allowed hai (migration 20260912_rls_location_tables.sql verified) —
 * `/api/locations` service-role route ki zaroorat nahi.
 */

type Sb = Awaited<ReturnType<typeof getServerSupabase>>;

type TxnRow = { amount: number };
type DirectSaleRow = { total_amount: number };

const toNum = (v: unknown): number => {
  const x = Number(v);
  return Number.isNaN(x) ? 0 : x;
};

const STATS_EMPTY: Stat = {
  totalJobs: 0,
  totalClients: 0,
  pendingJobs: 0,
  inProgressJobs: 0,
  finishedJobs: 0,
  deliveredJobs: 0,
  totalMechanics: 0,
  lowStock: 0,
  todayRevenue: 0,
};

const WAITING_EMPTY: WaitingSummary = {
  waitingJobs: 0,
  waitingParts: 0,
  orderedCount: 0,
  waitingCount: 0,
  oldestDays: 0,
  oldestJobId: null,
};

export type FetchDashboardOptions = {
  userId: string;
  /** requireStaffWithRole() se — duplicate role round-trip avoid. */
  userRole: string;
  /** Auth fallback (profile row missing) — wahi chain jo pehle client par thi. */
  userFullName?: string | null;
  userEmail?: string | null;
};

// ── profile ──────────────────────────────────────────────────────────────────
async function fetchProfile(supabase: Sb, opts: FetchDashboardOptions): Promise<Profile> {
  const fallbackName = opts.userFullName || opts.userEmail?.split("@")[0] || "User";
  try {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", opts.userId)
      .single();
    if (data) {
      return {
        full_name: data.full_name ?? "User",
        role: data.role ?? opts.userRole,
      };
    }
  } catch (e) {
    logger.warn("Dashboard profile fetch failed — auth fallback:", e);
  }
  return { full_name: fallbackName, role: opts.userRole };
}

// ── stats + status donut ─────────────────────────────────────────────────────
async function fetchStatsBatch(supabase: Sb): Promise<{ stats: Stat; statusData: StatusPoint[] }> {
  // BUG FIX 2 (original): todayIST() — IST-day boundaries +05:30.
  const today = todayIST();
  const startToday = `${today}T00:00:00+05:30`;
  const endToday = `${today}T23:59:59+05:30`;

  // RPC fast path (3 RPC replace 40+ queries) — fallback agar RPC exist nahi.
  try {
    const { data, error } = await supabase.rpc("get_dashboard_stats", {
      p_today_start: startToday,
      p_today_end: endToday,
    });
    const sd = (data ?? {}) as Record<string, number>;
    if (!error && (sd.totalJobs || sd.totalJobs === 0)) {
      const keys = [
        "pendingJobs",
        "inProgressJobs",
        "finishedJobs",
        "paidJobs",
        "cancelledJobs",
        "deliveredJobs",
      ];
      return {
        stats: {
          totalJobs: sd.totalJobs || 0,
          totalClients: sd.totalClients || 0,
          totalMechanics: sd.totalMechanics || 0,
          lowStock: 0,
          todayRevenue: (sd.todayRepair || 0) + (sd.todayDirect || 0),
          pendingJobs: sd.pendingJobs || 0,
          inProgressJobs: sd.inProgressJobs || 0,
          finishedJobs: sd.finishedJobs || 0,
          deliveredJobs: sd.deliveredJobs || 0,
        },
        statusData: STATUS_META.map((m, i) => ({
          name: m.label,
          color: m.color,
          value: sd[keys[i]] || 0,
        })).filter((d) => d.value > 0),
      };
    }
    logger.warn("Dashboard stats RPC failed — legacy count fallback:", error?.message);
  } catch (e) {
    logger.warn("Dashboard stats RPC threw — legacy count fallback:", e);
  }

  // Fallback: original client-side counts (sab ek saath — lightning B1).
  const [
    { count: totalJobsCount },
    { count: pendingCount },
    { count: inProgressCount },
    { count: finishedCount },
    { count: paidCount },
    { count: cancelledCount },
    { count: deliveredCount },
    { count: clientCount },
    { count: mechCount },
    { data: todayRepairRes },
    { data: todayDirectRes },
  ] = await Promise.all([
    supabase
      .from("transaction_list")
      .select("*", { count: "exact", head: true })
      .eq("del_status", 0),
    supabase
      .from("transaction_list")
      .select("*", { count: "exact", head: true })
      .eq("del_status", 0)
      .eq("status", 0),
    supabase
      .from("transaction_list")
      .select("*", { count: "exact", head: true })
      .eq("del_status", 0)
      .eq("status", 1),
    supabase
      .from("transaction_list")
      .select("*", { count: "exact", head: true })
      .eq("del_status", 0)
      .eq("status", 2),
    supabase
      .from("transaction_list")
      .select("*", { count: "exact", head: true })
      .eq("del_status", 0)
      .eq("status", 3),
    supabase
      .from("transaction_list")
      .select("*", { count: "exact", head: true })
      .eq("del_status", 0)
      .eq("status", 4),
    supabase
      .from("transaction_list")
      .select("*", { count: "exact", head: true })
      .eq("del_status", 0)
      .eq("status", 5),
    supabase.from("client_list").select("*", { count: "exact", head: true }).eq("delete_flag", 0),
    supabase
      .from("mechanic_list")
      .select("*", { count: "exact", head: true })
      .eq("delete_flag", 0)
      .eq("status", 1),
    supabase
      .from("transaction_list")
      .select("amount")
      .eq("status", 5)
      .eq("del_status", 0)
      .gte("date_completed", startToday)
      .lte("date_completed", endToday),
    supabase
      .from("direct_sales")
      .select("total_amount")
      .gte("date_created", startToday)
      .lte("date_created", endToday),
  ]);
  const todayR = (todayRepairRes || []).reduce((s: number, r: TxnRow) => s + toNum(r.amount), 0);
  const todayD = (todayDirectRes || []).reduce(
    (s: number, r: DirectSaleRow) => s + toNum(r.total_amount),
    0
  );
  const vals = [
    pendingCount,
    inProgressCount,
    finishedCount,
    paidCount,
    cancelledCount,
    deliveredCount,
  ];
  return {
    stats: {
      totalJobs: totalJobsCount || 0,
      totalClients: clientCount ?? 0,
      totalMechanics: mechCount ?? 0,
      lowStock: 0,
      todayRevenue: todayR + todayD,
      pendingJobs: pendingCount || 0,
      inProgressJobs: inProgressCount || 0,
      finishedJobs: finishedCount || 0,
      deliveredJobs: deliveredCount || 0,
    },
    statusData: STATUS_META.map((m, i) => ({
      name: m.label,
      color: m.color,
      value: vals[i] || 0,
    })).filter((d) => d.value > 0),
  };
}

// ── 12-month revenue chart ───────────────────────────────────────────────────
async function fetchRevenueBatch(supabase: Sb): Promise<RevenuePoint[]> {
  try {
    const { data, error } = await supabase.rpc("get_monthly_revenue", { p_months: 12 });
    if (!error && Array.isArray(data) && data.length > 0) return data as RevenuePoint[];
    if (error) logger.warn("Dashboard revenue RPC failed — fallback loop:", error.message);
  } catch (e) {
    logger.warn("Dashboard revenue RPC threw — fallback loop:", e);
  }

  // Fallback: 12 mahine × 2 queries sab ek saath (lightning B1 — pehle serial tha).
  const monthRanges = Array.from({ length: 12 }, (_, k) => {
    const md = new Date();
    md.setDate(1);
    md.setMonth(md.getMonth() - (11 - k));
    return {
      md,
      start: `${startOfMonthIST(md)}T00:00:00+05:30`,
      end: `${endOfMonthIST(md)}T23:59:59+05:30`,
    };
  });
  const monthPairs = await Promise.all(
    monthRanges.map(({ start, end }) =>
      Promise.all([
        pageAll(
          supabase
            .from("transaction_list")
            .select("amount")
            .eq("status", 5)
            .eq("del_status", 0)
            .gte("date_completed", start)
            .lte("date_completed", end)
        ),
        pageAll(
          supabase
            .from("direct_sales")
            .select("total_amount")
            .gte("date_created", start)
            .lte("date_created", end)
        ),
      ])
    )
  );
  return monthPairs.map(([{ data: repMonth }, { data: dirMonth }], k) => ({
    month: monthRanges[k].md.toLocaleString("default", { month: "short", year: "2-digit" }),
    revenue:
      (repMonth || []).reduce((s: number, r: TxnRow) => s + toNum(r.amount), 0) +
      (dirMonth || []).reduce((s: number, r: DirectSaleRow) => s + toNum(r.total_amount), 0),
  }));
}

// ── low-stock places (product_locations — is_frontend_staff RLS pass) ────────
async function fetchPlaces(supabase: Sb, ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (!ids.length) return out;
  try {
    const { data, error } = await supabase
      .from("product_locations")
      .select("product_id, locations!inner(zone, rack, bin, box)")
      .in("product_id", ids);
    if (error) throw error;
    for (const row of (data || []) as {
      product_id: number;
      locations:
        | { zone?: string | null; rack?: string | null; bin?: string | null; box?: string | null }
        | Array<{
            zone?: string | null;
            rack?: string | null;
            bin?: string | null;
            box?: string | null;
          }>;
    }[]) {
      const pid = Number(row.product_id);
      if (out.has(pid)) continue; // pehla location hi — route API ke [{...}][0] jaisa
      const loc = Array.isArray(row.locations) ? row.locations[0] : row.locations;
      const parts = [loc?.zone, loc?.rack, loc?.bin, loc?.box].filter(Boolean);
      if (parts.length > 0) out.set(pid, parts.join(" ▸ "));
    }
  } catch (e) {
    logger.warn("Dashboard product locations fetch failed (place → —):", e);
  }
  return out;
}

// ── recents + low stock + waiting (widgets batch) ────────────────────────────
async function fetchWidgetsBatch(supabase: Sb): Promise<{
  recentJobs: RecentJob[];
  recentPayments: RecentPayment[];
  lowStockItems: LowStockItem[];
  lowStockCount: number;
}> {
  const [lpR, rjR, rpR] = await Promise.all([
    pageAll(
      supabase
        .from("product_list")
        .select("id, name, alert_quantity")
        .eq("delete_flag", 0)
        .gt("alert_quantity", 0)
    ),
    supabase
      .from("transaction_list")
      .select("id, job_id, client_name, item, amount, status")
      .eq("del_status", 0)
      .order("id", { ascending: false })
      .limit(5),
    supabase
      .from("client_payments")
      .select("id, amount, payment_mode, payment_date, client_id")
      .order("payment_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(10),
  ]);
  const lowProds = lpR.data as { id: number; name: string; alert_quantity: number }[] | null;
  const recentTransRaw = rjR.data as
    | {
        id: number;
        job_id: string | null;
        client_name: string;
        item: string;
        amount: number;
        status: number;
      }[]
    | null;
  const paymentsRaw = rpR.data as
    | {
        id: number;
        amount: number;
        payment_mode: string | null;
        payment_date: string;
        client_id: number | null;
      }[]
    | null;

  const cIds = recentTransRaw?.length
    ? [
        ...new Set(
          recentTransRaw.map((t) => parseInt(t.client_name)).filter((x: number) => !isNaN(x))
        ),
      ]
    : [];
  const cIds2 = paymentsRaw?.length
    ? [...new Set(paymentsRaw.map((p) => p.client_id).filter(Boolean))]
    : [];
  const lowProdIds = (lowProds || []).map((p) => p.id);

  // Independent chains — sab ek saath (lightning B1).
  const [stockM, clsJobs, clsPays, placeMap] = await Promise.all([
    fetchStockByProducts(lowProdIds, supabase).catch((e: unknown) => {
      // Stock RPC fail → low-stock card khaali + warn (recents bach rahe hain).
      logger.warn("Dashboard inventory stock fetch failed:", e);
      return new Map<number, StockRow>();
    }),
    cIds.length
      ? supabase.from("client_list").select("id, firstname, lastname").in("id", cIds)
      : Promise.resolve({ data: [] }),
    cIds2.length
      ? supabase.from("client_list").select("id, firstname, lastname").in("id", cIds2)
      : Promise.resolve({ data: [] }),
    fetchPlaces(supabase, lowProdIds),
  ]);

  let recentJobs: RecentJob[] = [];
  if (recentTransRaw?.length) {
    const cls = clsJobs.data as
      { id: number; firstname: string | null; lastname: string | null }[] | null;
    const cMap = Object.fromEntries(
      (cls ?? []).map((c) => [c.id, `${c.firstname ?? ""} ${c.lastname ?? ""}`.trim()])
    );
    recentJobs = recentTransRaw.map((t) => ({
      ...t,
      amount: toNum(t.amount),
      client_name: cMap[parseInt(t.client_name)] || "Walk-in",
    }));
  }

  let recentPayments: RecentPayment[] = [];
  if (paymentsRaw?.length) {
    const cls2 = clsPays.data as
      { id: number; firstname: string | null; lastname: string | null }[] | null;
    const cMap2 = Object.fromEntries(
      (cls2 ?? []).map((c) => [c.id, `${c.firstname ?? ""} ${c.lastname ?? ""}`.trim()])
    );
    recentPayments = paymentsRaw.map((p) => ({
      id: p.id,
      amount: toNum(p.amount),
      payment_mode: p.payment_mode ?? "Cash",
      payment_date: p.payment_date,
      client_name: cMap2[p.client_id as number] ?? "Unknown",
    }));
  }

  let lowStockItems: LowStockItem[] = [];
  let lowStockCount = 0;
  if ((lowProds || []).length) {
    const builtLow = (lowProds || [])
      .map((p) => ({
        name: p.name,
        quantity: stockM.get(p.id)?.available ?? 0,
        place: placeMap.get(p.id) || "—",
        alert: toNum(p.alert_quantity),
      }))
      .filter((x) => x.quantity < x.alert)
      .sort((a, b) => a.quantity - a.alert - (b.quantity - b.alert));
    lowStockCount = builtLow.length;
    lowStockItems = builtLow.slice(0, 12);
  }

  return { recentJobs, recentPayments, lowStockItems, lowStockCount };
}

// ── orchestrator ─────────────────────────────────────────────────────────────
export async function fetchDashboardInitialData(
  opts: FetchDashboardOptions
): Promise<DashboardInitialData> {
  const supabase = await getServerSupabase();

  // Paanch batches sab independent hain → ek saath (pehle client par
  // yahi sab waterfall tha; ab total = max(batch) naaki sum).
  const [profile, statsBatch, revenueData, widgets, waitingSummary] = await Promise.all([
    fetchProfile(supabase, opts),
    fetchStatsBatch(supabase).catch((e: unknown) => {
      logger.warn("Dashboard stats batch failed:", e);
      return { stats: STATS_EMPTY, statusData: [] as StatusPoint[] };
    }),
    fetchRevenueBatch(supabase).catch((e: unknown) => {
      logger.warn("Dashboard revenue batch failed:", e);
      return [] as RevenuePoint[];
    }),
    fetchWidgetsBatch(supabase).catch((e: unknown) => {
      logger.warn("Dashboard widgets batch failed:", e);
      return {
        recentJobs: [] as RecentJob[],
        recentPayments: [] as RecentPayment[],
        lowStockItems: [] as LowStockItem[],
        lowStockCount: 0,
      };
    }),
    fetchWaitingSummary(supabase)
      .then((s) => s)
      .catch((e: unknown) => {
        logger.warn("Dashboard waiting summary failed:", e);
        return WAITING_EMPTY;
      }),
  ]);

  return {
    profile,
    stats: { ...statsBatch.stats, lowStock: widgets.lowStockCount },
    statusData: statsBatch.statusData,
    revenueData,
    recentJobs: widgets.recentJobs,
    recentPayments: widgets.recentPayments,
    lowStockItems: widgets.lowStockItems,
    waitingSummary,
  };
}
