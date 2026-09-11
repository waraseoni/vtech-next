import { supabase } from "@/lib/supabase";

// Job ID counter — job_id_counter (id=1) DB ka authoritative source hai.
// PHP legacy ka last job id fallback (agar counter ya transactions na ho).
export const FALLBACK_LAST_JOB_ID = 28101;

// Sabhi entry points (new / quick create / bulk) isi se next job_id lete hain.
// Sabse pehle ATOMIC RPC claim karo (20260916 migration) — read+increment+return
// ek hi statement me hota hai, isliye concurrent saves kabhi same id nahi pa
// sakte. Migration apply na hone par fallback: counter row ya max job_id + 1.
export async function getNextJobId(): Promise<number> {
  // Preferred: atomic counter claim (concurrency-safe).
  const { data, error } = await supabase.rpc("next_job_id");
  if (!error && typeof data === "number" && data > 0) return data;

  // Fallback (RPC migration SQL editor me apply na hone tak) — read-then-write,
  // race-scenario bacha sakta hai, isliye client re-entrancy guard bhi hai.
  const { data: row } = await supabase
    .from("job_id_counter")
    .select("last_job_id")
    .eq("id", 1)
    .maybeSingle();

  if (row?.last_job_id) return Number(row.last_job_id) + 1;

  let max = FALLBACK_LAST_JOB_ID;
  const { data: jobs } = await supabase
    .from("transaction_list")
    .select("job_id")
    .order("job_id", { ascending: false })
    .limit(1000);
  for (const j of jobs || []) {
    const n = Number(j.job_id);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

// Save ke baad counter bump — upsert taaki row missing ho to ban jaye
// (pehle `.eq("id",1).update()` khaali table par 0 rows chhod deta tha).
export async function bumpJobCounter(lastJobId: number): Promise<void> {
  const { data: existing } = await supabase
    .from("job_id_counter")
    .select("last_job_id")
    .eq("id", 1)
    .maybeSingle();
  const target = Math.max(existing?.last_job_id || 0, lastJobId);
  await supabase
    .from("job_id_counter")
    .upsert({ id: 1, last_job_id: target }, { onConflict: "id" });
}
