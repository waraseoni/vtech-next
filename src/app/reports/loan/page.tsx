import { Suspense } from "react";
import LoanReportClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchLoanReportSeed } from "./loanSeed";

export const dynamic = "force-dynamic";

export default async function LoanReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  // Sirf default view (current month) seed hota hai — URL `?month=` par
  // client apna purana supabase fetch chalata hai.
  const initial = !month
    ? await loadStaffSeed("Loan report", (supabase) => fetchLoanReportSeed(supabase))
    : null;

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <LoanReportClient initial={initial} />
    </Suspense>
  );
}
