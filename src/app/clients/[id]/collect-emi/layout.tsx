import { fetchClientEmiSeed } from "../../clientActionQueries";
import { loadClientSeed } from "@/lib/server-client-seed";
import { ClientActionSeedProvider } from "../ClientActionSeed";

export const dynamic = "force-dynamic";

export default async function CollectEmiLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seed = await loadClientSeed(id, "Client EMI", fetchClientEmiSeed);

  return (
    <ClientActionSeedProvider seed={seed ? { kind: "emi", data: seed } : null}>
      {children}
    </ClientActionSeedProvider>
  );
}
