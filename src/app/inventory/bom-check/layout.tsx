import { loadStaffSeed } from "@/lib/server-seed";
import { ServerSeedProvider } from "@/app/components/ServerSeed";
import { fetchBomCheckSeed } from "../bomCheckSeed";

export const dynamic = "force-dynamic";

export default async function BomCheckLayout({ children }: { children: React.ReactNode }) {
  const seed = await loadStaffSeed("Inventory BOM check", (supabase) => fetchBomCheckSeed(supabase));

  return (
    <ServerSeedProvider seedKey="inventory-bom-check" data={seed}>
      {children}
    </ServerSeedProvider>
  );
}
