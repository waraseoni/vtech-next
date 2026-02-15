// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Response ko shuru mein banao (headers preserve karne ke liye)
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Modern tareeka: getAll / setAll
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Request mein set (next middleware / server components ke liye)
            request.cookies.set({ name, value, ...options })
            // Response mein set (browser ko bhejna)
            response.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )

  // Important: getUser() call → token refresh + session check ke liye
  const { data: { user } } = await supabase.auth.getUser()

  // Agar user nahi hai aur login page nahi → redirect
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Updated response return karo (cookies set hue honge agar refresh hua)
  return response
}

export const config = {
  matcher: [
    /*
     * Middleware in paths:
     * - jobs, clients folders ke andar
     * - root page (/)
     * - sab kuch except static files, login, api etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|login|api).*)',
  ],
}