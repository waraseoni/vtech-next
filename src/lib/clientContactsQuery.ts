import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Neutral `client_contacts` reads — SupabaseClient caller deta hai, isliye ye
 * module server (RSC seed, cookie+RLS client) aur browser dono me chalta hai.
 * Browser-only `@/lib/supabase` yahan import NAHI hota.
 */

export type ClientContact = {
  id?: number;
  client_id: number;
  name: string;
  label: string;
  phone: string;
  is_primary: boolean;
};

/** Ek client ke contacts load karo (primary pehle). */
export async function fetchClientContactsWith(
  supabase: SupabaseClient,
  clientId: number
): Promise<ClientContact[]> {
  const { data, error } = await supabase
    .from("client_contacts")
    .select("id, client_id, name, label, phone, is_primary")
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`client_contacts load fail: ${error.message}`);
  }
  return (data || []) as ClientContact[];
}
