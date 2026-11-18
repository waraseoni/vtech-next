import { Suspense } from "react";
import { requireStaffWithRole, type ServerUser } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { fetchJobsPageData, type JobsSearchParams } from "@/lib/server-jobs";
import { isMobileUserAgent } from "@/lib/device";
import JobsBody from "./JobsBody";
import { JobsSkeleton } from "./JobsSkeleton";

export const dynamic = "force-dynamic";

type SessionInfo = {
  user: ServerUser;
  role: string;
};

async function JobsContent({
  session,
  sp,
  hideDelivered,
  initialIsMobile,
}: {
  session: SessionInfo;
  sp: JobsSearchParams;
  hideDelivered: boolean;
  initialIsMobile: boolean;
}) {
  const data = await fetchJobsPageData(sp, { hideDelivered });
  const initial = data ? { ...data, userRole: session.role } : null;
  return <JobsBody initial={initial} initialIsMobile={initialIsMobile} />;
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<JobsSearchParams>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const hideDelivered = cookieStore.get("jobs_hide_delivered")?.value === "1";
  const initialIsMobile = isMobileUserAgent(await headers());

  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  return (
    <Suspense fallback={<JobsSkeleton />}>
      <JobsContent
        session={session}
        sp={sp}
        hideDelivered={hideDelivered}
        initialIsMobile={initialIsMobile}
      />
    </Suspense>
  );
}
