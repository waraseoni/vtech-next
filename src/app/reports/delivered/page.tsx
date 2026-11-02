import { Suspense } from "react";
import DeliveredReportClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchDeliveredSeed } from "./deliveredSeed";

export const metadata = {
  title: "Delivered Items Report - V-TECH",
};

export const dynamic = "force-dynamic";

export default async function DeliveredReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from_date?: string; to_date?: string; client_id?: string }>;
}) {
  const { from_date, to_date, client_id } = await searchParams;
  // Sirf default view (aaj, all clients) seed hota hai — URL filters par
  // client apna fetch chalata hai.
  const initial =
    !from_date && !to_date && !client_id
      ? await loadStaffSeed("Delivered report", (supabase) => fetchDeliveredSeed(supabase))
      : null;

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <DeliveredReportClient
        fromDate={from_date}
        toDate={to_date}
        clientId={client_id}
        initial={initial}
      />
    </Suspense>
  );
}
