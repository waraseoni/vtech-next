import { redirect } from "next/navigation";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";
import { fetchMonthlyProfitData, type MonthlyData } from "@/lib/monthly-profit-data";
import { logger } from "@/lib/logger";
import { todayIST } from "@/lib/dateUtils";
import MonthlyProfitBody from "./MonthlyProfitBody";

// RSC first paint: yearly aggregation server par banti hai (cookie+RLS
// client, service-role NEVER). Year change par body client-side wahi shared
// module chalati hai.

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

type SearchParams = Record<string, string | string[] | undefined>;

export const dynamic = "force-dynamic";

export default async function MonthlyProfitPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const currentYear = parseInt(todayIST().slice(0, 4), 10);
  const parsed = parseInt(one(sp.year), 10);
  const year = parsed >= 2000 && parsed <= 2100 ? parsed : currentYear;

  let data: MonthlyData[] = [];
  try {
    const supabase = await getServerSupabase();
    const payload = await fetchMonthlyProfitData(supabase, year);
    data = payload.data;
  } catch (err) {
    // Seed fail ho to body mount par client refetch kar leti hai.
    logger.error("Monthly profit page data error:", err);
  }

  return <MonthlyProfitBody initialYear={year} initialData={data} />;
}
