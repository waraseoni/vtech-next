// Legacy printed slips carry no tracking token. After PUBLIC_TRACKING_ENFORCE=1
// a customer can still unlock the full view by proving the last 4 digits of the
// phone number on their client record. Only 4 digits are compared and never
// logged; callers must throttle attempts (see /api/public/job-status).

export const PHONE_LAST4_RE = /^\d{4}$/;

export function normalizePhoneDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D+/g, "");
}

export function phoneLast4Matches(contact: string | null | undefined, digits: string): boolean {
  if (!PHONE_LAST4_RE.test(digits)) return false;
  const normalized = normalizePhoneDigits(contact);
  if (normalized.length < 4) return false;
  const expected = normalized.slice(-4);
  let diff = 0;
  for (let i = 0; i < 4; i++) diff |= expected.charCodeAt(i) ^ digits.charCodeAt(i);
  return diff === 0;
}
