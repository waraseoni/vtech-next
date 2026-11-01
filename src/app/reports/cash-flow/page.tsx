import { redirect } from "next/navigation";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";
import { fetchLedgerData, type LedgerPayload } from "@/lib/ledger-data";
import { logger } from "@/lib/logger";
import { startOfMonthIST, endOfMonthIST } from "@/lib/dateUtils";
import CashFlowBody from "./CashFlowBody";

// RSC first paint: report data server par compute hota hai (cookie+RLS
// client, service-role NEVER). Date change par body wahi purana
// /api/reports/ledger use karta hai — computation shared module me hai.

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v: string) => DAY_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

type SearchParams = Record<string, string | string[] | undefined>;

export const dynamic = "force-dynamic";

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const fromParam = one(sp.from);
  const toParam = one(sp.to);
  const from = isDay(fromParam) ? fromParam : startOfMonthIST();
  const to = isDay(toParam) ? toParam : endOfMonthIST();

  let data: LedgerPayload | null = null;
  try {
    const supabase = await getServerSupabase();
    data = await fetchLedgerData(supabase, { from, to });
  } catch (err) {
    // Seed fail ho to body purana client fetch path le leti hai.
    logger.error("Cash flow page data error:", err);
  }

  return <CashFlowBody initialData={data} initialRange={{ from, to }} />;
}
