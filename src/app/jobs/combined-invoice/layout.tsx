import { loadJobsAuxSeed } from "@/lib/server-jobs-aux-seed";
import { fetchCombinedInvoiceSeed } from "../jobsAuxQueries";
import { JobAuxSeedProvider } from "../JobAuxSeed";

export const dynamic = "force-dynamic";

export default async function CombinedInvoiceLayout({ children }: { children: React.ReactNode }) {
  const seed = await loadJobsAuxSeed("Combined invoice", fetchCombinedInvoiceSeed);
  return (
    <JobAuxSeedProvider seed={seed ? { kind: "combined-invoice", data: seed } : null}>
      {children}
    </JobAuxSeedProvider>
  );
}
