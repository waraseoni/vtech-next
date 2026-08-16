#!/usr/bin/env node
// ============================================================================
// supabase-to-mariadb.mjs
//
// Supabase (Postgres) → MariaDB one-time converter / sync.
//   • Schema (tables + columns + PKs + FKs) ko live Supabase OpenAPI se
//     auto-detect karke MariaDB me CREATE karta hai.
//   • Sab tables ka saara data paginated fetch karke bulk-INSERT karta hai.
//   • MariaDB me DB nahi hai to khud bana leta hai (default: vtech_db).
//   • Idempotent: dobara chalane par har table TRUNCATE ho ke fresh copy
//     banta hai (Supabase ka current snapshot).
//
// Run (XAMPP default):
//   node scripts/supabase-to-mariadb.mjs
//   node scripts/supabase-to-mariadb.mjs --quiet        # sirf final summary (Task Scheduler)
//   node scripts/supabase-to-mariadb.mjs --history 50   # sync_history ki JSON (GUI ke liye)
//
// Har run ka record vtech_db.sync_history me save hota hai (OK/FAIL) — GUI isi
// se history dikhata hai.
//
// Overrides (env ya .env.local me):
//   MARIADB_HOST / MARIADB_PORT / MARIADB_USER / MARIADB_PASSWORD / MARIADB_DB
//   --no-fks   → FK constraints na banaye
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mariadb from "mariadb";
import { fixPhpImages } from "./php-image-fixer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ── env ─────────────────────────────────────────────────────────────────────
function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trimStart().startsWith("#")) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = { ...loadEnv(path.join(root, ".env.local")), ...process.env };

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const DB_NAME = env.MARIADB_DB || "vtech_db";
const DB_HOST = env.MARIADB_HOST || "127.0.0.1";
const DB_PORT = Number(env.MARIADB_PORT || 3306);
const DB_USER = env.MARIADB_USER || "root";
const DB_PASS = env.MARIADB_PASSWORD || "";

const NO_FKS = process.argv.includes("--no-fks");
const QUIET = process.argv.includes("--quiet");

// PHP app folder — agar set ho to data load ke baad image paths fix kiye jate hain
const phpDirArg = process.argv.indexOf("--php-dir");
const PHP_DIR = (
  (phpDirArg !== -1 ? process.argv[phpDirArg + 1] : "") ||
  process.env.PHP_DIR ||
  env.PHP_DIR ||
  ""
).trim();

// --quiet me sirf final summary + errors; normal me pura progress.
const log = (msg) => {
  if (!QUIET) console.log(msg);
};

// ── Sync mode (auto / manual / off) ─────────────────────────────────────────
// scripts/sync-settings.json me mode store hota hai. Task Scheduler run (bina
// --force) isse respect karta hai; GUI ka "Sync Now" hamesha --force chalta hai.
const SETTINGS_FILE = path.join(__dirname, "sync-settings.json");
function readSyncMode() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
      if (parsed && ["auto", "manual", "off"].includes(parsed.mode)) return parsed.mode;
    }
  } catch {}
  return "auto";
}
const FORCE = process.argv.includes("--force");
const SYNC_MODE = readSyncMode();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY .env.local me nahi mile."
  );
  process.exit(1);
}

// ── PG → MariaDB type mapping ───────────────────────────────────────────────
function mariaType(col) {
  const { type, format, maxLength } = col;
  switch (type) {
    case "integer":
      if (format === "bigint") return "BIGINT";
      if (format === "smallint") return "SMALLINT";
      return "INT";
    case "number":
      if (format === "double precision") return "DOUBLE";
      return "DECIMAL(15,2)";
    case "boolean":
      return "TINYINT(1)";
    case "string": {
      switch (format) {
        case "uuid":
          return "CHAR(36)";
        case "date":
          return "DATE";
        case "time without time zone":
          return "TIME";
        case "timestamp with time zone":
        case "timestamp without time zone":
          return "DATETIME";
        case "character varying":
          return `VARCHAR(${maxLength || 255})`;
        case "text":
          return "TEXT";
        default:
          return "VARCHAR(255)"; // PG enums (payment_mode_type, payment_type_type, ...)
      }
    }
    default:
      return "TEXT";
  }
}

