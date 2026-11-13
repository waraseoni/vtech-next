import { NextResponse, type NextRequest } from "next/server";
import { requireStaff, getSessionRole } from "@/lib/api-auth";
import { executeGeminiTool, type AiRole } from "@/lib/gemini-tools";
import { logger } from "@/lib/logger";

/**
 * PERF: `get_business_alerts` 8-10 queries chalata hai (2-3s server time) aur
 * dashboard widget isko HAR load par maangta hai. Result minute-do minute purana
 * hona bilkul theek hai (alerts "fresh" hote hain, realtime nahi), isliye
 * process-level TTL cache.
 *
 * `?fresh=1` → cache bypass (widget ka manual Refresh button).
 * Multi-instance par har instance ka apna cache hai — acceptable, kyunki asli
 * cost DB queries hain, aur har instance pehli call ke baad fast ho jata hai.
 */
const CACHE_TTL_MS = Math.max(0, Number(process.env.AI_ALERTS_CACHE_MS ?? 120_000));

type CachedAlerts = { at: number; role: AiRole; alerts: unknown };
let cache: CachedAlerts | null = null;

export async function GET(req: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessionRole = await getSessionRole();
    const role: AiRole = sessionRole === "admin" ? "admin" : "staff";

    const fresh = req.nextUrl.searchParams.get("fresh") === "1";
    if (!fresh && cache && cache.role === role && Date.now() - cache.at < CACHE_TTL_MS) {
      return NextResponse.json({ role, alerts: cache.alerts, cached: true });
    }

    const alerts = await executeGeminiTool({ name: "get_business_alerts", args: {} }, role);
    cache = { at: Date.now(), role, alerts };

    return NextResponse.json({ role, alerts });
  } catch (error) {
    logger.error("Alerts API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to load alerts",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
