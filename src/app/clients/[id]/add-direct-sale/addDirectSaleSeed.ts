import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `/clients/[id]/add-direct-sale` ka read-only server seed — client ke
 * `fetchClient` effect ka mirror (sirf client name first paint ke liye).
 *
 * ZERO writes: submission `save_direct_sale` RPC client se hi hota hai.
 * Caller cookie+RLS client pass karta hai (service-role kabhi nahi).
 */

export type AddDirectSaleSeed = { clientId: number; clientName: string | null };

export async function fetchAddDirectSaleSeed(
  supabase: SupabaseClient,
  clientId: number
): Promise<AddDirectSaleSeed> {
  // NOTE: client `.single()` use karta hai (uske liye 0 rows = "fallback chalao").
  // Seed me `maybeSingle()` — client delete_flag=1 ho to error throw na ho,
  // bas clientName null rahe aur client apna purana fetch chala le.
  const { data, error } = await supabase
    .from("client_list")
    .select("firstname, middlename, lastname")
    .eq("id", clientId)
    .eq("delete_flag", 0)
    .maybeSingle();

  if (error) throw error;

  const clientName = data
    ? [data.firstname, data.middlename, data.lastname].filter(Boolean).join(" ")
    : null;

  return { clientId, clientName };
}
