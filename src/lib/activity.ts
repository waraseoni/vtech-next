import { supabase, getCachedUser } from "./supabase";
import { takeGeoAudit } from "./geoAudit";
import { logger } from "@/lib/logger";

/**
 * Logs a system activity into the activity_logs table
 * @param action - Descriptive action (e.g., 'Created Client', 'Updated Job Status')
 * @param module - The module name (e.g., 'Clients', 'Jobs', 'Inventory')
 * @param metaId - The unique ID of the record being acted upon
 * @param details - Extra JSON or text details about the change
 */
export async function logActivity(
  action: string,
  module: string,
  metaId?: string | number,
  details?: string
) {
  try {
    const {
      data: { user },
    } = await getCachedUser();
    if (!user) return;

    // Get the numeric mechanic_id from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("mechanic_id, role")
      .eq("id", user.id)
      .single();

    // Map UUID to Integer for DB compatibility.
    // Use mechanic_id when available (so full names resolve on every page),
    // fall back to 0 (Admin) only for accounts with no linked mechanic.
    const numericUserId = profile?.mechanic_id || 0;

    // ── Geofence per-write tagging (Phase 6, user demand) ────────────────
    // Bahar se hua kaam (fresh outside/permit context) → geo_* cols + details
    // suffix, taaki jobs/activity history me "kahan se hua" dikhe. Office se
    // hua kaam bilkul as-is (geo null → purana insert, purane readers safe).
    // Signature UNCHANGED — 100+ callers untouched, cache auto-read hota hai.
    const geo = takeGeoAudit();
    const baseRow = {
      user_id: numericUserId,
      action: action,
      module: module,
      meta_id: metaId?.toString(),
      details: details || "",
      date_created: new Date().toISOString(),
    };
    if (!geo) {
      const { error } = await supabase.from("activity_logs").insert(baseRow);
      if (error) {
        logger.warn("Activity log insert failed:", error.message);
      }
      return;
    }
    const taggedDetails =
      `${details || ""}\n📍 Bahar ~${geo.distanceM}m se${geo.permit ? " (permit par)" : ""}`.trim();
    const taggedRow = {
      ...baseRow,
      details: taggedDetails,
      geo_lat: geo.lat,
      geo_lng: geo.lng,
      geo_distance_m: geo.distanceM,
    };
    const { error } = await supabase.from("activity_logs").insert(taggedRow);
    if (error) {
      // Migration abhi apply nahi hui (columns missing) → plain retry taaki
      // deploy-order safe rahe (log bache, geo skip). Baaki errors = warn.
      const missingCols =
        error.code === "42703" || /geo_lat|geo_lng|geo_distance_m/i.test(error.message);
      if (missingCols) {
        const { error: retryErr } = await supabase.from("activity_logs").insert(baseRow);
        if (retryErr) logger.warn("Activity log insert failed:", retryErr.message);
      } else {
        logger.warn("Activity log insert failed:", error.message);
      }
    }
  } catch (err) {
    logger.error("Critical error in logActivity:", err);
  }
}
