// proxy.ts — Public website + Protected dashboard (Next 16: renamed from middleware.ts)
//
// PERF (docs/plans/perf_db_fetch_audit_oct14_2026.md §6 — "auth tax"):
//   pehle har matched request par `getUser()` (Supabase Auth server RTT)
//   early-returns SE PEHLE chalta tha. Ab: early-returns pehle (static/api/
//   public = ZERO auth cost) + protected par `getClaims()` local JWKS verify
//   fast path, sirf fail hone par `getUser()` fallback (refresh behavior).
//   Tests: src/proxy.test.ts (contracts lock karte hain).
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ABSOLUTE_MS } from "@/lib/session-policy";
import { logger } from "@/lib/logger";
import { LITE_MODE, isLiteRouteAllowed } from "@/lib/lite";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const path = request.nextUrl.pathname;

  if (
    path.startsWith("/_next") ||
    path.includes("favicon") ||
    path.startsWith("/api") ||
    /\.[a-zA-Z0-9]+$/.test(path)
  ) {
    return response;
  }

  const isPublic = [
    "/",
    "/about",
    "/contact",
    "/job-status",
    "/track",
    "/login",
    "/setup",
    "/stage-lighting",
    "/industrial",
    "/power-supply",
  ].some((r) => path === r || path.startsWith(r + "/"));

  if (isPublic) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options });
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  // Fast path — local JWT verify (JWKS in-memory cached, no network RTT).
  let authed = false;
  try {
    const { data, error } = await supabase.auth.getClaims();
    authed = !error && !!data?.claims;
  } catch (err) {
    logger.debug(
      "proxy: getClaims local verify failed, falling back to getUser():",
      (err as Error)?.message
    );
  }

  // Fallback — expired/invalid token par purana server validate + refresh path.
  // Stale-cookie clear ke liye naam ikattha karo (redirect response par lagana
  // hoga — warna NextResponse.next() wale response ke saath discard ho jata tha).
  let staleCookieNames: string[] = [];
  if (!authed) {
    try {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      authed = !!u;
    } catch (err) {
      logger.debug("proxy: stale session cookie:", (err as Error)?.message);
      staleCookieNames = request.cookies
        .getAll()
        .filter((c) => c.name.startsWith("sb-"))
        .map((c) => c.name);
    }
  }

  if (!authed) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    for (const name of staleCookieNames) {
      res.cookies.set(name, "", { maxAge: 0, path: "/" });
    }
    return res;
  }

  // ── LITE MODE ROUTE GUARD ───────────────────────────────────────────────
  // Sirf login + attendance + staff wale routes allowed. Baaki (jobs, clients,
  // reports, AI, finance...) → /dashboard. Ye hard redirect Link-prefetch ki RSC
  // fetches ko bhi fail kar deta hai → lite build me baaki modules ka JS kabhi
  // download nahi hota.
  if (LITE_MODE && !isLiteRouteAllowed(path)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Session age check: absolute hard cap via login timestamp cookie
  const loginTs = request.cookies.get("vtech_session_start")?.value;
  if (loginTs) {
    const age = Date.now() - Number(loginTs);
    if (age > ABSOLUTE_MS) {
      await supabase.auth.signOut();
      const allCookies = request.cookies.getAll();
      const res = NextResponse.redirect(new URL("/login?reason=idle", request.url));
      for (const c of allCookies) {
        if (c.name.startsWith("sb-") || c.name === "vtech_session_start") {
          res.cookies.set(c.name, "", { maxAge: 0, path: "/" });
        }
      }
      return res;
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
