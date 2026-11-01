import { getServerSupabase, type ServerUser } from "@/lib/api-auth";
import { fetchJobFormMasters, type JobFormSeed } from "@/app/jobs/jobFormQueries";

/**
 * New/Edit job form ka server seed. Auth layout me hota hai (redirect), yahan
 * sirf data: masters + logged-in user ka numeric id. Query semantics neutral
 * jobFormQueries.ts me hain — client fallback bhi wahi use karta hai.
 */
export async function fetchJobFormSeed(session: {
  user: ServerUser;
  role: string;
}): Promise<JobFormSeed> {
  const supabase = await getServerSupabase();
  const [masters, profileRes] = await Promise.all([
    fetchJobFormMasters(supabase),
    supabase.from("profiles").select("mechanic_id").eq("id", session.user.id).single(),
  ]);

  return {
    ...masters,
    currentUserId: (profileRes.data as { mechanic_id?: number } | null)?.mechanic_id ?? 0,
    userRole: session.role,
  };
}
