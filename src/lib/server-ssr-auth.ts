import { getServerSupabase } from "./api-auth";
import { logger } from "./logger";
import type { SsrShellAuth } from "./ssr-shell";

/**
 * Root layout ke liye server auth read — sirf tab call hota hai jab
 * NEXT_PUBLIC_SSR_SHELL on ho (default off). Cookie+RLS client hi use hota hai.
 *
 * Fast path `getClaims()` (local JWKS verify, zero network RTT) — same pattern
 * jo api-auth/proxy use karte hain; fail par getUser() fallback.
 */
export async function readSsrShellAuth(): Promise<SsrShellAuth | null> {
  try {
    const supabase = await getServerSupabase();

    let id = "";
    let email: string | null = null;
    let userMetadata: Record<string, unknown> | undefined;

    try {
      const { data, error } = await supabase.auth.getClaims();
      const claims = data?.claims as
        { sub?: string; email?: string; user_metadata?: Record<string, unknown> } | undefined;
      if (!error && claims?.sub) {
        id = String(claims.sub);
        email = claims.email ?? null;
        userMetadata = claims.user_metadata;
      }
    } catch {
      /* fall through to network validate */
    }

    if (!id) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      id = user.id;
      email = user.email ?? null;
      userMetadata = user.user_metadata as Record<string, unknown> | undefined;
    }

    const { data: pd } = await supabase
      .from("profiles")
      .select("full_name, role, avatar_url")
      .eq("id", id)
      .maybeSingle();

    // Fail-closed: profile row missing = staff nahi (useAppBoot ka client path
    // bhi isi ko "staff" default karta tha, par RLS phir bhi sab deny karta hai).
    if (!pd?.role) return null;

    const metaName = typeof userMetadata?.full_name === "string" ? userMetadata.full_name : "";
    return {
      profile: {
        full_name: pd.full_name || metaName || email?.split("@")[0] || "User",
        role: pd.role,
        avatar_url: pd.avatar_url || null,
      },
      email,
    };
  } catch (err) {
    logger.debug("ssr-shell: server auth read failed:", err);
    return null;
  }
}
