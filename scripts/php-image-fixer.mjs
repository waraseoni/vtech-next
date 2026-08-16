import fs from "node:fs";
import path from "node:path";

// ============================================================================
// php-image-fixer.mjs
//
// MariaDB (vtech_db) ka data PHP app (vtech-rsms) ke liye ready karta hai:
//   • Supabase storage URLs → PHP ke uploads folder me download + DB path ko
//     local (uploads/...) me badal deta hai.
//   • system_info.logo / cover (jo Supabase me base64 data-URI hain) → decode
//     karke uploads me save karta hai + path set karta hai.
//   • transaction_images ke missing local files → Supabase job-images bucket se
//     try karta hai.
//
// PHP ki validate_image() sirf LOCAL file check karti hai (is_file), isliye
// remote URL ya base64 value PHP me nahi dikhti. Isliye ye fix zaroori hai.
//
// CLI:  node scripts/php-image-fixer.mjs --php-dir "C:\xampp\htdocs\vtech-rsms"
//       (supabase ke creds .env.local se aate hain)
//
// Module: import { fixPhpImages } from "./php-image-fixer.mjs"
// ============================================================================

// Supabase storage bucket → PHP uploads folder mapping.
// (PHP me har folder relative path ke roop me "uploads/<folder>/" dikhta hai)
const IMAGE_MAP = [
  { table: "client_list",           column: "image_path",   folder: "clients",        bucket: "client-photos" },
  { table: "product_list",          column: "image_path",   folder: "products",       bucket: "product-images" },
  { table: "mechanic_list",         column: "image_path",   folder: "mechanic-photos", bucket: "mechanic-photos" },
  { table: "profiles",              column: "avatar_url",   folder: "avatars",        bucket: "user-avatars" },
  { table: "transaction_images",    column: "image_path",   folder: "transactions",   bucket: "job-images" },
];

const META_IMAGES = ["logo", "cover"];

function supabaseMetaValue(url, key, field) {
  const u = new URL(url + `/rest/v1/system_info?meta_field=eq.${field}&select=meta_value`);
  return fetch(u, { headers: { apikey: key, Authorization: `Bearer ${key}` } }).then((r) =>
    r.ok ? r.json() : Promise.reject(new Error(`system_info fetch failed (${r.status})`))
  );
}

async function download(url, destPath) {
  const dir = path.dirname(destPath);
  fs.mkdirSync(dir, { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status}) ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  return buf.length;
}

function storageUrl(base, bucket, name) {
  return `${base}/storage/v1/object/public/${bucket}/${encodeURIComponent(name)}`;
}

// Ek data-URI (data:image/...;base64,XXXX) ko file me save karke local path return karta hai.
function saveDataUri(value, destPath) {
  const m = /^data:([^;,]+)?;base64,(.*)$/s.exec(value);
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  if (buf.length < 50) return null; // kuch galat/truncated hai — save na karo
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
  return destPath;
}

function relTo(destPath, uploadsDir) {
  // "C:\...\uploads\products\1.png" → "uploads/products/1.png"
  return path
    .relative(path.dirname(uploadsDir), destPath)
    .split(path.sep)
    .join("/");
}

/**
 * MariaDB connection ke saath chalega (sync script isi ko call karega).
 * `phpDir` = PHP app ka folder (jaise C:\xampp\htdocs\vtech-rsms).
 * Return: report object.
 */
