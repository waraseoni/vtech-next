import { describe, it, expect, vi } from "vitest";

// geofence.ts module-level par "@/lib/supabase" import karta hai, jo
// createBrowserClient ko env vars chahiye binspar — test env mein wo nahi hote.
// Isliye pure-logic tests ke liye supabase module ko mock karte hain.
vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}));

import { distanceMeters, geoErrorMessage, type GeoResult } from "./geofence";

describe("distanceMeters (haversine)", () => {
  it("returns 0 for identical coordinates", () => {
    expect(distanceMeters(23.17, 79.93, 23.17, 79.93)).toBe(0);
  });

  it("computes ~111km for 1 degree of latitude", () => {
    // 1 degree of latitude ≈ 111km
    const d = distanceMeters(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });

  it("symmetric regardless of argument order", () => {
    const a = distanceMeters(23, 79, 24, 80);
    const b = distanceMeters(24, 80, 23, 79);
    expect(a).toBeCloseTo(b, 2);
  });

  it("small distance (e.g. ~200m) within a shop radius", () => {
    // ~0.0018 deg of lat ≈ 200m
    const d = distanceMeters(23.17, 79.93, 23.1718, 79.93);
    expect(d).toBeGreaterThan(150);
    expect(d).toBeLessThan(250);
  });
});

describe("geoErrorMessage", () => {
  const base = (reason: GeoResult["reason"]): GeoResult => ({
    ok: reason === "ok",
    reason,
    distanceM: 120,
    coords: null,
  });

  it("maps 'outside' with distance in the message", () => {
    const msg = geoErrorMessage(base("outside"));
    expect(msg).toContain("120m");
    expect(msg.toLowerCase()).toContain("bahar");
  });

  it("maps 'denied'", () => {
    expect(geoErrorMessage(base("denied")).toLowerCase()).toContain("permission");
  });

  it("maps 'unavailable'", () => {
    expect(geoErrorMessage(base("unavailable")).toLowerCase()).toContain("available");
  });

  it("maps 'timeout'", () => {
    expect(geoErrorMessage(base("timeout")).toLowerCase()).toContain("deri");
  });

  it("maps 'unsupported'", () => {
    expect(geoErrorMessage(base("unsupported")).toLowerCase()).toContain("support");
  });

  it("maps 'no-config'", () => {
    expect(geoErrorMessage(base("no-config")).toLowerCase()).toContain("geofence");
  });

  it("falls back to generic for 'ok'/'disabled'", () => {
    expect(geoErrorMessage(base("ok"))).toBeTruthy();
    expect(geoErrorMessage(base("disabled"))).toBeTruthy();
  });
});
