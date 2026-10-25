# Offline / Localhost (No Internet) — Scan Report + Options + Master Plan

> Date: 2026-10-26
> Status: **PLAN ONLY — koi code change apply nahi kiya**
> Repo: `vtech-next-frontend` v1.68.3 (Next.js 16.4.3, React 19.3.1, Node 24.13.0)
> Supersedes / consolidates:
> - `docs/plans/offline_local_supabase_sync_plan.md` (2026-09-05, strategy)
> - `docs/plans/local_supabase_docker_setup_plan.md` (2026-09-17, execution)

---

## 0. TL;DR — 2 minute verdict

1. **App ka UI + saare modules offline chal sakte hain**, lekin data layer 100% Supabase
   par hai (Postgres + Auth + Storage + Realtime + PostgREST). Isliye "bina net" ka
   matlab hai: **usee machine par Supabase ka local stack chalana + Next.js server chalana**.
2. Sabse safe raasta: **Supabase CLI + Docker** (zero app-code change, 100% schema
   parity) + ek baar cloud se data clone. Iske baad internet ki zaroorat nahi.
3. Is machine par abhi **Docker nahi hai, WSL nahi hai, aur BIOS me virtualization
   (VT-x/AMD-V) OFF hai**. Docker ke liye virtualization ON karna padega — ye
   **Decision Gate #1** hai.
4. 4 asli blockers mile (sab ka fix documented hai):
   - **License gate** — fresh local DB me license row na ho to poora app block ho jata hai.
   - **Storage image URLs** — DB me cloud ke absolute URLs hote hain; offline toot jate hain.
   - **QR external API** — 3 print routes + 1 page `api.qrserver.com` use karte hain.
   - **Email OTP** — client portal login email par depend karta hai.
5. Next.js 16 ka naya breaking change bhi mila: **local/private IP images default
   blocked** hain. Local Supabase storage images ke liye `dangerouslyAllowLocalIP: true`
   chahiye.
6. Realistic effort (pehli baar): **1-2 din**. Uske baad daily start routine **2-3 minute**.
7. **Android device-only offline (bina kisi server ke)** is architecture me possible
   nahi — wo alag 4-8 hafte ka offline-first rewrite hai (L3, neeche).

---

## 1. Scan — project aaj kaise chalta hai

### 1.1 Stack

| Area | Technology | Offline impact |
|---|---|---|
| Framework | Next.js 16 App Router (Turbopack, React Compiler) | Server chahiye (static export possible nahi) |
| DB/Auth/Storage/Realtime | Supabase (Postgres + GoTrue + Storage API + Realtime + PostgREST) | **Hard dependency** |
| Styling | Tailwind CSS v4 | Local |
| PWA | Serwist service worker | Local (network-only HTML/API) |
| Android | Capacitor (WebView) | `server.url` cloud par hardcoded |
| AI | Gemini + Groq | Internet-only |
| Push | VAPID (web) + FCM (native) | Internet-only |
| Monitoring | Sentry | DSN na ho to no-op |
| Charts / icons / QR | Recharts, lucide-react, `qrcode` | Local |

### 1.2 Codebase numbers (scan)

| Cheez | Count |
|---|---|
| `src` TS/TSX files | 462 |
| Pages (`page.tsx`) | 120 |
| API routes (`route.ts`) | 91 |
| Supabase `.from()` call sites | ~1,363 |
| `.rpc()` call sites | 24 |
| `storage.from()` call sites | 33 |
| Realtime `.channel()` call sites | 4 |
| Migrations | 57 |
| Full-schema file | 1 (55 tables, 55 RLS, 75 policies, 27 functions, 15 triggers) |
| Storage buckets | 8 (+`signatures` missing from migrations, +`backups` runtime) |
| Rows (cloud backup ke hisaab se) | ~10,000+ |

### 1.3 Current environment (is machine par scan)

| Cheez | Status |
|---|---|
| OS | Windows 10 Enterprise N 19045 |
| RAM / CPU | 7.9 GB / 4 logical cores |
| Disk free | 64.3 GB |
| Node / npm | v24.13.0 / bundled |
| Next.js | 16.4.3 |
| Docker Desktop | **Not installed** |
| WSL2 | **Not installed** |
| Virtualization (firmware) | **False (BIOS me OFF)** |
| Supabase CLI | Not installed locally |
| `supabase/config.toml` | Missing |
| `supabase/seed.sql` | Missing |
| `backups/` | Empty |
| `.env.local` | Sirf 5 vars (Supabase URL/anon/service, Gemini, Groq) |
| Uncommitted work | `package.json` modified, `src/lib/validation/` untracked — **touch nahi karna** |

---

## 2. External dependencies = offline blockers

Severity: **BLOCKER** = app hi nahi chalega; **HIGH** = core feature tootega;
**MEDIUM** = workaround chahiye; **LOW** = non-core; **NONE** = already safe.

