import { describe, it, expect } from "vitest";

import { isMobileUserAgent } from "@/lib/device";

function h(map: Record<string, string>): { get(name: string): string | null } {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) lower[k.toLowerCase()] = v;
  return { get: (name) => lower[name.toLowerCase()] ?? null };
}

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

describe("isMobileUserAgent — hydration-safe device hint", () => {
  it("client-hint ?1 → mobile", () => {
    expect(isMobileUserAgent(h({ "sec-ch-ua-mobile": "?1" }))).toBe(true);
  });

  it("client-hint ?0 → desktop", () => {
    expect(isMobileUserAgent(h({ "sec-ch-ua-mobile": "?0" }))).toBe(false);
  });

  it("client-hint desktop UA ko override karta hai", () => {
    expect(isMobileUserAgent(h({ "sec-ch-ua-mobile": "?0", "user-agent": ANDROID_UA }))).toBe(
      false
    );
    expect(isMobileUserAgent(h({ "sec-ch-ua-mobile": "?1", "user-agent": DESKTOP_UA }))).toBe(true);
  });

  it.each([
    ["android", ANDROID_UA],
    ["iphone", IPHONE_UA],
  ])("hint ke bina %s UA → mobile", (_name, ua) => {
    expect(isMobileUserAgent(h({ "user-agent": ua }))).toBe(true);
  });

  it("hint ke bina desktop UA → desktop", () => {
    expect(isMobileUserAgent(h({ "user-agent": DESKTOP_UA }))).toBe(false);
  });

  it("koi header nahi → desktop (safe default: SSR desktop, mount par correct)", () => {
    expect(isMobileUserAgent(h({}))).toBe(false);
  });
});
