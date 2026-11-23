# Job Device Identity UX Plan — Brand · Model · Identifier dropdown + add-new + har jagah sahi display

> **Created:** 24 Nov 2026 · **Revision 2:** 24 Nov 2026 (user review ke baad) ·
> **Status:** 🟢 P1–P5 code complete (uncommitted) · gates green ·
> **live DB untouched** (owner approval pending). P0 sign-off aur migration apply baaki hai.
> **Extends (does not replace):** `service_center_data_model_plan_2026-11-21.md` (v2) —
> uske §2.1 (device columns), §2.4 (3 modes), §2.5 (derived `item`), §11 (breakage audit),
> §12 (reports integrity), §13 (counter-speed UX) **as-is maane gaye hain**.
> Ye document sirf **UX + display layer** ka detail hai: teen device fields ko
> _searchable dropdown + inline "add new"_ banana aur **item dikhne wali har jagah**
> unka consistent, sahi tarike se display.
>
> **Owner approval pending** (§10) · Hinglish docs rule follow.

---

## 0. Ek line me faisla

Jobs me `item` ke saath **Brand, Model aur Identifier** ke 3 fields honge —
**Brand aur Model** searchable dropdown (existing list se select) + **"+" se inline
add-new** (jaisa aaj `location_id` ka `JobSpotPicker` karta hai). **Identifier unique
hota hai har item ke liye** — isliye uska dropdown/master nahi, **optional typeable
text field** (Revision 2). Field kram **Item → Brand → Model → Identifier** hai.
`item` column **badlega nahi** — wo in 3 se **derived label** ban jayega, isliye item
dikhne wali **40+ jagah apne aap rich ho jayengi**; sirf **rich display** wali chuni
hui jagahon par ek shared `<DeviceIdentity />` component se structured line add karenge.

---

## 1. User request → exact mapping

| User ne kaha                                                                             | Is plan me kya hoga                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "item ke sath brand, model aur identifier ka option ho"                                  | Intake form me 3 naye device fields — `brand_id`, `model`, `serial_no` (DB name purane plan se; **UI label = "Identifier"**).                                                                       |
| "dropdown ki tarah kam kare, wahi se select kiya ja sake"                                | **Brand + Model** ke liye `SearchableSelect` (repo ka existing component) — type-to-search, mobile bottom-sheet, keyboard.                                                                          |
| "jo list me na ho use add karne ka option ho"                                            | Brand/Model dropdown ke paas **"+" → modal → dedupe → insert → auto-select** — `JobSpotPicker:68-101` ka exact pattern.                                                                             |
| **Rev 2:** "identifier unique hota hai, dropdown nahi — type karne layak optional field" | Identifier `DeviceFieldPicker` hata kar `<input type="text">` — `normalizeIdentifier()` (trim + uppercase + space collapse) blur par. DB table `device_identifiers` **same rehti hai** (drop nahi). |
| **Rev 2:** "bulk me har job ke liye alag item, brand, model, identifier — yahi kram"     | Bulk create + bulk-edit dono me **global override hata diya**; har row me 4 alag fields, kram **Item → Brand → Model → Identifier**.                                                                |
| **Rev 2:** "/jobs/new runtime error + sidebar link"                                      | React Compiler ke `useWatch` reorder se TDZ → `ManageJobPageInner` me `"use no memo"`; Settings ke andar nested link ke saath **direct sidebar link** bhi.                                          |
| "jaha bhi item show hota hai, sabhi jagah sabhi ka sahi display"                         | 3-layer display strategy (§5): derived `item` = 0-change coverage; `<DeviceIdentity />` = structured coverage; search = discoverability.                                                            |
| "purana plan bhi padho"                                                                  | Padha — §2.5 non-destructive compose, §11 R1–R18, §12 parity, §13 ux rules **non-negotiable** hain.                                                                                                 |

---

## 2. Kya pehle se decided hai (reuse), kya naya

| #   | Purana plan (v2) se                                                         | Is plan me naya                                                                                                        |
| --- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | `item` free-text **NOT NULL unchanged**, naye columns NULLABLE, no backfill | Har 3 field ka **dropdown + add-new UX** detail (exact component, states, copy)                                        |
| 2   | `brands` table proposed (§2.3), mode-aware visibility (§2.4)                | **Model aur Identifier ke liye bhi master tables** + unka add-new flow + brand-dependent model list                    |
| 3   | `composeJobItemLabel()` + preview/warning (§2.5)                            | Compose format final + **custom free-text escape** + display contract (ek hi helper, ek hi component)                  |
| 4   | "12 render sites" estimate (§1)                                             | **Verified 40+ display sites** enumerate (§4.2) + layered coverage plan (§5)                                           |
| 5   | Search me serial add karna (§13.7)                                          | Brand + Model + Identifier **sab search/filter me**, exact file:line + query shape                                     |
| 6   | 3 modes (autonomous/single/multi)                                           | Dropdown behaviour mode ke hisaab se (single me brand auto-fill; multi me required) — existing mode contract hi follow |

---

## 3. Current reality — verified audit (24 Nov 2026)

### 3.1 Item **input** surfaces — full audit (7)

> Har surface par label me red `*` hai, par **sirf old form + quick-create + bulk/bulk-edit
> me actually validation hai**; `jobs/new` me `item` zod me optional hai (purana plan §1).

