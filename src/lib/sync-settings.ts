import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const exec = promisify(execFile);

// Sync mode control (auto / manual / off):
//   - auto   → Task Scheduler har 15 min me sync chalta hai
//   - manual → scheduled sync skip hota hai, sirf "Sync Now" chalata hai
//   - off    → sab kuch band, jab tak dobara on na karo
//
// State DO jagah rehta hai:
//   • Supabase system_info (key-value)  → SINGLE SOURCE OF TRUTH. Vercel ke /sync
//     page (remote), shop PC ki GUI, aur sync script — sab yahi padhte/likhte hain.
//   • scripts/sync-settings.json        → shop PC ka local cache/fallback (agar
//     cloud nahi pahunch paaye to). Sath hi Task Scheduler ko enable/disable karne
//     me bhi use hota hai.

export type SyncMode = "auto" | "manual" | "off";

export const SYNC_MODES: SyncMode[] = ["auto", "manual", "off"];
export const SYNC_TASK_NAME = "\\VTech Supabase MariaDB Sync";
export const SYNC_WATCHER_TASK_NAME = "\\VTech Sync Watcher";
export const SYNC_SETTINGS_FILE = path.join(
  process.cwd(),
  "scripts",
  "sync-settings.json"
);

const IS_WIN = process.platform === "win32";

export const SYNC_CFG_KEYS = {
  mode: "sync_mode",
  pending: "sync_pending",
  runs: "sync_runs",
  lastRun: "sync_last_run",
} as const;

function serverSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    { auth: { persistSession: false } }
  );
}

async function cloudGet(field: string): Promise<string | null> {
  try {
    const { data, error } = await serverSupabase()
      .from("system_info")
      .select("meta_value")
      .eq("meta_field", field)
      .maybeSingle();
    if (error) return null;
    return data?.meta_value ?? null;
  } catch {
    return null;
  }
}

export async function cloudUpsert(field: string, value: string): Promise<boolean> {
  try {
    const s = serverSupabase();
    const existing = await cloudGet(field);
    if (existing !== null) {
      const { error } = await s
        .from("system_info")
        .update({ meta_value: value })
        .eq("meta_field", field);
      if (error) throw error;
    } else {
      const { error } = await s
        .from("system_info")
        .insert({ meta_field: field, meta_value: value });
      if (error) throw error;
    }
    return true;
  } catch {
    return false;
  }
}

export function readLocalSyncMode(): SyncMode {
  try {
    const parsed = JSON.parse(fs.readFileSync(SYNC_SETTINGS_FILE, "utf8"));
    if (parsed && SYNC_MODES.includes(parsed.mode)) return parsed.mode;
  } catch {
    // file nahi hai ya corrupt — default auto
  }
  return "auto";
}

export async function readSyncMode(): Promise<SyncMode> {
  const cloud = await cloudGet(SYNC_CFG_KEYS.mode);
  if (cloud && SYNC_MODES.includes(cloud as SyncMode)) return cloud as SyncMode;
  return readLocalSyncMode();
}

export async function writeSyncMode(mode: SyncMode): Promise<boolean> {
  const ok = await cloudUpsert(SYNC_CFG_KEYS.mode, mode);
  if (mode === "off") {
    // purana pending request clear karo — off me kuch nahi chalna chahiye
    await cloudUpsert(SYNC_CFG_KEYS.pending, "0");
  }
  // Shop PC ka local mirror (fallback + schtasks toggle)
  if (IS_WIN) {
    try {
      fs.mkdirSync(path.dirname(SYNC_SETTINGS_FILE), { recursive: true });
      fs.writeFileSync(SYNC_SETTINGS_FILE, JSON.stringify({ mode }, null, 2));
    } catch {
      // ignore
    }
  }
  return ok;
}

// Windows Task Scheduler state (best-effort — sirf shop PC/localhost par meaningful).
export async function getSyncTaskEnabled(): Promise<boolean | null> {
  if (!IS_WIN) return null;
  try {
    const { stdout } = await exec(
      "schtasks",
      ["/query", "/tn", SYNC_TASK_NAME, "/fo", "LIST"],
      { timeout: 10000, windowsHide: true }
    );
    const status =
      /Status:\s*(.+)/i.exec(stdout)?.[1]?.trim().toLowerCase() || "";
    return status === "ready" || status === "running"
      ? true
      : status === "disabled"
        ? false
        : null;
  } catch {
    return null;
  }
}

export async function getSyncWatcherTaskEnabled(): Promise<boolean | null> {
  if (!IS_WIN) return null;
  try {
    const { stdout } = await exec(
      "schtasks",
      ["/query", "/tn", SYNC_WATCHER_TASK_NAME, "/fo", "LIST"],
      { timeout: 10000, windowsHide: true }
    );
    const status =
      /Status:\s*(.+)/i.exec(stdout)?.[1]?.trim().toLowerCase() || "";
    return status === "ready" || status === "running"
      ? true
      : status === "disabled"
        ? false
        : null;
  } catch {
    return null;
  }
}

// Task ko enable/disable karta hai. Auto → enable, manual/off → disable.
export async function setSyncTaskEnabled(enabled: boolean): Promise<boolean> {
  if (!IS_WIN) return false;
  try {
    await exec(
      "schtasks",
      ["/Change", "/tn", SYNC_TASK_NAME, enabled ? "/ENABLE" : "/DISABLE"],
      { timeout: 10000, windowsHide: true }
    );
    return true;
  } catch {
    return false;
  }
}

// Remote "Sync Now" request — Supabase me flag set karta hai. Shop PC ka watcher
// (har 1 min) aur scheduled run ise pick karke sync chalate hain.
export async function readCloudPending(): Promise<boolean> {
  return (await cloudGet(SYNC_CFG_KEYS.pending)) === "1";
}

export async function setCloudPending(v: boolean): Promise<boolean> {
  return cloudUpsert(SYNC_CFG_KEYS.pending, v ? "1" : "0");
}

export type CloudRun = {
  id?: number;
  started_at?: string;
  finished_at?: string;
  status?: string;
  tables?: number;
  rows?: number;
  mismatches?: number;
  duration_sec?: number;
  details?: string | null;
};

export async function readCloudRuns(): Promise<CloudRun[]> {
  try {
    const v = await cloudGet(SYNC_CFG_KEYS.runs);
    const arr = JSON.parse(v || "[]");
    return Array.isArray(arr) ? (arr as CloudRun[]) : [];
  } catch {
    return [];
  }
}
