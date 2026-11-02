import { fetchClientDetailData } from "../../clientDetailQueries";
import { loadClientSeed } from "@/lib/server-client-seed";
import ClientDetailSeedProvider from "./ClientDetailSeedProvider";

// Client profile ka pehla paint server par — pehle mount par 8 parallel client
// queries chalti thi. Query semantics neutral clientDetailQueries.ts me hai
// (browser wrapper bhi wahi function call karta hai).
export const dynamic = "force-dynamic";

export default async function ClientViewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seed = await loadClientSeed(id, "Client view", fetchClientDetailData);

  return <ClientDetailSeedProvider seed={seed}>{children}</ClientDetailSeedProvider>;
}
