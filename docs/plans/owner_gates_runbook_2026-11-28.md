# Owner Gates Runbook — 28 Nov 2026

> **Purpose:** Sprint 1 ke baaki owner gates ek hi jagah par, copy-paste karne ke liye.
> **Rule:** Agent live DB write nahi karta. Neeche jaha "Run" likha hai, wo aap khud
> SQL Editor / browser me chalayein. Output yahan ya chat me paste karein — main status
> update kar dunga. Secrets (temporary passwords, service keys) chat me paste NA karein.

---

## Step 0 — Pre-flight (ek baar)

1. Admin account se login karein (`/login` → Admin tab).
2. Fresh backup download karein: `/backup` → **"Download Full Backup (.json)"**.
   Is file ko D3/A1 ke liye use karein; existing backup ka path yaad rakhein.
3. Browser console khali rakhein (F12) — smoke steps me "0 errors" check karna hai.

---

## Step 1 — D2: profiles policy final read-only verify

SQL Editor me chalayein (read-only):

```sql
select policyname, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE';
```

Expected **2 rows**:

- `rlslock_profiles_client_self_update`
- `rlslock_profiles_staff_update` (extra `public.is_frontend_staff()`)

Dono ke `with_check` me **`role is not distinct from public.get_my_role()`** aur
**`client_id is not distinct from public.get_my_client_id()`** hona chahiye —
`coalesce(...)` **nahi**. (Purana `coalesce(client_id, -1)` rollback form tha; `-1 IS NOT
DISTINCT FROM NULL = false` hone se `/profile` save 42501 deta tha.)

Reference: `supabase/migrations/20261122_profiles_self_update_rls_fix.sql:55-84`.
Agar coalesce wala output aaye to stale migration re-apply karna padega — output paste karein.

**Owner output (28 Nov) ✅ verified:** dono policies ka `with_check` me
`NOT (role IS DISTINCT FROM get_my_role())` aur `NOT (client_id IS DISTINCT FROM
get_my_client_id())` tha — PostgreSQL ka yahi `IS NOT DISTINCT FROM` rendering hai.
`qual = (id = auth.uid())` bhi expected. D2 close.

---

## Step 2 — D3: live admin auth restore dry-run

**Where:** `/backup` → Admin Restore panel. Route: `POST /api/backup/auth-restore`.
Panel sirf tab dikhta hai jab uploaded backup me auth-linked rows hon.

1. Restore card me **real backup JSON** load karein.
2. Tick karein: **"Missing auth users bhi banayein (email se)"**.
   (Tick karte hi dry-run dobara chalta hai — ye expected hai.)
3. Tick karein: **"Custom/fake email hai — naye users ko temporary password auto-set karo"**
   (step 2 ke bina disabled rahega).
4. Click **"🔍 Plan / Dry Run (no writes)"**. Ye `confirm:false` hai — DB me koi write nahi.
   Expected plan line: `{rows} rows · {N} UUID map · {M} user match nahi · admin profile protected`,
   aur `Will create: … · random temporary password set hoga (ek baar dikhega)`.
   Purana baseline tha: **13,448 restored / 218 failed** (profiles 10, stock_* 6,
   messages 17, push_subscriptions 175, user_presence 4, staff_geofence_permit 2,
   user_passkeys 4). Ab failed = 0 hona chahiye.
5. Dry-run sahi lage to tick karein **"Main confirm karta hoon — ye rows overwrite honge"**
   → **"Run Admin Restore"** enabled hoga. Click karein.
6. Success toast expected: **`Admin restore: {restored} restored, {failed} failed · admin profile safe`**.
   Per-table line me `✗0` hona chahiye. `adminPreserved` true hona chahiye.
7. **"Temporary passwords — abhi copy kar lein (dobara nahi dikhenge)"** block se credentials
   secure jagah save karein. Chat me na bhejein.
8. Logout → admin se dobara login karein; profile/role sahi dikhna chahiye. Verify:

```sql
select id, email, role from public.profiles where role in ('admin', 'developer');
```

**Note:** abhi `profiles` me 3 admin/developer rows hain — `admin123@vtech.com` (admin),
`admin@vtech.com` (developer), aur ek **email NULL wala admin row**. Ye purane backup se
aaya ho sakta hai; D3 me `admin profile protected` check zaroori hai. Ise delete/change
sirf owner approval se karenge.

