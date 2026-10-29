import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clientIpFromHeaders, isDistributedRateLimitConfigured, rateLimit } from "./rate-limit";

let seq = 0;
const freshKey = () => `test:${++seq}`;

const redisResponse = (counts: number[]) =>
  new Response(JSON.stringify(counts.map((result) => ({ result }))), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-28T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("rateLimit (memory)", () => {
  it("allows requests up to the limit and then returns retryAfter", async () => {
    const key = freshKey();
    expect(await rateLimit(key, 3, 60_000)).toMatchObject({ ok: true, remaining: 2 });
    expect(await rateLimit(key, 3, 60_000)).toMatchObject({ ok: true, remaining: 1 });
    expect(await rateLimit(key, 3, 60_000)).toMatchObject({ ok: true, remaining: 0 });

    const blocked = await rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBe(60);
  });

  it("resets the window after it expires", async () => {
    const key = freshKey();
    await rateLimit(key, 1, 60_000);
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(await rateLimit(key, 1, 60_000)).toMatchObject({ ok: true, remaining: 0 });
  });

  it("counts each key independently", async () => {
    const a = freshKey();
    const b = freshKey();
    await rateLimit(a, 1, 60_000);
    expect((await rateLimit(a, 1, 60_000)).ok).toBe(false);
    expect((await rateLimit(b, 1, 60_000)).ok).toBe(true);
  });

  it("returns a positive retryAfter even at window boundary", async () => {
    const key = freshKey();
    await rateLimit(key, 1, 1_000);
    vi.advanceTimersByTime(999);
    const blocked = await rateLimit(key, 1, 1_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThanOrEqual(1);
  });
});

describe("rateLimit (distributed)", () => {
  const configure = () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test/");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  };

  it("reports configuration presence", () => {
    expect(isDistributedRateLimitConfigured()).toBe(false);
    configure();
    expect(isDistributedRateLimitConfigured()).toBe(true);
  });

  it("enforces the limit through Redis when configured", async () => {
    configure();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redisResponse([1, 1]))
      .mockResolvedValueOnce(redisResponse([2, 1]))
      .mockResolvedValueOnce(redisResponse([3, 1]));
    vi.stubGlobal("fetch", fetchMock);

    const key = freshKey();
    expect(await rateLimit(key, 2, 60_000)).toMatchObject({ ok: true, remaining: 1 });
    expect(await rateLimit(key, 2, 60_000)).toMatchObject({ ok: true, remaining: 0 });
    const blocked = await rateLimit(key, 2, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBe(60);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://redis.example.test/pipeline");
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-token" });
    const body = JSON.parse(String(init.body));
    expect(body[0][0]).toBe("INCR");
    expect(body[0][1]).toMatch(new RegExp(`^rl:${key}:`));
    expect(body[1]).toEqual(["PEXPIRE", body[0][1], 60_000]);
  });

  it("falls back to memory when Redis rejects the request", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const key = freshKey();
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(true);
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(false);
  });

  it("falls back to memory when Redis returns an error status", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));

    const key = freshKey();
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(true);
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(false);
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
