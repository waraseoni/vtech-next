import { Suspense } from "react";
import { ClipboardList } from "lucide-react";
import JobsOldClient from "./client";
import PageLoader from "@/components/PageLoader";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchJobsOldMasters } from "./jobsOldSeed";

export const dynamic = "force-dynamic";

// Master lists (clients/mechanics/services/products) pehle mount par 4 queries
// se aate the — ab server par ek wave me. Seed fail ho to client apna purana
// fetchMaster() chalata hai.
export default async function JobsOldPage() {
  const initial = await loadStaffSeed("Jobs old entry", (supabase) =>
    fetchJobsOldMasters(supabase)
  );

  return (
    <Suspense
      fallback={<PageLoader icon={ClipboardList} label="Loading Job Entry..." tone="blue" />}
    >
      <JobsOldClient initial={initial} />
    </Suspense>
  );
}