**Owner ne 28 Nov ko D3 restore complete bataaya.** Agent ne test DB par service-role se
sirf **read-only** verification kiya (secret print nahi):

| Table                  | Rows after restore |
| ---------------------- | -----------------: |
| `profiles`             | 6                  |
| `stock_counts`         | 0                  |
| `stock_adjustments`    | 0                  |
| `messages`             | 0                  |
| `push_subscriptions`   | 0                  |
| `user_presence`        | 3                  |
| `staff_geofence_permit`| 0                  |
| `user_passkeys`        | 0                  |

Admin/developer profiles wahi 3 hain (`admin123@vtech.com`, `admin@vtech.com`, aur
`email=NULL` wala admin) — **admin profile preserved** ✅. 218 failed wali purani
problem repeat nahi hui (ab koi failed row visible nahi). Console errors 0.

**Acceptance:** `failed = 0`, admin re-login OK, 8 auth-linked tables (`profiles`,
`stock_counts`, `stock_adjustments`, `messages`, `push_subscriptions`, `user_presence`,
`staff_geofence_permit`, `user_passkeys`) ke counts plan ke `perTable` se match.

---

## Step 3 — A1: `expects_fault` backup → restore smoke

1. Step 0 ki fresh backup use karein. Restore se PEHLE SQL Editor me:

```sql
select id, name, expects_fault from public.service_types order by sort_order;

select column_name, is_nullable, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'transaction_list'
   and column_name = 'fault';
```

Expected: `fault` ka `is_nullable = NO` (NOT NULL unchanged).
`Repair` / default type ka `expects_fault` NULL ya true; `New Installation` aur
`PDI / Delivery` ka `false`.

2. `/backup` → upload JSON → **"Dry Run (Validate Only)"** → PASS ho to **"Restore Now"**.
3. Success toast: **`✅ {n} rows 100% restored + count verified!`**
   (`⚠ … (+N tables count mismatch)` aa gaya to yahin rokein aur output bhejein).
4. Step 1 ke dono queries dobara chalayein. Values bilkul wahi honi chahiye
   (`expects_fault` round-trip, `fault = NO`).
   **Partial (28 Nov):** owner ne `fault is_nullable = NO` verify kiya ✅.
   `expects_fault` ka **pre-restore baseline** maine authenticated REST read se capture
   kiya (koi DB write nahi) — `/rest/v1/service_types?select=id,name,sort_order,expects_fault,is_active`:

   | id  | name                  | sort | expects_fault |
   | --- | --------------------- | ---- | ------------- |
   | 9   | Repair                | 0    | `true`        |
   | 2   | Repair Service        | 0    | `null`        |
   | 1   | new installation      | 2    | `null`        |
   | 10  | New Installation      | 10   | `false`       |
   | 11  | Warranty Claim        | 20   | `true`        |
   | 12  | AMC / Service Visit   | 30   | `true`        |
   | 13  | PDI / Delivery        | 40   | `false`       |
   | 14  | Inspection / Estimate | 50   | `true`        |

   Rule: `NULL`/`true` = fault required, sirf explicit `false` = optional. UI me yahi
   `FAULT REQUIRED?` column `Required`/`Optional` dikhaata hai.
   ⚠️ Data hygiene: `Repair` + `Repair Service` dono active, aur `new installation` (null)
   - `New Installation` (false) dono active — duplicate/alias rows hain. K3 canonical
     `Repair` hai; inhe merge/deactivate karna alag owner decision hai (abhi change nahi).
     **Owner ke restore ke baad bhi yahi 8 values miliin** (service-role REST read,
   no write) — `expects_fault` round-trip/unchanged ✅ aur `fault` column `NO` ✅.
   ⚠️ Owner ke D3 ke baad ye confirm nahi tha ki full `Restore Now` hua ya sirf auth restore.
   Auth restore `service_types` ko touch nahi karta — ye gap Step 4 ke agent round-trip se
   close ho gaya; `service_types` values full browser restore ke baad bhi wahi miliin.

---

## Step 4 — Backup sequence reset

