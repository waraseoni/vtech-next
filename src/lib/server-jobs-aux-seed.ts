import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

/**
 * Jobs auxiliary route layouts (`bulk`, `bulk-edit`, `combined-invoice`,
 * `spot-labels`) ka common seed loader: auth gate + cookie/RLS server client.
 * Failure par `null` — page apna puraan client fetch chalata hai.
 */
export async function loadJobsAuxSeed<T>(
  label: string,
  loader: (supabase: SupabaseClient) => Promise<T>
): Promise<T | null> {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  try {
    const supabase = await getServerSupabase();
    return await loader(supabase);
  } catch (e) {
    logger.warn(`${label} seed fetch failed — client fetch karega:`, e);
    return null;
  }
}
