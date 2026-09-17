#!/usr/bin/env node
/**
 * supabase-json-backup.mjs — free-tier off-site backup (CLI)
 *
 * /backup page ka jaisa JSON v3.0 backup banaata hai, par bina browser/app ke:
 *  - Service-role key (RLS bypass) se saari 51 public tables paginated fetch
 *  - OpenAPI schema se cols/pk live (hardcoded list nahi) — GENERATED cols skip
 *  - Har table par exact-count verify (silent data loss pakadne ke liye)
 *  - Output: ./backups/vtech_backup_YYYY-MM-DDTHH-MM-SS.json (gitignored)
 *
 * Use (Windows):
 *   node scripts/supabase-json-backup.mjs [--dir <folder>]
 *
 * Exit codes: 0 = OK, 1 = env/schema fail, 2 = INCOMPLETE (count mismatch)
 * Schedule (Task Scheduler) sample:
 *   schtasks /Create /TN "VTech Supabase Backup" /TR "node \"D:\next tech\vtech-next-frontend\scripts\supabase-json-backup.mjs\"" /SC DAILY /ST 02:00 /F
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: node scripts/supabase-json-backup.mjs [--dir <output-folder>] [--storage]");
  process.exit(0);
}
const dirIdx = args.indexOf("--dir");
const OUT_DIR = dirIdx >= 0 && args[dirIdx + 1] ? path.resolve(args[dirIdx + 1]) : path.join(PROJECT_ROOT, "backups");
const UPLOAD_STORAGE = args.includes("--storage");

// Supabase Storage 'backups' bucket (private) — cloud copy (Vercel/laptop memory)
const STORAGE_BUCKET = "backups";
async function uploadToStorage(file, key, Hdrs) {
  // Bucket pehle check — already hai to create call hi mat karo (400 duplicate bhi tolerate).
  const exists = await fetch(`${BASE}/storage/v1/bucket/${STORAGE_BUCKET}`, { headers: Hdrs });
  if (!exists.ok) {
    const mk = await fetch(`${BASE}/storage/v1/bucket`, {
      method: "POST",
      headers: { ...Hdrs, "Content-Type": "application/json" },
      body: JSON.stringify({ id: STORAGE_BUCKET, name: STORAGE_BUCKET, public: false }),
    });
    if (!mk.ok && mk.status !== 409) {
      const body = await mk.text();
      if (!(mk.status === 400 && /already exists|duplicate/i.test(body))) {
        throw new Error(`bucket create failed (${mk.status}) ${body.slice(0, 200)}`);
      }
    }
  }
  const bytes = fs.readFileSync(file);
  const up = await fetch(`${BASE}/storage/v1/object/${STORAGE_BUCKET}/${path.basename(file)}`, {
    method: "POST",
    headers: { ...Hdrs, "Content-Type": "application/json", "x-upsert": "true" },
    body: bytes,
  });
  if (!up.ok) throw new Error(`upload failed (${up.status}): ${(await up.text()).slice(0, 150)}`);
}

// ── env (.env.local) ─────────────────────────────────────────────────────────
function loadEnv() {
  const envFile = path.join(PROJECT_ROOT, ".env.local");
  if (!fs.existsSync(envFile)) {
    console.error("❌ .env.local nahi mila — santrupt check karo.");
    process.exit(1);
  }
  const env = {};
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)=("?)(.*?)\2\s*$/);
    if (m && !line.trimStart().startsWith("#")) env[m[1]] = m[3];
  }
  return env;
}
const env = loadEnv();
const BASE = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY set nahi hai (.env.local).");
  process.exit(1);
}
const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
};

// ── OpenAPI schema parse (backupSchema.ts ke logic jaham, standalone) ────────
const GENERATED_COLUMNS = { client_payments: ["net_amount"] };

/**
 * @returns {Promise<Array<{name:string, cols:string[], pk:string[], notNull:string[], generated:string[]}>>}
 */
