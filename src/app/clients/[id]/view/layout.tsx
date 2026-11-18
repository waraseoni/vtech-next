import { Suspense } from "react";
import { Users } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import { fetchClientDetailData, type ClientDetail } from "../../clientDetailQueries";
import { loadClientSeed } from "@/lib/server-client-seed";
import ClientDetailSeedProvider from "./ClientDetailSeedProvider";

// Client profile ka pehla paint server par — pehle mount par 8 parallel client
// queries chalti thi. Query semantics neutral clientDetailQueries.ts me hai
// (browser wrapper bhi wahi function call karta hai).
//
// STREAMING: Suspense boundary ke sath stream hota hai taaki shell aur skeleton
// turant browser ko mile aur data stream-in kare.
export const dynamic = "force-dynamic";

function ClientViewStreamFallback() {
  return <PageLoader icon={Users} label="Loading client details..." tone="blue" />;
}

async function ClientViewSeedBoundary({
  seedPromise,
  children,
}: {
  seedPromise: Promise<ClientDetail | null>;
  children: React.ReactNode;
}) {
  const seed = await seedPromise;
  return <ClientDetailSeedProvider seed={seed}>{children}</ClientDetailSeedProvider>;
}

export default async function ClientViewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seedPromise: Promise<ClientDetail | null> = loadClientSeed<ClientDetail>(
    id,
    "Client view",
    fetchClientDetailData
  );

  return (
    <Suspense fallback={<ClientViewStreamFallback />}>
      <ClientViewSeedBoundary seedPromise={seedPromise}>{children}</ClientViewSeedBoundary>
    </Suspense>
  );
}
