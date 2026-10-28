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
      siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim()),
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
});
