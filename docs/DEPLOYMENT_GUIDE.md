# Naya Client Deploy Karne Ki Complete Guide

> **Har step ka order matter karta hai. Upar se neeche ek-ek karke karo.**

---

## Pehle Samjho — Kya Kahan Hota Hai

```
┌─────────────────────────────────────────────────────────────┐
│  SELLER (aap)                                               │
│  ├── Central Licensing Supabase Project → license store     │
│  ├── Vercel Deployment (seller portal + developer portal)   │
│  └── GitHub Repo (source code)                              │
├─────────────────────────────────────────────────────────────┤
│  CLIENT (naya customer)                                     │
│  ├── Naya Supabase Project → client ka apna DATA            │
│  ├── Naya Vercel Project → client ka app                    │
│  └── License Key (seller se milti hai)                      │
└─────────────────────────────────────────────────────────────┘
```

**Important:** Setup page (`/setup`) sirf **admin user banata hai** — DB schema nahi
banata. **DB schema manual dalna padta hai** (neeche steps hain).

---

## STEP 1 — Client Ka Naya Supabase Project Banao

1. https://supabase.com/dashboard → **New Project**
2. **Project Name:** client ke naam se (e.g., `ratan-electronics`)
3. **Database Password:** strong password — **ye save karo, baad me zaroorat padegi**
4. **Region:** client ke nazdik wala (India me `ap-south-1`)
5. **Plan:** Free kaafi hai
6. **Create** → ~2 minute wait karo

Project banne ke baad:
- **Settings → API** → ye 3 cheezein copy karo:
  - `Project URL` → `https://xxxxx.supabase.co`
  - `anon` (public) key
  - `service_role` (secret) key
- **Settings → Database → Connection string → Direct** → copy karo (port 5432 wala)

---

## STEP 2 — Schema Dalne Ka Tarika (2 Options)

### Option A: SQL Editor Se (Recommended — Simple)

1. Supabase Dashboard → **SQL Editor** → **New Query**
2. `backups/supabase/00_drop_all.sql` ka content paste karo → **Run**
   - Ye koi cheezein na bhi ho to chalega (IF EXISTS hai)
3. Phir `backups/supabase/baseline_schema.sql` ka content paste karo → **Run**
   - Ye sab kuch banayega: tables, RLS, functions, triggers, indexes, buckets, seed data

**Verify karo** — SQL Editor me ye run karo:
```sql
-- Kitne tables aaye (36 hona chahiye)
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- RLS policies (sahi count aana chahiye)
SELECT count(*) FROM pg_policies WHERE schemaname = 'public';

-- Functions (5 hona chahiye)
SELECT count(*) FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public';

-- Seed data check
SELECT meta_value FROM system_info WHERE meta_field = 'name';
-- 'V-Technologies' aana chahiye
```

### Option B: Supabase CLI Se (Advanced)

```powershell
# 1. CLI install (ek baar)
npm install -g supabase

# 2. Login (ek baar)
supabase login

# 3. Client project se link karo
supabase link --project-ref <CLIENT_PROJECT_REF>
# DB password puchega — Step 1 me jo password diya tha wo daalo

# 4. Schema push karo
supabase db push
```

> **Note:** CLI method me `supabase/migrations/00_full_schema.sql` use hota hai
> automatically. Par isme RLS nahi hai (intentionally). Agar chahiye to
> `baseline_schema.sql` use karo SQL Editor method se.

---

## STEP 3 — Vercel Par Client Ka Naya Project Deploy Karo

### Tareeka A: GitHub Se (Recommended)

1. GitHub me **naya repo** banao (private) — e.g., `ratan-electronics-app`
2. Apne main repo ka code clone karo aur naye repo me push karo:
   ```powershell
   git clone https://github.com/YOUR_USER/vtech-frontend.git
   cd vtech-frontend
   git remote add client https://github.com/YOUR_USER/ratan-electronics-app.git
   git push client main
   ```
3. https://vercel.com → **New Project** → GitHub repo select karo
4. **Framework Preset:** Next.js (auto-detect ho jayega)
5. **Root Directory:** `./` (default)
6. **Build & Deploy** → abhi mat karo — pehle environment variables daalo

### Tareeka B: Vercel CLI Se

```powershell
npm i -g vercel
vercel login
vercel --prod
```

---

## STEP 4 — Environment Variables Set Karo

Vercel Dashboard → Client Project → **Settings → Environment Variables**

### Required (zaroori):

| Variable | Value | Kahan se milega |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Step 1 — Supabase Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Step 1 — Supabase Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Step 1 — Supabase Settings → API → service_role key |
| `LICENSE_SERVICE_URL` | `https://xxxxx.supabase.co` | Aapke central licensing project ka URL |
| `LICENSE_SERVICE_ANON_KEY` | `eyJ...` | Aapke central licensing project ka anon key |

### Optional (par recommended):

| Variable | Value | Purpose |
|---|---|---|
| `SETUP_TOKEN` | `koi-strong-token` | Setup page par token required karta hai |
| `GEMINI_API_KEY` | `your_key` | AI features ke liye |

