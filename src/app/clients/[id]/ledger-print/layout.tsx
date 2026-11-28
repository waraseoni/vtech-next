import { Receipt } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import { SeedStream } from "@/components/SeedStream";
import { fetchClientLedgerSeed } from "../../clientLedgerQueries";
import { fetchClientSeedData, requireClientSeedAuth } from "@/lib/server-client-seed";
import ClientLedgerSeedProvider from "./ClientLedgerSeedProvider";

// NAV PERF (audit, 29 Nov 2026): ledger seed (11 queries / 3 waves) Suspense ke
// andar stream hota hai — pehle yahan await tha, isliye print page ka RSC
// response ledger query ke baad hi shuru hota tha.
export const dynamic = "force-dynamic";

export default async function LedgerPrintLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireClientSeedAuth();
  const { id } = await params;
  const seedPromise = fetchClientSeedData(id, "Client ledger", fetchClientLedgerSeed);

  return (
    <SeedStream
      promise={seedPromise}
      fallback={<PageLoader icon={Receipt} label="Loading ledger..." tone="blue" />}
    >
      {(seed) => <ClientLedgerSeedProvider seed={seed}>{children}</ClientLedgerSeedProvider>}
    </SeedStream>
  );
}
