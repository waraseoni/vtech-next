const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

// Helper to delay (rate limiting)
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Live schema fetch (pages/backup API ke jaisa hi — OpenAPI se cols+PK) ───
async function fetchLiveSchema(supabaseUrl, supabaseKey) {
  const openapiUrl = `${supabaseUrl}/rest/v1/`;
  let raw;
  try {
    const res = await fetch(openapiUrl, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Accept: 'application/openapi+json' },
    });
    if (!res.ok) throw new Error(`OpenAPI ${res.status}`);
    raw = await res.json();
  } catch (e) {
    // Node < 18 me global fetch nahi hai
    const https = require('https');
    raw = await new Promise((resolve, reject) => {
      https.get(openapiUrl, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Accept: 'application/openapi+json' } }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode !== 200) reject(new Error(`OpenAPI ${res.statusCode}`));
          else resolve(JSON.parse(body));
        });
      }).on('error', reject);
    });
  }

  const defs = raw?.definitions || {};
  const map = {};
  for (const [name, def] of Object.entries(defs)) {
    const props = def?.properties || {};
    const cols = [];
    const pk = [];
    for (const [colName, meta] of Object.entries(props)) {
      cols.push(colName);
      if (meta?.description?.includes('<pk/>')) pk.push(colName);
    }
    map[name] = { cols, pk };
  }
  if (!Object.keys(map).length) throw new Error('Live schema parse fail — definitions nahi mile');
  return map;
}

// Page/job backup files ka v2-style normalize (price/text/date fixes) — page.tsx ke jaisa
function normalizeRow(r, genCols) {
  const out = { ...r };
  // GENERATED columns — insert nahi hota (DB auto-calculate)
  for (const c of genCols) delete out[c];
  // Negative prices — CHECK (price >= 0)
  for (const pf of ['price', 'cost_price', 'amount', 'discount']) {
    if (pf in out && typeof out[pf] === 'number' && out[pf] < 0) out[pf] = 0;
  }
  // int/null → text NOT NULL
  for (const tf of ['name', 'description', 'category', 'fault', 'item', 'remark', 'remarks', 'uniq_id', 'code', 'fullname', 'address', 'sale_code', 'firstname', 'lastname', 'contact', 'email', 'message', 'meta_value', 'hsn']) {
    if (tf in out) {
      if (out[tf] === null || out[tf] === undefined) out[tf] = '';
      else if (typeof out[tf] !== 'string') out[tf] = String(out[tf]);
    }
  }
  // MySQL zero-dates → null
  for (const key of Object.keys(out)) {
    if (typeof out[key] === 'string' && out[key].startsWith('0000-00-00')) {
      out[key] = null;
    }
  }
  return out;
}

function readEnv() {
  const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
  const env = {};
  for (const line of envFile.split('\n')) {
    const lineTrim = line.trim();
    if (!lineTrim || lineTrim.startsWith('#')) continue;
    const idx = lineTrim.indexOf('=');
    if (idx <= 0) continue;
    const key = lineTrim.slice(0, idx).trim();
    let val = lineTrim.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function confirmQuestion(q) {
  if (process.argv.includes('--yes') || process.argv.includes('--force')) return Promise.resolve(true);
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`\n⚠️  ${q} (y/N) `, (a) => {
      rl.close();
      resolve(['y', 'yes'].includes(String(a || '').toLowerCase()));
    });
  });
}

