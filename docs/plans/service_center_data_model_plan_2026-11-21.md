# Service Center Data Model — Brand / Item / Model / Serial + Service Type Plan

> **Created:** 21 Nov 2026 · **Revised (v2):** 22 Nov 2026 — fresh review ke baad
> **3 operating modes** (autonomous / single-brand / multi-brand), **reports integrity
> guarantee**, **counter-speed UX** aur **standard-center coverage audit (§15)** add kiya;
> phases reorder kiye. **G1–G3 (claim lifecycle, warranty expiry, status prompt) ADOPTED**
> — ab gap register ke nahi, plan ke phases me hain.
> **Status:** 📝 PLAN ONLY — koi code/migration nahi likha, **live DB untouched**,
> owner approval pending.
> **Scope:** `transaction_list` ke device fields split + `service_type` + ek brand ka
> service center chalane ke liye baaki zaruri cheezein — **teenon mode** me.
> **Extends (schema part of):** `multi_brand_service_architecture_plan.md` §3 ·
> `multi_brand_job_id_sequencing_plan.md` (Vikalp B numbering — **unchanged**, ab ye P4 hai).
> **Rules:** additive/non-breaking columns · legacy `item` kabhi rewrite nahi ·
> live DB apply sirf owner approval ke baad · `docs/DATA_MIGRATION_NOTES.md` golden rule.

---

## 0. Sawal aur seedha jawab

| #   | Sawaal                                                                                             | Jawab    | Kyun                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Jobs me ek box "Item / Model" — brand/item/model/serial alag karein? **Karna chahiye?**            | **HAAN** | Brand = report/warranty/claim/numbering ki **axis** hai; free-text me kabhi aggregate nahi hota. Serial ke bina warranty claim/return possible hi nahi. |
| 2   | Services me service type (repair / new installation / other)? **Karna chahiye?**                   | **HAAN** | **Job-level** column (`transaction_list`), `service_list` par **NAHI** — ek job ki ek type hoti hai.                                                    |
| 3   | **3 modes:** ek brand / multi-brand / (kisi brand se associate na ho) autonomous — teenon chalein? | **HAAN** | §2.4 me mode matrix — **ek hi schema, teen alag behaviour**, koi alag fork nahi.                                                                        |
| 4   | Implement se pahle/baad ke data se **reports hamesha arthpurn** rahein?                            | **HAAN** | §12 me 7 guarantees: coverage indicator, Untagged bucket, deactivate-never-delete, no retroactive renumber, parity check.                               |
| 5   | Brand service center ke liye aur kya best rahega?                                                  | §5       | Tier 1 me **serial + warranty/claim + intake contents** — ye paisa wala hissa hai.                                                                      |
| 6   | Ek jagah ek se adhik authorized brand ka center?                                                   | **HAAN** | §6 — multi-brand = isi plan ka scope. Multi-tenant (alag-alag centers ka alag data) = NAHI (abhi).                                                      |

---

## 1. Current reality (audit facts, 21 Nov 2026 — code verified)

**`transaction_list`** (`supabase/migrations/20260913000000_final_full_schema_idempotent.sql:472-499`):

```sql
item text NOT NULL   -- ekmatr device column — FREE TEXT, no FK, no brand/model/serial
job_id varchar(20)   -- display number (string)  ·  code varchar(100) -- YYYYMMDD+seq
location_id int      -- device ki shop me physical jagah (20260824_job_item_locations.sql)
```

- `brand`/`model`/`serial`/`imei`/`service_type`/`category` — **koi column nahi**.
  Code me `brand_id|brandId|from("brand")` refs = **0**; koi `brands` migration = **0**.
- `item` zod: `z.string().trim().max(200)` (`src/lib/validation/schemas/job.ts:29`) —
  UI par red `*` hai par schema me optional (comment `job.ts:12-14`).
- `"Item / Model"` label **12 jagah**: `jobs/new:1499`, `jobs/[id]/edit:1413`,
  `jobs/[id]/view:992`, `JobsBody:2764+945+2427`, `jobs/bulk:491,650`,
  `jobs/bulk-edit:486,653`, `jobs/old:589`, `jobs/[id]/old:589`,
  `clients/[id]/view:1594`, `api/print-bill:474`, `api/export-transactions:149`,
  WhatsApp `{item}` (`src/lib/whatsappTemplates.ts:211`).
- `item` search: `jobListQueries.ts:193,315` → `item.ilike('%term%')`.
- `service_list` = **labor rate catalog** (`id,name,description,price,hsn,status,delete_flag`),
  `src/app/services/page.tsx:157` header "Service Catalog". Koi type/category column nahi.
- Job IDs: global sequential `job_id` (auto `>= 28101`, `next_job_id()` RPC) +
  partial unique index `transaction_list_job_id_autogen_uniq`
  (`supabase/migrations/20260916_atomic_job_id_counter.sql:76-78`).
  Per-brand numbering abhi **nahi**.
- `system_info` = **KV settings table** (`id, meta_field, meta_value` — `..._full_schema.sql:455-459`);
  app ka canonical config write helper `upsertField()` (`settings/page.tsx:245-269`,
  React Query `systemInfoKey` invalidate ke saath). **Isi me mode config jayega — koi naya table nahi.**
- Supabase browser client **untyped** (`src/lib/supabase.ts:11` — `createBrowserClient`
  bina generic; repo me koi generated `Database` type nahi).
- Saare writes **central writeGuard Proxy** se guzarte hain (geofence gate,
  `supabase.ts:23-31` — `.insert/.update/.rpc` office ke bahar + permit nahi to block).

**Matlab:** device ki pehchan sirf ek free-text string hai. Brand-wise report, warranty claim,
serial lookup, service-type split — kuch possible nahi.

---

## 2. Design

### 2.1 Device fields — 4 boxes (hybrid compose, non-destructive)

Naye structured columns + `item` ko **derived preview** bana ke rakho → 12 render sites
(print/export/WhatsApp/search) **bina badle** rich ho jaate hain, legacy ~2370 rows safe.

