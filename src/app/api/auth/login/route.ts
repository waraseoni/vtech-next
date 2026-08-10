import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/api-auth";
import { getClientIp, checkLockout, recordFailure, reset } from "@/lib/login-throttle";

// Proxy login — password + otp + verify-otp. Throttle yahi enforce hota hai.
// Ye route PUBLIC hai (login se pehle) — isliye requireStaff nahi.
// Session cookies yahi se set hote hain (server client → browser).
interface LoginBody {
  mode?: string;
  email?: string;
  password?: string;
  token?: string;
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
  return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
}

// ── Password login ───────────────────────────────────────────────
async function handlePassword(request: Request, body: LoginBody, ip: string) {
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "Email aur password zaroori hai" }, { status: 400 });
  }

  const lock = await checkLockout(email, ip);
  if (lock.locked) {
    return NextResponse.json(
      { error: `Bahut saare galat attempts. ${fmtMin(lock.remaining_seconds)} baad dobara try karein.` },
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
      : error?.message ?? "Login fail hua";
    return NextResponse.json(
      { error: message, attempts_left: res.attempts_left },
      { status: res.locked ? 429 : 401 }
    );
  }

  await reset(email);
  return NextResponse.json({ success: true });
}

// ── Client OTP: send code ────────────────────────────────────────
async function handleOtp(request: Request, body: LoginBody, ip: string) {
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email zaroori hai" }, { status: 400 });

  const lock = await checkLockout(email, ip);
  if (lock.locked) {
    return NextResponse.json(
      { error: `Bahut saare galat attempts. ${fmtMin(lock.remaining_seconds)} baad dobara try karein.` },
      { status: 429 }
    );
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    const msg = error.message.toLowerCase().includes("rate") || error.message.toLowerCase().includes("limit")
      ? "Thodi der ruk kar dobara try karein (OTP limit)."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 429 });
  }

  return NextResponse.json({ success: true });
}

// ── Client OTP: verify ───────────────────────────────────────────
async function handleVerifyOtp(request: Request, body: LoginBody, ip: string) {
  const email = String(body?.email ?? "").trim().toLowerCase();
  const token = String(body?.token ?? "").trim();
  if (!email || !token) return NextResponse.json({ error: "Email aur OTP zaroori hai" }, { status: 400 });

  const lock = await checkLockout(email, ip);
  if (lock.locked) {
    return NextResponse.json(
      { error: `Bahut saare galat attempts. ${fmtMin(lock.remaining_seconds)} baad dobara try karein.` },
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
  return NextResponse.json({ success: true });
}

function fmtMin(sec?: number): string {
  if (!sec) return "kuchh der";
  const min = Math.ceil(sec / 60);
  return min >= 60 ? `${Math.floor(min / 60)} ghante ${min % 60} min` : `${min} min`;
}
