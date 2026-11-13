import { Suspense } from "react";
import { Briefcase } from "lucide-react";
import { redirect } from "next/navigation";
import PageLoader from "@/components/PageLoader";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { fetchJobViewData, type JobViewSnapshot } from "./jobViewQueries";
import JobViewSeedProvider from "./JobViewSeedProvider";

// Jobs detail ka pehla paint server par — pehle client par 4 sequential waves
// chalti thi (job → prev/next → detail → names). Query semantics neutral
// jobViewQueries.ts me hai (client wrapper bhi wahi call karta hai).
//
// STREAMING (perf, 13 Nov 2026): pehle layout seed ko `await` karta tha, isliye
// RSC response ke headers hi ~400ms baad jaate the — edit page se
// `router.replace()` isi response ka wait karta hai, to save ke baad redirect
// late lagta tha. Ab seed fetch Suspense boundary ke andar hai: shell + skeleton
// turant stream hota hai (URL instant badalta hai), data thodi der me aata hai.
export const dynamic = "force-dynamic";

/** Seed resolve hone tak ka halka loader (RSC — badges wala shared PageLoader). */
function JobViewStreamFallback() {
  return <PageLoader icon={Briefcase} label="Loading job..." tone="cyan" />;
}

/** Seed promise ko resolve karke provider + page render karta hai. */
async function JobViewSeedBoundary({
  seedPromise,
  children,
}: {
  seedPromise: Promise<JobViewSnapshot | null>;
  children: React.ReactNode;
}) {
  const seed = await seedPromise;
  return <JobViewSeedProvider seed={seed}>{children}</JobViewSeedProvider>;
}

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

  // Fetch start karo par await mat karo — Suspense boundary iske resolve hone
  // par stream karti hai, shell pehle.
  const seedPromise: Promise<JobViewSnapshot | null> =
    Number.isFinite(numId) && numId > 0
      ? (async () => {
          try {
            const supabase = await getServerSupabase();
            return await fetchJobViewData(supabase, numId, session.role);
          } catch (e) {
            // Not found / query fail → client aaj jaisa fetch karega (aur error
            // par /jobs redirect karega). Page ko block nahi karte.
            logger.warn("Job view seed fetch failed — client fetch karega:", e);
            return null;
          }
        })()
      : Promise.resolve(null);

  return (
    <Suspense fallback={<JobViewStreamFallback />}>
      <JobViewSeedBoundary seedPromise={seedPromise}>{children}</JobViewSeedBoundary>
    </Suspense>
  );
}
