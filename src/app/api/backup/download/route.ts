import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { readLocalBackup, downloadStorageBackup } from "@/lib/scheduledBackup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → ek backup file download karo (admin-only).
// Query: ?target=cloud|local&name=vtech_backup_....json
// Local = server ke backups/ folder se; cloud = Supabase Storage 'backups' bucket se.
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") ?? "";
  const target = searchParams.get("target") ?? "cloud";

  try {
    let data: Buffer | ArrayBuffer;
    if (target === "local") {
      data = readLocalBackup(name);
    } else if (target === "cloud") {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        return NextResponse.json({ ok: false, error: "Supabase env missing" }, { status: 500 });
      }
      data = await downloadStorageBackup(url, key, name);
    } else {
      return NextResponse.json({ ok: false, error: "target cloud|local hona chahiye." }, { status: 400 });
    }

    return new NextResponse(data as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("backup download error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Download fail hua." },
      { status: 400 }
    );
  }
}
