import { fetchClientPaymentSeed } from "../../clientActionQueries";
import { loadClientSeed } from "@/lib/server-client-seed";
import { ClientActionSeedProvider } from "../ClientActionSeed";

export const dynamic = "force-dynamic";

export default async function AddPaymentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seed = await loadClientSeed(id, "Client payment", fetchClientPaymentSeed);

  return (
    <ClientActionSeedProvider seed={seed ? { kind: "pay", data: seed } : null}>
      {children}
    </ClientActionSeedProvider>
  );
}
