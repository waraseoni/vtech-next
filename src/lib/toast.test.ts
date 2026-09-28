import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// sonner ko capture karo — real Toaster DOM ki zaroorat nahi.
// `vi.hoisted` zaroori: vi.mock top-level par hoist ho jaata hai, to mock
// factory me reference karne wala variable pehle se initialize hona chahiye.
const s = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
  promise: {},
}));
vi.mock("sonner", () => ({ toast: s }));

import { toast } from "./toast";

/** Sonner options jisse dedup decide hota hai. */
const optsOf = (fn: unknown, call: number) =>
  (fn as ReturnType<typeof vi.fn>).mock.calls[call][1] as { id: string; duration: number };

beforeEach(() => {
  for (const fn of Object.values(s)) if (typeof (fn as { mockClear?: unknown }).mockClear === "function") (fn as { mockClear: () => void }).mockClear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("toast dedup — same message collapse into one toast", () => {
  it("warning: same text → same id (sonner updates in place, no stack)", () => {
    toast.warning("Aap office ke bahar hain");
    toast.warning("Aap office ke bahar hain");
    const a = optsOf(s.warning, 0);
    const b = optsOf(s.warning, 1);
    expect(a.id).toBe(b.id);
  });

  it("warning: alag text → alag id (do alag message alag toast)", () => {
    toast.warning("Aap office ke bahar hain");
    toast.warning("Location permission deny hai");
    expect(optsOf(s.warning, 0).id).not.toBe(optsOf(s.warning, 1).id);
  });

  it("error: same text jo warning me aaya → WOHI id (cross-level collapse)", () => {
    // Ye hi geofence case hai: gate `toast.warning(msg)` + call-site
    // `toast.error(error.message)` — same text, to ek hi toast.
    toast.warning("Aap office ke bahar hain");
    toast.error("Aap office ke bahar hain");
    expect(optsOf(s.error, 0).id).toBe(optsOf(s.warning, 0).id);
  });

  it("success DEDUPE NAHI hota (2 rows save = 2 alag confirmation)", () => {
    toast.success("Saved!");
    toast.success("Saved!");
    const a = s.success.mock.calls[0][1] as { id?: string };
    const b = s.success.mock.calls[1][1] as { id?: string };
    expect(a.id).toBeUndefined();
    expect(b.id).toBeUndefined();
  });
});

describe("toast dedup — repeated error stops being permanent", () => {
  it("pehla error Infinity (dismiss tak tikka), repeat bounded", () => {
    vi.useFakeTimers();
    toast.error("Saved nahi gaya");
    expect(optsOf(s.error, 0).duration).toBe(Infinity);

    // Same id, REPEAT_WINDOW_MS (4s) ke andar → bounded re-affirm
    vi.advanceTimersByTime(1000);
    toast.error("Saved nahi gaya");
    expect(optsOf(s.error, 1).duration).toBe(5000);
  });

  it("window ke baad wapas fresh (Infinity) — user ne dismiss kar diya maan lo", () => {
    vi.useFakeTimers();
    toast.error("Saved nahi gaya");
    vi.advanceTimersByTime(5000);
    toast.error("Saved nahi gaya");
    expect(optsOf(s.error, 1).duration).toBe(Infinity);
  });

  it("explicit duration caller ne di ho to use overwrite nahi hota", () => {
    vi.useFakeTimers();
    toast.error("X", { duration: 2000 });
    vi.advanceTimersByTime(500);
    toast.error("X", { duration: 2000 });
    expect(optsOf(s.error, 1).duration).toBe(2000);
  });
});

describe("toast dedup — explicit id opt-in", () => {
  it("caller khud id de sake (pinned slot)", () => {
    toast.warning("A", { id: "pinned" });
    toast.warning("B", { id: "pinned" });
    expect(optsOf(s.warning, 0).id).toBe("pinned");
    expect(optsOf(s.warning, 1).id).toBe("pinned");
  });
});
