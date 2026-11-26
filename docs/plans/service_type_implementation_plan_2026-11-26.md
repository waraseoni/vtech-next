# Service Type implementation plan + finding (2026-11-26)

> **Status:** Plan only — koi code/DB change abhi nahi. Owner sign-off ke baad phases execute honge.
> **Language:** Hinglish (project convention).

---

## 0. Finding (save) — Service Type abhi kahan hai aur kya missing hai

### 0.1 DB layer — sab kuch ready hai
- Table **`public.service_types`** — `supabase/migrations/20260913000000_final_full_schema_idempotent.sql` line **5010** (create), **5065** (seed), **5082–5115** (RLS + grants: authenticated only, anon revoke).
- FK column **`public.transaction_list.service_type_id integer REFERENCES service_types(id) ON DELETE SET NULL`** — same file line **5048**. Nullable hai, default NULL.
- Default seed rows (6):
  `Repair (0)`, `New Installation (10)`, `Warranty Claim (20)`, `AMC / Service Visit (30)`, `PDI / Delivery (40)`, `Inspection / Estimate (50)`.
- Master add/edit/deactivate UI already live: **`/settings/service-center` → "Service Types" tab** (`src/app/settings/service-center/page.tsx` — kind `serviceTypes`, line 53/80/86/180/483/544/606/685).
- Backup/restore me bhi hai: `src/lib/backupRestore.ts:27` (`{ table: "service_types", order: 2 }`), restore tests `backupRestore.test.ts:19`.

### 0.2 Frontend seed — data aa rahi hai, use koi nahi karta
- `fetchJobFormMasters()` `service_types` fetch karta hai — `src/app/jobs/jobFormQueries.ts` line **127–131** (`select("id, name, sort_order")`), return line **177**.
- Type: `JobFormServiceType` (line **22**), field `serviceTypes` (line **33**).
- New + edit dono layouts is seed ko serve karte hain:
  - `src/app/jobs/new/layout.tsx:18` → `fetchJobFormSeed`
  - `src/app/jobs/[id]/edit/layout.tsx:17` → `fetchJobFormSeed`
  - `src/lib/server-job-form.ts` → neutral wrapper
  - `src/app/jobs/JobFormSeedProvider.tsx` → `useJobFormSeed()` client hook

### 0.3 Missing — 0 write/read surfaces
Repo-wide grep (`service_type|serviceType`) sirf yeh dikhata hai: settings master, seed query, backup order. **Na koi form field hai, na payload me `service_type_id` jaata hai, na view/list/filter me dikhta hai.**

Poore frontend me job payload likhne ki paths (sab `transaction_list`):

| Surface | File | Fault gate |
|---|---|---|
| New/Edit job form | `src/app/jobs/new/page.tsx` (insert ~875, update 866, payload 827–861) | schema + step-1 gate line **778** |
| Edit (legacy route) | `src/app/jobs/[id]/edit/page.tsx` (payload ~794, update 833) | line **756** |
| Bulk create | `src/app/jobs/bulk/page.tsx` (insert 383) | validation line **295**, gate **330** |
| Bulk edit | `src/app/jobs/bulk-edit/page.tsx` (update 342) | line **305** |
| Quick create (jobs list) | `src/app/jobs/JobsBody.tsx` (insert ~1007) | line **971** |
| Old legacy form ×2 | `src/app/jobs/old/client.tsx` (455), `src/app/jobs/[id]/old/client.tsx` | line **421** |

Status-only updates (view page 633/667, clients view 589, JobsBody 561/626) fault/service_type nahi chhute — unhe chhune ki zaroorat nahi.

---

## 1. Problem — "New Installation" par Fault field galat hai

- DB: `fault text NOT NULL` (schema line **479**).
- Validation (5 jagah sab `min(1)` / `.trim()` required):
  - `src/lib/validation/schemas/job.ts:42` — `z.string().trim().min(1, "Fault description zaroori hai")`
  - `src/app/jobs/new/page.tsx:778` — step-1 gate `trigger(["client_id","fault","mechanic_id"])`
  - `src/app/jobs/bulk/page.tsx:295` + `330`
  - `src/app/jobs/bulk-edit/page.tsx:305`
  - `src/app/jobs/JobsBody.tsx:971` (quick create), `src/app/jobs/old/client.tsx:421`
- Result: **installation/PDI/warranty-claim type job me user ko jabardasti koi na koi "fault" likhna padta hai** (ya fake text daalna padta hai), warna save block. Aur Service Type choose hi nahi hota — `service_type_id` hamesha NULL rehta hai.

