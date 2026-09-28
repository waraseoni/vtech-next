import { describe, it, expect, vi, beforeEach } from "vitest";

// `enforceApiGeoGate` server-side chokepoint hai (docs/plans/staff_geofence_viewonly_plan.md
// §4.2). Ye test uske VERDICT logic par focus karta hai: kaunsa header
// combination allow/block karta hai, aur permit table se kaise decide hota hai.
//
// `getServerSupabase()` asli route me `cookies()` + supabase client banata hai
// (node env me nahi chalega) — isliye `@supabase/ssr` mock kiya hai. Factory
// tabhi chalti hai jab api-auth module first time import hota hai, aur
// `permitLookup()` us waqt current test ka stub padhta hai.
const permitLookup = vi.fn<(u?: unknown) => { expires_at: string } | null>(() => null);

vi.mock("@supabase/ssr", () => {
  const makeClient = () => {
    // PostgREST `.gt("expires_at", <iso>)` server-side filter karta hai — mock
    // ko bhi wahi karna padega, warna "expired permit" wala case test hi
    // verify nahi karega (expired row bhi return ho jayegi).
    const builder: Record<string, unknown> = {};
    let gtValue: string | null = null;
    for (const m of ["select", "eq", "order", "limit"]) {
      builder[m] = () => builder;
    }
    builder.gt = (_col: string, val: string) => {
      gtValue = val;
      return builder;
    };
    builder.maybeSingle = async () => {
      const row = permitLookup();
      const visible = row && (gtValue === null || row.expires_at > gtValue) ? row : null;
      return { data: visible, error: null };
    };
    return {
      from: () => builder,
      auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    };
  };
  return { createServerClient: () => makeClient() };
});

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }));

import { enforceApiGeoGate } from "@/lib/api-auth";
import { NextResponse } from "next/server";

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString();

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/locations", { method: "POST", headers });
}

const blockedReq = (extra: Record<string, string> = {}) =>
  req({ "x-vtech-geo-blocked": "1", "x-vtech-geo-status": "outside", ...extra });

beforeEach(() => permitLookup.mockReturnValue(null));

describe("enforceApiGeoGate — non-staff kabhi lock nahi (D3)", () => {
  it.each(["admin", "developer", "client", null, undefined])("role=%s", async (role) => {
    // Gate signal "blocked" bhi ho — non-staff phir bhi pass.
    expect(await enforceApiGeoGate(blockedReq(), role, "u1")).toBeNull();
  });
});

describe("enforceApiGeoGate — staff, fail-closed signal", () => {
  it("blocked=0 (client ne andar/permit bataya) → allow", async () => {
    expect(await enforceApiGeoGate(req({ "x-vtech-geo-blocked": "0" }), "staff", "u1")).toBeNull();
  });

  it("header hi missing → BLOCK (plain fetch / curl bypass nahi)", async () => {
    const res = await enforceApiGeoGate(req({}), "staff", "u1");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    expect(((await res!.json()) as { code: string }).code).toBe("GEO_SIGNAL_MISSING");
  });

  it("invalid header value ('yes' / 'true' / '') → BLOCK", async () => {
    for (const v of ["yes", "true", ""]) {
      const res = await enforceApiGeoGate(req({ "x-vtech-geo-blocked": v }), "staff", "u1");
      expect(res, `value ${JSON.stringify(v)} allow ho gaya`).not.toBeNull();
      expect(res!.status).toBe(403);
    }
  });
});

describe("enforceApiGeoGate — staff + blocked, permit check", () => {
  it("active permit → allow", async () => {
    permitLookup.mockReturnValue({ expires_at: FUTURE });
    expect(await enforceApiGeoGate(blockedReq(), "staff", "u1")).toBeNull();
  });

  it("expired permit → block (server clock se)", async () => {
    permitLookup.mockReturnValue({ expires_at: PAST });
    const res = await enforceApiGeoGate(blockedReq(), "staff", "u1");
    expect(res!.status).toBe(403);
    expect(((await res!.json()) as { code: string }).code).toBe("GEO_WRITE_BLOCKED");
  });

  it("permit row hi nahi → block", async () => {
    const res = await enforceApiGeoGate(blockedReq(), "staff", "u1");
    expect(res!.status).toBe(403);
  });

  it("block message me distance + geo status included", async () => {
    const res = await enforceApiGeoGate(blockedReq({ "x-vtech-geo-distance": "850.4" }), "staff", "u1");
    const body = (await res!.json()) as { error: string; geo: string };
    expect(body.error).toContain("850");
    expect(body.error).toContain("Bina permit ke koi bhi change nahi ho sakta");
    expect(body.geo).toBe("outside");
  });

  // Production safety: 11 route handlers `if (session instanceof NextResponse)
  // return session;` se gate response pass-through karte hain. Agar ye check
  // kabhi fail ho to `session.user` undefined → 500 instead of clean 403.
  // Vercel/Next bundling me `instanceof` dual-module-instance se fail kar sakta
  // hai, isliye ye ek cheap regression guard hai.
  it("403 response `instanceof NextResponse` hai (route pass-through ke liye)", async () => {
    const res = await enforceApiGeoGate(req({}), "staff", "u1");
    expect(res).toBeInstanceOf(NextResponse);
  });
});
