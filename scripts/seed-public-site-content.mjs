#!/usr/bin/env node
/**
 * Public-site content seed (WS-7).
 *
 * Default = DRY RUN: kuch bhi DB me nahi likhta, sirf plan + size print karta hai.
 * `--apply` explicit chahiye. Existing non-empty `site_content` ko overwrite karne
 * ke liye extra `--force` bhi chahiye (live DB safety).
 *
 * Usage:
 *   node scripts/seed-public-site-content.mjs
 *   node scripts/seed-public-site-content.mjs --out tmp/site-content.json
 *   node scripts/seed-public-site-content.mjs --apply        # sirf approval ke baad
 *   node scripts/seed-public-site-content.mjs --apply --force
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const CONTENT_KEYS = ["site_content", "site_content_updated_at"];
const MAX_BYTES = 200 * 1024;

function loadEnv(file) {
  const full = path.join(ROOT, file);
  if (!existsSync(full)) return;
  const text = readFileSync(full, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const key = match[1];
    if (process.env[key] !== undefined) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnv(".env.local");
loadEnv(".env");

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const force = args.has("--force");
const outIndex = process.argv.indexOf("--out");
const outPath = outIndex >= 0 ? process.argv[outIndex + 1] : null;

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

// Node 24 type-stripping se defaults directly import hote hain — copy nahi.
const { getDefaultSiteContent, SERVICE_IDS } = await import(
  pathToFileURL(path.join(ROOT, "src/lib/public-site-defaults.ts")).href
);

const content = getDefaultSiteContent("full");
const payload = {
  version: 1,
  seo: content.seo,
  home: content.home,
  faq: content.faq,
  about: content.about,
  contactPage: content.contactPage,
  services: content.services,
  footer: content.footer,
};
const raw = JSON.stringify(payload);
const bytes = Buffer.byteLength(raw, "utf8");

console.log("─".repeat(64));
console.log("Public site content seed");
console.log("─".repeat(64));
console.log(`DB host        : ${new URL(supabaseUrl).host}`);
console.log(`Payload        : ${bytes} bytes (${(bytes / 1024).toFixed(1)} KB, cap 200 KB)`);
console.log(
  `Services       : ${SERVICE_IDS.map((id) => `${id}=${content.services[id].enabled ? "on" : "off"}`).join(", ")}`
);
console.log(
  `Equipment items: ${SERVICE_IDS.reduce((n, id) => n + content.services[id].equipment.length, 0)}`
);

if (bytes > MAX_BYTES) {
  console.error(`Payload ${MAX_BYTES / 1024} KB cap se bada hai — seed abort.`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: rows, error: readError } = await supabase
  .from("system_info")
  .select("id, meta_field, meta_value")
  .in("meta_field", CONTENT_KEYS)
  .order("id", { ascending: true });

if (readError) {
  console.error("system_info read failed:", readError.message);
  process.exit(1);
}

const existing = new Map();
for (const row of rows || []) {
  if (!existing.has(row.meta_field)) existing.set(row.meta_field, row);
}
const existingContent = existing.get("site_content");
const existingUpdatedAt = existing.get("site_content_updated_at");
const existingValue =
  typeof existingContent?.meta_value === "string" ? existingContent.meta_value : "";
const existingBytes = Buffer.byteLength(existingValue, "utf8");

console.log(
  `Existing       : ${
    existingContent
      ? `id=${existingContent.id}, ${existingBytes} bytes${
          existingUpdatedAt?.meta_value ? `, updated ${existingUpdatedAt.meta_value}` : ""
        }`
      : "no site_content row"
  }`
);
console.log(`Planned action : ${existingContent ? "UPDATE" : "INSERT"} (dry-run by default)`);

if (outPath) {
  const target = path.resolve(ROOT, outPath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote snapshot : ${target}`);
}

if (!apply) {
  console.log("\nDRY RUN — zero DB writes. `--apply` explicit approval ke baad hi.");
  await supabase.removeAllChannels();
  process.exitCode = 0;
} else if (existingValue.trim() && !force) {
  console.error(
    "\nExisting non-empty site_content mila. Overwrite ke liye `--force` chahiye — pehle Settings se backup/export karein."
  );
  await supabase.removeAllChannels();
  process.exitCode = 1;
} else {
  const updatedAt = new Date().toISOString();
  async function writeKey(key, value) {
    const row = existing.get(key);
    if (row) {
      const { error } = await supabase
        .from("system_info")
        .update({ meta_value: value })
        .eq("id", row.id);
      if (error) throw new Error(`${key} update failed: ${error.message}`);
      return `updated id=${row.id}`;
    }
    const { error } = await supabase
      .from("system_info")
      .insert({ meta_field: key, meta_value: value });
    if (error) throw new Error(`${key} insert failed: ${error.message}`);
    return "inserted";
  }

  try {
    const contentResult = await writeKey("site_content", raw);
    const stampResult = await writeKey("site_content_updated_at", updatedAt);
    console.log(`\nApplied        : site_content ${contentResult}; timestamp ${stampResult}`);
    console.log(
      "Cache          : next request / save route revalidate ke baad naya content dikhega."
    );
  } catch (error) {
    console.error(`\nSeed failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
  await supabase.removeAllChannels();
}