---

## 2. Design decisions (recommendation ke saath)

| # | Decision | Recommendation | Alt |
|---|---|---|---|
| **D1** | Faultless type kaise mark hoga? | **`service_types.expects_fault boolean NULL`** column. `NULL` = fault required (back-compat, koi forced backfill nahi). Migration sirf 2 seed rows set karegi: `New Installation`, `PDI / Delivery` → `false`. Settings modal me checkbox. Rename-proof. | Name-based config code me (migration nahi, par rename par chup-chaap toot jayega) — **reject** |
| **D2** | Fault NOT NULL kaise handle hoga? | **`ALTER TABLE transaction_list ALTER COLUMN fault DROP NOT NULL`** (guarded/idempotent). Purane rows untouched; hamesha string likhne wale code safe; naye non-fault jobs `NULL` store konge. | Placeholder text (`"New Installation — no fault"`) rakhna — noise in search/list/report — **reject** |
| **D3** | New job me default Service Type? | Seed se **"Repair" pre-select** (sort_order 0). Default behaviour aaj jaisa hi rahega — fault required rehta hai jab tak user type badle na. | Empty + required selection — extra click, reject |
| **D4** | Field placement (kram rule) | Rule: `Item → Brand → Model → Identifier → (summary)`. Service Type **summary ke baad, Fault se pehle** — kyunki usi ka fault-required decide karna hai. Fault grid (`new/page.tsx:1689` `grid-cols-2`) me: **left cell = Service Type \***, right cell = Fault (conditional). | Alag full-width row — zyada vertical space |
| **D5** | Bulk me type kaise? | **Global default selector + per-row editable** — bilkul `applyGlobalMech` pattern (`bulk/page.tsx:274`) jaisa. Global selection sabhi empty rows me bhare, row apna badal sake. | Sirf global (galat batch hote hain) / sirf per-row (slow) |
| **D6** | Legacy old forms scope? | **Defer (Phase 6, optional)** — `/jobs/old` aur `/jobs/[id]/old` low-traffic legacy hain; column NULL safe hai. | Abhi include — scope badhata hai |
| **D7** | Service Type required ya optional? | **Required with D3 default** (Repair). Optional chhodna phir se NULL data dega. | — |

**Non-breakage guarantee:** `service_type_id` nullable hai + default NULL → **jo writers/service types par abhi nahi ja rahe (old forms, koi third-party) wo bilkul safe hain**; unke rows `NULL` dikhte rahenge ("legacy/unset").

---

## 3. Phases

### Phase 0 — DB (owner apply karega; agent DB write nahi karega)
Naya migration `supabase/migrations/20261126_service_type_fault_nullable.sql` (idempotent, guarded):

```sql
-- 1) fault ko nullable karo (DROP NOT NULL idempotent hai — repeat run safe)
ALTER TABLE public.transaction_list ALTER COLUMN fault DROP NOT NULL;

-- 2) service_types config column (NULL = fault required → back-compat)
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS expects_fault boolean;

-- 3) sirf 2 seed types ke liye faultless flag (seed config, koi job-row backfill NAHI)
--    WHERE IS NULL → dobara chalao to admin ki explicitly-set value touch nahi hogi
UPDATE public.service_types
   SET expects_fault = false
 WHERE expects_fault IS NULL
   AND name IN ('New Installation', 'PDI / Delivery');
```

- Koi new grant/RLS change nahi (`service_types` table-level grants already hain; `expects_fault` unke andar aata hai).
- Consolidated schema file (`20260913000000_final_full_schema_idempotent.sql`) sync karna hoga jahan drift check expect karta hai, phir **`npm run schema:drift` green**.
- Backup/restore: `service_types` + `transaction_list` already restore hote hain; naya column live-schema se flow hoga (force-restore columns OpenAPI se leta hai) — koi change nahi, sirf restore smoke.

### Phase 1 — Shared logic + validation
1. **Naya `src/lib/serviceType.ts`** (pure, testable):
   - `expectsFault(type: {expects_fault?: boolean|null} | null | undefined): boolean` → `null` = `true`.
   - `defaultServiceTypeId(types): number | null` → D3: `Repair` by name, warna `sort_order` min, warna null.
   - `serviceTypeLabel(types, id)` → view/list fallback (`null` → `"—"` / "Legacy").
