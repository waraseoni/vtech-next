// ─── Staff Geofence View-Only (Tier A soft, fail-closed) ─────────────────────
// docs/plans/staff_geofence_viewonly_plan.md §4 (Tier A) + §5 (permit).
// Phase-0 decisions (2026-09-25): Tier A soft · fail-closed · permit ON.
//
// Design:
//   * `decideViewOnly()` PURE hai (role + geo + permit → verdict) — vitest me
//     covered. Hook sirf data laata hai (geolocation + permit query).
//   * `viewOnly=true` par UI: ViewOnlyBanner (RootClient) + `CanWrite` wraps
//     (incremental — har form me hathyar nahi).
//   * Fail-closed (D2): GPS denied/unavailable/timeout/unsupported → staff ke
//     liye viewOnly TRUE (likh nahi sakta) + Hindi reason.
//   * Permit expiry hamesha DB-time se: query me `expires_at > now()` filter
//     (client clock par trust nahi — plan §5.5). minsLeft sirf display.
//   * Non-staff (admin/developer/client) kabhi lock nahi (D3).
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase, getCachedUser } from "@/lib/supabase";
import { logActivity } from "@/lib/activity";
import { setGeoAudit } from "@/lib/geoAudit";
import {
  verifyAttendanceLocation,
  type GeoResult,
} from "@/lib/geofence";
import { toast } from "@/lib/toast";
import { logger } from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────

export type ViewOnlyStatus =
  | "unknown" // check abhi chal raha / chala hi nahi
  | "bypass" // non-staff — kabhi lock nahi
  | "disabled" // geofence off — sab likh sakte
  | "inside" // office ke andar — write allowed
  | "permit" // bahar par active permit — write allowed
  | "outside" // bahar, permit nahi — VIEW ONLY
  | "no-config" // geofence set hi nahi — write allowed + admin ko bolo
  | "denied" // GPS permission denied — fail-closed VIEW ONLY
  | "unavailable" // GPS unavailable — fail-closed VIEW ONLY
  | "timeout" // GPS timeout — fail-closed VIEW ONLY
  | "unsupported"; // browser me geolocation nahi — fail-closed VIEW ONLY

export interface ViewOnlyPermit {
  expiresAt: string;
  minsLeft: number;
}

export interface ViewOnlyState {
  viewOnly: boolean;
  status: ViewOnlyStatus;
  distanceM: number | null;
  needsConfig: boolean;
  permit: ViewOnlyPermit | null;
  checkedAt: number | null;
  checking: boolean;
  refresh: () => void;
}

// ─── Pure core (vitest-covered) ───────────────────────────────────────────

export function decideViewOnly(args: {
  role: string | null | undefined;
  geoReason: GeoResult["reason"] | "unknown";
  permitActive: boolean;
}): { viewOnly: boolean; status: ViewOnlyStatus } {
  const { role, geoReason, permitActive } = args;
  // D3: admin/developer/client kabhi lock nahi (role null = unknown → safe side: lock nahi, check baad me)
  if (role && role !== "staff") return { viewOnly: false, status: "bypass" };
  if (!role) return { viewOnly: false, status: "unknown" };
  // staff:
  if (geoReason === "disabled") return { viewOnly: false, status: "disabled" };
  if (geoReason === "no-config") return { viewOnly: false, status: "no-config" };
  if (geoReason === "ok") return { viewOnly: false, status: "inside" };
  if (geoReason === "outside") {
    return permitActive
      ? { viewOnly: false, status: "permit" }
      : { viewOnly: true, status: "outside" };
  }
  // D2 fail-closed: denied / unavailable / timeout / unsupported
  return { viewOnly: true, status: geoReason as ViewOnlyStatus };
}

export function permitMinsLeft(expiresAt: string, nowMs = Date.now()): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - nowMs) / 60000));
}

// ─── Permit query (DB-time expiry filter) ─────────────────────────────────

async function fetchActivePermit(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("staff_geofence_permit")
    .select("expires_at")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.warn("Permit check failed:", error.message);
    return null;
  }
  return data?.expires_at ?? null;
}

// ─── Context ──────────────────────────────────────────────────────────────

const ViewOnlyContext = createContext<ViewOnlyState>({
  viewOnly: false,
  status: "unknown",
  distanceM: null,
  needsConfig: false,
  permit: null,
  checkedAt: null,
  checking: false,
  refresh: () => {},
});

export function useViewOnly(): ViewOnlyState {
  return useContext(ViewOnlyContext);
}

/** Guard for event handlers: `if (!canWrite()) return;` */
export function useWriteGuard(): () => boolean {
  const { viewOnly } = useViewOnly();
  return useCallback(() => {
    if (viewOnly) {
      toast.warning("View Only — aap office ke bahar hain. Changes sirf office ke andar se honge.");
      return false;
    }
    return true;
  }, [viewOnly]);
}

const RECHECK_MS = 5 * 60 * 1000; // 5-min interval (battery-friendly)

