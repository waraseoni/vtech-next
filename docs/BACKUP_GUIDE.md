# V-Tech Backup & Restore — Full Guide

- [हिंदी गाइड](#हिंदी-गाइड) (Hindi)
- [English Guide](#english-guide)
- [Hinglish Guide](#hinglish-guide)

> Ek hi file me teen bhasha. Har section self-contained hai — jo bhasha chahiye,
> wahi padho. Commands/file names sab jagah same hain.

---

# हिंदी गाइड

## 1. पहले ये समझें (सिस्टम कैसा है)

- मुख्य डेटाबेस **Supabase (PostgreSQL)** पर है — project ref: `rklyznlrcrysdpksltxm`.
- कुल **51 tables**, लगभग **10,000+ rows** (JSON full backup ~3.4 MB).
- अगर Data में गड़बड़ हो जाए तो हमारे पास **कई fail-safe लेयर** हैं:
  1. **Full JSON backup** (डेटाबेस की पूरी कॉपी) — browser से या server/CLI से.
  2. **Cloud copy** — Supabase Storage के private bucket `backups` में ऑटो-अपलोड.
  3. **MariaDB mirror (XAMPP)** — आपके कंप्यूटर पर लाइव मिरर (fail-safe).
  4. **SQL dump** (pg_dump) — public schema का `.sql` स्नैपशॉट.
- ⚠️ **फ्री टियर सच्चाई:** Supabase के फ्री प्लान में **कोई automatic backup और PITR नहीं** होता (वो Pro/Team/Enterprise में मिलता है, PITR ~$100/महीना अलग). इसलिए **असली backup हमारा अपना है** — ऊपर वाले 4 तरीके.

### 3-2-1 नियम (बेस्ट प्रैक्टिस)
- **3** कॉपी: local `backups/` + Storage bucket + (साप्ताहिक) Google Drive/pen-drive
- **2** अलग माध्यम: Supabase cloud + आपका कंप्यूटर (MariaDB)
- **1** कॉपी ऐसी जगह जो Supabase/Ek server से बाहर हो

---

## 2. One-time Setup

1. `.env.local` में ये keys ज़रूरी हैं (पहले से हैं):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - (MariaDB के लिए) `MARIADB_HOST`, `MARIADB_PORT`, `MARIADB_USER`, `MARIADB_PASSWORD`, `MARIADB_DB`, `PHP_DIR`
2. Node.js installed हो (v18+)।
3. `node_modules` installed हो (`npm install`)।
4. `/backup` पेज तक पहुँचने के लिए **admin login** ज़रूरी है।

---

## 3. रोज़/हफ्ते का Routine (चेकलिस्ट)

| कब | काम |
|----|-----|
| रोज़ (ऑटो) | CLI/Task Scheduler से server backup + cloud copy |
| रोज़ (ऑटो) | MariaDB mirror sync (हर 15 मिनट / 12 घंटे) |
| हफ्ते में 1 बार | `backups/` से JSON डाउनलोड → Google Drive/pen-drive |
| हर 3 महीने | Restore drill — staging Supabase में टेस्ट restore |
| हर बदलाव से पहले | Risk वाला काम (migration/fix) करने से पहले fresh backup |

---

## 4. Backup कैसे लें (4 तरीके)

### तरीका A — Browser से Manual Download (सबसे आसान)
1. `/backup` पेज खोलें → **Download Full Backup (.json)** पर क्लिक।
2. फ़ाइल `vtech_backup_YYYY-MM-DDTHH-MM-SS.json` नाम से डाउनलोड होगी।
3. ऐप हर table का count verify करता है; mismatch हो तो लाल warning आएगी।
   ⚠️ इस फ़ाइल कंप्यूटर/Drive पर अलग रखें, repo में commit **न** करें।

### तरीका B — Server Backup (पेज के बटन से)
1. `/backup` पेज → **Server Backup (Scheduled)** कार्ड → **Abhi Server Backup Run Karo**.
2. ये सर्वर के `backups/` फोल्डर में फ़ाइल बनाता है **और** Supabase Storage
   `backups` bucket में cloud copy अपलोड करता है।
3. नीचे "Recent backups (server)" और "Recent cloud copies" लिस्ट दिखती है।

### तरीका C — CLI से (Scheduled के लिए सबसे उपयुक्त)
```powershell
# सिर्फ local folder में:
node scripts/supabase-json-backup.mjs

# local + cloud (Storage bucket) दोनों:
node scripts/supabase-json-backup.mjs --storage

# अलग folder में:
node scripts/supabase-json-backup.mjs --storage --dir "D:\vtech-backups"
```
- Exit code: `0` = OK · `1` = env/schema fail · `2` = INCOMPLETE (count mismatch) · `3` = cloud upload fail.

### तरीका D — SQL Dump (pg_dump) / MariaDB Mirror
```powershell
# public schema का SQL dump (psql/pg_dump installed होना चाहिए):
node scripts/supabase-dump.mjs --full

# Supabase -> MariaDB (XAMPP) live mirror:
node scripts/supabase-to-mariadb.mjs
node scripts/supabase-to-mariadb.mjs --quiet          # सिर्फ summary (scheduler के लिए)
node scripts/supabase-to-mariadb.mjs --history 50     # sync history JSON
```
> ⚠️ SQL dump में `auth.users` (login accounts) और Storage की image files **नहीं**
> आतीं — वो अलग हैं।

---

## 5. Restore कैसे करें (गंभीर — पहले backup लें!)

> 🚨 **Restore पुराना डेटा REPLACE करता है।** हमेशा पहले एक fresh backup लें।

### रास्ता A — `/backup` पेज से (JSON)
1. **पहले fresh backup लें** (तरीका A/B/C)।
2. Restore कार्ड → JSON फ़ाइल drop करें।
3. ऐप **diff + Dry Run** दिखाता है (डेटाबेस vs फ़ाइल की तुलना, कोई write नहीं).
4. Dry Run **PASS** होने पर ही confirm करें। Dry Run FAIL हो तो रुकें और warning पढ़ें।
5. Restore खुद बाद में हर table का count verify करता है (HARD fail).

### रास्ता B — CLI force-restore (psql के बिना)
```powershell
node scripts/force-restore.cjs vtech_backup_2026-09-17T08-12-48.json
node scripts/force-restore.cjs vtech_backup_2026-09-17T08-12-48.json --yes
```

### रास्ता C — SQL dump restore (psql चाहिए)
```powershell
node scripts/supabase-restore.mjs backups/supabase/dumps/backup.sql --dry-run
node scripts/supabase-restore.mjs backups/supabase/dumps/backup.sql --full
```

### रास्ता D — MariaDB Mirror से Failover (अगर Supabase टूट जाए और backup भी न हो)
1. XAMPP → phpMyAdmin → `vtech_db` → Export → **SQL** फ़ॉर्मैट डाउनलोड करें।
2. ब्राउज़र में खोलें: `/tools/vtech_mysql_converter.html`
3. `.sql` फ़ाइल drop करें → **Convert & Download JSON** (v3.0 फ़ॉर्मैट बनेगा, 46 app tables)।
4. फिर `/backup` → Restore से उस JSON को restore करें (ऊपर रास्ता A)।

---

## 6. Scheduling (ऑटोमैटिक)

### JSON backup (रोज़ रात 2 बजे)
```powershell
schtasks /Create /TN "VTech Supabase Backup" /TR "node \"D:\next tech\vtech-next-frontend\scripts\supabase-json-backup.mjs\" --storage" /SC DAILY /ST 02:00 /F
```
- PC चालू रहना चाहिए (Task Scheduler आपके कंप्यूटर पर चलता है).
- Vercel पर server-side automatic चाहिए तो `CRON_SECRET` header bypass जोड़ना पड़ेगा
  (अभी API सिर्फ admin login से चलता है).

### MariaDB mirror sync
- पहले से Task Scheduler वाली files मौजूद हैं:
  `scripts/VTechSupabaseSync.xml`, `scripts/run-sync-hidden.vbs`, `scripts/supabase-to-mariadb-sync.cmd`
- ⚠️ इनमें path `C:\next-vtech\vtech-frontend\...` लिखा है — अपनी असली डिप्लॉय
  path से बदलें, वरना सिंक नहीं चलेगा।
- Task Scheduler → **Import Task** से XML इम्पोर्ट करें।

---

## 7. Verification (ज़रूरी आदतें)

- हर backup के बाद: **count verified** मैसेज आए (लाल mismatch न हो).
- `/backup` पेज का Dry Run देखें।
- MariaDB sync: `sync_history` टेबल का latest status देखें (OK/FAIL).
- **Restore drill (हर 3 महीने):** staging Supabase प्रोजेक्ट में mirror/converter से
  restore टेस्ट करें. जो backup टेस्ट नहीं हुआ, वो backup नहीं है.

---

## 8. क्या cover नहीं होता (गैप्स)

| चीज़ | स्थिति | समाधान |
|------|--------|--------|
| `users`, `profiles`, `login_throttle`, `user_presence`, `push_subscriptions` | backup page JSON में हैं, पर converter skip करता है (auth-managed) | failover पर users दोबारा लॉगिन करें; profiles/roles अलग backup रखें |
| Storage (images/photos) | किसी DB backup में नहीं | Dashboard → Storage से manual export |
| `auth.users` (login accounts) | SQL dump में नहीं | Supabase Auth / Dashboard |
| PITR (point-in-time) | free plan में नहीं | घंटे-level recovery नहीं; रोज़ के backup पर निर्भर |

---

## 9. Troubleshooting

| समस्या | कारण | समाधान |
|--------|------|--------|
| `Supabase env missing` | `.env.local` में key नहीं | URL + service-role key जाँचें |
| `INCOMPLETE` (exit 2) | किसी table का count mismatch | दोबारा चलाएँ; बार-बार हो तो Supabase/RLS जाँचें |
| Cloud upload fail (exit 3) | Storage permission/bucket | सर्विस-role key, bucket `backups` जाँचें |
| Dry Run FAIL | PK/null मिसमैच | warning पढ़ें, फ़ाइल सही है क्या देखें; restore न करें |
| MariaDB sync नहीं चल रहा | galat path / XAMPP बंद | path ठीक करें, XAMPP (Apache/MySQL) चालू करें |
| Converter में table missing | नया table बना | converter v5+ अपडेट चाहिए |

---

## 10. Quick Reference

| काम | Command / जगह |
|-----|--------------|
| Manual backup | `/backup` → Download |
| Server backup + cloud | `/backup` → Server Backup कार्ड |
| CLI backup | `node scripts/supabase-json-backup.mjs --storage` |
| CLI restore | `node scripts/force-restore.cjs <file> --yes` |
| SQL dump | `node scripts/supabase-dump.mjs --full` |
| MariaDB mirror | `node scripts/supabase-to-mariadb.mjs` |
| MariaDB failover converter | `/tools/vtech_mysql_converter.html` |
| Backup download करें | `/backup` → Server Backup कार्ड → file के आगे download icon (local + cloud दोनों, admin-only) |
| Cloud copies देखें | `/backup` → Server Backup कार्ड → "Recent cloud copies" (या Dashboard → Storage → `backups`) |
| Backup delete करें | `/backup` → Server Backup कार्ड → file के आगे trash icon (local + cloud दोनों, admin-only) |
| Backup plan doc | `docs/plans/backup_tooling_fix_plan.md` |

> **कभी भी** backup JSON को git में commit न करें — `.gitignore` में `backups/` और
> `vtech_backup_*.json` पहले से शामिल हैं।

---

# English Guide

## 1. Understand the System

- Primary database: **Supabase (PostgreSQL)** — project ref `rklyznlrcrysdpksltxm`.
- **51 tables**, ~**10,000+ rows** (full JSON backup ~3.4 MB).
- Multiple **fail-safe layers**:
  1. **Full JSON backup** (entire database) — via browser, server, or CLI.
  2. **Cloud copy** — auto-uploaded to a private Supabase Storage bucket `backups`.
  3. **MariaDB mirror (XAMPP)** — a live local mirror as a fallback.
  4. **SQL dump** (pg_dump) — a `.sql` snapshot of the public schema.
- ⚠️ **Free-tier reality:** the free Supabase plan has **no automatic backups and no PITR**
  (those are Pro/Team/Enterprise; PITR is ~$100/month add-on). So **the real backup is our own** — the four methods above.

### The 3-2-1 rule (best practice)
- **3** copies: local `backups/` + Storage bucket + (weekly) Google Drive/USB
- **2** different media: Supabase cloud + your own machine (MariaDB)
- **1** copy outside the Supabase/one-server boundary

---

## 2. One-time Setup

1. Required keys in `.env.local` (already present):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - (for MariaDB) `MARIADB_HOST`, `MARIADB_PORT`, `MARIADB_USER`, `MARIADB_PASSWORD`, `MARIADB_DB`, `PHP_DIR`
2. Node.js installed (v18+).
3. `node_modules` installed (`npm install`).
4. **Admin login** required to access the `/backup` page.

---

## 3. Daily / Weekly Routine (checklist)

| When | Task |
|------|------|
| Daily (auto) | CLI/Task Scheduler server backup + cloud copy |
| Daily (auto) | MariaDB mirror sync (every 15 min / 12 h) |
| Once a week | Download a JSON from `backups/` → Google Drive/USB |
| Every 3 months | Restore drill into a staging Supabase project |
| Before any change | Take a fresh backup before risky work (migration/fix) |

---

## 4. How to Take a Backup (4 methods)

### Method A — Manual download from the browser (easiest)
1. Open `/backup` → click **Download Full Backup (.json)**.
2. File downloads as `vtech_backup_YYYY-MM-DDTHH-MM-SS.json`.
3. The app verifies every table's count; a red warning appears on mismatch.
   ⚠️ Keep this file on your PC/Drive — **never** commit it to the repo.

### Method B — Server Backup (page button)
1. `/backup` → **Server Backup (Scheduled)** card → **Abhi Server Backup Run Karo**.
2. Writes a file into the server's `backups/` folder **and** uploads a cloud copy to
   the Supabase Storage `backups` bucket.
3. "Recent backups (server)" and "Recent cloud copies" lists appear below.

### Method C — From the CLI (best for scheduling)
```powershell
# Local folder only:
node scripts/supabase-json-backup.mjs

# Local + cloud (Storage bucket):
node scripts/supabase-json-backup.mjs --storage

# Custom folder:
node scripts/supabase-json-backup.mjs --storage --dir "D:\vtech-backups"
```
- Exit codes: `0` = OK · `1` = env/schema fail · `2` = INCOMPLETE (count mismatch) · `3` = cloud upload fail.

### Method D — SQL dump (pg_dump) / MariaDB mirror
```powershell
# SQL dump of public schema (requires psql/pg_dump):
node scripts/supabase-dump.mjs --full

# Supabase -> MariaDB (XAMPP) live mirror:
node scripts/supabase-to-mariadb.mjs
node scripts/supabase-to-mariadb.mjs --quiet          # summary only (for scheduler)
node scripts/supabase-to-mariadb.mjs --history 50     # sync history JSON
```
> ⚠️ The SQL dump does **not** include `auth.users` (login accounts) or Storage
> image files — those are separate.

---

## 5. How to Restore (serious — take a backup first!)

> 🚨 **Restore REPLACES existing data.** Always take a fresh backup first.

### Route A — From the `/backup` page (JSON)
1. **Take a fresh backup first** (method A/B/C).
2. Restore card → drop the JSON file.
3. The app shows a **diff + Dry Run** (DB vs file comparison, zero writes).
4. Confirm only if Dry Run **PASSES**. If it FAILS, stop and read the warning.
5. Restore itself verifies every table's count afterwards (HARD fail).

### Route B — CLI force-restore (no psql needed)
```powershell
node scripts/force-restore.cjs vtech_backup_2026-09-17T08-12-48.json
node scripts/force-restore.cjs vtech_backup_2026-09-17T08-12-48.json --yes
```

### Route C — SQL dump restore (needs psql)
```powershell
node scripts/supabase-restore.mjs backups/supabase/dumps/backup.sql --dry-run
node scripts/supabase-restore.mjs backups/supabase/dumps/backup.sql --full
```

### Route D — Failover from the MariaDB mirror (if Supabase breaks AND no backup exists)
1. XAMPP → phpMyAdmin → `vtech_db` → Export → **SQL** format, download.
2. Open in a browser: `/tools/vtech_mysql_converter.html`
3. Drop the `.sql` file → **Convert & Download JSON** (v3.0 format, 46 app tables).
4. Then restore that JSON via `/backup` → Restore (Route A above).

---

## 6. Scheduling (automatic)

### JSON backup (daily at 2 AM)
```powershell
schtasks /Create /TN "VTech Supabase Backup" /TR "node \"D:\next tech\vtech-next-frontend\scripts\supabase-json-backup.mjs\" --storage" /SC DAILY /ST 02:00 /F
```
- Your PC must be powered on (Task Scheduler runs on your machine).
- For Vercel-side automation you'd need a `CRON_SECRET` header bypass
  (the API currently only accepts admin login).

### MariaDB mirror sync
- Existing Task Scheduler files:
  `scripts/VTechSupabaseSync.xml`, `scripts/run-sync-hidden.vbs`, `scripts/supabase-to-mariadb-sync.cmd`
- ⚠️ They hard-code the path `C:\next-vtech\vtech-frontend\...` — update it to your
  actual deploy path or the sync will not run.
- Import the XML via Task Scheduler → **Import Task**.

---

## 7. Verification (essential habits)

- After every backup: ensure you see **count verified** (no red mismatch).
- Review the Dry Run on the `/backup` page.
- MariaDB sync: check the latest status in the `sync_history` table (OK/FAIL).
- **Restore drill (every 3 months):** test restoring from the mirror/converter into a
  staging Supabase project. A backup that was never tested is not a backup.

---

## 8. What Is Not Covered (gaps)

| Item | Status | Solution |
|------|--------|----------|
| `users`, `profiles`, `login_throttle`, `user_presence`, `push_subscriptions` | present in backup JSON, converter skips them (auth-managed) | users just re-login on failover; keep a separate profiles/roles backup |
| Storage (images/photos) | not in any DB backup | manual export from Dashboard → Storage |
| `auth.users` (login accounts) | not in SQL dump | Supabase Auth / Dashboard |
| PITR (point-in-time) | not on free plan | no hour-level recovery; rely on daily backups |

---

## 9. Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `Supabase env missing` | keys absent in `.env.local` | check URL + service-role key |
| `INCOMPLETE` (exit 2) | a table's count mismatched | re-run; if repeated, check Supabase/RLS |
| Cloud upload fail (exit 3) | Storage permission/bucket | verify service-role key and `backups` bucket |
| Dry Run FAIL | PK/null mismatch | read warning, verify the file; do not restore |
| MariaDB sync not running | wrong path / XAMPP off | fix path, start XAMPP (Apache/MySQL) |
| Table missing in converter | new table added | update converter (v5+) |

---

## 10. Quick Reference

| Task | Command / Location |
|------|--------------------|
| Manual backup | `/backup` → Download |
| Server backup + cloud | `/backup` → Server Backup card |
| CLI backup | `node scripts/supabase-json-backup.mjs --storage` |
| CLI restore | `node scripts/force-restore.cjs <file> --yes` |
| SQL dump | `node scripts/supabase-dump.mjs --full` |
| MariaDB mirror | `node scripts/supabase-to-mariadb.mjs` |
| MariaDB failover converter | `/tools/vtech_mysql_converter.html` |
| Download a backup | `/backup` → Server Backup card → download icon next to the file (local + cloud, admin-only) |
| View cloud copies | `/backup` → Server Backup card → "Recent cloud copies" (or Dashboard → Storage → `backups`) |
| Delete a backup | `/backup` → Server Backup card → trash icon next to the file (local + cloud, admin-only) |
| Backup plan doc | `docs/plans/backup_tooling_fix_plan.md` |

> **Never** commit backup JSON to git — `.gitignore` already includes `backups/`
> and `vtech_backup_*.json`.

---

# Hinglish Guide

## 1. Pehle System Samjho

- Main database: **Supabase (PostgreSQL)** — project ref `rklyznlrcrysdpksltxm`.
- Total **51 tables**, lagbhag **10,000+ rows** (full JSON backup ~3.4 MB).
- Hamare paas kai **fail-safe layers** hain:
  1. **Full JSON backup** (pura database) — browser, server ya CLI se.
  2. **Cloud copy** — Supabase Storage ke private bucket `backups` me auto-upload.
  3. **MariaDB mirror (XAMPP)** — computer par ek live mirror (fallback).
  4. **SQL dump** (pg_dump) — public schema ka `.sql` snapshot.
- ⚠️ **Free tier reality:** free plan me **koi automatic backup / PITR nahi** hai
  (wo Pro/Team/Enterprise me; PITR ~$100/month add-on). Matlab **asli backup hamara apna** hai — upar wale 4 tareeke.

### 3-2-1 rule (best practice)
- **3** copies: local `backups/` + Storage bucket + (weekly) Google Drive/pen-drive
- **2** alag media: Supabase cloud + apna computer (MariaDB)
- **1** copy jo Supabase/ek server se bahar ho

---

## 2. One-time Setup

1. `.env.local` me ye keys zaroori hain (already hain):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - (MariaDB ke liye) `MARIADB_HOST`, `MARIADB_PORT`, `MARIADB_USER`, `MARIADB_PASSWORD`, `MARIADB_DB`, `PHP_DIR`
2. Node.js installed (v18+).
3. `node_modules` installed (`npm install`).
4. `/backup` page kholne ke liye **admin login** chahiye.

---

## 3. Roz/Hafte ka Routine (checklist)

| Kab | Kaam |
|-----|------|
| Roz (auto) | CLI/Task Scheduler se server backup + cloud copy |
| Roz (auto) | MariaDB mirror sync (har 15 min / 12 ghante) |
| Hafte me 1 baar | `backups/` se ek JSON download → Google Drive/pen-drive |
| Har 3 mahine | Restore drill — staging Supabase me test restore |
| Kisi badlav se pehle | Risk wala kaam (migration/fix) se pehle fresh backup |

---

## 4. Backup Kaise Le (4 tareeke)

### Tareeka A — Browser se Manual Download (sabse aasan)
1. `/backup` page kholo → **Download Full Backup (.json)** click karo.
2. File `vtech_backup_YYYY-MM-DDTHH-MM-SS.json` naam se download hogi.
3. App har table ka count verify karta hai; mismatch par red warning aayegi.
   ⚠️ Ye file PC/Drive par alag rakho — repo me commit **mat** karo.

### Tareeka B — Server Backup (page button)
1. `/backup` → **Server Backup (Scheduled)** card → **Abhi Server Backup Run Karo**.
2. Ye server ke `backups/` folder me file banata hai **aur** Supabase Storage
   `backups` bucket me cloud copy upload karta hai.
3. Neeche "Recent backups (server)" aur "Recent cloud copies" dikhti hain.

### Tareeka C — CLI se (scheduling ke liye best)
```powershell
# Local folder me:
node scripts/supabase-json-backup.mjs

# Local + cloud (Storage bucket) dono:
node scripts/supabase-json-backup.mjs --storage

# Alag folder:
node scripts/supabase-json-backup.mjs --storage --dir "D:\vtech-backups"
```
- Exit code: `0` = OK · `1` = env/schema fail · `2` = INCOMPLETE (count mismatch) · `3` = cloud upload fail.

### Tareeka D — SQL Dump (pg_dump) / MariaDB Mirror
```powershell
# public schema ka SQL dump (psql/pg_dump chahiye):
node scripts/supabase-dump.mjs --full

# Supabase -> MariaDB (XAMPP) live mirror:
node scripts/supabase-to-mariadb.mjs
node scripts/supabase-to-mariadb.mjs --quiet          # sirf summary (scheduler ke liye)
node scripts/supabase-to-mariadb.mjs --history 50     # sync history JSON
```
> ⚠️ SQL dump me `auth.users` (login accounts) aur Storage ki images **nahi**
> aati — wo alag hain.

---

## 5. Restore Kaise Kare (serious — pehle backup lo!)

> 🚨 **Restore purana data REPLACE karta hai.** Hamesha pehle fresh backup lo.

### Raasta A — `/backup` page se (JSON)
1. **Pehle fresh backup lo** (tareeka A/B/C).
2. Restore card → JSON file drop karo.
3. App **diff + Dry Run** dikhata hai (DB vs file comparison, koi write nahi).
4. Dry Run **PASS** ho tab hi confirm karo. FAIL ho to ruko aur warning padho.
5. Restore khud baad me har table ka count verify karta hai (HARD fail).

### Raasta B — CLI force-restore (psql ke bina)
```powershell
node scripts/force-restore.cjs vtech_backup_2026-09-17T08-12-48.json
node scripts/force-restore.cjs vtech_backup_2026-09-17T08-12-48.json --yes
```

### Raasta C — SQL dump restore (psql chahiye)
```powershell
node scripts/supabase-restore.mjs backups/supabase/dumps/backup.sql --dry-run
node scripts/supabase-restore.mjs backups/supabase/dumps/backup.sql --full
```

### Raasta D — MariaDB Mirror se Failover (Supabase toot gaya aur backup bhi nahi)
1. XAMPP → phpMyAdmin → `vtech_db` → Export → **SQL** format download karo.
2. Browser me kholo: `/tools/vtech_mysql_converter.html`
3. `.sql` file drop karo → **Convert & Download JSON** (v3.0 format, 46 app tables).
4. Phir `/backup` → Restore se wo JSON restore karo (upar Raasta A).

---

## 6. Scheduling (automatic)

### JSON backup (roz raat 2 baje)
```powershell
schtasks /Create /TN "VTech Supabase Backup" /TR "node \"D:\next tech\vtech-next-frontend\scripts\supabase-json-backup.mjs\" --storage" /SC DAILY /ST 02:00 /F
```
- PC chalu rehna chahiye (Task Scheduler aapke computer par chalta hai).
- Vercel par automatic chahiye to `CRON_SECRET` header bypass jodna padega
  (abhi API sirf admin login se chalta hai).

### MariaDB mirror sync
- Pehle se Task Scheduler files maujood hain:
  `scripts/VTechSupabaseSync.xml`, `scripts/run-sync-hidden.vbs`, `scripts/supabase-to-mariadb-sync.cmd`
- ⚠️ Inme path `C:\next-vtech\vtech-frontend\...` likha hai — apni asli deploy path
  se badlo, warna sync nahi chalega.
- Task Scheduler → **Import Task** se XML import karo.

---

## 7. Verification (zaroori aadatein)

- Har backup ke baad: **count verified** message aaye (red mismatch na ho).
- `/backup` page ka Dry Run dekho.
- MariaDB sync: `sync_history` table ka latest status dekho (OK/FAIL).
- **Restore drill (har 3 mahine):** staging Supabase project me mirror/converter se
  restore test karo. Jo backup test nahi hua, wo backup nahi hai.

---

## 8. Kya Cover Nahi Hota (gaps)

| Cheez | Status | Solution |
|-------|--------|----------|
| `users`, `profiles`, `login_throttle`, `user_presence`, `push_subscriptions` | backup JSON me hain, par converter skip karta hai (auth-managed) | failover par users dobara login karenge; profiles/roles ka alag backup rakho |
| Storage (images/photos) | kisi DB backup me nahi | Dashboard → Storage se manual export |
| `auth.users` (login accounts) | SQL dump me nahi | Supabase Auth / Dashboard |
| PITR (point-in-time) | free plan me nahi | hour-level recovery nahi; roz ke backup par nirbhar |

---

## 9. Troubleshooting

| Problem | Kaaran | Fix |
|---------|--------|-----|
| `Supabase env missing` | `.env.local` me key nahi | URL + service-role key check karo |
| `INCOMPLETE` (exit 2) | kisi table ka count mismatch | dobara chalao; baar-baar ho to Supabase/RLS check karo |
| Cloud upload fail (exit 3) | Storage permission/bucket | service-role key aur `backups` bucket check karo |
| Dry Run FAIL | PK/null mismatch | warning padho, file sahi hai kya dekho; restore mat karo |
| MariaDB sync nahi chal raha | galat path / XAMPP band | path theek karo, XAMPP (Apache/MySQL) chalu karo |
| Converter me table missing | naya table bana | converter update karo (v5+) |

---

## 10. Quick Reference

| Kaam | Command / Jagah |
|------|-----------------|
| Manual backup | `/backup` → Download |
| Server backup + cloud | `/backup` → Server Backup card |
| CLI backup | `node scripts/supabase-json-backup.mjs --storage` |
| CLI restore | `node scripts/force-restore.cjs <file> --yes` |
| SQL dump | `node scripts/supabase-dump.mjs --full` |
| MariaDB mirror | `node scripts/supabase-to-mariadb.mjs` |
| MariaDB failover converter | `/tools/vtech_mysql_converter.html` |
| Backup download karna | `/backup` → Server Backup card → file ke aage download icon (local + cloud dono, admin-only) |
| Cloud copies dekhna | `/backup` → Server Backup card → "Recent cloud copies" (ya Dashboard → Storage → `backups`) |
| Backup delete karna | `/backup` → Server Backup card → file ke aage trash icon (local + cloud dono, admin-only) |
| Backup plan doc | `docs/plans/backup_tooling_fix_plan.md` |

> **Kabhi bhi** backup JSON ko git me commit mat karo — `.gitignore` me `backups/`
> aur `vtech_backup_*.json` pehle se shaamil hain.
