# Plan: Job "Required Parts / Waiting for Spare Purchase" Tracking

> Status: **ACTIVE — Milestone 2 in progress**
> Created: 2026-09-05 · [docs/DATA_MIGRATION_NOTES.md](../../DATA_MIGRATION_NOTES.md) mandates ke saath compliant.

## 1. Goal (user brief, Hinglish → English)

Jab kisi job ki repairing kisi **saman (spare part) ke na hone** ki wajah se ruki hui ho:

1. Job page par us **saman ki entry** ho jaye (kaunsa spare chahiye, kitna).
2. Bata sakte **kahan se mangwana / purchase karna** hai (supplier / source + phone).
3. **Report** jo aisi saari jobs (purchase ke liye ruki hui) track karke list banaye.
4. Job par ek **spare ki photo** ho sake (required spare ke saath upload).
5. Job **complete + delivered** hote hi report ke tracking se **automatically bahar**.
6. **Jobs edit page** par product chunne waqt sirf inventory se nahi, **inventory ke alawa custom spare** bhi add kar sake (billing row ke roop me, inventory me register karna zaroori nahi).

## 2. Current-state findings (verified 2026-09-05)

- Job parts sirf **`transaction_products`** (billed parts: `transaction_id, product_id, qty, price, product_name`) — ye **billing/stock** ke liye hai, `product_id integer NOT NULL`. **Ise "waiting parts" ke liye overload NAHI karna** (billing + stock-subtraction + reports ise use karte hain).
- `transaction_list.status` CHECK locked `0..5` (0 Pending,1 In Progress,2 Done,3 Paid,4 Cancelled,5 Delivered). Naya status value add karna **legacy data todega** → **derived signal** use karenge.
- **No** `job_required_parts`/`job_spares` tables exist. No `job_id` link on `purchase_order_items` / `inventory_list`.
- Reusable infra (all built):
  - Products `product_list`, stock math (`fetchStockByProducts`, `get_inventory_stock` RPC).
  - Suppliers: `suppliers` (name, contact, email, address, status, delete_flag) + `spare_supplier` mapping + `SupplierPicker` component + `useSuppliers`.
  - Purchase Orders: `purchase_orders`, `purchase_order_items`, RPC `receive_po_receipt`, UI `/inventory/purchase-orders`. **Requirement-list report already builds a PO draft** (`requirement-list/page.tsx` → `po_draft` sessionStorage → `/inventory/purchase-orders?create=draft`).
  - Job photos: bucket `job-images`, table `transaction_images` (id, transaction_id, image_path=public URL, date_created); upload route `src/app/api/job-images/route.ts` (200KB limit).
  - Status update: `src/app/jobs/[id]/page.tsx:474-506` (sets `date_completed` on status=5). Activity logging via `src/lib/activity.ts` `logActivity`.
- Report UI conventions: rewritten report pages (header card + KPI cards + sticky-table + mobile cards + print) — see `/reports/custom-sales`, `/reports/pending-jobs`.

## 3. Expert decisions (with reasoning)

### D1. Naya table chahiye — `job_required_parts` (single-column PK)
Existing tables **na hi** waiting-parts entry de sakte hain (billing me overload) **na** source/photo store. Nayi table me single-column PK (`id bigint`) rakhenge — `transaction_products` jaisa composite-key nested-join issue chhut jayega.

### D2. "Waiting for parts" job signal = DERIVED, transaction_list ko touch NAHI
`job_required_parts` me koi bhi row `status < 2` (pending/ordered) ho aur job `status ∈ (0,1,2,3)` + `del_status = 0` → job "waiting". `status=5` (Delivered) / `status=4` (Cancelled) → **automatically report se out**. Koi migration/trigger/manual action nahi — golden rule ke sivay isliye bhi safer kyuki purchase ke baad status change par sync-mistakes ki gunjaish khatam.

### D3. Custom (non-inventory) spare in job edit/billing — `product_id` nullable + picker extension
- Change `transaction_products.product_id` to **nullable** (additive-safe ALTER; legacy rows untouched).
- Edit/new page product picker me **"Custom Spare +"**: naam + qty + price → row insert `{ product_id: null, product_name: "<custom>", qty, price }`.
- Stock math (`edit/page.tsx` availability, `inventory*`, reports) `product_id` se key karta hai — NULL row sirf **pick hoga hi nahi** (undefined add) → automatic zero-impact. Billing/prints `product_name` se render → chalta rahega.
- Custom spare **inventory me auto-register NAHI hota** (inventory pollution se bachao). Optional checkbox "Is saman ko product_list me bhi add karein" → Phase 5 (optional), default-off.
- **Verification task:** `jobs/[id]`, `jobs/[id]/view`, prints null `product_id` ko render/keys me safely handle karein (tempId/index-key + name fallback).

