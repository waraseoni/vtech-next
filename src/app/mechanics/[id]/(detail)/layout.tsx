import { loadStaffSeed } from "@/lib/server-seed";
import { ServerSeedProvider } from "@/app/components/ServerSeed";
import { fetchMechanicDetailSeed } from "../../mechanicDetailSeed";

export const dynamic = "force-dynamic";

export default async function MechanicDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mechanicId = Number(id);
  const seed = Number.isFinite(mechanicId)
    ? await loadStaffSeed("Mechanic detail", (supabase) =>
        fetchMechanicDetailSeed(supabase, mechanicId)
      )
    : null;

  return (
    <ServerSeedProvider seedKey="mechanic-detail" data={seed}>
      {children}
    </ServerSeedProvider>
  );
}
