import { Layers } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import { SeedStream } from "@/components/SeedStream";
import { fetchBulkEditSeed } from "../jobsAuxQueries";
import { fetchJobsAuxSeedData, requireJobsAuxSeedAuth } from "@/lib/server-jobs-aux-seed";
import { JobAuxSeedProvider } from "../JobAuxSeed";

// NAV PERF (audit, 29 Nov 2026): seed Suspense ke andar stream hota hai.
export const dynamic = "force-dynamic";

export default async function BulkEditLayout({ children }: { children: React.ReactNode }) {
  await requireJobsAuxSeedAuth();
  const seedPromise = fetchJobsAuxSeedData("Bulk edit", fetchBulkEditSeed);

  return (
    <SeedStream
      promise={seedPromise}
      fallback={<PageLoader icon={Layers} label="Loading bulk edit..." tone="cyan" />}
    >
      {(seed) => (
        <JobAuxSeedProvider seed={seed ? { kind: "bulk-edit", data: seed } : null}>
          {children}
        </JobAuxSeedProvider>
      )}
    </SeedStream>
  );
}
