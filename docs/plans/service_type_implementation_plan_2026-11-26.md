# Service Type implementation plan — **v2 (revised)** (2026-11-26)

> **Status (27 Nov 2026):** Phase 0 migration owner ne apply kar diya; Phase 1–5 code done
> (`serviceType.ts`, conditional-fault schema, seed fix, 5 write surfaces, read surfaces,
> settings checkbox, tests/gates). **A8 legacy tagging run + restore smoke owner approval par baaki.**
> Koi agent DB write/commit nahi. Baaki kaam `master_completion_plan_2026-11-26.md` me track hai.
> **v2 changes:** `fault` nullable karne ka idea **drop** (bahut zyada blast radius) ·
> purane approved plan (`service_center_data_model_plan_2026-11-21.md` §2.2) se align ·
> deactivated-type edit edge case · bulk-edit ko legacy tagging tool banaya ·
> quick-create decision · schema:drift ki asli behaviour verify ki.
> **Extends:** `service_center_data_model_plan_2026-11-21.md` §2.2 (service type = job-level,
> required, default Repair) — yeh usi ka **unfinished P2** hai, naya design nahi.

---

## 0. Finding (verified, 26 Nov 2026)

### 0.1 DB — ready
- `public.service_types` — create `20260913000000_final_full_schema_idempotent.sql:5010`,
  seed `:5065`, RLS/grants `:5082–5115` (authenticated only, anon revoke).
- `transaction_list.service_type_id int NULL REFERENCES service_types(id) ON DELETE SET NULL`
  — same file `:5048`. **Column live DB me already hai** (owner ne apply kiya).
- Seed: `Repair`, `New Installation`, `Warranty Claim`, `AMC / Service Visit`,
  `PDI / Delivery`, `Inspection / Estimate`.

### 0.2 Frontend — data aata hai, use koi nahi karta
- `jobFormQueries.ts:127–131` `service_types` select karta hai, `:177` return;
  `JobFormServiceType` `:22`, `serviceTypes` `:33`.
- New + edit layouts dono `fetchJobFormSeed` se serve karte hain
  (`jobs/new/layout.tsx:18`, `jobs/[id]/edit/layout.tsx:17` → `JobFormSeedProvider`).
- **0 write/read surfaces**: koi form field nahi, payload me `service_type_id` nahi,
  view/list/filter me nahi. Master CRUD `/settings/service-center` me hai.

### 0.3 Fault forced hai (5 jagah + DB)
- `transaction_list.fault text NOT NULL` (`:479`).
- `job.ts:42` `min(1)` · `jobs/new/page.tsx:778` step-1 gate ·
  `bulk/page.tsx:295,330` · `bulk-edit/page.tsx:305` ·
  `JobsBody.tsx:971` (quick create) · `old/client.tsx:421`.

---

## 1. Problem

"New Installation"/"PDI" type job me "Fault Reported" label hi galat hai aur field mandatory hai —
user fake text likhta hai ya save nahi kar pata. Aur chunki type kabhi chuna hi nahi jaata,
`service_type_id` hamesha NULL rehta hai → future type-wise reports/claim exports ka data hi nahi.

---

## 2. Design decisions (v2 — with one big reversal)

| # | Decision | Recommendation |
|---|---|---|
| **D1** | Faultless type kaise mark hoga? | **`service_types.expects_fault boolean NULL`**. `NULL` = fault **required** (back-compat default, admin ke naye types ke liye bhi). Migration sirf 2 seed rows `false`: `New Installation`, `PDI / Delivery`. |
| **D2** ⭐ | Fault DB constraint? | **`fault NOT NULL` ko CHHEDO HI NAHI.** Faultless types par `fault = ""` likho. *(v1 me maine `DROP NOT NULL` recommend kiya tha — galat tha, §3 dekho.)* |
| **D3** | Default type | `Repair` pre-select (active types me `sort_order` min; name match optional). Aaj ka behaviour same rehta hai. |
| **D4** | Placement | Kram rule `Item → Brand → Model → Identifier → (summary)` ke baad, Fault se pehle: **left cell = Service Type \***, right cell = Fault (dynamic label/requiredness). |
| **D5** | Bulk | Global default + per-row override (mechanic pattern, `applyGlobalMech` `bulk/page.tsx:274`). |
| **D6** | Quick create | Compact select, default Repair (1 tap change) — installation bhi counter par banti hai, chhupana galat hoga. |
| **D7** | Legacy old forms | Defer (column NULL-safe; old forms `NULL` likhenge = "legacy"). |
| **D8** | Bulk-edit | Service Type **editable column** add karo — yahi **legacy tagging tool** ban jayega (purane jobs ko type assign karke coverage badhao). |

