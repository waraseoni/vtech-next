import { Suspense } from "react";
import TopCustomersClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchTopCustomersSeed } from "./topCustomersSeed";

export const metadata = {
  title: "Top Customers Report — V-TECH",
};

export const dynamic = "force-dynamic";

export default async function TopCustomersPage() {
  // Page ka koi URL filter nahi — default "All Time" view seed hota hai;
  // filter/month change par client apna fetch chalata hai.
  const initial = await loadStaffSeed("Top customers report", (supabase) =>
    fetchTopCustomersSeed(supabase)
  );

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <TopCustomersClient initial={initial} />
    </Suspense>
  );
}
