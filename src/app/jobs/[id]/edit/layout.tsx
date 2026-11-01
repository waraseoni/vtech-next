import { redirect } from "next/navigation";
import { requireStaffWithRole } from "@/lib/api-auth";
import { fetchJobFormSeed } from "@/lib/server-job-form";
import { logger } from "@/lib/logger";
import JobFormSeedProvider from "@/app/jobs/JobFormSeedProvider";
import type { JobFormSeed } from "@/app/jobs/jobFormQueries";

// Edit job form ka master data server par ek wave me (stock bhi yahin computed).
export const dynamic = "force-dynamic";

export default async function EditJobLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  let seed: JobFormSeed | null = null;
  try {
    seed = await fetchJobFormSeed(session);
  } catch (e) {
    logger.warn("Edit job form seed failed — client fallback chalega:", e);
  }

  return <JobFormSeedProvider seed={seed}>{children}</JobFormSeedProvider>;
}
