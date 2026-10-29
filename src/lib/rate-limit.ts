// Small fixed-window limiter for public endpoints.
// No DB writes and no schema change. Jab `UPSTASH_REDIS_REST_URL` +
// `UPSTASH_REDIS_REST_TOKEN` set hon to window Redis me shared hoti hai
// (serverless instances ke beech bhi); warna per-instance in-memory bucket
// fallback rehta hai. Redis fail ho to bhi request block nahi hoti — memory
// limiter sambhal leta hai, sirf protection kam hoti hai.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5_000;
const DISTRIBUTED_TIMEOUT_MS = 1_000;
const FALLBACK_WARN_INTERVAL_MS = 60_000;
let lastFallbackWarn = 0;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfter: number;
};

function distributedConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? { url, token } : null;
}

export function isDistributedRateLimitConfigured(): boolean {
  return distributedConfig() !== null;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const config = distributedConfig();
  if (config) {
    const distributed = await distributedRateLimit(config, key, limit, windowMs);
    if (distributed) return distributed;
  }
  return memoryRateLimit(key, limit, windowMs);
}

async function distributedRateLimit(
  config: { url: string; token: string },
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult | null> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const redisKey = `rl:${key}:${windowStart}`;

  try {
    const res = await fetch(`${config.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["PEXPIRE", redisKey, windowMs],
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(DISTRIBUTED_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const body = (await res.json()) as Array<{ result?: unknown }> | null;
    const count = Number(body?.[0]?.result);
    if (!Number.isFinite(count) || count < 1) throw new Error("unexpected pipeline result");

    if (count <= limit) return { ok: true, remaining: limit - count, retryAfter: 0 };
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
    };
  } catch (err) {
    // Fallback ko throttle karke log karo — warna Redis outage par har request
    // log line bana degi.
    if (now - lastFallbackWarn > FALLBACK_WARN_INTERVAL_MS) {
      lastFallbackWarn = now;
      console.warn(
        "[rate-limit] distributed backend unavailable, using memory:",
        err instanceof Error ? err.message : String(err)
      );
    }
    return null;
  }
}

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    prune(now);
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, retryAfter: 0 };
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const raw =
    forwarded?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    "";
  return raw.replace(/^::ffff:/, "").split("%")[0] || "unknown";
}

function prune(now: number): void {
  if (buckets.size <= MAX_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still too many live keys (spoofed IPs / heavy traffic) — drop oldest entries
  // so the map cannot grow without bound.
  while (buckets.size > MAX_KEYS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}
