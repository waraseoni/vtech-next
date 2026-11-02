import { loadStaffSeed } from "@/lib/server-seed";
import { ServerSeedProvider } from "@/app/components/ServerSeed";
import { fetchCommissionSeed } from "../commissionSeed";

export const dynamic = "force-dynamic";

export default async function CommissionLayout({ children }: { children: React.ReactNode }) {
  const seed = await loadStaffSeed("Mechanics commission", (supabase) =>
    fetchCommissionSeed(supabase)
  );

  return (
    <ServerSeedProvider seedKey="mechanic-commission" data={seed}>
      {children}
    </ServerSeedProvider>
  );
}
