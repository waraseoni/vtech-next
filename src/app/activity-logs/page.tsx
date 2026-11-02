import { Suspense } from "react";
import ActivityLogsClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchActivityLogsSeed } from "./activityLogsSeed";

export const metadata = {
  title: "System Activity Logs — V-TECH",
};

export const dynamic = "force-dynamic";

export default async function ActivityLogsPage() {
  // Default view (All Modules, page 0, 25 rows) server par seed hota hai;
  // filter/search/page change par client apna fetch chalata hai.
  const initial = await loadStaffSeed("Activity logs", (supabase) =>
    fetchActivityLogsSeed(supabase)
  );

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <ActivityLogsClient initial={initial} />
    </Suspense>
  );
}
