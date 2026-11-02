import { loadJobsAuxSeed } from "@/lib/server-jobs-aux-seed";
import { fetchBulkEditSeed } from "../jobsAuxQueries";
import { JobAuxSeedProvider } from "../JobAuxSeed";

export const dynamic = "force-dynamic";

export default async function BulkEditLayout({ children }: { children: React.ReactNode }) {
  const seed = await loadJobsAuxSeed("Bulk edit", fetchBulkEditSeed);
  return (
    <JobAuxSeedProvider seed={seed ? { kind: "bulk-edit", data: seed } : null}>
      {children}
    </JobAuxSeedProvider>
  );
}
