import { NextRequest, NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { getServerSupabase } from "@/lib/api-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { getClientIp, checkLockout, recordFailure, reset } from "@/lib/login-throttle";
import {
  CHALLENGE_COOKIE,
  openChallenge,
  sealChallenge,
  challengeCookieOptions,
  resolveRp,
  fromB64url,
  isCounterAcceptable,
} from "@/lib/passkeys";

// Proxy login — password + otp + verify-otp + passkey (WebAuthn). Throttle yahi enforce hota hai.
// Ye route PUBLIC hai (login se pehle) — isliye requireStaff nahi.
// Session cookies yahi se set hote hain (server client → browser).
interface LoginBody {
  mode?: string;
  email?: string;
  password?: string;
  token?: string;
  response?: AuthenticationResponseJSON;
}

export async function POST(request: Request) {
  const ip = getClientIp(request as NextRequest);
  let body: LoginBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const mode = body?.mode;
  if (mode === "password") return handlePassword(request, body, ip);
  if (mode === "otp") return handleOtp(request, body, ip);
  if (mode === "verify-otp") return handleVerifyOtp(request, body, ip);
  if (mode === "passkey-begin") return handlePasskeyBegin(request, body, ip);
  if (mode === "passkey-verify") return handlePasskeyVerify(request, body, ip);
  return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
}

// ── Password login ───────────────────────────────────────────────
async function handlePassword(request: Request, body: LoginBody, ip: string) {
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "Email aur password zaroori hai" }, { status: 400 });
  }

  const lock = await checkLockout(email, ip);
  if (lock.locked) {
    return NextResponse.json(
      {
        error: `Bahut saare galat attempts. ${fmtMin(lock.remaining_seconds)} baad dobara try karein.`,
      },
      { status: 429 }
    );
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    const res = await recordFailure(email, ip);
    const isInvalid = error?.message.toLowerCase().includes("invalid login");
    const message = isInvalid
      ? `Email ya password galat hai!${res.attempts_left > 0 ? ` ${res.attempts_left} attempts baaki.` : ""}`
      : (error?.message ?? "Login fail hua");
    return NextResponse.json(
      { error: message, attempts_left: res.attempts_left },
      { status: res.locked ? 429 : 401 }
    );
  }

  await reset(email);
  const res = NextResponse.json({ success: true });
  res.cookies.set("vtech_session_start", String(Date.now()), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}

// ── Client OTP: send code ────────────────────────────────────────
async function handleOtp(request: Request, body: LoginBody, ip: string) {
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  if (!email) return NextResponse.json({ error: "Email zaroori hai" }, { status: 400 });

  const lock = await checkLockout(email, ip);
  if (lock.locked) {
    return NextResponse.json(
      {
        error: `Bahut saare galat attempts. ${fmtMin(lock.remaining_seconds)} baad dobara try karein.`,
      },
      { status: 429 }
    );
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    const msg =
      error.message.toLowerCase().includes("rate") || error.message.toLowerCase().includes("limit")
        ? "Thodi der ruk kar dobara try karein (OTP limit)."
        : error.message;
    return NextResponse.json({ error: msg }, { status: 429 });
  }

  return NextResponse.json({ success: true });
}

// ── Client OTP: verify ───────────────────────────────────────────
async function handleVerifyOtp(request: Request, body: LoginBody, ip: string) {
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const token = String(body?.token ?? "").trim();
  if (!email || !token)
    return NextResponse.json({ error: "Email aur OTP zaroori hai" }, { status: 400 });

  const lock = await checkLockout(email, ip);
  if (lock.locked) {
    return NextResponse.json(
      {
        error: `Bahut saare galat attempts. ${fmtMin(lock.remaining_seconds)} baad dobara try karein.`,
      },
      { status: 429 }
    );
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error) {
    await recordFailure(email, ip);
    const msg = error.message.toLowerCase().includes("code")
      ? "OTP galat hai ya expire ho gaya. Dobara try karein."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  await reset(email);
  const res = NextResponse.json({ success: true });
  res.cookies.set("vtech_session_start", String(Date.now()), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}

// ── Passkey login: begin (challenge) ─────────────────────────────
// docs/plans/passkey_biometric_login_plan.md §5.1.
//   - email diya  → us user ke credentials (targeted).
//   - email khaali → usernameless (discoverable credential): browser khud
//     device ka passkey picker dikhata hai. Isliye email optional hai.
async function handlePasskeyBegin(request: Request, body: LoginBody, ip: string) {
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const throttleKey = email || `ip:${ip}`;

  const lock = await checkLockout(throttleKey, ip);
  if (lock.locked) {
    return NextResponse.json(
      {
        error: `Bahut saare galat attempts. ${fmtMin(lock.remaining_seconds)} baad dobara try karein.`,
      },
      { status: 429 }
    );
  }

  const admin = getAdminSupabase();
  const { rpID } = resolveRp(request);

  // Targeted (email) flow → sirf us user ke credentials.
  // Usernameless → allowCredentials khaali (discoverable flow).
  let allowCredentials: { id: string; transports: string[] }[] = [];
  if (email) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role")
      .ilike("email", email)
      .maybeSingle();

    const staffRole =
      profile?.role === "admin" || profile?.role === "staff" || profile?.role === "developer";
    if (!profile?.id || !staffRole) {
      return NextResponse.json(
        { error: "Is account ke liye koi passkey nahi mila" },
        { status: 404 }
      );
    }

    const { data: creds } = await admin
      .from("user_passkeys")
      .select("credential_id, transports")
      .eq("user_id", profile.id);
    if (!creds || creds.length === 0) {
      return NextResponse.json(
        { error: "Is account me koi passkey registered nahi hai" },
        { status: 404 }
      );
    }
    allowCredentials = creds.map((c) => ({
      id: String(c.credential_id),
      transports: (Array.isArray(c.transports) ? c.transports : []) as string[],
    }));
  }

  let options;
  try {
    options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: "preferred",
    });
  } catch {
    return NextResponse.json({ error: "Passkey options banane me dikkat" }, { status: 500 });
  }

  const res = NextResponse.json({ options });
  res.cookies.set(
    CHALLENGE_COOKIE,
    sealChallenge({
      c: options.challenge,
      t: "auth",
      e: Date.now() + 5 * 60 * 1000,
    }),
    challengeCookieOptions()
  );
  return res;
}

