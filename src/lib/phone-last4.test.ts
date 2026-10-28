import { describe, expect, it } from "vitest";

import { normalizePhoneDigits, phoneLast4Matches } from "./phone-last4";

describe("normalizePhoneDigits", () => {
  it("keeps digits only", () => {
    expect(normalizePhoneDigits("+91 98765-43210")).toBe("919876543210");
    expect(normalizePhoneDigits(null)).toBe("");
  });
});

describe("phoneLast4Matches", () => {
  it("matches formatted contacts", () => {
    expect(phoneLast4Matches("+91 98765-43210", "3210")).toBe(true);
    expect(phoneLast4Matches("9876543210", "3210")).toBe(true);
  });

  it("rejects wrong digits", () => {
    expect(phoneLast4Matches("9876543210", "3211")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(phoneLast4Matches("9876543210", "321")).toBe(false);
    expect(phoneLast4Matches("9876543210", "32101")).toBe(false);
    expect(phoneLast4Matches("9876543210", "32a0")).toBe(false);
  });

  it("rejects contacts shorter than 4 digits or missing", () => {
    expect(phoneLast4Matches("123", "0123")).toBe(false);
    expect(phoneLast4Matches(null, "3210")).toBe(false);
    expect(phoneLast4Matches("", "3210")).toBe(false);
  });
});