| # | Cheez | Kahan | Offline behaviour | Severity | Fix |
|---|---|---|---|---|---|
| 1 | Supabase cloud (DB/Auth/Storage/Realtime) | `src/lib/supabase.ts:11`, `src/lib/api-auth.ts:8`, `src/lib/admin-supabase.ts:11`, `src/proxy.ts:48` | App useless | **BLOCKER** | Local Supabase stack |
| 2 | Central license service | `src/lib/license.ts`, `src/app/api/license/status/route.ts` | `valid:false` => full-screen LicenseGate | **BLOCKER** | Seed license row / `OFFLINE_MODE` |
| 3 | Images DB me absolute cloud URLs | `image_path`, `photo_url`, `avatar_url`, `media_url`, `logo`, `signature` columns | Broken images (optimizer 400/500) | **HIGH** | URL rewrite + `next.config` |
| 4 | Next 16 local-IP image block | `next.config.ts:43` | `127.0.0.1` images blocked | **HIGH** | `images.dangerouslyAllowLocalIP` |
| 5 | QR via `api.qrserver.com` | 3 print routes + `inventory/locations/page.tsx:337` | QR blank | **MEDIUM** | Local `qrcode` package |
| 6 | Gemini / Groq AI | `src/lib/gemini.ts`, `src/lib/groq.ts`, `src/app/api/chat/route.ts` | 503 / timeout | **LOW** | Friendly offline message |
| 7 | Web push (VAPID) + FCM | `src/lib/push.ts`, `src/app/useAppBoot.ts:244-262`, `src/app/api/push/send` | Subscribe fail | **LOW** | Skip prompt offline |
| 8 | Email OTP (client portal) | `src/app/(public)/login/page.tsx:271` | Email nahi jayega | **MEDIUM** | Local Inbucket / password login |
| 9 | Capacitor prod URL | `capacitor.config.ts:6` | Android app internet maangega | **HIGH** (mobile) | Env-driven LAN URL |
| 10 | LAN HTTP: secure cookies / camera / GPS / passkeys | `src/app/api/auth/login/route.ts:89,164,351`, `src/lib/cameraSupport.ts` | Login/camera issues on LAN | **MEDIUM** | LAN HTTPS (Caddy/mkcert) |
| 11 | Sentry | `sentry.*.config.ts` | DSN absent => no-op | **NONE** | Keep unset |
| 12 | Vercel API (seller/dev portals) | `src/lib/vercel-push.ts` | Portals fail | **NONE** (shop use nahi karta) | Ignore / hide |
| 13 | Firebase Admin | `src/app/api/push/send` | No-op | **NONE** | Keep unset |
| 14 | WhatsApp / Google Maps links | `wa.me`, `google.com/maps` | Click par internet chahiye | **NONE** | Text copy/print works |
| 15 | `signatures` storage bucket | `src/app/api/settings/signature/route.ts:47` | Signature upload fail (fresh DB) | **HIGH** | Seed bucket |
| 16 | `npm install` / Docker images | setup | Cold cache par internet chahiye | **MEDIUM** | One-time warm cache / image save |
| 17 | Fonts | — | Koi `next/font/google` nahi | **NONE** | — |
| 18 | Service worker | `src/app/sw.ts` | HTML/API network-only, static cached | **NONE** | — |
| 19 | `robots.ts` / `sitemap.ts` default URL | `src/app/*` | SEO only | **NONE** | Set `NEXT_PUBLIC_SITE_URL` |
| 20 | `next start` build-time inlining | `NEXT_PUBLIC_*` | Env build ke waqt fix hota hai | **MEDIUM** | Env-specific build |

---

## 3. "Offline" ke 3 level — pehle ye decide karo

| Level | Matlab | Kaun use karega | Effort | Recommendation |
|---|---|---|---|---|
| **L1 — Single PC** | Ek hi machine par `localhost:3000` + local Supabase. Internet nahi. | Owner / accountant / dev | 1-2 din | **Start yahin** |
| **L2 — Shop LAN** | Ek PC server, baaki phones/laptops LAN se. Internet nahi. | Staff, mechanics, multiple devices | L1 + 0.5-1 din | L1 ke baad |
| **L3 — Device-only** | Phone/tablet par bina kisi server ke app chale; baad me sync | Field staff, delivery | 4-8 hafte | Alag project |

> **Important:** L1/L2 me "offline" ka matlab hai *internet nahi*, lekin **local server chal raha hai**.
> Next.js is app ka server-side rendering + 91 API routes + middleware hai, isliye
> "sirf browser me file khol ke" app nahi chalega.

---

## 4. Sambhavnaye (Options) — trade-offs

### Option A — Supabase CLI + Docker (RECOMMENDED)

Local machine par poora Supabase stack: Postgres + GoTrue + Storage + Realtime + PostgREST + Studio.

| Pros | Cons |
|---|---|
| Zero app-code change (same `@supabase/*` clients) | Docker Desktop + virtualization chahiye |
| 100% schema/RLS/auth/storage/realtime parity | ~3-4 GB RAM, ~3 GB disk |
| Same migrations, same SQL, same RLS | Pehli setup me internet (images pull) |
| Cloud <-> local switch sirf env se | Windows 10 + 8 GB par thoda slow |

**Best for:** L1 aur L2 (agar VT-x enable ho sake).

### Option B — Docker kisi doosre Linux box / NAS par

Agar is Windows machine par BIOS virtualization lock hai, to ek spare Linux laptop /
NAS / Raspberry Pi (4 GB+) par Supabase stack chalao, aur Next app is PC par.
Dono LAN par baat karenge — internet ki zaroorat nahi.

| Pros | Cons |
|---|---|
| VT-x ki problem khatam | Extra hardware + LAN config |
| Always-on server, saare devices use kar sakte hain | HTTPS/CA setup |
| Same zero-code approach | LAN reliable hona chahiye |

**Best for:** L2, ya jab BIOS lock ho.

### Option C — Bina Docker: native Postgres + GoTrue + PostgREST + Storage

Windows par alag-alag binaries: PostgreSQL, GoTrue, PostgREST, Storage API. Realtime
(Elixir/Phoenix) Windows par practical nahi.

| Pros | Cons |
|---|---|
| Virtualization nahi chahiye | 6-10 services manually wire karna |
| Postgres native fast | Realtime chat/presence nahi chalega |
| | Windows GoTrue/Storage binaries unofficial/brittle |

**Best for:** Last resort / experiment. Production ke liye recommend nahi.

### Option D — Cloud + local read-cache (PWA/IndexedDB)

Service worker + IndexedDB me last-read data cache; writes fail honge.

| Pros | Cons |
|---|---|
| Chhota change | Real offline writes nahi |
| Read-only field view possible | Sync/conflict nahi |
| | Core shop operations nahi chalenge |

**Best for:** Field staff ko sirf "aaj ka kaam dekho" view.

### Option E — Offline-first rewrite (SQLite/IndexedDB + outbox)

Har device par local store, internet aane par sync. True offline UX.

| Pros | Cons |
|---|---|
| Device-only offline | 4-8 hafte ka kaam |
| Best mobile UX | Har query/write path touch hoga |
| | Conflict resolution, RLS/security dobara |
| | Storage/auth/photos ka alag design |

**Best for:** L3 (long-term product direction).

### Option F — Cloud-only (status quo)

| Pros | Cons |
|---|---|
| Kuch nahi karna | Internet gaya to kaam band |

### Decision matrix

| Option | Effort | App code change | Feature parity | Risk | Verdict |
|---|---|---|---|---|---|
| **A. Docker + Supabase CLI** | Medium | 0 (few patches) | 100% | Low | **Recommended** |
| B. Docker on Linux/NAS | Medium-High | 0 | 100% | Medium | Backup plan |
| C. Native services | Very High | 0 | ~70% | High | Avoid |
| D. Read-cache PWA | Low-Medium | Medium | ~20% | Medium | Limited |
| E. Offline-first rewrite | Very High | Very High | 100% (eventually) | High | Separate project |
| F. Cloud-only | 0 | 0 | 0% offline | — | No |

