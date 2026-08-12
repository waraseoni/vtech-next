import { NextResponse } from "next/server";
import { requireDev } from "@/lib/portal-auth";
import { isLicenseAdminConfigured, getDevStats } from "@/lib/license-admin";

export async function GET() {
  if (!isLicenseAdminConfigured()) {
    return NextResponse.json({ error: "License admin configured nahi hai" }, { status: 503 });
  }
  const auth = await requireDev();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized — developer password required" }, { status: 401 });
  }
  try {
    const stats = await getDevStats();
    return NextResponse.json(stats);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
