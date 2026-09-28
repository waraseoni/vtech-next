// ─── Staff geofence — central write gate (Tier A) ───────────────────────────
// docs/plans/staff_geofence_viewonly_plan.md §4.2 (Option 2, global
// safety-net — pehle sirf design me likha tha, implement nahi hua).
//
// Kyu ye `CanWrite` se better hai:
//   `CanWrite` DOM click rokta hai → ek button chhootega to bypass. Ye module
//   `lib/supabase.ts` ke single browser client se consume hota hai, jisse
//   har `.insert/.update/.upsert/.delete/.rpc` + storage upload EK jagah
//   intercept hota hai. 216 write call-sites / 81 files → 0 call-site change.
//
// Rule (user decision 2026-09-28): office ke bahar, permit ke bina staff
// SAARE modules dekh sakta hai, par KISI BHI module me kuch change nahi
// kar sakta. Permit active = har change allowed (same as today).
//
// State store pattern `lib/geoAudit.ts` jaisa hi hai (module-level var, React
// context nahi) — kyunki `supabase.ts` React se bahar hai aur wahan hook call
// nahi ho sakta. `ViewOnlyProvider` har geo-check par yahan publish karta hai.
//
// NOT spoof-proof: ye client-side hai. DevTools se raw Supabase call jaane par
// RLS tak pahunch sakta hai (Tier B — plan §6). Ye preventive layer geo-audit
// detective layer ke saath hai, uska replacement nahi.

import { toast } from "@/lib/toast";
import { logger } from "@/lib/logger";

export interface WriteGuardState {
  /** staff + bahar + permit nahi (ya fail-closed GPS failure) */
  blocked: boolean;
  /** ViewOnlyStatus — message + audit ke liye */
  status: string;
  /** Office se kitna door (meters), banner + toast ke liye */
  distanceM: number | null;
}

const OPEN: WriteGuardState = { blocked: false, status: "unknown", distanceM: null };

let state: WriteGuardState = OPEN;

/**
 * ViewOnlyProvider har location-check par ye call karta hai. Non-staff ke
 * liye hamesha open publish hota hai (viewOnly tabhi staff ke liye true hota
 * hai, isliye `blocked: viewOnly` kaafi hai).
 *
 * Fail-safe: check chalne se pehle `OPEN` rehta hai (page-load flash na ho).
 * GPS fail hone par provider fail-closed verdict publish karta hai.
 */
export function setWriteGuardState(next: Partial<WriteGuardState>): void {
  state = {
    blocked: next.blocked === true,
    status: next.status ?? OPEN.status,
    distanceM: next.distanceM ?? null,
  };
}

/** Logout / role change par gate reset (stale block na rahe). */
export function resetWriteGuardState(): void {
  state = OPEN;
}

/** Current gate state (read-only). */
export function getWriteGuardState(): WriteGuardState {
  return state;
}

let bypassDepth = 0;

/** Fast path — Proxy me 200+ call-sites par chalta hai. */
export function isWriteBlocked(): boolean {
  return state.blocked && bypassDepth === 0;
}

/**
 * Gate ko sirf us ek kaam ke liye bypass karne ka raasta — geofence session
 * audit (`logActivity("Geofence Outside", …)`).
 *
  * Kyu zaroori: staff jab bahar jaata hai tab `viewOnly` ON ho jata hai, aur
 * usi waqt "staff bahar gaya" entry likhni hoti hai. Bina bypass ke wo log hi
 * block ho jayegi — yaani audit sabse zaroori moment par chup ho jayegi.
 *
 * Ye general table-allowlist NAHI hai, sirf ye explicit wrapper. Business
 * writes (clients / jobs / payments / …) kabhi isme nahi aate.
 */
export function withWriteGuardBypass<T>(fn: () => T): T {
  bypassDepth++;
  try {
    return fn();
  } finally {
    bypassDepth--;
  }
}

// ─── Same-origin API route gate (POST/PUT/PATCH/DELETE to /api/*) ───────────

/**
 * 69 raw `fetch("/api/…")` call-sites hain aur koi shared wrapper nahi — to
 * inke liye `window.fetch` ek hi jagah patch hota hai. Ye `supabase.ts` ke
 * Proxy ki tarah hi hai: server-side routes browser client se guzarte nahi,
 * isliye unke liye alag chokepoint zaruri tha.
 *
 * GET/HEAD kabhi block nahi (staff bahar bhi dekhna chahiye). Sirf mutating
 * verbs + same-origin `/api/` — Supabase auth/anon calls alag origin ke hain
 * (login block nahi hona chahiye) aur waise bhi verbs se alag hain.
 */
