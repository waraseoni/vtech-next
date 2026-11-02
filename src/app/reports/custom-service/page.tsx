import { Suspense } from "react";
import CustomServiceClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchCustomServiceSeed } from "./custom-serviceSeed";

export const dynamic = "force-dynamic";

export default async function CustomServicePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  // Sirf default range (this month) seed hoti hai — URL filters par client
  // apna purana supabase fetch chalata hai.
  const initial =
    !from && !to
      ? await loadStaffSeed("Custom service report", (supabase) => fetchCustomServiceSeed(supabase))
      : null;

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <CustomServiceClient initial={initial} />
    </Suspense>
  );
}
