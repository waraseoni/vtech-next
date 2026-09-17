// Server-side scheduled backup — /api/backup/scheduled + scripts ke liye shared logic.
// Service-role se saari tables (schemas OpenAPI se live) paginated fetch karke
// page-compatible v3.0 JSON server ke backups/ folder me likhta hai.
// Disclaimer: sirf server local file write + read-only DB GET — restore jaisa koi write nahi.

import fs from "node:fs";
import path from "node:path";
import { parseOpenApiToSchema, type SupabaseTableSchema } from "./backupSchema";

/** Server runtime me cwd = project root (backups/ wahi hota hai). */
export const BACKUP_DIR = path.join(process.cwd(), "backups");

export async function fetchOpenApiSchema(
  url: string,
  key: string
): Promise<SupabaseTableSchema[]> {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OpenAPI fetch failed: ${res.status}`);
  return parseOpenApiToSchema(await res.json());
}

async function fetchTableAll(url: string, key: string, t: SupabaseTableSchema) {
  const orderField = t.pk[0] || t.cols[0] || "id";
  const gens = new Set(t.generated);
  const select = gens.size > 0 && t.cols.length > 0 ? t.cols.filter((c) => !gens.has(c)).join(",") : "*";
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const all: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(
      `${url}/rest/v1/${t.name}?select=${select}&order=${orderField}&limit=1000&offset=${offset}`,
      { headers, cache: "no-store" }
    );
    if (!r.ok) throw new Error(`GET ${t.name} offset ${offset} -> ${r.status}`);
    const data = (await r.json()) as Record<string, unknown>[];
    all.push(...data);
    if (data.length < 1000) break;
  }
  if (gens.size) for (const row of all) for (const g of gens) delete row[g];
  const cr = await fetch(`${url}/rest/v1/${t.name}?select=none&limit=0`, {
    headers: { ...headers, Prefer: "count=exact" },
    cache: "no-store",
  });
  let dbCount: number | null = null;
  if (cr.ok) dbCount = Number(cr.headers.get("content-range")?.split("/")[1] ?? "null");
  return { rows: all, dbCount };
}

export interface ScheduledBackupResult {
  file: string;
  fileName: string;
  rows: number;
  tables: number;
  mismatch: { table: string; expected: number; got: number }[];
  warnings: (string | { table: string; expected: number; got: number })[];
  incomplete: boolean;
  /** Supabase Storage 'backups' bucket me cloud copy ka status. */
  storage?: { uploaded: boolean; bucket: string; fileName: string; error?: string };
}

/** Supabase Storage REST helper (service-role) — bucket exists+private, upload kar. */
export const STORAGE_BUCKET = "backups";

/** Bucket pehle se hai? Supabase duplicate par 400/409 + "already exists" deta hai. */
export function isBucketExistsError(status: number, body: string): boolean {
  return status === 409 || /already exists|duplicate/i.test(body);
}

async function ensureBucket(url: string, key: string) {
  const authHeaders = { apikey: key, Authorization: `Bearer ${key}` };

  // Pehle check karo — bucket already bana hai to create call hi mat karo.
  const head = await fetch(`${url}/storage/v1/bucket/${STORAGE_BUCKET}`, { headers: authHeaders });
  if (head.ok) return;

  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ id: STORAGE_BUCKET, name: STORAGE_BUCKET, public: false }),
  });
  if (res.ok) return;

  const body = (await res.text()).slice(0, 200);
  // Duplicate (already exists) koi error nahi — bucket ready hai.
  if (isBucketExistsError(res.status, body)) return;
  throw new Error(`bucket create failed: ${res.status} ${body}`);
}

export async function uploadBackupToStorage(url: string, key: string, fileName: string, data: string) {
  await ensureBucket(url, key);
  const res = await fetch(`${url}/storage/v1/object/${STORAGE_BUCKET}/${fileName}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "x-upsert": "true",
    },
    body: data,
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${(await res.text()).slice(0, 150)}`);
}

export async function listStorageBackups(url: string, key: string, max = 5) {
  const res = await fetch(`${url}/storage/v1/object/list/${STORAGE_BUCKET}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 200, offset: 0, sortBy: { column: "name", order: "desc" } }),
  });
  if (!res.ok) return [];
  const items = (await res.json()) as { name: string; id?: string; updated_at?: string }[];
  return items
    .filter((i) => /^vtech_backup_.+\.json$/.test(i.name))
    .slice(0, max)
    .map((i) => ({ name: i.name, size: undefined as number | undefined, modified: i.updated_at ?? "" }));
}