---

## 5. Recommended Plan — Phase by Phase

### Phase 0 — Readiness (ONE TIME, internet ke saath)

> Ye phase sirf ek baar karna hai. Iske baad offline chalega.

#### 0.1 BIOS virtualization ON karo (Decision Gate #1)

```powershell
# Check
(Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled
(Get-CimInstance Win32_ComputerSystem).HypervisorPresent
```

Agar `VirtualizationFirmwareEnabled = False`:
1. PC restart karo -> BIOS/UEFI (F2/F10/Del, brand ke hisaab se).
2. `Intel VT-x` / `Intel Virtualization Technology` ya `AMD-V` / `SVM Mode` -> **Enabled**.
3. Save & exit.
4. Windows me wapas aa kar dobara check karo.

> Agar company laptop hai aur BIOS lock hai -> **Option B** (Linux/NAS) par jao.

#### 0.2 Docker Desktop + WSL2

```powershell
winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
```

- Install ke baad **Docker Desktop app kholo** (Start menu) — pehli baar WSL2 setup karega.
- Kabhi-kabhi reboot maangta hai; maange to kar do.
- Settings -> Resources -> RAM limit **3-4 GB** (8 GB machine).
- Verify:

```powershell
docker --version
docker info --format '{{.ServerVersion}}'
```

#### 0.3 Supabase CLI (local devDependency)

```powershell
npm i -D supabase
npx supabase --version
```

> `npx supabase` first time internet se download karega. Isliye Phase 0 online karo.
> Alternative: `scoop install supabase` (agar Scoop hai).

#### 0.4 Postgres client tools (pg_dump / psql)

```powershell
winget install -e --id PostgreSQL.PostgreSQL.17
```

> `psql`/`pg_dump` PATH me na ho to full path use karo:
> `"C:\Program Files\PostgreSQL\17\bin\psql.exe"`

#### 0.5 One-time image pull + cache warm

```powershell
npx supabase init
npx supabase start      # pehli baar 12+ images pull hongi (5-20 min)
npx supabase stop       # data preserve karta hai
```

Agar truly offline machine par le jana ho:

```powershell
# Online machine par
docker save $(docker images --format '{{.Repository}}:{{.Tag}}' | Select-String supabase) -o supabase-images.tar

# Offline machine par
docker load -i supabase-images.tar
```

#### 0.6 npm cache / node_modules backup

```powershell
# node_modules ko safe copy (gitignored folder)
Compress-Archive -Path node_modules -DestinationPath backups\offline\node_modules.zip -Force
```

> `npm ci` offline sirf tab chalega jab npm cache complete ho. Sabse safe:
> `node_modules` ka zip rakhna.

#### 0.7 .env backup

```powershell
Copy-Item .env.local .env.cloud.local -Force
```

> `.env*` already `.gitignore` me hai. `.env.cloud.local` commit nahi hoga.

**Phase 0 acceptance:**
- [ ] `docker info` error-free
- [ ] `npx supabase --version` chalta hai
- [ ] `psql --version` chalta hai
- [ ] `npx supabase start` + `stop` ek baar successful
- [ ] `node_modules` ka zip bana

---

### Phase 1 — Local Supabase stack

```powershell
npx supabase init          # supabase/config.toml banega
npx supabase start         # local stack
npx supabase status -o env # keys note karo
```

Expected ports (default):

| Service | URL |
|---|---|
| API (Kong/PostgREST/Auth/Storage) | `http://127.0.0.1:54321` |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio | `http://127.0.0.1:54323` |
| Inbucket (email) | `http://127.0.0.1:54324` |

`supabase status -o env` se ye values milengi (CLI version ke hisaab se naam badal sakte hain):

```
API_URL=http://127.0.0.1:54321
ANON_KEY=...            # naye CLI me PUBLISHABLE_KEY
SERVICE_ROLE_KEY=...    # naye CLI me SECRET_KEY
DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

#### `supabase/config.toml` — sirf ye tweaks

> `supabase init` jo default banaye use rakho; sirf neeche wali cheezein merge karo.
> Keys CLI version ke saath badalti hain, isliye poora file copy-paste mat karo.

```toml
project_id = "vtech-offline"

[api]
port = 54321

[db]
port = 54322

[studio]
port = 54323

[inbucket]
port = 54324

[auth]
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000", "http://127.0.0.1:3000"]

[auth.email]
enable_signup = true
enable_confirmations = false

[analytics]
enabled = false
```

> **Note:** `[db] major_version` ko init ke default par hi rehne do. Supabase CLI
> apne Postgres version ke saath match karta hai.

#### Start/stop shortcuts (recommended)

`scripts/offline/start-local.cmd`:
```bat
@echo off
echo Starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
timeout /t 25 /nobreak >nul
cd /d "%~dp0..\.."
npx supabase start
echo.
echo App: http://localhost:3000
```

`scripts/offline/stop-local.cmd`:
```bat
@echo off
cd /d "%~dp0..\.."
npx supabase stop
```

> `supabase stop` data preserve karta hai. **`--no-backup` mat lagao** — wo data wipe karta hai.

**Phase 1 acceptance:**
- [ ] Studio `http://127.0.0.1:54323` khulta hai
- [ ] `select 1` Studio SQL editor me chalta hai
- [ ] Keys env me daal ke `curl` API hit hota hai

---

### Phase 2 — Schema bootstrap (local DB)

#### 2.1 Pehle ek important finding

`npx supabase db reset` **fresh empty DB par fail hoga**. Reason:

- Migrations filename se sort hoti hain.
- Sabse pehli file `supabase/migrations/20260728_add_suppliers.sql` hai.
- Usme ye block hai:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_list' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE inventory_list ADD COLUMN supplier_id BIGINT DEFAULT NULL;
  END IF;
END $$;
```

Fresh DB me `inventory_list` hai hi nahi -> `ALTER TABLE inventory_list` -> **error** ->
`db reset` wahin ruk jayega.

#### 2.2 Jo already tested hai

`supabase/migrations/20260913000000_final_full_schema_idempotent.sql`:

- 241 KB, 3,975 lines
- **55 tables, 55 RLS, 75 policies, 27 functions, 15 triggers**
- Header me likha hai: **fresh PG18 par validated, EXIT 0, `get_dashboard_stats` bhi chala**
- Fully idempotent + additive-only
- Storage buckets bhi create karta hai

Isliye recommended bootstrap = **full schema pehle, phir uske baad wali migrations**.

#### 2.3 Exact bootstrap order

```powershell
# 1) Full idempotent schema
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" `
  -v ON_ERROR_STOP=1 `
  -f "supabase/migrations/20260913000000_final_full_schema_idempotent.sql"
```

