import { Suspense } from "react";
import { ClipboardList } from "lucide-react";
import JobsOldClient from "./client";
import PageLoader from "@/components/PageLoader";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchJobsOldEditSeed } from "../../old/jobsOldSeed";

export const dynamic = "force-dynamic";

// Edit route: masters + job row + uske services/products server par seed hote
// hain. Job na mile / seed fail ho to `initial` null — client apna fetchJob()
// chalata hai jo `/jobs` par redirect karta hai (purana behaviour).
export default async function JobsOldEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id?.trim());

  const initial =
    Number.isFinite(numId) && numId > 0
      ? await loadStaffSeed("Jobs old edit", (supabase) => fetchJobsOldEditSeed(supabase, numId))
      : null;

  return (
    <Suspense
      fallback={<PageLoader icon={ClipboardList} label="Loading Job Entry..." tone="blue" />}
    >
      <JobsOldClient initial={initial} />
    </Suspense>
  );
}
