import { Suspense } from "react";
import { BarChart3 } from "lucide-react";
import LedgerReportClient from "./client";
import PageLoader from "@/components/PageLoader";

export const metadata = {
  title: "Business Ledger & Cash Flow — V-TECH",
};

// BUG FIX: Validate date params from URL — garbage values passed as ?from=abc
// would crash parseISO silently downstream
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

export default async function LedgerReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = isValidDate(params.from || "") ? params.from! : "";
  const to = isValidDate(params.to || "") ? params.to! : "";

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <Suspense
        fallback={<PageLoader icon={BarChart3} label="Loading Ledger Report..." tone="emerald" />}
      >
        <LedgerReportClient fromDate={from} toDate={to} />
      </Suspense>
    </div>
  );
}
