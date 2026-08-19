#!/usr/bin/env node
/**
 * scripts/supabase-restore.mjs
 * ────────────────────────────
 * Supabase PostgreSQL database me dump restore karta hai.
 *
 * Prerequisites:
 *   - psql installed (PostgreSQL client tools)
 *   - Windows: scoop install postgresql  ya  winget install PostgreSQL.PostgreSQL.16
 *
 * Use:
 *   node scripts/supabase-restore.mjs backups/supabase/dumps/vtech_schema_2026-08-20.sql
 *   node scripts/supabase-restore.mjs backup.sql --full          # data bhi restore
 *   node scripts/supabase-restore.mjs backup.sql --dry-run       # sirf check, execute nahi
 *   node scripts/supabase-restore.mjs backup.sql --db-url "postgresql://..."
 *
 * ⚠️  WARNING: Ye EXISTING data OVERWRITE kar sakta hai!
 *     Pehle backup le lo: node scripts/supabase-dump.mjs --full
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── CLI Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function hasFlag(name) {
  return args.includes(`--${name}`);
}

const DRY_RUN = hasFlag("dry-run");
const VERBOSE = hasFlag("verbose") || hasFlag("v");
const FORCE = hasFlag("force") || hasFlag("y");

// Input file
const inputFile = args.find((a) => !a.startsWith("--"));

// Direct DB URL
const urlArg = args.find((a) => a.startsWith("--db-url="));
const directDbUrl = urlArg ? urlArg.split("=")[1] : null;

// ── Connection Details ──────────────────────────────────────────────────────
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
  if (directDbUrl) return directDbUrl;

  const localEnv = readEnvFile(path.join(ROOT, ".env.local"));
  const envFile = readEnvFile(path.join(ROOT, ".env"));
  const env = { ...envFile, ...localEnv };

  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.SUPABASE_DB_URL) return env.SUPABASE_DB_URL;

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const dbPassword = env.SUPABASE_DB_PASSWORD;

  if (supabaseUrl && dbPassword) {
    const match = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (match) {
      const projectRef = match[1];
      const regionArg = args.find((a) => a.startsWith("--region="));
      const region = regionArg ? regionArg.split("=")[1] : "ap-south-1";
      return `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
    }
  }

  return null;
}

// ── Confirm Prompt ──────────────────────────────────────────────────────────
function confirm(message) {
  if (FORCE) return Promise.resolve(true);

  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`\n⚠️  ${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  Supabase Restore Tool — V-Technologies         ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log();

  // Validate input file
  if (!inputFile) {
    console.error("❌ Dump file specify karo!");
    console.error();
    console.error("Use: node scripts/supabase-restore.mjs <dump-file.sql>");
    console.error("Example: node scripts/supabase-restore.mjs backups/supabase/dumps/vtech_schema_2026-08-20.sql");
    process.exit(1);
  }

  const resolvedFile = path.resolve(ROOT, inputFile);
  if (!fs.existsSync(resolvedFile)) {
    console.error(`❌ File nahi mila: ${inputFile}`);
    process.exit(1);
  }

  // Check psql
  try {
    execSync("psql --version", { stdio: "pipe" });
  } catch {
    console.error("❌ psql nahi mila!");
    console.error();
    console.error("Install karo:");
    console.error("  Windows : scoop install postgresql");
    console.error("  Mac     : brew install postgresql");
    console.error("  Linux   : sudo apt install postgresql-client");
    process.exit(1);
  }

  // Get DB URL
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    console.error("❌ Database URL nahi mila!");
    console.error("Use: --db-url='postgresql://...'  ya  .env.local me SUPABASE_DB_PASSWORD set karo");
    process.exit(1);
  }

  const maskedUrl = dbUrl.replace(/:[^:@]+@/, ":***@");

  // Analyze file
  const content = fs.readFileSync(resolvedFile, "utf8");
  const lines = content.split("\n").length;
  const sizeMB = (Buffer.byteLength(content) / (1024 * 1024)).toFixed(2);
  const hasSchema = content.includes("CREATE TABLE");
  const hasData = content.includes("INSERT INTO");
  const hasRLS = content.includes("ENABLE ROW LEVEL SECURITY");
  const hasFunctions = content.includes("CREATE FUNCTION") || content.includes("CREATE OR REPLACE FUNCTION");

  console.log(`📁 File       : ${inputFile}`);
  console.log(`📏 Size       : ${sizeMB} MB (${lines.toLocaleString()} lines)`);
  console.log(`📋 Content    : ${hasSchema ? "✅ Schema" : "❌ No Schema"} | ${hasData ? "✅ Data" : "❌ No Data"} | ${hasRLS ? "✅ RLS" : "❌ No RLS"} | ${hasFunctions ? "✅ Functions" : "❌ No Functions"}`);
  console.log(`🔗 Database   : ${maskedUrl}`);
  console.log(`🧪 Dry Run    : ${DRY_RUN ? "HAAN" : "nahi"}`);
  console.log();

  // Confirm
  if (!DRY_RUN) {
    const ok = await confirm("Database me restore karne ja rahe ho. Existing data overwrite ho sakta hai. Continue?");
    if (!ok) {
      console.log("❌ Cancelled.");
      process.exit(0);
    }
  }

  // Build psql command
  const cmd = DRY_RUN
    ? `psql --dbname="${dbUrl}" --file="${resolvedFile}" --echo-all --set ON_ERROR_STOP=1`
    : `psql --dbname="${dbUrl}" --file="${resolvedFile}" --set ON_ERROR_STOP=1`;

  console.log(DRY_RUN ? "🧪 Dry run shuru..." : "⏳ Restore shuru...");
  const startTime = Date.now();

  try {
    execSync(cmd, {
      encoding: "utf8",
      maxBuffer: 500 * 1024 * 1024,
      stdio: DRY_RUN ? "inherit" : ["pipe", "pipe", "pipe"],
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log();
    console.log(DRY_RUN ? "✅ Dry run complete — koi error nahi!" : "✅ Restore complete!");
    console.log(`   ⏱  Time : ${elapsed}s`);

    if (!DRY_RUN) {
      console.log();
      console.log("💡 Verify karo — SQL Editor me run karo:");
      console.log("   SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';");
    }
  } catch (err) {
    console.error();
    console.error("❌ Restore fail hua!");

    if (err.stderr) {
      const stderr = err.stderr.toString();
      if (stderr.includes("password authentication failed")) {
        console.error("   Password galat hai.");
      } else if (stderr.includes("already exists")) {
        console.error("   Tables pehle se exist karti hain. Pehle 00_drop_all.sql run karo.");
      } else if (stderr.includes("does not exist")) {
        console.error("   Table/function nahi mila — pehle schema dalna padega.");
      } else {
        console.error("   " + stderr.split("\n").filter(Boolean).slice(0, 5).join("\n   "));
      }
    }

    console.error();
    console.error("Fix:");
    console.error("  1. Agar tables pehle se hain → pehle 00_drop_all.sql run karo");
    console.error("  2. Password/URL check karo");
    console.error("  3. --dry-run se pehle check karo");
    process.exit(1);
  }
}

main();