```powershell
# 2) Full schema ke BAAD wali migrations (filename sort order me)
$files = @(
  "20260913_required_parts_po_bridge.sql",
  "20260913_suppliers_gst_bank.sql",
  "20260914_clients_page_repair_done.sql",
  "20260914_stocktake_stock_adjustment.sql",
  "20260915_po_partial_receipt.sql",
  "20260915_required_parts_receive_sync.sql",
  "20260916_atomic_job_id_counter.sql",
  "20260917_peek_preview_job_id.sql",
  "20260917_supplier_visiting_card.sql",
  "20260918_po_pricing_flow.sql",
  "20260918_supplier_contact_persons.sql",
  "20260919_expense_supplier_link.sql",
  "20260920_inventory_location_cleanup.sql",
  "20260921_client_contacts.sql",
  "20260922_bom_templates.sql",
  "20260925_i6_phase2_place_drop.sql",
  "20260926_staff_geofence_permit.sql",
  "20260927_activity_geo_tags.sql",
  "20260928_direct_sale_fk_atomic_save.sql",
  "20261002_attendance_derived_cols.sql",
  "20261002_staff_duty_schedule.sql",
  "20261018_passkey_login.sql",
  "20261018_perf_indexes.sql"
)
foreach ($f in $files) {
  Write-Host "Applying $f"
  psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" `
    -v ON_ERROR_STOP=1 -f "supabase/migrations/$f"
  if ($LASTEXITCODE -ne 0) { throw "Failed: $f" }
}
```

> Kyun `20260913_required_parts_po_bridge.sql` bhi? Kyunki ASCII me `0` (48)
> `_` (95) se chhota hai, isliye `20260913000000...` sort me pehle aata hai, aur
> `20260913_required...` uske baad. Dono additive/idempotent hain.

#### 2.4 Offline seed (`supabase/offline_seed.sql`)

Ye file naye local DB ke liye zaroori hai. **Isko `seed.sql` naam mat do** jab tak
`db reset` use nahi kar rahe; `offline_seed.sql` manual apply karo.

```sql
-- ============================================================
-- supabase/offline_seed.sql  (LOCAL / OFFLINE ONLY)
-- Idempotent. Manually psql se apply karo.
-- ============================================================

-- 1) Shop name (sirf ek baar)
insert into public.system_info (meta_field, meta_value)
select 'name', 'V-Tech PRO (Offline)'
where not exists (select 1 from public.system_info where meta_field = 'name');

-- 2) License: local instance ko gate se bachao.
--    /api/license/status "license_key" + "license_status" dono padhta hai.
insert into public.system_info (meta_field, meta_value)
select 'license_key', 'VTC-OFFL-0000-0000-0000'
where not exists (select 1 from public.system_info where meta_field = 'license_key');

insert into public.system_info (meta_field, meta_value)
select 'license_status',
       json_build_object(
         'activated', true,
         'plan', 'offline',
         'shopName', 'V-Tech PRO (Offline)',
         'activatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
         'expiresAt', null,
         'activationId', 'offline-local',
         'enabledModules', null
       )::text
where not exists (select 1 from public.system_info where meta_field = 'license_status');

-- 3) Signature bucket (migrations me missing hai!)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signatures', 'signatures', true, 1048576,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- 4) Job ID counter (fresh DB me row na ho to)
insert into public.job_id_counter (id, last_job_id)
select 1, 28101
where not exists (select 1 from public.job_id_counter where id = 1);

-- 5) Optional: UPI / branding
-- insert into public.system_info (meta_field, meta_value)
-- select 'upi_id', 'your-upi@bank'
-- where not exists (select 1 from public.system_info where meta_field = 'upi_id');
```

```powershell
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" `
  -v ON_ERROR_STOP=1 -f "supabase/offline_seed.sql"
```

#### 2.5 Verify

```sql
-- tables
select count(*) from information_schema.tables
where table_schema = 'public';                       -- expect 55+

-- RLS
select count(*) from pg_tables
where schemaname = 'public' and rowsecurity = true;  -- expect 55

-- buckets
select id, public from storage.buckets order by id;  -- 9 rows

-- license seed
select meta_field, left(meta_value, 60) from public.system_info
where meta_field in ('name','license_key','license_status');

-- RPC smoke test
select public.peek_next_job_id();
select public.get_dashboard_stats(
  (current_date::text), (current_date::text)
);
```

> Agar `db reset`/`db push` ka CLI history bhi clean chahiye, to baad me
> `npx supabase migration repair --status applied <version>` chala sakte ho.
> Duplicate date-prefix versions ki wajah se ye optional rakho.

**Phase 2 acceptance:**
- [ ] 55+ tables
- [ ] 55 RLS tables
- [ ] 9 buckets
- [ ] `peek_next_job_id()` chalta hai
- [ ] `license_status` seed present

---

### Phase 3 — Data (asli shop data) clone

Do raste hain:

| Rasta | Kab | Kya milega |
|---|---|---|
| **3A. Fresh/seed data** | Demo, testing, naya shop | Khaali DB + admin user |
| **3B. Cloud se clone** | Asli shop offline chalani ho | Real clients/jobs/inventory |

#### 3A — Fresh start (fastest)

1. `npm run dev:local`
2. `http://localhost:3000/setup` kholo
3. Admin email/password banao
4. Settings me shop name/logo
5. Sample clients/products add karo

#### 3B — Cloud se clone (recommended for real shop)

**Step 1 — Online machine par backup lo:**

```powershell
# JSON backup (already daily routine me hai)
node scripts/supabase-json-backup.mjs --dir backups\offline-clone

# YA full public schema + data SQL dump
node scripts/supabase-dump.mjs --full --output backups\offline-clone\full.sql
```

**Step 2 — Local DB me restore:**

Option 1 — JSON restore (REST based, local env par):
```powershell
# .env.local local Supabase par point kar raha ho
node scripts/force-restore.cjs backups\offline-clone\vtech_backup_YYYY-MM-DDTHH-MM-SS.json --yes
```

