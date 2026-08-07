import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, role } = await req.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Sabhi fields required hain" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password kam se kam 6 characters ka hona chahiye" }, { status: 400 });
    }

    // ── Verify requester is admin via session cookie ──────────────────────
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Sirf Admin naya user create kar sakta hai" }, { status: 403 });
    }

    // ── Create user using admin API (no email verification needed) ────────
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,    // Email verify ki zaroorat nahi
      user_metadata: { full_name: fullName },
    });

    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 400 });
    }

    // ── Insert into profiles table ────────────────────────────────────────
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .insert({ id: newUser.user.id, full_name: fullName, role: role || "staff" });

    if (profileErr) {
      // User created but profile failed — delete user to keep consistent
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ error: "Profile save nahi hua: " + profileErr.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "User successfully create ho gaya!",
      userId: newUser.user.id,
    });

  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}