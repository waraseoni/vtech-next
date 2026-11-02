import { loadStaffSeed } from "@/lib/server-seed";
import { ServerSeedProvider } from "@/app/components/ServerSeed";
import { fetchInventoryDetailSeed } from "../inventoryDetailSeed";

export const dynamic = "force-dynamic";

export default async function InventoryDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productId = Number(id);
  const seed = Number.isFinite(productId)
    ? await loadStaffSeed("Inventory detail", (supabase) =>
        fetchInventoryDetailSeed(supabase, productId)
      )
    : null;

  return (
    <ServerSeedProvider seedKey="inventory-detail" data={seed}>
      {children}
    </ServerSeedProvider>
  );
}