| Column                  | Type                          | Naya job me                   | Kaam                                                                                                                   |
| ----------------------- | ----------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `brand_id`              | `int NULL FK → brands(id)`    | mode-dependent §2.4           | device manufacturer + (mode ke hisaab se) authorization axis                                                           |
| `item_category`         | `text NULL`                   | **Optional**                  | device type (Scooter/SMPS/TV) — datalist, counter friction na badhe                                                    |
| `model`                 | `text NULL`                   | Recommended                   | specific model (XGT, 15 Pro)                                                                                           |
| `serial_no`             | `text NULL`                   | Optional (hint)               | serial / IMEI / chassis / vehicle no — warranty + pickup                                                               |
| `service_type_id`       | `int NULL FK → service_types` | **Required (default Repair)** | §2.2                                                                                                                   |
| `warranty_status`       | `text NULL`                   | Optional                      | `in_warranty \| out_of_warranty \| brand_paid` (§5 Tier1)                                                              |
| `warranty_claim_no`     | `text NULL`                   | Optional                      | sirf authorized modes me dikhta hai (§2.4)                                                                             |
| `warranty_until`        | `date NULL` 🆕 (G2)           | auto                          | delivery date + N days — expiry badge/reminder. **Abhi column = expiry data abhi se**                                  |
| `warranty_claim_status` | `text NULL` 🆕 (G1)           | auto                          | `submitted \| approved \| rejected \| paid` — sirf claim_no se **paisa track nahi hota**, lifecycle chahiye (§15.2 G1) |
| **`item` (EXISTING)**   | `text NOT NULL` **unchanged** | hamesha                       | **derived preview** + legacy container + search                                                                        |

**`brand_id` required kahan hai:** `service_center_mode` decide karega (§2.4) —
autonomous = optional, single/multi = required (+ "General / Unbranded" escape seed row).

### 2.2 `service_type` — JOB level (sawaal ka asli jawab)

`service_list` = labor rate catalog (SMPS Repair ₹500). **"New Installation" koi catalog
line nahi, job ki category hai** — isliye type `transaction_list` par.

Seed (v1): **Repair / Service (default) · New Installation · Warranty Claim ·
AMC / Service Visit · PDI / Delivery · Inspection / Estimate**.

> **Rule: `service_types` kabhi DELETE mat karo — sirf `is_active=false`.**
> Kyunki purane reports me group hui rows agar type delete ho jaayein to **history me se
> rows gayab** ho jayengi (§12 guarantee 3).

Optional (P2, alag axis): `service_list.category` (Electrical/Mechanical/Bodywork) —
catalog filter. Ye **service_type se alag cheez** hai, confuse mat karo.

### 2.3 Nayi master tables

```sql
CREATE TABLE IF NOT EXISTS public.brands (
  id             serial PRIMARY KEY,
  name           text NOT NULL UNIQUE,
  code           varchar(10) UNIQUE,       -- KMK / OLA / GEN (display prefix)
  is_authorized  boolean NOT NULL DEFAULT false,  -- is center ke liye authorization hai?
  authorized_no  text,                     -- brand ka diya ASC/dealer code (claim forms)
  logo_url       text,
  support_phone  text,
  support_email  text,
  is_active      boolean NOT NULL DEFAULT true,   -- DELETE kabhi nahi (§7)
  date_created   timestamptz DEFAULT now(),
  date_updated   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_types (
  id         serial PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  sort_order smallint NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true   -- DELETE kabhi nahi
);

-- Vikalp B blueprint (multi_brand_job_id_sequencing_plan.md §3) — unchanged
CREATE TABLE IF NOT EXISTS public.brand_job_counters (
  brand_id             integer PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE,
  last_sequence_number integer NOT NULL DEFAULT 0,
  prefix               varchar(10) NOT NULL,
  date_updated         timestamptz DEFAULT CURRENT_TIMESTAMP
);
```

**Prefix kahan?** Blueprint me `brand_job_counters.prefix` hai (approved plan — as-is rakho).
_(Refinement option, decision §9: prefix `brands` par le jaana behtar hai kyunki wo brand ki
stable identity hai, counter sirf state rakhe. Chhota change, P4 me decide kar lena.)_

Phase 6 (optional): `mechanic_brand_map (mechanic_id, brand_id, is_primary, PRIMARY KEY(mechanic_id, brand_id))`.

**Har naye table par:** RLS ON (project rule 55/55), pattern =
`rlslock_service_list_staff ... TO authenticated USING (public.is_frontend_staff())
WITH CHECK (public.is_frontend_staff())` (`..._full_schema.sql:2214`), **anon ko koi policy =
deny**, grants audited, `moddatetime` trigger, **full-schema fold-in** (`schema:drift`).

### 2.4 🆕 Operating Mode — ek schema, teen behavior

**`system_info` KV key `service_center_mode` = `autonomous | single_brand | multi_brand`**
(koi naya table nahi; `upsertField()` se save; default **`autonomous`** — sabse kam friction).

**Brand ka matlab mode se badalta hai:**

- **autonomous** → brand sirf **device ka manufacturer** (search/filter) — koi commercial
  relationship nahi, koi claim company nahi.
- **single/multi_brand** → brand **commercial authorization** bhi hai (warranty claim,
  authorized header, brand numbering, claim rate).

Isliye `brands.is_authorized` alag column hai — mode **aur** brand dono padh kar decide hota hai.

| Behavior                       | `autonomous`                           | `single_brand`                                                 | `multi_brand`                                  |
| ------------------------------ | -------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| Brand field at intake          | **optional** (collapsed, datalist)     | **hidden → auto-fill** single authorized brand (override link) | **required** (+ escape: "General / Unbranded") |
| `item_category`/`model`        | optional                               | recommended                                                    | recommended                                    |
| Serial                         | optional (hint)                        | optional (hint)                                                | optional (hint)                                |
| `service_type`                 | required (default Repair)              | required (default Repair)                                      | required (default Repair)                      |
| Per-brand job numbering (P4)   | **off** (global `job_id` hi)           | on (prefix)                                                    | on (prefix per brand)                          |
| Warranty `claim_no` + register | **off** (status sirf info)             | on                                                             | on                                             |
| Dashboard brand switcher       | chhota chip (device brand filter)      | hidden (ek hi brand)                                           | **prominent** global switcher                  |
| Print header                   | sirf shop name                         | `Authorized Service for [Brand]` + logo                        | job ke brand ke hisaab se                      |
| Brand-wise reports             | chhupa hua (default device-brand chip) | auto                                                           | haan + coverage indicator                      |

**Guards (taaki mode galat na ho):**

1. `single_brand` me 2+ brand par `is_authorized=true` → warning: "2 authorized brands hain —
   `multi_brand` mode chunein?" (override allowed).
2. Mode **badalne par history kabhi na badle** — `brand_job_no` job ke creation par store
   hota hai; global `job_id` kabhi na chhute (§12 guarantee 5).
3. Config par **stale cache** nahi: `upsertField()` pehle se `systemInfoKey` invalidate
   karta hai (`settings/page.tsx:268`); aur mode boot me hi load ho —
   `useAppBoot.ts:103-106` ka `.in("meta_field", [...])` array me `service_center_mode`
   add kar do (zero extra request).

