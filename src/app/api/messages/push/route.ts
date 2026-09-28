import { NextRequest, NextResponse } from "next/server";
import { requireStaffWriter } from "@/lib/api-auth";
import { isPushConfigured, sendPushToUser } from "@/lib/push-send";

/**
 * POST /api/messages/push
 * Staff-authenticated — naya message par recipient ko push bhejo.
 *
 * Body: { recipientId, senderName, content }
 *
 * Ye `/api/push/send` (admin-only) se alag hai — koi bhi staff apne message
 * ke liye recipient ko notify kar sakta hai. Best-effort: push configured na
 * ho to silently pass.
 */
export async function POST(req: NextRequest) {
  try {
    // Staff + office ke bahar + permit nahi → block (message ke saath push
    // bhejna bhi ek change hai — warna blocked message ka notification jaayega).
    const session = await requireStaffWriter(req);
    if (session instanceof NextResponse) return session;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const recipientId = typeof body.recipientId === "string" ? body.recipientId : "";
    const senderName =
      typeof body.senderName === "string" && body.senderName.trim()
        ? body.senderName.trim()
        : "Team";
    const content =
      typeof body.content === "string" && body.content.trim() ? body.content.trim() : "";

    if (!recipientId || !content) {
      return NextResponse.json({ error: "recipientId aur content zaroori hai" }, { status: 400 });
    }

    if (!isPushConfigured()) {
      return NextResponse.json({ ok: true, sent: 0, skipped: "no-vapid" });
    }

    const result = await sendPushToUser(recipientId, {
      title: `${senderName} ne message bheja`,
      body: content.length > 90 ? content.slice(0, 90) + "…" : content,
      url: "/messages",
      tag: `msg-${recipientId}`,
    });

    return NextResponse.json({ ok: true, sent: result.sent, failed: result.failed });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
