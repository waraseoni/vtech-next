#!/usr/bin/env node
/**
 * scripts/supabase-dump.mjs
 * ─────────────────────────
 * Supabase PostgreSQL ka full/schema/data dump tool.
 *
 * pg_dump use karta hai (Supabase ka direct connection — port 5432).
 *
 * Prerequisites:
 *   - pg_dump installed hona chahiye (PostgreSQL client tools)
 *   - Windows: https://www.postgresql.org/download/windows/ ya scoop install postgresql
 *   - Mac: brew install postgresql
 *   - Linux: apt install postgresql-client
 *
 * Use:
 *   node scripts/supabase-dump.mjs                          # schema-only (default)
 *   node scripts/supabase-dump.mjs --full                    # schema + data
 *   node scripts/supabase-dump.mjs --data-only               # sirf data
 *   node scripts/supabase-dump.mjs --schema-only             # sirf schema (default)
 *   node scripts/supabase-dump.mjs --output backup.sql       # custom filename
 *   node scripts/supabase-dump.mjs --dir ./backups           # output directory
 *   node scripts/supabase-dump.mjs --db-url "postgresql://..."  # direct URL
 *   node scripts/supabase-dump.mjs --clean                   # DROP + CREATE statements
 *
 * Connection (.env.local se auto-padhta hai):
 *   DATABASE_URL ya SUPABASE_DB_URL ya SUPABASE_DB_PASSWORD + project-ref
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── CLI Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function hasFlag(name) {
  return args.includes(`--${name}`);
}

const MODE = hasFlag("full") ? "full"
  : hasFlag("data-only") ? "data-only"
  : "schema-only";

const CLEAN = hasFlag("clean");
const VERBOSE = hasFlag("verbose") || hasFlag("v");

// Output file
const outputArg = args.find((a) => a.startsWith("--output=") || a.startsWith("-o="));
const outputFilename = outputArg ? outputArg.split("=")[1] : null;

const dirArg = args.find((a) => a.startsWith("--dir="));
const outputDir = dirArg
  ? path.resolve(ROOT, dirArg.split("=")[1])
  : path.join(ROOT, "backups", "supabase", "dumps");

// Direct DB URL
const urlArg = args.find((a) => a.startsWith("--db-url="));
const directDbUrl = urlArg ? urlArg.split("=")[1] : null;

// ── Connection Details Padho ─────────────────────────────────────────────────
function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[2].trim() && !m[2].trim().startsWith("#")) {
      env[m[1]] = m[2].trim();
    }
  }
  return env;
}

function getDatabaseUrl() {
  // 1. Direct URL arg
  if (directDbUrl) return directDbUrl;

  // 2. .env.local ya .env
  const localEnv = readEnvFile(path.join(ROOT, ".env.local"));
  const envFile = readEnvFile(path.join(ROOT, ".env"));
  const env = { ...envFile, ...localEnv };

  // 3. DATABASE_URL ya SUPABASE_DB_URL
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.SUPABASE_DB_URL) return env.SUPABASE_DB_URL;

  // 4. Construct from SUPABASE_URL + password
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const dbPassword = env.SUPABASE_DB_PASSWORD;

  if (supabaseUrl && dbPassword) {
    // https://abcxyz.supabase.co → abcxyz
    const match = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (match) {
      const projectRef = match[1];
      // Supabase direct connection string
      return `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-${getDbRegion()}.pooler.supabase.com:5432/postgres`;
    }
  }

  return null;
}

function getDbRegion() {
  // Default ap-south-1 (India) — override with --region flag
  const regionArg = args.find((a) => a.startsWith("--region="));
  return regionArg ? regionArg.split("=")[1] : "ap-south-1";
}

// ── pg_dump Command Banao ────────────────────────────────────────────────────
function buildDumpCommand(dbUrl) {
  const parts = ["pg_dump"];

  // Mode
  if (MODE === "schema-only") {
    parts.push("--schema-only");
  } else if (MODE === "data-only") {
    parts.push("--data-only");
  }
  // full = no flag needed

  // Clean (DROP statements)
  if (CLEAN && MODE !== "data-only") {
    parts.push("--clean");
    parts.push("--if-exists");
  }

  // Options
  parts.push("--no-owner");
  parts.push("--no-privileges");
  parts.push("--no-comments");
  parts.push("--no-publications");
  parts.push("--no-subscriptions");
  parts.push("--no-security-labels");
  parts.push("--no-tablespaces");

  // Schema
  parts.push("--schema=public");

  // Verbose
  if (VERBOSE) parts.push("--verbose");

  // Format
  parts.push("--format=plain");

  // Connection
  parts.push(`--dbname="${dbUrl}"`);

  return parts.join(" ");
}

// ── Output File Naam ────────────────────────────────────────────────────────
function getOutputFile() {
  if (outputFilename) {
    return path.resolve(ROOT, outputFilename);
  }

  const now = new Date();
  const ts = now.toISOString().slice(0, 19).replace(/[T:]/g, "-").replace(/--/g, "-");
  const modeTag = MODE === "full" ? "full"
    : MODE === "data-only" ? "data"
    : "schema";

  const filename = `vtech_${modeTag}_${ts}.sql`;
  return path.join(outputDir, filename);
}

// ── Main ────────────────────────────────────────────────────────────────────
function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  Supabase pg_dump Tool — V-Technologies         ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log();

  // Check pg_dump
  try {
    execSync("pg_dump --version", { stdio: "pipe" });
  } catch {
    console.error("❌ pg_dump nahi mila!");
    console.error();
    console.error("Install karo:");
    console.error("  Windows : scoop install postgresql  ya  winget install PostgreSQL.PostgreSQL.16");
    console.error("  Mac     : brew install postgresql");
    console.error("  Linux   : sudo apt install postgresql-client");
    console.error();
    console.error("Ya direct download: https://www.postgresql.org/download/");
    process.exit(1);
  }

  // Get DB URL
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    console.error("❌ Database URL nahi mila!");
    console.error();
    console.error("Ye karo (koi ek):");
    console.error("  1. --db-url flag use karo: --db-url='postgresql://...'");
    console.error("  2. .env.local me SUPABASE_DB_PASSWORD add karo");
    console.error("     + NEXT_PUBLIC_SUPABASE_URL (pehle se hona chahiye)");
    console.error("  3. .env.local me DATABASE_URL ya SUPABASE_DB_URL add karo");
    process.exit(1);
  }

  // Mask password for display
  const maskedUrl = dbUrl.replace(/:[^:@]+@/, ":***@");

  console.log(`📁 Mode       : ${MODE}`);
  console.log(`🧹 Clean      : ${CLEAN ? "haan" : "nahi"}`);
  console.log(`🔗 Database   : ${maskedUrl}`);
  console.log();

  // Build command
  const cmd = buildDumpCommand(dbUrl);
  const outputFile = getOutputFile();

  console.log(`💾 Output     : ${path.relative(ROOT, outputFile)}`);
  console.log();

  if (VERBOSE) {
    console.log(`📝 Command    : ${cmd}`);
    console.log();
  }

  // Ensure output directory exists
  const outDir = path.dirname(outputFile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
    console.log(`📂 Directory banaya: ${path.relative(ROOT, outDir)}`);
  }

  // Run pg_dump
  console.log("⏳ Dump shuru...");
  const startTime = Date.now();

  try {
    const output = execSync(cmd, {
      encoding: "utf8",
      maxBuffer: 500 * 1024 * 1024, // 500MB buffer
      stdio: ["pipe", "pipe", "pipe"],
    });

    fs.writeFileSync(outputFile, output, "utf8");

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const sizeMB = (Buffer.byteLength(output) / (1024 * 1024)).toFixed(2);
    const lines = output.split("\n").length;

    console.log();
    console.log("✅ Dump complete!");
    console.log(`   ⏱  Time    : ${elapsed}s`);
    console.log(`   📏 Size    : ${sizeMB} MB`);
    console.log(`   📄 Lines   : ${lines.toLocaleString()}`);
    console.log(`   💾 File    : ${path.relative(ROOT, outputFile)}`);
    console.log();

    if (MODE === "schema-only") {
      console.log("💡 Schema-only dump — client ke naye project me run kar sakte ho.");
    } else if (MODE === "data-only") {
      console.log("💡 Data-only dump — existing schema pe data restore karne ke liye.");
    } else {
      console.log("💡 Full dump — schema + data. Bade databases me file badi ho sakti hai.");
    }
  } catch (err) {
    console.error();
    console.error("❌ Dump fail hua!");

    // pg_dump stderr often contains the actual error
    if (err.stderr) {
      const stderr = err.stderr.toString();
      if (stderr.includes("password authentication failed")) {
        console.error("   Password galat hai ya connection refused.");
      } else if (stderr.includes("could not connect")) {
        console.error("   Database se connect nahi ho paya.");
        console.error("   Supabase Dashboard → Settings → Database → Connection string check karo.");
        console.error("   Direct connection (port 5432) use karo, pooler nahi.");
      } else if (stderr.includes("no pg_hba.conf entry")) {
        console.error("   Connection rejected. Supabase me IP allowlist check karo.");
      } else {
        console.error("   " + stderr.split("\n").filter(Boolean).slice(0, 3).join("\n   "));
      }
    } else {
      console.error("   " + (err.message || "Unknown error"));
    }

    console.error();
    console.error("Troubleshooting:");
    console.error("  1. Supabase Dashboard → Settings → Database → Connection string (Direct, port 5432)");
    console.error("  2. DB password sahi hai? (Settings → Database → Database password)");
    console.error("  3. pg_dump installed hai? → pg_dump --version");
    process.exit(1);
  }
}

main();
