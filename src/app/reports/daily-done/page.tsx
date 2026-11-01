import { redirect } from "next/navigation";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";
import {
  fetchDailyDoneFirmInfo,
  fetchDailyDoneItems,
  fetchDailyDoneMechanics,
  type DailyDoneItem,
  type DailyDoneMechanic,
} from "@/lib/daily-done-data";
import { logger } from "@/lib/logger";
import { todayIST } from "@/lib/dateUtils";
import DailyDoneBody from "./DailyDoneBody";

// RSC first paint: aaj ka done-report server par seed hota hai
// (cookie+RLS client, service-role NEVER). Date/mechanic change par body
// client-side wahi shared module chalati hai.

export const dynamic = "force-dynamic";

export default async function DailyDonePage() {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  const date = todayIST();
  let items: DailyDoneItem[] | null = null;
  let mechanics: DailyDoneMechanic[] | null = null;
  let firmInfo: Record<string, string> = {};

  try {
    const supabase = await getServerSupabase();
    const [seededItems, seededMechanics, seededFirm] = await Promise.all([
      fetchDailyDoneItems(supabase, date, "all"),
      fetchDailyDoneMechanics(supabase),
      fetchDailyDoneFirmInfo(supabase),
    ]);
    items = seededItems;
    mechanics = seededMechanics;
    firmInfo = seededFirm;
  } catch (err) {
    // Seed fail ho to body mount par client fetch kar leti hai.
    logger.error("Daily done page data error:", err);
  }

  return (
    <DailyDoneBody
      initialDate={date}
      initialItems={items}
      initialMechanics={mechanics}
      initialFirmInfo={firmInfo}
    />
  );
}
