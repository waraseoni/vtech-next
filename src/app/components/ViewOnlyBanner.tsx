// ─── ViewOnlyBanner — Tier A soft view-only banner + permit badge ──────────
// docs/plans/staff_geofence_viewonly_plan.md §4.3. RootClient me <main> ke
// upar mount hota hai (har protected page par, mobile + desktop).
"use client";

import { MapPin, ShieldAlert, Timer, Settings2 } from "lucide-react";
import Link from "next/link";
import { useViewOnly } from "@/lib/viewOnly";
import { geoErrorMessage } from "@/lib/geofence";

// ─── GeoPin — activity/jobs history me "kahan se hua" (Phase 6) ──────────
// geo_lat/lng hon tabhi render (office ke kaam as-is, koi pin nahi).
export function GeoPin({
  lat,
  lng,
  distanceM,
}: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  distanceM?: number | null;
}) {
  if (lat == null || lng == null) return null;
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noreferrer"
      title={`Bahar se hua kaam: ${lat.toFixed(5)}, ${lng.toFixed(5)} — Maps me kholo`}
      className="inline-flex items-center gap-0.5 text-sky-400 hover:text-sky-300 transition-colors ml-1.5 align-middle"
      onClick={(e) => e.stopPropagation()}
    >
      <MapPin size={11} />
      {distanceM != null && <span className="text-[10px] font-bold">~{distanceM}m</span>}
    </a>
  );
}

export function ViewOnlyBanner({ isAdmin }: { isAdmin: boolean }) {
  const { viewOnly, status, distanceM, needsConfig, permit } = useViewOnly();

  // Admin ko permit badge nahi (wo kabhi lock nahi hote) — staff-only UI.
  if (!viewOnly && !needsConfig && !permit) return null;

  // ── Green permit badge (bahar + active permit) ──
  if (permit) {
    return (
      <div className="mx-3 sm:mx-5 mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 flex items-center gap-2.5">
        <Timer size={15} className="text-emerald-400 flex-shrink-0" />
        <p className="text-xs font-bold text-emerald-300">
          Outside-Work Permit active — {permit.minsLeft} min baki. Bahar se changes allowed hain.
          Transparency: bahar se hue kaam ki location audit me save hoti hai.
        </p>
      </div>
    );
  }

  if (needsConfig) {
    return (
      <div className="mx-3 sm:mx-5 mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 flex items-center gap-2.5">
        <Settings2 size={15} className="text-amber-400 flex-shrink-0" />
        <p className="text-xs font-bold text-amber-300">
          Geofence configured nahi hai — admin se Settings me office location set karwayein.
        </p>
        {isAdmin && (
          <Link
            href="/settings"
            className="ml-auto text-[11px] font-black text-amber-200 underline underline-offset-2 whitespace-nowrap"
          >
            Settings kholo
          </Link>
        )}
      </div>
    );
  }

  if (!viewOnly) return null;

  // ── Red view-only banner (fail-closed reasons samet) ──
  const detail =
    status === "outside" && distanceM != null
      ? ` (office se ~${Math.round(distanceM)}m bahar)`
      : "";

  return (
    <div className="mx-3 sm:mx-5 mt-3 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 flex items-center gap-2.5">
      <ShieldAlert size={15} className="text-red-400 flex-shrink-0" />
      <p className="text-xs font-bold text-red-300">
        VIEW ONLY —{" "}
        {status === "outside" ? (
          <>
            Aap office ke bahar hain{detail}. Changes sirf office ke andar se honge.
          </>
        ) : (
          <>
            {geoErrorMessage({
              ok: false,
              // Yahan sirf fail-closed reasons pahunchte hain (viewOnly=true) —
              // 'outside' upar handle ho chuka.
              reason: status as "denied" | "unavailable" | "timeout" | "unsupported",
              distanceM,
              coords: null,
            })}{" "}
            Fail-safe: changes band hain. <MapPin size={11} className="inline -mt-0.5" /> GPS on
            karke page refresh karein.
          </>
        )}
      </p>
    </div>
  );
}
