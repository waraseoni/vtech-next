import { fetchClientLedgerSeed } from "../../clientLedgerQueries";
import { loadClientSeed } from "@/lib/server-client-seed";
import ClientLedgerSeedProvider from "./ClientLedgerSeedProvider";

export const dynamic = "force-dynamic";

export default async function LedgerPrintLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seed = await loadClientSeed(id, "Client ledger", fetchClientLedgerSeed);

  return <ClientLedgerSeedProvider seed={seed}>{children}</ClientLedgerSeedProvider>;
}
