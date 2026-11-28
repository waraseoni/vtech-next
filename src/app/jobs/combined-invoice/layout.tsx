import { Receipt } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import { SeedStream } from "@/components/SeedStream";
import { fetchCombinedInvoiceSeed } from "../jobsAuxQueries";
import { fetchJobsAuxSeedData, requireJobsAuxSeedAuth } from "@/lib/server-jobs-aux-seed";
import { JobAuxSeedProvider } from "../JobAuxSeed";

// NAV PERF (audit, 29 Nov 2026): seed Suspense ke andar stream hota hai.
export const dynamic = "force-dynamic";

export default async function CombinedInvoiceLayout({ children }: { children: React.ReactNode }) {
  await requireJobsAuxSeedAuth();
  const seedPromise = fetchJobsAuxSeedData("Combined invoice", fetchCombinedInvoiceSeed);

  return (
    <SeedStream
      promise={seedPromise}
      fallback={<PageLoader icon={Receipt} label="Loading invoice..." tone="cyan" />}
    >
      {(seed) => (
        <JobAuxSeedProvider seed={seed ? { kind: "combined-invoice", data: seed } : null}>
          {children}
        </JobAuxSeedProvider>
      )}
    </SeedStream>
  );
}
