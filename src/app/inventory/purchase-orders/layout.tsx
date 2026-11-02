import { loadStaffSeed } from "@/lib/server-seed";
import { ServerSeedProvider } from "@/app/components/ServerSeed";
import { fetchPurchaseOrdersSeed } from "../purchaseOrdersSeed";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersLayout({ children }: { children: React.ReactNode }) {
  const seed = await loadStaffSeed("Inventory purchase orders", (supabase) =>
    fetchPurchaseOrdersSeed(supabase)
  );

  return (
    <ServerSeedProvider seedKey="inventory-purchase-orders" data={seed}>
      {children}
    </ServerSeedProvider>
  );
}
