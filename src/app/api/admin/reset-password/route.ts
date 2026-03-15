import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase Admin Client (service_role) ────────────────────────────────────
// IMPORTANT: service_role key sirf server-side use karo — client-side kabhi nahi
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,   // .env.local mein add karo
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { userId, newPassword, requesterId } = await req.json();

    if (!userId || !newPassword || !requesterId) {
      return NextResponse.json({ error: "userId, newPassword, requesterId required" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password kam se kam 6 characters ka hona chahiye" }, { status: 400 });
    }

    // ── Verify requester is admin ─────────────────────────────────────────
    const { data: requesterProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", requesterId)
      .single();

    if (requesterProfile?.role !== "admin") {
      return NextResponse.json({ error: "Sirf Admin password reset kar sakta hai" }, { status: 403 });
    }

    // ── Reset password using admin API ────────────────────────────────────
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Password reset ho gaya!" });

  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}