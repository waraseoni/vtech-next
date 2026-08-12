import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

// POST /api/setup — one-time first-run admin creation (client package ka setup page).
// Guards:
//   - Sirf tab chalta hai jab profiles mein koi admin exist NAHI karta (needsSetup).
//   - SETUP_TOKEN env set hai to body.token ka match zaroori (package-specific key).
//   - Email/password validation + email confirm on (bina OTP ke login ho sake).
export async function POST(req: NextRequest) {
  try {
    const { email, fullName, password, token } = (await req.json()) as {
      email?: string; fullName?: string; password?: string; token?: string;
    };

    if (!email || !fullName || !password) {
      return NextResponse.json({ error: "Sabhi fields required hain" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password kam se kam 6 characters ka hona chahiye" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email daalein" }, { status: 400 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Setup sirf ek baar — admin pehle se hai to block.
    const { data: admins } = await adminClient.from("profiles").select("id").eq("role", "admin").limit(1);
    if (admins && admins.length > 0) {
      return NextResponse.json({ error: "Setup already complete — admin pehle se exist karta hai" }, { status: 400 });
    }

    // Optional setup token check (seller package ke saath unique key deta hai).
    const expected = process.env.SETUP_TOKEN;
    if (expected) {
      if (typeof token !== "string" || token.length !== expected.length) {
        return NextResponse.json({ error: "Setup token galat hai" }, { status: 403 });
      }
      const a = Buffer.from(expected); const b = Buffer.from(token);
      if (!timingSafeEqual(a, b)) {
        return NextResponse.json({ error: "Setup token galat hai" }, { status: 403 });
      }
    }

    // Admin user banao (email confirm on — OTP ke bina login).
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName.trim() },
    });
    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 400 });
    }

    // Profile insert — fail ho to user delete (consistent state).
    const { error: profileErr } = await adminClient
      .from("profiles")
      .insert({ id: newUser.user.id, full_name: fullName.trim(), role: "admin" });
    if (profileErr) {
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ error: "Profile save nahi hua: " + profileErr.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Admin setup complete — ab login karein.",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
