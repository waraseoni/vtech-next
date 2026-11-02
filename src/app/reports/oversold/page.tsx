import { Suspense } from "react";
import OversoldReportClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchOversoldSeed } from "./oversoldSeed";

export const metadata = {
  title: "Oversold Stock Report - V-TECH",
};

export const dynamic = "force-dynamic";

export default async function OversoldReportPage() {
  // Koi server filter nahi — pehla paint server seed se (read-only stock RPC),
  // fail hone par client apna purana fetch chalata hai.
  const initial = await loadStaffSeed("Oversold report", (supabase) => fetchOversoldSeed(supabase));

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <OversoldReportClient initial={initial} />
    </Suspense>
  );
}
