import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `/activity-logs` ka default view (All Modules, koi search/date filter nahi,
 * page 0, 25 per page) ka neutral server seed — client ke `fetchLogs` +
 * `/api/activity-users` name resolution ka read-only mirror.
 * Caller cookie+RLS client pass karta hai.
 *
 * Nuance: `/api/activity-users` `users` table service-role se padhta hai (RLS
 * authenticated par bhi band). Yahan sirf cookie+RLS client allowed hai, isliye
 * legacy PHP logs par `User <id>` fallback lag sakta hai. Filter/page change ya
 * "Searching..." refetch par client apna poora fetch (service route ke saath)
 * chala deta hai.
 */

export type ActivityLogEntry = {
  id: number;
  user_id: number;
  action: string;
  module: string;
  meta_id: string | null;
  details: string | null;
  date_created: string;
  geo_lat?: number | null;
  geo_lng?: number | null;
  geo_distance_m?: number | null;
  username?: string;
  user_image?: string | null;
};

export type ActivityLogsSeed = {
  moduleFilter: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  page: number;
  pageSize: number;
  logs: ActivityLogEntry[];
  totalCount: number;
};

// Same cutoff as the client: is se pehle ke logs PHP `users` table ids hain.
const LEGACY_CUTOFF_MS = new Date("2026-08-15T00:00:00.000Z").getTime();

export async function fetchActivityLogsSeed(
  supabase: SupabaseClient,
  moduleFilter = "all",
  dateFrom = "",
  dateTo = "",
  search = "",
  page = 0,
  pageSize = 25
): Promise<ActivityLogsSeed> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let countQuery = supabase.from("activity_logs").select("*", { count: "exact", head: true });

  let dataQuery = supabase
    .from("activity_logs")
    .select("*")
    .order("date_created", { ascending: false })
    .range(from, to);

  if (moduleFilter !== "all") {
    countQuery = countQuery.eq("module", moduleFilter);
    dataQuery = dataQuery.eq("module", moduleFilter);
  }
  if (dateFrom) {
    countQuery = countQuery.gte("date_created", `${dateFrom}T00:00:00+05:30`);
    dataQuery = dataQuery.gte("date_created", `${dateFrom}T00:00:00+05:30`);
  }
  if (dateTo) {
    countQuery = countQuery.lte("date_created", `${dateTo}T23:59:59+05:30`);
    dataQuery = dataQuery.lte("date_created", `${dateTo}T23:59:59+05:30`);
  }
  if (search) {
    countQuery = countQuery.or(`action.ilike.%${search}%,details.ilike.%${search}%`);
    dataQuery = dataQuery.or(`action.ilike.%${search}%,details.ilike.%${search}%`);
  }

  const [countRes, dataRes] = await Promise.all([countQuery, dataQuery]);
  if (countRes.error) throw countRes.error;
  if (dataRes.error) throw dataRes.error;

  const count = countRes.count ?? 0;
  const data = dataRes.data || [];

  const mechIds = [...new Set(data.map((l) => l.user_id as number).filter((id) => id > 0))];
  const usersMap: Record<string, string> = {};
  const mechsMap = new Map<number, { name: string; image: string | null }>();

  if (mechIds.length > 0) {
    // Legacy PHP ids → `users` table (RLS ke wajah se khaali aa sakta hai).
    const [{ data: uRows }, { data: mRows }] = await Promise.all([
      supabase.from("users").select("id, firstname, lastname").in("id", mechIds),
      supabase
        .from("mechanic_list")
        .select("id, firstname, middlename, lastname, image_path")
        .in("id", mechIds),
    ]);

    (uRows || []).forEach((u) => {
      usersMap[String(u.id)] =
        [u.firstname, u.lastname].filter(Boolean).join(" ") || `User ${u.id}`;
    });
    (mRows || []).forEach((m) => {
      mechsMap.set(m.id as number, {
        name: [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ") || `User ${m.id}`,
        image: (m.image_path as string) || null,
      });
    });

    // `/api/activity-users` ka profiles fallback — users/mechanic_list me na mile.
    const unresolved = mechIds.filter((id) => !usersMap[String(id)] && !mechsMap.has(id));
    if (unresolved.length > 0) {
      const { data: pRows } = await supabase
        .from("profiles")
        .select("full_name, mechanic_id")
        .in("mechanic_id", unresolved);
      (pRows || []).forEach((p) => {
        if (p.full_name && p.mechanic_id) usersMap[String(p.mechanic_id)] = p.full_name;
      });
    }
  }

  const logs: ActivityLogEntry[] = data.map((l) => {
    const id = String(l.user_id);
    const isLegacy = new Date(l.date_created).getTime() < LEGACY_CUTOFF_MS;
    let username: string;
    if (l.user_id === 0) username = "Admin";
    else if (isLegacy) username = usersMap[id] || `User ${id}`;
    else username = mechsMap.get(l.user_id)?.name || `User ${id}`;
    // Legacy PHP `users` rows have no mechanic photo.
    const image = !isLegacy && l.user_id !== 0 ? mechsMap.get(l.user_id)?.image || null : null;
    return { ...l, username, user_image: image } as ActivityLogEntry;
  });

  return {
    moduleFilter,
    dateFrom,
    dateTo,
    search,
    page,
    pageSize,
    logs,
    totalCount: count,
  };
}
