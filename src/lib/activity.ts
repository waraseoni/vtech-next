import { supabase } from "./supabase";

/**
 * Logs a system activity into the activity_logs table
 * @param action - Descriptive action (e.g., 'Created Client', 'Updated Job Status')
 * @param module - The module name (e.g., 'Clients', 'Jobs', 'Inventory')
 * @param metaId - The unique ID of the record being acted upon
 * @param details - Extra JSON or text details about the change
 */
export async function logActivity(action: string, module: string, metaId?: string | number, details?: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get the numeric mechanic_id from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("mechanic_id, role")
      .eq("id", user.id)
      .single();

    // Map UUID to Integer for DB compatibility
    // Admin = 0, Staff = mechanic_id
    const numericUserId = profile?.role === 'admin' ? 0 : (profile?.mechanic_id || 0);

    const { error } = await supabase
      .from("activity_logs")
      .insert({
        user_id: numericUserId,
        action: action,
        module: module,
        meta_id: metaId?.toString(),
        details: details || "",
        date_created: new Date().toISOString(),
      });

    if (error) {
      console.warn("Activity log insert failed:", error.message);
    }
  } catch (err) {
    console.error("Critical error in logActivity:", err);
  }
}