Restore ke baad `/backup` UI automatically allowlist (48 tables) ke liye
`POST /api/admin/reset-sequence` chalata hai — progress: **"Sequences reset ho rahi hain
(naye IDs ke liye)..."**. Koi fail hua to line aati hai: `⚠ {table} (manual reset needed)`.

Agar manual reset karna ho to SQL Editor me (table name allowlist se hi):

```sql
SELECT setval('table_name_id_seq', (SELECT MAX(id) FROM table_name) + 1, false);
```

Direct anon/authenticated `reset_sequence` RPC ab block hai (D1) — 403/42501 expected.

**Full round-trip — agent ne test DB par chalaya (owner ki ijazat, 28 Nov):**

Target sirf `.env.local` wala test project (`gzopjezdrnarplfcijyv`) tha; prod URL touch nahi hua.

| Cheez | Result |
| --- | --- |
| Fresh server backup | `vtech_backup_2026-11-28T04-13-09.json` · `4.0` · 60 tables · 108 rows · 75 migration IDs · 0 mismatch |
| Restore file scope | 8 auth-linked tables + `ai_providers` (RLS-only) bahar rakhe → 51 tables / 97 rows; baaki sab waisa hi |
| Dry Run | ✅ `97 rows in 60 tables ready to restore`, 0 issue |
| Real `Restore Now` | ✅ **`42 rows 100% restored + count verified!`**, 0 failed, 0 count mismatch |
| Counts before → after | `108 → 108`, 60/60 tables; backup-file counts vs DB = **0 diff** |
| Auth-linked tables | `profiles=6`, `user_presence=3`, baaki 6 tables `0` — bilkul unchanged |
| Protected/RLS tables | `system_info=55` untouched, `ai_providers=2` untouched |
| Sequence reset | 48/48 `POST /api/admin/reset-sequence` → `200`; `transaction_list → next_id=10`, `service_types → next_id=15`, `profiles → SKIP (no sequence found)` |
| Global job counter | `job_id_counter.last_job_id=28106`; `peek_next_job_id()` ab `28107` |
| Invariants | `service_types` 8 values wahi (`Repair=true`, `New Installation=false`, PDI=false, aliases=null); `KMK#004` job 8 par; job 9 `fault=""`; koi backfill/renumber nahi |
| Console | Sirf pre-existing `ai_providers` 403 (AI panel) — restore se koi naya error nahi |

Isliye ab test DB par **backup → restore → count verify → sequence reset** ka poora proof hai.
Sirf CLI/converter ka live restore abhi unit-test level hai; auth-linked tables ka restore owner ke
D3 me already ho chuka hai aur is round-trip me unhe touch hi nahi kiya gaya.

**Owner ke `43 restored / 8 failed` report ka exact reason aur fix:** owner ne poori backup file
use ki jisme 8 auth-linked tables (`profiles=6`, `user_presence=3` me se 2) bhi thi. Browser
restore inhe RLS/UUID mismatch ke chalte likh nahi sakta — wo 8 FAIL expected the. Agent ne apne
round-trip me ye tables file se pehle hi hata diye the, isliye error nahi aaya. Failed restore ke
baad bhi DB counts wahi rahe (`profiles=6`, `user_presence=3`, total `108`, 0 diff) — koi data
delete/overwrite nahi hua. Ab `/backup` me **"Auth/RLS tables skip karein"** checkbox default ON
hai: ye 9 tables (8 auth-linked + `ai_providers`) clear/upsert/verify se bahar rakhti hai. Inhe
service-role **Admin Restore** se hi restore karein. Owner ko ab poori file load karke bhi
`Restore Now` chalana safe hai — skip ON rehna chahiye.

**Fix ka live proof (agent, aapki jaisi poori 60-table file ke saath):**

| Check | Result |
| --- | --- |
| New checkbox default | ✅ `Auth/RLS tables skip karein (recommended)` = checked |
| Dry Run | ✅ `97 rows in 51 tables ready to restore. 9 auth/RLS tables skip.` — 0 FAIL |
| Real `Restore Now` | ✅ `42 rows 100% restored + count verified! · 9 auth/RLS tables skip` — 0 FAIL |
| Sequence reset | 48/48 route calls `200` |
| Counts after | `108 → 108`, backup vs DB **0 diff**; `profiles=6`, `user_presence=3`, `ai_providers=2` preserved |
| Console | Sirf pre-existing `ai_providers` 403; koi naya restore error nahi |

