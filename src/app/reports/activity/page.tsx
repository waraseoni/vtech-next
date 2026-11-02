import { Suspense } from "react";
import ActivityLogClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchActivitySeed } from "./activitySeed";

export const metadata = {
  title: "System Activity Log — V-TECH",
};

export const dynamic = "force-dynamic";

export default async function ActivityLogPage() {
  // Default view (All Modules, koi search nahi) seed hota hai; filter/search
  // par client apna refetch chalata hai.
  const initial = await loadStaffSeed("Activity log", (supabase) => fetchActivitySeed(supabase));

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <ActivityLogClient initial={initial} />
    </Suspense>
  );
}
