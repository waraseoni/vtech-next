# Backup/Restore Tooling Fix Plan — Lossless Backups

Created: 2026-09-17 · Status: **IMPLEMENTATION STARTED (code-only, no live-DB writes)** —
Phase 1–4 done; Phase 5 leftover/6 user tasks open. **Live DB par koi data change/loss allowed nahi.**
Phase 4 (CLI `supabase-json-backup.mjs`) live-validated 2026-09-17 (51 tables, 10253 rows, count verify PASS) + one bug fixed (CLI bucket-create 400-duplicate tolerance).

---

## 1. Problem summary (audit findings)

### 1.1 Backup page (`/backup`) — data uske paas jaata hi nahi

- `BACKUP_TABLES_ORDERED` = 35 tables; **17 live tables missing** → unka data JSON backup me kabhi nahi.
- Missing (business-critical): `profiles`, `client_contacts`, `supplier_contacts`,
  `supplier_contact_persons`, `supplier_contact_phones`, `supplier_payments`, `bom_templates`,
  `job_required_parts`, `stock_counts`, `stock_adjustments`, `messages`, `location_zones`,
  `location_racks`, `location_bins`, `location_boxes`. (Ephemeral: `login_throttle`, `user_presence`.)
- Fetch error par silently `break`/`[]` + toast "Backup ready!" bina fetched==count verify ke.

### 1.2 Restore — column strip = silent loss

- `TABLE_COLUMNS` (hardcoded) se bahar ke live columns restore par **strip**:
  - `transaction_products`: **`id` LOST** (page abhi composite-PK (`transaction_id`,`product_id`) logic
    use karta hai; **live PK = `id`** single, `product_id` NULLABLE)
  - `suppliers`: `photo_url, gstin, bank_account, bank_ifsc, credit_limit, payment_terms, city, state`
  - `purchase_orders`: `transaction_id, contact_person_id`
  - `transaction_list`: `location_id`
  - `expense_list`: `supplier_id, supplier_payment_id`
  - `locations`: `kind`
- Restore **non-transactional**: reverse-order clear → forward upsert; beech me fail = khaali/सurface
  restored state (manual re-run needed).

### 1.3 Lifecycle / tooling

- `scripts/supabase-restore.mjs --dry-run` actually **SQL EXECUTE** kar deta hai (echo-all) — live-DB landmine.
- `scripts/force-restore.cjs` file expect: `vtech_backup_restore.json`; page downloads
  `vtech_backup_<ts>.json` → direct use impossible bina rename ke.
- `resetSequences()` list me naye tables nahi.
- `pg_dump/psql` installed nahi; `.env.local` me `SUPABASE_DB_PASSWORD`/`DATABASE_URL` nahi →
  `supabase-dump/restore.mjs` abhi `"URL nahi mila"` fail.
- `auth.users` (login accounts) + **Storage objects (images)** DONO me se kisi bhi tool me nahi →
  sirf Supabase platform backup/PITR ke through (Dashboard → Database → Backups — aapka manual check).

## 2. Design decisions (locked)

| #   | Decision                | Choice                                                                                                                                                                                                                    | Rationale                                                         |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| D1  | Columns source of truth | **Live schema (runtime), hardcoded nahi** — naya admin API `/api/backup/schema` (service-role, OpenAPI se build, pattern `scripts/supabase-to-mariadb.mjs fetchSchema()`)                                                 | Drift dubara kabhi nahi; page me static lists nahi                |
| D2  | Table list              | **Runtime = ALL live public tables** (manual blocklist sirf ephemeral: `user_presence`, `login_throttle`)                                                                                                                 | 15 missing + future tables automatic cover                        |
| D3  | Restore order           | Explicit ordered list rakho (D1 se columns/tables dynamic, **order manual + verify**) — FK-parent-first; golden list §4                                                                                                   | PostgREST OpenAPI se FK relation nahi milti; order pin karna safe |
| D4  | transaction_products    | **Single-PK mode (`id`)** — composite logic sirf tab jab live PK cheat-check confirm (`/api/backup/schema` se PK info)                                                                                                    | Live schema PK=id; composite = MariaDB-era buzz                   |
| D5  | Count safety            | Backup: per-table `fetched==exact count` (already `head:true` count list hai) fail par **HARD warn + row-par visibility**; Restore: baad me `db count == file rows` mismatch = **HARD fail report**, koई silent skip nahi | Silent partial backup/restore = sabse bada risk                   |
| D6  | Dry-run                 | **True dry-run**: parse file + validate tables/columns/PK presence + prefetch counts; **kabhi SELECT se aage nahi**                                                                                                       | Current restore.mjs dry-run live-write karta hai                  |
| D7  | Old v2 files            | Compat: v2 backup par restore = dynamic schema se column map (file me jo cols hain wo hi maap)                                                                                                                            | Existing backups reference me todena nahi                         |

