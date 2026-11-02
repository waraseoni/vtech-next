import { Suspense } from "react";
import AddDirectSaleClient from "./client";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchAddDirectSaleSeed } from "./addDirectSaleSeed";

export const dynamic = "force-dynamic";

// Server-seeded first paint: client name (read-only client_list) yahan aa jata
// hai. Baaki form local state hai aur save `save_direct_sale` RPC se hi hota hai
// (is file me koi write nahi).
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = parseInt(id);
  const initial = Number.isFinite(clientId)
    ? await loadStaffSeed("Add direct sale", (supabase) =>
        fetchAddDirectSaleSeed(supabase, clientId)
      )
    : null;
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <AddDirectSaleClient clientId={clientId} initial={initial} />
    </Suspense>
  );
}
