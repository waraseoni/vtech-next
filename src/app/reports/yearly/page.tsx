import { Suspense } from "react";
import YearlyReportClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchYearlySeed } from "./yearlySeed";

export const metadata = {
  title: "Monthly Profit/Loss Report — V-TECH",
};

export const dynamic = "force-dynamic";

export default async function YearlyReportPage() {
  // Default view = current year; year change par client apna fetch chalata hai.
  const initial = await loadStaffSeed("Yearly report", (supabase) => fetchYearlySeed(supabase));

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <YearlyReportClient initial={initial} />
    </Suspense>
  );
}