## 3. Phases (all code-only; live DB par sirf read-only SELECT/HEAD)

### Phase 1 — Schema import ✅ (done 2026-09-17)

- [x] `src/lib/admin-supabase.ts` `getAdminSupabase()` already existed — reuse (no new admin file).
- [x] `src/lib/backupSchema.ts` — pure parser `parseOpenApiToSchema()` (cols in definition order, PK via `<pk/>` marker, `GENERATED_COLUMNS` map merge).
- [x] `src/app/api/backup/schema/route.ts` (GET, `requireAdmin`) — service-role OpenAPI fetch → `{ ok, tables: [{name, cols[], pk[], generated[]}] }`.
- [x] Unittest `src/lib/backupSchema.test.ts` — 7 tests (PK single/composite, generated merge, no-pk, order, empty spec). E2E probe against LIVE OpenAPI: 51 tables parsed, PKs exact (`transaction_products`→`id`, `spare_supplier`→`spare_id,supplier_id`, `user_presence`→`user_id`).

### Phase 2 — Backup page ✅ (done 2026-09-17)

- [x] `BACKUP_TABLES_ORDERED` → 51-table golden list (§4) + runtime auto-append (schema se nayi tables end me; static sirf fallback).
- [x] `TABLE_COLUMNS`/`COMPOSITE_KEY_*` → runtime `colsOf()/pkOf()/genOf()` (schema API se); fallback static lists.
- [x] Generated merge: `backupSchema.GENERATED_COLUMNS` (net_amount) — select me exclusion.
- [x] Backup verify: har table par `exact count` compare → mismatch = `_meta.warnings` + HARD toast (file save hoti hai par INCOMPLETE flag).
- [x] `_meta.version → "3.0"`, `_meta.tables` = runtime list; v2-files: `loadFileAndDiff` file ki apni `meta.tables` use karta hai (D7).
- [x] Restore dry-run (page) ENHANCED: PK presence+unique, unknown-cols (strip warning), NOT NULL coverage (per-cell) — `notNull` ab schema API se (OpenAPI `required`); issue → toast `❌ Dry run FAILED` (sirf file+schema, koi write nahi).
  - First dry-run FALSE-POSITIVE bug caught+fixed (2026-09-17): composite-PK "missing" check me `\u0000` separator hamesha milta tha → spare_supplier/product_locations/transaction_services ke saare rows flag (live probe: 0 real dupes/missing). Fix: `countPkViolations()` pure helper (src/lib/backupSchema.ts, unit-tested) + force-restore.cjs dedup same fix. Dry run ab unique composite PK ko pass karta hai.

### Phase 3 — Restore safety ✅ (mostly done 2026-09-17)

- [x] Restore loop dynamic cols se strip (!! §1.2 column loss khatam — live schema cols); `resetSequences()` list extend (naye tables add).
- [x] Post-restore per-table `db count == file rows` → mismatch tables `tableResults` me HARD-fail rows (+ toast `⚠ restore partial`); `100% restored!` sirf zero-fail par.
- [x] Upsert `onConflict` explicit: single-PK (default) + composite (`onConflict: "<cols>"`); clear-step universal `.not(pk[0],"is",null)` (uuid/text PK bhi delete-all hota hai).
- [ ] Restore non-transactional re-run flow — same as before (design note, koi nayi guarantee nahi).

### Phase 4 — CLI scripts ✅ (done 2026-09-17)

