import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isPortalEnabled, requireDev, setPortalCookie, verifyPortalPassword } from "@/lib/portal-auth";

// Developer portal password gate — double password ka doosra step.
// Password #1 = admin/developer login, password #2 = ye env password.
export async function POST(req: NextRequest) {
  if (!isPortalEnabled("dev")) {
    return NextResponse.json({ error: "Developer portal enabled nahi hai (env vars missing)" }, { status: 404 });
  }
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!verifyPortalPassword("dev", body.password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 403 });
  }
  await setPortalCookie("dev");
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const auth = await requireDev();
  if (!auth) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true });
}
