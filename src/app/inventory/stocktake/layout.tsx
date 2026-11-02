import { loadStaffSeed } from "@/lib/server-seed";
import { ServerSeedProvider } from "@/app/components/ServerSeed";
import { fetchStocktakeSeed } from "../stocktakeSeed";

export const dynamic = "force-dynamic";

export default async function StocktakeLayout({ children }: { children: React.ReactNode }) {
  const seed = await loadStaffSeed("Inventory stocktake", (supabase) => fetchStocktakeSeed(supabase));

  return (
    <ServerSeedProvider seedKey="inventory-stocktake" data={seed}>
      {children}
    </ServerSeedProvider>
  );
}
