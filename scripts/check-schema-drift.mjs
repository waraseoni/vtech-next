#!/usr/bin/env node
/**
 * Migration drift check — kya full schema sabhi migrations reflect karta hai?
 *
 * `supabase/migrations/20260913000000_final_full_schema_idempotent.sql` ek
 * bootstrap file hai (fresh + existing Supabase project ko live state tak
 * laati hai). Har nayi migration ka DDL usme append hona zaroori hai —
 * warna fresh project me wo object missing rahega (misal: 20261018
 * passkey_login + perf_indexes ~1 mahine tak silent missing rahe).
 *
 * Ye script wo gap pakadti hai: full-schema file ke BAAD wali saari
 * migrations nikaal kar unke objects full schema me dhoondti hai.
 *
 * Chalao:  npm run schema:drift
 * Exit:    0 = no drift,  1 = drift (CI ko fail karne ke liye)
 *
 * Dhyan: ye ek heuristics-based structural check hai (naam-based), SQL parse
 * nahi. Edge cases (rename, cross-file moves) me manual review karo.
 */
import fs from "node:fs";
import path from "node:path";

const MIG_DIR = path.join(process.cwd(), "supabase", "migrations");
const FULL_NAME = "20260913000000_final_full_schema_idempotent.sql";
const FULL = path.join(MIG_DIR, FULL_NAME);

if (!fs.existsSync(FULL)) {
  console.error(`ERROR: full schema file nahi mili: ${FULL}`);
  process.exit(2);
}

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");

