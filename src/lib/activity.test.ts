import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  insert: vi.fn(),
  profileSingle: vi.fn(),
  user: { data: { user: { id: "u1" as string | null } }, error: null } as {
    data: { user: { id: string | null } | null };
    error: null;
  },
  geo: null as null | { lat: number; lng: number; distanceM: number; permit: boolean },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: h.profileSingle }) }) };
      }
      if (table === "activity_logs") return { insert: h.insert };
      throw new Error(`unexpected table: ${table}`);
    },
  },
  getCachedUser: async () => h.user,
}));

vi.mock("@/lib/geoAudit", () => ({
  takeGeoAudit: () => h.geo,
}));

import { logActivity, logActivities } from "./activity";

beforeEach(() => {
  h.insert.mockReset().mockResolvedValue({ error: null });
  h.profileSingle.mockReset().mockResolvedValue({ data: { mechanic_id: 7, role: "staff" } });
  h.user = { data: { user: { id: "u1" } }, error: null };
  h.geo = null;
});

describe("logActivities (batch)", () => {
  it("ek profile read + ek multi-row insert karta hai", async () => {
    await logActivities([
      { action: "Updated Job Status", module: "Jobs", metaId: 11, details: "a" },
      { action: "Updated Job Status", module: "Jobs", metaId: 12, details: "b" },
      { action: "Bulk Status Update", module: "Jobs", details: "2 job(s)" },
    ]);

    expect(h.profileSingle).toHaveBeenCalledTimes(1);
    expect(h.insert).toHaveBeenCalledTimes(1);
    const rows = h.insert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      user_id: 7,
      action: "Updated Job Status",
      module: "Jobs",
      meta_id: "11",
      details: "a",
    });
    expect(rows[2].meta_id).toBeUndefined();
  });

  it("empty batch par koi network call nahi", async () => {
    await logActivities([]);
    expect(h.profileSingle).not.toHaveBeenCalled();
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("user missing → insert nahi", async () => {
    h.user = { data: { user: null }, error: null };
    await logActivities([{ action: "x", module: "y" }]);
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("geo context → saari rows par geo_* + details suffix", async () => {
    h.geo = { lat: 21.1, lng: 79.2, distanceM: 480, permit: false };
    await logActivities([
      { action: "a", module: "Jobs", details: "one" },
      { action: "b", module: "Jobs", details: "two" },
    ]);
    const rows = h.insert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({ geo_lat: 21.1, geo_lng: 79.2, geo_distance_m: 480 });
    expect(String(rows[0].details)).toContain("Bahar ~480m se");
    expect(rows[1]).toMatchObject({ geo_lat: 21.1 });
  });

  it("geo columns missing (42703) → plain rows se retry", async () => {
    h.geo = { lat: 21.1, lng: 79.2, distanceM: 480, permit: true };
    h.insert
      .mockResolvedValueOnce({ error: { code: "42703", message: "column geo_lat does not exist" } })
      .mockResolvedValueOnce({ error: null });
    await logActivities([
      { action: "a", module: "Jobs", details: "one" },
      { action: "b", module: "Jobs", details: "two" },
    ]);
    expect(h.insert).toHaveBeenCalledTimes(2);
    const retryRows = h.insert.mock.calls[1][0] as Array<Record<string, unknown>>;
    expect(retryRows).toHaveLength(2);
    expect(retryRows[0].geo_lat).toBeUndefined();
  });
});

describe("logActivity (single)", () => {
  it("batch helper ko ek entry se delegate karta hai", async () => {
    await logActivity("Created New Client", "Clients", 5, "Client: Test");
    expect(h.insert).toHaveBeenCalledTimes(1);
    const rows = h.insert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "Created New Client", meta_id: "5" });
  });
});
