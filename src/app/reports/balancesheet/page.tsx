import { redirect } from "next/navigation";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";
import { fetchBalanceSheetData, type BalanceSheetPayload } from "@/lib/balance-sheet-data";
import { logger } from "@/lib/logger";
import { endOfMonthIST, startOfMonthIST, todayIST } from "@/lib/dateUtils";
import BalancesheetBody from "./BalancesheetBody";

// RSC first paint: report data server par render-time par compute hota hai
// (cookie+RLS server client — service-role NEVER), taaki client hydration ke
// baad alag API round-trip ka intezaar na kare. Date/filter change par body
// wahi purana API use karta hai.

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v: string) => DAY_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

const FILTERS = ["monthly", "yearly", "custom"] as const;
type FilterType = (typeof FILTERS)[number];
const isFilter = (v: string): v is FilterType => (FILTERS as readonly string[]).includes(v);

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

type SearchParams = Record<string, string | string[] | undefined>;

export const dynamic = "force-dynamic";

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");
  if (session.role !== "admin" && session.role !== "developer") redirect("/dashboard");

  const sp = await searchParams;
  const today = todayIST();
  const defaultYear = parseInt(today.slice(0, 4), 10);
  const defaultMonth = parseInt(today.slice(5, 7), 10);
  const year = parseInt(one(sp.year), 10) || defaultYear;
  const month = parseInt(one(sp.month), 10) || defaultMonth;
  const ftRaw = one(sp.filter_type);
  const filterType: FilterType = isFilter(ftRaw) ? ftRaw : "monthly";

  const monthAnchor = new Date(year, month - 1, 1);
  const monthStart = startOfMonthIST(monthAnchor);
  const monthEnd = endOfMonthIST(monthAnchor);
  const startParam = one(sp.start_date);
  const endParam = one(sp.end_date);

  let from = isDay(startParam)
    ? startParam
    : filterType === "yearly"
      ? `${year}-01-01`
      : monthStart;
  let to = isDay(endParam) ? endParam : filterType === "yearly" ? `${year}-12-31` : monthEnd;
  if (from > to) {
    from = monthStart;
    to = monthEnd;
  }
  const asOnParam = one(sp.asOn);
  const asOnInput = isDay(asOnParam) ? asOnParam : "";
  const asOn = asOnInput || to;

  let data: BalanceSheetPayload | null = null;
  try {
    const supabase = await getServerSupabase();
    data = await fetchBalanceSheetData(supabase, { from, to, asOn });
  } catch (err) {
    // Seed fail ho to body purana client fetch path le leta hai (error banner).
    logger.error("Balance sheet page data error:", err);
  }

  return (
    <BalancesheetBody
      initialData={data}
      initialRange={{ from, to, asOnInput }}
      initialFilter={{ filterType, year, month }}
    />
  );
}
