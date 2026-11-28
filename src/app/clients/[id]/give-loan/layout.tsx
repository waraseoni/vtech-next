import { Users } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import { SeedStream } from "@/components/SeedStream";
import { fetchClientBalanceSeed } from "../../clientActionQueries";
import { fetchClientSeedData, requireClientSeedAuth } from "@/lib/server-client-seed";
import { ClientActionSeedProvider } from "../ClientActionSeed";

// NAV PERF (audit, 29 Nov 2026): seed Suspense ke andar stream hota hai.
export const dynamic = "force-dynamic";

export default async function GiveLoanLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireClientSeedAuth();
  const { id } = await params;
  const seedPromise = fetchClientSeedData(id, "Client loan", fetchClientBalanceSeed);

  return (
    <SeedStream
      promise={seedPromise}
      fallback={<PageLoader icon={Users} label="Loading loan form..." tone="blue" />}
    >
      {(seed) => (
        <ClientActionSeedProvider seed={seed ? { kind: "balance", data: seed } : null}>
          {children}
        </ClientActionSeedProvider>
      )}
    </SeedStream>
  );
}
