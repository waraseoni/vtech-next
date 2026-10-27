import crypto from "node:crypto";

/**
 * AI provider API keys — at-rest encryption (AES-256-GCM).
 *
 * Kyun: `ai_providers.api_key_cipher` me key plaintext me nahi baithni chahiye.
 * Browser ko key kabhi wapas nahi jaati (sirf `key_hint` = last 4 chars).
 *
 * Secret source (pehla jo mile):
 *   1. `AI_KEY_ENC_SECRET`  — dedicated secret (recommended, .env.local / host env)
 *   2. `SUPABASE_SERVICE_ROLE_KEY` — fallback, taaki bina extra setup ke kaam chale
 *
 * ⚠️ Secret badalne par purani keys decrypt nahi hongi — admin ko key dobara
 * save karni padegi. Isliye `AI_KEY_ENC_SECRET` ko stable rakho.
 *
 * Format: `v1:<iv b64url>:<authTag b64url>:<ciphertext b64url>`
 */

const PREFIX = "v1";
const IV_BYTES = 12; // GCM standard nonce size
const ALGO = "aes-256-gcm";

function encryptionKey(): Buffer {
  const secret = process.env.AI_KEY_ENC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!secret) {
    throw new Error(
      "AI key encryption secret missing: AI_KEY_ENC_SECRET ya SUPABASE_SERVICE_ROLE_KEY set karein"
    );
  }
  // Koi bhi length ka secret → deterministic 32-byte key
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

/** Plain key → encrypted payload (`v1:iv:tag:data`). */
export function encryptSecret(plain: string): string {
  if (!plain) throw new Error("encryptSecret: empty value");
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    enc.toString("base64url"),
  ].join(":");
}

/** Encrypted payload → plain key. Invalid/tampered payload → null (throw nahi). */
export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) return null;
  try {
    const [, ivPart, tagPart, dataPart] = parts;
    const decipher = crypto.createDecipheriv(
      ALGO,
      encryptionKey(),
      Buffer.from(ivPart, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]);
    return plain.toString("utf8");
  } catch {
    // Galat secret ya tampered ciphertext
    return null;
  }
}

/**
 * Browser ko dikhane layak hint — kabhi poori key nahi.
 * `••••4f2a` (last 4 chars) ya `••••` (bahut chhoti key).
 */
export function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const trimmed = key.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 8) return "••••";
  return "••••" + trimmed.slice(-4);
}
