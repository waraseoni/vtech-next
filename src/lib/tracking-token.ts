import { createHmac, timingSafeEqual } from "node:crypto";

// Public tracking token — stateless HMAC so no DB column/migration is needed.
// Full job details (amount, line items, remark) are only returned when the
// request carries a token that matches job_id + code. Old printed slips keep
// working through the limited view; QR/WhatsApp links carry the token.

const VERSION = "v1";
const MAC_BYTES = 16;

function secret(): string | null {
  const value = process.env.PUBLIC_TRACKING_SECRET?.trim();
  return value ? value : null;
}

export function isTrackingTokenConfigured(): boolean {
  return secret() !== null;
}

export function signTrackingToken(
  jobId: string | number,
  code: string | null | undefined
): string | null {
  const key = secret();
  if (!key || !code) return null;
  const mac = createHmac("sha256", key)
    .update(`${String(jobId)}:${code}`)
    .digest()
    .subarray(0, MAC_BYTES);
  return `${VERSION}.${mac.toString("base64url")}`;
}

export function verifyTrackingToken(
  jobId: string | number,
  code: string | null | undefined,
  token: string | null | undefined
): boolean {
  if (!token) return false;
  const expected = signTrackingToken(jobId, code);
  if (!expected) return false;
  const actual = Buffer.from(token.trim());
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}

/**
 * Enforcement switch. Default is off so existing manual Job ID / Code lookups
 * keep their current UX; set `PUBLIC_TRACKING_ENFORCE=1` after the QR/WhatsApp
 * links start carrying tokens.
 */
export function isTrackingEnforced(): boolean {
  return process.env.PUBLIC_TRACKING_ENFORCE === "1";
}