> **UX principle:** mode = **preset bundle**, har behavior phir bhi settings me individually
> override ho sake (jaise "brand required" ya "per-brand numbering"). Mode khud user ko
> "configure karne" nahi kehta — woh sirf defaults set karta hai.

### 2.5 Derived `item` — non-destructive compose (R1 ka hal)

| Situation                           | Kya save hoga                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Structured fields **khaali**        | user ka free-text `item` **jaisa ka taisa** (legacy path bilkul unchanged)                            |
| Structured fields bhare             | `item` = `brand + category + model` (read-only **preview** form me, user save se pehle dekh leta hai) |
| Preview **purane `item` se chhota** | ⚠️ warning: "Purana item text replace ho jayega — model field me add kar dein" (silent loss nahi)     |
| `item` override chahiye             | structured khaali karo → input wapas editable (hamesha ek raasta)                                     |

Rule: **kabhi silent overwrite nahi** — hamesha ya to preview dikhe, ya free text hi save ho.
`composeJobItemLabel()` (naya `src/lib/jobItemLabel.ts`) + unit tests (legacy / composed /
override / 200-char guard).

---

## 3. Migration (sketch) — kabhi bhi apply-safe

`supabase/migrations/20261122_service_center_fields.sql` (idempotent, baaki migrations jaisa):

```sql
BEGIN;
-- 1. service_types seed (ON CONFLICT DO NOTHING) + default 'Repair'
-- 2. 'General / Unbranded' seed brand (code 'GEN', is_authorized=false)
-- 3. ALTER TABLE transaction_list ADD COLUMN IF NOT EXISTS
--      brand_id, item_category, model, serial_no, service_type_id,
--      warranty_status, warranty_until, warranty_claim_no,
--      warranty_claim_status  (sab NULLABLE; FK sirf brand_id/service_type_id)
-- 4. KV row: system_info 'service_center_mode' = 'autonomous' (agar na ho)
-- 5. RLS + grants + triggers + NOTIFY pgrst 'reload schema'
-- 6. full-schema bootstrap file me fold-in (schema:drift requirement)
COMMIT;
```

- **Backfill NAHI:** legacy `item` jaisa ka taisa. Nayi columns `NULL` → UI "—" fallback.
- **Har naya column NULLABLE** — `backup/page.tsx:889` khud flag karta hai ki NOT NULL +
  file me missing value = restore par row fail. Old backup → naya column `NULL` = chalta.
- **Rollback:** `DROP COLUMN` + `DROP TABLE` + KV row delete (naye columns khali honge).
- **Live apply = OWNER APPROVAL.** Apply se pehle **read-only simulation** +
  row-count snapshot (55 tables) — RPC grants plan wala pattern.

---

## 4. Phases (v2 — reorder: numbering pehle, claim export baad me)

> Har phase ka **DoD** (definition of done) + **rollback** alag se.

| Phase             | Kaam                                                                                                                                                                                                                                                                                                              | Files (approx)                                                                                                                                                       | Effort     | Risk                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------ |
| **P0**            | Owner decisions (§9) — mode default, brand required, seed lists                                                                                                                                                                                                                                                   | —                                                                                                                                                                    | 0.5 h      | —                                                |
| **P1**            | Migration + **Settings → Service Center** page (mode + brands CRUD + service types + numbering config)                                                                                                                                                                                                            | `20261122_*.sql`, `src/app/settings/service-center/page.tsx`, full-schema fold-in, `useAppBoot` mode key                                                             | ~1 din     | Low (additive)                                   |
| **P2**            | Intake: 4 device fields + `service_type` (default Repair) + warranty select + **mode-aware visibility** + derived `item` preview + validation/tests                                                                                                                                                               | `jobs/new`, `jobs/[id]/edit`, `jobs/bulk`, `jobs/bulk-edit`, `jobs/old`, `JobsBody` quick-create, `validation/schemas/job.ts`, naya `src/lib/jobItemLabel.ts` + test | ~1–1.5 din | Med (6 surfaces; preview se blast radius chhota) |
| **P3**            | List/view: brand badge + service-type filter + serial in navbar search + device card + **coverage indicator** + Untagged bucket + `jobListQueries.ts` single-source filter                                                                                                                                        | `JobsBody`, `jobListQueries.ts`, `useNavbarSearch.ts:113`, `jobs/[id]/view`, `clients/[id]/view`                                                                     | ~1 din     | Low                                              |
| **P4**            | **Brand-wise job numbering (Vikalp B)** — `brand_job_no` + atomic counter RPC + prefix matrix                                                                                                                                                                                                                     | `multi_brand_job_id_sequencing_plan.md` blueprint                                                                                                                    | ~0.5–1 din | **Med–High** (counter/index)                     |
| **P5**            | Brand filter (dashboard + reports + pending-jobs) + **warranty claim export CSV** + **claim lifecycle** (G1: status update UI, `paid` par amount) + **warranty expiry** (G2: delivery par `warranty_until` compute + view badge) + print branding (logo, `Authorized Service for [Brand]`, `KMK#001 (Ref 28101)`) | dashboard, `pending-jobs`, `print-bill`, `jobs/[id]/view`, naya `api/export-brand-claims`                                                                            | ~2 din     | Low                                              |
| **P6** 🆕         | **Status-change notification prompt** (G3): status badalte par "WhatsApp bhejein?" modal + ek tap (wa.me) — 5 status templates **already** hain par manual hain; **automation browser se possible nahi** (wa.me = client-side send), isliye 1-tap prompt hi P0 hal                                                | `jobs/[id]/view`, `daily-done`                                                                                                                                       | ~1 din     | Low                                              |
| **P7** (optional) | `mechanic_brand_map` + brand-wise commission/rate card + brand-wise stock (genuine vs local) + **legacy bulk-tag tool**                                                                                                                                                                                           | mechanics UI, inventory, bulk-edit pattern                                                                                                                           | ~2 din     | Med — defer ho sakta hai                         |

**Core value (P1–P3) ≈ 3 din.** P4–P6 ≈ 3 din. P7 optional.

**DoD (common, har phase):** `prettier` · `tsc` · `eslint` · `vitest` green ·
`next build` ✓ · browser smoke (form render, console errors 0) · **report parity** (§12.5).
**Rollback (common):** sirf us phase ke UI files revert; DB columns/khali rahne par koi asar nahi.

---

## 5. Brand service center ke liye best practices (prioritized backlog)

