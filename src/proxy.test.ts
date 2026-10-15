import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ABSOLUTE_MS } from "@/lib/session-policy";

const { authMock } = vi.hoisted(() => ({
  authMock: {
    getUser: vi.fn(),
    getClaims: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: authMock })),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { proxy } from "@/proxy";

const BASE = "http://localhost:3000";

const req = (path: string, cookie = "") =>
  new NextRequest(BASE + path, cookie ? { headers: { cookie } } : {});

beforeEach(() => {
  vi.clearAllMocks();
  authMock.getClaims.mockResolvedValue({
    data: null,
    error: { message: "Auth session missing!" },
  });
  authMock.getUser.mockResolvedValue({ data: { user: null }, error: null });
  authMock.signOut.mockResolvedValue({ error: null });
});

const expectPassthrough = (res: Response) => {
  expect(res.headers.get("location")).toBeNull();
};

const expectLoginRedirect = (res: Response) => {
  expect(res.headers.get("location")).toContain("/login");
};

describe("proxy — early returns (auth tax ZERO, lines pehle aane chahiye)", () => {
  it("/_next/* → passthrough, auth kabhi call nahi", async () => {
    const res = await proxy(req("/_next/static/chunks/main.js"));
    expectPassthrough(res);
    expect(authMock.getUser).not.toHaveBeenCalled();
    expect(authMock.getClaims).not.toHaveBeenCalled();
  });

  it("/api/* → passthrough, auth kabhi call nahi", async () => {
    const res = await proxy(req("/api/system-info"));
    expectPassthrough(res);
    expect(authMock.getUser).not.toHaveBeenCalled();
    expect(authMock.getClaims).not.toHaveBeenCalled();
  });

  it("file extension path → passthrough, auth kabhi call nahi", async () => {
    const res = await proxy(req("/styles.css"));
    expectPassthrough(res);
    expect(authMock.getUser).not.toHaveBeenCalled();
    expect(authMock.getClaims).not.toHaveBeenCalled();
  });

  it("public page → passthrough, auth kabhi call nahi", async () => {
    const res = await proxy(req("/about"));
    expectPassthrough(res);
    expect(authMock.getUser).not.toHaveBeenCalled();
    expect(authMock.getClaims).not.toHaveBeenCalled();
  });

  it("/login → passthrough, auth kabhi call nahi", async () => {
    const res = await proxy(req("/login"));
    expectPassthrough(res);
    expect(authMock.getUser).not.toHaveBeenCalled();
    expect(authMock.getClaims).not.toHaveBeenCalled();
  });
});

describe("proxy — protected routes: getClaims fast path + getUser fallback", () => {
  it("no session (claims fail + getUser null) → /login redirect", async () => {
    const res = await proxy(req("/dashboard"));
    expectLoginRedirect(res);
    expect(authMock.getUser).toHaveBeenCalled();
  });

  it("claims VALID → passthrough, getUser (network) BILI call nahi", async () => {
    authMock.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", role: "authenticated" }, signature: "sig" },
      error: null,
    });
    const res = await proxy(req("/dashboard"));
    expectPassthrough(res);
    expect(authMock.getUser).not.toHaveBeenCalled();
  });

  it("claims fail (expired) → getUser fallback se session refresh/verify → passthrough", async () => {
    authMock.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const res = await proxy(req("/dashboard"));
    expectPassthrough(res);
    expect(authMock.getUser).toHaveBeenCalled();
  });

  it("claims fail + getUser THROW (stale cookie) → login redirect + sb- cookies cleared", async () => {
    authMock.getUser.mockRejectedValue(new Error("Invalid Refresh Token"));
    const res = await proxy(req("/dashboard", "sb-auth-token=stale-value"));
    expectLoginRedirect(res);
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.includes("sb-auth-token=") && /max-age=0/i.test(c))).toBe(true);
  });

  it("claims fail + getUser null → /login redirect", async () => {
    const res = await proxy(req("/mechanics/salary"));
    expectLoginRedirect(res);
  });
});

describe("proxy — absolute session age cap", () => {
  it("age > cap → signOut + /login?reason=idle + session cookies cleared", async () => {
    authMock.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", role: "authenticated" }, signature: "sig" },
      error: null,
    });
    authMock.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const oldTs = String(Date.now() - ABSOLUTE_MS - 60_000);
    const res = await proxy(req("/dashboard", `vtech_session_start=${oldTs}`));
    expect(res.headers.get("location")).toContain("/login?reason=idle");
    expect(authMock.signOut).toHaveBeenCalled();
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.includes("vtech_session_start=") && /max-age=0/i.test(c))).toBe(
      true
    );
  });

  it("age within cap + valid claims → passthrough", async () => {
    authMock.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", role: "authenticated" }, signature: "sig" },
      error: null,
    });
    const ts = String(Date.now() - 60_000);
    const res = await proxy(req("/dashboard", `vtech_session_start=${ts}`));
    expectPassthrough(res);
    expect(authMock.signOut).not.toHaveBeenCalled();
  });
});
