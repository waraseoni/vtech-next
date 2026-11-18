import { NextResponse } from "next/server";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";

// Real-user Web Vitals sink (src/components/WebVitals.tsx se sendBeacon).
//
// KYUN: ab tak perf ka poora measurement local synthetic tha. Is endpoint se
// production ke actual LCP/CLS/INP/TTFB/FCP pata chalte hain — Vercel function
// logs me structured line, aur Sentry metrics (DSN set ho to) distribution.
//
// Design: fire-and-forget — hamesha 204, kabhi body echo nahi, koi PII nahi
// (sirf metric name/value/rating + pathname). Auth nahi: /login jaise public
// pages bhi report karte hain. Isliye rate limit + hard size cap.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1024;
const METRICS = new Set(["TTFB", "FCP", "LCP", "CLS", "INP"]);
const RATINGS = new Set(["good", "needs-improvement", "poor"]);

/**
 * Plausible range per metric. Isse bahar ki values measurement artifact hoti
 * hain (backgrounded tab / BFCache restore par TTFB-LCP safed 100s+ de dete
 * hain) — unhe drop karna behtar hai warna p75 bekaar kharab dikhta hai.
 */
const MAX_VALUE: Record<string, number> = {
  TTFB: 60_000,
  FCP: 60_000,
  LCP: 60_000,
  INP: 60_000,
  CLS: 10,
};

const noContent = () =>
  new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });

/** Sentry distribution metric — error tracking ke saath hi p75 mil jata hai. */
async function reportMetric(
  name: string,
  value: number,
  rating: string,
  path: string,
  navigation: string
) {
  if (!(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN)) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    if (!Sentry.getClient()) return;
    Sentry.metrics.distribution("web_vitals", value, {
      ...(name === "CLS" ? {} : { unit: "millisecond" }),
      attributes: { metric: name, rating, route: path, navigation },
    });
    // Serverless: function freeze se pehle bhej do (beacon hamesha 204 hai,
    // isliye kisi user ko wait nahi karana padta).
    await Sentry.flush(1000);
  } catch {
    /* metrics best-effort */
  }
}

export async function POST(request: Request) {
  try {
    const ip = clientIpFromHeaders(request.headers);
    if (!(await rateLimit(`vitals:${ip}`, 120, 60_000)).ok) return noContent();

    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) return noContent();

    const raw = await request.text();
    if (!raw || raw.length > MAX_BODY_BYTES) return noContent();

    const body = JSON.parse(raw) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name : "";
    const value = Number(body.value);
    if (!METRICS.has(name) || !Number.isFinite(value) || value < 0) {
      return noContent();
    }
    if (value > (MAX_VALUE[name] ?? 60_000)) return noContent();

    const rating =
      typeof body.rating === "string" && RATINGS.has(body.rating) ? body.rating : "unknown";
    const path = typeof body.path === "string" ? body.path.slice(0, 128) : "";
    const navigation =
      typeof body.navigationType === "string" ? body.navigationType.slice(0, 32) : "";

    // logger prod me silent hai — prod function logs hi observation ka source
    // hain (csp-report route ka hi pattern).
    console.warn(
      "[web-vitals]",
      JSON.stringify({ name, value: Math.round(value), rating, path, navigation })
    );

    await reportMetric(name, value, rating, path, navigation);
  } catch {
    // Malformed payload — telemetry hi thi, response error nahi.
  }
  return noContent();
}
