import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

/**
 * Staff route layouts ka common seed loader: auth gate + cookie/RLS server
 * client. Failure par `null` — page apna purana client fetch chalata hai.
 * Service-role yahan kabhi nahi (page reads RLS ke through).
 *
 * PERF (17 Nov 2026): seed loader auth ke SAATH parallel start hota hai —
 * pehle `requireStaffWithRole()` (profiles RTT) ke BAAD hi seed queries
 * shuru hoti thin, isliye har seed page 1 extra RTT deta tha. Seed queries
 * cookie+RLS par chalti hain (auth result ki zaroorat nahi). Unauthenticated
 * request par RLS khali result deta hai aur redirect ho jata hai — jobs page
 * bhi yahi pattern use karta hai.
 */
export async function loadStaffSeed<T>(
  label: string,
  loader: (supabase: SupabaseClient) => Promise<T>
): Promise<T | null> {
  const supabase = await getServerSupabase();
  const seedPromise: Promise<T | null> = loader(supabase).catch((e) => {
    logger.warn(`${label} seed fetch failed — client fetch karega:`, e);
    return null;
  });
  // Redirect path par bhi rejection handled rahe (warna unhandled warning).
  void seedPromise.catch(() => {});

  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  return seedPromise;
}

/** Auth gate only (server-side redirect — Suspense boundary ke bahar call karein). */
export async function requireStaffSeedAuth(): Promise<void> {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");
}

/**
 * Seed data only (auth already done) — `SeedStream` ke liye.
 *
 * NAV PERF (audit, 29 Nov 2026): page/layout me `await loadStaffSeed(...)` karne
 * se RSC headers DB ke baad flush hote the. Ab promise Suspense ke andar resolve
 * hoti hai → skeleton turant stream hota hai.
 */
export async function fetchStaffSeedData<T>(
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
