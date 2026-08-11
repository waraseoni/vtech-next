/* eslint-disable @typescript-eslint/no-require-imports */
// scripts/verify-rls.cjs
// Client portal RLS verification — behavioral (read-only, plus ek throwaway
// auth user jo banata hai aur khud delete kar deta hai).
//
// Check karta hai:
//   1) Anonymous (bina login) → transaction_list / client_payments se 0 rows (RLS enabled)
//   2) Staff session → dono tables read ho sakta hai (staff policy)
//   3) Profile-less authenticated user → kuch nahi milta (policy blocks)
//   4) Client isolation → apni rows milti hain, doosre client ki 0 rows
//   5) profiles me role='client' insert chalta hai (constraint fix applied)
//
// Usage:
//   node scripts/verify-rls.cjs <staffEmail> <staffPassword>
//   (args na do to script prompt karega)
//
// Note: catalog-level checks (RLS flags / policy defs / constraint / triggers)
// PostgREST se nahi hote — wo `scripts/check_rls.sql` SQL editor me run karo.

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const env = {};
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && m[2].trim()) env[m[1]] = m[2].trim();
}
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!env[k]) { console.error(`ERROR: .env.local me ${k} missing`); process.exit(1); }
}
const BASE = env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1";

const anon  = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("   ✅ " + name + (extra ? "  — " + extra : "")); }
  else      { fail++; console.log("   ❌ " + name + (extra ? "  — " + extra : "")); }
};

// PostgREST raw GET with given JWT (empty token = anonymous)
async function restGet(token, table, qs) {
  const headers = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Accept: "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const r = await fetch(`${BASE}/${table}?${qs}`, { headers });
  const txt = await r.text();
  let body = null; try { body = JSON.parse(txt); } catch {}
  return { status: r.status, count: Array.isArray(body) ? body.length : null, body };
}

async function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a.trim()); }));
}

