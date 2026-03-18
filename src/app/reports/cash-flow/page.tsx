import { Suspense } from "react";
import { TrendingUp } from "lucide-react";
import LedgerReportClient from "../ledger/client";

export const metadata = {
  title: "Cash Flow — V-TECH",
};

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

export default async function CashFlowPage({
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
        fallback={
          <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <TrendingUp size={28} className="text-blue-500/60" />
            </div>
            <p className="text-slate-600 text-xs font-extrabold uppercase tracking-[0.3em]">
              Loading Cash Flow...
            </p>
          </div>
        }
      >
        {/* Reuse ledger engine; UI label differs in sidebar */}
        <LedgerReportClient fromDate={from} toDate={to} />
      </Suspense>
    </div>
  );
}

