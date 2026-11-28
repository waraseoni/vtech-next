import { UserPlus } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import { SeedStream } from "@/components/SeedStream";
import AddDirectSaleClient from "./client";
import { fetchStaffSeedData, requireStaffSeedAuth } from "@/lib/server-seed";
import { fetchAddDirectSaleSeed } from "./addDirectSaleSeed";

export const dynamic = "force-dynamic";

// Server-seeded first paint: client name (read-only client_list) yahan aa jata
// hai. Baaki form local state hai aur save `save_direct_sale` RPC se hi hota hai
// (is file me koi write nahi).
//
// NAV PERF (audit, 29 Nov 2026): pehle seed `await` hota tha aur Suspense uske
// BAAD tha — boundary ka koi faayda nahi tha. Ab seed Suspense ke andar.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffSeedAuth();
  const { id } = await params;
  const clientId = parseInt(id);

  const seedPromise = Number.isFinite(clientId)
    ? fetchStaffSeedData("Add direct sale", (supabase) =>
        fetchAddDirectSaleSeed(supabase, clientId)
      )
    : Promise.resolve(null);

  return (
    <SeedStream
      promise={seedPromise}
      fallback={<PageLoader icon={UserPlus} label="Loading sale form..." tone="blue" />}
    >
      {(initial) => <AddDirectSaleClient clientId={clientId} initial={initial} />}
    </SeedStream>
  );
}
