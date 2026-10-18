import crypto from "node:crypto";

// ════════════════════════════════════════════════════════════════
// passkeys.ts — WebAuthn (passkey) server helpers
//
// Repo plan: docs/plans/passkey_biometric_login_plan.md (+ passkey_sprint_plan.md)
//   - RP identity: env-driven (`WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, `WEBAUTHN_RP_NAME`),
//     warna request origin/host se derive (localhost dev me kaam kare).
//   - Challenge: httpOnly signed cookie (HMAC), 5 min TTL, ONE-TIME
//     (route consume hone par cookie clear karta hai).
//   - Signing secret: `WEBAUTHN_SECRET` → fallback `SUPABASE_SERVICE_ROLE_KEY`
//     (high-entropy, server-only). Browser ise kabhi nahi dekhta.
// ════════════════════════════════════════════════════════════════

export const CHALLENGE_COOKIE = "vtech_pk_chal";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export const RP_NAME = process.env.WEBAUTHN_RP_NAME || "V-TECH PRO";

function signingSecret(): string {
  const s = process.env.WEBAUTHN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("passkeys: WEBAUTHN_SECRET / SUPABASE_SERVICE_ROLE_KEY missing");
  return s;
}

// ── RP identity resolution ──────────────────────────────────────
export function resolveRp(req: Request): { rpID: string; origin: string } {
  const envOrigin = process.env.WEBAUTHN_ORIGIN?.trim();
  const envRpId = process.env.WEBAUTHN_RP_ID?.trim();

  let origin = envOrigin || req.headers.get("origin") || "";
  if (!origin) {
    try {
      origin = new URL(req.url).origin;
    } catch {
      origin = "http://localhost:3000";
    }
  }
  origin = origin.replace(/\/$/, "");

  let rpID = envRpId || "";
  if (!rpID) {
    try {
      rpID = new URL(origin).hostname;
    } catch {
      rpID = "localhost";
    }
  }
  return { rpID, origin };
}

// ── base64url helpers ───────────────────────────────────────────
export function toB64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const buf = Buffer.from(b64 + pad, "base64");
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}

// ── challenge cookie (signed, one-time, 5 min) ──────────────────
export type ChallengePayload = {
  /** base64url challenge */
  c: string;
  /** "reg" = enrollment, "auth" = login */
  t: "reg" | "auth";
  /** user id (enrollment me bind karte hain) */
  u?: string;
  /** expiry epoch ms */
  e: number;
};

export function sealChallenge(p: ChallengePayload): string {
  const body = toB64url(Buffer.from(JSON.stringify(p), "utf8"));
  const sig = toB64url(crypto.createHmac("sha256", signingSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function openChallenge(raw: string | null | undefined): ChallengePayload | null {
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = toB64url(crypto.createHmac("sha256", signingSecret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const json = fromB64url(body);
    const p = JSON.parse(Buffer.from(json).toString("utf8")) as ChallengePayload;
    if (!p?.c || !p?.t || typeof p.e !== "number") return null;
    if (p.e < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

export function challengeCookieOptions(maxAgeSec = CHALLENGE_TTL_MS / 1000) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

// ── clone/replay guard ──────────────────────────────────────────
/**
 * WebAuthn counter monotonic hona chahiye. Platform authenticators (Windows
 * Hello, Touch ID) aksar counter `0` hi report karte hain (next === stored === 0),
 * isliye sirf tab reject karo jab `stored > 0` aur `next <= stored`.
 */
export function isCounterAcceptable(stored: number, next: number): boolean {
  if (!Number.isFinite(stored) || !Number.isFinite(next)) return false;
  if (stored <= 0) return true;
  return next > stored;
}
