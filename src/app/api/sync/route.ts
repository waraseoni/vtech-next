import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { requireAdmin, UNAUTHORIZED } from "@/lib/api-auth";
import { readSyncMode, getSyncTaskEnabled } from "@/lib/sync-settings";

const exec = promisify(execFile);
const SCRIPT = path.join(process.cwd(), "scripts", "supabase-to-mariadb.mjs");
const LOG_FILE = path.join(process.cwd(), "scripts", "supabase-to-mariadb.log");
const NODE_BIN = process.env.NODE || "node";

type HistoryRow = {
  id: number;
  started_at: string;
  finished_at: string;
  status: string;
  tables: number;
  rows: number;
  mismatches: number;
  duration_sec: number | string;
  details: string | null;
};

// Script se `--history N` chala kar aakhri runs ki JSON history laata hai.
async function fetchHistory(limit = 50): Promise<HistoryRow[]> {
  try {
    const { stdout } = await exec(NODE_BIN, [SCRIPT, "--history", String(limit)], {
      timeout: 30000,
      windowsHide: true,
    });
    const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.startsWith("[") || line.startsWith("{")) {
        const data = JSON.parse(line);
        if (Array.isArray(data)) return data as HistoryRow[];
      }
    }
    return [];
  } catch {
    return [];
  }
}

function tailLog(lines = 60): string {
  try {
    const content = fs.readFileSync(LOG_FILE, "utf8");
    return content.trim().split("\n").slice(-lines).join("\n");
  } catch {
    return "";
  }
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return UNAUTHORIZED();

  const mode = readSyncMode();
  const taskEnabled = await getSyncTaskEnabled();
  const [history, log] = await Promise.all([fetchHistory(50), Promise.resolve(tailLog(60))]);

  return NextResponse.json({
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    mariadb: {
      host: process.env.MARIADB_HOST || "127.0.0.1",
      port: Number(process.env.MARIADB_PORT || 3306),
      db: process.env.MARIADB_DB || "vtech_db",
    },
    mode,
    task_enabled: taskEnabled,
    scheduled: mode === "auto",
    schedule_note: "Windows Task Scheduler · har 15 minute",
    log_file: "scripts/supabase-to-mariadb.log",
    log: log.split("\n").slice(0, 20),
    history,
  });
}

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return UNAUTHORIZED();

  const mode = readSyncMode();
  if (mode === "off") {
    const history = await fetchHistory(50);
    return NextResponse.json(
      {
        status: "disabled",
        error: "Sync OFF hai. Pehle mode ko Auto ya Manual par rakho, phir Sync Now dabao.",
        history,
      },
      { status: 403 }
    );
  }

  let output = "";
  try {
    const { stdout, stderr } = await exec(NODE_BIN, [SCRIPT, "--quiet", "--force"], {
      timeout: 180000,
      windowsHide: true,
    });
    output = (stdout || "") + (stderr || "");
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    output = (err.stdout || "") + (err.stderr || "") + (err.message ? `\n${err.message}` : "");
    const history = await fetchHistory(50);
    const last = history[0] || null;
    return NextResponse.json({
      status: "error",
      error: output.trim().split("\n").filter(Boolean).slice(-8).join("\n"),
      last,
      history,
    });
  }

  const history = await fetchHistory(50);
  const last = history[0] || null;
  if (last && last.status === "OK") {
    return NextResponse.json({ status: "ok", last, history });
  }
  return NextResponse.json({
    status: "error",
    error: output.trim().split("\n").filter(Boolean).slice(-8).join("\n"),
    last,
    history,
  });
}
