import { fetchClientEditSeed } from "../../clientActionQueries";
import { loadClientSeed } from "@/lib/server-client-seed";
import { ClientActionSeedProvider } from "../ClientActionSeed";

export const dynamic = "force-dynamic";

export default async function ClientEditLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seed = await loadClientSeed(id, "Client edit", fetchClientEditSeed);

  return (
    <ClientActionSeedProvider seed={seed ? { kind: "edit", data: seed } : null}>
      {children}
    </ClientActionSeedProvider>
  );
}