> Ye field-split se ALAG hain — operational zaruriat. Priority as per money/impact.

### Tier 1 — Intake accountability (P2/P3 ke saath)

1. **Serial/IMEI capture** (isi plan me) — bina iske return/claim nahi.
2. **Warranty status + claim no** (§2.1) — brand reimbursement yahin se.
3. **Intake contents & condition** — charger/key/battery + maujooda damage ki list/photo.
   Aaj kuch nahi → delivery par dispute.
4. **Job card QC + handover signoff** — repair ke baad QC pass + customer signature.

### Tier 2 — Brand commercial (P4/P5)

5. Brand-wise **job numbering** (`KMK#001`) + **claim export** (Vikalp B already decided).
6. **Brand labor/claim rate card** (`brand_service_rates`) — company alag rate maangti hai.
7. **Brand-wise mechanic commission** (`mechanic_brand_map` + matrix).
8. **Brand filter + switcher** + print me "Authorized Service for [Brand]" + logo.
9. **Genuine vs local parts** alag ledger + low-stock (purane plan §2.5).

### Tier 3 — SLA/ops (baad me)

10. **Turnaround SLA per brand/type + aging report** (`get_stale_jobs`/`pending-jobs` me
    brand/type dimension).
11. Technician-brand certification mapping + smart assign.
12. Barcode/QR pickup scan — QR print me hai (reuse). ⚠️ **Android app me `CAMERA`
    permission nahi hai** (audit) → scanner = USB/Bluetooth keyboard-wedge; browser me
    camera `BarcodeDetector` future.
13. Device ki shop me physical position → `location_id`/spot **already hai**, dobara mat banao.

### Tier 4 — Compliance/finance

14. Service-type wise GST/HSN report (`service_list.hsn` hai, job par type lagega).
15. AMC contracts (agar brand require kare) — alag feature, abhi nahi.
16. **Warranty claim register + monthly claim statement** (CSV/Excel) — Tier 1 ka output.

---

## 6. Teenon mode — kya possible hai, kya nahi

| Mode                                              | Possible?           | Kya chahiye                                                                                                                                                      |
| ------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Autonomous** (kisi brand se associate nahi)     | ✅ **Default mode** | `brands` sirf device-attribute; numbering global; koi claim UI nahi; **koi field forced nahi**                                                                   |
| **Single-brand authorized**                       | ✅ ~3 din (P1–P3)   | `service_center_mode=single_brand` + 1 brand `is_authorized`; brand auto-fill, claim UI on                                                                       |
| **Multi-brand authorized (1 center)**             | ✅ ~3 din + P4–P5   | 2+ authorized brands; brand required + switcher + per-brand numbering + claim export                                                                             |
| **Multi-tenant (alag-alag centers ka alag data)** | ❌ abhi nahi        | `licenses/activations` = software **bechne** ka subsystem hai, data isolation ka nahi; RLS per-auth-user hai, per-center nahi. **Alag bada project — mat karo.** |

**Mode switch kabhi bhi, history safe:** autonomous → multi badalne par purane jobs waise
ke waise (brand NULL, global number). Naye jobs se hi naya behavior. **Koi retrofit nahi.**

---

## 7. ❌ Abhi mat karo (do-not-do)

- Legacy `item` (~2370 rows) ka **wholesale rewrite/split** — golden rule tootega.
- `service_list` pe `service_type` — galat layer.
- **`brands`/`service_types` ko hard DELETE** — historical rows orphan + reports me se
  gayab. Sirf `is_active=false` (FK bhi `RESTRICT`).
- **Purane jobs ka retroactive renumber** (mode switch ke baad) — numbering per-job store hoti hai.
- Brand ko autonomous mode me **mandatory** karna (counter friction + galat data).
- Brand-wise mechanic assignment **strict blocking** (soft suggestion se shuru).
- Naya `identifier_type` enum, `service_center`/`tenant` table, AMC module — over-engineering.
- Naye table/RPC ko **anon-executable** chhodna (security debt badhega).

---

## 8. ⚠️ Security note (isi batch me dekh lo)

`docs/plans/rpc_grants_hardening_plan.md` ke mutabik **26/28 definer RPCs anon-open** hain
(`reset_sequence` = **CRITICAL** — arbitrary `setval` = DoS). Naye columns se uske blast
radius aur badhega. **Suggestion:** P1 ke saath hi us plan ka migration apply karwao
(owner approval, read-only simulation pehle) — dono ek window me.

Config (`system_info`) ka RLS dekh lo: authenticated read me `ai_api_key`/`csrf_token`
bahir hain (`..._full_schema.sql:2273`) — `service_center_mode` **non-sensitive** hai,
staff ko read chahiye hi (validation ke liye), anon whitelist me nahi hai (deny). ✅

---

## 9. Owner decisions (P0) — implement se pehle chahiye

1. **Default mode?** recommend **`autonomous`** (least surprising; baad me switch safe).
2. **`single_brand`/`multi_brand` me brand required?** recommend **YES** + "General / Unbranded" escape.
3. **Service types seed** confirm (§2.2 ke 6) + koi extra? (jaise "Doorstep Visit").
4. **`service_type` = FK lookup table** (admin editable) ya text? recommend **table**.
5. **Warranty `claim_no` abhi laana hai ya P5 (claim export ke saath)?** recommend
   **column abhi**, UI P5 me (kharcha same, drishti me rehta hai).
6. **Numbering prefix kahan rakhein** — `brand_job_counters.prefix` (approved blueprint) ya
   `brands.prefix` (behtar single source)? recommend **decide at P4**.
7. **Migration live apply ki approval** (read-only simulation pehle).
8. **Kaunse phase abhi** — recommend **P1+P2+P3 (core)**, P4–P5 baad me.

---

## 10. Verification gates (har phase ke baad)

`prettier --check --end-of-line auto` · `tsc --noEmit` · `npm run lint` ·
`npx vitest run` (naye `jobItemLabel` tests: legacy/composed/override/200-char) ·
`npm run build` · `npm run schema:drift` (fold-in ke baad, **exit 0**) ·
browser smoke: `/login` 200, `/jobs/new` form render (**teenon mode me alag visibility**),
`/settings/service-center` save→reload persist, `/services` render, console errors 0 ·
Read-only DB verify (apply ke baad): naye columns + RLS + **anon 401** + row counts (55 tables) ·
**Report parity check** (§12.5) — implement se pahle/baad ke totals same.

---

## 11. Breakage audit — kya TUTEGA, kya nahi (22 Nov 2026, code verified)

### 11.1 ✅ Pakka nahi tootega — 6 proof points

