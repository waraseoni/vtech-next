import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";

// Public liveness/readiness probe. No writes, no secrets — sirf status,
// version/commit aur env presence booleans (uptime monitor isse hit karta hai).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";
const COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT || "";

export async function GET(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  const limit = rateLimit(`health:${ip}`, 120, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { status: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let db: "ok" | "error" = "ok";
  try {
    const { error } = await getAdminSupabase()
      .from("system_info")
      .select("meta_field")
      .limit(1)
      .abortSignal(AbortSignal.timeout(3000));
    if (error) {
      db = "error";
      logger.error("health: db check failed:", error.message);
    }
  } catch (err: unknown) {
    db = "error";
    logger.error("health: db check threw:", err instanceof Error ? err.message : String(err));
  }

  return NextResponse.json(
    {
      status: db === "ok" ? "ok" : "degraded",
      db,
      version: VERSION,
      commit: COMMIT,
      checks: {
        trackingSecret: Boolean(process.env.PUBLIC_TRACKING_SECRET?.trim()),
        siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim()),
      },
      time: new Date().toISOString(),
    },
    {
      status: db === "ok" ? 200 : 503,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    }
  );
}