- [x] `supabase-restore.mjs`: `--dry-run` ab kabhi dump ka SQL execute NAHI karta — sirf file analysis + read-only `SELECT 1` connection ping (pehle `--echo-all` execute karta tha — live-DB landmine fixed). JSON page-backup guard: dry-run = parse/validate (bina psql), real-restore = error + guidance (`/backup` page ya `force-restore.cjs`).
- [x] `force-restore.cjs`: file accept arg ya default glob `vtech_backup_*.json`; columns + PK ab LIVE schema se (OpenAPI, hardcoded allowedCols removed); tables = file `_meta.table_order` (homegrown v3) ya arg-list; `onConflict` PK-based (single+composite), generated strip (net_amount), dedup; CONFIRM prompt (ya `--yes`). Tested: syntax ✓, JSON dry-run ✓ (no psql needed), confirm-cancel ✓ (no writes).
- [x] `supabase-dump.mjs`: header doc note — `--schema=public` default, `auth`/`storage` include NAHI (platform backup/PITR unke liye).

### Phase 5 — Verify (no live writes) 🔶 user-verified

- [x] `schema` API probe vs live OpenAPI: 51/51 tables, PK+cols exact (spot-check GH: `transaction_products`, `spare_supplier`, `user_presence`, `client_payments` net_amount, `messages`, `bom_templates`, `supplier_contact_phones`) ✅ (temp E2E script `$env:TEMP\opencode\backup_schema_e2e.mjs`).
- [x] Live "Download Backup" run ✅ **USER-CONFIRMED 2026-09-17** (`vtech_backup_2026-09-17T07-02-58.json`): 51/51 tables, har table file rows == DB rows, net change 0, diff panel green — 0 warnings.
- [x] Diff panel v3 file (file vs DB) green — same run me verified.
- [ ] Restore REAL execution live par **NOT allowed** — dry-run + unit tests + code review = evidence.
- [ ] tsc + eslint + vitest + `npm run build` green — **already green ✅** (2026-09-17).

### Phase 6 — Platform reminder → FREE-TIER reality ✅ DONE (2026-09-17)

- [x] **Free tier = koi platform automatic backup / PITR NAHI** (Pro/Team/Enterprise par hi daily backups; PITR ~$100/mo add-on + Pro base). Isliye Phase 6 ka "Dashboard backups <48h + PITR ON" free par apply nahi hota.
- [x] Free-tier backup = **hamara apna**: `/backup` page JSON (51/51 tables, count-verified — aapne confirm kiya) + `scripts/force-restore.cjs` (scheduled/app-server restore). Yehi free ka "backup" hai.
- [x] Manual cadence (recommended): **weekly `/backup` → Download JSON → off-machine copy** (Drive/pen drive), 2+ copies, old delete after 2–3. Kuch risky change (migration/fix) se pehle ek fresh backup lein. → ongoing routine, guide me documented.
- [x] (Optional automation) `scripts/supabase-json-backup.mjs` — service-role se saari tables paginated→JSON (bina pg_dump/psql ke); Task Scheduler/GitHub Action ke through scheduled off-site dumps.
  - ✅ BUILT + LIVE-TESTED (2026-09-17): 51/51 tables, har table count verified, 10,232 rows → `backups/vtech_backup_*.json` (gitignored). OpenAPI schema se live cols/pk; GENERATED skip (`client_payments.net_amount` verify kiya); page v3.0 JSON shape = page restore par chalta hai.
  - Count-mismatch par exit code 2 (Task Scheduler fail-action/email se alert), schema/env fail par exit 1.
