import { Suspense } from "react";
import { BarChart3 } from "lucide-react";
import LedgerReportClient from "./client";
import PageLoader from "@/components/PageLoader";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchLedgerData } from "@/lib/ledger-data";
import { todayIST, parseISTDate, startOfMonthIST, endOfMonthIST } from "@/lib/dateUtils";

export const metadata = {
  title: "Business Ledger & Cash Flow — V-TECH",
};

export const dynamic = "force-dynamic";

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

  // Default view (current month) server par seed hota hai — URL filters par
  // client apna /api/reports/ledger fetch chalata hai.
  const initial =
    !from && !to
      ? await loadStaffSeed("Ledger report", async (supabase) => {
          const seedFrom = startOfMonthIST(parseISTDate(todayIST()));
          const seedTo = endOfMonthIST(parseISTDate(todayIST()));
          const data = await fetchLedgerData(supabase, { from: seedFrom, to: seedTo });
          return { from: seedFrom, to: seedTo, data };
        })
      : null;

  return (
    <div className="min-h-screen bg-app">
      <Suspense
        fallback={<PageLoader icon={BarChart3} label="Loading Ledger Report..." tone="emerald" />}
      >
        <LedgerReportClient fromDate={from} toDate={to} initial={initial} />
      </Suspense>
    </div>
  );
}
