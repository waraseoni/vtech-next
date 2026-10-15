import { requireStaffWithRole } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { fetchJobsPageData, type JobsSearchParams } from "@/lib/server-jobs";
import JobsBody from "./JobsBody";

// Phase 4 P2 (docs/plans/rsc_phase4_plan.md): jobs list pehle poora client
// page tha — hydration ke BAAD useJobList mount par fetchPage+fetchStats chalata
// tha (waterfall). Ab first-paint data server par render-time par aata hai
// (cookie+RLS server client — service-role NEVER), phir JobsBody (client)
// interactive UI ko props ke roop me leta hai. Query semantics shared hai
// jobListQueries.ts (client + server dono wahi use karte hain — drift nahi).
export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<JobsSearchParams>;
}) {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const initial = await fetchJobsPageData(sp, { userRole: session.role });

  return <JobsBody initial={initial} />;
}