export async function fixPhpImages(conn, { phpDir, supabaseUrl, supabaseKey }) {
  const report = { logo: null, cover: null, downloaded: [], missing: [], skipped: 0 };
  const uploadsDir = path.join(phpDir, "uploads");

  // ── 1) system_info logo / cover ──────────────────────────────────────────
  for (const field of META_IMAGES) {
    const ext = field === "cover" ? "jpg" : "png";
    const dest = path.join(uploadsDir, `${field}.${ext}`);
    const rel = relTo(dest, uploadsDir);
    try {
      const rows = await supabaseMetaValue(supabaseUrl, supabaseKey, field);
      const val = rows?.[0]?.meta_value || "";
      let saved = null;
      if (/^data:image/.test(val)) {
        saved = saveDataUri(val, dest);
        if (saved) {
          await conn.query(`UPDATE system_info SET meta_value = ? WHERE meta_field = ?`, [rel, field]);
          report[field] = rel;
        } else if (fs.existsSync(dest)) {
          // base64 corrupt/truncated hai to purana downloaded file hi rakho
          await conn.query(`UPDATE system_info SET meta_value = ? WHERE meta_field = ?`, [rel, field]);
          report[field] = rel + " (existing)";
        } else {
          report[field] = "decode-failed";
        }
      } else if (val && val.startsWith("uploads/")) {
        report[field] = "already-ok";
      } else {
        report[field] = "unrecognized";
      }
    } catch (e) {
      // Supabase nahi mila → local uploads file se fallback path set karo
      if (fs.existsSync(dest)) {
        await conn.query(`UPDATE system_info SET meta_value = ? WHERE meta_field = ?`, [rel, field]);
        report[field] = rel + " (fallback)";
      } else {
        report[field] = `error: ${e.message}`;
      }
    }
  }

  // ── 2) Table image columns ───────────────────────────────────────────────
  for (const { table, column, folder, bucket } of IMAGE_MAP) {
    const rows = await conn.query(
      `SELECT id, ${column} AS val FROM \`${table}\` WHERE ${column} IS NOT NULL AND ${column} != ''`
    );
    for (const row of rows) {
      const val = String(row.val);
      const plain = val.split("?")[0];

      // (a) Remote Supabase URL → download + path rewrite
      if (/^https?:\/\//i.test(val)) {
        const name = decodeURIComponent(plain.split("/").pop() || "");
        if (!name) { report.skipped++; continue; }
        const rel = `uploads/${folder}/${name}`;
        const dest = path.join(phpDir, rel.split("/").join(path.sep));
        try {
          if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
            const n = await download(plain, dest);
            report.downloaded.push(`${table}.${row.id} (${n}B)`);
          } else {
            report.skipped++;
          }
          await conn.query(`UPDATE \`${table}\` SET ${column} = ? WHERE id = ?`, [rel, row.id]);
        } catch (e) {
          report.missing.push(`${table}.${row.id} (${e.message})`);
        }
        continue;
      }

      // (b) Data URI (agar koi image column me ho)
      if (val.startsWith("data:")) {
        const ext = /data:image\/(\w+)/.exec(val)?.[1] || "png";
        const name = `row_${row.id}.${ext}`;
        const dest = path.join(uploadsDir, folder, name);
        const rel = `uploads/${folder}/${name}`;
        const saved = saveDataUri(val, dest);
        if (saved) {
          await conn.query(`UPDATE \`${table}\` SET ${column} = ? WHERE id = ?`, [rel, row.id]);
          report.downloaded.push(`${table}.${row.id} (data-uri)`);
        } else {
          report.missing.push(`${table}.${row.id} (bad data-uri)`);
        }
        continue;
      }

      // (c) Local path hai par file missing → job-images bucket se try karo
      if (/^uploads\//.test(val)) {
        const dest = path.join(phpDir, plain.split("/").join(path.sep));
        if (fs.existsSync(dest) && fs.statSync(dest).size > 0) continue; // sahi hai
        // transaction_images: filename se transaction_id nikal ke bucket check karo
        const m = /^uploads\/transactions\/job_(\d+)_/.exec(val);
        if (m && bucket === "job-images") {
          try {
            const listUrl = `${supabaseUrl}/storage/v1/object/list/${bucket}`;
            const res = await fetch(listUrl, {
              method: "POST",
              headers: {
                authorization: `Bearer ${supabaseKey}`,
                apikey: supabaseKey,
                "content-type": "application/json",
              },
              body: JSON.stringify({ prefix: "", limit: 1000 }),
            });
            const files = res.ok ? await res.json() : [];
            const match = files.find((f) => f.name === path.basename(plain));
            if (match) {
              await download(storageUrl(supabaseUrl, bucket, match.name), dest);
              report.downloaded.push(`${table}.${row.id} (restored ${match.name})`);
            } else {
              report.missing.push(`${table}.${row.id} (${val})`);
            }
          } catch {
            report.missing.push(`${table}.${row.id} (${val})`);
          }
        } else {
          report.missing.push(`${table}.${row.id} (${val})`);
        }
      }
    }
  }

  return report;
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isMain) {
  const fs2 = await import("node:fs");
  const path2 = await import("node:path");
  const __dirname2 = path2.dirname(new URL(import.meta.url).pathname);
  const root2 = path2.resolve(__dirname2, "..");

  const phpDirArg = process.argv.indexOf("--php-dir");
  const phpDir = phpDirArg !== -1 ? process.argv[phpDirArg + 1] : process.env.PHP_DIR;
  if (!phpDir) {
    console.error("ERROR: --php-dir <path> de do (PHP app folder).");
    process.exit(1);
  }
  if (!fs2.existsSync(phpDir)) {
    console.error(`ERROR: PHP folder nahi mila: ${phpDir}`);
    process.exit(1);
  }

  // .env.local se creds
  function loadEnv(file) {
    if (!fs2.existsSync(file)) return {};
    const out = {};
    for (const line of fs2.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || line.trimStart().startsWith("#")) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[m[1]] = v;
    }
    return out;
  }
  const env = { ...loadEnv(path2.join(root2, ".env.local")), ...process.env };
  const { default: mariadb } = await import("mariadb");

  const conn = await mariadb.createConnection({
    host: env.MARIADB_HOST || "127.0.0.1",
    port: Number(env.MARIADB_PORT || 3306),
    user: env.MARIADB_USER || "root",
    password: env.MARIADB_PASSWORD || "",
    database: env.MARIADB_DB || "vtech_db",
  });

  try {
    const report = await fixPhpImages(conn, {
      phpDir,
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY,
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await conn.end();
  }
}
