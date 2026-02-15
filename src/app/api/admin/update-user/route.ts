// src/app/api/admin/update-user/route.ts
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js'; // direct js client for admin
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userId, email, password, full_name } = await request.json();
    console.log('📥 Request for user:', userId);

    const cookieStore = cookies(); // no await needed in Next.js 14+

    // 1. Normal client (cookie-based) → current user / auth check ke liye
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Current logged-in user check (admin)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin role check from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // 2. Service role client (bypass RLS + admin auth ops)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server config error' }, { status: 500 });
    }

    // Direct supabase-js client with service_role (NO cookies!)
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );

    // Update object
    const updates: any = {};
    if (email) updates.email = email;
    if (password) updates.password = password;
    if (full_name) updates.data = { full_name };

    // Admin update user
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      updates
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ user: data.user });

  } catch (err: any) {
    console.error('🔥 API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}