// ─────────────────────────────────────────────────────────────
// SESSION POLICY — saare session timings ka SINGLE source of truth.
// Pehle ye values RootClient / PortalGate / proxy.ts me alag-alag
// hardcoded thi (client 10min, portal 15min, staff 30min, cap 8h)
// → login/logout behavior uneven ho gaya tha. Ab ek jagah se.
// ─────────────────────────────────────────────────────────────

/** Inactivity idle timeout — SAB roles (admin/staff/developer/client) ke liye SAME */
export const IDLE_MINUTES = 30;
export const IDLE_MS = IDLE_MINUTES * 60 * 1000;

/** Logout se itne min pehle warning modal dikhta hai */
export const WARN_BEFORE_MIN = 2;
export const WARN_BEFORE_MS = WARN_BEFORE_MIN * 60 * 1000;

/** Absolute hard cap — kitna bhi active raho, isse lamba session nahi chalega */
export const ABSOLUTE_HOURS = 8;
export const ABSOLUTE_MS = ABSOLUTE_HOURS * 60 * 60 * 1000;

/** Client-portal revoke re-check interval + kitne CONSECUTIVE 401 par hi real revoke mane */
export const REVOKED_CHECK_MS = 60 * 1000;
export const REVOKED_401_TOLERANCE = 2;

/** Portal gate (double-password area) inactivity lock — auth session se alag concern hai */
export const PORTAL_LOCK_MINUTES = 15;
export const PORTAL_LOCK_MS = PORTAL_LOCK_MINUTES * 60 * 1000;

/** Cross-tab activity timestamp yahan mirror hota hai (localStorage) */
export const LAST_ACTIVE_KEY = "vtech_last_active";

/** system_info meta_field keys — Settings > Auto Logoff/Session se set hote hain.
 *  "auto_logout_minutes" = "0" matlab Never (auto logout off). */
export const AUTO_LOGOUT_MINUTES_KEY = "auto_logout_minutes";
export const AUTO_LOGOUT_WARN_KEY = "auto_logout_warn_minutes";
