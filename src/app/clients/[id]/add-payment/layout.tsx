import { Users } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import { SeedStream } from "@/components/SeedStream";
import { fetchClientPaymentSeed } from "../../clientActionQueries";
import { fetchClientSeedData, requireClientSeedAuth } from "@/lib/server-client-seed";
import { ClientActionSeedProvider } from "../ClientActionSeed";

// NAV PERF (audit, 29 Nov 2026): seed ab Suspense ke andar stream hota hai.
// Pehle `await loadClientSeed(...)` tha → RSC headers DB ke baad flush hote the
// aur click ke baad page freeze lagta tha. Auth gate yahan hi (bahar) hai taaki
// unauth redirect server-side rahe.
export const dynamic = "force-dynamic";

export default async function AddPaymentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireClientSeedAuth();
  const { id } = await params;
  const seedPromise = fetchClientSeedData(id, "Client payment", fetchClientPaymentSeed);

  return (
    <SeedStream
      promise={seedPromise}
      fallback={<PageLoader icon={Users} label="Loading payment form..." tone="blue" />}
    >
      {(seed) => (
        <ClientActionSeedProvider seed={seed ? { kind: "pay", data: seed } : null}>
          {children}
        </ClientActionSeedProvider>
      )}
    </SeedStream>
  );
}
