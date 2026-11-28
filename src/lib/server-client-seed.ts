import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

/**
 * Auth gate (server-side `redirect` — Suspense boundary ke bahar hi call karein).
 * Layouts jo seed stream karte hain, wo pehle ye chalate hain, phir
 * `fetchClientSeedData` ka promise `SeedStream` ko dete hain.
 */
export async function requireClientSeedAuth(): Promise<void> {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");
}

/**
 * Seed data ONLY (auth already done) — `SeedStream` ke liye.
 *
 * NAV PERF (audit, 29 Nov 2026): pehle layouts `loadClientSeed` ko await karte
 * the, isliye RSC headers DB ke baad flush hote the aur click "freeze" lagta
 * tha. Ab layout sirf auth await karta hai (fast, ek profiles read) aur ye
 * promise Suspense ke andar resolve hoti hai → skeleton turant stream hota hai.
 *
 * Failure par `null` — page apna client fallback fetch chalata hai.
 * Service-role page reads me NEVER (G3 gate).
 */
export async function fetchClientSeedData<T>(
  id: string,
  label: string,
  loader: (supabase: SupabaseClient, clientId: number) => Promise<T>
): Promise<T | null> {
  const numId = Number(id?.trim());
  if (!Number.isFinite(numId) || numId <= 0) return null;

  try {
    const supabase = await getServerSupabase();
    return await loader(supabase, numId);
  } catch (e) {
    logger.warn(`${label} seed fetch failed — client fetch karega:`, e);
    return null;
  }
}

/**
 * Clients route layouts ka purana common seed loader: auth gate + id parse +
 * cookie/RLS server client. Backward-compatible — naye layouts `SeedStream` ke
 * saath `requireClientSeedAuth` + `fetchClientSeedData` use karein.
 */
export async function loadClientSeed<T>(
  id: string,
  label: string,
  loader: (supabase: SupabaseClient, clientId: number) => Promise<T>
): Promise<T | null> {
  await requireClientSeedAuth();
  return fetchClientSeedData(id, label, loader);
}
