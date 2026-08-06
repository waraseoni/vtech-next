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

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // ✅ PUBLIC routes — no login required
  const isPublic = ["/", "/about", "/contact", "/job-status", "/track", "/login", "/signup"].some(r =>
    path === r || path.startsWith(r + "/")
  );

  // Skip static files
  if (path.startsWith("/_next") || path.includes("favicon") || path.startsWith("/api")) {
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
