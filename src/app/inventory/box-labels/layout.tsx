import { loadStaffSeed } from "@/lib/server-seed";
import { ServerSeedProvider } from "@/app/components/ServerSeed";
import { fetchBoxLabelsSeed } from "../boxLabelsSeed";

export const dynamic = "force-dynamic";

export default async function BoxLabelsLayout({ children }: { children: React.ReactNode }) {
  const seed = await loadStaffSeed("Inventory box labels", (supabase) =>
    fetchBoxLabelsSeed(supabase)
  );

  return (
    <ServerSeedProvider seedKey="inventory-box-labels" data={seed}>
      {children}
    </ServerSeedProvider>
  );
}
