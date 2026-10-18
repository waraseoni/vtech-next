import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { requireStaffWithRole } from "@/lib/api-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";
import {
  CHALLENGE_COOKIE,
  RP_NAME,
  sealChallenge,
  challengeCookieOptions,
  resolveRp,
} from "@/lib/passkeys";

// Passkey enrollment — step 1/2 (challenge) — docs/plans/passkey_biometric_login_plan.md §5.2
// Password re-auth ke baad registration options deta hai + signed challenge cookie.
export async function POST(req: NextRequest) {
  const session = await requireStaffWithRole();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = (session.user.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Is account me email set nahi hai" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const password = String(body?.password ?? "");
  if (!password) {
    return NextResponse.json({ error: "Password dobara daalein" }, { status: 400 });
  }

  // Password re-auth — alag throwaway client (current session cookies touch na ho).
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { error: pwErr } = await anon.auth.signInWithPassword({ email, password });
  if (pwErr) {
    return NextResponse.json({ error: "Password galat hai" }, { status: 401 });
  }

  const admin = getAdminSupabase();
  const { data: existing } = await admin
    .from("user_passkeys")
    .select("credential_id, transports")
    .eq("user_id", session.user.id);

  const { rpID } = resolveRp(req);

  let options;
  try {
    options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userName: email,
      userID: new TextEncoder().encode(session.user.id),
      userDisplayName: email,
      attestationType: "none",
      excludeCredentials: (existing ?? []).map((c) => ({
        id: String(c.credential_id),
        transports: (Array.isArray(c.transports) ? c.transports : []) as string[],
      })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });
  } catch {
    return NextResponse.json({ error: "Registration options banane me dikkat" }, { status: 500 });
  }

  const res = NextResponse.json({ options });
  res.cookies.set(
    CHALLENGE_COOKIE,
    sealChallenge({
      c: options.challenge,
      t: "reg",
      u: session.user.id,
      e: Date.now() + 5 * 60 * 1000,
    }),
    challengeCookieOptions()
  );
  return res;
}
