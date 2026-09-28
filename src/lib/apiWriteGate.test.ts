// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// `installApiWriteGate()` `window.fetch` patch karta hai — usko jsdom chahiye
// (default vitest env `node` hai, jahan `window` undefined hota hai aur gate
// early-return kar deta hai).
const warn = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: { warning: (m: string) => warn(m), success: vi.fn(), error: vi.fn(), info: vi.fn() },
  default: { warning: (m: string) => warn(m) },
}));

import {
  installApiWriteGate,
  resetWriteGuardState,
  setWriteGuardState,
} from "@/lib/writeGuard";

let calls: Array<{ url: string; init?: RequestInit }> = [];

// Gate `window.fetch` ko EXACTLY ek baar patch karta hai (`__vtechApiGate`
// guard), aur apne andar install-time wala original capture kar leta hai. Isliye
// stub pehle lagana padta hai aur phir install — har test me naya stub nahi,
// warna patch overwrite ho jayega.
beforeAll(() => {
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return Promise.resolve(new Response("{}", { status: 200 }));
  }) as typeof window.fetch;
  installApiWriteGate();
});

beforeEach(() => {
  resetWriteGuardState();
  warn.mockClear();
  calls = [];
});

describe("installApiWriteGate — block", () => {
  it("blocked + POST /api/* → 403 synthetic, network par nahi gaya", async () => {
    setWriteGuardState({ blocked: true, status: "outside", distanceM: 850 });
    const res = await window.fetch("/api/locations", { method: "POST", body: "{}" });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; error: string };
    expect(body.code).toBe("GEO_WRITE_BLOCKED");
    expect(body.error).toContain("Bina permit ke koi bhi change nahi ho sakta");
    expect(calls).toHaveLength(0); // original fetch call nahi hua
  });

  it.each(["PUT", "PATCH", "DELETE"])("blocked + %s /api/* → block", async (method) => {
    setWriteGuardState({ blocked: true, status: "outside" });
    const res = await window.fetch("/api/locations/manage", { method });
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("blocked + GET /api/* → chalega (staff bahar bhi dekh sakta hai)", async () => {
    setWriteGuardState({ blocked: true, status: "outside" });
    const res = await window.fetch("/api/locations/manage");
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it("blocked + Supabase ka foreign-origin POST → block NAHI (auth/login safe)", async () => {
    setWriteGuardState({ blocked: true, status: "outside" });
    const res = await window.fetch("https://xyzcompany.supabase.co/auth/v1/token", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
  });
});

describe("installApiWriteGate — geo signal headers", () => {
  it("open state par mutating /api/* me headers attach hote hain", async () => {
    setWriteGuardState({ blocked: false, status: "inside", distanceM: 12 });
    await window.fetch("/api/locations", { method: "POST", body: "{}" });
    expect(calls).toHaveLength(1);
    const h = new Headers(calls[0].init?.headers);
    expect(h.get("x-vtech-geo-blocked")).toBe("0");
    expect(h.get("x-vtech-geo-status")).toBe("inside");
    expect(h.get("x-vtech-geo-distance")).toBe("12");
  });

  it("bahar + permit wala status bhi attach hota hai (server permit check kare)", async () => {
    // Gate client par block kar deta hai, par agar request kisi aur tareeke se
    // nikle (race / stale bundle) to server ke paas signal hona chahiye.
    setWriteGuardState({ blocked: false, status: "permit", distanceM: 300 });
    await window.fetch("/api/locations", { method: "POST" });
    const h = new Headers(calls[0].init?.headers);
    expect(h.get("x-vtech-geo-blocked")).toBe("0");
    expect(h.get("x-vtech-geo-status")).toBe("permit");
    expect(h.get("x-vtech-geo-distance")).toBe("300");
  });

  it("caller ke apne headers preserve rehte hain", async () => {
    setWriteGuardState({ blocked: false, status: "inside" });
    await window.fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Custom": "keep-me" },
    });
    const h = new Headers(calls[0].init?.headers);
    expect(h.get("X-Custom")).toBe("keep-me");
    expect(h.get("Content-Type")).toBe("application/json");
  });
});
