import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";

const exec = promisify(execFile);

// Sync mode control (auto / manual / off):
//   - auto   → Task Scheduler har 15 min me sync chalta hai
//   - manual → scheduled sync skip hota hai, sirf GUI "Sync Now" chalata hai
//   - off    → sab kuch band, jab tak dobara on na karo
//
// Mode file: scripts/sync-settings.json — ise sync script aur dono API routes
// dono padhte hain, isliye GUI aur Task Scheduler ek hi state follow karte hain.

export type SyncMode = "auto" | "manual" | "off";

export const SYNC_MODES: SyncMode[] = ["auto", "manual", "off"];
export const SYNC_TASK_NAME = "\\VTech Supabase MariaDB Sync";
export const SYNC_SETTINGS_FILE = path.join(
  process.cwd(),
  "scripts",
  "sync-settings.json"
);

export function readSyncMode(): SyncMode {
  try {
    const parsed = JSON.parse(fs.readFileSync(SYNC_SETTINGS_FILE, "utf8"));
    if (parsed && SYNC_MODES.includes(parsed.mode)) return parsed.mode;
  } catch {
    // file nahi hai ya corrupt — default auto
  }
  return "auto";
}

export function writeSyncMode(mode: SyncMode): void {
  fs.mkdirSync(path.dirname(SYNC_SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SYNC_SETTINGS_FILE, JSON.stringify({ mode }, null, 2));
}

// Windows Task Scheduler state (best-effort — task missing/permission issue par null).
export async function getSyncTaskEnabled(): Promise<boolean | null> {
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

// Task ko enable/disable karta hai. Auto → enable, manual/off → disable.
// Fail hone par bhi koi dikkat nahi — sync script khud mode file check karta hai.
export async function setSyncTaskEnabled(enabled: boolean): Promise<boolean> {
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