**Non-breakage:** `service_type_id` nullable hai → jo writer aaj type nahi bhejta (old forms,
koi bhi purana code) wo `NULL` likhega aur sab kuch chalta rahega. Dashboard/list me `NULL` =
"Untagged (legacy)" bucket, kabhi "Other" me merge nahi.

---

## 3. ⭐ D2 reversal — kyun `fault` nullable NAHI karna chahiye

v1 me maine `fault` ko nullable karne ka plan likha tha. Code dobara padhne par wo **galat trade-off** nikla:

| | `DROP NOT NULL` (v1) | `fault NOT NULL` + `""` (v2) |
|---|---|---|
| DB migration | `ALTER COLUMN ... DROP NOT NULL` (risk + review) | **zero** |
| Type churn | `fault: string` → `string \| null`; `jobViewQueries.ts:28`, `JobPreviewPanel`, print/WA interpolation — **10+ sites**, har ek miss = production bug | **zero** |
| Restore/backup | NULL vs `""` semantics ka naya edge case (is project me pehle `null→""` coercion se index toota tha) | **zero** — column untouched |
| Report SQL | `fault IS NULL` vs `''` ka naya distinction | same as aaj |
| Semantics | "clean" NULL | thoda impure, par **is project ka established pattern** (`remark text NOT NULL` bhi `""` se chalta hai, `new/page.tsx:843`) |
| UX | same | same — UI me dono blank dikhte hain |

**Nateeja:** report/print/restore ka poora blast radius khatam. Sirf validation + labels badalte hain,
jo waise bhi karna hai. Jab kabhi bhi genuinely NULL chahiye ho (jaise P6 analytics), tab alag
migration se karenge — aaj nahi.

**Faultless type par label bhi badlega** (yahi asli fix hai):
- `expects_fault = true` → **"Fault / Complaint \*"** (required, aaj jaisa)
- `expects_fault = false` → **"Work Description / Scope (optional)"** + hint:
  "Installation me complaint nahi hoti — kaam ka scope likh sakte hain (optional)."
- Text likha to **save hota hai** (`fault` me hi) — koi data zaya nahi; khaali chhoda to `""`.

> Yani "fault field galat hai" ka fix = **label + requiredness type ke hisaab se**, field ko
> database se gayab karna nahi.

---

## 4. Phases

### Phase 0 — DB (owner apply karega; agent DB write nahi)
`schema:drift` script verify kiya (`scripts/check-schema-drift.mjs:101–107`): `ADD COLUMN` ko
track karta hai, isliye full-schema file me **fold-in mandatory** hai.

`supabase/migrations/20261126_service_type_expects_fault.sql` (idempotent):

```sql
-- NULL = fault required (purane behaviour / naye admin types ke liye default)
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS expects_fault boolean;

-- sirf 2 seed types faultless (job rows ka koi backfill NAHI)
UPDATE public.service_types
   SET expects_fault = false
 WHERE expects_fault IS NULL
   AND name IN ('New Installation', 'PDI / Delivery');
```

- **`transaction_list` par koi change nahi** — na column, na constraint.
- Fold-in `20260913000000_final_full_schema_idempotent.sql` me (service_types block ke paas):
  same `ALTER TABLE ... ADD COLUMN IF NOT EXISTS expects_fault boolean;`
- Phir **`npm run schema:drift` exit 0** (aaj 33 OK hai, 34 ho jayega).
- Backup/restore: `service_types` order 2 par hai (transaction_list order 5 se pehle ✓) —
  naya column live-schema se automatic, koi change nahi. Restore smoke ek baar.

### Phase 1 — Shared helper + validation
1. **`src/lib/serviceType.ts`** (pure):
   - `expectsFault(t: {expects_fault?: boolean|null} | null | undefined): boolean` → `null → true`.
   - `defaultServiceTypeId(active: JobFormServiceType[]): number | null` → `sort_order` min,
     name `Repair` ko priority.
   - `faultFieldLabel(expects: boolean): string`, `faultRequiredMessage(expects)`.
2. **`src/lib/validation/schemas/job.ts`**:
   - `service_type_id: z.number().int().positive().nullable()`
   - `fault_required: z.boolean()` (**UI-only**, DB me nahi jaata)
   - `fault`: `min(1)` hatao → `.max(1000)` + `.superRefine` → `if (v.fault_required && !v.fault.trim()) ctx.addIssue({ path: ["fault"], message: "Fault description zaroori hai" })`
     - **Path `["fault"]` zaroori hai** warna `trigger("fault")` (step-1 gate) error nahi pakdega
       aur error input ke neeche nahi dikhega.
   - `emptyJobForm`: `service_type_id: null`, `fault_required: true` (purane tests safe).
