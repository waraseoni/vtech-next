import { loadStaffSeed } from "@/lib/server-seed";
import { ServerSeedProvider } from "@/app/components/ServerSeed";
import { fetchLocateSeed } from "../locateSeed";

export const dynamic = "force-dynamic";

export default async function LocateLayout({ children }: { children: React.ReactNode }) {
  const seed = await loadStaffSeed("Inventory locate", (supabase) => fetchLocateSeed(supabase));

  return (
    <ServerSeedProvider seedKey="inventory-locate" data={seed}>
      {children}
    </ServerSeedProvider>
  );
}
