import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// ─── Client credentials encryption (AES-256-GCM) ─────────────────────────────
// Seller portal mein client ke Supabase service-role key / GitHub / Vercel
// tokens save hote hain — ye bade sensitive hain, isliye DB mein plain nahi.
// Key source: SELLER_CREDS_ENCRYPTION_KEY env (recommended) ya fallback central
// project ka SERVICE_ROLE_KEY (jo already secret hai).
//
// ⚠️ Agar key badal di to purani entries decrypt nahi hongi — key change
//    hone par saare client credentials dobara dalne padenge.

const PREFIX = "v1:";

function getKey(): Buffer {
  const secret = process.env.SELLER_CREDS_ENCRYPTION_KEY || process.env.LICENSE_SERVICE_SERVICE_ROLE_KEY || "";
  if (!secret) {
    throw new Error("SELLER_CREDS_ENCRYPTION_KEY (ya LICENSE_SERVICE_SERVICE_ROLE_KEY) set nahi hai — credentials encrypt/decrypt nahi ho sakte");
  }
  // 32-byte key derive karo (chahe key kisi bhi length ki ho).
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key as unknown as Uint8Array, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!stored.startsWith(PREFIX)) return stored; // legacy plain value (agar koi ho)
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) return "";
  const [ivB64, tagB64, encB64] = parts;
  try {
    const key = getKey();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key as unknown as Uint8Array,
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return ""; // key badal gayi ya data corrupt — khali dikhaye, overwrite ho sakta hai
  }
}

export function hasEncryptionKey(): boolean {
  return !!(process.env.SELLER_CREDS_ENCRYPTION_KEY || process.env.LICENSE_SERVICE_SERVICE_ROLE_KEY);
}