Option 2 — SQL dump restore:
```powershell
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" `
  -v ON_ERROR_STOP=1 -f "backups\offline-clone\full.sql"
```

> `supabase-dump.mjs` sirf `public` schema dump karta hai. Header me clearly likha hai:
> `auth.users` aur storage objects isme **nahi** aate.

**Step 3 — Users (auth.users) — ye sabse bada gotcha hai**

Passwords cloud se export nahi hote. 3 options:

| Option | Kaise | Pros | Cons |
|---|---|---|---|
| A. Manual recreate (recommended) | `/setup` se admin, `/users` se staff | Simple, safe | Client portal users dobara banane padenge |
| B. `auth` schema data-only dump | `pg_dump --schema=auth --data-only` -> local auth schema | Password hashes bhi aa sakte hain | GoTrue schema version mismatch ka risk; test karna padega |
| C. Admin API script | service role se `auth.admin.createUser` | Scriptable | Temporary passwords, users ko reset karna hoga |

> For a shop, usually 1 admin + 2-5 staff + kuch client portal users.
> Staff ke liye Option A best hai. Client portal offline me OTP ki jagah
> password ya Inbucket use karna padega (neeche C10).

**Step 4 — Storage objects (photos/files) clone**

DB backup me images nahi aati. 8+ buckets:

```
client-photos, job-images, mechanic-photos, product-images,
spare-photos, supplier-photos, user-avatars, media, signatures
```

Recommended: `scripts/offline/storage-clone.mjs` (naya script) jo service-role se:

1. `POST {url}/storage/v1/object/list/{bucket}` se recursive list kare
2. `GET {url}/storage/v1/object/{bucket}/{path}` se download kare
3. Local par `POST {url}/storage/v1/object/{bucket}/{path}` (`x-upsert: true`) se upload kare

> Agar Supabase CLI ka `supabase storage cp` available ho to wo bhi use kar sakte ho.
> Nahi to ye chhota Node script 100 lines me ban jayega (already `@supabase/supabase-js` installed hai).

**Step 5 — URL rewrite (cloud -> local)**

DB me image URLs absolute hote hain, jaise:
`https://<ref>.supabase.co/storage/v1/object/public/client-photos/x.jpg`

Offline me ye cloud ko point karte rahenge -> broken images. Inhe local host se replace karo:

```sql
-- cloud host -> local host
do $$
declare
  r record;
  old_host text := 'https://YOUR-PROJECT-REF.supabase.co';
  new_host text := 'http://127.0.0.1:54321';   -- LAN setup me http://192.168.1.5:54321
begin
  for r in
    select table_schema, table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and data_type in ('text', 'character varying')
  loop
    execute format(
      'update %I.%I set %I = replace(%I, %L, %L) where %I like %L',
      r.table_schema, r.table_name, r.column_name, r.column_name,
      old_host, new_host, r.column_name, '%' || old_host || '%'
    );
  end loop;
end $$;
```

> Reverse (local -> cloud) ke liye same script me `old_host`/`new_host` swap kar do.
> Ye script **sirf url text replace** karta hai; koi row delete nahi karta.

**Step 6 — Verify counts**

```sql
select 'client_list' t, count(*) from public.client_list
union all select 'transaction_list', count(*) from public.transaction_list
union all select 'inventory_list', count(*) from public.inventory_list
union all select 'profiles', count(*) from public.profiles;
```

Cloud ke counts se compare karo.

**Phase 3 acceptance:**
- [ ] Admin login chal raha hai
- [ ] Dashboard numbers cloud se match
- [ ] Client/job/product images load ho rahi hain
- [ ] Naya image upload + delete chal raha hai
- [ ] Print/PDF QR bhi aa raha hai (Phase 4 ke baad)

---

### Phase 4 — Env + code patches (chhote, targeted)

#### 4.1 Env profiles

**`.env.offline`** (naya, gitignored) — L1:

```dotenv
# ── Local Supabase ─────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY / PUBLISHABLE_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY / SECRET_KEY>

# ── Offline behaviour ──────────────────────────
OFFLINE_MODE=1
NEXT_PUBLIC_OFFLINE_MODE=1
NEXT_TELEMETRY_DISABLED=1

# ── License (local instance) ───────────────────
# Seed se valid hai; central service blank rakho
LICENSE_SERVICE_URL=
LICENSE_SERVICE_ANON_KEY=

# ── AI (blank = disabled) ──────────────────────
GEMINI_API_KEY=
GROQ_API_KEY=

# ── Push (blank = disabled) ────────────────────
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=
FIREBASE_SERVICE_ACCOUNT=

# ── Monitoring (blank = off) ───────────────────
# NEXT_PUBLIC_SENTRY_DSN=
# SENTRY_DSN=

# ── Public site / links ────────────────────────
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=V-Tech PRO
NEXT_PUBLIC_SITE_SHORT_NAME=V-Tech
```

