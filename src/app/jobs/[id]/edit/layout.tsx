import { redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import { SeedStream } from "@/components/SeedStream";
import { requireStaffWithRole } from "@/lib/api-auth";
import { fetchJobFormSeed } from "@/lib/server-job-form";
import { logger } from "@/lib/logger";
import JobFormSeedProvider from "@/app/jobs/JobFormSeedProvider";
import type { JobFormSeed } from "@/app/jobs/jobFormQueries";

// Edit job form ka master data server par ek wave me (stock bhi yahin computed).
//
// NAV PERF (audit, 29 Nov 2026): seed Suspense ke andar stream hota hai — pehle
// await tha, isliye edit page ka shell master data ke baad hi aata tha.
export const dynamic = "force-dynamic";

export default async function EditJobLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  const seedPromise: Promise<JobFormSeed | null> = fetchJobFormSeed(session).catch((e) => {
    logger.warn("Edit job form seed failed — client fallback chalega:", e);
    return null;
  });

  return (
    <SeedStream
      promise={seedPromise}
      fallback={<PageLoader icon={Briefcase} label="Loading job form..." tone="cyan" />}
    >
      {(seed) => <JobFormSeedProvider seed={seed}>{children}</JobFormSeedProvider>}
    </SeedStream>
  );
}
