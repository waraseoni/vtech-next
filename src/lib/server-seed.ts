import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

/**
 * Staff route layouts ka common seed loader: auth gate + cookie/RLS server
 * client. Failure par `null` — page apna purana client fetch chalata hai.
 * Service-role yahan kabhi nahi (page reads RLS ke through).
 */
export async function loadStaffSeed<T>(
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