- [x] ✅ Backup page par chhota UI (2026-09-17): "Server Backup (Scheduled)" card — Abhi Run Karo + recent files list + **cloud copies list**. `GET/POST /api/backup/scheduled` (requireAdmin, Node runtime), logic shared `src/lib/scheduledBackup.ts`. Live-test: 51/51, 10,232 rows count-verified, local + Storage upload ok.
- [x] ☁️ Cloud copy (2026-09-17): har run Supabase Storage **`backups` bucket (private)** me upload hoti hai — Vercel par bhi PERSISTENT (fs ephemeral). CLI flag `--storage` = wahi. Bucket auto-create, `x-upsert`. Verified live: bucket create + upload + list.
- [x] MariaDB mirror failover converter v5 (2026-09-17): `public/tools/vtech_mysql_converter.html` updated — 46 app tables (auth/transient skip), v3.0 output, saare naye tables ke casts (locations hierarchy, contacts, purchase, stock, messages, product_locations, bom_templates, job_required_parts, supplier_payments), `transaction_products` ab id-PK (composite false-dedup hataya). Real 10,232-row data par verified: 46 tables / 10,175 rows exact match.
  - Vercel caveat: Vercel Cron se automatic chahiye to `CRON_SECRET` header bypass banana padega (abhi admin-cookie only). Offer kiya hai.
- [x] Storage buckets: free par bhi **manual export** hi — GUI se ek saath (Bucket → Download) ya cadence decide karo (images DB backup me nahi aate). → ongoing hygiene, guide me documented.
- [x] 📖 Full guide (Hindi/English/Hinglish): `docs/BACKUP_GUIDE.md`.

## 4. Golden restore order (all 51 live tables, FK-first)

```
1. system_info, job_id_counter
2. mechanic_list, users, profiles, client_list, product_list, service_list, suppliers,
   locations, location_zones, location_racks, location_bins, location_boxes,
   client_contacts, supplier_contacts, supplier_contact_persons, supplier_contact_phones
3. spare_supplier, product_locations, purchase_orders, purchase_order_items
4. inventory_list, stock_counts, stock_adjustments, lender_list, loan_payments,
   expense_list, supplier_payments
5. transaction_list, transaction_products(., PK=id), transaction_services,
   transaction_images, job_required_parts, client_loans, client_payments
6. direct_sales, direct_sale_items, attendance_list, advance_payments,
   mechanic_salary_history, mechanic_commission_history
7. message_list, messages, wp_template_history, activity_logs, payment_reminders,
   push_subscriptions, bom_templates, login_throttle, user_presence
```

> order groups sirf ordering ke liye (D3); exact FK sanity = Phase 1 schema API se PK/FK-probe.

## 5. Safety guarantees

- Phase 1–4 sirf repo code (TS/JS) — **koई live query nahi except backup/schema API (read-only)**.
- Restore real-execution click sirf USER kar sakta hai (admin+confirm+download) — is session me kabhi nahi.
- Backup = SELECT only → season-safe (G3 no-database-write policy intact).
- Har change 3 checks: tsc + eslint + vitest green; darwaze: `git diff` review before commit.

## 6. Risks

| Risk                                                                                                                                                                                                            | Mitigation                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAPI par generated-col marker na ho                                                                                                                                                                          | explicit GENERATED_COLUMNS map merge + restore error-par row-report                                                                                                                                                                                                                                                                    |
| Order galat → FK insert fail                                                                                                                                                                                    | ordered list + restore `failed` report HARD-flag; count verify catches                                                                                                                                                                                                                                                                 |
| v2 backup + naye columns                                                                                                                                                                                        | D7 compat: file-me jitne cols maap, live untouched                                                                                                                                                                                                                                                                                     |
| Schema API service-role server-side                                                                                                                                                                             | `requireAdmin()` + server-only env; API pattern pehle se hai (`/api/sync`)                                                                                                                                                                                                                                                             |
| Bahut bada backup (images/JSON)                                                                                                                                                                                 | JSON ~ rows*cols; live 10k+ rows OK (page already paginated 1000)                                                                                                                                                                                                                                                                      |
| Browser backup RLS-scoped reads (page `supabase` client = session RLS): kisi table par logged-in role ko SELECT policy na ho → rows 0 aati hain AUR count-verify bhi 0 se match karega (silent 0, warning nahi) | Known limitation (pre-existing; `docs/plans/backup_schema_fix_plan.md` me noted). Admins with proper `profiles` row cite all rows readable. Mitigation: schema API service-role sirf metadata ke liye hai (rows kabhi browser me nahi). Yaad rahe: backup ko dobaara chalaye logged-in admin se jo roles/policies pe SELECT rakhta ho. |

