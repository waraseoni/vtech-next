import { describe, it, expect } from "vitest";

import { setGeoAudit, takeGeoAudit } from "./geoAudit";

describe("geoAudit cache (per-write tagging)", () => {
  it("bahar-context deta hai, inside/unknown null", () => {
    setGeoAudit({ lat: 1, lng: 2, distanceM: 350, permit: true });
    expect(takeGeoAudit()?.distanceM).toBe(350);
    setGeoAudit(null);
    expect(takeGeoAudit()).toBeNull();
  });

  it("stale context (>10min) tag nahi karta", () => {
    setGeoAudit({ lat: 1, lng: 2, distanceM: 100, permit: false });
    expect(takeGeoAudit(-1)).toBeNull(); // expired TTL → stale
    expect(takeGeoAudit()).toBeNull(); // stale clear ho gaya
  });
});