/** Pure logic: schema+fetch+verify+write — CLI (mjs) aur API route dono is pattern par. */
export async function runScheduledBackup(url: string, key: string): Promise<ScheduledBackupResult> {
  const tables = await fetchOpenApiSchema(url, key);
  const mismatch: ScheduledBackupResult["mismatch"] = [];
  const counts: Record<string, number> = {};
  let rows = 0;

  const backup: Record<string, unknown> = {
    _meta: [
      {
        version: "3.0",
        created_at: new Date().toISOString(),
        tables: tables.map((t) => t.name),
        app: "V-Tech Management System (server scheduled backup)",
        origin: "scheduledBackup.ts",
        table_order: tables.map((t) => ({ table: t.name })),
        warnings: [],
      },
    ],
  };

  for (const t of tables) {
    try {
      const { rows: tblRows, dbCount } = await fetchTableAll(url, key, t);
      backup[t.name] = tblRows;
      counts[t.name] = tblRows.length;
      rows += tblRows.length;
      if (dbCount !== null && dbCount !== tblRows.length) {
        mismatch.push({ table: t.name, expected: dbCount, got: tblRows.length });
      }
    } catch (err) {
      console.error(`scheduled backup: ${t.name} fetch fail —`, err);
      backup[t.name] = [];
      counts[t.name] = 0;
      mismatch.push({ table: t.name, expected: -1, got: 0 });
    }
  }

  const incomplete = mismatch.length > 0;
  if (incomplete) (backup._meta as Record<string, unknown>[])[0].warnings = mismatch;

  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const fileName = `vtech_backup_${stamp}.json`;
  const data = JSON.stringify(backup, null, 2);
  const outDir = path.join(process.cwd(), "backups");

  // Local copy — Vercel par filesystem ephemeral/read-only ho sakta hai; fail ho
  // to koi tension nahi (cloud copy neeche hota hai). Warna local bhi save karo.
  let localFile = "";
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, fileName);
    fs.writeFileSync(file, data, "utf8");
    localFile = file;
  } catch (e) {
    console.warn("scheduled backup: local write skip —", e instanceof Error ? e.message : e);
  }

  // Cloud copy — Supabase Storage 'backups' bucket (platform aankh par bhi save):
  // Vercel deploy me yahi PERSISTENT copy hoti hai, browser/download nahi chahiye.
  let storage: ScheduledBackupResult["storage"] = { uploaded: false, bucket: STORAGE_BUCKET, fileName, error: "not attempted" };
  try {
    await uploadBackupToStorage(url, key, fileName, data);
    storage = { uploaded: true, bucket: STORAGE_BUCKET, fileName };
  } catch (e) {
    storage = { uploaded: false, bucket: STORAGE_BUCKET, fileName, error: e instanceof Error ? e.message : "upload fail" };
    console.warn("scheduled backup: storage upload fail —", storage.error);
  }

  return {
    file: localFile,
    fileName,
    rows,
    tables: tables.length,
    mismatch,
    warnings: incomplete ? mismatch : [],
    incomplete,
    storage,
  };
}

/** Sirf apni backup files hi delete ho — path traversal / random object block. */
export function isBackupFileName(name: unknown): name is string {
  return typeof name === "string" && /^vtech_backup_[\w.\-]+\.json$/.test(name) && !name.includes("..");
}

/** Supabase Storage 'backups' bucket se ek object delete (service-role). */
export async function deleteStorageBackup(url: string, key: string, name: string) {
  if (!isBackupFileName(name)) throw new Error("Invalid backup file name.");
  const res = await fetch(`${url}/storage/v1/object/${STORAGE_BUCKET}/${encodeURIComponent(name)}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`storage delete failed: ${res.status} ${(await res.text()).slice(0, 150)}`);
  return { name, bucket: STORAGE_BUCKET };
}

/** Server ke backups/ folder se ek file delete — sirf BACKUP_DIR ke andar. */
export function deleteLocalBackup(name: string) {
  if (!isBackupFileName(name)) throw new Error("Invalid backup file name.");
  const file = path.join(BACKUP_DIR, name);
  if (path.dirname(path.resolve(file)) !== path.resolve(BACKUP_DIR)) {
    throw new Error("Invalid backup path.");
  }
  if (!fs.existsSync(file)) throw new Error("File nahi mili (already delete ho chuki?).");
  fs.unlinkSync(file);
  return { name };
}

/** Server ke backups/ folder se ek file ka content (download ke liye). */
export function readLocalBackup(name: string): Buffer {
  if (!isBackupFileName(name)) throw new Error("Invalid backup file name.");
  const file = path.join(BACKUP_DIR, name);
  if (path.dirname(path.resolve(file)) !== path.resolve(BACKUP_DIR)) {
    throw new Error("Invalid backup path.");
  }
  if (!fs.existsSync(file)) throw new Error("File nahi mili (delete ho chuki?).");
  return fs.readFileSync(file);
}

/** Supabase Storage 'backups' bucket se object bytes (download ke liye). */
export async function downloadStorageBackup(url: string, key: string, name: string): Promise<ArrayBuffer> {
  if (!isBackupFileName(name)) throw new Error("Invalid backup file name.");
  const res = await fetch(`${url}/storage/v1/object/${STORAGE_BUCKET}/${encodeURIComponent(name)}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`storage download failed: ${res.status} ${(await res.text()).slice(0, 150)}`);
  return res.arrayBuffer();
}

export function listBackupFiles(max = 10) {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => /^vtech_backup_.+\.json$/.test(f))
    .map((name) => {
      const st = fs.statSync(path.join(BACKUP_DIR, name));
      return { name, size: st.size, modified: st.mtime.toISOString() };
    })
    .sort((a, b) => (a.modified < b.modified ? 1 : -1))
    .slice(0, max);
}