async function main() {
  console.log('========================================================');
  console.log('  Force Restore — JSON backup (vtech_backup_*.json)');
  console.log('  Service-role (RLS bypass), dynamic live-schema columns');
  console.log('========================================================');

  const env = readEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey || !supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nahi mile .env.local me');
  }

  // ── Backup file: arg ya default glob ────────────────────────────────────────
  const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  let fileArg = positional[0];
  if (!fileArg) {
    const matches = fs.readdirSync(process.cwd()).filter((f) => /^vtech_backup_.*\.json$/i.test(f));
    if (matches.length === 0) {
      throw new Error('Koi vtech_backup_*.json nahi mila. Arg se file dein: node force-restore.cjs <file.json> [tables...]');
    }
    fileArg = matches.sort().pop(); // latest wali choose karo
    console.log(`📁 File arg nahi diya — default: ${fileArg}`);
  }
  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) throw new Error(`File nahi mili: ${fileArg}`);

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // ── Target tables: arg list ya file ki poori list (v3 _meta.table_order se order) ──
  const requested = positional.slice(1);
  let tableOrder = [];
  const meta = data._meta?.[0] || {};
  if (Array.isArray(meta.table_order)) {
    tableOrder = meta.table_order.map((t) => (typeof t === 'string' ? t : t?.table)).filter(Boolean);
  } else {
    tableOrder = Object.keys(data).filter((k) => k !== '_meta');
  }
  const tables = requested.length
    ? requested.filter((t) => tableOrder.includes(t) || Array.isArray(data[t]))
    : tableOrder;
  if (!tables.length) throw new Error('Restore ke liye koi table nahi mili (file empty ya arg galat).');

  console.log(`📄 File      : ${fileArg}`);
  console.log(`🌐 Tables    : ${tables.length} (${requested.length ? 'arg-filtered' : 'file me jitna hain'})`);

  // ── Live schema (dynamic columns + PK) ──────────────────────────────────────
  console.log('🔎 Live schema fetch ho rahi hai...');
  const schema = await fetchLiveSchema(supabaseUrl, supabaseKey);
  const supabase = createClient(supabaseUrl, supabaseKey);

  const ok = await confirmQuestion(
    `LIVE database par ${tables.length} tables restore hongi (upsert = existing rows update honge). Continue?`
  );
  if (!ok) {
    console.log('❌ Cancelled.');
    process.exit(0);
  }

  // ── Restore ─────────────────────────────────────────────────────────────────
  const GENERATED = { client_payments: ['net_amount'] };
  let totalRestored = 0;

  for (const table of tables) {
    const rawRows = data[table];
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      console.log(`  - ${table}: no data, skip`);
      continue;
    }
    const live = schema[table];
    if (!live || !live.cols.length) {
      console.error(`  ✗ ${table}: live schema me nahi mili — SKIP (na restore karna hi theek)`);
      continue;
    }

    const liveCols = new Set(live.cols);
    const pk = live.pk || [];
    const genCols = GENERATED[table] || [];

    const rows = rawRows.map((row) => normalizeRow(row, genCols)).map((row) => {
      // Sirf live schema columns rakho (file me obsolete columns strip)
      Object.keys(row).forEach((k) => {
        if (!liveCols.has(k)) delete row[k];
      });
      return row;
    });

    console.log(`\n↻ ${table}: ${rows.length} rows (pk=${pk.join(',') || 'none'})`);
    const batchSize = 25;
    const onConflict = pk.length ? { onConflict: pk.join(',') } : undefined;
    let tableOk = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      let batch = rows.slice(i, i + batchSize);
      // Dedup by PK (batch me "cannot affect row a second time" se bachne ke liye)
      if (pk.length > 0 && batch.length > 1) {
        const seen = new Set();
        const deduped = [];
        for (const r of batch) {
          const missing = pk.some((c) => r[c] === null || r[c] === undefined || r[c] === '');
          const key = pk.map((c) => String(r[c])).join('\u0000');
          if (missing || seen.has(key)) continue;
          seen.add(key);
          deduped.push(r);
        }
        if (deduped.length < batch.length) {
          console.warn(`    batch ${i}: ${batch.length - deduped.length} dup skip`);
        }
        batch = deduped;
      }
      if (!batch.length) continue;

      const { error: insErr } = await supabase.from(table).upsert(batch, onConflict);
      if (insErr) {
        console.warn(`    batch ${i} error: ${insErr.message} → row-by-row...`);
        for (const row of batch) {
          await sleep(100);
          const { error: rowErr } = await supabase.from(table).upsert(row, onConflict);
          if (!rowErr) tableOk++;
          else console.error(`    row error (${JSON.stringify(row[pk[0] ?? 'id'])}): ${rowErr.message}`);
        }
      } else {
        tableOk += batch.length;
      }
      await sleep(50);
    }
    totalRestored += tableOk;
    console.log(`  ✅ ${table}: ${tableOk}/${rows.length} restored`);
  }

  console.log(`\n✅ Done! ${totalRestored.toLocaleString()} rows restored (live schema + generated-safe).`);
}

main().catch((err) => {
  console.error('\n❌ Force restore fail:', err.message || err);
  process.exit(1);
});