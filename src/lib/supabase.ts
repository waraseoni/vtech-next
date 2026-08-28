import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
