#!/usr/bin/env node
/**
 * scripts/make-client-package.mjs
 * ───────────────────────────────
 * Har client ke liye ek ready-to-deploy "package" folder banata hai:
 *   packages/<slug>/
 *     ├── .env.production   → client ke API keys (Supabase data project + license service)
 *     ├── LICENSE_KEY.txt   → client ka license key
 *     ├── SETUP.md          → client ko kya karna hai (setup page + login + key)
 *     ├── DEPLOY.md         → seller ke liye provisioning steps (schema + env + deploy)
 *     └── app-info.json     → machine-readable summary (seller portal ke liye)
 *
 * Content builder src/lib/setup-kit.ts se shared hai (seller portal ke
 * "Download Setup Kit" button bhi wahi use karta hai).
 *
 * Use:
 *   node scripts/make-client-package.mjs                 # scripts/clients.json (ya sample) se sab
 *   node scripts/make-client-package.mjs --file x.json   # specific file
 *   node scripts/make-client-package.mjs --slug my-shop  # sirf ek client
 *   node scripts/make-client-package.mjs --zip           # har package ko zip bhi karo
 *
 * License service URL/ANON_KEY seller ke .env.local se automatically padhe jaate hain.
 * ⚠️ Is package me SELLER PORTAL vars NAHI jaate (LICENSE_SERVICE_SERVICE_ROLE_KEY,
 *    SELLER_PORTAL_PASSWORD, DEV_PORTAL_PASSWORD) — isliye client ke admin ko
 *    navigation me Seller/Developer portals NAHI dikhenge.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSetupKitFiles, slugify, zipFiles } from "../src/lib/setup-kit.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "packages");

// ── .env.local se license service creds padho ────────────────────────────────
function readEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[2].trim()) env[m[1]] = m[2].trim();
  }
  return env;
}

// ── Input clients ────────────────────────────────────────────────────────────
function loadClients(args) {
  const fileArg = args.find((a) => a.startsWith("--file="));
  const slugArg = args.find((a) => a.startsWith("--slug="));
  const file = fileArg ? fileArg.slice("--file=".length)
    : fs.existsSync(path.join(ROOT, "scripts", "clients.json"))
      ? path.join(ROOT, "scripts", "clients.json")
      : path.join(ROOT, "scripts", "clients.sample.json");

  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const list = Array.isArray(raw) ? raw : raw.clients || [];
  const clients = slugArg
    ? list.filter((c) => c.slug === slugArg.slice("--slug=".length))
    : list;
  if (clients.length === 0) {
    console.error(`ERROR: koi client nahi mila (${file}). --slug sahi hai?`);
    process.exit(1);
  }
  return clients;
}

// ── Package ──────────────────────────────────────────────────────────────────
function buildPackage(c, env) {
  const dir = path.join(OUT_DIR, c.slug);
  fs.mkdirSync(dir, { recursive: true });

  const files = buildSetupKitFiles({
    slug: c.slug,
    shopName: c.shopName,
    appUrl: c.appUrl,
    licenseKey: c.licenseKey,
    supabaseUrl: c.supabaseUrl,
    supabaseAnonKey: c.supabaseAnonKey,
    supabaseServiceRoleKey: c.supabaseServiceRoleKey,
    setupToken: c.setupToken,
    licenseServiceUrl: env.LICENSE_SERVICE_URL,
    licenseServiceAnonKey: env.LICENSE_SERVICE_ANON_KEY,
  });

  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  return { dir, files };
}

// ── Main ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const env = readEnvLocal();
if (!env.LICENSE_SERVICE_URL || !env.LICENSE_SERVICE_ANON_KEY) {
  console.warn("⚠️  .env.local mein LICENSE_SERVICE_URL / LICENSE_SERVICE_ANON_KEY nahi mile — package mein khali jayenge!");
}

const clients = loadClients(args);
const doZip = args.includes("--zip");
const REQUIRED = ["slug", "shopName", "supabaseUrl", "supabaseAnonKey", "supabaseServiceRoleKey", "licenseKey"];

let ok = 0;
for (const c of clients) {
  if (!c.slug) c.slug = slugify(c.shopName || "client");
  const missing = REQUIRED.filter((k) => !c[k]);
  if (missing.length) {
    console.error(`✗ ${c.shopName || c.slug}: missing ${missing.join(", ")}`);
    continue;
  }
  const { dir, files } = buildPackage(c, env);
  ok++;
  if (doZip) {
    fs.writeFileSync(`${dir}.zip`, zipFiles(files));
    console.log(`✓ ${c.shopName} → ${path.relative(ROOT, dir)}.zip`);
  } else {
    console.log(`✓ ${c.shopName} → ${path.relative(ROOT, dir)}`);
  }
}

console.log(`\nDone: ${ok}/${clients.length} packages.`);
console.log("⚠️  Packages sensitive keys rakhte hain — client ko hi do, git/repo mein mat push karo.");