**`.env.offline-lan`** (L2) — same, lekin:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://192.168.1.5:54321
NEXT_PUBLIC_SITE_URL=https://192.168.1.5
```

> ⚠️ `NEXT_PUBLIC_*` **build-time** inline hote hain. L1 aur L2 ke liye alag build
> chahiye (ya `next dev` use karo). Ek hi build dono ke liye nahi chalega.

#### 4.2 Code patches (recommended)

Ye patches chhote hain aur offline ke bina bhi safe hain (C1, C3, C5, C6).
Sirf C2 (license bypass) business decision hai.

**C1 — `next.config.ts`: local Supabase images allow**

Next 16 ne breaking change kiya: local/private IP images default blocked hain.
Agar ye nahi kiya to local Supabase photos par `upstream image resolved to private IP`
error aayega.

```ts
// next.config.ts — images block replace
const supaUrl = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // ... existing
  images: {
    // Next 16: local/private IP optimization block
    ...(process.env.OFFLINE_MODE === "1"
      ? { dangerouslyAllowLocalIP: true }
      : {}),
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      ...(supaUrl
        ? [
            {
              protocol: supaUrl.protocol.replace(":", "") as "http" | "https",
              hostname: supaUrl.hostname,
              port: supaUrl.port || undefined,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
  },
};
```

**C2 — License gate: offline valid**

Do options:

*Option 1 (no code, recommended):* Phase 2 ka `offline_seed.sql` license rows
already daal deta hai. Status route `isLicenseConfigured() === false` par
`valid = !localExpired` deta hai -> valid true.

*Option 2 (code, explicit):* `src/app/api/license/status/route.ts` ke `GET` ke
shuru me:

```ts
if (process.env.OFFLINE_MODE === "1") {
  return NextResponse.json({
    configured: false,
    activated: true,
    valid: true,
    plan: "offline",
    shopName: process.env.NEXT_PUBLIC_SITE_NAME ?? "Offline",
    activationId: "offline-local",
    expiresAt: null,
    enabledModules: null,
    sellerEnabled: false,
    devEnabled: false,
  } satisfies import("@/lib/license").LicenseStatus);
}
```

> ⚠️ Ye licensing bypass hai. Sirf seller-controlled / owner-controlled offline
> deployment par use karo. Productized solution: **signed offline license**
> (Ed25519/HMAC, public key app me embedded) — Phase 6.

**C3 — Push prompt skip offline**

`src/app/useAppBoot.ts` (around line 244):

```ts
if (process.env.NEXT_PUBLIC_OFFLINE_MODE === "1") {
  // offline: VAPID/FCM endpoints unreachable — prompt skip
} else if (
  typeof window !== "undefined" &&
  "Notification" in window &&
  "serviceWorker" in navigator
) {
  // ... existing push block
}
```

**C4 — AI graceful offline**

`src/app/api/chat/route.ts` ke `POST` ke shuru me:

```ts
if (process.env.OFFLINE_MODE === "1") {
  return NextResponse.json(
    { error: "Offline mode: AI assistant internet ke bina available nahi hai." },
    { status: 503 }
  );
}
```

> Note: `/api/ai/alerts` external AI call nahi karta — wo `executeGeminiTool`
> se local DB queries karta hai. Wo offline chalega.

**C5 — QR local generate (external API hatao)**

`api.qrserver.com` ko `qrcode` package se replace karo (already dependency hai).

`src/app/api/print-bill/route.ts`, `print-combined-invoice/route.ts`,
`print-direct-sale-invoice/route.ts`:

```ts
import QRCode from "qrcode";

async function qrUrl(data: string, size: number) {
  return QRCode.toDataURL(data, { width: size, margin: 1 });
}
```

Call sites ko `await qrUrl(...)` karo (routes already async hain).

`src/app/inventory/locations/page.tsx:337`:

```ts
import QRCode from "qrcode";
// ...
const src = await QRCode.toDataURL(qrToken(loc), { width: 200, margin: 1 });
```

> Ye patch online bhi better hai (external API dependency + privacy).

**C6 — Capacitor URL env-driven**

`capacitor.config.ts`:

```ts
const config: Record<string, unknown> = {
  appId: "com.vtech.pro",
  appName: "V-TECH PRO",
  webDir: "out",
  ...(process.env.CAP_SERVER_URL
    ? { server: { url: process.env.CAP_SERVER_URL, cleartext: true } }
    : {}),
};
```

Offline LAN:
```powershell
$env:CAP_SERVER_URL="http://192.168.1.5:3000"
npx cap sync android
```

> Camera/QR scanner ke liye HTTPS chahiye (C7). HTTP LAN par camera block hoga.

**C7 — LAN HTTPS (L2 ke liye)**

L1 (localhost) par HTTPS ki zaroorat nahi — browser `localhost` ko secure
context maanta hai, camera/GPS/passkeys chalte hain.

L2 par (192.168.x.x) ye cheezein HTTP par block hoti hain:
- Camera / QR scanner
- Geolocation (attendance)
- Passkeys
- `Secure` cookies

Recommended: **Caddy** (single binary) reverse proxy + internal CA:

`Caddyfile`:
```
https://192.168.1.5 {
    tls internal
    reverse_proxy 127.0.0.1:3000
}

https://192.168.1.5:54443 {
    tls internal
    reverse_proxy 127.0.0.1:54321
}
```

- `caddy trust` host par root CA install karega.
- Har phone/tablet par `root.crt` install karo (Settings -> Security -> CA certificate).
- App URL: `https://192.168.1.5`
- Supabase URL: `https://192.168.1.5:54443` (same cert SAN/IP)
- Mixed content nahi hoga, realtime WSS chalega.

Alternative: `mkcert` + `next dev --experimental-https-key/--experimental-https-cert`.
`next start` HTTPS serve nahi karta, isliye production ke liye Caddy/nginx.

**C8 — OTP / email offline**

- Supabase local me **Inbucket** hota hai: `http://127.0.0.1:54324`
- OTP emails wahin dikhengi; client ko code manually de sakte ho.
- Better: offline shop me client portal ke liye password login enable karo
  (chhota UI patch), ya client portal use mat karo.

**C9 — Telemetry / build**

```powershell
$env:NEXT_TELEMETRY_DISABLED="1"
```

**C10 — Setup / admin**

- `/setup` local par chalta hai (service-role se user + profile banata hai).
- `SETUP_TOKEN` blank rakho (ya known value).

**C11 — Backup**

- `/backup` page local `backups/` folder me JSON likhta hai — offline chalega.
- Cloud copy (Supabase Storage) local storage par jayegi — chalega.
- Daily local backup ke liye Task Scheduler:
```powershell
schtasks /Create /TN "VTech Local Backup" /TR "node \"D:\next-tech\vtech-next-frontend\scripts\supabase-json-backup.mjs\"" /SC DAILY /ST 02:00 /F
```

#### 4.3 Env switch (dev vs cloud)

```json
// package.json scripts (optional)
"dev:offline": "next dev",
"dev:cloud": "cross-env ... next dev"
```

> Simple rehna ho to manual: `.env.offline` -> `.env.local` copy karo.
> Cloud wapas: `.env.cloud.local` -> `.env.local`.

**Phase 4 acceptance:**
- [ ] `npm run dev:local` boot hota hai
- [ ] Login + dashboard khulta hai (LicenseGate nahi)
- [ ] Image upload + display chalta hai
- [ ] Print preview me QR aata hai
- [ ] AI drawer friendly error deta hai (hang nahi)
- [ ] Push prompt nahi aata

---

### Phase 5 — Run + verify + daily ops

#### 5.1 Start routine

```powershell
# 1) Docker Desktop kholo (tray me whale icon)
# 2) Supabase start
npx supabase start

# 3) Env (agar switch karna ho)
Copy-Item .env.offline .env.local -Force

# 4) App
npm run dev:local
# ya production:
# npm run build
# npm start
```

