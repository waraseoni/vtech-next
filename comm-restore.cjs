/* RESTORE: reads a local backup_comm_*.json (array of {id, commission:number}) and with APPLY=1 writes those back to transaction_list.mechanic_commission_amount by id. READ-ONLY unless APPLY=1. ASCII only. */
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
function ld(p) {
  const o = {};
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m) o[m[1]] = m[2].replace(/^"|"$/g, "").trim();
  }
  return o;
}
const env = ld(path.join(__dirname, ".env.local"));
const U = env.NEXT_PUBLIC_SUPABASE_URL;
const K = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!U || !K) { console.error("keys"); process.exit(1); }
const sb = createClient(U, K, { auth: { persistSession: false } });
const BN = process.env.BACKUP || "";
if (!BN) { console.error("usage: set BACKUP=<path to backup_comm_*.json> [APPLY=1]"); process.exit(1); }
(async () => {
  const rows = JSON.parse(fs.readFileSync(BN, "utf8"));
  console.log("restore source=" + BN + " rows=" + rows.length);
  if (process.env.APPLY !== "1") { console.log("DRY. APPLY=1 to write."); return; }
  let ok = 0, err = 0;
  for (const r of rows) {
    const v = typeof r.commission === "number" ? r.commission : parseFloat(r.commission) || 0;
    const { error } = await sb.from("transaction_list").update({ mechanic_commission_amount: v }).eq("id", r.id);
    if (error) { err++; console.error("ERR " + r.id + " " + error.message); }
    else ok++;
  }
  console.log("RESTORED ok=" + ok + " err=" + err);
})();
