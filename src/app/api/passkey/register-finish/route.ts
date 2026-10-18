import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { requireStaffWithRole } from "@/lib/api-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";
import {
  CHALLENGE_COOKIE,
  openChallenge,
  challengeCookieOptions,
  resolveRp,
  toB64url,
} from "@/lib/passkeys";

// Passkey enrollment — step 2/2 (verify + store) — plan §5.2
// INSERT sirf service-role (admin client) se; browser direct write nahi kar sakta (RLS).
export async function POST(req: NextRequest) {
  const session = await requireStaffWithRole();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = openChallenge(req.cookies.get(CHALLENGE_COOKIE)?.value);
  if (!payload || payload.t !== "reg" || payload.u !== session.user.id) {
    return NextResponse.json(
      { error: "Registration session expire ho gaya — dobara try karein" },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    response?: RegistrationResponseJSON;
    deviceName?: string;
  };
  if (!body?.response?.id) {
    return NextResponse.json({ error: "Credential response missing" }, { status: 400 });
  }

  const { rpID, origin } = resolveRp(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: payload.c,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch {
    return NextResponse.json({ error: "Device verify nahi ho paaya" }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Device verify nahi ho paaya" }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;
  const deviceName =
    String(body.deviceName ?? "")
      .trim()
      .slice(0, 60) || "Mera device";

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("user_passkeys")
    .insert({
      user_id: session.user.id,
      credential_id: credential.id,
      public_key: toB64url(credential.publicKey),
      sign_count: credential.counter ?? 0,
      transports: (credential.transports ?? []) as unknown as Record<string, unknown>,
      device_name: deviceName,
    })
    .select("id, device_name, date_created")
    .single();

  const res = NextResponse.json(
    error ? { error: "Passkey save nahi hua" } : { success: true, device: data }
  );
  res.cookies.set(CHALLENGE_COOKIE, "", challengeCookieOptions(0));

  if (error) {
    // unique violation → ye credential pehle se registered hai
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ye device pehle se registered hai" }, { status: 409 });
    }
    return NextResponse.json({ error: `Passkey save nahi hua: ${error.message}` }, { status: 500 });
  }
  return res;
}