Open: `http://localhost:3000`

#### 5.2 Verification matrix

| # | Test | Expected |
|---|---|---|
| 1 | Login (admin) | Dashboard khule, koi license gate nahi |
| 2 | Login (staff) | Role ke hisaab se shell |
| 3 | Dashboard stats | Cloud ke numbers match |
| 4 | New job create/edit/delete | DB me save, list refresh |
| 5 | Client add + photo upload | Photo upload + thumbnail |
| 6 | Inventory stock RPC | `get_inventory_stock` sahi |
| 7 | Print bill / job status | Print preview + **local QR** |
| 8 | Attendance punch + GPS | Geolocation + geofence |
| 9 | Messages (2 browsers) | Realtime message aata hai |
| 10 | Presence (Team Online) | Online/offline update |
| 11 | Backup page | Local JSON bane, download ho |
| 12 | Restore drill | Backup se local restore |
| 13 | AI drawer | Friendly offline message |
| 14 | Push | Prompt nahi, koi error nahi |
| 15 | Client portal (agar use ho) | Password ya Inbucket OTP |
| 16 | Internet off | Sab above phir se |

#### 5.3 Daily ops

| Kab | Kya |
|---|---|
| PC start | Docker Desktop -> `supabase start` -> `npm start` |
| Daily 2 AM | `supabase-json-backup.mjs` (Task Scheduler) |
| Weekly | `backups/` se external drive/pen-drive copy |
| Monthly | Restore drill (staging local DB) |
| Update | Online aake `git pull` + `npm ci` + `supabase start` (images) |
| Shutdown | `npx supabase stop` (data preserve) |

#### 5.4 Power / reliability

- Shop PC ka sleep **off** karo (Power Options -> High performance).
- UPS lagao (power cut safe).
- Windows Update ko active hours me restrict karo.
- Firewall: private network par ports 3000, 54321, 54322, 54323, 54324 allow.
- Disk: Docker volume + `backups/` ke liye 10+ GB free rakho.

**Phase 5 acceptance:**
- [ ] Poora verification matrix pass
- [ ] Internet cable nikaal ke bhi sab chalta hai
- [ ] Restore drill pass

---

## 6. Topology (recommended)

### L1 — Single PC

```
[Browser]
   | http://localhost:3000
   v
[Next.js server (this PC)]
   | http://127.0.0.1:54321
   v
[Supabase local stack (Docker)]
   Postgres 54322 | Auth | Storage | Realtime | PostgREST
```

### L2 — Shop LAN + HTTPS

```
[Phones / laptops]
   | https://192.168.1.5          (app)
   | https://192.168.1.5:54443    (supabase)
   v
[Caddy reverse proxy + local CA]
   |-> 127.0.0.1:3000   Next.js
   |-> 127.0.0.1:54321  Supabase
```

> Same machine par Docker + Next + Caddy. Internet ki zaroorat nahi.

---

## 7. Kya offline NAHI chalega (honest list)

| Feature | Kyun | Workaround |
|---|---|---|
| AI assistant (Gemini/Groq) | Cloud API | Disable / local Ollama (optional) |
| Web push notifications | VAPID/FCM cloud | Disable |
| Android native push | FCM | Disable |
| Client email OTP | SMTP/email cloud | Inbucket ya password login |
| License central re-check | Seller ka Supabase | Seed / signed offline license |
| Seller/Developer portals | Vercel API | Ignore |
| WhatsApp share | wa.me internet | Message copy/print |
| Google Maps links | internet | Coordinates copy |
| Cloud backup copy | Supabase Storage | Local backup (works) |
| Public site QR share to internet | public URL | LAN URL / offline QR |
| Updates / releases | GitHub | Manual copy |
| Camera/GPS/passkeys on LAN HTTP | secure context | LAN HTTPS (C7) |
| Device-only offline (no server) | architecture | L3 rewrite |

---

## 8. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | BIOS virtualization lock | Medium | High | Option B (Linux/NAS) |
| 2 | 8 GB RAM par Docker + Next slow | High | Medium | Docker RAM 3-4 GB, `next start` (dev nahi), Studio band |
| 3 | `db reset` migration-order failure | **High** | Medium | Phase 2 ka psql bootstrap (full schema first) |
| 4 | `auth.users` clone nahi hota | **High** | High | Manual recreate / auth dump (test) |
| 5 | Storage objects clone nahi hote | **High** | High | `storage-clone.mjs` script |
| 6 | Image URLs cloud par point karte hain | **High** | High | SQL URL rewrite |
| 7 | `next/image` local IP block | **High** | High | `dangerouslyAllowLocalIP: true` |
| 8 | License gate block | **High** | High | Seed / `OFFLINE_MODE` |
| 9 | LAN HTTP par camera/GPS fail | High | Medium | Caddy HTTPS + CA |
| 10 | Local ↔ cloud data drift | Medium | High | Ek source of truth; doosra backup |
| 11 | Docker images delete ho gayi | Low | High | `docker save` tarball |
| 12 | `node_modules` delete ho gaya | Low | High | zip backup |
| 13 | Local keys change (CLI update) | Medium | Medium | `supabase status -o env` se dobara copy |
| 14 | Windows sleep/reboot | Medium | Medium | Power plan, auto-start |
| 15 | Offline license bypass misuse | Medium | High | Signed offline license (Phase 6) |
| 16 | Data loss (no backup) | Low | Critical | Daily JSON + weekly external |

---

## 9. Effort estimate

| Phase | Pehli baar | Dobara |
|---|---|---|
| 0. Readiness (Docker/BIOS/cache) | 1-3 hours (+reboot) | 0 |
| 1. Local Supabase | 30-45 min (images 5-20 min) | 1 min |
| 2. Schema + seed | 1-2 hours | 2 min |
| 3. Data clone + storage + URL rewrite | 1-3 hours | 10 min |
| 4. Code patches + test | 2-4 hours | 0 |
| 5. Verify + ops scripts | 1-2 hours | 0 |
| **Total** | **~1-2 days** | **~15 min** |

> L2 (LAN HTTPS) extra: +3-5 hours (Caddy/CA/devices).

---

## 10. Recommended next actions (checklist)

### Recorded decisions (2026-10-26)