// ── Passkey login: verify → session mint ─────────────────────────
async function handlePasskeyVerify(request: Request, body: LoginBody, ip: string) {
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const throttleKey = email || `ip:${ip}`;
  const response = body?.response;
  if (!response?.id) {
    return NextResponse.json({ error: "Passkey response missing" }, { status: 400 });
  }

  const lock = await checkLockout(throttleKey, ip);
  if (lock.locked) {
    return NextResponse.json(
      {
        error: `Bahut saare galat attempts. ${fmtMin(lock.remaining_seconds)} baad dobara try karein.`,
      },
      { status: 429 }
    );
  }

  const fail = async (msg = "Passkey verify fail hua") => {
    await recordFailure(throttleKey, ip);
    return NextResponse.json({ error: msg }, { status: 401 });
  };

  const payload = openChallenge((await cookies()).get(CHALLENGE_COOKIE)?.value);
  if (!payload || payload.t !== "auth") {
    return NextResponse.json(
      { error: "Login session expire ho gaya — dobara try karein" },
      { status: 400 }
    );
  }

  const admin = getAdminSupabase();
  const { data: row } = await admin
    .from("user_passkeys")
    .select("id, user_id, credential_id, public_key, sign_count, transports")
    .eq("credential_id", response.id)
    .maybeSingle();
  if (!row) return fail();

  const { data: prof } = await admin
    .from("profiles")
    .select("email, role")
    .eq("id", row.user_id)
    .maybeSingle();
  const staffRole = prof?.role === "admin" || prof?.role === "staff" || prof?.role === "developer";
  const userEmail = String(prof?.email ?? "")
    .trim()
    .toLowerCase();
  if (!staffRole || !userEmail) return fail();
  // Targeted (email) flow me diya gaya email credential-owner se match karna chahiye.
  if (email && userEmail !== email) return fail();

  const { rpID, origin } = resolveRp(request);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: payload.c,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: String(row.credential_id),
        publicKey: fromB64url(String(row.public_key)),
        counter: Number(row.sign_count) || 0,
        transports: (Array.isArray(row.transports) ? row.transports : []) as string[],
      },
    });
  } catch {
    return fail();
  }
  if (!verification.verified) return fail();

  const newCounter = verification.authenticationInfo.newCounter;
  const storedCounter = Number(row.sign_count) || 0;
  // Clone/replay guard — platform authenticators aksar counter 0 rehta hai.
  if (!isCounterAcceptable(storedCounter, newCounter)) return fail();

  await admin
    .from("user_passkeys")
    .update({ sign_count: newCounter, last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  // ── Session mint — NO EMAIL/OTP (D8 fallback) ──
  const ok = await mintSession(userEmail, row.user_id);
  const res = NextResponse.json(
    ok ? { success: true } : { error: "Session nahi ban paaya — password se login karein" },
    { status: ok ? 200 : 500 }
  );
  res.cookies.set(CHALLENGE_COOKIE, "", challengeCookieOptions(0));
  if (!ok) return res;

  await reset(userEmail);
  res.cookies.set("vtech_session_start", String(Date.now()), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}

// Session mint: `admin.createSession` maujood nahi (spike 18 Oct 2026) → esliye
// generateLink token ko SERVER par hi verifyOtp se consume karte hain.
// generateLink email NAHI bhejta (token response me aata hai) → dummy email /
// free tier safe. Fallback: unconfirmed dummy email ko ek baar confirm karke retry.
async function mintSession(email: string, userId: string): Promise<boolean> {
  const admin = getAdminSupabase();
  const supabase = await getServerSupabase();

  const attempt = async (type: "recovery" | "magiclink"): Promise<boolean> => {
    const { data, error } = await admin.auth.admin.generateLink({ type, email });
    const tokenHash = (data as { properties?: { hashed_token?: string } } | null)?.properties
      ?.hashed_token;
    if (error || !tokenHash) return false;
    const { error: vErr } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    return !vErr;
  };

  if (await attempt("recovery")) return true;
  if (await attempt("magiclink")) return true;

  try {
    await admin.auth.admin.updateUserById(userId, { email_confirm: true });
  } catch {
    return false;
  }
  return attempt("recovery");
}

function fmtMin(sec?: number): string {
  if (!sec) return "kuchh der";
  const min = Math.ceil(sec / 60);
  return min >= 60 ? `${Math.floor(min / 60)} ghante ${min % 60} min` : `${min} min`;
}