### D4. Photo = per required-part, single URL (`photo_url`) — new `spare-photos` bucket
`transaction_images` (= job gallery) me `category` column daalne se zyada saaf **required-part row par hi `photo_url text NULL`**. Upload via `src/app/api/spare-photos/route.ts` (job-images route jaisa, 200KB limit), URL = storage public URL, lightbox zoom (existing `openImageLightbox`). Ek photo per part (mobile speed + simplicity).

### D5. Purchase link = Phase 5 (optional, recommended) — `purchase_order_items.job_id`
Full PO automation isko bana dega: required parts → PO draft (requirement-list jaisa flow) → PO receive hone par `job_required_parts.qty_received/status` sync. `inventory_list` me pehle se `supplier_id` + `purchase_order_id` hai, isliye cheap. **Abhi nahi** — pehle core loop (job entry + photo + custom spare + report) ship karo (small reviewable milestones).

## 4. DB design

### 4.1 New table `job_required_parts`

```sql
create table if not exists public.job_required_parts (
  id            bigint generated by default as identity primary key,
  transaction_id integer not null references public.transaction_list(id) on delete cascade,
  product_id    bigint references public.product_list(id) on delete set null,
  product_name  text default ''::text not null,
  qty_needed    integer not null default 1,
  qty_received  integer not null default 0,
  status        smallint not null default 0 check (status in (0,1,2)), -- 0 waiting | 1 ordered | 2 arrived
  supplier_id   bigint references public.suppliers(id) on delete set null,
  source_name   text,     -- "kahan se mangwana" (supplier list me nahi to free text)
  phone         text,
  eta           date,     -- expected arrival
  photo_url     text,
  remark        text,
  created_by    integer,
  date_created  timestamptz not null default now(),
  date_updated  timestamptz not null default now(),
  constraint job_required_parts_qty_check check (qty_needed > 0 and qty_received >= 0),
  constraint job_required_parts_arrived_check check (status = 2 implies qty_received >= qty_needed)
);
create index if not exists jrp_transaction_idx on public.job_required_parts(transaction_id);
create index if not exists jrp_open_idx on public.job_required_parts(status) where status < 2;
```

### 4.2 Alter legacy

```sql
alter table public.transaction_products alter column product_id drop not null;
```

### 4.3 Storage bucket

`spare-photos` private-bucket (staff upload; public URL read). Created in migration idempotently.

### 4.4 RLS

`is_frontend_staff()` gate (20260912 pattern): `for all to authenticated using (is_frontend_staff()) with check (is_frontend_staff())`. Table owner atomic.

### 4.5 Data conventions (docs/DATA_MIGRATION_NOTES.md)

- `transaction_id` = canonical PK `transaction_list.id` (kabhi `job_id` string nahi).
- Status date/age: `job_required_parts.date_created` = waiting-start; **kabhi `date_updated` display mat karo**.
- Activity log: `logActivity("Added Required Part", "Jobs", txnId, "...")` — writer rule (meta_id = txn id, details me human text).

## 5. Phases & tasks

### M1 — DB migration (NEW FILE)
`supabase/migrations/20260905_job_required_parts.sql` — §4 sab (table, indexes, alter, bucket, RLS, NOTIFY pgrst). Apply: Supabase SQL Editor (repo me db:push script nahi).

### M2 — Required-parts CRUD lib
`src/lib/requiredParts.ts` — `listRequiredParts(txnId)`, `addRequiredPart()`, `updateRequiredPart()` (status/qty/source/eta/photo), `removeRequiredPart()`, `fetchWaitingPartsReport()` (jobs + open parts; status-dedup).
`src/lib/useSuppliers.ts` reuse (already exists).

### M3 — Spare photo upload API
`src/app/api/spare-photos/route.ts` — POST upload (≤200KB, bucket `spare-photos`, returns public URL) + delete. `requireStaff()` auth, `getAdminSupabase()`.

### M4 — Job page "Required Saman" section
`src/app/jobs/[id]/page.tsx` + new `src/app/components/JobRequiredParts.tsx`:
- List: part name, qty needed/received, source (+ phone), ETA, photo thumb (lightbox), status chip (Waiting/Ordered/Arrived), age (date_created se).
- Add form: product search (product_list) **ya custom text**, qty, **kahan se mangwana** (supplier dropdown `useSuppliers` + `source_name`/phone + ETA), photo (camera/gallery via `openCamera`), submit → M2.
- Row actions: Ordered, Partial qty receive, Arrived ✓, delete. Audit log on each.

### M5 — Custom spare in job edit/new (billing)
`src/app/jobs/[id]/edit/page.tsx` + `src/app/jobs/new/page.tsx` (+ legacy `old` pages optional):
- Picker me "Custom Spare +" → naam/qty/price inline fields → row `{product_id:null,...}`.
- `addProduct`/duplicate-check via tempId (null id se match nahi hoga) — adapt.
- Verify `jobs/[id]`, `jobs/[id]/view`, prints handle null `product_id`.