| #   | Surface                   | Input (label / placeholder)                                                                                                                                                                                                         | State + validation                                                                                                                                                                        | Save path                                                                                                                                                                              | Form ke andar existing select / add-new patterns                                                                                                                                                                                                                                                                                                          | `brand`/`model`/`serial`/`imei` pehle se?                          |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | **Job new**               | `jobs/new/page.tsx:1497-1505` — label `Item / Model *` (`:1499`), `<input {...register("item")} placeholder="e.g. iPhone 15 Pro, Samsung S24">` (`:1501-1505`)                                                                      | RHF `useWatch` `:149`; `jobFormSchema.item = z.string().trim().max(200)` `validation/schemas/job.ts:29` — optional (label ke bawajood)                                                    | `handleSave` payload `item: values.item` `:756` → `transaction_list.update(...).eq("id",jobId)` `:784` (edit) ya `.insert([...])` `:795` (create); direct supabase, server action nahi | `SearchableSelect` client `:1411`, mechanic `:1466`, service `:1582`, product `:1716`; `JobSpotPicker` (location) `Controller` `:1524-1536`; **inline add-new** service `:1572` → modal `:1069` → `handleSaveNewService` `:464-498` (insert `service_list` → local append → auto `addService`), product `:1706` → `:1180` → `handleSaveNewProduct` `:503` | ❌ 0 (sirf product spec placeholder `:1271` "model compatibility") |
| 2   | **Job edit**              | `jobs/[id]/edit/page.tsx:1411-1420` — label `Item / Model *` (`:1413`), `<input value={item} onChange={setItem} placeholder="e.g. iPhone 15 Pro, Samsung S24">`                                                                     | local `useState item` (seed se), `handleSave` me `if (!item.trim()) toast.error("Item/Model zaroori hai!")` `:702`, payload `item: item.trim()` `:738`; **zod schema yahan nahi chalata** | direct supabase `.update(payload).eq("id",jobId)` `:778` + services/products delete-reinsert `:818,831`                                                                                | `SearchableSelect` `:1328,1385,1489,1623`; `JobSpotPicker` `:1439`; **inline add-new** client `:981` → `handleSaveNewClient` `:373-392`, service `:1091` → `:434-449`, product `:1130` → `:473-489`; `?client_id` auto-select `:90,257`                                                                                                                   | ❌ 0                                                               |
| 3   | **Job old (manual)**      | `jobs/old/client.tsx:589-595` — label `Item / Model *`, `<input value={item} onChange={setItem} placeholder="e.g. Sharpy 10R Axis">`                                                                                                | `useState(item)` `:157`, seed se `setItem(job.item)` `:253`; `if (!item.trim())` block `:361`; payload `item: item.trim()` `:394`                                                         | direct supabase `.update(txnData)` `:414` (edit) / `.insert({...txnData, code})` `:427`; child rows insert `:438,449`                                                                  | `SearchableSelect` client `:540`, service `:642`, product `:724`, mechanic `:844`; native `<input>` for manual job id `:574`                                                                                                                                                                                                                              | ❌ 0                                                               |
| 4   | **Job `[id]/old`**        | `jobs/[id]/old/client.tsx:589-595` — **file #3 ka copy** (same label/placeholder/state lines)                                                                                                                                       | same `useState` `:157` / `:253` / `:361` / `:394`                                                                                                                                         | same `.update` `:414` / `.insert` `:427`                                                                                                                                               | same `SearchableSelect` `:540,642,724,844`                                                                                                                                                                                                                                                                                                                | ❌ 0                                                               |
| 5   | **Bulk create**           | `jobs/bulk/page.tsx:486-491` header `Item / Model *`; **row inputs** desktop `:536-540` (`placeholder="Item / Model"`, `data-bulk-input-item`) + mobile card `:650-657` (`label Item / Model *`, `placeholder="Item Name / Model"`) | row type `item: string` `:78`, default `""` `:113,153,177`; `updateRow(id,"item",value)` `:538,655`; validation `if (!r.item.trim()) miss.push("Item / Model")` `:235`, valid rows `:271` | `handleSaveAll` `:245` → payload `item: row.item.trim()` `:305` → single batched `transaction_list.insert(inserts)` `:320`                                                             | **global override** `SearchableSelect` client `:430`, default mechanic `:445` ("Select karne par sabhi rows me apply" `:452-454`); per-row mechanic `SearchableSelect` `:562,679`; focus-first-error `:351-364`                                                                                                                                           | ❌ 0                                                               |
| 6   | **Bulk edit**             | `jobs/bulk-edit/page.tsx:481-486` header; row inputs desktop `:542-543` + mobile `:653-658` (same placeholders as #5)                                                                                                               | row `item: string` `:59`, seed `item: t.item ?? ""` `:154` (explicit select `:135` — **3 columns add**); validation `:259`; `updateRow(id,"item",value)`                                  | `handleSaveAll` `:253` → payload `item: r.item.trim()` `:283` → batched `Promise.all(rows.map(update))` `:291`                                                                         | **global override** `SearchableSelect` client `:373`, mechanic `:403`; per-row client `:527`, mechanic `:560,674`; `select("id, job_id, client_name, item, fault, mechanic_id, uniq_id, remark")` `:135`                                                                                                                                                  | ❌ 0                                                               |
| 7   | **JobsBody quick-create** | `JobsBody.tsx:2761-2772` — label `Item / Model *` `:2764`, `<input placeholder="e.g. iPhone 15, Samsung S24" value={quickForm.item}>` `:2766-2771`                                                                                  | `quickForm` local state `:895`; `if (!quickForm.item.trim()) toast.error("Item/Model zaroori hai!")` `:944`; no zod                                                                       | `handleQuickCreate` `:942` → direct `.insert({item: quickForm.item.trim() ...})` `:971-990` → `bumpJobCounter` `:995` → redirect `/jobs/{id}/edit` `:1002`                             | quick client search field + `SearchableSelect` mechanic (quick lookup `:935`), no add-new inline; compact modal — 3 naye pickers yahin compact rehne chahiye                                                                                                                                                                                              | ❌ 0                                                               |

**Constraint:** `jobs/new` + `edit` already server-seeded masters via
`layout.tsx:3 → server-job-form.ts:15 → jobFormQueries.ts:64-105 → JobFormSeedProvider.tsx:8-20`;
naye 3 masters **usi `Promise.all` me** add karo = 0 extra request.
**Bulk=2 alag layouts** (desktop table + mobile card) — dono me input do baar milta hai, dono badalne honge.
**Old forms 2 identical files** — ek component extract karke dono use karein (copy-paste drift se bachne ke liye).

### 3.2 Item **display** surfaces — verified 40+ (purane plan ka "12" underestimate tha)

**A. Zero-change (kyunki `item` derived label hoga — ye sab apne aap rich ho jayenge):**

`JobsBody.tsx:1350,1606-1607,2427` · `JobPreviewPanel.tsx:152` · `jobs/[id]/view:993` ·
`clients/[id]/view:1649,1731` · `DashboardBody.tsx:980` · `pending-jobs/PendingJobsBody.tsx:604,719,877` ·
`reports/delivered/client.tsx:688,854` · `reports/daily-income/client.tsx:1014` ·
`reports/daily-done/DailyDoneBody.tsx:549,728` · `reports/ledger/client.tsx:1361` ·
`mechanics/[id]/(detail)/page.tsx:804` · `mechanics/ledger/[id]/page.tsx:551` ·
`my-account/page.tsx:243` · `SpotJobsModal.tsx:117,145` · `api/print-bill:224,474` ·
`api/print-job-status:209` · `api/print-combined-invoice:303,356` · `api/print-mechanic-ledger:240` ·
`api/print-mechanic-detail:114` · `api/export-transactions:63` (`select("*")`) ·
`api/print-transactions:63` (`select("*")`) · `whatsappTemplates.ts:121,135,148,166,180` (`{item}`) ·
`Gemini tools` (`gemini-tools.ts:810,1332`) · `requiredParts.ts:366`, `partsPendingSeed.ts:128`,
`ledger-data.ts:284`, `daily-done-data.ts:194`, `clientLedgerQueries.ts:167`, `client/ledger/route.ts:160`,
`api/client/jobs:19`, `api/public/job-status:114`, `public/job-status/page.tsx:445,559,705`,
`combined-invoice/page.tsx:476`, `clients/[id]/add-payment/page.tsx:460`.

**B. Structured display add karna hai (explicit `<DeviceIdentity />`):**

`jobs/[id]/view` device card · `JobsBody` list row expand/detail · `jobs/[id]/view` print/job-card ·
`public/job-status` tracking card · `api/print-bill` job-card header · `api/client/jobs` portal ·
`DashboardBody` recent-job chip · `pending-jobs` rows.

**C. Search / filter (alag axis):**

`jobListQueries.ts:193,315` (`item.ilike`) · `useNavbarSearch.ts:113,116,201` ·
`useNavbarSearch` select `id, job_id, item, fault, status, date_created` → **3 columns add**.

**D. Explicit `select()` lists jo naye columns nahi laate** (sirf tab edit jab structured display C/B chahiye):

`jobListQueries.ts:460` · `server-dashboard.ts:465` · `clientDetailQueries.ts` ·
`deliveredSeed.ts:52` · `dailyIncomeSeed.ts:53` · `clientLedgerQueries.ts:144` ·
`api/client/jobs:19` · `api/print-*:41,65,68,72,88,96,150` · `useNavbarSearch.ts:113` ·
`partsPendingSeed.ts:88` · `vyapar-data.ts:145` · `bulk-edit/page.tsx:135`.
Baaki `select("*")` wale (`print-bill:70`, `export-transactions:63`, `gemini-tools:715`,
`new/page.tsx:343`, `edit/page.tsx:298`, `JobPreviewPanel.tsx:38`, `daily-done-data.ts:133`)
**apne aap naye columns la lenge**.

> **Single-source rule:** display logic sirf 2 files me — `src/lib/deviceIdentity.ts`
> (format helper) aur `src/components/DeviceIdentity.tsx` (render). Kisi bhi page par
> `brand/model/serial` ka `.map`/`.join` **copy-paste mat karo** — drift = galat display.

### 3.3 Reusable input components + "select ya naya banayein" patterns (verified)

**Repo me 5 relevant components hain** — koi generic `Combobox`/`CreatableSelect`/`Typeahead`
nahi, aur job forms me native `<datalist>` **0** (sirf `expenses/.../ExpensesPageInner.tsx:1259,1267`
me expense-category datalist hai):

| Component                             | Kya karta hai                                                                                                                                                                                                                                                                                    | Is plan me use                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `src/components/SearchableSelect.tsx` | Core **searchable dropdown**: props `value/options/id,label,sub,disabled/ onSelect(id) / placeholder / clearLabel / renderSelected` (`:7-28`); portal menu, mobile bottom-sheet, viewport flip (`:38-50,77+`)                                                                                    | ✅ 3 naye pickers ka base (as-is reuse)          |
| `src/components/JobSpotPicker.tsx`    | **Exact "dropdown + inline add-new" reference**: own fetch `:31-52` → options `:58-66` → `SearchableSelect` `:108-131` → `+` modal `:133-140,142-179` → `createSpot` `:68-101`: `ilike` dedupe (`:73-81`) → insert (`:83-87`) → local append + auto-select (`:93-96`), error `toast.error` `:89` | ✅ `DeviceFieldPicker` isi ko follow karega      |
| `src/components/SupplierPicker.tsx`   | Doosra inline-add reference: own search UI, `+` → "Naya Supplier add karo" modal `:418`, insert `:167-185`, **auto-select** comment `:191`, onSelect `:194-195`                                                                                                                                  | pattern cross-check                              |
| `src/components/LocationPicker.tsx`   | Type-to-search **4-level dependent** picker (zone→rack→bin→box), disambiguation modal `:270,293`; **add-new nahi**                                                                                                                                                                               | ❌ (model→brand dependency UX se reference sirf) |
| `src/components/NavbarSearch.tsx`     | Global search box + `useNavbarSearch.ts` query (`:113,116,201` — `item.ilike`); dropdown results                                                                                                                                                                                                 | ✅ Layer C me 3 fields add                       |

**Page-level inline add-new (component nahi, par pattern same):**

1. **Service** — `jobs/new:1572` button → modal `:1069` → `handleSaveNewService` `:464-498`:
   insert `service_list` → `.select("id,name,price").single()` → `setServices([...prev,created])`
   → `addService(created.id)` (auto-add to current job) → success toast; catch → `logger.error` + `toast.error`.
   Edit me same `:1091 → :434-449`.
2. **Product** — `jobs/new:1706 → :1180 → handleSaveNewProduct :503`.
3. **Client** — `jobs/[id]/edit:981 → handleSaveNewClient :373-392`.
4. **Job Spot** — `JobSpotPicker` (upar).

> **Implementation directive:** naya `DeviceFieldPicker` **sirf `JobSpotPicker` pattern copy kare**
> (dedupe → insert → auto-select → toast). `LocationPicker` se sirf dependent-field behaviour
> (brand badle par model clear) reference lena — wo khud add-new nahi karta.

---

## 4. UX design — the heart

### 4.1 Intake me "Device Identity" block

Ek hi compact row (counter par scroll kam) — order **Brand → Model → Identifier**:

```
Device Identity                                    [Client ke purane devices ▾]
┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐  ┌─────────────┐
│ Brand       🔍+│  │ Model       🔍+│  │ Identifier      🔍+ │  │ Item (auto) │
│ Komaki       ▾ │  │ XGT            ▾│  │ S/N: KMK123...   ▾ │  │ Komaki·XGT·…│
└────────────────┘  └────────────────┘  └──────────────────────┘  └─────────────┘
                       ↑ brand chune par usi brand ke models filter
ℹ️ Identifier = Serial / IMEI / Chassis / Vehicle no — warranty aur delivery ke liye.
```

- **Label**: `Brand`, `Model`, `Identifier (Serial / IMEI)` — user ki basha me "Identifier", DB me `serial_no`.
- **Item (auto)** read-only preview input; niche chhota text: "Ye label bill, WhatsApp aur reports me dikhega."
- **Custom escape**: chhota link **"Apna text likhein"** → `item` wapas editable (legacy/free-text raasta hamesha khula — plan §2.5 rule).
- **Client memory**: client chunte hi "Is client ke pichhle devices" list se 3 fields ek tap me prefill (`transaction_list` se distinct brand/model/serial).
- **Order flip** na karein: Brand pehle (axis), phir Model, phir Identifier — print/export me bhi yahi order.

### 4.2 Dropdown + add-new — exact behaviour (copy `JobSpotPicker`)

Reusable component: `src/components/DeviceFieldPicker.tsx` (props: `kind: "brand"|"model"|"identifier"`, `value`, `brandId?`, `onSelect`).

| Step | Behaviour                                                                                                                                      | Reference                                                 |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Options load (server seed + component fetch fallback), `SearchableSelect` me render — search, mobile bottom sheet, viewport flip               | `SearchableSelect.tsx:15-50`, `JobSpotPicker.tsx:108-131` |
| 2    | **"+" icon** button trigger ke andar/right — click → small modal (`e.g. "Naya model add karo"`)                                                | `JobSpotPicker.tsx:133-140,142-179`                       |
| 3    | Modal me 1 text input, **Enter = save**; button **"Banao aur Select karo"**                                                                    | `JobSpotPicker.tsx:164-176`                               |
| 4    | **Dedupe before insert** (`ilike` on name/value, model me `+ brand_id` condition). Exist kare → naya insert nahi, existing select + info toast | `JobSpotPicker.tsx:73-81`                                 |
| 5    | Success → `insert` (brand/service-list jaisa RLS + writeGuard se), local options state me append, **auto-select** + modal close                | `JobSpotPicker.tsx:83-96`                                 |
| 6    | Error → `toast.error`, modal khula rahe (user ka typed text na gave)                                                                           | `JobSpotPicker.tsx:89`                                    |
| 7    | Recent memory: `localStorage` me recently-used 5 ids (pattern: `public/job-status/page.tsx:49-75`), dropdown ke upar **"Recent"** group        | new (safe, no schema)                                     |

**Master-add safety:**

- Direct browser me service-role **kabhi nahi** (project rule).
- Naye records `is_active=true`, **delete = deactivate** (purana plan §7/R16).
- writeGuard office ke bahar insert block karta hai → toast clear: _"Master add karne ke liye office location par aayein ya permit lein."_
- Naye master rows **immediately visible** ho (React Query `invalidateQueries` + local append dono).

### 4.3 Field-wise rules

| Field          | Master                        | Options kaise filter                                  | Add-new par kya save                                                                                                             | Kya required                                                                              |
| -------------- | ----------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Brand**      | `brands` (planned §2.3)       | `is_active=true`, mode hisaab se authorized-only chip | `name`, `code` (optional 2–4 char), `is_authorized=false` default; admin badh sakta hai                                          | mode: autonomous = optional, single = auto-fill, multi = required + "General / Unbranded" |
| **Model**      | **naya** `device_models`      | selected brand ke models; brand na ho to saare active | `name`, `brand_id` = abhi selected brand ( agar brand abhi select nahi → form ke andar hi brand bhi choose karne ka mini-picker) | optional (counter block nahi)                                                             |
| **Identifier** | **naya** `device_identifiers` | saare active values + "Recent" group; lookup fast     | `value` (trim, upper-case normalize serial), `note?`                                                                             | optional; duplicate par warning (same identifier do active jobs = fraud/repeat signal)    |

- **Brand change → model clear** (silently galat brand-model combo na bache); confirm toast: _"Brand badla — model clear kar diya."_
- **Identifier uniqueness** hard constraint **nahi** (ek device do baar aati hai = feature, G9 history); soft warning par **"Isi device ka purana job dekhein"** link.
- **Mode-aware visibility** exactly purane plan §2.4 table jaisa — UI sirf tab dikhe jab mode allow kare.

### 4.4 `item` derived label — final contract

Helper: `src/lib/deviceIdentity.ts`

```ts
composeJobItemLabel({ brand, model, identifier, legacyItem, customItem }): string
formatDeviceIdentity(job): { label: string; brand?: string; model?: string; identifier?: string; isLegacy: boolean }
```

| Situation                              | Output                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 3 me se koi bhi nahi                   | legacy `item` **jaisa ka taisa** (0 change)                                                                                   |
| Kuch bhara                             | `Brand · Model · Identifier` — **jo khali hai wo chhup jayega**, "undefined"/"—" nahi                                         |
| `customItem` (Apna text likhein)       | user ka text exactly (override)                                                                                               |
| Composed label purane `item` se chhota | preview me warning: _"Purana item text chhota ho jayega — zaroori dikhe to 'Apna text likhein' dabayein."_ (silent loss nahi) |
| Length > 200                           | `job.ts:29` max **300** (plan R2) + live counter; DB `item text` limit nahi hai                                               |

**Example:** `Komaki · XGT · KMK123456789` → bill/WhatsApp/list/reports sab me yahi dikhega.
**Legacy row:** `Komaki XGT scooter` → koi structured field nahi → wahi purana text, `isLegacy=true`.

### 4.5 Display contract ("sahi tareeke se" ka matlab)

Har jagah **ek hi format**: `Brand · Model · Identifier` (order fixed), empty part omit,
legacy fallback = raw `item`, long text truncate + `title` tooltip (print me wrap).

| Display context                 | Kya dikhega                                                                            | Component/helper                       |
| ------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------- |
| Job list row                    | 1-line composed `item` (already) + hover me chhota `Brand · ID` chip                   | `formatDeviceIdentity()`               |
| Job view / client view          | **Device card**: 3 labeled rows + **Identifier ke saath copy button** + warranty badge | `<DeviceIdentity variant="card" />`    |
| Print bill / job-card           | `Item/Model:` me composed label + chhota `S/N …` line, wrap-safe CSS                   | `formatDeviceIdentity()` in route      |
| WhatsApp templates              | `{item}` me composed label (template badalne ki zarurat nahi)                          | 0 change                               |
| Public tracking / client portal | composed label + model line (no internal IDs)                                          | `<DeviceIdentity variant="compact" />` |
| Dashboard / pending-jobs        | composed label truncated + brand dot/chip                                              | `formatDeviceIdentity()`               |
| Search results                  | composed label + match highlight (brand/model/serial me bhi search)                    | `useNavbarSearch`                      |

---

## 5. Display rollout — 3 layers (blast radius kam se kam)

| Layer                   | Kya                                                                                                                        | Kitni jagah change          | Risk                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------- |
| **A — Derived `item`**  | `composeJobItemLabel()` save par `item` me likhta hai; 40+ sites bina chhue rich                                           | **0 display file**          | Low (purana plan R1/R2 — preview + warning se solve)           |
| **B — Structured card** | Sirf §3.2-B me enumerate 8 jagah `<DeviceIdentity />`; explicit `select()` me 3 columns add                                | ~8 files + ~10 select lists | Low (additive fields optional)                                 |
| **C — Search**          | `jobListQueries.ts:193,315` + `useNavbarSearch.ts:113,116` me `brand_id/model/serial_no` clauses; navbar select me columns | 2 files                     | Med (query shape — `jobListQueries` single-source rule follow) |

**Kabhi na karein:** har print/export/report route me alag se `.brand_id` join likhna —
is se 25+ files churn honge aur purana plan R6 (dual path drift) wapas aayega.

---

## 6. Data model (additive, plan v2 ke saath same migration)

Purane plan `20261122_service_center_fields.sql` sketch me **2 tables extra** fold karein:

```sql
CREATE TABLE IF NOT EXISTS public.device_models (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  brand_id   integer REFERENCES public.brands(id) ON DELETE RESTRICT,
  is_active  boolean NOT NULL DEFAULT true,
  date_created timestamptz DEFAULT now(),
  date_updated timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_models_active_brand_idx
  ON public.device_models (brand_id, name) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.device_identifiers (
  id         serial PRIMARY KEY,
  value      text NOT NULL UNIQUE,     -- trim + upper (serial/IMEI/chassis/vehicle)
  note       text,
  is_active  boolean NOT NULL DEFAULT true,
  last_used  timestamptz,
  date_created timestamptz DEFAULT now()
);
```

`transaction_list` me purane plan ke exactly ye columns (koi naya enum nahi):
`brand_id int NULL`, `item_category text NULL`, `model text NULL`, `serial_no text NULL`,
`service_type_id int NULL`, `warranty_*`.

**Rules (purane plan §11.3 non-negotiable):**

1. `item` ka rename/drop/NOT NULL/type-change — **bilkul nahi**.
2. Har naya column **NULLABLE**, koi backfill nahi → purana backup restore safe.
3. Nayi tables par `is_frontend_staff()` RLS + **anon deny** + grants + `moddatetime` trigger.
4. `20260913000000_final_full_schema_idempotent.sql` me **fold-in** + `npm run schema:drift` exit 0.
5. Deactivate-only (hard delete nahi), `NOTIFY pgrst, 'reload schema';`.
6. Live apply **sirf owner approval** ke baad + read-only simulation/row-count snapshot pehle.

> ⚠️ `rpc_grants_hardening_plan.md` ka `reset_sequence` anon hole **P1 ke saath hi** band karwao (purana plan §8).

---

## 7. Phases + DoD

| Phase  | Kaam                                                                                                                                                     | Files                                                                                                                                    | Effort   | Rollback                                        |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------- |
| **P0** | Owner decisions (§10) + display contract sign-off                                                                                                        | —                                                                                                                                        | 0.5 h    | —                                               |
| **P1** | Migration (3 tables + columns + RLS + fold-in), `/settings/service-center` me Brand/Model/Identifier master CRUD (existing `/services` pattern), mode KV | `20261122_*.sql`, full-schema, `settings/service-center`, `RootClient.tsx` link                                                          | ~1 din   | DB objects drop (khali honge), UI revert        |
| **P2** | `deviceIdentity.ts` + tests; `DeviceFieldPicker`; 3 pickers + preview + custom escape in **new/edit/quick-create**; schema `item` 300 + optional fields  | `deviceIdentity.ts(.test.ts)`, `DeviceFieldPicker.tsx`, `jobs/new`, `jobs/[id]/edit`, `JobsBody`, `job.ts(.test.ts)`                     | ~1.5 din | UI files revert; `item` values intact           |
| **P3** | Old forms + bulk/bulk-edit — Rev 2: per-row Item → Brand → Model → Identifier (identifier free text)                                                     | `jobs/old`, `jobs/[id]/old`, `jobs/bulk`, `jobs/bulk-edit` (+ select list)                                                               | ~0.5 din | UI revert                                       |
| **P4** | Display Layer B — device card + print + portal + public tracking (8 sites)                                                                               | `jobs/[id]/view`, `clients/[id]/view`, `JobsBody`, `print-bill`, `api/client/jobs`, `public/job-status`, `DashboardBody`, `pending-jobs` | ~1 din   | UI revert (A se derived label chalता rehta hai) |
| **P5** | Display Layer C — search/filter + brand chip + coverage indicator                                                                                        | `jobListQueries.ts`, `useNavbarSearch.ts`, `JobsBody` filter bar                                                                         | ~0.5 din | Query revert                                    |
| **P6** | Purane plan ke P4–P7 (numbering / warranty claim / status prompt / legacy bulk-tag) — **alag track**, is plan se block nahi                              | —                                                                                                                                        | ~3 din + | purana plan                                     |

**Core (P1–P5) ≈ 4.5 din.** Har phase ka DoD: `prettier` · `tsc --noEmit` · `npm run lint` ·
`npx vitest run` · `npm run schema:drift` (P1) · browser smoke (3 modes, mobile dropdown,
inline add, print preview) · **report parity** (§12.5 purana plan).

### Implementation status (24 Nov 2026, uncommitted)

| Phase  | State                     | Note                                                                                                                                                               |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P0** | ⏳ Owner sign-off pending | mode, brand-required, seeds, separator, numbering/config                                                                                                           |
| **P1** | ✅ Code done              | `20261122_service_center_fields.sql` + full-schema fold-in + `/settings/service-center` CRUD + **direct + nested nav link**                                        |
| **P2** | ✅ Code done              | `deviceIdentity.ts`, `DeviceFieldPicker`, new/edit/quick-create pickers + preview + custom escape, zod 300 guard; **identifier text (Rev 2)**; `/jobs/new` TDZ fix |
| **P3** | ✅ Code done              | shared `DeviceIdentityFields` dono old forms; bulk/bulk-edit me **per-row 4 fields** (global override hata diya)                                                   |
| **P4** | ✅ Code done              | `<DeviceIdentity />` card (job view), print-bill S/N line, client portal, public tracking (serial chhupa), JobsBody list subline + S/N chip                        |
| **P5** | ✅ Code done              | `jobListQueries.ts` me `jobSearchFilter()` single-source (model + serial_no clauses), navbar search select/filter/subtitle                                         |
| **P6** | ⏳ Alag track             | purane plan ke P4–P7                                                                                                                                               |

**P4 note:** `DashboardBody` aur `reports/pending-jobs` ko structured card nahi mila — inke data
source (`get_dashboard_recents` RPC / `select("*")`) derived `item` hi dikhaate hain (Layer A),
aur RPC badalna DB change hai (owner approval ke baad P6 me). Baaki 5 B-sites explicit cover.
Public tracking par `<DeviceIdentity compact showIdentifier={false} />` se alag S/N line chhupi
hai, par derived `item` khud me S/N rakhta hai aur Info Grid me dikhta hai — **"no internal IDs"
ka exact matlab P0 sign-off me confirm karna**. Agar public label se S/N hatana hai to
`composeJobItemLabel({ brand, model, legacyItem: item })` ka alag public variant banega.

**Gates (final):** `prettier` ✅ · `tsc --noEmit` ✅ · `npm run lint` ✅ (0 warnings) ·
`npx vitest run` → **69 files / 712 tests pass** ✅ · `npm run schema:drift` → **32 migrations OK** ✅ ·
`npm run build` → **compiled, 137 static pages** ✅.
Browser smoke + report parity abhi pending (live DB apply ke baad).

### Revision 2 — user review ke baad (24 Nov 2026)

| #   | Naya requirement / bug                                                | Kya kiya                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sidebar me `/settings/service-center` dikhna chahiye                  | `RootClient.tsx` me System header ke niche **direct "Service Center" nav link** (nested Settings → Service Center bhi retained). Desktop + mobile drawer dono shared `SidebarNav` se cover.                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2   | `/jobs/new` runtime `ReferenceError: brandName before initialization` | Do alag bugs the: (a) React Compiler ne `useWatch` calls reorder kiye → `ManageJobPageInner` me **`"use no memo"`** directive (compiled chunk me `finalItem` ab `brandName` ke baad hai); (b) **dobarah error dikhne ki asli wajah** — `next.config.ts` dev me bhi `/_next/static/*` ko `max-age=31536000, immutable` bhejta tha aur Turbopack dev chunk filenames content-hash nahi hote, isliye browser purana buggy chunk pin kar leta tha. Ab dev me **`no-store, must-revalidate`**, prod me immutable unchanged. Purana cached entry hatane ke liye **ek baar hard-refresh zaroori**. |
| 3   | Identifier dropdown nahi — optional typeable field                    | `DeviceIdentityFields`, new/edit, quick-create, old forms (2), bulk/bulk-edit se `kind="identifier"` picker hata diya. `<input type="text">` + `normalizeIdentifier()` on blur. **`device_identifiers` table / migration / settings tab unchanged** — sirf UI picker band.                                                                                                                                                                                                                                                                                                                  |
| 4   | Field kram: Item → Brand → Model → Identifier                         | Shared component + new/edit + quick-create + bulk/bulk-edit dono layouts (desktop table + mobile card) me yahi kram.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 5   | Bulk me har job ke liye alag device fields                            | `jobs/bulk`: global device override block **remove**; `BulkRow` me `brandId/brandName/model/serial/customItem` add; item auto-compose (with "Apna text" escape); save payload per-row. `jobs/bulk-edit`: DB se loaded per-row fields editable, typed `item` preserve, khali ho to composed fallback.                                                                                                                                                                                                                                                                                        |
| 6   | Brand badalne par model clear                                         | Shared component me ek hi `patch()` — do alag patch karne par doosra stale state se model clear overwrite kar deta tha.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 7   | Bulk page ke boxes asymmetric the                                     | Desktop table + mobile cards (do alag DOM, alag heights: input ~34px vs picker ~42px, Item me extra label row) hata kar **ek hi uniform card grid** — 8 fields, desktop `lg:grid-cols-4` (2×4), mobile `grid-cols-2` (4×2). Common `BulkField` label wrapper + `min-h-[42px]` controls. `data-bulk-*` hooks preserved. Browser verify: 8 boxes equal 260×63, controls 42–43px, console errors 0.                                                                                                                                                                                            |

**Expert advice (Rev 2):**

- **Identifier optional + unique:** sahi call hai — S/IMEI har device ka apna hota hai, master
  table usko "pick list" banati hai (duplicate entries + wrong selection ka risk). Free text
  rakhne se counter par type karna tez hai; `normalizeIdentifier()` case/spaces normalize karta
  hai to search aur prints me drift nahi. DB uniqueness constraint **abhi mat lagao** — purane
  rowsnullable hain, backfill nahi; unique index future me owner approval ke saath.
- **Kram Item → Brand → Model → Identifier:** bill/reports me pehle "kya gaya" (item), phir
  "kaunsa brand/model", phir "kaunsa piece" — ye reading order counter staff ke liye natural
  hai. Item auto-label + custom escape se legacy text ka silent loss bhi nahi hota (risk N3).
- **Bulk per-row override:** global override tez tha par ek client ki alag-alag machines ke
  liye galat tha. Per-row fields zyada scrolling mangte hain, isliye desktop table horizontally
  scrollable aur mobile me card layout rakha gaya — accuracy speed se upar.
- **`device_identifiers` table:** drop mat karo (purana plan v2 ka safety invariant). UI se
  picker hatana kaafi hai; settings me tab legacy data ke liye rehta hai.

---

## 8. Risk register (naye risks; purane R1–R18 additionally applicable)

| #   | Risk                                                              | Sev | Hal                                                                                                  |
| --- | ----------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------------------------- |
| N1  | Inline add se **duplicate brand/model** (spacing/case)            | 🟠  | `ilike` dedupe + upper/trim normalize + unique index (`lower(name)`)                                 |
| N2  | Brand badla, **model stale** (galat combo save)                   | 🔴  | Brand change par model clear + toast; save par helper cross-check                                    |
| N3  | Composed label se **purana free-text chhup gaya**                 | 🔴  | §4.4 preview + shrink warning + "Apna text likhein" escape                                           |
| N4  | 3 dropdowns se **counter slow**                                   | 🟠  | Progressive disclosure (mode), recent memory, client-device prefill, keyboard, required sirf mode me |
| N5  | Explicit `select()` list me columns bhool gaye → `undefined` chip | 🟠  | `formatDeviceIdentity()` missing fields handle karta hai (legacy fallback), QA matrix                |
| N6  | Identifier do active jobs me same → duplicate-looking report      | 🟢  | Soft warning + "purana job dekhein" link (feature: device history G9)                                |
| N7  | New master tables par RLS galat → dropdown khaali (error nahi)    | 🟠  | `is_frontend_staff()` policy + anon deny + post-apply REST probe                                     |
| N8  | localStorage recent me **stale id** (master deactivate)           | 🟢  | Read par `is_active` filter + stale entries ignore                                                   |
| N9  | Print/excel me lamba composed label overflow                      | 🟢  | `word-break` CSS + A4 QA + Excel `title` tooltip                                                     |
| N10 | writeGuard ke bahar add-new fail → user confused                  | 🟢  | Clear geofence toast (§4.2)                                                                          |

---

## 9. Test plan

- **Unit** (`deviceIdentity.test.ts`): legacy untouched · full compose · partial compose (no `—`/`undefined`) · custom override · shrink warning flag · 300-char guard.
- **Component**: `DeviceFieldPicker` — dedupe path (existing selected, no insert) · insert+auto-select · error keeps modal text · brand-change clears model · recent cap 5.
- **E2E smoke (manual, no live-DB writes by agent)**: `/jobs/new` 3 modes → add-new brand/model/identifier → save → composed `item` in list, view, print preview, WhatsApp preview, search by identifier · edit legacy job → raw `item` unchanged · mobile bottom sheet.
- **Regression**: existing 702 vitest green; `reports/daily-income`, `delivered`, `client-ledger` totals parity; `/login` 200; console 0 errors.

---

## 10. Owner decisions (P0)

1. **Identifier master chaahiye ya sirf "recent values"**? recommend **master table** (`device_identifiers`) — user ne "list me na ho to add karo" kaha, isliye searchable registry chahiye.
2. **Model master globally ya brand-wise?** recommend **brand-linked** (`device_models.brand_id`), dropdown brand se filter — galat combo rokne ke liye.
3. **"Apna text likhein" escape rakhein?** recommend **HAAN** (legacy data loss ka raasta band na ho).
4. **Mode default** — purane plan §9.1 se **autonomous** (already recommended, abhi tak pending).
5. **Composed label me separator** `·` (middle dot) — recommend haan; agar SMS/print me issue ho to `/` fallback.
6. **Live apply approval** (read-only simulation pehle) + purane plan ke §9 baaki decisions.

---

## 11. Purane plan ke saath sync (implementation se pehle)

- Ye plan purane `service_center_data_model_plan_2026-11-21.md` ka **UX companion** hai;
  uski migration sketch me **2 tables extra** (§6) aur phase table me **P2/P3/P4/P5 details**
  is plan se replace honge — baaki (modes, numbering, claims, integrity) waise hi.
- `docs/plans/pending_work_2026-11-20.md` me is plan ka pointer add karna hai (implement shuru karne par).
- Koi bhi code likhne se pehle §10 decisions + schema:drift safety confirm.

---

## 12. Expert verdict

Purana plan data model aur safety ko strong banata tha, par **UX aur display coverage kam thi**.
Yeh plan teen cheezein pakki karta hai:

1. **Counter speed** — 3 dropdowns + inline add, ek hi row, recent/client memory.
2. **Zero-display-churn coverage** — `item` derived hone se 40+ jagah apne aap sahi dikhte hain.
3. **Ek hi display contract** — `formatDeviceIdentity()` + `<DeviceIdentity />` = kahin bhi alag format nahi.

Sabse bada khatra N3 (legacy text ka silent loss) hai — preview + warning + custom escape
usse rokta hai. Agar ye 3 rulesToote nahi (item unchanged, columns nullable, deactivate-only),
to koi report, print ya export nahi tootega.