const isTsWithTz = (m) => m.type === "string" && m.format === "timestamp with time zone";
const isTsNoTz = (m) => m.type === "string" && m.format === "timestamp without time zone";

// Supabase se aaya value MariaDB ke liye normalize karo (timestamps, booleans).
// NOTE: col.type / col.format col.meta ke andar hote hain (fetchSchema dekho).
function normalizeValue(col, v) {
  if (v === null || v === undefined) return null;
  const m = col.meta;
  if (m.type === "boolean") return v ? 1 : 0;
  if (isTsWithTz(m)) {
    // Postgres timestamptz → machine ki LOCAL wall-clock me store karo, taaki
    // Supabase (jo local time dikhata hai) aur MariaDB dono same time dikhayein.
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : toLocalSql(d);
  }
  if (isTsNoTz(m)) {
    // timestamp (bina tz) → wall-clock hi rakho (T→space, fraction hatao).
    return String(v).replace("T", " ").slice(0, 19);
  }
  return v;
}

// ── Supabase schema (OpenAPI) ───────────────────────────────────────────────
async function fetchSchema() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`OpenAPI fetch failed: ${res.status} ${res.statusText}`);
  const spec = await res.json();

  const tables = [];
  for (const [name, def] of Object.entries(spec.definitions || {})) {
    const required = new Set(def.required || []);
    const cols = [];
    const pks = [];
    for (const [cname, meta] of Object.entries(def.properties || {})) {
      const pk = !!(meta.description && meta.description.includes("<pk/>"));
      cols.push({ name: cname, meta, nullable: !required.has(cname), pk });
      if (pk) pks.push(cname);
    }
    tables.push({ name, cols, pks });
  }
  tables.sort((a, b) => a.name.localeCompare(b.name));
  return tables;
}

