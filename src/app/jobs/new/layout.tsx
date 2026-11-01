import { redirect } from "next/navigation";
import { requireStaffWithRole } from "@/lib/api-auth";
import { fetchJobFormSeed } from "@/lib/server-job-form";
import { logger } from "@/lib/logger";
import JobFormSeedProvider from "../JobFormSeedProvider";
import type { JobFormSeed } from "../jobFormQueries";

// New job form ka master data (clients/mechanics/services/products + stock)
// server par ek wave me — pehle mount par 7 sequential client queries chalti thi.
export const dynamic = "force-dynamic";

export default async function NewJobLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  let seed: JobFormSeed | null = null;
  try {
    seed = await fetchJobFormSeed(session);
  } catch (e) {
    logger.warn("New job form seed failed — client fallback chalega:", e);
  }

  return <JobFormSeedProvider seed={seed}>{children}</JobFormSeedProvider>;
}