3. **`jobFormQueries.ts`**:
   - `JobFormServiceType` (`:22`) me `expects_fault?: boolean | null`, `is_active?: boolean`.
   - Select (`:129`) me dono add. **`.eq("is_active", true)` hatao** (ya `or` karo) —
     warna **deactivated type wale purane job ka edit form type khaali dikhayega** (`null` save
     hone ka risk!). UI active list filter karegi, current value ko preserve karegi.

### Phase 2 — Write surfaces

**A. `src/app/jobs/new/page.tsx`** (create + edit)
- Mount/seed: `serviceTypes` se default (D3) sirf **create mode** me; edit me row ki value.
- Edit-load mapping (`~410–430`): `service_type_id: data.service_type_id ?? null`,
  `fault_required: expectsFault(typeOf(data.service_type_id))` — **reset me set karna zaroori**,
  warna installation job edit par fault mandatory reh jayega.
- `useWatch("service_type_id")` → `setValue("fault_required", ...)`. **Fault text erase mat karo** —
  type badalne par sirf requiredness/label badle.
- UI (`~1689` fault grid): left `SearchableSelect` "Service Type \*", right Fault
  (label/`*`/hint dynamic).
- Step-1 gate (`:778`): `trigger([...("client_id","mechanic_id"), ...(faultRequired ? ["fault"] : [])])`.
- Payload (`:827`): `service_type_id`, `fault: values.fault.trim()` *(empty allowed — NOT NULL ok)*.
- Summary preview (`:2108`): faultless + empty → type ka naam dikhao, `"Fault?"` nahi.

**B. `src/app/jobs/[id]/edit/page.tsx`**
- `select("*")` (`:343`) me column already aa raha hai → state + load.
- Same UI + gate (`:756`) + payload (`:794`).
- Type badalne par `fault_required` recompute; fault text preserve.

**C. `src/app/jobs/bulk/page.tsx`**
- `BulkRow` + `emptyBulkRow`: `serviceTypeId: number | null`, `faultRequired: boolean` (derive).
- Global "Default Service Type" (D5) + per-row compact select.
- Validation: `buildRowValidation` ko **pure helper me extract** (`src/lib/bulkJobValidation.ts`)
  — `Fault Reported` sirf `expectsFault` ho tab missing; mechanic rule (`:296–297`) bhi type-aware.
- Save filter (`:330`) + payload (`:369`) + footer counter (`:741`) update.
- Card UI: Identifier ke baad Service Type, Fault label dynamic.

**D. `src/app/jobs/bulk-edit/page.tsx`** (D8 — legacy tagging)
- Select (`:175`) me `service_type_id`; row state; validation (`:305`) conditional; payload (`:335`).
- Har row me Service Type select → purane NULL jobs ko tag karne ka tool.
- Load ke waqt `fault_required` type se derive.

**E. `src/app/jobs/JobsBody.tsx` quick create** (D6)
- Gate (`:971`) conditional, payload (`:1007`) me `service_type_id`, compact select (`~2891`),
  default Repair. Modal speed intact (ek tap).

### Phase 3 — Read/display
1. `jobs/[id]/view/jobViewQueries.ts:117` select me `service_type_id` + naam resolve
   (extra query ya PostgREST embed `service_types(name)` — RLS staff policy already ✓).
2. View page: type chip (device card ke paas); fault block (`:999`) empty par hide
   (type faultless ho to "Work description" label).
3. `JobPreviewPanel.tsx:154` — `txn.fault &&` pehle se safe; type line add.
4. **List filter (P3.5, optional):** `jobListQueries.ts` ek hi source hai (RSC + client) —
   filter wahi add karo, embed `service_types(name)`. **Denormalize mat karo** (naam snapshot
   column nahi) — FK hi correct hai; rename history me reflect hona chahiye.
   Default = **All (NULL sahit)** + "Untagged (legacy)" bucket.
5. Print/WhatsApp: `fault` interpolation already string-safe (`""`); service type line optional.

### Phase 4 — Settings master
`src/app/settings/service-center/page.tsx`:
- `ServiceType` type (`:53`) + fetch (`:180`) + save payload me `expects_fault`.
- Modal (serviceTypes branch `~606`): checkbox **"Fault required hai?"** — default ON jab NULL.
- Deactivate-only rule unchanged.

### Phase 5 — Tests + gates
- `src/lib/validation/schemas/job.test.ts`: base `emptyJobForm` spread hai → naye fields
  compile-safe. Naye cases: `fault_required:true` + empty fault → error; `false` + empty →
  pass; `service_type_id` validation.
- `serviceType.test.ts`, `bulkJobValidation.test.ts` (mixed rows).
- Gates: `tsc --noEmit` · `lint` · `vitest` · `schema:drift` · `build` · touched files prettier.
- Owner: migration apply → restore smoke (service_types round-trip + transaction NULL preserve).

---

## 5. Risks & edge cases (v2)