2. **`src/lib/validation/schemas/job.ts`**:
   - Add `service_type_id: z.number().int().positive().nullable()`.
   - Add UI-only flag `fault_required: z.boolean()` (DB me nahi jaata).
   - `fault`: `min(1)` hatao → `z.string().trim().max(1000)` + `.superRefine`: `fault_required && !fault` → issue `"Fault description zaroori hai"`.
   - `emptyJobForm`: `service_type_id: null`, `fault_required: true` (default Repair jaisa hi behaviour).
3. **`src/app/jobs/jobFormQueries.ts`**:
   - line 129 select me `expects_fault` add; `JobFormServiceType` (line 22) me `expects_fault?: boolean | null`.
   - (Type ka shape `settings/service-center` wale `ServiceType` se bhi match hona chahiye — dono jagah consistent rakho.)

### Phase 2 — Write surfaces
1. **`src/app/jobs/new/page.tsx`** (create + edit dono):
   - `formSeed.serviceTypes` se default resolve (D3) — mount par `setValue("service_type_id", defaultId)` + `setValue("fault_required", expectsFault(...))` (edit me row ki existing value se).
   - `useWatch({name:"service_type_id"})` → type badle to `fault_required` update (fault value ko **mat chhuppa/erase karo** — user ka text safe rakho; sirf gate change ho).
   - UI (D4): Fault grid (`~1689`) me left cell = `SearchableSelect` "Service Type \*" (options = seed, sort_order order), right cell = Fault — label/requiredness `fault_required` se dynamic. Faultless type par input disabled nahi, optional + hint: `"New Installation me fault optional hai"`.
   - Step-1 gate (line 778): `trigger(["client_id","mechanic_id", ...(faultRequired ? ["fault"] : [])])`.
   - Payload (line 827): `service_type_id: current.service_type_id`, `fault: values.fault.trim() || null`.
   - Preview line **2108**: faultless par `{serviceTypeName || "Fault?"}`.
2. **`src/app/jobs/[id]/edit/page.tsx`**:
   - Row `select("*")` (line 343) me column aa jayega → state `serviceTypeId` + `faultRequired`, load me (357 `setFault(data.fault ?? "")` pehle se null-safe).
   - Same UI + gate (756) + payload (794 `fault: fault.trim() || null` + `service_type_id`).
   - **Fault edit karte waqt galti se NULL mat karo existing repair jobs ka** — yahan value local string state se aati hai, wahi behaviour.
3. **`src/app/jobs/bulk/page.tsx`**:
   - `BulkRow` (line 77) me `serviceTypeId: number | null` + `emptyBulkRow` (106).
   - Global selector "Default Service Type" (D5) — mechanic wale pattern (274 `applyGlobalMech`) jaisa, default Repair.
   - `buildRowValidation` (290–297): `Fault Reported` sirf tab miss jab `expectsFault(row type)`; mechanic-logic (`itemOf && fault && mech` at 330) ko type-aware karo.
   - Payload (369): `service_type_id`, `fault: row.fault.trim() || null`.
   - Card UI (kram rule): Identifier ke baad Service Type dropdown, Fault label/requiredness dynamic.
   - Footer counter (741) bhi type-aware.
4. **`src/app/jobs/bulk-edit/page.tsx`**: select (175) me `service_type_id` add; row state; validation (305) conditional; payload (335).
5. **`src/app/jobs/JobsBody.tsx` quick create**: fault gate (971) conditional + payload (1007) + UI (~2891) me compact Service Type select (default Repair).
6. **Extractability:** `buildRowValidation` bulk page ke andar hai — pure helper me extract karo (`src/lib/bulkJobValidation.ts`) taaki unit-test ho sake.

### Phase 3 — Read/display surfaces
1. **`src/app/jobs/[id]/view/jobViewQueries.ts:117`**: select me `service_type_id` add + naam ke liye ek chhota join/query (`service_types` by id — doosra query ya `.select("..., service_types(name)")` embedding, jo RLS allow kare).
2. **`src/app/jobs/[id]/view/page.tsx`**:
   - Service Type chip/badge (item/fault block ke paas).
   - Fault block (line 999) `job.fault` null par hide (pehle se JSX me render hota hai — `job.fault &&` check confirm karo).
   - WhatsApp/HTML text line **775**: `${job.fault}` → `${job.fault ?? ""}` (ya type line add karo).
