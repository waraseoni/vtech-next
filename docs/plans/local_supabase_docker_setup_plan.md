# Local Dev = Supabase CLI + Docker — Setup Plan

> Status: PLAN ONLY (abhi apply nahi kiya — 2026-09-17 ko rok diya)
> Date: 2026-09-17
> Decision: **Approach A** (`offline_local_supabase_sync_plan.md`) ko concrete
> execution plan. Local dev ke liye Supabase ka self-hosted stack (Docker),
> online ke liye hosted Supabase. Code **zero change** — sirf env switch.

---

## 1. Goal

- Ek local DB jo **bilkul Supabase** ho (Postgres + Auth + RLS + Storage +
  Realtime + PostgREST) — taaki `@supabase/supabase-js` waala pura app bina
  kisi code change ke local par chale.
- Online (hosted Supabase) aur local ke beech switch **sirf `.env`** se.
- MariaDB mirror (`scripts/supabase-to-mariadb.mjs`) ko iska replacement
  samjho — PHP yug retire ho chuka hai, to MariaDB ab deadweight hai.

## 2. Kyun Docker + Supabase CLI (aur kuch nahi)

App **Supabase par gehra depend** karta hai, plain Postgres par nahi:

| Feature | Code me kahan |
|---|---|
| Auth | `auth.signInWithPassword`, `signInWithOtp`, `getUser()` |
| Realtime | `channel("vtech-messages"/"typing"/"presence"/"unread-badge")` |
| Storage | `storage.from(...)` — photos, media, signatures, products |
| RPC | ~15 `rpc("next_job_id","get_dashboard_stats",...)` |
| RLS | Har migration me `auth.uid()` policies |

**Plain Postgres** inme se kuch bhi nahi deta → pura data layer rewrite +
auth/storage/realtime dobara banana padega. Isliye:

| Option | Docker? | Code change | Free/OSS | Verdict |
|---|---|---|---|---|
| **Supabase CLI + Docker** | Haan | 0 | 100% | ✅ Ye plan |
| Cloud dev project (2nd free tier) | Nahi | 0 | Hosted | Backup option (Docker na chale to) |
| Plain local Postgres | Nahi | Bada rewrite | 100% | ❌ App ke liye |
| PGlite (WASM PG) | Nahi | Testing-only | 100% | Sirf migrations test ke liye |
| Neon/Fly/Railway PG | Nahi | Bada rewrite | Free tier | ❌ App ke liye |

## 3. Current State (2026-09-17 par scan)

| Cheez | Status |
|---|---|
| Supabase CLI | ✅ Installed — v2.113.0 (global) |
| Migrations | ✅ `supabase/migrations/` me ~50 files |
| `supabase/config.toml` | ❌ Nahi hai (`supabase init` banayega) |
| `supabase/seed.sql` | ❌ Nahi hai (users/buckets seed karna hoga) |
| **Docker Desktop** | ❌ **Installed nahi** |
| WSL2 | ❌ Koi distro nahi |
| Machine | 13.9 GB free disk · 8 GB RAM · 4 CPU cores |

## 4. Space + Time Estimate (is machine par)

| Step | Disk | Time |
|---|---|---|
| Docker Desktop install | ~3-4 GB (dl ~500 MB) | 5-20 min |
| WSL2 + VM setup | ~1 GB | 2-5 min |
| Supabase images (~12) pull | ~2-3 GB | 5-20 min |
| Migrations apply (`db reset`) | ~500 MB | 2-10 min |
| Env config + verify | 0 | 5 min |
| **Total** | **~6-7 GB** | **~20-60 min** |

⚠️ Install ke baad sirf ~7 GB free bachega — tight. Start se pehle disk
cleanup karna better (dekho Step 0).

---

## 5. Step-by-Step (jab apply karein)

### Step 0 — Pre-checks (must)
```powershell
# 1) Disk free >= ~8 GB chahiye
Get-PSDrive C | Select-Object @{n='FreeGB';e={[math]::Round($_.Free/1GB,1)}}

# 2) ⚠️ Duplicate migration hatao — warna db reset/push "multiple migrations
#    with version 20260817" par fail hoga. Ye ek purana scratch copy hai.
Remove-Item "supabase\migrations\20260817_product_level_location - Copy.sql"

# 3) Docker nahi hai to install (UAC prompt "Yes" karna):
winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
```
- Install ke baad **Docker Desktop app kholo** (Start menu) — pehli baar WSL2
  setup karega. Kabhi-kabhi **reboot** maangta hai; maange to kar lo.
