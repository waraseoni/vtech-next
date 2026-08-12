// proxy.ts — Public website + Protected dashboard (Next 16: renamed from middleware.ts)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options });
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  let user = null;
  try {
    const { data: { user: u } } = await supabase.auth.getUser();
    user = u;
  } catch (err) {
    // Stale/invalid session cookie (e.g. refresh_token_not_found — token was
    // rotated/revoked server-side). Clear every Supabase auth cookie so we
    // don't retry + fail on every request; protected routes redirect to login.
    console.debug("proxy: stale session cookie, clearing auth cookies:", (err as Error)?.message);
    request.cookies.getAll()
      .filter((c) => c.name.startsWith("sb-"))
      .forEach((c) => {
        response.cookies.set({ name: c.name, value: "", maxAge: 0, path: "/" });
      });
  }
  const path = request.nextUrl.pathname;

  // ✅ PUBLIC routes — no login required
  // /setup = first-run admin creation — login se PEHLE accessible hona chahiye
  const isPublic = ["/", "/about", "/contact", "/job-status", "/track", "/login", "/setup", "/stage-lighting", "/industrial", "/power-supply"].some(r =>
    path === r || path.startsWith(r + "/")
  );

  // Skip static files (Next assets, public/ files like images, manifest, sw, tools html)
  if (
    path.startsWith("/_next") ||
    path.includes("favicon") ||
    path.startsWith("/api") ||
    /\.[a-zA-Z0-9]+$/.test(path)
  ) {
    return response;
  }

  // Public route → allow access
  if (isPublic) {
    return response;
  }

  // Protected route → require login
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
