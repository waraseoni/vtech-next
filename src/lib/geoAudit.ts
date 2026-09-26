// ─── Geo audit context — per-write location tagging ───────────────────────
// Staff geofence Phase 6 (user demand): bahar se hua HAR kaam activity_logs
// me location ke saath; office se hua kaam as-is (null = no tag).
//
// Flow: ViewOnlyProvider har check par `setGeoAudit()` likhta hai (memory
// only, same tab). `logActivity()` har insert se pehle `takeGeoAudit()`
// padhta hai — ZERO call-site change (100+ logActivity callers untouched).
//
// Alag module isliye taaki cycle na bane (viewOnly → activity import karta
// hai; activity → yahan padhta hai; yahan se koi import nahi).
//
// Privacy: precise coords sirf tab jab staff OFFICE SE BAHAR + coords mile.
// Inside/unknown/denied (no coords) → null → entry as-is.

export interface GeoAuditCtx {
  lat: number;
  lng: number;
  distanceM: number;
  permit: boolean;
  atMs: number;
}

let last: GeoAuditCtx | null = null;

/** ViewOnlyProvider har location-check par bulata hai (coords hon ya na hon). */
export function setGeoAudit(
  ctx: { lat: number; lng: number; distanceM: number; permit: boolean } | null
): void {
  last = ctx ? { ...ctx, atMs: Date.now() } : null;
}

/**
 * logActivity ke liye: fresh (10-min TTL) bahar-context ho to do, warna null.
 * Inside-office checks kabhi tag nahi karte (provider sirf outside/permit
 * par coords deta hai) — "office se kaam jaisa hai waisa hi rahega".
 */
export function takeGeoAudit(maxAgeMs = 10 * 60000): GeoAuditCtx | null {
  if (!last) return null;
  if (Date.now() - last.atMs > maxAgeMs) {
    last = null;
    return null;
  }
  return last;
}