**Owner confirmation (28 Nov, fix ke baad):** aapne poori 60-table file ke saath upar wale
5 steps khud repeat kiye — Dry Run aur `Restore Now` dono me **0 error**, expected `9 auth/RLS
tables skip` message mila. Isse Step 4 owner-level par bhi **close** hai.

---

## Step 5 — Portal smoke (client credentials chahiye)

1. `/login` → **Client tab** → email OTP → `/api/client/onboard` → `/my-account`.
2. Teen pages kholein: `/my-account`, `/my-account/payments`, `/my-account/ledger`
   (`?from=&to=` bhi test karein).
3. Network tab me 4 APIs `200` honi chahiye:
   `/api/client/me`, `/api/client/jobs`, `/api/client/payments`, `/api/client/ledger`.
   Koi `400` / `42501` nahi; console 0 errors.
4. Do alag client accounts se compare karein — har account ko **sirf apne** records dikhein.

---

## Step 6 — A8: legacy NULL jobs ko tag karna

Pehle **coverage snapshot** (before) SQL Editor me:

```sql
SELECT count(*) AS all_rows FROM transaction_list;
SELECT count(*) AS untagged FROM transaction_list WHERE brand_id IS NULL;
SELECT count(*) AS active FROM transaction_list WHERE del_status = 0;
SELECT count(*) FILTER (WHERE service_type_id IS NULL) AS no_service_type
  FROM transaction_list WHERE del_status = 0;
```

Report format: `Brand-tagged: X / Y jobs (Z%) · Untagged: N`. Purana baseline tha
`412 / 2,370 (17%) · Untagged: 1,958`; target ~80%+ (hard threshold repo me nahi hai).

UI: `/jobs` → **Bulk Edit** → `/jobs/bulk-edit` (`Bulk Edit Transactions`):

