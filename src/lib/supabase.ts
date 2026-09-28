import { createBrowserClient } from "@supabase/ssr";
import { isWriteBlocked, notifyWriteBlocked, blockedBuilder } from "@/lib/writeGuard";
import { logger } from "@/lib/logger";

const baseClient = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─────────────────────────────────────────────────────────────────────────────
// STAFF GEOFENCE — CENTRAL WRITE GATE (docs/plans/staff_geofence_viewonly_plan.md §4.2)
//
// `baseClient` ek hi browser client hai aur poori app isse hi DB tak jaati hai
// (216 write call-sites / 81 files). Isliye mutations ko YAHAN, ek Proxy se,
// intercept kar dete hain — 0 call-site change ke saath poora coverage.
//
//   Blocked (staff + office ke bahar + permit nahi):
//     .insert() .update() .upsert() .delete()
//     .rpc()               — `rpc("next_job_id")` bhi read+increment WRITE hai
//     storage .upload() .remove() .createSignedUrl(path, 60) — signed URL
//                             naya banana bhi write hai
//   Allowed hamesha: .select() — staff bahar/dekhta rahe (user decision 2026-09-28)
//
// Blocked call `{ data: null, error: GeoWriteBlockedError }` resolve karta hai
// (throw nahi) taaki har `const { error } = await …` caller ka normal path
// chale — koi unhandled rejection nahi. Chainable bhi hai, to
// `.insert().select().single()` jaise patterns bhi safe hain.
// ─────────────────────────────────────────────────────────────────────────────

type Builder = Record<string, unknown>;

const BLOCKED_TABLE_METHODS = new Set(["insert", "update", "upsert", "delete"]);
const BLOCKED_STORAGE_METHODS = new Set(["upload", "remove", "createSignedUrl", "move", "copy"]);

/**
 * RPC gating: read prefix allow, baaki DEFAULT-DENY.
 *
 * Pehle sirf `["get_public_config","license_status"]` allowlist thi — jo
 * staff ke bahar jaate hi REAL reads bhi tod deti thi: `get_inventory_stock`,
 * `get_dashboard_stats`, `get_monthly_revenue`, `get_financial_summary`,
 * `get_technician_metrics`, `get_clients_page_financials`, `check_license`,
 * `peek_next_job_id`. User ka rule hai "bahar SIRF dekhna hai" — to reports /
 * inventory / dashboard dekhna bhi allowed hona chahiye, sirf writes nahi.
 *
 * Default-deny (unknown RPC = blocked) isliye ki naya write RPC add karna ho
 * to gate automatically use block kar de, bhoolke allow na ho.
 */
const READ_RPC_PREFIXES = ["get_", "peek_", "check_", "list_", "read_", "fetch_", "search_"];

/**
 * Read jaisa NAAM hone par bhi likhta hai — explicit deny (defence in depth,
 * inhe prefix allowlist se bachata hai agar kabhi prefix broaden ho).
 *   next_job_id           → value return karta hai + sequence increment (write)
 *   record_stocktake      → stock rows likhta hai
 *   receive_po_receipt    → stock + PO update
 *   reset_sequence        → sequence reset
 *   activate_license      → license activate
 */
const WRITE_RPCS = new Set<string>([
  "next_job_id",
  "record_stocktake",
  "receive_po_receipt",
  "reset_sequence",
  "activate_license",
]);

export function isReadOnlyRpc(fn: string): boolean {
  if (WRITE_RPCS.has(fn)) return false;
  return READ_RPC_PREFIXES.some((p) => fn.startsWith(p));
}

const blockWrite = (what: string): unknown => {
  notifyWriteBlocked();
  if (process.env.NODE_ENV !== "production") {
    logger.warn(`[geofence] blocked write attempt: ${what}`);
  }
  return blockedBuilder();
};

