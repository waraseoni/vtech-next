import { describe, it, expect, vi } from "vitest";

// viewOnly.tsx module-level par @/lib/supabase import karta hai (env vars
// test me nahi hote) — geofence.test.ts wala pattern: mock karo.
vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
  getCachedUser: vi.fn(),
}));

import { decideViewOnly, permitMinsLeft } from "./viewOnly";

describe("decideViewOnly (Tier A soft, fail-closed)", () => {
  it("admin/developer/client kabhi lock nahi (D3 bypass)", () => {
    for (const role of ["admin", "developer", "client"]) {
      expect(decideViewOnly({ role, geoReason: "outside", permitActive: false })).toEqual({
        viewOnly: false,
        status: "bypass",
      });
    }
  });

  it("staff inside → write", () => {
    expect(decideViewOnly({ role: "staff", geoReason: "ok", permitActive: false })).toEqual({
      viewOnly: false,
      status: "inside",
    });
  });

  it("staff outside bina permit → VIEW ONLY", () => {
    expect(decideViewOnly({ role: "staff", geoReason: "outside", permitActive: false })).toEqual({
      viewOnly: true,
      status: "outside",
    });
  });

  it("staff outside + active permit → write + badge", () => {
    expect(decideViewOnly({ role: "staff", geoReason: "outside", permitActive: true })).toEqual({
      viewOnly: false,
      status: "permit",
    });
  });

  it("fail-closed: denied/unavailable/timeout/unsupported → VIEW ONLY", () => {
    for (const r of ["denied", "unavailable", "timeout", "unsupported"] as const) {
      const v = decideViewOnly({ role: "staff", geoReason: r, permitActive: false });
      expect(v.viewOnly).toBe(true);
      expect(v.status).toBe(r);
    }
  });

  it("geofence off / no-config → write (config notice alag)", () => {
    expect(decideViewOnly({ role: "staff", geoReason: "disabled", permitActive: false })).toEqual({
      viewOnly: false,
      status: "disabled",
    });
    expect(
      decideViewOnly({ role: "staff", geoReason: "no-config", permitActive: false })
    ).toEqual({ viewOnly: false, status: "no-config" });
  });
});

describe("permitMinsLeft", () => {
  it("mins round karta hai, negative nahi", () => {
    const now = Date.now();
    expect(permitMinsLeft(new Date(now + 90 * 60000).toISOString(), now)).toBe(90);
    expect(permitMinsLeft(new Date(now - 60000).toISOString(), now)).toBe(0);
  });
});