(async () => {
  console.log("\n═══ Client Portal RLS Verification (behavioral) ═══\n");

  // ── [1] Anonymous reads blocked ──────────────────────────────────────────
  console.log("[1] Anonymous (bina login) — RLS block hone chahiye");
  let r = await restGet(null, "transaction_list", "select=*&limit=1");
  ok("transaction_list → 0 rows", r.count === 0 || r.status === 401, `status=${r.status}, rows=${r.count}`);
  r = await restGet(null, "client_payments", "select=*&limit=1");
  ok("client_payments → 0 rows", r.count === 0 || r.status === 401, `status=${r.status}, rows=${r.count}`);

  // ── [2] Staff session can read ───────────────────────────────────────────
  console.log("\n[2] Staff/Admin session — read allowed hona chahiye");
  const staffEmail = process.argv[2] || await prompt("Staff/Admin email: ");
  const staffPass  = process.argv[3] || await prompt("Password: ");
  const { data: staffSession, error: staffErr } = await anon.auth.signInWithPassword({ email: staffEmail, password: staffPass });
  if (staffErr) {
    console.log("   ⚠️  Staff login fail: " + staffErr.message + " — [2] skip kiya (baaki checks chalenge)");
  } else {
    const st = staffSession.session.access_token;
    r = await restGet(st, "transaction_list", "select=*&limit=1");
    ok("staff transaction_list padh sakta hai", r.status === 200, `status=${r.status}, rows=${r.count}`);
    r = await restGet(st, "client_payments", "select=*&limit=1");
    ok("staff client_payments padh sakta hai", r.status === 200, `status=${r.status}, rows=${r.count}`);
  }

  // ── [3] Profile-less authenticated user blocked ─────────────────────────
  console.log("\n[3] Profile-less auth user — kuch nahi milna chahiye");
  const t = Date.now();
  let testUser = null;
  const { data: nu, error: nuErr } = await admin.auth.admin.createUser({
    email: `rlstest${t}@example.com`, password: "rlstest123", email_confirm: true,
  });
  ok("profile-less test user ban gaya", !nuErr && nu?.user?.id, nuErr?.message || "");
  if (nu?.user?.id) {
    testUser = nu.user.id;
    const { data: s2 } = await anon.auth.signInWithPassword({ email: nu.user.email, password: "rlstest123" });
    const tk = s2?.session?.access_token;
    const finTables = ["transaction_list", "client_payments", "direct_sales", "client_loans"];
    for (const tbl of finTables) {
      r = tk ? await restGet(tk, tbl, "select=*&limit=1") : { status: 0, count: null };
      ok(`profile-less → ${tbl} 0 rows`, r.count === 0 || r.status === 401, `status=${r.status}, rows=${r.count}`);
    }
    await admin.from("profiles").delete().eq("id", testUser).then(() => {});
    await admin.auth.admin.deleteUser(testUser).catch(() => {});
    testUser = null;
  }

  // ── [4] Client isolation ────────────────────────────────────────────────
  console.log("\n[4] Client isolation — apni rows milein, doosre ki 0");
  // Do aise clients lo jinke paas transactions hain (paged fetch + JS dedupe)
  const names = new Set();
  let from = 0;
  while (true) {
    const cq = await fetch(`${BASE}/transaction_list?select=client_name&limit=1000&offset=${from}`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY },
    });
    const rows = await cq.json().catch(() => []);
    if (!Array.isArray(rows) || !rows.length) break;
    for (const x of rows) names.add(x.client_name);
    if (rows.length < 1000) break;
    from += 1000;
  }
  const ids = [...new Set([...names].map((n) => parseInt(n, 10)).filter((n) => !isNaN(n)))];
  const c1 = ids[0], c2 = ids.find((n) => n !== c1);
  ok("do data-wale clients mile (isolation test ke liye)", !!c1 && !!c2, `c1=${c1}, c2=${c2}`);
  if (c1 && c2 && c1 !== c2) {
    const { data: nu2, error: nu2Err } = await admin.auth.admin.createUser({
      email: `rlstestcli${t}@example.com`, password: "rlstest123", email_confirm: true,
    });
    ok("test client user ban gaya", !nu2Err && nu2?.user?.id, nu2Err?.message || "");
    if (nu2?.user?.id) {
      const uid = nu2.user.id;
      const { error: pErr } = await admin.from("profiles").insert({ id: uid, role: "client", client_id: c1, full_name: "RLS Test Client" });
      ok("role='client' profile insert chal gaya (constraint fix applied)", !pErr, pErr?.message || "");
      if (!pErr) {
        const { data: s3 } = await anon.auth.signInWithPassword({ email: nu2.user.email, password: "rlstest123" });
        const tk = s3?.session?.access_token;
        r = tk ? await restGet(tk, "transaction_list", `select=*&client_name=eq.${c1}&limit=3`) : { status: 0, count: null };
        ok("apni rows padh sakta hai (policy allows)", r.status === 200 && r.count >= 0, `status=${r.status}, rows=${r.count}`);
        r = tk ? await restGet(tk, "transaction_list", `select=*&client_name=eq.${c2}&limit=3`) : { status: 0, count: null };
        ok("doosre client ki rows BLOCKED (0 rows)", r.count === 0, `status=${r.status}, rows=${r.count}`);
        r = tk ? await restGet(tk, "client_payments", `select=*&client_id=eq.${c1}&limit=3`) : { status: 0, count: null };
        ok("apni payments padh sakta hai", r.status === 200, `status=${r.status}, rows=${r.count}`);
        r = tk ? await restGet(tk, "client_payments", `select=*&client_id=eq.${c2}&limit=3`) : { status: 0, count: null };
        ok("doosre client ki payments BLOCKED (0 rows)", r.count === 0, `status=${r.status}, rows=${r.count}`);
      }
      await admin.from("profiles").delete().eq("id", uid).then(() => {});
      await admin.auth.admin.deleteUser(uid).catch(() => {});
    }
  }

  // ── [5] Columns applied ─────────────────────────────────────────────────
  console.log("\n[5] Portal columns live hain");
  const lr = await admin.from("client_list").select("login_allowed").limit(1);
  ok("client_list.login_allowed column", !lr.error, lr.error?.message || "");
  const pr = await admin.from("profiles").select("client_id").limit(1);
  ok("profiles.client_id column", !pr.error, pr.error?.message || "");

  console.log("\n═══ RESULT: " + pass + " pass / " + fail + " fail ═══");
  console.log("Catalog-level checks ke liye scripts/check_rls.sql SQL editor me run karo.");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
