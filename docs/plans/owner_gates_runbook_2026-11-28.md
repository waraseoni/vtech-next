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
   **Partial (28 Nov):** owner ne `fault is_nullable = NO` verify kiya ✅;
   `service_types.expects_fault` values ka output abhi baaki hai.

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

Acceptance: `untagged` count girta hai, `no_service_type` 0 ya near-0, aur
`select public.get_jobs_stats(p_brand => 'untagged') ->> 'total';` bhi wahi dikhaata hai.
Abhi ka verified baseline: `brand_5_all=6, untagged=0, brand_5_KMK004=1, all_jobs=8`.

---

## Step 7 — Browser smoke (staff)

Tequal routes, console 0 errors:

- `/jobs/new` — New Installation bina fake fault ke save hota hai
- `/jobs/[id]/edit` — Repair par fault mandatory; deactivated service type ka purana job edit hota hai
- `/jobs/bulk` — per-row fault override
- `/jobs/bulk-edit` — legacy tagging column
- `/settings/service-center` — Service Types modal me "Fault required hai?" checkbox
- Navbar search — brand number (`KMK#004`) se job milta hai
- `/jobs?brand=5` → 6 rows, Quick Stats `Total 6`; `/jobs?brand=untagged` → 0

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

Aap bas 4 jawab dijiye — main code/docs usi hisaab se badal dunga (schema gate `verify:data` ke saath):

| #   | Decision                                                                            | Repo recommendation                                                                 | Aapka jawab |
| --- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------- |
| 1   | Backup format `4.0` accept? Purane `3.0` files ke liye `legacy` mode ya hard-block? | **Repo me choice nahi** — aap decide karein (recommendation: legacy read-only mode) | ?           |
| 2   | Restore me removed-column ko drop ya fail?                                          | **fail + explicit override** (silent strip nahi)                                    | ?           |
| 3   | JSON me `_meta.schema_snapshot.migration_ids` bhi store karein?                     | **haan** (browser + server + CLI tino writers)                                      | ?           |
| 4   | Live restore drill kab / kis environment me?                                        | staging Supabase project, har 3 mahine; pehli date aap dijiye                       | ?           |

Surfaces jo affect honge (#1/#3): `src/app/backup/page.tsx`, `src/lib/scheduledBackup.ts`,
`scripts/supabase-json-backup.mjs`, `docs/backup_restore_contract.md`, `docs/BACKUP_GUIDE.md`,
`public/tools/backup-restore-guide.html`. #2: dry-run message
`column(s) live schema me nahi — restore par strip honge` ko fail+override me badalna hai.
#4: agent live DB write nahi karta — staging me aap click karte hain, main checklist banata hoon.

---

## Step 10 — Final sign-off

Sab outputs yahan paste karein. Main docs/status update karke final commit banata hoon.
Push ke liye alag approval lenga.
