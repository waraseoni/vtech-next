import { describe, it, expect, beforeEach } from "vitest";
import {
  sealChallenge,
  openChallenge,
  toB64url,
  fromB64url,
  isCounterAcceptable,
  resolveRp,
  type ChallengePayload,
} from "@/lib/passkeys";

// passkeys.ts signing secret call-time par padhta hai — test env me set kar dete hain.
process.env.WEBAUTHN_SECRET = "unit-test-secret-please-ignore";

function payload(over: Partial<ChallengePayload> = {}): ChallengePayload {
  return { c: "challenge-abc123", t: "auth", e: Date.now() + 60_000, ...over };
}

describe("challenge cookie (seal/openChallenge)", () => {
  it("round-trips a valid payload", () => {
    const p = payload({ t: "reg", u: "user-1" });
    expect(openChallenge(sealChallenge(p))).toEqual(p);
  });

  it("rejects null/empty/garbage", () => {
    expect(openChallenge(null)).toBeNull();
    expect(openChallenge(undefined)).toBeNull();
    expect(openChallenge("")).toBeNull();
    expect(openChallenge("no-dot-here")).toBeNull();
    expect(openChallenge("....")).toBeNull();
  });

  it("rejects a tampered body (signature mismatch)", () => {
    const sealed = sealChallenge(payload());
    const [body, sig] = sealed.split(".");
    const tamperedBody = toB64url(Buffer.from(JSON.stringify(payload({ c: "evil" })), "utf8"));
    expect(openChallenge(`${tamperedBody}.${sig}`)).toBeNull();
    expect(openChallenge(`${body}.${toB64url(Buffer.from("deadbeef"))}`)).toBeNull();
  });

  it("rejects an expired challenge", () => {
    expect(openChallenge(sealChallenge(payload({ e: Date.now() - 1 })))).toBeNull();
  });

  it("rejects a payload missing required fields", () => {
    const bad = { c: "", t: "auth", e: Date.now() + 60_000 } as ChallengePayload;
    expect(openChallenge(sealChallenge(bad))).toBeNull();
  });
});

describe("base64url helpers", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(Array.from(fromB64url(toB64url(bytes)))).toEqual(Array.from(bytes));
  });

  it("produces url-safe output (no +, / or =)", () => {
    const out = toB64url(new Uint8Array([251, 255, 190, 63]));
    expect(out).not.toMatch(/[+/=]/);
  });
});

describe("isCounterAcceptable (clone/replay guard)", () => {
  it("accepts platform authenticators that always report 0", () => {
    expect(isCounterAcceptable(0, 0)).toBe(true);
  });
  it("accepts a strictly increasing counter", () => {
    expect(isCounterAcceptable(0, 5)).toBe(true);
    expect(isCounterAcceptable(5, 6)).toBe(true);
  });
  it("rejects a non-increasing counter once stored > 0", () => {
    expect(isCounterAcceptable(5, 5)).toBe(false);
    expect(isCounterAcceptable(5, 4)).toBe(false);
  });
  it("rejects non-finite values", () => {
    expect(isCounterAcceptable(NaN, 1)).toBe(false);
    expect(isCounterAcceptable(1, NaN)).toBe(false);
    expect(isCounterAcceptable(Infinity, 5)).toBe(false);
  });
});

describe("resolveRp", () => {
  beforeEach(() => {
    delete process.env.WEBAUTHN_ORIGIN;
    delete process.env.WEBAUTHN_RP_ID;
  });

  it("derives rpID from the request origin header", () => {
    const req = new Request("https://app.example.com/api/passkey", {
      headers: { origin: "https://app.example.com" },
    });
    expect(resolveRp(req)).toEqual({
      rpID: "app.example.com",
      origin: "https://app.example.com",
    });
  });

  it("prefers env overrides when set", () => {
    process.env.WEBAUTHN_ORIGIN = "https://vtech.example";
    process.env.WEBAUTHN_RP_ID = "vtech.example";
    const req = new Request("http://localhost/api/passkey");
    expect(resolveRp(req)).toEqual({
      rpID: "vtech.example",
      origin: "https://vtech.example",
    });
    delete process.env.WEBAUTHN_ORIGIN;
    delete process.env.WEBAUTHN_RP_ID;
  });
});
