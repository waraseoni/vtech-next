import { loadStaffSeed } from "@/lib/server-seed";
import { ServerSeedProvider } from "@/app/components/ServerSeed";
import { fetchLocationsSeed } from "../locationsSeed";

export const dynamic = "force-dynamic";

export default async function LocationsLayout({ children }: { children: React.ReactNode }) {
  const seed = await loadStaffSeed("Inventory locations", (supabase) => fetchLocationsSeed(supabase));

  return (
    <ServerSeedProvider seedKey="inventory-locations" data={seed}>
      {children}
    </ServerSeedProvider>
  );
}
