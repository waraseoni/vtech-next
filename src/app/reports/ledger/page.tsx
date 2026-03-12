import { Suspense } from "react";
import { BarChart3 } from "lucide-react";
import LedgerReportClient from "./client";

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
  const to   = isValidDate(params.to   || "") ? params.to!   : "";

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <BarChart3 size={28} className="text-emerald-500/60" />
              </div>
              <div className="absolute inset-0 rounded-2xl border border-emerald-500/40 animate-ping" />
            </div>
            <p className="text-slate-600 text-xs font-extrabold uppercase tracking-[0.3em]">
              Loading Ledger Report...
            </p>
          </div>
        }
      >
        <LedgerReportClient fromDate={from} toDate={to} />
      </Suspense>
    </div>
  );
}