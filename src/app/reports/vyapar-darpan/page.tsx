import { Suspense } from "react";
import { Store } from "lucide-react";
import VyaparDarpanClient from "./client";
import PageLoader from "@/components/PageLoader";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchVyaparData } from "@/lib/vyapar-data";
import { todayIST, parseISTDate, startOfMonthIST, endOfMonthIST } from "@/lib/dateUtils";

export const metadata = {
  title: "Vyapar Darpan — Business Mirror — V-TECH",
};

export const dynamic = "force-dynamic";

// BUG FIX: Validate date params — garbage ?from=abc values would break date parsing.
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

export default async function VyaparDarpanPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = isValidDate(params.from || "") ? params.from! : "";
  const to = isValidDate(params.to || "") ? params.to! : "";

  // Default view (current month) server par seed hota hai — URL filters par
  // client apna /api/reports/vyapar-darpan fetch chalata hai.
  const initial =
    !from && !to
      ? await loadStaffSeed("Vyapar Darpan", async (supabase) => {
          const seedFrom = startOfMonthIST(parseISTDate(todayIST()));
          const seedTo = endOfMonthIST(parseISTDate(todayIST()));
          const data = await fetchVyaparData(supabase, seedFrom, seedTo);
          return { from: seedFrom, to: seedTo, data };
        })
      : null;

  return (
    <div className="min-h-screen bg-app">
      <Suspense
        fallback={<PageLoader icon={Store} label="Polishing the Mirror..." tone="purple" />}
      >
        <VyaparDarpanClient fromDate={from} toDate={to} initial={initial} />
      </Suspense>
    </div>
  );
}
