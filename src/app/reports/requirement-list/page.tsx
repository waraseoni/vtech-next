import { Suspense } from "react";
import RequirementListClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchRequirementListSeed } from "./requirementListSeed";

export const metadata = {
  title: "Requirement List — V-TECH",
};

export const dynamic = "force-dynamic";

export default async function RequirementListReportPage() {
  // Page par URL filters nahi hain — poora default view server par seed hota hai.
  const initial = await loadStaffSeed("Requirement list report", (supabase) =>
    fetchRequirementListSeed(supabase)
  );

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <RequirementListClient initial={initial} />
    </Suspense>
  );
}
