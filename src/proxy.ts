// proxy.ts — Public website + Protected dashboard (Next 16: renamed from middleware.ts)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ABSOLUTE_MS } from '@/lib/session-policy'

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
    console.debug("proxy: stale session cookie, clearing auth cookies:", (err as Error)?.message);
    request.cookies.getAll()
      .filter((c) => c.name.startsWith("sb-"))
      .forEach((c) => {
        response.cookies.set({ name: c.name, value: "", maxAge: 0, path: "/" });
      });
  }
  const path = request.nextUrl.pathname;

  const isPublic = ["/", "/about", "/contact", "/job-status", "/track", "/login", "/setup", "/stage-lighting", "/industrial", "/power-supply"].some(r =>
    path === r || path.startsWith(r + "/")
  );

  if (
    path.startsWith("/_next") ||
    path.includes("favicon") ||
    path.startsWith("/api") ||
    /\.[a-zA-Z0-9]+$/.test(path)
  ) {
    return response;
  }

  if (isPublic) {
    return response;
  }

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
