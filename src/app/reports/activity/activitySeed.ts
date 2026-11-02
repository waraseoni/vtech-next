import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `/reports/activity` (default view: All Modules, no search) ka neutral server
 * seed — client ke fetchLogs + `/api/activity-users` name resolution ka
 * read-only mirror.
 *
 * Nuance: `/api/activity-users` service-role se `users` table padhta hai
 * (RLS ne authenticated par bhi band hai). Yahan sirf cookie+RLS client
 * allowed hai, isliye `users` read khaali aa sakta hai → legacy PHP logs par
 * client jaisa hi `User <id>` fallback lagta hai. Refresh button client ka
 * pura fetch (service route ke saath) chala deta hai.
 */

export type ActivityLogEntry = {
  id: number;
  user_id: number | string;
  action: string;
  module: string;
  meta_id: string;
  details: string;
  date_created: string;
  geo_lat?: number | null;
  geo_lng?: number | null;
  geo_distance_m?: number | null;
  profiles?: {
    full_name: string;
  };
};

export type ActivitySeed = { logs: ActivityLogEntry[]; modules: string[] };

// Same cutoff as the page: is se pehle ke logs PHP `users` ids hain.
const LEGACY_CUTOFF_MS = new Date("2026-08-15T00:00:00.000Z").getTime();

type LogRow = {
  id: number;
  user_id: number | string | null;
  action: string | null;
  module: string | null;
  meta_id: string | null;
  details: string | null;
  date_created: string;
  geo_lat?: number | null;
  geo_lng?: number | null;
  geo_distance_m?: number | null;
};

export async function fetchActivitySeed(
  supabase: SupabaseClient,
  moduleFilter = "all",
  searchTerm = ""
): Promise<ActivitySeed> {
  let query = supabase
    .from("activity_logs")
    .select("*")
    .order("date_created", { ascending: false });

  if (moduleFilter !== "all") query = query.eq("module", moduleFilter);
  if (searchTerm) {
    query = query.or(
      `action.ilike.%${searchTerm}%,details.ilike.%${searchTerm}%,module.ilike.%${searchTerm}%`
    );
  }

  const { data, error } = await query.limit(100);
  if (error) throw new Error(error.message);

  const rows = (data || []) as LogRow[];
  const userIds = Array.from(new Set(rows.map((l) => Number(l.user_id)).filter((n) => n > 0)));

  const usersMap: Record<string, string> = {};
  const mechanicsMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const [{ data: uRows }, { data: mRows }] = await Promise.all([
      supabase.from("users").select("id, firstname, lastname").in("id", userIds),
      supabase
        .from("mechanic_list")
        .select("id, firstname, middlename, lastname")
        .in("id", userIds),
    ]);
    (uRows || []).forEach((u) => {
      usersMap[String(u.id)] =
        [u.firstname, u.lastname].filter(Boolean).join(" ") || `User ${u.id}`;
    });
    (mRows || []).forEach((m) => {
      mechanicsMap[String(m.id)] =
        [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ") || `User ${m.id}`;
    });

    const unresolved = userIds.filter((id) => !usersMap[String(id)] && !mechanicsMap[String(id)]);
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

  const nameFor = (log: LogRow) => {
    const id = String(log.user_id);
    if (Number(log.user_id) === 0) return "Admin";
    const isLegacy = new Date(log.date_created).getTime() < LEGACY_CUTOFF_MS;
    if (isLegacy) return usersMap[id] || `User ${id}`;
    return mechanicsMap[id] || `User ${id}`;
  };

  const logs: ActivityLogEntry[] = rows.map((log) => ({
    ...log,
    profiles: { full_name: nameFor(log) },
  })) as ActivityLogEntry[];

  // Unique module list (client bhi poora table scan karta hai).
  const { data: modData } = await supabase.from("activity_logs").select("module");
  const modules = modData
    ? (Array.from(new Set(modData.map((m) => m.module)))
        .filter(Boolean)
        .sort() as string[])
    : [];

  return { logs, modules };
}
