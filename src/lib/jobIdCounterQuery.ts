import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Neutral (server + client) read for the next-job-id PREVIEW. `jobIdCounter`
 * ka client wrapper isi ko call karta hai — RPC/filter semantics same.
 */

// PHP legacy ka last job id fallback (agar counter ya transactions na ho).
export const FALLBACK_LAST_JOB_ID = 28101;

/** PREVIEW ONLY — counter bump nahi karta (`next_job_id` claim se alag). */
export async function fetchPeekNextJobIdWith(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("peek_next_job_id");
  if (!error && typeof data === "number" && data > 0) return data;

  const { data: row } = await supabase
    .from("job_id_counter")
    .select("last_job_id")
    .eq("id", 1)
    .maybeSingle();
  if (row?.last_job_id) return Number(row.last_job_id) + 1;
  return FALLBACK_LAST_JOB_ID + 1;
}
