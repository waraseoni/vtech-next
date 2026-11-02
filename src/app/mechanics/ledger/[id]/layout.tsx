import { loadStaffSeed } from "@/lib/server-seed";
import { ServerSeedProvider } from "@/app/components/ServerSeed";
import { fetchMechanicMonthLedgerSeed } from "../../mechanicMonthLedgerSeed";

export const dynamic = "force-dynamic";

export default async function MechanicMonthLedgerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mechanicId = Number(id);
  const seed = Number.isFinite(mechanicId)
    ? await loadStaffSeed("Mechanic month ledger", (supabase) =>
        fetchMechanicMonthLedgerSeed(supabase, mechanicId)
      )
    : null;

  return (
    <ServerSeedProvider seedKey="mechanic-month-ledger" data={seed}>
      {children}
    </ServerSeedProvider>
  );
}
