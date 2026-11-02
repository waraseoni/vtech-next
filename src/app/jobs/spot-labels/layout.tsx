import { loadJobsAuxSeed } from "@/lib/server-jobs-aux-seed";
import { fetchSpotLabelsSeed } from "../jobsAuxQueries";
import { JobAuxSeedProvider } from "../JobAuxSeed";

export const dynamic = "force-dynamic";

export default async function SpotLabelsLayout({ children }: { children: React.ReactNode }) {
  const seed = await loadJobsAuxSeed("Spot labels", fetchSpotLabelsSeed);
  return (
    <JobAuxSeedProvider seed={seed ? { kind: "spot-labels", data: seed } : null}>
      {children}
    </JobAuxSeedProvider>
  );
}
