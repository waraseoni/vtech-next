import { NextResponse } from "next/server";
import { requireDev } from "@/lib/portal-auth";
import { isLicenseAdminConfigured, getDevStats } from "@/lib/license-admin";
import { logger } from "@/lib/logger";

export async function GET() {
  if (!isLicenseAdminConfigured()) {
    return NextResponse.json({ error: "License admin configured nahi hai" }, { status: 503 });
  }
  const auth = await requireDev();
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized — developer password required" },
      { status: 401 }
    );
  }
  try {
    const stats = await getDevStats();
    return NextResponse.json(stats);
  } catch (err: unknown) {
    logger.error("developer/stats failed:", err);
    return NextResponse.json(
      { error: "Stats load nahi ho paye. Dobara try karein." },
      { status: 500 }
    );
  }
}
