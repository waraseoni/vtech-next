import { Suspense } from "react";
import MonthlySalesClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchMonthlySalesSeed } from "./monthly-salesSeed";

export const dynamic = "force-dynamic";

export default async function MonthlySalesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  // Sirf default view (current month) seed hota hai — URL `?month=` par
  // client apna purana supabase fetch chalata hai.
  const initial = !month
    ? await loadStaffSeed("Monthly sales report", (supabase) => fetchMonthlySalesSeed(supabase))
    : null;

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <MonthlySalesClient initial={initial} />
    </Suspense>
  );
}
