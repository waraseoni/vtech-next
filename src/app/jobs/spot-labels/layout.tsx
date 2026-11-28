import { Tag } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import { SeedStream } from "@/components/SeedStream";
import { fetchSpotLabelsSeed } from "../jobsAuxQueries";
import { fetchJobsAuxSeedData, requireJobsAuxSeedAuth } from "@/lib/server-jobs-aux-seed";
import { JobAuxSeedProvider } from "../JobAuxSeed";

// NAV PERF (audit, 29 Nov 2026): seed Suspense ke andar stream hota hai.
export const dynamic = "force-dynamic";

export default async function SpotLabelsLayout({ children }: { children: React.ReactNode }) {
  await requireJobsAuxSeedAuth();
  const seedPromise = fetchJobsAuxSeedData("Spot labels", fetchSpotLabelsSeed);

  return (
    <SeedStream
      promise={seedPromise}
      fallback={<PageLoader icon={Tag} label="Loading spot labels..." tone="cyan" />}
    >
      {(seed) => (
        <JobAuxSeedProvider seed={seed ? { kind: "spot-labels", data: seed } : null}>
          {children}
        </JobAuxSeedProvider>
      )}
    </SeedStream>
  );
}