function createTableSQL(t) {
  const parts = t.cols.map((c) => {
    let s = `\`${c.name}\` ${mariaType(c.meta)}${c.nullable ? "" : " NOT NULL"}`;
    // single-column integer id → AUTO_INCREMENT (Supabase identity jaisa)
    if (
      c.pk &&
      t.pks.length === 1 &&
      c.meta.type === "integer" &&
      c.meta.format !== "smallint"
    ) {
      s += " AUTO_INCREMENT";
    }
    return s;
  });
  if (t.pks.length) {
    parts.push(`PRIMARY KEY (${t.pks.map((p) => `\`${p}\``).join(", ")})`);
  }
  return (
    `CREATE TABLE IF NOT EXISTS \`${t.name}\` (\n  ` +
    parts.join(",\n  ") +
    `\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

// Naming-convention + migrations se confirmed FKs (Supabase default = NO ACTION).
const FK_HINTS = [
  ["purchase_orders", "supplier_id", "suppliers", "id"],
  ["purchase_order_items", "purchase_order_id", "purchase_orders", "id"],
  ["purchase_order_items", "product_id", "product_list", "id"],
  ["push_subscriptions", "user_id", "profiles", "id"],
  ["client_payments", "client_id", "client_list", "id"],
  ["client_payments", "loan_id", "client_loans", "id"],
  ["client_loans", "client_id", "client_list", "id"],
  ["loan_payments", "lender_id", "lender_list", "id"],
  ["inventory_list", "product_id", "product_list", "id"],
  ["inventory_list", "supplier_id", "suppliers", "id"],
  ["direct_sales", "client_id", "client_list", "id"],
  ["direct_sales", "mechanic_id", "mechanic_list", "id"],
  ["direct_sale_items", "sale_id", "direct_sales", "id"],
  ["direct_sale_items", "product_id", "product_list", "id"],
  ["transaction_list", "mechanic_id", "mechanic_list", "id"],
  ["transaction_list", "user_id", "users", "id"],
  ["transaction_products", "transaction_id", "transaction_list", "id"],
  ["transaction_products", "product_id", "product_list", "id"],
  ["transaction_services", "transaction_id", "transaction_list", "id"],
  ["transaction_services", "service_id", "service_list", "id"],
  ["transaction_images", "transaction_id", "transaction_list", "id"],
  ["attendance_list", "mechanic_id", "mechanic_list", "id"],
  ["advance_payments", "mechanic_id", "mechanic_list", "id"],
  ["mechanic_salary_history", "mechanic_id", "mechanic_list", "id"],
  ["mechanic_commission_history", "mechanic_id", "mechanic_list", "id"],
  ["spare_supplier", "spare_id", "product_list", "id"],
  ["spare_supplier", "supplier_id", "suppliers", "id"],
  ["payment_reminders", "client_id", "client_list", "id"],
  ["users", "mechanic_id", "mechanic_list", "id"],
  ["profiles", "mechanic_id", "mechanic_list", "id"],
  ["profiles", "client_id", "client_list", "id"],
];

async function addForeignKeys(conn, tables) {
  const names = new Set(tables.map((t) => t.name));

  const fks = await conn.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [DB_NAME]
  );
  const existing = new Set(fks.map((r) => r.CONSTRAINT_NAME));

  const cols = await conn.query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?`,
    [DB_NAME]
  );
  const colType = {};
  for (const r of cols) colType[`${r.TABLE_NAME}.${r.COLUMN_NAME}`] = r.COLUMN_TYPE;

  let ok = 0;
  let skipped = 0;
  for (const [table, col, refTable, refCol] of FK_HINTS) {
    const cname = `fk_${table}_${col}`;
    if (!names.has(table) || !names.has(refTable)) continue;
    if (existing.has(cname)) {
      ok++;
      continue;
    }
    // MariaDB FK ke liye dono columns ka type bilkul same chahiye (Postgres nahi).
    const t1 = colType[`${table}.${col}`];
    const t2 = colType[`${refTable}.${refCol}`];
    if (t1 !== t2) {
      log(`  ! FK skip ${table}.${col} -> ${refTable}.${refCol} (type: ${t1} vs ${t2})`);
      skipped++;
      continue;
    }
    try {
      await conn.query(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${cname}\` ` +
          `FOREIGN KEY (\`${col}\`) REFERENCES \`${refTable}\`(\`${refCol}\`)`
      );
      ok++;
    } catch (e) {
      console.warn(`  ! FK error ${table}.${col} -> ${refTable}.${refCol}: ${e.message}`);
      skipped++;
    }
  }
  log(`  FK constraints: ${ok} present, ${skipped} skipped`);
}

// Supabase me naye columns aa jayein to MariaDB me bhi add kar do.
async function syncMissingColumns(conn, tables) {
  const existing = await conn.query(
    `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?`,
    [DB_NAME]
  );
  const have = {};
  for (const r of existing) {
    have[r.TABLE_NAME] ||= new Set();
    have[r.TABLE_NAME].add(r.COLUMN_NAME);
  }
  let added = 0;
  for (const t of tables) {
    const set = have[t.name] || new Set();
    for (const c of t.cols) {
      if (set.has(c.name)) continue;
      try {
        await conn.query(
          `ALTER TABLE \`${t.name}\` ADD COLUMN \`${c.name}\` ${mariaType(c.meta)}${c.nullable ? " NULL" : " NOT NULL"}`
        );
        added++;
      } catch (e) {
        console.warn(`  ! COLUMN skip ${t.name}.${c.name}: ${e.message}`);
      }
    }
  }
  if (added) log(`  Added ${added} missing column(s)`);
}

