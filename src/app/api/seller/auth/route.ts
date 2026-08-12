import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isPortalEnabled, requireSeller, setPortalCookie, verifyPortalPassword } from "@/lib/portal-auth";

// Password #2 for seller portal (password #1 = admin login).
export async function POST(req: NextRequest) {
  if (!isPortalEnabled("seller")) {
    return NextResponse.json({ error: "Seller portal enabled nahi hai (env vars missing)" }, { status: 404 });
  }
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!verifyPortalPassword("seller", body.password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 403 });
  }
  await setPortalCookie("seller");
  return NextResponse.json({ ok: true });
}

// Check: kya current session portal ke liye authorized hai?
export async function GET() {
  const auth = await requireSeller();
  if (!auth) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true });
}
