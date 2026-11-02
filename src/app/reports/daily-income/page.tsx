import { Suspense } from "react";
import DailyIncomeReportClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchDailyIncomeSeed } from "./dailyIncomeSeed";

export const metadata = {
  title: "Daily Income & Cash Flow Report — V-TECH",
};

export const dynamic = "force-dynamic";

export default async function DailyIncomeReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const hasUrlFilter = !!params.from || !!params.to;

  // Sirf default view (aaj) server par seed hota hai — URL filters par client
  // apna purana supabase fetch chalata hai.
  const initial = hasUrlFilter
    ? null
    : await loadStaffSeed("Daily income report", (supabase) => fetchDailyIncomeSeed(supabase));

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <DailyIncomeReportClient initial={initial} />
    </Suspense>
  );
}
