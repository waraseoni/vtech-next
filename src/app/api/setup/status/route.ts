import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/api-auth";

// GET /api/setup/status
// Client package ke first-run par ye decide karta hai ki /setup page dikhana hai
// ya nahi. needsSetup = profiles mein abhi koi admin exist nahi karta.
export async function GET() {
  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: admins, error } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1);
    if (error) throw new Error(error.message);

    return NextResponse.json({
      needsSetup: !admins || admins.length === 0,
      // OPTIONAL: SETUP_TOKEN env set hai to admin banana token ke bina possible nahi.
      tokenRequired: !!process.env.SETUP_TOKEN,
      loggedIn: !!user,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
