# Supabase CLI — Install se Schema Dump tak (Windows/PowerShell)

Ye guide batati hai ki **Supabase CLI** kaise install karo, seller ke Supabase
project se **schema dump** kaise nikaalo, aur us dump ko client ke naye project
me kaise lagao. Sab commands **PowerShell** ke liye hain.

> Dump ka matlab: sirf **structure** (tables, columns, RLS, functions, triggers,
> sequences) — **data nahi**. Har client apna data khud start karta hai.

---

## 1. Prerequisites

| Requirement | Kya | Kyun |
|---|---|---|
| **Node.js 18+** | `node --version` check karo | npm method ke liye |
| Supabase account | Dashboard access | Login + token ke liye |
| **Docker** | (Optional) | Sirf local dev ke liye — dump ke liye **zaroori nahi** |

Check:
```powershell
node --version
```

---

## 2. CLI Install (koi ek tareeka)

### Tareeka A — npm (recommended, kyunki repo already Node hai)

```powershell
npm install -g supabase
```

### Tareeka B — Scoop (Windows)

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Tareeka C — Direct download

GitHub releases se binary download karo:
https://github.com/supabase/cli/releases/latest
→ Windows `supabase_windows_amd64.zip` → unzip → PATH me daalo.

### Verify

```powershell
supabase --version
```

Version number dikhe → install ho gaya.

---

## 3. Login (ek baar)

```powershell
supabase login
```

- Browser khulega → GitHub/Supabase se login → **Access Token** generate hoga.
- Token `%USERPROFILE%\.supabase\access-token` me save ho jata hai.
- Browser na khule to: https://supabase.com/dashboard/account/tokens → **Generate
  new token** → us token ko `%USERPROFILE%\.supabase\access-token` file me paste
  karo (bina koi spacing ke).

---

## 4. Project init + Link (seller project se jodna)

### 4a. Project initialize (pehli baar, ek baar)

Repo ke andar (jahan `supabase/` folder hai — ye repo already hai):

```powershell
supabase init
```

Isse `supabase/config.toml` banega. **Existing `supabase/migrations/` ko nahi
chhoDega.** (Kuch nahi delete hota.)

### 4b. Seller project ka REF dhoondo

Supabase Dashboard → seller project → **Settings → General** → **Reference**
(wo `abcxyz` jaisa chhota id, URL me `https://abcxyz.supabase.co` wala hissa).

### 4c. Link karo

```powershell
supabase link --project-ref <REF>
```

- **DB password** pochega → seller project ka database password daalo.
- Isse CLI ko pata chalta hai ki kiska project dump karna hai.

> Kabhi galat project se na jude iske liye `supabase link --project-ref <REF>`
> hamesha explicit ref ke saath hi chalao.

---

## 5. Schema Dump (main step)

```powershell
supabase db dump --schema public -f schema_full.sql
```

- `schema_full.sql` — poora **public** schema (tables, columns, defaults, PK/FK,
  indexes, **RLS policies**, **functions**, **triggers**, sequences).
- Default **DDL-only** hai → data include **nahi** hota (yehi chahiye).
- `auth`, `storage`, extension schemas automatically **exclude** hote hain.

### Flags (aur kya-kya kar sakte ho)

| Flag | Kaam |
|---|---|
| `--schema public` | Sirf public schema (recommended) |
| `-f file.sql` | Output file me save |
| `--data-only` | Sirf data (schema nahi) |
| `--role-only` | Sirf roles/grants |
| `--db-url "postgresql://..."` | Bina link kiye direct connection se dump (Settings → Database → Connection string → **Direct** (port 5432), pooler nahi) |

### Dump ka content verify karo

```powershell
notepad schema_full.sql   # ya VS Code me kholo
```

`CREATE TABLE public.client_list` jaisi lines dikhni chahiye. Kuch `CREATE
POLICY`, `CREATE OR REPLACE FUNCTION` bhi dikhe to sahi hai (RLS + functions
included). Data nahi dikhna chahiye (koi `INSERT INTO` nahi).

> Bonus: isi dump ko repo me `supabase/migrations/0000_baseline.sql` ke roop me
> commit kar do — phir har client ke liye sirf `supabase db push` se poora
> schema lag jata hai (manual paste nahi).

---

## 6. Dump ko Client ke Project me lagna

### Tareeka A — Dashboard SQL Editor (no CLI)

1. Client ka naya Supabase project banao.
2. **SQL Editor → New Query**.
3. `schema_full.sql` kholo → `Ctrl+A` → `Ctrl+C` → editor me `Ctrl+V`.
4. **Run** (`Ctrl+Enter`).
5. `supabase/migrations/20260808_storage_buckets.sql` ka content bhi run karo
   (storage buckets — dump `storage` schema include nahi karta).

### Tareeka B — psql se (file seedha daal do)

```powershell
psql "postgresql://postgres.<CLIENT_REF>:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres" -f schema_full.sql
```

(Direct connection port 5432 use karo; pg_dump/psql ko pooler na chahiye.)

### Tareeka C — Baseline migration + db push

1. `schema_full.sql` ko `supabase/migrations/0000_baseline.sql` bana do.
2. Har client project ke liye:
   ```powershell
   supabase init
   supabase link --project-ref <CLIENT_REF>
   supabase db push
   ```

---

## 7. Verify (client project me)

SQL Editor me run karo:

```sql
-- kitne tables aaye
select count(*) from information_schema.tables where table_schema = 'public';

-- RLS policies
select count(*) from pg_policies where schemaname = 'public';

-- functions
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

-- sequences reset check (schema-only dump se sequences default par hote hain)
select count(*) from client_list;   -- 0 aana chahiye (data nahi aaya, theek hai)
```

Table Editor me bhi dekh lo — saare tables dikhne chahiye.

---

## 8. Common Errors & Fixes

| Error | Fix |
|---|---|
| `supabase: command not found` | npm global PATH me nahi → `npm install -g supabase` dobara, ya terminal restart karo |
| Login par browser nahi khula | Manual token: Dashboard → Account → Access Tokens → `~/.supabase/access-token` me paste |
| `Authorization failed ... Forbidden resource` | Token ka account us project ka owner nahi, ya galat REF. `supabase link --project-ref <sahi_ref>` |
| `password authentication failed` | Link ke time sahi DB password daalo (Settings → Database → Connection string se confirm) |
| Dump me `auth` schema bhi aaya | `--schema public` flag lagao |
| Client par restore me function fail | Error message copy karo — usually `create extension` ya role issue; `supabase db dump --role-only` bhi le ke pehle run karo |
| Port in use (54322/5433) | Sirf local `supabase start` me hota hai — dump ke liye irrelevant |

---

## 9. CLI Update

```powershell
# npm se install kiya tha to:
npm update -g supabase

# scoop se:
scoop update supabase
```

> **Safety tip:** Schema dump koi data expose nahi karta, par agar aap `--data-only`
> ya full dump karte ho to us file ko kabhi git/public me mat daalo. `schema_full.sql`
> ko `.gitignore` me rakhna chaaho to ye repo ka `.gitignore` pehle se `vtech_backup_*.json`
> jaise patterns cover karta hai — dump file ke liye apna naam alag rakho.
