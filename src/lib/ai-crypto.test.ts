import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskKey } from "./ai-crypto";

/**
 * AI provider keys at-rest encryption.
 *
 * Yahan sabse zaroori guarantee hai: DB me plaintext key kabhi na jaye, aur
 * galat secret par decrypt `null` de (throw na kare) taaki AI request friendly
 * "key missing" message de sake.
 */

const SECRET = "unit-test-secret-ai-keys-0123456789";
const PLAIN = "gsk_test_key_1234567890abcdef";

let originalEncSecret: string | undefined;
let originalServiceRole: string | undefined;

beforeEach(() => {
  originalEncSecret = process.env.AI_KEY_ENC_SECRET;
  originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.AI_KEY_ENC_SECRET = SECRET;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-fallback-secret";
});

afterEach(() => {
  if (originalEncSecret === undefined) delete process.env.AI_KEY_ENC_SECRET;
  else process.env.AI_KEY_ENC_SECRET = originalEncSecret;

  if (originalServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
});

describe("encryptSecret / decryptSecret", () => {
  it("roundtrip se wahi key wapas milti hai", () => {
    expect(decryptSecret(encryptSecret(PLAIN))).toBe(PLAIN);
  });

  it("ciphertext me plaintext nahi hota", () => {
    const payload = encryptSecret(PLAIN);
    expect(payload).not.toContain(PLAIN);
    expect(payload).not.toContain("gsk_");
  });

  it("format v1:iv:tag:data hota hai", () => {
    const parts = encryptSecret(PLAIN).split(":");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
    for (const part of parts.slice(1)) expect(part.length).toBeGreaterThan(0);
  });

  it("har encryption ka ciphertext alag (random IV)", () => {
    expect(encryptSecret(PLAIN)).not.toBe(encryptSecret(PLAIN));
  });

  it("galat secret par decrypt null (throw nahi)", () => {
    const payload = encryptSecret(PLAIN);
    process.env.AI_KEY_ENC_SECRET = "koi-doosra-secret";
    expect(decryptSecret(payload)).toBeNull();
  });

  it("tampered ciphertext par null", () => {
    const parts = encryptSecret(PLAIN).split(":");
    // byte-level tamper — base64 ke aakhri char ke lower bits unused hote hain,
    // isliye char flip kabhi-kabhi same bytes decode kar deta tha (flaky).
    const data = Buffer.from(parts[3], "base64url");
    data[0] ^= 0xff;
    parts[3] = data.toString("base64url");
    expect(decryptSecret(parts.join(":"))).toBeNull();
  });

  it("invalid / empty payload par null", () => {
    expect(decryptSecret(null)).toBeNull();
    expect(decryptSecret(undefined)).toBeNull();
    expect(decryptSecret("")).toBeNull();
    expect(decryptSecret("plain-text-key")).toBeNull();
    expect(decryptSecret("v2:a:b:c")).toBeNull();
    expect(decryptSecret("v1:a:b")).toBeNull();
  });

  it("AI_KEY_ENC_SECRET na ho to service-role se derive hota hai", () => {
    delete process.env.AI_KEY_ENC_SECRET;
    const payload = encryptSecret(PLAIN);
    expect(decryptSecret(payload)).toBe(PLAIN);

    // service role badla to decrypt fail hona chahiye
    process.env.SUPABASE_SERVICE_ROLE_KEY = "rotated-service-role";
    expect(decryptSecret(payload)).toBeNull();
  });

  it("dono secrets missing ho to encrypt throw karta hai", () => {
    delete process.env.AI_KEY_ENC_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => encryptSecret(PLAIN)).toThrow(/encryption secret missing/i);
  });

  it("empty value encrypt nahi hoti", () => {
    expect(() => encryptSecret("")).toThrow();
  });
});

describe("maskKey", () => {
  it("lambi key ka sirf last 4 dikhta hai", () => {
    expect(maskKey(PLAIN)).toBe("••••cdef");
  });

  it("chhoti key poori hide hoti hai", () => {
    expect(maskKey("12345678")).toBe("••••");
    expect(maskKey("short")).toBe("••••");
  });

  it("null / empty / whitespace par null", () => {
    expect(maskKey(null)).toBeNull();
    expect(maskKey(undefined)).toBeNull();
    expect(maskKey("")).toBeNull();
    expect(maskKey("   ")).toBeNull();
  });

  it("mask me key ka koi aur hissa nahi aata", () => {
    const masked = maskKey(PLAIN) ?? "";
    expect(masked).not.toContain("gsk");
    expect(masked).not.toContain("1234");
  });
});