// ---------- identifier normalisation ----------
const norm = (s) =>
  s
    .replace(/^public\./i, "")
    .replace(/"/g, "")
    .trim()
    .toLowerCase();

// ---------- object extraction ----------
function extract(sql) {
  const objs = new Map(); // kind -> Set(name)
  const drops = new Map();
  const add = (m, k, v) => {
    if (!m.has(k)) m.set(k, new Set());
    m.get(k).add(v);
  };

  const clean = sql.replace(/--[^\n]*/g, ""); // comments me false match se bachne ke liye

  const push = (re, kind, pick = 1) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(clean))) add(objs, kind, norm(m[pick]));
  };
  const pushDrop = (re, kind, pick = 1) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(clean))) add(drops, kind, norm(m[pick]));
  };

  push(/create\s+table\s+(?:if\s+not\s+exists\s+)?((?:[\w"]+\.)?[\w"]+)/gi, "table");
  pushDrop(/drop\s+table\s+(?:if\s+exists\s+)?((?:[\w"]+\.)?[\w"]+)/gi, "table");

  push(/create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?((?:[\w"]+\.)?[\w"]+)/gi, "view");
  pushDrop(/drop\s+(?:materialized\s+)?view\s+(?:if\s+exists\s+)?((?:[\w"]+\.)?[\w"]+)/gi, "view");

  push(/create\s+type\s+((?:[\w"]+\.)?[\w"]+)/gi, "type");
  pushDrop(/drop\s+type\s+(?:if\s+exists\s+)?((?:[\w"]+\.)?[\w"]+)/gi, "type");

  push(/create\s+sequence\s+(?:if\s+not\s+exists\s+)?((?:[\w"]+\.)?[\w"]+)/gi, "sequence");
  pushDrop(/drop\s+sequence\s+(?:if\s+exists\s+)?((?:[\w"]+\.)?[\w"]+)/gi, "sequence");

  push(/create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?((?:[\w"]+\.)?[\w"]+)/gi, "index");
  pushDrop(/drop\s+index\s+(?:if\s+exists\s+)?((?:[\w"]+\.)?[\w"]+)/gi, "index");

  push(
    /create\s+(?:or\s+replace\s+)?function\s+((?:[\w"]+\.)?[\w"]+)/gi,
    "function"
  );
  pushDrop(/drop\s+function\s+(?:if\s+exists\s+)?((?:[\w"]+\.)?[\w"]+)/gi, "function");

  {
    const re = /create\s+policy\s+(?:if\s+not\s+exists\s+)?"?([^"\s]+)"?\s+on\s+((?:[\w"]+\.)?[\w"]+)/gi;
    let m;
    while ((m = re.exec(clean))) add(objs, "policy", `${norm(m[1])} on ${norm(m[2])}`);
    const rd = /drop\s+policy\s+(?:if\s+exists\s+)?"?([^"\s]+)"?\s+on\s+((?:[\w"]+\.)?[\w"]+)/gi;
    while ((m = rd.exec(clean))) add(drops, "policy", `${norm(m[1])} on ${norm(m[2])}`);
  }

  {
    const re = /create\s+trigger\s+((?:[\w"]+\.)?[\w"]+)\s+after|create\s+trigger\s+((?:[\w"]+\.)?[\w"]+)\s+before/gi;
    let m;
    while ((m = re.exec(clean))) add(objs, "trigger", norm(m[1] || m[2]));
    const rd = /drop\s+trigger\s+(?:if\s+exists\s+)?((?:[\w"]+\.)?[\w"]+)/gi;
    while ((m = rd.exec(clean))) add(drops, "trigger", norm(m[1]));
  }

  {
    const re = /alter\s+table\s+((?:[\w"]+\.)?[\w"]+)\s+add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?([\w"]+)/gi;
    let m;
    while ((m = re.exec(clean))) add(objs, "column", `${norm(m[1])}.${norm(m[2])}`);
    const rdd = /alter\s+table\s+((?:[\w"]+\.)?[\w"]+)\s+drop\s+(?:column\s+)?(?:if\s+exists\s+)?([\w"]+)/gi;
    while ((m = rdd.exec(clean))) add(drops, "column", `${norm(m[1])}.${norm(m[2])}`);
  }

  {
    const re = /alter\s+table\s+((?:[\w"]+\.)?[\w"]+)\s+add\s+(?:constraint\s+)?((?:[\w"]+\.)?[\w"]+)/gi;
    let m;
    while ((m = re.exec(clean))) {
      const nm = norm(m[2]);
      if (/^(primary|unique|foreign|check|constraint|exclude)/.test(nm)) continue;
      add(objs, "constraint", `${norm(m[1])}.${nm}`);
    }
    const rd = /alter\s+table\s+((?:[\w"]+\.)?[\w"]+)\s+drop\s+constraint\s+(?:if\s+exists\s+)?([\w"]+)/gi;
    while ((m = rd.exec(clean))) add(drops, "constraint", `${norm(m[1])}.${norm(m[2])}`);
  }

  return { objs, drops };
}

const fullSql = read(FULL);
const full = extract(fullSql);
const fullText = fullSql.toLowerCase();

const fullHas = (kind, name) => full.objs.get(kind)?.has(name) ?? false;
const fullDrops = (kind, name) => full.drops.get(kind)?.has(name) ?? false;
const mentions = (name) => fullText.includes(name.toLowerCase());

const allMigs = fs
  .readdirSync(MIG_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const after = allMigs.filter((f) => f > FULL_NAME);

let driftCount = 0;
for (const f of after) {
  const { objs, drops } = extract(read(path.join(MIG_DIR, f)));
  const missing = [];
  const stale = [];

  for (const [kind, set] of objs) {
    for (const name of set) {
      if (!fullHas(kind, name)) {
        missing.push(mentions(name) ? `${kind} ${name}  (sirf text me, DDL nahi)` : `${kind} ${name}`);
      }
    }
  }
  for (const [kind, set] of drops) {
    for (const name of set) {
      if (fullHas(kind, name) && !fullDrops(kind, name)) stale.push(`${kind} ${name}`);
    }
  }

  if (missing.length || stale.length) {
    driftCount++;
    console.log(`\nDRIFT  ${f}`);
    for (const m of missing) console.log(`   MISSING from full schema -> ${m}`);
    for (const s of stale) console.log(`   STALE in full schema (dropped later) -> ${s}`);
  }
}

console.log("");
if (driftCount === 0) {
  console.log(`OK  ${after.length} migrations checked — full schema up-to-date.`);
  process.exit(0);
}
console.error(
  `DRIFT: ${driftCount}/${after.length} migrations ka DDL full schema me missing hai.`
);
console.error(
  `Fix:   ${FULL_NAME} me unhe append karo (idempotent style, jaise 20261002_staff_duty_schedule).`
);
process.exit(1);
