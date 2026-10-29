import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  dbError: null as null | { message: string },
  throwDb: false,
}));

vi.mock("@/lib/admin-supabase", () => ({
  getAdminSupabase: () => ({
    from: () => ({
      select: () => ({
        limit: () => ({
          abortSignal: async () => {
            if (state.throwDb) throw new Error("db unreachable");
            return { error: state.dbError };
          },
        }),
      }),
    }),
  }),
}));

import { GET } from "./route";

const healthReq = (ip = "203.0.113.9") =>
  new Request("http://localhost/api/health", { headers: { "x-forwarded-for": ip } });

describe("GET /api/health", () => {
  beforeEach(() => {
    state.dbError = null;
    state.throwDb = false;
  });

  it("returns ok when the read-only DB check succeeds", async () => {
    const res = await GET(healthReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.db).toBe("ok");
    expect(typeof body.version).toBe("string");
    expect(typeof body.time).toBe("string");
    expect(body.checks).toEqual({
      trackingSecret: Boolean(process.env.PUBLIC_TRACKING_SECRET?.trim()),
      trackingEnforce: process.env.PUBLIC_TRACKING_ENFORCE === "1",
      siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim()),
      push: Boolean(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim()
      ),
      passkey: Boolean(
        process.env.WEBAUTHN_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      ),
      license: Boolean(
        process.env.LICENSE_SERVICE_URL?.trim() && process.env.LICENSE_SERVICE_ANON_KEY?.trim()
      ),
      distributedRateLimit: Boolean(
        process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
      ),
    });
    // Local env values must never be echoed.
    expect(JSON.stringify(body)).not.toContain(process.env.PUBLIC_TRACKING_SECRET || "@@none@@");
  });

  it("returns 503 degraded when the DB query errors", async () => {
    state.dbError = { message: "relation does not exist" };
    const res = await GET(healthReq("203.0.113.10"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.db).toBe("error");
    expect(JSON.stringify(body)).not.toContain("relation does not exist");
  });

  it("returns 503 degraded when the DB client throws", async () => {
    state.throwDb = true;
    const res = await GET(healthReq("203.0.113.11"));
    expect(res.status).toBe(503);
    expect((await res.json()).db).toBe("error");
  });

  it("reflects rollout flags without leaking secret values", async () => {
    const previous = process.env.PUBLIC_TRACKING_ENFORCE;
    process.env.PUBLIC_TRACKING_ENFORCE = "1";
    try {
      const res = await GET(healthReq("203.0.113.12"));
      const body = await res.json();
      expect(body.checks.trackingEnforce).toBe(true);

      for (const key of [
        "trackingSecret",
        "trackingEnforce",
        "siteUrl",
        "push",
        "passkey",
        "license",
        "distributedRateLimit",
      ]) {
        expect(typeof body.checks[key]).toBe("boolean");
      }

      const json = JSON.stringify(body);
      for (const secret of [
        process.env.PUBLIC_TRACKING_SECRET,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        process.env.WEBAUTHN_SECRET,
        process.env.VAPID_PRIVATE_KEY,
        process.env.UPSTASH_REDIS_REST_TOKEN,
      ]) {
        if (secret?.trim()) expect(json).not.toContain(secret);
      }
    } finally {
      if (previous === undefined) delete process.env.PUBLIC_TRACKING_ENFORCE;
      else process.env.PUBLIC_TRACKING_ENFORCE = previous;
    }
  });
});