export const supabase: typeof baseClient = new Proxy(baseClient, {
  get(target, prop) {
    const value = Reflect.get(target, prop, target) as unknown;

    // from(table) → builder Proxy (insert/update/... intercept)
    if (prop === "from" && typeof value === "function") {
      return (table: string) => {
        const builder = (value as (t: string) => Builder).call(target, table) as Builder;
        return new Proxy(builder, {
          get(b, m) {
            if (typeof m === "string" && BLOCKED_TABLE_METHODS.has(m)) {
              return (...args: unknown[]) => {
                if (isWriteBlocked()) return blockWrite(`${table}.${m}`);
                return (b[m] as (...a: unknown[]) => unknown)(...args);
              };
            }
            const mv = Reflect.get(b, m, b) as unknown;
            return typeof mv === "function" ? (mv as (...a: unknown[]) => unknown).bind(b) : mv;
          },
        });
      };
    }

    // rpc(name, …) → writes block, reads (get_/peek_/check_…) allowed
    if (prop === "rpc" && typeof value === "function") {
      return (fn: string, ...args: unknown[]) => {
        if (isWriteBlocked() && !isReadOnlyRpc(fn)) return blockWrite(`rpc:${fn}`);
        return (value as (...a: unknown[]) => unknown).call(target, fn, ...args);
      };
    }

    // storage.from(bucket) → upload/remove/signed-URL block
    if (prop === "storage" && value) {
      const storage = value as { from: (b: string) => Builder };
      const storageProxy = new Proxy(storage, {
        get(s, m, r) {
          if (m === "from" && typeof s.from === "function") {
            return (bucket: string) => {
              const sb = s.from(bucket) as Builder;
              return new Proxy(sb, {
                get(o, om) {
                  if (typeof om === "string" && BLOCKED_STORAGE_METHODS.has(om)) {
                    return (...args: unknown[]) => {
                      if (isWriteBlocked()) return blockWrite(`storage:${bucket}.${om}`);
                      return (o[om] as (...a: unknown[]) => unknown)(...args);
                    };
                  }
                  const ov = Reflect.get(o, om, o) as unknown;
                  return typeof ov === "function" ? (ov as (...a: unknown[]) => unknown).bind(o) : ov;
                },
              });
            };
          }
          return Reflect.get(s, m, r) as unknown;
        },
      });
      return storageProxy;
    }

    // Baaki sab (auth, channel, functions …) untouched — auth me write
    // (`signIn`, `updateUser`) geofence se gate NAHI hota, warna staff
    // login hi nahi kar paayega.
    if (typeof value === "function") return (value as (...a: unknown[]) => unknown).bind(target);
    return value;
  },
}) as typeof baseClient;

// ─────────────────────────────────────────────────────────────────────────────
// Cached auth lookup — client-side dedup of getUser() network round-trips.
// Every protected page + many hooks call getUser() on load (2-3x per
// navigation); each is a JWT re-validation round-trip. RootClient already gates
// the app behind auth, so repeated lookups within the same session only need the
// validated user, not a fresh network call every time.
//
// We memoize the in-flight PROMISE with a short TTL so concurrent callers share
// a single round-trip, and repeat lookups within the TTL return instantly.
// RootClient deliberately keeps calling `supabase.auth.getUser()` directly (not
// through here) so its timeout + retry boot logic stays intact. A full page
// reload (including logout) reloads this module and resets the cache, so it can
// never serve a stale session after a hard nav. signOut/signIn also calls
// invalidateCachedUser() so the next lookup is always fresh.
// ─────────────────────────────────────────────────────────────────────────────
export type GetUserResult = Awaited<ReturnType<typeof supabase.auth.getUser>>;

let cachedUserPromise: Promise<GetUserResult> | null = null;
let cachedUserAt = 0;
const USER_CACHE_TTL_MS = 8000;

export function getCachedUser(): Promise<GetUserResult> {
  const now = Date.now();
  if (cachedUserPromise && now - cachedUserAt < USER_CACHE_TTL_MS) {
    return cachedUserPromise;
  }
  cachedUserPromise = supabase.auth.getUser().then(
    (res) => {
      cachedUserAt = Date.now();
      return res;
    },
    (err) => {
      // Failures are never cached — next caller gets a fresh attempt.
      cachedUserPromise = null;
      throw err;
    }
  );
  return cachedUserPromise;
}

/** Drop the memoized user. Call after signOut/signIn so the next lookup is fresh. */
export function invalidateCachedUser(): void {
  cachedUserPromise = null;
  cachedUserAt = 0;
}
