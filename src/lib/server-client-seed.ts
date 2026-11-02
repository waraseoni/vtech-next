import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

/**
 * Clients route layouts ka common seed loader: auth gate + id parse + cookie/RLS
 * server client. Failure par `null` — page apna puraan client fetch chalata hai.
 * Service-role page reads me NEVER (G3 gate).
 */
export async function loadClientSeed<T>(
  id: string,
  label: string,
  loader: (supabase: SupabaseClient, clientId: number) => Promise<T>
): Promise<T | null> {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

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