async function fetchSchema() {
  const res = await fetch(`${BASE}/rest/v1/`, {
    headers: { ...H, Accept: "application/openapi+json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAPI fetch failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const spec = await res.json();
  const tables = [];
  for (const [name, def] of Object.entries(spec?.definitions ?? {})) {
    const props = def?.properties ?? {};
    const cols = [];
    const pk = [];
    for (const [col, meta] of Object.entries(props)) {
      cols.push(col);
      if (meta?.description?.includes("<pk/>")) pk.push(col);
    }
    tables.push({
      name,
      cols,
      pk,
      generated: GENERATED_COLUMNS[name] ?? [],
      notNull: def?.required ?? [],
    });
  }
  tables.sort((a, b) => a.name.localeCompare(b.name));
  return tables;
}

/** Paginated fetch with exact-count verify. */
async function fetchTableAll(t, PAGE_SIZE = 1000) {
  const orderField = t.pk[0] || t.cols[0] || "id";
  const gens = new Set(t.generated);
  const select = gens.size > 0 && t.cols.length > 0 ? t.cols.filter((c) => !gens.has(c)).join(",") : "*";
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const r = await fetch(`${BASE}/rest/v1/${t.name}?select=${select}&order=${orderField}&limit=${PAGE_SIZE}&offset=${offset}`, {
      headers: H,
    });
    if (!r.ok) throw new Error(`GET ${t.name} offset ${offset} -> ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data = await r.json();
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  // Generated columns kabhi rows me na aa jayen (select ke bawajood) — hard strip
  if (gens.size) for (const row of all) for (const g of gens) delete row[g];
  // Exact count verify
  const cr = await fetch(`${BASE}/rest/v1/${t.name}?select=none&limit=0`, { headers: { ...H, Prefer: "count=exact" } });
  let dbCount = null;
  if (cr.ok) dbCount = Number(cr.headers.get("content-range")?.split("/")[1] ?? "null");
  return { all, dbCount };
}

// ── main ─────────────────────────────────────────────────────────────────────
try {
  const tables = await fetchSchema();
  const mismatch = [];
  const counts = {};
  let total = 0;

  const backup = {
    _meta: [
      {
        version: "3.0",
        created_at: new Date().toISOString(),
        tables: tables.map((t) => t.name),
        app: "V-Tech Management System (CLI scheduled backup)",
        origin: "supabase-json-backup.mjs",
        table_order: tables.map((t) => ({ table: t.name })),
        warnings: [],
      },
    ],
  };

  for (const t of tables) {
    process.stdout.write(`  ${t.name} ... `);
    try {
      const { all, dbCount } = await fetchTableAll(t);
      backup[t.name] = all;
      counts[t.name] = all.length;
      total += all.length;
      if (dbCount !== null && dbCount !== all.length) {
        mismatch.push({ table: t.name, expected: dbCount, got: all.length });
        process.stdout.write(`⚠ MISMATCH (db=${dbCount}, got=${all.length})\n`);
      } else {
        process.stdout.write(`${all.length} rows\n`);
      }
    } catch (err) {
      backup[t.name] = [];
      counts[t.name] = 0;
      mismatch.push({ table: t.name, expected: -1, got: 0 });
      process.stdout.write(`❌ ${err instanceof Error ? err.message : err}\n`);
    }
  }

  const incomplete = mismatch.length > 0;
  if (incomplete) backup._meta[0].warnings = mismatch;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Page ke jaisa hi naming (UTC): vtech_backup_2026-09-17T06-03-05.json
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const file = path.join(OUT_DIR, `vtech_backup_${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2), "utf8");

  console.log(`\n✅ Backup: ${total.toLocaleString()} rows / ${tables.length} tables`);
  console.log(`📄 ${file}`);
  if (UPLOAD_STORAGE) {
    try {
      await uploadToStorage(file, KEY, H);
      console.log(`☁️  Cloud copy: Supabase Storage '${STORAGE_BUCKET}' (private)`);
    } catch (err) {
      console.error(`☁️  Cloud copy FAIL: ${err instanceof Error ? err.message : err}`);
      process.exitCode = 3;
    }
  }
  if (incomplete) {
    console.error(`❌ INCOMPLETE — ${mismatch.length} table(s) count mismatch, file par INCOMPLETE flag hai.`);
    process.exitCode = 2;
  } else {
    console.log("✔ Har table count verified (live schema vs fetched).");
  }
} catch (err) {
  console.error("❌ backup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}