import { describe, it, expect, vi, beforeEach } from "vitest";

// Fail-open regression: `profiles` me row missing hone par
// `requireStaffWithRole()` role `"staff"` DEFAULT kar deta tha — API 200,
// par RLS (`is_frontend_staff`, strict) sab queries ko [] karke report ke
// saare totals 0 dikhata tha, bina kisi error ke (login kare bina hi
// report khulta tha, ye galat tha). Ye test fail-closed behaviour lock
// karta hai: no profile → deny (+ reason), silent staff default kabhi nahi.
//
// Mock pattern `api-auth.geoGate.test.ts` jaisa: `@supabase/ssr` aur
// `next/headers` stub, kyunki asli `cookies()` node env me nahi chalta.
const stub: {
  user: { id: string } | null;
  profile: { role: string } | null;
  throwOnProfile: boolean;
  claims: { sub?: string; email?: string; user_metadata?: Record<string, unknown> } | null;
  throwOnClaims: boolean;
  getUserCalls: number;
} = {
  user: { id: "u1" },
  profile: { role: "staff" },
  throwOnProfile: false,
  claims: null,
  throwOnClaims: false,
  getUserCalls: 0,
};

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () => {
        if (stub.throwOnClaims) throw new Error("jwks unavailable");
        return { data: { claims: stub.claims }, error: null };
      },
      getUser: async () => {
        stub.getUserCalls += 1;
        return { data: { user: stub.user }, error: null };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (stub.throwOnProfile) throw new Error("db down");
            return { data: stub.profile, error: null };
          },
        }),
      }),
    }),
  }),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }));

import { requireStaffWithRole, requireStaffWithReason, requireStaff } from "@/lib/api-auth";

beforeEach(() => {
  stub.user = { id: "u1" };
  stub.profile = { role: "staff" };
  stub.throwOnProfile = false;
  stub.claims = null;
  stub.throwOnClaims = false;
  stub.getUserCalls = 0;
});

describe("requireStaff — fail-closed on missing profile (ledger-zeros regression)", () => {
  it("profile row missing → requireStaffWithRole null (kabhi silent 'staff' default nahi)", async () => {
    stub.profile = null;
    expect(await requireStaffWithRole()).toBeNull();
    expect(await requireStaff()).toBeNull();
  });

  it("profile row missing → reason 'no-profile' (route precise 403 de sake)", async () => {
    stub.profile = null;
    expect(await requireStaffWithReason()).toEqual({ status: "no-profile" });
  });

  it("profiles query throw kare → deny (fail-closed, assume-staff nahi)", async () => {
    stub.throwOnProfile = true;
    expect(await requireStaffWithRole()).toBeNull();
  });

  it("no session → null / 'no-session' (pehle jaisa)", async () => {
    stub.user = null;
    expect(await requireStaffWithRole()).toBeNull();
    expect(await requireStaffWithReason()).toEqual({ status: "no-session" });
  });
});

describe("requireStaff — valid roles pass (behaviour unchanged)", () => {
  it.each(["admin", "staff", "developer"])("role=%s → ok", async (role) => {
    stub.profile = { role };
    const r = await requireStaffWithReason();
    expect(r).toEqual({ status: "ok", user: { id: "u1" }, role });
    const s = await requireStaffWithRole();
    expect(s?.role).toBe(role);
  });

  it("role=client → deny / 'forbidden' (pehle jaisa)", async () => {
    stub.profile = { role: "client" };
    expect(await requireStaffWithRole()).toBeNull();
    expect(await requireStaffWithReason()).toEqual({ status: "forbidden" });
  });

  it("role empty string → deny (valid role nahi hai)", async () => {
    stub.profile = { role: "" };
    expect(await requireStaffWithRole()).toBeNull();
  });
});

// Perf: staff auth par `getUser()` (Auth-server RTT ~250 ms/request) hata diya —
// local `getClaims()` (JWKS) se id milti hai, wahi se role query. Ye tests lock
// karte hain ki valid claims par network call hota hi nahi, aur fallback intact hai.
describe("requireStaff — getClaims fast path (Auth-server RTT skipped)", () => {
  it("valid claims → getUser call hi nahi (zero network auth RTT)", async () => {
    stub.claims = { sub: "u1", email: "a@b.c", user_metadata: { full_name: "A" } };
    const r = await requireStaffWithReason();
    expect(r).toEqual({
      status: "ok",
      user: { id: "u1", email: "a@b.c", user_metadata: { full_name: "A" } },
      role: "staff",
    });
    expect(stub.getUserCalls).toBe(0);
  });

  it("claims me sub nahi → getUser fallback (expired/invalid token validate)", async () => {
    stub.claims = { email: "a@b.c" };
    const r = await requireStaffWithReason();
    expect(r).toEqual({ status: "ok", user: { id: "u1" }, role: "staff" });
    expect(stub.getUserCalls).toBe(1);
  });

  it("getClaims throw kare → getUser fallback (fail-safe, deny nahi)", async () => {
    stub.throwOnClaims = true;
    const r = await requireStaffWithReason();
    expect(r).toEqual({ status: "ok", user: { id: "u1" }, role: "staff" });
    expect(stub.getUserCalls).toBe(1);
  });
});