1. **Deactivated type + edit** (naya catch): seed query `is_active=true` filter hatao, warna
   purane job ka type edit me `null` ho sakta hai. Current value ko inactive bhi dikhao (badge).
2. **`fault_required` reset me set na karna** → installation job edit par fault mandatory
   reh jayega. Edit-load mapping me explicitly set.
3. **Zod `superRefine` error path** `["fault"]` — warna step-1 `trigger("fault")` silent pass.
4. **Bulk save filter** (`:330`) galat ho to rows silently drop — pure helper + tests.
5. **Default Repair ka silent risk** — sab naye jobs "Repair" ban jayenge. Mitigation: selected
   type form summary + job card/list me chip; baad me type filter. (Data quality ko type ke
   bina chhodne se behtar hai.)
6. **Legacy NULL** = "Untagged" bucket, filter default All — report undercount nahi.
7. **Old forms** `NULL` likhenge — expected; bulk-edit se tag ho sakte hain (D8).
8. **Schema drift** — ADD COLUMN fold-in warna CI red (script `:101–107` column objects track karta hai).
9. **Restore** — `service_types` parent order 2 ✓, transaction order 5 — koi FK issue nahi.
10. **Fault remains NOT NULL** — kisi bhi phase me `DROP NOT NULL` mat karo (v1 ka galat idea).

---

## 6. Expert advice (mera seedha opinion)

1. **Fault nullable mat karo** — is app me sabse mehnga risk DB constraint nahi, **`string|null`
   type churn** hai (10+ display/print/WA sites + restore semantics). `""` + dynamic label se
   wahi UX milta hai, zero migration risk. (v1 se yahi correction hai.)
2. **Service type ko "invisible default" mat banao.** Default Repair theek hai, par selected
   type form summary me aur job card/list me dikhna chahiye — warna 6 mahine baad pata chalega
   "sab installation jobs Repair me chali gayin". Visibility hi data quality hai.
3. **`service_types` par hard delete kabhi nahi** — purane panel ka rule; `expects_fault` isi
   table par rakho taaki rename-safe rahe (name-matching config code me **mat** rakho).
4. **Bulk-edit ko tagging tool banao** (D8) — 2,300+ legacy jobs hain; iske bina type-wise
   coverage 0% rahegi aur reports "adhuri" lagengi. Ye P6 ka "legacy bulk-tag tool" bhi cover
   kar deta hai — alag tool banane ki zarurat nahi.
5. **Type filter abhi mat banao** — pehle 2–3 hafte data aane do; filter bina coverage ke sirf
   "0 results" wali confusion degi. Jab banao, "Untagged (legacy)" bucket mandatory.
6. **Service type ko `service_list` par mat daalo** (purana plan §7) — `service_list` labor rate
   catalog hai, type job ka attribute hai. Confusion sabse common galti hai.
7. **Faultless label "Work Description" rakho, "Fault" nahi** — installation/PDI me scope likhna
   genuinely useful hai (kya lagaya, kya check kiya). Field ko hide karne se better hai
   relabel + optional.
8. **Quick create me selector rakho** (1 tap) — color/installation jobs counter par hi banti hain;
   chhupane se log galat "Repair" bana denge.
9. **Rollout simple rakho**: koi feature flag nahi — column nullable + default Repair hai, isliye
   partially shipped surfaces bhi safe hain (jo surface type nahi bhejta, NULL likhta hai).
   Isi liye Phase 2 ke surfaces alag-alag din me ship ho sakte hain.
10. **Claim export (P6) isi column par depend karega** — `Warranty Claim` type ke bina claim
    register adhura hai. Isliye type abhi ship karna P6 ki neev hai, "nice to have" nahi.

---

## 7. Out of scope

- `fault` constraint/type change (bilkul nahi).
- `item` / Device Identity kram (unchanged: `Item → Brand → Model → Identifier → summary`).
- Brand-wise numbering, warranty lifecycle, claim export (P6 track).
- `service_list.category` (alag axis, purane plan §2.2).
- Reports SQL/RPC changes (koi zarurat nahi — `get_transactions_with_client_data` fault `text`
  hi return karta hai, `""` safe).

---

## 8. Execution checklist

- [~] D1–D8 confirm (D1/D2 migration apply se effectively accept; D3–D8 sign-off baaki)
- [x] Phase 0 migration + full-schema fold-in + `schema:drift` 34 OK (owner applied)
- [x] Phase 1 helper + schema + seed select (`is_active` filter fix)
- [x] Phase 2: new → edit → bulk → bulk-edit → quick create
- [x] Phase 3: view + preview (+ optional filter baad me)
- [x] Phase 4: settings checkbox
- [~] Phase 5: tests + 5 gates ✓ (75 files / 765 tests); restore smoke owner approval par
- [ ] Legacy tagging run (bulk-edit) — coverage report (owner run)