- Docker Desktop → Settings → Resources me RAM limit 4 GB+ dekh lena.

### Step 1 — Docker engine verify
```powershell
docker --version
docker info --format '{{.ServerVersion}}'   # error nahi aana chahiye
```
Docker Desktop running hona chahiye (system tray me whale icon).

### Step 2 — Supabase init
```powershell
npx supabase init
```
- `supabase/config.toml` banega (existing migrations ko chhuega nahi).
- Ports default: API `54321`, Postgres `54322`, Studio `54323`, Inbucket `54324`.

### Step 3 — Local stack start (pehli baar images pull)
```powershell
npx supabase start
```
- Pehla run sabse slow (12+ images). Baad ke runs seconds me.
- Aakhir me **local URL + anon/service keys print** karega — note kar lo.
- Local keys har CLI version me badal sakte hain, isliye hardcode ke bajaye:
```powershell
npx supabase status -o env
```

### Step 4 — Migrations apply
```powershell
npx supabase db reset
```
- `supabase/migrations/` se poora schema (tables + RLS + RPC + storage buckets)
  local par lag jayega. Idempotent — dobara chalana safe.
- Agar koi migration PHP-yug data par depend karta ho to alag se dekhna.

### Step 5 — Env dual config (local vs cloud)
- `.env.local` → **local** Supabase (dev ke liye):
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase status se anon key>
SUPABASE_SERVICE_ROLE_KEY=<supabase status se service_role key>
```
- `.env.cloud` (naya) → hosted Supabase URL + keys (backup ke liye).
- `.env.cloud` ko **`.gitignore` me rakho** (agar already nahi hai).
- Licensing alag central Supabase project hai (`LICENSE_SERVICE_URL`) — local
  dev me woh central project hi point karta rahe ya gracefully fail ho, dono
  check karna.

Optional npm scripts (switch aasan ho):
```
"dev:local": "next dev",
"dev:cloud": "node scripts/use-env-cloud.mjs && next dev"
```
(env-copy script baad me — pehle sirf manual `.env.local` rakhna kaafi hai.)

### Step 6 — Verify
```powershell
npm run dev
```
Checklist:
- [ ] Login chal raha hai (local GoTrue me user banana padega — `supabase` ke
      Studio `http://127.0.0.1:54323` → Authentication → Add user se)
- [ ] Koi ek table page load ho rahi hai (RLS local par bhi active)
- [ ] Image upload chal raha hai (Storage buckets migration se bane honge)
- [ ] Realtime (Messages/typing/presence) connect ho raha hai

---

## 6. Open Risks / Notes

| # | Risk | Handle |
|---|---|---|
| 1 | `20260817_product_level_location - Copy.sql` duplicate version | Step 0 me remove |
| 2 | 13.9 GB free — Docker+images ~7 GB | Cleanup karo; WSL2 VHD `docker system prune` se manage |
| 3 | 8 GB RAM par stack slow | Docker RAM limit 4 GB; baaki apps band |
| 4 | Local GoTrue me users nahi honge | Studio se seed users, ya `supabase/seed.sql` |
| 5 | Local keys CLI version se badalte hain | `supabase status -o env` use karo, copy-paste |
| 6 | Docker Desktop reboot maang sakta hai | Ek baar allow kar dena |
| 7 | `.env.cloud` galti se commit | `.gitignore` me daalo **pehle** |

## 7. Rollback (kuch bigde to)

```powershell
npx supabase stop --no-backup      # local stack band
# Docker Desktop quitar kar do (chahiye to uninstall)
# .env.local wapas hosted Supabase URL/keys par point kar do
```
MariaDB scripts abhi untouched rehte hain — is plan se woh apne aap nahi
hatenge. Unka retirement alag task hai.

## 8. Baad Ka Kaam (is plan ke bahar)

- `supabase/seed.sql` banao (test users + sample data) — DB reset ke saath auto-run.
- MariaDB/`supabase-to-mariadb` + `/api/sync` retirement (jab confirm ho ki
  koi PHP-yug tool nahi padhta).
- Chaho to cloud→local one-way refresh (`supabase db dump` + restore).
- Real device offline (Capacitor SQLite) = Approach C, alag plan.

---

## 9. Aage Ka Pehla Command (jab resume karein)

```powershell
# Step 0 se shuru — pehle duplicate migration hatao, phir Docker install
Remove-Item "supabase\migrations\20260817_product_level_location - Copy.sql"
winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
```

*Banaya: 2026-09-17 — Supabase+Docker local setup ka concrete execution plan.*
