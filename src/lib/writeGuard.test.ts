import { describe, it, expect, vi, beforeEach } from "vitest";

// writeGuard toast karta hai (browser-only sonner) — mock, taaki test env me
// Toaster na chahiye aur message capture ho sake.
const warn = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: {
    warning: (m: string) => warn(m),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  default: { warning: (m: string) => warn(m) },
}));

import {
  blockedBuilder,
  getWriteGuardState,
  isWriteBlocked,
  notifyWriteBlocked,
  resetWriteGuardState,
  setWriteGuardState,
  withWriteGuardBypass,
  writeBlockedMessage,
} from "./writeGuard";

beforeEach(() => {
  resetWriteGuardState();
  warn.mockClear();
});

describe("write gate state", () => {
  it("default = open (staff check chalne se pehle bhi likh sakte hain)", () => {
    expect(isWriteBlocked()).toBe(false);
    expect(getWriteGuardState().status).toBe("unknown");
  });

  it("blocked=false jab ViewOnlyProvider viewOnly=false publish kare", () => {
    setWriteGuardState({ blocked: false, status: "inside" });
    expect(isWriteBlocked()).toBe(false);
  });

  it("bahar + permit nahi → blocked", () => {
    setWriteGuardState({ blocked: true, status: "outside", distanceM: 850.4 });
    expect(isWriteBlocked()).toBe(true);
    expect(getWriteGuardState().distanceM).toBe(850.4);
  });

  it("fail-closed reasons bhi block karte hain", () => {
    for (const s of ["denied", "unavailable", "timeout", "unsupported"]) {
      setWriteGuardState({ blocked: true, status: s });
      expect(isWriteBlocked()).toBe(true);
    }
  });

  it("reset (logout / non-staff) gate khol deta hai", () => {
    setWriteGuardState({ blocked: true, status: "outside" });
    resetWriteGuardState();
    expect(isWriteBlocked()).toBe(false);
  });
});

describe("withWriteGuardBypass (sirf geofence audit ke liye)", () => {
  it("bypass ke dauran gate off hai", () => {
    setWriteGuardState({ blocked: true, status: "outside" });
    const seen = withWriteGuardBypass(() => isWriteBlocked());
    expect(seen).toBe(false);
    expect(isWriteBlocked()).toBe(true); // bahar wapas
  });

  it("throw hone par bhi depth reset hota hai (finally)", () => {
    setWriteGuardState({ blocked: true, status: "outside" });
    expect(() =>
      withWriteGuardBypass(() => {
        throw new Error("boom");
      })
    ).toThrow("boom");
    expect(isWriteBlocked()).toBe(true);
  });

  it("nested bypass depth sahi balance hota hai", () => {
    setWriteGuardState({ blocked: true, status: "outside" });
    withWriteGuardBypass(() => {
      withWriteGuardBypass(() => expect(isWriteBlocked()).toBe(false));
      // inner exit ke baad outer abhi bhi active hai
      expect(isWriteBlocked()).toBe(false);
    });
    expect(isWriteBlocked()).toBe(true);
  });
});

describe("blockedBuilder", () => {
  // Har chain method wapas same type deta hai (recursive) + awaitable.
  type Chain = {
    [k: string]: (...a: unknown[]) => Chain;
  } & PromiseLike<{ data: null; error: { code: string } }>;

  it("error set karke resolve karta hai (throw nahi — caller ka normal path)", async () => {
    const res = (await blockedBuilder()) as {
      data: unknown;
      error: { code: string; message: string };
    };
    expect(res.data).toBeNull();
    expect(res.error.code).toBe("GEO_WRITE_BLOCKED");
  });

  it("chainable hai — .insert().select().single() bhi safe", async () => {
    const res = await (blockedBuilder() as Chain).insert({ x: 1 }).select("id").single();
    expect(res.error.code).toBe("GEO_WRITE_BLOCKED");
  });

  it("eq/order/match jaise filter methods bhi chain hote hain", async () => {
    const res = await (blockedBuilder() as Chain).delete().eq("id", 1).order("id");
    expect(res.error.code).toBe("GEO_WRITE_BLOCKED");
  });

  it("catch/finally bhi supported (promise-style callers)", async () => {
    const b = blockedBuilder() as unknown as {
      catch: () => Promise<{ data: null }>;
      finally: (fn?: () => void) => Promise<{ data: null }>;
    };
    await expect(b.catch()).resolves.toMatchObject({ data: null });
    await expect(b.finally()).resolves.toMatchObject({ data: null });
  });
});

describe("writeBlockedMessage", () => {
  it("outside: attendance wale jaisa wording + rounded distance", () => {
    const msg = writeBlockedMessage({ blocked: true, status: "outside", distanceM: 850.4 });
    expect(msg).toContain("Aap office ke bahar hain");
    expect(msg).toContain("850m");
    expect(msg).toContain("sirf dekh sakte hain");
  });

  it("fail-closed reasons ka apna message", () => {
    expect(writeBlockedMessage({ blocked: true, status: "denied", distanceM: null })).toContain(
      "permission"
    );
    expect(writeBlockedMessage({ blocked: true, status: "unsupported", distanceM: null })).toContain(
      "browser"
    );
  });

  it("distance unknown ho to 'm door' chhota ho jata hai", () => {
    const msg = writeBlockedMessage({ blocked: true, status: "outside", distanceM: null });
    expect(msg).not.toContain("m door");
  });
});

describe("notifyWriteBlocked", () => {
  it("throttled hai — 2.5s me ek hi toast", () => {
    setWriteGuardState({ blocked: true, status: "outside" });
    notifyWriteBlocked();
    notifyWriteBlocked();
    notifyWriteBlocked();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
