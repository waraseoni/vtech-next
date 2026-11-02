import { Suspense } from "react";
import CustomSalesClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchCustomSalesSeed } from "./custom-salesSeed";

export const dynamic = "force-dynamic";

export default async function CustomSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  // Sirf default range (this month) seed hoti hai — URL filters par client
  // apna purana supabase fetch chalata hai.
  const initial =
    !from && !to
      ? await loadStaffSeed("Custom sales report", (supabase) => fetchCustomSalesSeed(supabase))
      : null;

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <CustomSalesClient initial={initial} />
    </Suspense>
  );
}