const MUTATING_VERBS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function installApiWriteGate(): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { __vtechApiGate?: boolean };
  if (w.__vtechApiGate) return;
  w.__vtechApiGate = true;

  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let url = "";
    let method = (init?.method ?? "GET").toUpperCase();
    if (typeof input === "string") url = input;
    else if (input instanceof URL) url = input.pathname;
    else if (input && typeof input === "object") {
      url = input.url;
      method = (init?.method ?? input.method ?? "GET").toUpperCase();
    }

    const isApi = url.startsWith("/api/") || url.includes("://") && new URL(url, location.href).pathname.startsWith("/api/");
    if (isApi && MUTATING_VERBS.has(method) && isWriteBlocked() && !isMessagingApiExempt(url)) {
      notifyWriteBlocked();
      logger.warn(`[geofence] blocked API write: ${method} ${url}`);
      return Promise.resolve(
        new Response(
          JSON.stringify({ error: writeBlockedMessage(), code: "GEO_WRITE_BLOCKED" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        )
      );
    }

    // Server-side routes ko geo signal bhejo (fail-safe; server permit DB-time
    // se khud check karta hai — client clock par trust nahi).
    if (isApi && MUTATING_VERBS.has(method)) {
      const s = getWriteGuardState();
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      headers.set(GEO_HEADER_STATUS, s.status);
      headers.set(GEO_HEADER_BLOCKED, s.blocked ? "1" : "0");
      if (s.distanceM != null) headers.set(GEO_HEADER_DISTANCE, String(Math.round(s.distanceM)));
      const next: RequestInit = { ...init, headers };
      return original(input instanceof Request && !init ? new Request(input, next) : input, next);
    }

    return original(input, init);
  };
}

/** Server routes padhte hain (api-auth.ts `enforceApiGeoGate`). */
export const GEO_HEADER_STATUS = "x-vtech-geo-status";
export const GEO_HEADER_BLOCKED = "x-vtech-geo-blocked";
export const GEO_HEADER_DISTANCE = "x-vtech-geo-distance";

// ─── Route-scoped write exemption (/messages) ──────────────────────────────

/**
 * User decision 2026-09-28: `/messages` page geofence se free hai — staff
 * office ke bahar se bhi message dekh **aur bhej** sake (field staff ko office
 * se contact karna real workflow hai).
 *
 * Ye BLANKET "all writes allowed" nahi hai — sirf messaging ke tables. Agar
 * staff /messages khula ho aur koi background effect `clients`/`jobs` me likhe,
 * wo abhi bhi block rahega (gate apni jagah khadi hai).
 */
const MESSAGING_TABLES = new Set(["messages", "user_presence"]);

/** Storage bucket jo message media ke liye use hota hai (`lib/media.ts`). */
const MESSAGING_BUCKET = "media";

/** Server routes jo messaging ke liye hain (client fetch gate + server gate). */
const MESSAGING_API_PREFIXES = ["/api/messages/", "/api/media/delete"];

const MESSAGING_ROUTE = "/messages";

/** Current pathname `/messages` (ya uska sub-route) par hai? */
export function isOnMessagingRoute(): boolean {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname;
  return p === MESSAGING_ROUTE || p.startsWith(`${MESSAGING_ROUTE}/`);
}

/**
 * Sirf /messages par, sirf messaging tables ke liye gate bypass. Baaki har
 * write (aur har route) apni jagah block rahta hai.
 */
export function isMessagingTableExempt(table: string): boolean {
  return isOnMessagingRoute() && MESSAGING_TABLES.has(table);
}

/** `media` bucket upload/remove — sirf /messages par. */
export function isMessagingStorageExempt(bucket: string): boolean {
  return isOnMessagingRoute() && bucket === MESSAGING_BUCKET;
}

/** `/api/messages/*` + `/api/media/delete` — sirf /messages par. */
export function isMessagingApiExempt(url: string): boolean {
  if (!isOnMessagingRoute()) return false;
  const path = url.includes("://") ? new URL(url, "http://x").pathname : url;
  return MESSAGING_API_PREFIXES.some((p) => path.startsWith(p));
}