| #   | Proof                                                                                        | Evidence (file:line)                                                                                                                                                                        | Asar                                                  |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | **`item` koi bhi code PARSE nahi karta** (split/match/replace/regex)                         | repo-wide grep → **0 matches** (sirf literal display labels)                                                                                                                                | `item` ka format badalne se koi logic nahi tootega    |
| 2   | **25+ reports/prints explicit column list** use karte hain: `select("... item ...")`         | `print-bill:70`(`*`), `print-client-ledger:68`, `print-delivered:41`, `print-mechanic-ledger:88`, `daily-incomeSeed:53`, `deliveredSeed:52`, `api/client/jobs:19`, `server-dashboard:465` … | Naye columns **inme aate hi nahi** — shape same       |
| 3   | **Additive + sab naye columns NULLABLE** — `item` ka rename/drop/type-change **banned** (§7) | plan §2.1/§3                                                                                                                                                                                | purane insert/update/select bilkul waise hi chalenge  |
| 4   | **Supabase client untyped** — repo me koi generated `Database` type nahi                     | `src/lib/supabase.ts:11` (`createBrowserClient` bina generic) · `RootClient.tsx:37` me `Database` = **lucide icon**                                                                         | naya column add karne par **tsc auto-fail nahi hoga** |
| 5   | **Backup/restore LIVE schema use karta hai**, static list sirf fallback                      | `backup/page.tsx:436,1034` "live schema se — naye columns bhi cover hote hain, koi strip nahi" · fallback `TABLE_COLUMNS:99,225`                                                            | purane backup restore → naya column `NULL` (chalta)   |
| 6   | **Financial statements `item` ko chhutti hi hai**                                            | balancesheet/cash-flow/monthly-profit me `item`/`brand` ka koi zikr nahi                                                                                                                    | statements **zero asar**                              |

**Nateeja:** reports/statements/print/mechanic ledger/client portal **tod nahi** balki
`item` compose hone par **automatically richer** (search me brand name bhi match hoga).
Sirf **display text** badlega — structure nahi.

### 11.2 ⚠️ Risk register + hal (R1–R18)

| #   | Risk (kya hoga)                                                                                                                                                | Sev | **Hal**                                                                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **`item` compose se purana free-text overwrite** — legacy "Komaki XGT scooter" me sirf brand select → "Komaki" (**silent data loss**)                          | 🔴  | **Non-destructive compose + derived preview** (§2.5) — save se pehle preview dikhta hai; chhota preview ho to warning; override ka raasta hamesha.                                                                    |
| R2  | **Compose label > 200 chars** → zod `max(200)` block / truncation                                                                                              | 🟠  | `job.ts:29` max 200 → **300** + `job.test.ts` update + form me live length warning.                                                                                                                                   |
| R3  | **Brand filter → legacy `brand_id NULL` rows chup-chaap gayab** → report/claim count galat chota (undercount)                                                  | 🔴  | Default = **All (NULL sahit)** + explicit **"Untagged (legacy)"** bucket + **coverage indicator** (§12.2) + filter kabhi mandatory nahi.                                                                              |
| R4  | **`schema:drift` CI fail** — naye objects full-schema bootstrap file me fold-in nahi                                                                           | 🟠  | Same PR me `20260913000000_final_full_schema_idempotent.sql` append + `npm run schema:drift` (exit 0) gate.                                                                                                           |
| R5  | **RLS galat → `brands` dropdown khaali / embedded join `NULL`** (RLS empty deta hai, error nahi)                                                               | 🟠  | `rlslock_service_list_staff` pattern mirror (`..._full_schema.sql:2214`) + anon koi policy nahi = deny + apply ke baad `NOTIFY pgrst, 'reload schema';`.                                                              |
| R6  | **Dual query path drift** — `jobListQueries.ts` ek hi source hai client + RSC first-paint (`lib/server-jobs.ts`) ke liye; filter sirf ek taraf → alag dikhenge | 🟠  | Filter logic **sirf `jobListQueries.ts`** me (file ka comment: "drift = silent data bug"); dono paths automatic.                                                                                                      |
| R7  | **Explicit TS interfaces** me naye field access → `tsc` error (`jobListQueries.ts:13 Transaction`, `clientDetailQueries.ts:38`, `jobViewQueries.ts:19`)        | 🟢  | `brand_id?: number \| null; model?: string \| null; serial_no?: string \| null; service_type_id?: number \| null` **optional** fields (~8-10 jagah, `mechanic_id?`/`location_id?` precedent line 29-30).              |
| R8  | **Print/job-card me lamba composed label overflow** (`print-bill:474`, Excel, job card)                                                                        | 🟢  | CSS `word-break/wrap` + A4 print preview QA (P5 gate). Excel auto-size.                                                                                                                                               |
| R9  | **Numbering chhuna → duplicate job numbers** — `next_job_id()` + partial unique index `transaction_list_job_id_autogen_uniq` me chedkhani → insert fail / race | 🔴  | **Global `job_id` bilkul mat chhue.** Sirf additive `brand_job_no` + alag atomic counter RPC + partial unique index (`WHERE brand_id IS NOT NULL`); display `KMK#001 (Ref 28101)`. **Alag phase P4, P3 stable baad.** |
| R10 | **Purane backup restore me row fail** — NOT NULL column + file me missing value (`backup/page.tsx:889` khud flag karta hai)                                    | 🟠  | **Har naya column NULLABLE** (ya DEFAULT) + rollback safe. `backup/page.tsx:225` ka static fallback `TABLE_COLUMNS` bhi update karo.                                                                                  |
| R11 | **writeGuard geofence gate** — brand CRUD/RPC office ke bahar + permit nahi to **block** (`supabase.ts:23-31`) → "save nahi ho raha"                           | 🟢  | Brand/service-type CRUD settings page (existing in-geofence flow) + naye RPC ko writeGuard me sahi classify karo. Browser me service-role **kabhi nahi**.                                                             |
| R12 | **Tests** — `job.test.ts` item cases + compose nayi behavior; 702 tests green                                                                                  | 🟢  | `jobItemLabel` unit tests (legacy/composed/override/200-char) + existing item tests update. Gate me vitest mandatory.                                                                                                 |
| R13 | **Client portal me brand nahi dikhega** (`api/client/jobs:19`, `api/client/ledger:151` explicit select) — break nahi, par portal branding alag kaam            | 🟢  | P3 me portal **chhodo** (`item` wala as-is); portal brand display ek alag phase (auth boundary alag).                                                                                                                 |
| R14 | **`gemini-tools.ts:715` `select("*")`** → AI tools ke context me naye columns aayenge                                                                          | 🟢  | Kuch mat karo — abhi harmless, baad me AI me brand filter useful.                                                                                                                                                     |
| R15 | 🆕 **Mode switch se history badal jaye** (autonomous → multi par purane jobs renumber/tag hone lagen)                                                          | 🔴  | **Retroactive kuch nahi** (§6): `brand_job_no` job creation par store, global `job_id` permanent; mode sirf naye behavior = naye jobs par.                                                                            |
| R16 | 🆕 **`brands`/`service_types` hard delete → historical rows orphan / reports me se gayab**                                                                     | 🔴  | Sirf `is_active=false` + FK `ON DELETE RESTRICT` (brand_job_counters ko CASCADE chalta hai kyunki wo admin-driven table hai). UI me "delete" = "deactivate" label.                                                    |
| R17 | 🆕 **Mode galat chuna** (`single_brand` me 2 authorized brands) → behavior inconsistent                                                                        | 🟠  | Settings guard: 2+ `is_authorized` ho to `multi_brand` suggest karo (override allowed); validation mode + brand dono padhti hai.                                                                                      |
| R18 | 🆕 **Mode/config ka stale cache** — change turant na dikhe (form validation purane mode par chale)                                                             | 🟢  | `upsertField()` pehle se `systemInfoKey` invalidate karta hai (`settings/page.tsx:268`); boot me `.in([...])` array me mode key (`useAppBoot.ts:106`).                                                                |

