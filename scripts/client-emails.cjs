/* eslint-disable @typescript-eslint/no-require-imports */
// scripts/client-emails.cjs
// Client emails bulk tool — CSV se export/import. Portal login ke liye client
// ka REAL inbox email chahiye (OTP usi par jata hai) — phone / "not given"
// wale emails kaam nahi karte.
//
// Export:
//   node scripts/client-emails.cjs export [out.csv]
//   → active clients (delete_flag=0) ki list + data-quality report
//
// Import (email update + optional portal enable):
//   node scripts/client-emails.cjs import file.csv
//   → sirf email update (CSV me login_allowed empty ho to role untouched)
//   node scripts/client-emails.cjs import file.csv --enable
//   → valid email wali har row par login_allowed=true bhi (portal on)
//
// CSV format (header): id,name,contact,email,login_allowed
//   id      → zaroori, client_list.id se match hota hai
//   email   → zaroori, valid format hona chahiye (blank/invalid skip)
//   login_allowed → optional: true/false (empty = change mat karo)

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const env = {};
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && m[2].trim()) env[m[1]] = m[2].trim();
}
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!env[k]) { console.error(`ERROR: .env.local me ${k} missing`); process.exit(1); }
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE  = /^\+?[\d\s\-()]{6,}$/;

function csvEscape(v) {
  v = v == null ? "" : String(v);
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

function parseCsv(text) {
  const rows = []; let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = ""; rows.push(row); row = [];
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

function classifyEmail(e) {
  const s = (e || "").trim().toLowerCase();
  if (!s) return "EMPTY";
  if (EMAIL_RE.test(s)) return "VALID";
  if (PHONE_RE.test(s) && /\d/.test(s)) return "PHONE";
  return "GARBAGE";
}

async function exportCsv(outFile) {
  console.log("Exporting active clients...");
  const { data, error } = await admin.from("client_list")
    .select("id, firstname, middlename, lastname, contact, email, login_allowed")
    .eq("delete_flag", 0)
    .order("id");
  if (error) { console.error("ERROR:", error.message); process.exit(1); }
  if (!data?.length) { console.log("Koi active client nahi mila."); return; }

  const lines = ["id,name,contact,email,login_allowed"];
  for (const c of data) {
    lines.push([
      c.id,
      [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ").trim(),
      c.contact || "",
      c.email || "",
      c.login_allowed ? "true" : "false",
    ].map(csvEscape).join(","));
  }
  const out = path.resolve(outFile);
  fs.writeFileSync(out, lines.join("\n") + "\n", "utf8");
  console.log(`Written: ${out} (${data.length} clients)\n`);

  const counts = { VALID: 0, EMPTY: 0, PHONE: 0, GARBAGE: 0 };
  for (const c of data) counts[classifyEmail(c.email)]++;
  console.log("=== Email data quality ===");
  console.log(`  VALID   : ${counts.VALID}   (portal ke liye ready)`);
  console.log(`  EMPTY   : ${counts.EMPTY}   (email hi nahi hai)`);
  console.log(`  PHONE   : ${counts.PHONE}   (email column me phone number hai)`);
  console.log(`  GARBAGE : ${counts.GARBAGE}   ("not given" / naam / aadi)`);
  console.log(`  Portal ON (login_allowed=true): ${data.filter((c) => c.login_allowed).length}`);
  console.log("\nCSV me email fill karke wapas import karo:\n  node scripts/client-emails.cjs import <file.csv> [--enable]");
}

async function importCsv(file, enableFlag) {
  if (!fs.existsSync(file)) { console.error("ERROR: file nahi mili:", file); process.exit(1); }
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const iId = header.indexOf("id");
  const iEmail = header.indexOf("email");
  const iLogin = header.indexOf("login_allowed");
  if (iId < 0 || iEmail < 0) {
    console.error('ERROR: CSV header me "id" aur "email" dono honi chahiye. Header:', header.join(","));
    process.exit(1);
  }

  let updated = 0, blank = 0, invalid = 0, unknown = 0, enabled = 0;
  const unknownIds = [], invalidRows = [];

  for (const row of rows.slice(1)) {
    const rawId = (row[iId] || "").trim();
    const emailRaw = (row[iEmail] || "").trim().toLowerCase();
    const loginRaw = (iLogin >= 0 ? (row[iLogin] || "").trim().toLowerCase() : "");
    const id = parseInt(rawId, 10);

    if (isNaN(id)) { unknown++; unknownIds.push(rawId || "?"); continue; }
    if (!emailRaw) { blank++; continue; }
    if (!EMAIL_RE.test(emailRaw)) { invalid++; invalidRows.push(`${id} (${emailRaw})`); continue; }

    const patch = { email: emailRaw };
    let wantLogin = null;
    if (enableFlag && EMAIL_RE.test(emailRaw)) wantLogin = true;
    else if (loginRaw === "true") wantLogin = true;
    else if (loginRaw === "false") wantLogin = false;
    if (wantLogin !== null) patch.login_allowed = wantLogin;

    const { data, error } = await admin.from("client_list").update(patch).eq("id", id).eq("delete_flag", 0).select("id");
    if (error) { invalid++; invalidRows.push(`${id} update error: ${error.message}`); continue; }
    if (!data?.length) { unknown++; unknownIds.push(String(id)); continue; }
    updated++;
    if (wantLogin === true) enabled++;
  }

  console.log("=== Import result ===");
  console.log(`  Updated (email set) : ${updated}`);
  console.log(`  Portal ON           : ${enabled}`);
  console.log(`  Blank email (skip)  : ${blank}`);
  console.log(`  Invalid format (skip): ${invalid}`);
  console.log(`  Unknown id (skip)   : ${unknown}`);
  if (invalidRows.length) console.log("  Invalid rows: " + invalidRows.slice(0, 10).join(", ") + (invalidRows.length > 10 ? ` ... (+${invalidRows.length - 10})` : ""));
}

(async () => {
  const mode = process.argv[2];
  if (mode === "export") { await exportCsv(process.argv[3] || "client-emails.csv"); }
  else if (mode === "import") {
    const file = process.argv[3];
    const enableFlag = process.argv.includes("--enable");
    if (!file) { console.error("Usage: node scripts/client-emails.cjs import <file.csv> [--enable]"); process.exit(1); }
    await importCsv(file, enableFlag);
  } else {
    console.log(`Usage:
  node scripts/client-emails.cjs export [out.csv]
  node scripts/client-emails.cjs import <file.csv> [--enable]`);
    process.exit(1);
  }
})().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