## 6b. Post-mortem — 26 Nov cross-project restore (13,236 OK / 856 FAIL / 15 fake rows)

User ne main DB ka JSON backup naye test DB par restore kiya. Logs + backup JSON se
pata chala ki 5 alagclasses ka failure tha (ek hi bug nahi):

1. **`null → ""` coercion** (`page.tsx` ka text-normalize loop): backup me 63/64
   `locations.code` aur 3/6 `brands.code` NULL the; `""` bhejne se partial unique
   index `locations_code_idx` aur `brands_code_key` par duplicate fail. Is cascade se
   `product_locations` 0/43 aur `transaction_list` 89/2433 bhi FK se fail hue.
   ✅ Fix: `src/lib/backupRestore.ts` ka `normalizeTextFieldsForRestore()` —
   NULL sirf tab `""` jab column **NOT NULL** ho (schema API se `notNull`).
2. **Restore order ulta tha**: `brands/service_types/device_models` live schema me
   auto-append ho kar `transaction_list` ke **baad** (order 10) aate the → 10 jobs ka
   `brand_id` FK fail. `locations` hierarchy se pehle aur `expense_list`
   `supplier_payments` se pehle tha → 2 + 1 FK fail.
   ✅ Fix: golden list ab `src/lib/backupRestore.ts` me hai; FK parents explicit
   pin (test: order assertions).
3. **Identity columns**: `staff_duty_schedule` / `staff_geofence_permit` me
   `id bigint generated always as identity` — backup ka explicit id 428C9 fail.
   ✅ Fix: `GENERATED_COLUMNS` me dono ka `id` add, restore par strip.
4. **Composite PK dedup**: purana `pk.includes("id")` composite PK ko skip karta tha.
   ✅ Fix: `dedupeRowsByPk()` single + composite dono handle karta hai.
5. **Report double-counting**: count-verify mismatch ke liye synthetic row
   `restored: 0` daali jaati thi → 2,334 successful inserts ke baad bhi report me
   extra `(count verify) 0 restored / 99 failed` rows aur 15 duplicate tables dikhi.
   ✅ Fix: verify alag section (totals se bahar), raw file length ki jagah actual
   attempted rows se compare, error messages ab report me dikhtein hain (row data
   console me print nahi hota).

**Abhi bhi browser-se fix nahi ho sakta (service-role ke bina):** `profiles` (10),
`messages` (17), `user_presence` (4), `user_passkeys` (4), `push_subscriptions` (175),
`stock_counts`/`stock_adjustments` (6) — sab cross-project auth UUID se juda hain.
Backup ka `users` array **empty** hai (`auth.users` export hi nahi hota), aur naye
project ke `auth.uid()` purane UUID se match nahi karte + RLS INSERT policies
(`sender_id = auth.uid()`) aur role-escalation trigger inhe reject karte hain.
Iske liye **approved service-role restore / auth remap** chahiye — browser me
service-role nahi rakhte (design decision). Report me ab yah clear hint dikhta hai.

Code changes: `src/lib/backupRestore.ts` (new), `src/lib/backupSchema.ts`,
`src/app/backup/page.tsx`, unit tests (`backupRestore.test.ts`, `backupSchema.test.ts`).
Koi DB write nahi kiya gaya; dry-run + tests se verification.

### 6c. Admin-only auth restore route (bache hue 218 ke liye)

User ne choose kiya: **Server admin route**. Naya route
`POST /api/backup/auth-restore` (admin/developer session required) service-role
ka use sirf server par karta hai. Design:

- **Default dry-run** (`confirm: false`) — plan dikhata hai: old→new UUID map,
  match na hone wale emails, create hone wale users, per-table row counts.
- Purana profile UUID **email se** naye project ke auth user se map hota hai —
  naye auth users ka login identity preserve rehta hai. Jo email nahi milti uska
  row skip hota hai (ya explicit option se user create hota hai).
- **Custom/fake email ka issue:** email par reset link nahi aata. Isliye option
  `setTempPasswords: true` se naye users ko service-role se random temporary
  password (`Vt!…`) set hota hai aur response me **sirf ek baar** dikhta hai
  (UI me Copy button). Baad me admin `/users` → Reset Password se ya user app me
  apna password khud badal sakta hai. Existing users ka password kabhi overwrite
  nahi hota — sirf naye banaye gaye users ke liye.