### 11.3 🔒 Non-negotiable execution rules (agar ye 6 toote, sab tootega)

1. `item` ka **rename / drop / NOT NULL / type change — BILKUL NAHI** (sirf value derive).
2. Har naya column **NULLABLE** (restore safety).
3. Migration ke objects **full-schema file me fold-in** + `schema:drift` exit 0.
4. Naye tables par **`is_frontend_staff()` RLS + anon deny** + `NOTIFY pgrst 'reload schema'`.
5. Brand filter ka **default = All (NULL sahit)** + "Untagged (legacy)" bucket.
6. **`brands`/`service_types` deactivate-only** + **koi retroactive renumber nahi**.

### 11.4 Compose vs render-helper — decision

| Approach                               | Faayda                                                  | Khatra / Kharcha                                                                                 |
| -------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **(A) `item` derive/preview (chosen)** | **0** report/print/select changes — 25+ sites untouched | R1 overwrite + R2 length (preview + warning se solve)                                            |
| (B) `item` chhod do, `deviceLabel()`   | overwrite risk zero                                     | **25+ explicit `select()` lists me brand_id add** = har report/print chhune padenge → churn 3-4× |

**Decision: (A)** — proof 1 (koi parse nahi karta) + proof 2 (sab `item` hi padhte hain).

---

## 12. 🆕 Reports integrity — implement se pahle/baad ke data hamesha arthpurn

> User requirement: **koi report galat/adhura na dikhe** — chahe data purana ho ya naya,
> chahe ek brand ho ya chahe koi brand na ho.

### 12.1 Structural guarantees (kaise)

1. **Financial layer untouched** — balancesheet/cash-flow/monthly-profit/client ledger me
   `item`/brand/service_type aate hi nahi (verified, proof 6) → inka **koi regression
   possible hi nahi**.
2. **Har purani row me `item` intact** (backfill nahi, compose sirf naye/edited jobs me) →
   har wahi report jo aaj `item` dikhata hai, **kal bhi wahi dikhaayega**.
3. **New dimensions = sirf wahan filter jahan hum add karein** (P3/P5). Default = All.

### 12.2 Coverage indicator (naya, chhota — bada asar)

Har brand/type-wise report header me:

> `Brand-tagged: 412 / 2,370 jobs (17%) · Untagged: 1,958`

**Kyun:** bina iske purane `NULL` rows ko dekh kar koi sochega "ye report galat hai"
ya "sirf 412 jobs hain". Coverage % batata hai ki **kitni history tag ho chuki** — partial
data ko partial hi represent karo. (Autonomous mode me ye chhup jaata hai.)

### 12.3 Stable identity (history kabhi kho na jaye)

- `service_types`/`brands` → **sirf `is_active=false`**, kabhi DELETE nahi (FK RESTRICT).
  Delete = historical rows ka group vanish.
- Service type **ID** group karti hai, naam nahi — rename karo chalega, report stable.
- Legacy `NULL` = **"Untagged (legacy)"** hamesha ek bucket, kabhi "Other" me merge nahi.

### 12.4 Mode + time independence

- Mode badalne par **koi bhi purana job apna brand/number/label change nahi karta** (R15).
- Naya data aane par purane reports ke totals **badhte hain, badalte nahi** (additive rows).
- `item` derive kabhi legacy row ko edit kiye bina **touch hi nahi karta** (edit karo tabhi).

### 12.5 Parity check (verification gate)

Apply se pehle read-only snapshot → baad me same query:

```sql
-- sirf READ (owner approval; koi write nahi)
SELECT count(*) FROM transaction_list;                     -- sabhi rows wahi
SELECT count(*) FROM transaction_list WHERE brand_id IS NULL;  -- "Untagged" count
SELECT count(*) FROM transaction_list WHERE del_status = 0;   -- active jobs wahi
```

Plus app-level: **`/reports` ke 3 reports ke totals pahle/baad same** (All-brands default par)

- `daily-income`/`delivered` ka count snapshot se match. Koi farak nahi = report parity ✅.

### 12.6 Optional: legacy backfill tool (P6)

Purane jobs ko ek saath tag karna (coverage badhane ke liye) — "item me 'Komaki' hai" →
bulk assign brand. **Existing bulk-edit pattern reuse** (`jobs/bulk-edit`).
Zaroori nahi, par autonomous → multi switch karne wale center ke liye coverage fast badhegi.

---

## 13. 🆕 User-friendly design — counter speed (koi bhi naya field gire na)

**Yahan se 3 rules: (a) counter par tap kam, (b) field sirf tab dikhe jab zaroor, (c) galat/incomplete data roke nahi.**

1. **Progressive disclosure** — device identity ek hi row: `Brand · Category · Model · Serial`.
   Mode decide karta hai kaun dikhega: autonomous me brand collapsed+optional,
   single me hidden+auto-filled, multi me required. Empty optional fields **hide**, khaali
   box dikhne se ghabrahat hoti hai.
2. **Client ka device memory** — client chunte hi "Is client ke pichhle devices" dropdown
   (brand/model/serial ek tap me prefill). Data already `transaction_list` me hai; 3 baar
   aane wale scooter ke liye **sabse bada time-saver**.
