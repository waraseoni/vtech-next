import { Suspense } from "react";
import DueRemindersClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchDueRemindersSeed } from "./dueRemindersSeed";

export const metadata = {
  title: "Due Reminders — V-TECH",
};

export const dynamic = "force-dynamic";

export default async function DueRemindersReportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;

  // Default view (all dues, koi date filter nahi) server par seed hota hai —
  // URL filters ho to client apna purana fetch chalata hai.
  const initial =
    !params.status && !params.from && !params.to
      ? await loadStaffSeed("Due reminders report", (supabase) => fetchDueRemindersSeed(supabase))
      : null;

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <DueRemindersClient initial={initial} />
    </Suspense>
  );
}
