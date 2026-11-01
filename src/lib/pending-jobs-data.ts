/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Pending jobs query — single source of truth for `/reports/pending-jobs`
 * ka server first paint aur client refetch.
 */

import { pageAll } from "./fetch-all";

type SupabaseLike = { from: (table: string) => any };
export type PendingJobRow = Record<string, any> & { client: Record<string, any> | null };

export type PendingJobsFilters = { from: string; to: string; status: string };

export async function fetchPendingJobs(
  supabase: SupabaseLike,
  { from, to, status }: PendingJobsFilters
): Promise<PendingJobRow[]> {
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

  const { data } = await pageAll<PendingJobRow>(query);

  const pendingJobs = data || [];
  if (pendingJobs.length === 0) return [];

  const clientIdsNum = [
    ...new Set(pendingJobs.map((t) => Number(t.client_name)).filter((id) => !isNaN(id))),
  ];

  const clientMap = new Map<number, Record<string, any>>();
  if (clientIdsNum.length > 0) {
    const { data: clients, error: clientErr } = await supabase
      .from("client_list")
      .select("id, firstname, lastname, contact")
      .in("id", clientIdsNum);

    if (!clientErr && clients) {
      clients.forEach((c: Record<string, any>) => clientMap.set(c.id, c));
    }
  }

  return pendingJobs.map((job) => ({
    ...job,
    client: clientMap.get(Number(job.client_name)) || null,
  }));
}
