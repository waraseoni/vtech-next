import { Suspense } from "react";
import SupplierDuesReportClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchSupplierDuesSeed } from "./supplierDuesSeed";

export const metadata = {
  title: "Supplier Dues Report - V-TECH",
};

export const dynamic = "force-dynamic";

export default async function SupplierDuesReportPage() {
  // Poora report ek hi default view hai (koi server filter nahi) — pehla paint
  // server seed se, fail hone par client apna purana fetch chalata hai.
  const initial = await loadStaffSeed("Supplier dues report", (supabase) =>
    fetchSupplierDuesSeed(supabase)
  );

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <SupplierDuesReportClient initial={initial} />
    </Suspense>
  );
}