### M6 — Report "Waiting for Parts"
`src/app/reports/parts-pending/page.tsx` (sidebar: Reports). Header card + KPI (waiting jobs / open parts / oldest job) + print:
- Query (client): `transaction_list status in (0,1,2,3) & del_status=0` + `job_required_parts` nested (`status < 2`) via `in(transaction_id, ids)`; age = Min(date_created) of open parts.
- Job rows: #, client, item, parts grouped (name, qty, source, photo, eta badge, age), overall oldest-first.
- Desktop sticky table + mobile cards (report rewrite conventions).

### M7 — Auto-out verification + polish
Delivered job (`status=5`) ke required parts **report me na aayen** (derived). Job status modal se delivered → UI par "waiting" badge hat jaye. eslint/tsc/build/prettier. Plan file update. Commit (feat).

### M8 — (Optional later) PO integration
`purchase_order_items.job_id bigint NULL` + required-parts→PO-draft builder + receive-sync (qty/status). **Abhi not in scope.**

## 6. File map (new/changed)

| File | Action |
|---|---|
| `supabase/migrations/20260905_job_required_parts.sql` | NEW (M1) |
| `src/lib/requiredParts.ts` | NEW (M2) |
| `src/app/api/spare-photos/route.ts` | NEW (M3) |
| `src/app/components/JobRequiredParts.tsx` | NEW (M4) |
| `src/app/jobs/[id]/page.tsx` | EDIT (M4) |
| `src/app/jobs/[id]/edit/page.tsx`, `src/app/jobs/new/page.tsx` | EDIT (M5) |
| `src/app/reports/parts-pending/page.tsx` | NEW (M6) |
| `src/app/RootClient.tsx` (sidebar reports nav), maybe `src/lib/sidebar` | EDIT (M6) |
| `docs/plans/job_required_parts_waiting_tracking.md` | UPDATE har milestone par |

## 8. Milestone Log
## 7. Open questions (for user)
1. Photo per required part = **single** OK? (recommended: single, mobile-speed)
2. "Waiting" badge job ke header par bhi chahiye (dashboard/sidebar count) — ya sirf report me?
3. Custom spare ke saath inventory me **optional register** checkbox chahiye abhi ya baad?

## 8. Milestone Log
- **M1 — DONE (2026-09-05):** `supabase/migrations/20260905_job_required_parts.sql` ban gayi (table + product_id nullable + `spare-photos` bucket + RLS `is_frontend_staff()` gate + moddatetime trigger). **Saath-DB par apply baaki** (Supabase SQL Editor me chalani hai — repo me db:push script nahi; migration idempotent hai).
- **M2 — DONE (2026-09-05):** `src/lib/requiredParts.ts` — list/add/update/setStatus/receiveQty/remove + `fetchWaitingPartsReport()` (dual-era client resolution, delivered/cancelled auto-out).
- **M3 — DONE (2026-09-05):** `src/app/api/spare-photos/route.ts` — upload/delete (`spare-photos` bucket, 200KB, `requireStaff` + admin client); URL caller ko milta hai.
- **M4 — DONE (2026-09-05):** `src/components/JobRequiredParts.tsx` (NOTE: `@/*` → `./src/*`, isliye **`src/components/`** me rakha, `src/app/components/` me nahi) — add form (inventory picker YA custom text, qty, supplier dropdown + source_name/phone/ETA/remark, photo upload → `/api/spare-photos`), per-row Ordered/Arrived/Partial/Delete, lightbox, job status 4/5 par read-only. `src/app/jobs/[id]/page.tsx` me Products Used ke baad embed. eslint + tsc + prettier clean.
- **M5 — DONE (2026-09-05):** Custom spare in billing — `jobs/[id]/edit/page.tsx` + `jobs/new/page.tsx`: "Custom spare add karo" toggle (naam+price, duplicate-check isse skip), `ProductRow.product_id: number | null`, overstock amber sirf inventory rows par. Save me `product_id: null` insert hota hai (migration se nullable). Verifiers: view page null-safe (already), `print-job-status` + `public/job-status` + `print-custom-sales` ab `product_name` snapshot prefer karte hain (`|| "Unknown"` se custom spare naam zinda rehta hai); `print-bill`/`print-combined-invoice`/`print-monthly-sales` already safe. Stock math product_id se key — NULL row kabhi subtract nahi hota (by design).
- **M6 — DONE (2026-09-05):** `src/app/reports/parts-pending/page.tsx` — "Waiting for Parts" report (KPI cards: jobs/saman/ordered/sources; job-group cards + part rows with qty received/needed, status badge, source, phone, ETA, photo thumb; search; print header + `window.print()`; `fetchWaitingPartsReport()` se data). Nav: sidebar Reports → "Waiting for Parts" (RootClient.tsx, `<Boxes/>` icon) + `/reports` index card ("Job Reports" me, `isNew`). eslint + tsc + prettier clean (RootClient sirf +11 lines — koi churn nahi).