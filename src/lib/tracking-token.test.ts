import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isTrackingEnforced,
  isTrackingTokenConfigured,
  signTrackingToken,
  verifyTrackingToken,
} from "./tracking-token";

const ORIGINAL_SECRET = process.env.PUBLIC_TRACKING_SECRET;
const ORIGINAL_ENFORCE = process.env.PUBLIC_TRACKING_ENFORCE;

const SECRET_A = "unit-test-secret-A-0123456789abcdef";
const SECRET_B = "unit-test-secret-B-0123456789abcdef";

function restore(key: "PUBLIC_TRACKING_SECRET" | "PUBLIC_TRACKING_ENFORCE", value?: string) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

beforeEach(() => {
  process.env.PUBLIC_TRACKING_SECRET = SECRET_A;
  delete process.env.PUBLIC_TRACKING_ENFORCE;
});

afterEach(() => {
  restore("PUBLIC_TRACKING_SECRET", ORIGINAL_SECRET);
  restore("PUBLIC_TRACKING_ENFORCE", ORIGINAL_ENFORCE);
});

describe("signTrackingToken", () => {
  it("returns a versioned base64url token", () => {
    const token = signTrackingToken(27950, "2026032001");
    expect(token).toMatch(/^v1\.[A-Za-z0-9_-]{22}$/);
  });

  it("is deterministic for the same job and code", () => {
    expect(signTrackingToken(27950, "2026032001")).toBe(signTrackingToken(27950, "2026032001"));
  });

  it("treats numeric and string job ids the same", () => {
    expect(signTrackingToken(27950, "2026032001")).toBe(signTrackingToken("27950", "2026032001"));
  });

  it("returns null when code is missing", () => {
    expect(signTrackingToken(27950, null)).toBeNull();
    expect(signTrackingToken(27950, "")).toBeNull();
  });

  it("returns null when the secret is missing or blank", () => {
    delete process.env.PUBLIC_TRACKING_SECRET;
    expect(signTrackingToken(27950, "2026032001")).toBeNull();
    process.env.PUBLIC_TRACKING_SECRET = "   ";
    expect(signTrackingToken(27950, "2026032001")).toBeNull();
  });
});

describe("verifyTrackingToken", () => {
  it("accepts a token for the same job and code", () => {
    const token = signTrackingToken(27950, "2026032001");
    expect(verifyTrackingToken(27950, "2026032001", token)).toBe(true);
  });

  it("rejects a different job id", () => {
    const token = signTrackingToken(27950, "2026032001");
    expect(verifyTrackingToken(27951, "2026032001", token)).toBe(false);
  });

  it("rejects a different code", () => {
    const token = signTrackingToken(27950, "2026032001");
    expect(verifyTrackingToken(27950, "2026032002", token)).toBe(false);
  });

  it("rejects a tampered token", () => {
    const token = signTrackingToken(27950, "2026032001")!;
    const tampered = token.slice(0, 8) + (token[8] === "A" ? "B" : "A") + token.slice(9);
    expect(verifyTrackingToken(27950, "2026032001", tampered)).toBe(false);
  });

  it("rejects missing or empty tokens", () => {
    expect(verifyTrackingToken(27950, "2026032001", null)).toBe(false);
    expect(verifyTrackingToken(27950, "2026032001", "")).toBe(false);
    expect(verifyTrackingToken(27950, "2026032001", "not-a-token")).toBe(false);
  });

  it("rejects a token signed with a different (rotated) secret", () => {
    const oldToken = signTrackingToken(27950, "2026032001");
    process.env.PUBLIC_TRACKING_SECRET = SECRET_B;
    expect(verifyTrackingToken(27950, "2026032001", oldToken)).toBe(false);
  });

  it("fails closed when the secret is not configured", () => {
    const token = signTrackingToken(27950, "2026032001");
    delete process.env.PUBLIC_TRACKING_SECRET;
    expect(verifyTrackingToken(27950, "2026032001", token)).toBe(false);
  });
});

describe("config flags", () => {
  it("reports token configuration", () => {
    expect(isTrackingTokenConfigured()).toBe(true);
    delete process.env.PUBLIC_TRACKING_SECRET;
    expect(isTrackingTokenConfigured()).toBe(false);
  });

  it("enforces only on the literal value 1", () => {
    expect(isTrackingEnforced()).toBe(false);
    process.env.PUBLIC_TRACKING_ENFORCE = "true";
    expect(isTrackingEnforced()).toBe(false);
    process.env.PUBLIC_TRACKING_ENFORCE = "1";
    expect(isTrackingEnforced()).toBe(true);
  });
});