3. **Recent memory (localStorage)** — datalist me recently used brands/models (koi schema nahi).
4. **Serial = optional + scanner-friendly** — placeholder `e.g. Serial / IMEI / Chassis No`;
   keyboard-wedge scanner seedha type karta hai. ⚠️ Android app me `CAMERA` nahi (§5.12) —
   camera scanner **browser/next phase**, isliye abhi camera permission ki matlab nahi.
5. **Counter ko kabhi block mat karo** — "Save abhi, baad me bhar dein": intake par sirf
   **mode-required** fields zaroori (brand in multi, service_type default se pura).
   **Completeness gate delivery/claim par** = job view me chhota badge
   "⚠️ 2 device details pending" + claim export se pehle validation.
   (Intake par sab required karoge to staff `1` ya `xyz` likh dega — galat data se
   incomplete data behtar hai, aur baad me bhar sakta hai.)
6. **Bulk create me shared override** — `jobs/bulk`/`bulk-edit` me brand/service-type ek
   baar select → saari rows (20 job 1 tap me).
7. **Serial + brand navbar search me** — `useNavbarSearch.ts:113` ka select list me
   `serial_no`/brand add → counter par "IMEI daalo, job aa gaya" (pickup par sabse kaam aata hai).
8. **View page device card** — brand logo, model, serial (**copy button**), warranty badge,
   service type. Job card print me **serial prominent** (return par verify).
9. **Ek jagah settings** — `/settings/service-center`: mode + brands + service types +
   numbering + print header text. (Existing pattern: `settings/whatsapp-templates/` route.)
10. **Print branding** — `Authorized Service for [Brand]` + logo + serial + composite number
    `KMK#001 (Ref: 28101)` (Vikalp B approved format).
11. **Empty state honest** — autonomous mode me claim/brand-switcher UI **dikh hi nahi**
    (progressive reveal) → "ye button karta kya hai" wali confusion nahi.
12. **Hinglish help text** — har naye field par chhota tooltip (jaise `serial_no` par
    "Warranty claim aur delivery ke liye zaroori").

---

## 14. Expert advice — 6 cheezein jo main strongly suggest karta hoon

1. **Mode concept ko settings me rakho, schema me nahi.** Ek KV key + `brands.is_authorized`
   = teenon modes, **zero extra tables**. Schema stable, behavior flexible.
2. **P1–P3 (core) pehle karo, P4–P5 (numbering + claim) baad me.** Numbering = sabse zyada
   blast radius (R9), isliye core stable hone do. Claim export ko `brand_job_no` chahiye →
   isi liye **numbering pehle, claim baad me** (v2 reorder).
3. **`warranty_status` + `claim_no` abhi column me daal do** (P1) — UI P5 me. Column ka
   kharcha lagbhag zero, aur claim register ka data aaj se accumulate hota rahega
   (baad me UI aane par purane claims export nahi honge — **data abhi se zaroori hai**).
4. **Coverage indicator + Untagged bucket non-negotiable** — warna multi-brand me
   "report galat hai" wali har baithak hogi. Ye 2 chhoti cheezein puri credibility bachati hain.
5. **Legacy tagging (§12.6) ka option zaroor rakhna** — bina iske coverage 17% par
   kaafi rahega; multi-brand center ke liye `bulk-edit` se 1 weekend me coverage 80%+ ho sakta hai.
6. **Security ek hi window me:** RPC grants hardening (§8) + naye tables ka anon-deny —
   dono alag-alag karenge to dobara review hoga.

**Mera overall verdict:** plan ab **3 modes + reports integrity + counter-speed UX** cover
kar raha hai, aur har risky change ka hal usi section me likha hai. Safal hone ki 1 shart:
**naye columns NULLABLE + `item` derive-only + deactivate-never-delete** — ye teeno agar
toote to koi bhi report nahi tootega.

---

## 15. 🆕 Standard service-center coverage audit (22 Nov 2026)

> **Method:** ek standard (authorized/independent) service center ke **75 requirements**
> (8 domains) list kiye, har ek ko code grep se **verify** kiya, phir 3 states me compare
> kiya. Jo item **na code me hai na kisi plan me** — wo §15.2 gap register me.

### 15.1 Coverage matrix (verified counts)

| #   | Domain                     |  Items | 🟢 **Aaj (code)** | + **B: Core plan (P1–P5)** | + **C: Mere additions (modes/§12/§13/§5 Tier1–2)** | 🔴 Abhi bhi gap |
| --- | -------------------------- | -----: | ----------------: | -------------------------: | -------------------------------------------------: | --------------: |
| A   | Intake & job card          |     11 |                 5 |                          8 |                                             **11** |               0 |
| B   | Warranty & brand claims    |      7 |                 0 |                          4 |                                              **6** |               1 |
| C   | Spare parts / inventory    |     11 |                 9 |                          9 |                                             **10** |               1 |
| D   | Technician / HR            |      7 |                 4 |                          5 |                                              **6** |               1 |
| E   | Billing / finance / GST    |     12 |                11 |                         11 |                                             **11** |               1 |
| F   | Customer communication     |      9 |                 4 |                          5 |                                              **6** |               3 |
| G   | MIS / dashboard / security |      9 |                 5 |                          6 |                                              **8** |  1 (deliberate) |
| H   | Ops / platform             |      9 |                 6 |                          6 |                                              **6** |           **3** |
|     | **TOTAL**                  | **75** |      **44 (59%)** |               **54 (72%)** |                                       **64 (85%)** |          **11** |

_(`partial` items is count me `½` ke roop me jode gaye; A/C/E me 3 partial hain.)_
_(**G1–G3 update (22 Nov):** adopt hone par — B domain (warranty) 4/6, F domain (comm) 6/9;
core-plan column 52 → **54** (G1+G2), additions column 61 → **64** (G1+G2+G3),
gap 14 → **11**.)_

### 15.2 ❌ Gap register — G1–G3 ✅ ADOPTED (ab plan ke phases me), baaki na code, na plan