// ─── Message ───────────────────────────────────────────────────────────────

/**
 * Fail-closed reason ke liye specific message, warna attendance wale ke SAME
 * wording family se ("Aap office ke bahar hain…") — taaki staff ko ek hi
 * message yaad rahe.
 *
 * `IMPLAUSIBLE_DISTANCE_M`: isse bade distance (hundreds of km) real field
 * visit nahi hote — wo ya to (a) `system_info` me office coordinates galat
 * hain, ya (b) device ka GPS/network location hi galat hai (desktop par
 * GPS na hone se browser IP-based location use karta hai, jo VPN/proxy par
 * 100+ km off ho sakta hai). Dono cases me staff ko "aap 257 km door ho" dikhane
 * se zyada useful hai ki admin se config check karwayein — warna wo khud ko
 * blame karke system chhodh dega.
 */
const IMPLAUSIBLE_DISTANCE_M = 25_000;

export function writeBlockedMessage(d: WriteGuardState = state): string {
  if (d.status === "denied")
    return "Location permission deny hai, isliye changes band hain. Permission allow karein ya permit lein.";
  if (d.status === "unavailable")
    return "Location available nahi hai, isliye changes band hain. GPS/Internet on karein ya permit lein.";
  if (d.status === "timeout")
    return "Location fetch me deri hui, isliye changes band hain. Dobara try karein ya permit lein.";
  if (d.status === "unsupported")
    return "Is browser me location support nahi hai, isliye changes band hain. Permit lein.";

  const far = d.distanceM != null && d.distanceM > IMPLAUSIBLE_DISTANCE_M;
  if (far) {
    return `Aap office se bahar dikh rahe ho (~${Math.round(d.distanceM!)}m). Itni doori asli nahi hoti — shayad office location setting galat hai ya device ka GPS theek nahi. Admin se office location check karwayein, ya permit le lein.`;
  }
  const dist = d.distanceM != null ? ` (office se ~${Math.round(d.distanceM)}m door)` : "";
  return `Aap office ke bahar hain${dist}. Bina permit ke koi bhi change nahi ho sakta — sirf dekh sakte hain.`;
}

export class GeoWriteBlockedError extends Error {
  readonly code = "GEO_WRITE_BLOCKED" as const;
  constructor(message = writeBlockedMessage()) {
    super(message);
    this.name = "GeoWriteBlockedError";
  }
}

// ─── Chainable blocked builder ─────────────────────────────────────────────

/**
 * PostgrestBuilder-compatible stub jo `error` set karke resolve karta hai.
 *
 * Call-sites ka pattern `const { error } = await …` hai, isliye THROW karne
 * ke bajaye `{ data: null, error }` resolve karna zaroori hai — warna har
 * blind caller par unhandled rejection. Chainable bhi hai (`.insert().select()
 * .single()`) — Proxy har unknown method ko khud par bhej deta hai, aur `then`
 * se await ho jata hai.
 */
export function blockedBuilder<T = unknown>(message = writeBlockedMessage()): unknown {
  const result = { data: null as T | null, error: new GeoWriteBlockedError(message) };
  const target = function () {
    /* chainable stub — invoke nahi hota */
  } as unknown as object;
  // `const` safe hai: handler closure me `proxy` sirf BAAD me invoke hota hai
  // (TDZ tabhi matter karta jab Proxy banate waqt access ho).
  const proxy = new Proxy(target, {
    get(_t, prop) {
      if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result);
      if (prop === "catch") return () => Promise.resolve(result);
      if (prop === "finally") return (fn?: () => void) => {
        fn?.();
        return Promise.resolve(result);
      };
      // `.select()`, `.eq()`, `.single()`, `.order()`, `.match()` … — sab chain
      // hote rehte hain aur aakhir me `then` se resolve hote hain.
      return () => proxy;
    },
  });
  return proxy;
}

/** Har attempt par ek hi toast (multiple call-sites ek hi action me). */
let lastNotifyAt = 0;
const NOTIFY_COOLDOWN_MS = 2500;

/** Blocked hone par Hindi message toast karta hai (throttled). */
export function notifyWriteBlocked(): void {
  const now = Date.now();
  if (now - lastNotifyAt < NOTIFY_COOLDOWN_MS) return;
  lastNotifyAt = now;
  toast.warning(writeBlockedMessage());
}