- Current admin ka profile snapshot pehle le kar **end me wapas upsert** hota
  hai — backup ke purane admin UID se override ho kar lock-out nahi hota.
- FK order: `profiles` pehle, phir `stock_*`, `messages`, `push_subscriptions`,
  `user_presence`, `staff_geofence_permit`, `user_passkeys`.
- Generated identity `staff_geofence_permit.id` strip, composite/single PK dedup,
  live schema se columns filter, batch upsert + row fallback.
- Browser me koi service-role key nahi; UI me checkbox + explicit "Run Admin
  Restore" ke bina koi write nahi. Agent ne abhi tak route execute nahi kiya.

Files: `src/lib/backupAuthRestore.ts` (+ test), `src/app/api/backup/auth-restore/route.ts`,
`src/app/backup/page.tsx` (admin panel).

**Smoke (read-only, agent ne DB write nahi kiya):** browser me chhote synthetic
backup (`profiles:1`, `messages:1`) se panel load + `Plan / Dry Run` chalayi →
route **HTTP 200**, plan `2 rows · 1 UUID map · 0 missing · admin profile
protected`, confirm button tabhi active hua jab checkbox check kiya. Console me
koi naya error nahi (ek pre-existing `ai_providers` 403 aur dev-server HMR
timeout tha). **Confirm / live restore abhi nahi chalaya gaya.**

**✅ USER-VERIFIED RE-RUN (26 Nov, post-fix):** **13,448 restored / 218 failed**,
0 fake `(count verify)` rows. Pehle fail hone wale sab tables ab 100% —
`locations 64/64`, `brands 6/6`, `device_models 6/6`, `product_locations 43/43`,
`transaction_list 2433/2433`, `expense_list 91/91`, `staff_duty_schedule 3/3`.
Bache hue 218 sirf auth/RLS group hain (`profiles` 10, `stock_*` 6, `messages` 17,
`push_subscriptions` 175, `user_presence` 4, `staff_geofence_permit` 2,
`user_passkeys` 4). Report me ab error + hint dikhta hai. 8 count-mismatch rows
inka natural consequence hain (`profiles 2/10`, `user_presence 2/4` RLS se sirf
apni row dikhati hai), koi naya bug nahi. Restore aapne chalaya — agent ne nahi.

### 6d. "Pura DB delete karke restore" — sahi jawab

**Sirf DB delete + full schema + restore se 218 auth-linked rows fix nahi hoti.**
Backup JSON me `auth.users` nahi aate; naye project ke UID purane profile UID se
alag hote hain. Schema dobara banane se wo mismatch khud nahi sudharta — fix sirf
admin route (email → UID remap) ya users manually purane ID se banane se hota hai.

Agar clean slate chahiye to **poora schema mat girao**:

1. `scripts/reset-db-data.sql` — data-only reset (guard token
   `WIPE_ALL_BUSINESS_DATA`). Ye `profiles`, `system_info`, `job_id_counter` aur
   `auth.users` ko safe rakhta hai. Full schema re-run safe/idempotent hai par
   zaroori nahi.
2. JSON restore (browser) → phir admin route Dry Run → confirm (temp password ON).

Agar sach me `public` schema hi khali karna ho to guarded
`scripts/full-public-reset.sql` hai (token `WIPE_PUBLIC_SCHEMA`). Ye
`system_info` / `job_id_counter` / admin profiles ko `vtech_rescue` me bacha leta
hai, lekin **admin profile wapas insert kiye bina `requireAdmin()` 403 dega**.
`auth.users` hamesha chhod do — delete kiye to login identity + FK dono toot jate
hain. Agent ne ye scripts execute nahi kiye; sirf likhe hain.

## 7. Done-kya definition

Backup (live, read-only) → 51/51 tables, counts exact, 0 warnings. Restore → dry-run PASS +
failed=0 matrix in test + code review (live restore NOT performed). Scripts pehli baar chalta hai
pg_dump/psql instal bina — documented. Platform backup freshness aapki Dashboard-confirm.
