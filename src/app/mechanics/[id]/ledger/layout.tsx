import { loadStaffSeed } from "@/lib/server-seed";
import { ServerSeedProvider } from "@/app/components/ServerSeed";
import { fetchMechanicLedgerSeed } from "../../mechanicLedgerSeed";

export const dynamic = "force-dynamic";

export default async function MechanicLedgerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mechanicId = Number(id);
  const seed = Number.isFinite(mechanicId)
    ? await loadStaffSeed("Mechanic daily ledger", (supabase) =>
        fetchMechanicLedgerSeed(supabase, mechanicId)
      )
    : null;

  return (
    <ServerSeedProvider seedKey="mechanic-ledger" data={seed}>
      {children}
    </ServerSeedProvider>
  );
}
