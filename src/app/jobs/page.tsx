import { requireStaffWithRole } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { fetchJobsPageData, type JobsSearchParams } from "@/lib/server-jobs";
import { isMobileUserAgent } from "@/lib/device";
import JobsBody from "./JobsBody";

// Phase 4 P2 (docs/plans/rsc_phase4_plan.md): jobs list pehle poora client
// page tha — hydration ke BAAD useJobList mount par fetchPage+fetchStats chalata
// tha (waterfall). Ab first-paint data server par render-time par aata hai
// (cookie+RLS server client — service-role NEVER), phir JobsBody (client)
// interactive UI ko props ke roop me leta hai. Query semantics shared hai
// jobListQueries.ts (client + server dono wahi use karte hain — drift nahi).
//
// PERF: auth aur data fetch PARALLEL chalte hain (Promise.all) — pehle
// getUser() RTT ke BAAD hi data fetch shuru hota tha (sequential waterfall).
// `hide_delivered` cookie client ke mirror se aata hai (seed match ke liye).
export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<JobsSearchParams>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const hideDelivered = cookieStore.get("jobs_hide_delivered")?.value === "1";

  // PERF: device class server par decide (mobile tree first-paint) — warna
  // mount-par `isMobile` flip hota tha aur DESKTOP+MOBILE dono trees hydrate/
  // layout hote the (mobile TBT ka ~40%). See JobsBody `initialIsMobile`.
  const initialIsMobile = isMobileUserAgent(await headers());

  const [session, data] = await Promise.all([
    requireStaffWithRole(),
    fetchJobsPageData(sp, { hideDelivered }),
  ]);
  if (!session) redirect("/login");

  const initial = data ? { ...data, userRole: session.role } : null;
  return <JobsBody initial={initial} initialIsMobile={initialIsMobile} />;
}
