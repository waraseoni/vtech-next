import { Suspense } from "react";
import FinancialReportClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchFinancialReportSeed } from "./financialReportSeed";

export const metadata = {
  title: "Workshop Financial Report — V-TECH",
};

export const dynamic = "force-dynamic";

export default async function FinancialReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const hasUrlFilter = !!params.from || !!params.to;

  // Sirf default view (current month) server par seed hota hai — URL filters par
  // client apna purana supabase fetch chalata hai.
  const initial = hasUrlFilter
    ? null
    : await loadStaffSeed("Financial report", (supabase) => fetchFinancialReportSeed(supabase));

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <FinancialReportClient initial={initial} />
    </Suspense>
  );
}