| Decision | Choice | Status |
|---|---|---|
| Level | L1 / L2 / L3 | **Pending** |
| Data | **Asli cloud data clone** (Phase 3B) | **Confirmed** |
| License | Seed / `OFFLINE_MODE` | **Pending** (default: seed) |
| Execution start | User pehle plan padhega — koi command abhi nahi chalayi | **On hold** |

> Iska matlab: jab start hoga, Phase 3 me **3A (fresh seed) skip** karke seedha
> **3B (cloud clone)** karna hai — JSON/SQL dump + `auth.users` recreate +
> storage objects clone + URL rewrite.

1. [ ] **Decision:** L1 / L2 / L3? (default: **L1**)
2. [x] **Decision:** fresh seed ya real cloud clone? -> **real clone**
3. [ ] **Decision:** license seed ya `OFFLINE_MODE`? (default: **seed**)
4. [ ] BIOS me VT-x/AMD-V enable karo.
5. [ ] Docker Desktop install + reboot + verify.
6. [ ] `npm i -D supabase`, `psql --version`.
7. [ ] `npx supabase init` + `start` (online, one time).
8. [ ] Phase 2 bootstrap + `offline_seed.sql`.
9. [ ] `npm run dev:local` -> `/setup` -> admin login.
10. [ ] Core smoke test (login, job, client, upload, print).
11. [ ] Phase 3 real data clone (agar chahiye).
12. [ ] Phase 4 patches approve + apply.
13. [ ] Phase 5 verification matrix + backup drill.
14. [ ] Internet band karke final test.

---

## 11. Appendix

### A. File / line evidence (scan)

| Finding | File:line |
|---|---|
| Browser Supabase client | `src/lib/supabase.ts:11` |
| Server Supabase client | `src/lib/api-auth.ts:8` |
| Admin (service-role) client | `src/lib/admin-supabase.ts:11` |
| Middleware auth | `src/proxy.ts:48-95` |
| License gate render | `src/app/RootClient.tsx:1367` |
| License status logic | `src/app/api/license/status/route.ts:90-167` |
| License seed need | `src/app/api/license/activate/route.ts:74-87` |
| Image remote patterns | `next.config.ts:43-51` |
| Next 16 local IP block | `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` |
| QR external API | `src/app/api/print-bill/route.ts:388`, `print-combined-invoice/route.ts:388`, `print-direct-sale-invoice/route.ts:200`, `src/app/inventory/locations/page.tsx:337` |
| AI chat | `src/app/api/chat/route.ts`, `src/lib/gemini.ts`, `src/lib/groq.ts` |
| AI alerts (local DB only) | `src/app/api/ai/alerts/route.ts` |
| Push prompt | `src/app/useAppBoot.ts:244-262` |
| Capacitor URL | `capacitor.config.ts:6` |
| Secure cookies | `src/app/api/auth/login/route.ts:89,164,351` |
| OTP client login | `src/app/(public)/login/page.tsx:271` |
| Geofence (local haversine) | `src/lib/geofence.ts:36` |
| Camera secure-context note | `src/lib/cameraSupport.ts:8` |
| Service worker policy | `src/app/sw.ts:31-123` |
| Missing signatures bucket | `src/app/api/settings/signature/route.ts:47` |
| Backup local + cloud | `src/lib/scheduledBackup.ts:176-209` |
| Full schema | `supabase/migrations/20260913000000_final_full_schema_idempotent.sql` |
| Migration-order blocker | `supabase/migrations/20260728_add_suppliers.sql:25-33` |
| Dump auth/storage caveat | `scripts/supabase-dump.mjs:28-35` |

### B. Cloud -> local -> cloud URL rewrite (one-liner)

```sql
-- cloud -> local
update public.<table> set <col> = replace(<col>,
  'https://YOUR-REF.supabase.co', 'http://127.0.0.1:54321')
where <col> like '%https://YOUR-REF.supabase.co%';

-- local -> cloud
update public.<table> set <col> = replace(<col>,
  'http://127.0.0.1:54321', 'https://YOUR-REF.supabase.co')
where <col> like '%http://127.0.0.1:54321%';
```

### C. Command cheat sheet

```powershell
# Supabase
npx supabase start
npx supabase stop
npx supabase status -o env
npx supabase db reset          # NOTE: fresh DB par fail hoga (Phase 2 dekho)

# Postgres
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# App
npm run dev:local
npm run build
npm start

# Backup
node scripts/supabase-json-backup.mjs
node scripts/supabase-dump.mjs --full

# Restore
node scripts/force-restore.cjs backups\vtech_backup_XXX.json --yes
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f dump.sql
```

### D. Cloud wapas kaise jayein

1. Internet on karo.
2. `.env.cloud.local` -> `.env.local` copy karo.
3. `npm run dev` / `npm start`.
4. Agar data local me change hua hai aur cloud me push karna hai:
   - Pehle cloud ka fresh backup lo.
   - Local ka JSON/SQL dump lo.
   - Cloud par restore karo (`scripts/force-restore.cjs` ya `psql`).
   - URL rewrite reverse karo (local -> cloud).
5. **Bidirectional live sync mat banavo** jab tak conflict policy clear na ho.
   Simplest: **local = source of truth, cloud = cold backup**.

### E. Phase 6 (optional / later)

| Item | Why | Effort |
|---|---|---|
| Signed offline license (Ed25519) | License bypass ki jagah proper control | 1-2 days |
| LAN HTTPS (Caddy + CA) | Camera/GPS/passkeys multi-device | 0.5-1 day |
| Local AI (Ollama) | AI offline | 1-2 days + hardware |
| Storage clone script | Repeatable cloud->local | 0.5 day |
| URL rewrite script | Repeatable clone | 0.5 day |
| One-way cloud backup sync | Off-site safety | 1 day |
| Two-way CDC sync | Multi-site live | 2-4 weeks |
| Android offline-first (SQLite + outbox) | L3 | 4-8 weeks |

---

## 12. Final recommendation (short)

- **Abhi:** L1 (single PC) + Docker + local Supabase + seed license + real data clone.
- **Code:** Phase 4 ke C1 (images), C3 (push), C5 (QR local), C6 (Capacitor) — ye
  online bhi safe hain; C2 (license) business decision.
- **Baad me:** L2 ke liye Caddy HTTPS; L3 alag project.
- **Data policy:** ek waqt me ek source of truth. Local chal raha hai to cloud
  sirf backup. Dono ko simultaneously edit mat karo.

---

*Banaya: 2026-10-26 — scan + options + execution plan. Koi code change apply nahi kiya.*
