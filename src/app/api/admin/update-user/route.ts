// src/app/api/admin/update-user/route.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

type DbRow = ReturnType<typeof JSON.parse>;

export async function POST(request: Request) {
  try {
    const { userId, email, password, full_name } = await request.json();

    // Admin guard (role=admin + session)
    const adminAuth = await requireAdmin();
    if (!adminAuth) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Service role client (bypass RLS + admin auth ops)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server config error' }, { status: 500 });
    }

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
    const updates: DbRow = {};
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

  } catch (err) {
    console.error('🔥 API Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}