import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

// ─── Central licensing service (SELLER's separate Supabase project) ─────────
// App ka data DB se alag hai. Is project par sirf licenses/activations tables
// aur RPC functions hain. .env.example dekh kar inko set karo:
//   LICENSE_SERVICE_URL / LICENSE_SERVICE_ANON_KEY
export const LICENSE_CONFIG = {
  url: process.env.LICENSE_SERVICE_URL || "",
  anonKey: process.env.LICENSE_SERVICE_ANON_KEY || "",
};

export const isLicenseConfigured = () =>
  !!LICENSE_CONFIG.url && !!LICENSE_CONFIG.anonKey;

export function makeLicenseClient() {
  return createClient(LICENSE_CONFIG.url, LICENSE_CONFIG.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Har shop ke app instance ka stable unique id — host (domain/LAN IP) ka sha256.
export function makeActivationId(host: string) {
  return createHash("sha256")
    .update(host.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export const LICENSE_KEY_RE = /^VTC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

export function isValidLicenseKey(key: string) {
  return LICENSE_KEY_RE.test(key.trim().toUpperCase());
}

export function maskKey(key: string) {
  if (!key) return "";
  const k = key.trim();
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

export type LicenseStatus = {
  configured: boolean;
  activated: boolean;
  /** License abhi valid hai ya nahi — activated ho kar bhi expiry par false. */
  valid: boolean;
  plan?: string;
  shopName?: string;
  keyMasked?: string;
  activatedAt?: string;
  expiresAt?: string | null;
  activationId?: string;
  error?: string;
  /** Last central check ka persisted result (re-check window ke dauran bhi yaad). */
  remoteValid?: boolean;
  remoteError?: string;
  remoteCheckedAt?: string;
  /** Seller/Developer portals is deployment par enabled hain ya nahi (env se). */
  sellerEnabled?: boolean;
  devEnabled?: boolean;
};

/** Central RPC call — validate key + register/refresh this instance. */
export async function activateRemoteLicense(opts: {
  key: string;
  activationId: string;
  shopUrl: string;
  shopName: string;
}): Promise<{ ok: boolean; error?: string; plan?: string; shopName?: string; expiresAt?: string | null; alreadyActivated?: boolean }> {
  if (!isLicenseConfigured()) {
    return { ok: false, error: "LICENSE_SERVICE_NOT_CONFIGURED" };
  }
  const client = makeLicenseClient();
  const { data, error } = await client.rpc("activate_license", {
    p_key: opts.key.trim().toUpperCase(),
    p_activation_id: opts.activationId,
    p_shop_url: opts.shopUrl,
    p_shop_name: opts.shopName,
  });
  if (error) {
    return { ok: false, error: `LICENSE_SERVICE_ERROR: ${error.message}` };
  }
  return (data ?? { ok: false, error: "EMPTY_RESPONSE" }) as {
    ok: boolean;
    error?: string;
    plan?: string;
    shopName?: string;
    expiresAt?: string | null;
    alreadyActivated?: boolean;
  };
}

/**
 * Central RPC call — activation register kiye bina abhi bhi license valid hai ya
 * nahi verify karta hai (daily re-check ke liye). Naya activation NAHI banta.
 */
export async function checkRemoteLicense(activationId: string): Promise<{
  ok: boolean;
  error?: string;
  plan?: string;
  shopName?: string;
  expiresAt?: string | null;
}> {
  if (!isLicenseConfigured()) {
    return { ok: false, error: "LICENSE_SERVICE_NOT_CONFIGURED" };
  }
  const client = makeLicenseClient();
  const { data, error } = await client.rpc("check_license", {
    p_activation_id: activationId,
  });
  if (error) {
    return { ok: false, error: `LICENSE_SERVICE_ERROR: ${error.message}` };
  }
  return (data ?? { ok: false, error: "EMPTY_RESPONSE" }) as {
    ok: boolean;
    error?: string;
    plan?: string;
    shopName?: string;
    expiresAt?: string | null;
  };
}
