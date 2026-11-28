import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

/** Auth gate only (server-side redirect — Suspense boundary ke bahar call karein). */
export async function requireJobsAuxSeedAuth(): Promise<void> {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");
}

/**
 * Seed data only (auth already done) — `SeedStream` ke liye.
 *
 * NAV PERF (audit, 29 Nov 2026): pehle layouts ye loader await karte the, isliye
 * RSC headers seed queries ke baad flush hote the aur click "freeze" lagta tha.
 */
export async function fetchJobsAuxSeedData<T>(
  label: string,
  loader: (supabase: SupabaseClient) => Promise<T>
): Promise<T | null> {
  try {
    const supabase = await getServerSupabase();
    return await loader(supabase);
  } catch (e) {
    logger.warn(`${label} seed fetch failed — client fetch karega:`, e);
    return null;
  }
}

/**
 * Jobs auxiliary route layouts (`bulk`, `bulk-edit`, `combined-invoice`,
 * `spot-labels`) ka purana common seed loader: auth gate + cookie/RLS server
 * client. Backward-compatible; naye layouts `SeedStream` ke saath
 * `requireJobsAuxSeedAuth` + `fetchJobsAuxSeedData` use karein.
 * Failure par `null` — page apna puraan client fetch chalata hai.
 */
export async function loadJobsAuxSeed<T>(
  label: string,
  loader: (supabase: SupabaseClient) => Promise<T>
): Promise<T | null> {
  await requireJobsAuxSeedAuth();
  return fetchJobsAuxSeedData(label, loader);
}
