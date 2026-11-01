import { redirect } from "next/navigation";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";
import {
  fetchAccountingDashboardData,
  type AccountingDashboardData,
} from "@/lib/accounting-dashboard-data";
import { logger } from "@/lib/logger";
import { startOfMonthIST, todayIST } from "@/lib/dateUtils";
import AccountingDashboardBody from "./AccountingDashboardBody";

// RSC first paint: dashboard aggregates server par bante hain (cookie+RLS
// client, service-role NEVER). Date filter change par body client-side wahi
// shared module chalati hai.

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v: string) => DAY_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

type SearchParams = Record<string, string | string[] | undefined>;

export const dynamic = "force-dynamic";

export default async function AccountingDashboardPage({
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
  const to = isDay(toParam) ? toParam : todayIST();

  let data: AccountingDashboardData | null = null;
  try {
    const supabase = await getServerSupabase();
    data = await fetchAccountingDashboardData(supabase, { from, to });
  } catch (err) {
    // Seed fail ho to body mount par client refetch kar leti hai.
    logger.error("Accounting dashboard page data error:", err);
  }

  return <AccountingDashboardBody initialData={data} initialRange={{ from, to }} />;
}