// ── Paginated row fetch (PostgREST 1000-row cap) ───────────────────────────
async function fetchRows(table) {
  const out = [];
  let from = 0;
  for (;;) {
    const to = from + 999;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${to}`,
        Prefer: "count=exact",
      },
    });
    if (!res.ok) throw new Error(`GET ${table} failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    out.push(...data);
    const cr = res.headers.get("content-range") || "";
    const m = cr.match(/\/(\d+)$/);
    const total = m ? Number(m[1]) : data.length;
    if (!data.length) break;
    if (from + data.length >= total) break;
    from = to + 1;
  }
  return out;
}

// ── Sync history (vtech_db.sync_history) ─────────────────────────────────────
const HISTORY_TABLE = `CREATE TABLE IF NOT EXISTS sync_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  started_at DATETIME NOT NULL,
  finished_at DATETIME NOT NULL,
  status VARCHAR(10) NOT NULL,
  tables INT NOT NULL DEFAULT 0,
  rows_synced INT NOT NULL DEFAULT 0,
  mismatches INT NOT NULL DEFAULT 0,
  duration_sec DECIMAL(8,2) NOT NULL DEFAULT 0,
  details TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

async function openDb() {
  const conn = await mariadb.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    charset: "utf8mb4",
    bigIntAsNumber: true,
    connectTimeout: 15000,
  });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.query(`USE \`${DB_NAME}\``);
  return conn;
}

// `node script --history N` → sync_history ki aakhri N entries JSON me print karta hai.
// NOTE: sync_history me LOCAL wall-clock store hota hai (user ko wahi time chahiye),
// isliye yahan bhi read-back ke waqt LOCAL convert hota hai: Date → local wall clock.
const toLocalSql = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

