import { redirect } from "next/navigation";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";
import { endOfMonthIST, startOfMonthIST } from "@/lib/dateUtils";
import { logger } from "@/lib/logger";
import {
  fetchClientPartsServiceReport,
  fetchClientsList,
  fetchMechanicsList,
  type ClientPartsServiceSeed,
} from "@/lib/client-parts-service-data";
import ClientPartsServiceBody from "./ClientPartsServiceBody";

// RSC first paint: default view (current month, all clients, all status) server
// par seed hota hai — cookie+RLS client, service-role NEVER. Baaki filters
// client-side refetch karte hain (seed key mismatch par normal fetch).
export const dynamic = "force-dynamic";

export default async function ClientPartsServiceReportPage() {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  const filters = {
    clientId: "",
    from: startOfMonthIST(),
    to: endOfMonthIST(),
    status: "all",
  };

  let seed: ClientPartsServiceSeed | null = null;
  try {
    const supabase = await getServerSupabase();
    // 3 independent reads — ek hi wave (pehle client par 3 sequential RTT the).
    const [clients, mechanics, report] = await Promise.all([
      fetchClientsList(supabase),
      fetchMechanicsList(supabase),
      fetchClientPartsServiceReport(supabase, filters),
    ]);
    seed = { clients, mechanics, report, filters };
  } catch (err) {
    // Seed fail ho to body mount par client fetch kar leti hai.
    logger.error("Client parts/service report seed error:", err);
  }

  return <ClientPartsServiceBody seed={seed} />;
}
