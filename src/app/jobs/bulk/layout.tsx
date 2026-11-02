import { loadJobsAuxSeed } from "@/lib/server-jobs-aux-seed";
import { fetchBulkJobSeed } from "../jobsAuxQueries";
import { JobAuxSeedProvider } from "../JobAuxSeed";

export const dynamic = "force-dynamic";

export default async function BulkJobLayout({ children }: { children: React.ReactNode }) {
  const seed = await loadJobsAuxSeed("Bulk job", fetchBulkJobSeed);
  return (
    <JobAuxSeedProvider seed={seed ? { kind: "bulk", data: seed } : null}>
      {children}
    </JobAuxSeedProvider>
  );
}
