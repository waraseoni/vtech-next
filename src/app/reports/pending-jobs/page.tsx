import { redirect } from "next/navigation";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";
import { fetchPendingJobs, type PendingJobRow } from "@/lib/pending-jobs-data";
import { logger } from "@/lib/logger";
import { todayIST } from "@/lib/dateUtils";
import PendingJobsBody from "./PendingJobsBody";

// RSC first paint: pehla page server par seed hota hai (cookie+RLS client,
// service-role NEVER). Baaki filter/page changes client refetch karte hain.

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

type SearchParams = Record<string, string | string[] | undefined>;

export const dynamic = "force-dynamic";

export default async function PendingJobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const from = one(sp.from);
  const to = one(sp.to) || todayIST();
  const status = one(sp.status) || "all";

  let initialJobs: PendingJobRow[] | null = null;
  try {
    const supabase = await getServerSupabase();
    initialJobs = await fetchPendingJobs(supabase, { from, to, status });
  } catch (err) {
    // Seed fail ho to body mount par client fetch kar leti hai.
    logger.error("Pending jobs page data error:", err);
  }

  return (
    <PendingJobsBody initialJobs={initialJobs} initialFilters={{ from, to, status }} />
  );
}
