import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { requireAdmin, UNAUTHORIZED } from "@/lib/api-auth";
import {
  readSyncMode,
  getSyncTaskEnabled,
  getSyncWatcherTaskEnabled,
  readCloudRuns,
  readCloudPending,
  setCloudPending,
  type CloudRun,
} from "@/lib/sync-settings";

const exec = promisify(execFile);
const SCRIPT = path.join(process.cwd(), "scripts", "supabase-to-mariadb.mjs");
const LOG_FILE = path.join(process.cwd(), "scripts", "supabase-to-mariadb.log");
const NODE_BIN = process.env.NODE || "node";
const IS_WIN = process.platform === "win32";

function tailLog(lines = 60): string {
  try {
    const content = fs.readFileSync(LOG_FILE, "utf8");
    return content.trim().split("\n").slice(-lines).join("\n");
  } catch {
    return "";
  }
}

const runSummary = (r?: CloudRun | null) =>
  r
    ? {
        id: r.id,
        started_at: r.started_at,
        finished_at: r.finished_at,
        status: r.status,
        tables: r.tables,
        rows: r.rows,
        mismatches: r.mismatches,
        duration_sec: r.duration_sec,
        details: r.details,
      }
    : null;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return UNAUTHORIZED();

  const [mode, pending, runs, taskEnabled, watcherEnabled] = await Promise.all([
    readSyncMode(),
    readCloudPending(),
    readCloudRuns(),
    IS_WIN ? getSyncTaskEnabled() : Promise.resolve(null),
    IS_WIN ? getSyncWatcherTaskEnabled() : Promise.resolve(null),
  ]);
  const log = tailLog(60);

  return NextResponse.json({
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    mariadb: {
      host: process.env.MARIADB_HOST || "127.0.0.1",
      port: Number(process.env.MARIADB_PORT || 3306),
      db: process.env.MARIADB_DB || "vtech_db",
    },
    mode,
    pending,
    task_enabled: taskEnabled,
    watcher_enabled: watcherEnabled,
    scheduled: mode === "auto",
    schedule_note:
      "Task Scheduler har 15 min (auto) + remote 'Sync Now' request par shop PC ka 1-min watcher",
    log_file: "scripts/supabase-to-mariadb.log",
    log: log.split("\n").slice(0, 20),
    history: runs,
  });
}

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return UNAUTHORIZED();

  const mode = await readSyncMode();
  if (mode === "off") {
    const history = await readCloudRuns();
    return NextResponse.json(
      {
        status: "disabled",
        error:
          "Sync OFF hai. Pehle mode ko Auto ya Manual par rakho, phir Sync Now dabao.",
        history,
      },
      { status: 403 }
    );
  }

  // Remote "Sync Now": Supabase me pending flag set karo — shop PC ka watcher
  // (~1 min) aur scheduled run ise pick karke sync chalayenge.
  await setCloudPending(true);
  let history = await readCloudRuns();
  const last = runSummary(history[0]);

  if (IS_WIN) {
    // Shop PC (localhost): turant execute bhi kar do — result turant dikhega.
    let output = "";
    try {
      const { stdout, stderr } = await exec(
        NODE_BIN,
        [SCRIPT, "--quiet", "--force"],
        { timeout: 180000, windowsHide: true }
      );
      output = (stdout || "") + (stderr || "");
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string; message?: string };
      output =
        (err.stdout || "") +
        (err.stderr || "") +
        (err.message ? `\n${err.message}` : "");
      history = await readCloudRuns();
      return NextResponse.json({
        status: "error",
        error: output.trim().split("\n").filter(Boolean).slice(-8).join("\n"),
        last: runSummary(history[0]),
        history,
      });
    }
    history = await readCloudRuns();
    const lastRun = runSummary(history[0]);
    if (lastRun && lastRun.status === "OK") {
      return NextResponse.json({ status: "ok", last: lastRun, history });
    }
    return NextResponse.json({
      status: "error",
      error: output.trim().split("\n").filter(Boolean).slice(-8).join("\n"),
      last: lastRun,
      history,
    });
  }

  // Vercel/remote: sirf request set kiya — execution shop PC pe hota hai.
  return NextResponse.json({
    status: "requested",
    message:
      "Sync request shop PC tak pahunch gayi — ~1 minute me execute hogi. Thodi der baad Refresh karo.",
    pending: true,
    last,
    history,
  });
}
