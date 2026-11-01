import { redirect } from "next/navigation";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { fetchJobViewData, type JobViewSnapshot } from "./jobViewQueries";
import JobViewSeedProvider from "./JobViewSeedProvider";

// Jobs detail ka pehla paint server par — pehle client par 4 sequential waves
// chalti thi (job → prev/next → detail → names). Query semantics neutral
// jobViewQueries.ts me hai (client wrapper bhi wahi call karta hai).
export const dynamic = "force-dynamic";

export default async function JobViewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  const { id } = await params;
  const numId = Number(id?.trim());
  let seed: JobViewSnapshot | null = null;

  if (Number.isFinite(numId) && numId > 0) {
    try {
      const supabase = await getServerSupabase();
      seed = await fetchJobViewData(supabase, numId, session.role);
    } catch (e) {
      // Not found / query fail → client aaj jaisa fetch karega (aur error par
      // /jobs redirect karega). Page ko block nahi karte.
      logger.warn("Job view seed fetch failed — client fetch karega:", e);
    }
  }

  return <JobViewSeedProvider seed={seed}>{children}</JobViewSeedProvider>;
}