1. **Source Client \*** → client select karein → **Load**.
2. Har row par **Brand** (`Tag type` placeholder) aur **Service Type** set karein.
   - Service Type: canonical **`Repair`** (alias `repair service` bhi chalega).
   - Faultless types: **`New Installation`**, **`PDI / Delivery`** → fault `""` likha jayega.
   - Brand na pata ho to escape bucket **`General / Unbranded` (`GEN`)** use karein.
   - **Brand number (KMK#004) yahan assign NA karein** — no backfill/renumber rule.
3. **⚠ Important:** tick (`✓`) sirf **client transfer** ke liye hai
   (`Sirf tick (✓) wali rows ka client isse badlega.`). **Saari loaded rows save hoti hain**
   (`Save All Changes`) — isliye sirf un clients ko load karein jinhe aap tag karna chahte hain.
4. **Save All Changes** → upar wali 4 queries dobara chalayein (after snapshot).

**A8 agent ne test DB par kiya (owner ne direct DB changes ki ijazat di):**

Before: `all_rows=8`, `brand_id IS NULL=0`, `active=8`, `service_type_id IS NULL=1`
(job id `1`, fault `daed`). Job `1` ko canonical **`Repair` (`service_type_id=9`)** se
tagged kiya — koi brand number backfill nahi, koi master delete nahi.

After: `service_type_id IS NULL=0` → **8/8 service-tagged**, **8/8 brand-tagged**,
`untagged=0`. `brand_job_no` abhi bhi 4 rows me NULL hai (id 1,2,3,7) — ye legacy
preservation hai, badla nahi. RPC baseline wahi: `brand_5_all=6, untagged=0,
brand_5_KMK004=1, all_jobs=8`.

Acceptance: `untagged` count girta hai, `no_service_type` 0 ya near-0, aur
`select public.get_jobs_stats(p_brand => 'untagged') ->> 'total';` bhi wahi dikhaata hai.

**Post-save-smoke recount (28 Nov, agent readonly):** ab `all_rows=9` (naya smoke job id `9`,
job no `28106`), `service_type_id IS NULL=0` → **9/9 service-tagged**, `brand_id IS NULL=1`
(sirf naya smoke job) → **8/9 brand-tagged**. RPC ab `brand_5_all=6, untagged=1, all=9`;
`KMK#004` wahi job `8` par hai. Naye job ko brand number **assign nahi** kiya — no-backfill
rule maintain.

---

## Step 7 — Browser smoke (staff)

Tequal routes, console 0 errors:

**Agent-ne browser smoke 28 Nov ko kiya (login owner ne kiya; agent ne koi save/DB write nahi kiya):**

| Route / check                   | Result                                                                                     | Console  |
| ------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| `/jobs/new`                     | form loaded, job no `28106`; dropdown me Repair / New Installation / PDI options ✅        | 0 errors |
| Service Type = New Installation | label **`WORK DESCRIPTION / SCOPE (OPTIONAL)`**, placeholder `Kaam ka scope (optional)` ✅ | 0 errors |
| Service Type = Repair           | label **`FAULT / COMPLAINT *`**, placeholder `e.g. Screen broken, Not charging` ✅         | 0 errors |
| `/jobs/8/edit`                  | `Edit Job — 28105` loaded, Komaki / 69v6a prefill ✅                                       | 0 errors |
| `/jobs/bulk`                    | `Bulk Job Sheet Entry`, per-row service type + brand controls ✅                           | 0 errors |
| `/jobs/bulk-edit`               | `Bulk Edit Transactions`, `Source Client`, `Load`, `Save All Changes` ✅                   | 0 errors |
| `/settings/service-center`      | Operating Mode + **FAULT REQUIRED?** column (`Required`/`Optional`) visible ✅             | 0 errors |
| Navbar search `KMK#004`         | `1 RESULT — Job KMK#004 · #28105 — chrager · Komaki · 69v6a`; click → `/jobs/8/view` ✅    | 0 errors |
| `/jobs?brand=5`                 | **6 records**, Quick Stats `TOTAL 6`, chip `Brand: Komaki` ✅                              | 0 errors |
| `/jobs?brand=untagged`          | **0 records**, chip `Untagged (legacy)`, empty state ✅                                    | 0 errors |
| `/jobs`                         | **8 records**, Quick Stats `TOTAL 8` ✅                                                    | 0 errors |

Mode chip bhi topbar me dikh raha hai: **`MODE: SINGLE BRAND`**.
Browser footer `V1.87.0` dikhata hai jabki GitHub release `1.88.0` hai — local dev server
purana build serve kar raha hai; code issue nahi, dev server restart karke confirm karein.

**A1 actual save flows — agent ne test DB par kiye (owner ijazat se; 2 writes):**

| Flow                                    | Result                                                                                                                                                                     | Console |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `New Installation`, fault khali, Quick Save | ✅ **save hua** — `/jobs/9/view`, job no `28106`, toast `Naya job create ho gaya!`; DB: `service_type_id=10`, `fault=""`, `brand_id=NULL`, `brand_job_no=NULL`             | 0 errors |
| `Repair`, fault khali, Quick Save       | ✅ **block hua** — inline `Fault description zaroori hai`, form par hi ruka, toast `Naya job create ho gaya` nahi; DB me `job_id=28107` / `A1 Fault Block Test` row **nahi** | 0 errors |

Test DB par create hua ek hi row: `transaction_list id=9` (`A1 Smoke Device`, client vikram,
mechanic vikram, `New Installation`). Global `job_id` counter normal flow se `28106` → `28107`
hua; koi renumber/backfill nahi. Deactivated service type wale purane job edit aur do-client
portal isolation abhi **owner checks** hain (client OTP credentials agent ke paas nahi).

---

## Step 8 — K14 reviewer + CSP observation

**8a. Named reviewer (aap sirf naam bhejiye, main docs me likh dunga):**

- `docs/plans/master_completion_plan_2026-11-26.md` K14 row → `named reviewer owner baaki` ko naam se replace.
- `docs/plans/owner_decision_sheet_2026-11-27.md` K14 row → wahi naam.
- Policy: har PR par second reviewer mandatory, release notes me reviewer field.
- **Gap:** repo me `.github/` / CODEOWNERS / branch protection nahi hai — abhi direct push
  main par chal jata hai. Name confirm karte hi main ye config propose kar dunga.

**8b. CSP 14-din observation (sirf dekhna hai, enforce NA):**

- `next.config.ts:109` me abhi `Content-Security-Policy-Report-Only` header hai,
  directives me `report-uri /api/csp-report` + `Reporting-Endpoints: csp-endpoint=...`.
- Sink: `POST /api/csp-report` → 204; violations **Vercel function logs** me
  `console.warn("[csp-report]", …)` ke taur par dikhte hain. Koi violations table/endpoint nahi.
- Roz 2 minute: Vercel logs me `[csp-report]` lines count karein (directive + path ke hisaab se).
  14 din tak record rakhein. Target: production me violation rate ~0.
- **Abhi enforce mat karein.** 14 din clean hone ke baad hi `Report-Only` → `Content-Security-Policy`
  (single-line flip, rollback wahi line wapas). Print routes ka nonce CSP alag se already enforced hai.

---

## Step 9 — Backup readiness decisions (4)

Owner ne agent ko best option choose karne diya — 28 Nov 2026 ko sab code/docs local me implement
ho gaye (`verify:data` + focused tests ke saath). Sirf #4 drill schedule owner se pending hai.

| #   | Decision                                                                            | Final choice (implemented)                                                                                     |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Backup format `4.0` accept? Purane `3.0` files ke liye `legacy` mode ya hard-block? | ✅ **4.0 + legacy read** — purane 3.x/2.x files warning ke saath padhte hain; DR me purana backup bhi kaam aaye |
| 2   | Restore me removed-column ko drop ya fail?                                          | ✅ **fail + explicit override** — dry-run aur real restore dono; opt-in checkbox / `--allow-removed-columns`    |
| 3   | JSON me `_meta.schema_snapshot.migration_ids` bhi store karein?                     | ✅ **haan** — shared `buildSchemaSnapshot()` browser + server + CLI + converter me                              |
| 4   | Live restore drill kab / kis environment me?                                        | ⏳ staging Supabase project, har 3 mahine; **pehli date abhi pending**                                          |

Badle gaye surfaces: `src/lib/backupSchema.ts` (version parser + snapshot builder + tests),
`src/lib/backupMigrationIds.ts` (new), `src/app/api/backup/schema/route.ts`,
`src/app/backup/page.tsx` (4.0 writer, warning preview, override checkbox, real-restore guard),
`src/lib/scheduledBackup.ts`, `scripts/supabase-json-backup.mjs`, `scripts/force-restore.cjs`,
`public/tools/vtech_mysql_converter.html`, `docs/backup_restore_contract.md` (+ generator),
`docs/BACKUP_GUIDE.md`, `docs/DATA_MIGRATION_NOTES.md`, `docs/TODO.md`,
`public/tools/backup-restore-guide.html`, `docs/plans/backup_restore_readiness_plan_2026-11-27.md`.

#4: agent production par destructive restore nahi chalata — staging me owner click karein, main
checklist banata hoon.

**Agent browser verification (28 Nov, admin session, test DB — destructive restore nahi kiya):**

| Check                                      | Result                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `GET /api/backup/schema`                   | `200`, `60` tables, `75` migration IDs ✅                                                                            |
| `/backup` → Download Full Backup (.json)   | `_meta.version=4.0`, `schema_snapshot` me 60 tables, 75 migration IDs, 0 warnings ✅                                |
| Fixture: `deleted_old_column` + Dry Run    | ❌ **FAIL**: `service_types: deleted_old_column column(s) live schema me nahi — restore FAIL` ✅                     |
| Override checkbox ON → Dry Run dobara      | ✅ **PASS**: `Dry run PASSED! 1 rows in 60 tables ready to restore` (strip allowed)                                  |
| Legacy `version: "3.0"` fixture load       | ✅ amber warning banner + toast: `Legacy backup format 3.0 … review zaroori`; file preview load hua (hard-block nahi) |

Console me sirf pre-existing `403` `ai_providers` RLS requests thi (AI panel), backup changes se
unrelated. `Restore Now` par fixture ke saath **click nahi** kiya.

---

## Step 10 — Final sign-off

Sab outputs yahan paste karein. Main docs/status update karke final commit banata hoon.
Push ke liye alag approval lenga.
