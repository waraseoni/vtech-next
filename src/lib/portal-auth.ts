import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { requireAdmin } from "./api-auth";

// ─── Portal auth (seller / developer) ───────────────────────────────────────
// "Double password": (1) app login (admin/developer role) + (2) portal-specific
// password env se. Password milne ke baad ek signed HttpOnly cookie banti hai
// (6h). HMAC secret = central project ka SERVICE_ROLE_KEY (browser me kabhi nahi).
// Agar env vars set nahi → portal disabled (customer deployments par 403).

export type PortalScope = "seller" | "dev";

const COOKIES: Record<PortalScope, string> = { seller: "vtech_seller", dev: "vtech_dev" };

export function isPortalEnabled(scope: PortalScope): boolean {
  const pw = scope === "seller" ? process.env.SELLER_PORTAL_PASSWORD : process.env.DEV_PORTAL_PASSWORD;
  return !!process.env.LICENSE_SERVICE_SERVICE_ROLE_KEY && !!pw;
}

export function verifyPortalPassword(scope: PortalScope, password: unknown): boolean {
  const pw = scope === "seller" ? process.env.SELLER_PORTAL_PASSWORD : process.env.DEV_PORTAL_PASSWORD;
  if (!pw || typeof password !== "string") return false;
  const a = Buffer.from(pw);
  const b = Buffer.from(password);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sign(scope: PortalScope): string {
  const payload = `${scope}.${Date.now()}`;
  const sig = createHmac("sha256", process.env.LICENSE_SERVICE_SERVICE_ROLE_KEY!).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifyToken(token: string | undefined, scope: PortalScope): boolean {
  if (!token) return false;
  const secret = process.env.LICENSE_SERVICE_SERVICE_ROLE_KEY;
  if (!secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [plScope, ts, sig] = parts;
  if (plScope !== scope) return false;
  const age = Date.now() - Number(ts);
  if (Number.isNaN(age) || age < 0 || age > 6 * 60 * 60 * 1000) return false;
  const expected = createHmac("sha256", secret).update(`${plScope}.${ts}`).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

async function portalUser(scope: PortalScope) {
  if (!isPortalEnabled(scope)) return null;
  // Admin login pehle (password #1) — developer role ko bhi admin jaisa mante hain.
  const admin = await requireAdmin();
  if (!admin) return null;
  const store = await cookies();
  const tok = store.get(COOKIES[scope])?.value;
  if (!verifyToken(tok, scope)) return null;
  return admin;
}

export async function requireSeller() {
  return portalUser("seller");
}

export async function requireDev() {
  return portalUser("dev");
}

export async function setPortalCookie(scope: PortalScope) {
  const store = await cookies();
  store.set(COOKIES[scope], sign(scope), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 6 * 60 * 60,
  });
}
