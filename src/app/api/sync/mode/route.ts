import { NextResponse } from "next/server";
import { requireAdmin, UNAUTHORIZED } from "@/lib/api-auth";
import {
  readSyncMode,
  writeSyncMode,
  getSyncTaskEnabled,
  setSyncTaskEnabled,
  SYNC_MODES,
  type SyncMode,
} from "@/lib/sync-settings";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return UNAUTHORIZED();
  return NextResponse.json({
    status: "ok",
    mode: await readSyncMode(),
    task_enabled: await getSyncTaskEnabled(),
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return UNAUTHORIZED();

  let mode: string;
  try {
    const body = await req.json();
    mode = body?.mode;
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!SYNC_MODES.includes(mode as SyncMode)) {
    return NextResponse.json(
      { status: "error", error: 'mode = "auto" | "manual" | "off" hona chahiye' },
      { status: 400 }
    );
  }

  // Cloud (system_info) me save karo — Vercel GUI, shop PC script, sab yahi padhte hain.
  const cloudOk = await writeSyncMode(mode as SyncMode);

  // Shop PC (localhost): local file mirror + Task Scheduler ko bhi sync rakho.
  // Auto → task enable, manual/off → task disable.
  const taskChangeOk = await setSyncTaskEnabled(mode === "auto");

  return NextResponse.json({
    status: "ok",
    mode,
    cloud_saved: cloudOk,
    task_enabled: mode === "auto" ? taskChangeOk : !taskChangeOk,
  });
}
