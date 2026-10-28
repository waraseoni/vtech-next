import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clientIpFromHeaders, rateLimit } from "./rate-limit";

let seq = 0;
const freshKey = () => `test:${++seq}`;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-28T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows requests up to the limit and then returns retryAfter", () => {
    const key = freshKey();
    expect(rateLimit(key, 3, 60_000)).toMatchObject({ ok: true, remaining: 2 });
    expect(rateLimit(key, 3, 60_000)).toMatchObject({ ok: true, remaining: 1 });
    expect(rateLimit(key, 3, 60_000)).toMatchObject({ ok: true, remaining: 0 });

    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBe(60);
  });

  it("resets the window after it expires", () => {
    const key = freshKey();
    rateLimit(key, 1, 60_000);
    expect(rateLimit(key, 1, 60_000).ok).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(rateLimit(key, 1, 60_000)).toMatchObject({ ok: true, remaining: 0 });
  });

  it("counts each key independently", () => {
    const a = freshKey();
    const b = freshKey();
    rateLimit(a, 1, 60_000);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
  });

  it("returns a positive retryAfter even at window boundary", () => {
    const key = freshKey();
    rateLimit(key, 1, 1_000);
    vi.advanceTimersByTime(999);
    const blocked = rateLimit(key, 1, 1_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThanOrEqual(1);
  });
});

describe("clientIpFromHeaders", () => {
  it("takes the first x-forwarded-for entry", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.9");
  });

  it("strips the IPv4-mapped IPv6 prefix", () => {
    const headers = new Headers({ "x-forwarded-for": "::ffff:203.0.113.9" });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip and cf-connecting-ip", () => {
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIpFromHeaders(new Headers({ "cf-connecting-ip": "198.51.100.8" }))).toBe(
      "198.51.100.8"
    );
  });

  it("returns a stable placeholder when no client headers exist", () => {
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
});