| #   | Missing item (standard system me hona chahiye)                                                                                                                                                  | Priority                        | Kyun zaroori                                                              | Proposed                                                                                                                                                                    | Effort          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| G1  | ✅ **ADOPTED (P5)** — **Claim lifecycle status** (`submitted → approved → rejected → paid`) sirf `claim_no` se nahi chalta — brand company ka paise dena kab hoga, kab nahi, tabhi track hoga   | 🔴 **P0**                       | Paisa seedha juda hai; `claim_no` sirf pehchaan deta hai, **status nahi** | P5 ke saath `warranty_claims` (job_id, claim_no, status, amount, dates) ya `warranty_claim_status` column                                                                   | ~0.5 din        |
| G2  | ✅ **ADOPTED (P1 col + P5 UI)** — **Warranty expiry date** — delivery date + N days; `warranty_until` repo me **0 match (verified)**                                                            | 🔴 **P0**                       | "Warranty tha kya?" ka jawab dene ke liye + expiry reminder               | `warranty_until date NULL` (P1) + view badge + delivery par auto-compute                                                                                                    | ~0.5 din        |
| G3  | ✅ **ADOPTED (P6)** — **Auto status notification** — status change par **khud** WhatsApp. Aaj 5 status templates hain par **manual** hain (job view/daily-done se staff hi bhejta hai — verify) | 🔴 **P0**                       | Customer ko har baar phone na kare — service center ka #1 experience gap  | Phase 1: status change par **"bhejo?" prompt + ek tap** (wa.me, abhi jaisa). Phase 2: WhatsApp Business API/webhook = alag project (browser se automation **sambhav nahi**) | ~1 din (prompt) |
| G4  | **Customer feedback / CSAT** — `feedback\|csat` **0 match (verified)**                                                                                                                          | 🟠 P1                           | Quality/technician performance ka ground truth; Google review bhi wahi se | Delivery ke baad link (public form) → `job_feedback` table                                                                                                                  | ~1 din          |
| G5  | **GSTR-wise export** (HSN/SAC summary) — Excel export hai par GST summary nahi                                                                                                                  | 🟠 P1                           | CA ko monthly return data chahiye                                         | `service_list.hsn` + `product_list.hsn` se summary CSV                                                                                                                      | ~1 din          |
| G6  | **Part-level warranty** — `part warranty\|warranty_days` **0 match (verified)**                                                                                                                 | 🟠 P1                           | Part warranty claim me company part-wise maangti hai                      | `transaction_products.warranty_until`                                                                                                                                       | ~0.5 din        |
| G7  | **Appointment / queue token** — `token\|queue\|appointment` sirf auth-token (verified)                                                                                                          | 🟠 P1                           | Walk-in rush me customer ka turn                                          | `appointments` (client, slot, type) — counter display                                                                                                                       | ~1.5 din        |
| G8  | **Dead stock / scrap / expiry** — `dead stock\|scrap\|expiry` **0 match**                                                                                                                       | 🟡 P2                           | Slow-moving inventory paise bandh karke baitha hai                        | Inventory report: N din se zero movement                                                                                                                                    | ~1 din          |
| G9  | **Device history by serial** (ek device kitni baar aayi) — serial column hi nahi tha                                                                                                            | 🟡 P2                           | Repeat complaint + fraud rokne ke liye; **serial se automatic milta hai** | `serial_no` + history view (P3 ka natural by-product)                                                                                                                       | ~0.5 din        |
| G10 | **Repeat-revisit within warranty** (usi complaint ka dobara aana)                                                                                                                               | 🟡 P2                           | Warranty me free revisit = direct loss na ho                              | G1+G9 se ban jaata hai (parent job link)                                                                                                                                    | ~0.5 din        |
| G11 | **AMC / service contract** — plan me **deliberately deferred** (§5 Tier4 #15)                                                                                                                   | 🟡 P2                           | AMC wale customers ke liye contract + due visits                          | `amc_contracts` + schedule — **tabhi jab AMC demand aaye**                                                                                                                  | ~2-3 din        |
| G12 | **Pickup / drop scheduling** (courier, door pickup slot)                                                                                                                                        | 🟡 P2                           | Public site FAQ me courier ka zikr hai, schedule nahi                     | Job ke `pickup_slot` + delivery-type field                                                                                                                                  | ~1 din          |
| G13 | **Tool / asset / calibration tracking**                                                                                                                                                         | ⚪ P3                           | Chhote center ke liye optional; bada center ke liye zaroori               | `assets` table + QR                                                                                                                                                         | ~2 din          |
| G14 | **Technician certification / training records** — `mechanic_brand_map` sirf specialization deta hai                                                                                             | ⚪ P3                           | Brand certification expiry/proof                                          | `mechanic_certs` (brand, cert no, expiry)                                                                                                                                   | ~0.5 din        |
| G15 | **SMS / email delivery**                                                                                                                                                                        | ⛔ **Blocked (owner decision)** | SMTP/real emails (jaan-boojh kar deferred — `docs/plans/...§deferred`)    | Owner approval → SMTP                                                                                                                                                       | —               |

> **Multi-tenant (alag-alag centers ka alag data) = intentional out-of-scope** (§6) —
> ye **gap nahi**, decision hai. AMC (G11) bhi jaan-boojh kar deferred hai.

### 15.3 Ratings (expert judgment, verified coverage par aadharit)

| State                                                              |       Rating | Kyun                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------ | -----------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Aaj (current code)**                                          | **5.5 / 10** | Ops + finance + inventory **strong** (job workflow, PO/GRN, stock/QR, ledger, balance sheet, due reminders, RBAC/geofence) — par **intake accountability (brand/serial/condition), warranty-claims, customer automation = zero**. Warranty domain 0/7.                  |
| **B. + Core plan (P1–P5)**                                         | **7.5 / 10** | Brand/serial/service-type/mode + numbering + claim export + **claim lifecycle (G1) + warranty expiry (G2)** → data model + claims track ready. Par **auto-notify (G3 = P6), feedback, GST summary abhi bhi nahi**.                                                      |
| **C. + Mere additions (modes, §12 integrity, §13 UX, §5 Tier1–2)** | **9.0 / 10** | Warranty columns abhi se (data accumulate), QC + handover signoff, intake contents, coverage indicator, backfill tool, brand rate card + mechanic map, device card/history, **status prompt (G3)**. Ab sirf **11 gap** (G4–G15) — sab 🟠 P1 ya uske neeche, ya blocked. |
| **D. Agar G4–G8 (P1) bhi ho jaayein**                              | **9.5 / 10** | Feedback + GST summary + part warranty + appointment + dead stock = **customer-facing + compliance maturity** poora. Bacha hua 0.5 = deliberate out (multi-tenant, AMC, tool tracking) — ye chhote center ke liye zaroori nahi.                                         |

**Sabse badi observation:** project ka **ops/finance/inventory core already professional-grade**
hai (61% abhi). Asli farak **"customer + brand ke saath relationship layer"** me hai —
warranty, claim status, auto-communication, feedback. Wo layer isi plan (B+C) se aayegi.
