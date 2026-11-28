import { redirect } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import { SeedStream } from "@/components/SeedStream";
import { requireStaffWithRole } from "@/lib/api-auth";
import { fetchJobFormSeed } from "@/lib/server-job-form";
import { logger } from "@/lib/logger";
import JobFormSeedProvider from "../JobFormSeedProvider";
import type { JobFormSeed } from "../jobFormQueries";

// New job form ka master data (clients/mechanics/services/products + stock)
// server par ek wave me — pehle mount par 7 sequential client queries chalti thi.
//
// NAV PERF (audit, 29 Nov 2026): seed ab Suspense ke andar stream hota hai.
// Pehle ye layout seed ko await karta tha → RSC headers 7-table fetch ke baad
// flush hote the → "New Job" click par screen freeze lagti thi.
export const dynamic = "force-dynamic";

export default async function NewJobLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  const seedPromise: Promise<JobFormSeed | null> = fetchJobFormSeed(session).catch((e) => {
    logger.warn("New job form seed failed — client fallback chalega:", e);
    return null;
  });

  return (
    <SeedStream
      promise={seedPromise}
      fallback={<PageLoader icon={FilePlus2} label="Loading job form..." tone="cyan" />}
    >
      {(seed) => <JobFormSeedProvider seed={seed}>{children}</JobFormSeedProvider>}
    </SeedStream>
  );
}
