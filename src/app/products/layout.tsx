import { loadStaffSeed } from "@/lib/server-seed";
import { ServerSeedProvider } from "@/app/components/ServerSeed";
import { fetchProductsSeed } from "./productsSeed";

export const dynamic = "force-dynamic";

export default async function ProductsLayout({ children }: { children: React.ReactNode }) {
  const seed = await loadStaffSeed("Products", (supabase) => fetchProductsSeed(supabase));

  return (
    <ServerSeedProvider seedKey="products" data={seed}>
      {children}
    </ServerSeedProvider>
  );
}
