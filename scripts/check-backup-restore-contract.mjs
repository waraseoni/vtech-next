#!/usr/bin/env node
/**
 * Backup/Restore schema contract check.
 *
 * Golden rule: har schema/migration change ke saath backup+restore surfaces
 * bhi update honi chahiye — bina user ke bole. Ye script migration DDL se
 * tables/columns nikaal kar unhe `docs/backup_restore_contract.md` se match
 * karta hai. Naya table/column contract me na ho → exit 1 (CI fail).
 *
 * Chalao:
 *   npm run backup:contract                 # verify
 *   node scripts/check-backup-restore-contract.mjs --write-baseline
 *
 * Dhyan: heuristics-based naam check hai (check-schema-drift.mjs ki tarah),
 * SQL parser nahi. Rename/cross-file moves me manual review zaroori hai.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MIG_DIR = path.join(ROOT, "supabase", "migrations");
const CONTRACT = path.join(ROOT, "docs", "backup_restore_contract.md");

const SURFACES = [
  "src/app/backup/page.tsx",
  "src/lib/backupRestore.ts",
  "src/lib/backupSchema.ts",
  "src/lib/backupAuthRestore.ts",
  "src/lib/resetSequence.ts",
  "src/lib/scheduledBackup.ts",
  "scripts/supabase-json-backup.mjs",
  "scripts/force-restore.cjs",
  "public/tools/vtech_mysql_converter.html",
  "docs/BACKUP_GUIDE.md",
];

const RESERVED = new Set([
  "primary",
  "unique",
  "foreign",
  "check",
  "constraint",
  "exclude",
  "index",
  "like",
]);

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const norm = (s) =>
  s
    .replace(/^public\./i, "")
    .replace(/"/g, "")
    .trim()
    .toLowerCase();

function extractSchema() {
  const tables = new Set();
  const droppedTables = new Set();
  const columns = new Set();
  const droppedColumns = new Set();

  for (const file of fs
    .readdirSync(MIG_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = read(path.join(MIG_DIR, file)).replace(/--[^\n]*/g, "");

    let m;
    const createTable =
      /create\s+table\s+(?:if\s+not\s+exists\s+)?((?:[\w"]+\.)?[\w"]+)\s*\(([\s\S]*?)\)\s*;/gi;
    while ((m = createTable.exec(sql))) {
      const table = norm(m[1]);
      tables.add(table);
      for (const raw of m[2].split("\n")) {
        const line = raw.trim();
        if (!line || RESERVED.has(line.split(/\s+/)[0].toLowerCase())) continue;
        const col = line.match(/^((?:[\w"]+\.)?[\w"]+)\s+/);
        if (col) columns.add(`${table}.${norm(col[1])}`);
      }
    }

    const dropTable = /drop\s+table\s+(?:if\s+exists\s+)?((?:[\w"]+\.)?[\w"]+)/gi;
    while ((m = dropTable.exec(sql))) droppedTables.add(norm(m[1]));

    const addCol =
      /alter\s+table\s+((?:[\w"]+\.)?[\w"]+)\s+add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?([\w"]+)/gi;
    while ((m = addCol.exec(sql))) {
      const col = norm(m[2]);
      if (!RESERVED.has(col)) columns.add(`${norm(m[1])}.${col}`);
    }
    const dropCol =
      /alter\s+table\s+((?:[\w"]+\.)?[\w"]+)\s+drop\s+(?:column\s+)?(?:if\s+exists\s+)?([\w"]+)/gi;
    while ((m = dropCol.exec(sql))) droppedColumns.add(`${norm(m[1])}.${norm(m[2])}`);
  }

  for (const t of droppedTables) tables.delete(t);
  for (const c of droppedColumns) columns.delete(c);
  return { tables, columns };
}

function section(doc, title) {
  const parts = doc.split(/^## /m);
  const hit = parts.find((p) => p.startsWith(`${title}\n`));
  if (!hit) return "";
  return hit.slice(title.length + 1).split(/\n## /)[0];
}

function tokens(text) {
  return new Set([...text.matchAll(/^\s*-\s+`([^`]+)`/gm)].map((m) => norm(m[1])));
}

function baseline({ tables, columns }) {
  const list = (set) =>
    [...set]
      .sort()
      .map((x) => `- \`${x}\``)
      .join("\n");
  return (
    `# Backup/Restore Schema Contract\n\n` +
    `> **Golden Rule (bina bole enforce):** jab bhi koi migration/schema badlaav aaye,\n` +
    `> backup aur restore surfaces bhi usi change me update honi chahiye. Ye file unka\n` +
    `> canonical contract hai. \`npm run backup:contract\` isko migration DDL se compare\n` +
    `> karta hai; mismatch par CI fail.\n\n` +
    `Last synced: 27 Nov 2026 · Source: \`supabase/migrations/*.sql\`\n\n` +
    `## Declared tables\n\n${list(tables)}\n\n` +
    `## Declared columns\n\n${list(columns)}\n\n` +
    `## Legacy exemptions\n\n` +
    `- \`__none__\` — abhi koi exemption nahi; naya exception sirf reason ke saath likho.\n\n` +
    `## Required surfaces\n\n` +
    SURFACES.map((s) => `- \`${s}\``).join("\n") +
    `\n\n## Update checklist (har schema change par)\n\n` +
    `1. Naya table/column → \`Declared tables\` / \`Declared columns\` me add karo.\n` +
    `2. FK-parent table ho to \`src/lib/backupRestore.ts\` ki ordered list me add karo.\n` +
    `3. Generated/identity column ho to \`src/lib/backupSchema.ts\` (aur CLI/force-restore) update karo.\n` +
    `4. Auth-linked table/UUID ho to \`src/lib/backupAuthRestore.ts\` update karo.\n` +
    `5. Serial/identity sequence ho to \`src/lib/resetSequence.ts\` allowlist update karo.\n` +
    `6. Converter/backup page ke static fallback lists ko naye columns se sync karo.\n` +
    `7. Purana backup naye schema par restore ho to data-loss na ho — dry-run zaroori.\n`
  );
}

const schema = extractSchema();

if (process.argv.includes("--write-baseline")) {
  if (!fs.existsSync(path.dirname(CONTRACT)))
    fs.mkdirSync(path.dirname(CONTRACT), { recursive: true });
  fs.writeFileSync(CONTRACT, baseline(schema), "utf8");
  console.log(`OK  baseline likha gaya: ${path.relative(ROOT, CONTRACT)}`);
  console.log(`    ${schema.tables.size} tables, ${schema.columns.size} migration columns`);
  process.exit(0);
}

if (!fs.existsSync(CONTRACT)) {
  console.error("ERROR: contract file nahi mila. Pehle `--write-baseline` chalao.");
  process.exit(2);
}

const doc = read(CONTRACT);
const declaredTables = tokens(section(doc, "Declared tables"));
const declaredColumns = tokens(section(doc, "Declared columns"));
const exemptions = tokens(section(doc, "Legacy exemptions"));
exemptions.delete("__none__");

const missingSurfaces = SURFACES.filter(
  (s) => !fs.existsSync(path.join(ROOT, s)) || !doc.includes(s)
);

const missingTables = [...schema.tables].filter(
  (t) => !declaredTables.has(t) && !exemptions.has(t)
);
const missingColumns = [...schema.columns].filter(
  (c) => !declaredColumns.has(c) && !exemptions.has(c)
);
const staleTables = [...declaredTables].filter((t) => !schema.tables.has(t));
const staleColumns = [...declaredColumns].filter((c) => !schema.columns.has(c));

const problems = [];
if (missingTables.length)
  problems.push(`contract me missing tables:\n   ${missingTables.join("\n   ")}`);
if (missingColumns.length)
  problems.push(`contract me missing columns:\n   ${missingColumns.join("\n   ")}`);
if (staleTables.length)
  problems.push(`contract me stale tables (DDL me nahi):\n   ${staleTables.join("\n   ")}`);
if (staleColumns.length)
  problems.push(`contract me stale columns (DDL me nahi):\n   ${staleColumns.join("\n   ")}`);
if (missingSurfaces.length)
  problems.push(`missing/undocumented surfaces:\n   ${missingSurfaces.join("\n   ")}`);

if (problems.length) {
  console.error("BACKUP CONTRACT DRIFT:");
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    `\nFix: schema change ke saath ${path.relative(ROOT, CONTRACT)} aur upar wale surfaces update karo.`
  );
  process.exit(1);
}

console.log(
  `OK  backup contract synced — ${schema.tables.size} tables, ${schema.columns.size} migration columns, ${SURFACES.length} surfaces.`
);
