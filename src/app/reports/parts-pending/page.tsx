import { Suspense } from "react";
import PartsPendingReportClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchPartsPendingSeed } from "./partsPendingSeed";

export const metadata = {
  title: "Waiting for Parts Report - V-TECH",
};

export const dynamic = "force-dynamic";

export default async function PartsPendingReportPage() {
  // Koi server filter nahi — pehla paint server seed se, fail hone par client
  // apna purana fetch chalata hai.
  const initial = await loadStaffSeed("Parts pending report", (supabase) =>
    fetchPartsPendingSeed(supabase)
  );

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <PartsPendingReportClient initial={initial} />
    </Suspense>
  );
}
