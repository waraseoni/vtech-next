import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isPushConfigured, sendPushToUser, sendPushToAll, sendPushToUsers } from "@/lib/push-send";

/**
 * POST /api/push/send
 * Admin-only endpoint — push notification bhejo.
 *
 * Body:
 *   { title, body, url?, tag?, userId? }         → ek user ko
 *   { title, body, url?, tag?, userIds: [...] }  → specific users ko
 *   { title, body, url?, tag? }                  → sabko (broadcast)
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Sirf admin push bhej sakta hai" }, { status: 403 });
    }

    if (!isPushConfigured()) {
      return NextResponse.json({ error: "VAPID keys configured nahi hain" }, { status: 503 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const text  = typeof body.body === "string" ? body.body.trim() : "";

    if (!title || !text) {
      return NextResponse.json({ error: "title aur body zaroori hai" }, { status: 400 });
    }

    const payload = {
      title,
      body: text,
      url: typeof body.url === "string" ? body.url : "/dashboard",
      tag: typeof body.tag === "string" ? body.tag : "vtech-notification",
    };

    let result;
    if (Array.isArray(body.userIds) && body.userIds.length > 0) {
      result = await sendPushToUsers(body.userIds as string[], payload);
    } else if (typeof body.userId === "string" && body.userId) {
      result = await sendPushToUser(body.userId, payload);
    } else {
      result = await sendPushToAll(payload);
    }

    return NextResponse.json({
      ok: true,
      sent: result.sent,
      failed: result.failed,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