async function recordHistory(conn, rec) {
  await conn.query(HISTORY_TABLE);
  await conn.query(
    `INSERT INTO sync_history (started_at, finished_at, status, tables, rows_synced, mismatches, duration_sec, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      toLocalSql(rec.startedAt),
      toLocalSql(rec.finishedAt),
      rec.status,
      rec.tables || 0,
      rec.rows || 0,
      rec.mismatches || 0,
      rec.durationSec,
      rec.details,
    ]
  );
}

// `node script --history N` → sync_history ki aakhri N entries JSON me print karta hai.
async function printHistory(n) {
  let conn;
  try {
    conn = await openDb();
    await conn.query(HISTORY_TABLE);
    const rows = await conn.query(
      `SELECT id, started_at, finished_at, status, tables, rows_synced, mismatches, duration_sec, details
         FROM sync_history ORDER BY id DESC LIMIT ${Math.max(1, Math.floor(n) || 50)}`
    );
    console.log(
      JSON.stringify(
        rows.map((r) => ({
          id: r.id,
          started_at: r.started_at instanceof Date ? r.started_at.toISOString() : r.started_at,
          finished_at: r.finished_at instanceof Date ? r.finished_at.toISOString() : r.finished_at,
          status: r.status,
          tables: r.tables,
          rows: r.rows_synced,
          mismatches: r.mismatches,
          duration_sec: r.duration_sec,
          details: r.details,
        }))
      )
    );
  } catch {
    console.log("[]");
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
  process.exit(0);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const started = new Date();
  log("Supabase → MariaDB converter");
  log(`  Supabase : ${SUPABASE_URL}`);
  log(`  MariaDB  : ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);

  // Sync mode gate: Task Scheduler run (bina --force) manual/off me skip karta hai.
  // GUI ka "Sync Now" hamesha --force ke saath aata hai (API uske liye mode=off hi rokta hai).
  if (!FORCE && SYNC_MODE !== "auto") {
    console.log(
      `[sync] SKIPPED ${new Date().toISOString()} | mode=${SYNC_MODE} (scheduled run) — auto sync off hai. GUI me "Sync Now" use karo.`
    );
    return;
  }

  let conn = null;
  try {
    conn = await openDb();

    log("\n[1/4] Supabase schema detect kar raha hoon...");
    const tables = await fetchSchema();

    log(`\n[2/4] Tables bana raha hoon (${tables.length})...`);
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const t of tables) {
      await conn.query(createTableSQL(t));
    }
    await syncMissingColumns(conn, tables);
    if (!NO_FKS) await addForeignKeys(conn, tables);
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");

    log("\n[3/4] Data sync ho raha hai...");
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    const totals = {};
    for (const t of tables) {
      const rows = await fetchRows(t.name);
      await conn.query(`TRUNCATE TABLE \`${t.name}\``);
      if (rows.length) {
        const metas = t.cols;
        const insertSql = `INSERT INTO \`${t.name}\` (${metas
          .map((c) => `\`${c.name}\``)
          .join(", ")}) VALUES (${metas.map(() => "?").join(", ")})`;
        const batch = rows.map((r) => metas.map((c) => normalizeValue(c, r[c.name])));
        for (let i = 0; i < batch.length; i += 500) {
          await conn.batch(insertSql, batch.slice(i, i + 500));
        }
      }
      totals[t.name] = rows.length;
      log(`  ${t.name.padEnd(28)} ${String(rows.length).padStart(6)} rows`);
    }
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");

    // ── PHP image path fix ────────────────────────────────────────────────
    if (PHP_DIR) {
      log(`\n[PHP] Image paths fix ho rahe hain (${PHP_DIR})...`);
      try {
        const rep = await fixPhpImages(conn, {
          phpDir: PHP_DIR,
          supabaseUrl: SUPABASE_URL,
          supabaseKey: SUPABASE_KEY,
        });
        if (rep.logo) log(`  logo      : ${rep.logo}`);
        if (rep.cover) log(`  cover     : ${rep.cover}`);
        if (rep.downloaded.length) log(`  downloaded: ${rep.downloaded.length} file(s)`);
        if (rep.skipped) log(`  skipped   : ${rep.skipped}`);
        if (rep.missing.length) log(`  missing   : ${rep.missing.length}\n    - ${rep.missing.join("\n    - ")}`);
      } catch (e) {
        log(`  [WARN] image fix fail: ${e.message}`);
      }
    }

    log("\n[4/4] Verify (Supabase vs MariaDB counts)...");
    let mismatches = 0;
    for (const t of tables) {
      const [row] = await conn.query(`SELECT COUNT(*) AS c FROM \`${t.name}\``);
      const maria = Number(row.c);
      const flag = maria === totals[t.name] ? "OK" : "MISMATCH";
      if (flag !== "OK") mismatches++;
      log(
        `  ${t.name.padEnd(28)} MariaDB=${String(maria).padStart(6)}  Supabase=${String(
          totals[t.name]
        ).padStart(6)}  ${flag}`
      );
    }

    const totalRows = Object.values(totals).reduce((a, b) => a + b, 0);
    const secs = +((Date.now() - started.getTime()) / 1000).toFixed(2);
    await recordHistory(conn, {
      startedAt: started,
      finishedAt: new Date(),
      status: "OK",
      tables: tables.length,
      rows: totalRows,
      mismatches,
      durationSec: secs,
      details: null,
    });
    await conn.end();
    conn = null;
    console.log(
      `[sync] OK ${new Date().toISOString()} | db=${DB_NAME} tables=${tables.length} rows=${totalRows} mismatch=${mismatches} (${secs}s)`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      await recordHistory(conn, {
        startedAt: started,
        finishedAt: new Date(),
        status: "FAIL",
        tables: 0,
        rows: 0,
        mismatches: 0,
        durationSec: 0,
        details: msg.slice(0, 2000),
      });
    } catch {}
    if (conn) {
      try { await conn.end(); } catch {}
    }
    console.error(`[sync] FAIL ${new Date().toISOString()} | ${msg}`);
    console.error(e);
    process.exit(1);
  }
}

const HISTORY_ARG = process.argv.indexOf("--history");
if (HISTORY_ARG !== -1) {
  printHistory(Number(process.argv[HISTORY_ARG + 1]) || 50);
} else {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
