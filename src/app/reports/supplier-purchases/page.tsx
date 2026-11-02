import { Suspense } from "react";
import SupplierPurchasesReportClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchSupplierPurchasesSeed } from "./supplierPurchasesSeed";

export const metadata = {
  title: "Supplier Purchases Report - V-TECH",
};

export const dynamic = "force-dynamic";

export default async function SupplierPurchasesReportPage() {
  // Default view (is mahine) server par seed hota hai — date filter badalne par
  // client apna purana fetch chalata hai.
  const initial = await loadStaffSeed("Supplier purchases report", (supabase) =>
    fetchSupplierPurchasesSeed(supabase)
  );

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <SupplierPurchasesReportClient initial={initial} />
    </Suspense>
  );
}
