import { fetchClientBalanceSeed } from "../../clientActionQueries";
import { loadClientSeed } from "@/lib/server-client-seed";
import { ClientActionSeedProvider } from "../ClientActionSeed";

export const dynamic = "force-dynamic";

export default async function GiveLoanLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seed = await loadClientSeed(id, "Client loan", fetchClientBalanceSeed);

  return (
    <ClientActionSeedProvider seed={seed ? { kind: "balance", data: seed } : null}>
      {children}
    </ClientActionSeedProvider>
  );
}
