import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listLocked, reset } from "@/lib/login-throttle";

// Admin ops — locked users list + manual unlock. Admin-only.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const search = request.nextUrl.searchParams.get("q") || undefined;
  try {
    const rows = await listLocked(search);
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: "Throttle list load nahi hua: " + (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email zaroori hai" }, { status: 400 });

  await reset(email);
  return NextResponse.json({ success: true });
}