### Setup Token Kaise Generate Karein

```powershell
# PowerShell me
-join ((1..24) | ForEach-Object { 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' | Get-Random -Count 1 })
```

Ye token client ko dena hai — wo `/setup` page par dalenge.

> **Agar SETUP_TOKEN set NAHI kiya** to koi bhi `/setup` page khol kar admin
> ban sakta hai. **Token set karna strongly recommended hai.**

---

## STEP 5 — Deploy & Setup Page

1. Vercel me **Deploy** button dabao
2. Deploy hone ke baad client ka URL milega: `https://ratan-electronics.vercel.app`
3. Browser me kholo → `/setup` page apne aap dikh jayega
4. Client ko bolo:
   - **Full Name** daale
   - **Email** daale
   - **Password** daale (6+ characters)
   - **Setup Token** daale (agar set kiya hai)
   - **"Create Admin & Continue"** click kare
5. Admin banne ke baad → login page par redirect hoga
6. Ab client login kar sakta hai!

---

## STEP 6 — License Activation

1. Client ko license key do (seller portal se generate ki hui)
2. Client login kare → **Settings → License Activation**
3. Key daale → **Activate** click kare
4. Dashboard unlock ho jayega

---

## STEP 7 — Client Ko Dene Ki Cheezein

Client ko ye bolo:

```
1. App ka URL: https://ratan-electronics.vercel.app
2. Login credentials: (jo admin banate waqt dale)
3. License Key: VTC-XXXX-XXXX-XXXX-XXXX
4. Settings → License Activation me key daal ke Activate kare
5. Baaki users (staff) Settings → Users se add kare
```

---

## Quick Reference — Saari Files

| File | Kahan | Kya karta hai |
|---|---|---|
| `backups/supabase/00_drop_all.sql` | SQL Editor | Purana schema clean karta hai |
| `backups/supabase/baseline_schema.sql` | SQL Editor | Naya schema banata hai (TWIN of live DB) |
| `supabase/migrations/00_full_schema.sql` | SQL Editor | Alternative schema (RLS nahi hai) |
| `docs/licensing/central-project.sql` | Central project | Licensing DB setup |
| `.env.example` | Repo root | Environment variables ka template |

---

## Setup Page Kya Karta Hai — Kya NAHI Karta Hai

| Karta Hai ✅ | NAHI Karta Hai ❌ |
|---|---|
| Pehla admin user create karta hai | DB schema nahi banata |
| Email/password set karta hai | Tables nahi banata |
| Profile me role=admin set karta hai | Storage buckets nahi banata |
| Token verify karta hai (agar set hai) | RLS policies nahi lagata |
| Login page par redirect karta hai | License activate nahi karta |

**Isliye DB schema manual dalna zaroori hai (Step 2).**

---

## Common Errors

| Error | Fix |
|---|---|
| `relation "public.profiles" does not exist` | Schema nahi dala — Step 2 karo |
| `permission denied for table` | RLS policy galat hai ya table nahi bani |
| `Setup already complete` | Admin pehle se hai — `/login` par jao |
| `Setup token galat hai` | `.env` me jo token hai wo daalo |
| `Role escalation not allowed` | Trigger kaam kar raha hai — sahi hai! |
| Build fail on Vercel | Environment variables missing hain — Step 4 check karo |

---

## Maintenance — Schema Update Karna

Agar baad me schema me koi column add karna ho:

```sql
-- SQL Editor me run karo
ALTER TABLE public.product_list ADD COLUMN IF NOT EXISTS new_column text;
```

> **Dhyan:** `baseline_schema.sql` me bhi update karo taaki agle client ke liye
> fresh setup me bhi naya column aaye.

---

## DB Backup/Restore Tools

### pg_dump — Full Database Backup

```powershell
# Schema only (client ke liye naya setup)
node scripts/supabase-dump.mjs

# Schema + data (complete backup)
node scripts/supabase-dump.mjs --full

# Sirf data (schema nahi)
node scripts/supabase-dump.mjs --data-only

# Custom filename
node scripts/supabase-dump.mjs --output my-backup.sql

# Clean mode (DROP + CREATE statements include)
node scripts/supabase-dump.mjs --clean
```

**Prerequisites:** `pg_dump` installed hona chahiye:
```powershell
# Windows
scoop install postgresql

# Mac
brew install postgresql

# Linux
sudo apt install postgresql-client
```

**Connection:** `.env.local` me `SUPABASE_DB_PASSWORD` + `NEXT_PUBLIC_SUPABASE_URL`
hona chahiye. Ya directly `--db-url` flag do.

### Restore — Database Me Data Wapas Dalna

```powershell
# Dry run (sirf check, execute nahi)
node scripts/supabase-restore.mjs backup.sql --dry-run

# Actual restore
node scripts/supabase-restore.mjs backup.sql

# Force (confirmation bina)
node scripts/supabase-restore.mjs backup.sql --force
```

**Prerequisites:** `psql` installed hona chahiye (same as pg_dump).
