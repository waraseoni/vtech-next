import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  runScheduledBackup,
  listBackupFiles,
  listStorageBackups,
  deleteStorageBackup,
  deleteLocalBackup,
} from "@/lib/scheduledBackup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-side scheduled backup UI support.
// GET  → backups/ folder + Supabase Storage 'backups' bucket ki recent files
//        (verification — Vercel par filesystem ephemeral hai, Storage persistent)
// POST → abhi ek server-side JSON backup run karo (read-only DB + local file
//        write best-effort + Supabase Storage cloud copy)
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const files = listBackupFiles(10);
  let storageFiles: { name: string; modified: string }[] = [];
  if (url && key) {
    try {
      storageFiles = await listStorageBackups(url, key, 5);
    } catch (e) {
      console.warn("storage list fail:", e);
    }
  }
  return NextResponse.json({ ok: true, files, storageFiles });
}

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "Supabase env missing" }, { status: 500 });
  }

  try {
    const result = await runScheduledBackup(url, key);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("scheduled backup error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Backup run fail hua." },
      { status: 500 }
    );
  }
}

// DELETE → ek backup file hatao.
// Query: ?target=cloud|local&name=vtech_backup_....json
// Sirf apni backup naming wali files delete hoti hain (helper validate karta hai).
export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") ?? "";
  const target = searchParams.get("target") ?? "cloud";

  try {
    if (target === "local") {
      deleteLocalBackup(name);
    } else if (target === "cloud") {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        return NextResponse.json({ ok: false, error: "Supabase env missing" }, { status: 500 });
      }
      await deleteStorageBackup(url, key, name);
    } else {
      return NextResponse.json({ ok: false, error: "target cloud|local hona chahiye." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, deleted: name, target });
  } catch (error) {
    console.error("backup delete error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Delete fail hua." },
      { status: 400 }
    );
  }
}