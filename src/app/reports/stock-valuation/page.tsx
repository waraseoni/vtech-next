import { Suspense } from "react";
import StockValuationReportClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchStockValuationSeed } from "./stockValuationSeed";

export const metadata = {
  title: "Stock Valuation Report — V-TECH",
};

export const dynamic = "force-dynamic";

export default async function StockValuationReportPage() {
  // Koi filter nahi — poora report default view hai, isliye hamesha seed.
  const initial = await loadStaffSeed("Stock valuation report", (supabase) =>
    fetchStockValuationSeed(supabase)
  );

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <StockValuationReportClient initial={initial} />
    </Suspense>
  );
}
