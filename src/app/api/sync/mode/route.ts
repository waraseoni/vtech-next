import { NextResponse } from "next/server";
import { requireAdmin, UNAUTHORIZED } from "@/lib/api-auth";
import {
  readSyncMode,
  writeSyncMode,
  setSyncTaskEnabled,
  SYNC_MODES,
  type SyncMode,
} from "@/lib/sync-settings";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return UNAUTHORIZED();
  return NextResponse.json({ mode: readSyncMode() });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return UNAUTHORIZED();

  let mode: string;
  try {
    const body = await req.json();
    mode = body?.mode;
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON body" }, { status: 400 });
  }

  if (!SYNC_MODES.includes(mode as SyncMode)) {
    return NextResponse.json(
      { status: "error", error: 'mode = "auto" | "manual" | "off" hona chahiye' },
      { status: 400 }
    );
  }

  writeSyncMode(mode as SyncMode);

  // Windows Task Scheduler ko bhi same state pe rakh do (best-effort).
  // Auto → task enable, manual/off → task disable.
  const taskChangeOk = await setSyncTaskEnabled(mode === "auto");

  return NextResponse.json({
    status: "ok",
    mode,
    task_enabled: mode === "auto" ? taskChangeOk : !taskChangeOk,
  });
}