3. **`src/app/jobs/JobPreviewPanel.tsx:154`** — `txn.fault &&` pehle se safe ✓ (bas type line add karo).
4. **List/table**: `JobsBody` fault cell (1656) null par empty render — safe ✓. Search `fault.ilike` (navbar 119, list 2075) NULL rows se match nahi honge — expected.
5. **`combined-invoice/page.tsx:478`**, bill/WhatsApp templates — `fault` interpolation guard (`?? ""`), aur service type dikhana ho to optional line.
6. **Backward-compat display:** `service_type_id IS NULL` (purane jobs) → view me type row hide; koi "legacy" jhootha label mat dikhao.

### Phase 4 — Settings master
- `src/app/settings/service-center/page.tsx`:
  - `ServiceType` type (53) me `expects_fault: boolean | null`.
  - `serviceTypes` fetch select (180) me column add.
  - Modal (`~606` serviceTypes branch) me checkbox: **"Fault required hai?"** (default ON jab NULL).
  - Save payload me `expects_fault: form.expectsFault`.
- Deactivate-only rule wahi rahega (is_active=false), hard DELETE nahi.

### Phase 5 — Tests + gates
- **Unit tests (vitest):**
  - `src/lib/serviceType.test.ts` — `expectsFault` (null→true/false), `defaultServiceTypeId` (Repair priority), label fallback.
  - `jobFormSchema` tests — fault required jab `fault_required: true`; optional jab false; `service_type_id` type-check; empty defaults.
  - Bulk validation helper tests — mixed rows (Repair row fault-mandatory, New Installation row fault-optional).
- **Gates (sab green before sign-off):**
  `npx tsc --noEmit` · `npm run lint` · `npx vitest run` (744+ tests) · `npm run schema:drift` · `npm run build` · touched files prettier clean.
- Owner se migration apply + restore smoke (naye column ke baad backup/restore ek baar).

### Phase 6 — Optional / deferred
- Legacy old forms (`jobs/old/client.tsx`, `jobs/[id]/old/client.tsx`) — D6.
- Jobs list me Service Type **filter** (NULL = "Legacy/Unset" bucket me).
- Reports/exports (warranty claim export, P6 track) me Service Type column.
- `get_transactions_with_client_data` RPC — fault nullable safe hai; column add karna ho to alag migration (RPC signature change = drift check me dikhega).

---

## 4. Risks & edge cases

1. **`fault` NULL → har `.trim()` / interpolation check.** Grep chalao `\.fault\b` before Phase 3: `jobViewQueries` type `fault: string` (line 28) → `string | null` karna hoga (TS error khud pakad lega — yahi se start karo, tsc pure surface list de dega).
2. **Edit me fault erase na ho** — type badalne par fault text user ka rehna chahiye (sirf gate/requiredness badalta hai). Save par hi `""` → `NULL` map ho.
3. **Step-1 gate skip** — default Repair (D3) ke wajah se aaj ka behaviour same: fault by default required. Gate sirf tab skip jab user ne type explicitly badli.
4. **Bulk save gate (330)** — wrong filter se rows silently drop ho sakti hain; helper-extract + test zaroori.
5. **Schema drift** — naya migration consolidated schema + drift check se sync karna warna `schema:drift` red.
6. **Restore round-trip** — `service_types.expects_fault` + `transaction_list.service_type_id` (NULL preserve!) restore me aana chahiye; `backupRestore` null→`""` fix already hai, regression test me coverage add karo.
7. **RLS** — `service_types` me `is_frontend_staff()` policy + anon deny pehle se hai; naya column koi naya surface nahi kholta.
8. **Koi NOT NULL wapas mat lagao** — kisi bhi phase me `fault` par NOT NULL na lautayein.

---

## 5. Out of scope (jaan-boojh kar)
- `item` / Device Identity kram ka koi change (rule: `Item → Brand → Model → Identifier → (summary)` unchanged).
- Job numbering / brand-wise sequence (P6 alag track).
- `auth` restore / backup ke aur fixes (done — `27b8038`).
- Hard delete of masters (deactivate-only rule).
- Reports SQL rewrites (sirf zarurat par RPC drift note).

---

## 6. Execution checklist (sign-off ke baad)

- [ ] D1–D7 owner confirm
- [ ] Phase 0 migration file + consolidated schema sync + drift green (owner applies to DB)
- [ ] Phase 1 `serviceType.ts` + schema + seed select
- [ ] Phase 2: new → edit → bulk → bulk-edit → quick create
- [ ] Phase 3: view + preview + bill/WhatsApp guards
- [ ] Phase 4: settings checkbox
- [ ] Phase 5: tests + 5 gates + restore smoke
- [ ] Phase 6 decisions (old forms / filter) alag se