export function ViewOnlyProvider({
  role,
  children,
}: {
  role: string | null | undefined;
  children: React.ReactNode;
}) {
  const [geo, setGeo] = useState<GeoResult | null>(null);
  const [permitExp, setPermitExp] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (role !== "staff") return; // D3: sirf staff verify hota hai
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    try {
      const g = await verifyAttendanceLocation();
      setGeo(g);
      // ── Geo-audit cache (Phase 6): bahar + coords → per-write tagging;
      //     baaki sab (inside/denied/stale) → clear (purani location tag NA ho)
      const isOut = g.reason === "outside";
      if (isOut && g.coords && g.distanceM != null) {
        const {
          data: { user },
        } = await getCachedUser();
        let permitExp: string | null = null;
        if (user) permitExp = await fetchActivePermit(user.id);
        setPermitExp(permitExp);
        setGeoAudit({
          lat: g.coords.lat,
          lng: g.coords.lng,
          distanceM: Math.round(g.distanceM),
          permit: !!permitExp && new Date(permitExp).getTime() > Date.now(),
        });
      } else {
        setPermitExp(null);
        setGeoAudit(null);
      }
      setCheckedAt(Date.now());
    } catch (e) {
      logger.warn("ViewOnly check failed:", e);
      setGeoAudit(null);
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }, [role]);

  // Mount + focus/visibility + interval (plan §4.4)
  useEffect(() => {
    if (role !== "staff") return;
    check();
    const onVis = () => {
      if (document.visibilityState === "visible") check();
    };
    const onFocus = () => check();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    const t = setInterval(check, RECHECK_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      clearInterval(t);
    };
  }, [role, check]);

  const state = useMemo<ViewOnlyState>(() => {
    const verdict = decideViewOnly({
      role,
      geoReason: geo?.reason ?? "unknown",
      permitActive: !!permitExp && new Date(permitExp).getTime() > Date.now(),
    });
    // "unknown" geo + staff: pehle check se pehle lock NAHI (flashing se bacho) —
    // D2 fail-closed sirf KNOWN failure (denied/timeout/...) par lagta hai.
    const viewOnly = geo ? verdict.viewOnly : false;
    const status: ViewOnlyStatus = geo ? verdict.status : role === "staff" ? "unknown" : verdict.status;
    return {
      viewOnly,
      status,
      distanceM: geo?.distanceM ?? null,
      needsConfig: status === "no-config",
      permit:
        status === "permit" && permitExp
          ? { expiresAt: permitExp, minsLeft: permitMinsLeft(permitExp) }
          : null,
      checkedAt,
      checking,
      refresh: check,
    };
  }, [role, geo, permitExp, checkedAt, checking, check]);

  // ── Permit-session audit (plan §5: "kahan se kaam hua") ────────────────
  // Status TRANSITION par hi log (har 5-min recheck par nahi) + 15-min
  // cooldown per action (flappy GPS spam se bachao). Precise coords KABHI
  // nahi — sirf distance snapshot (privacy). activity_logs me dikhta hai.
  const prevStatus = useRef<ViewOnlyStatus>("unknown");
  const lastAuditAt = useRef<Record<string, number>>({});
  useEffect(() => {
    if (role !== "staff") return;
    const from = prevStatus.current;
    const to = state.status;
    prevStatus.current = to;
    if (from === to) return;
    // unknown → inside = normal case, noise nahi chahiye
    if (from === "unknown" && to === "inside") return;
    const now = Date.now();
    const key = `geo-${to}`;
    if (now - (lastAuditAt.current[key] ?? 0) < 15 * 60000) return;
    lastAuditAt.current[key] = now;
    const dist =
      state.distanceM != null ? `office se ~${Math.round(state.distanceM)}m` : "distance unknown";
    if (to === "outside") {
      logActivity("Geofence Outside", "Staff", undefined, `${dist} bahar, permit nahi — view only`);
    } else if (to === "permit") {
      logActivity(
        "Permit Session Active",
        "Staff",
        undefined,
        `${dist} bahar, permit ${state.permit?.minsLeft ?? "?"} min baki`
      );
    } else if (to === "inside") {
      logActivity("Geofence Inside", "Staff", undefined, "wapas office ke andar");
    } else if (to === "denied" || to === "unavailable" || to === "timeout" || to === "unsupported") {
      logActivity("Geofence Location Unavailable", "Staff", undefined, `GPS ${to} — fail-safe view only`);
    }
  }, [role, state]);

  return <ViewOnlyContext.Provider value={state}>{children}</ViewOnlyContext.Provider>;
}

// ─── CanWrite wrapper (Option 1 — incremental, safe) ──────────────────────
// viewOnly par poore subtree ke clicks/submits capture-phase me roko + toast.
// `display:contents` se layout par zero asar (extra box nahi banta).
export function CanWrite({
  children,
  message,
}: {
  children: React.ReactNode;
  message?: string;
}) {
  const { viewOnly } = useViewOnly();
  if (!viewOnly) return <>{children}</>;
  const block = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toast.warning(
      message ?? "View Only — aap office ke bahar hain. Changes sirf office ke andar se honge."
    );
  };
  return (
    <span
      className="viewonly-guard"
      style={{ display: "contents" }}
      title="View Only — office ke bahar changes band hain"
      onClickCapture={block}
      onSubmitCapture={block}
    >
      {children}
    </span>
  );
}
