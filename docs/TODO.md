# TODO / Work Log

Har kaam ke liye: plan + todo banate hain, jo complete ho jata hai use mark karte hain.
- `[ ]` = pending / `[x]` = complete
- Commits: `docs/COMMITS.md` (agar bana ho) — warna neeche "Deployed" section.

---

## Project: Staff Messenger v2 (1-on-1 chat)

### Plan
Web-only staff messenger enhancements — auto-deployed via Vercel + Supabase.
Base messenger already live (`30aae41`). Ye round un requested features add karta hai.

### Todos

#### 1. Base messenger (prev round) — DONE
- [x] Staff messenger page + realtime presence (`30aae41`)
- [x] TeamOnline sidebar widget + Users-page presence dots/badges (`30aae41`)
- [x] Message push route (`30aae41`)
- [x] `?to=` deep link + unread badges per conversation (`30aae41`)
- [x] Fix empty "no users" bug (bad profile columns) (`8dc9a63`)
- [x] Fix own-user truncated UUID (skip self presence) (`fcd42c4`)
- [x] Fix offline/new user chat not opening (`b9b0496`)

#### 2. Messenger v2 features — DONE (code deployed, migration applied)
- [x] 3-state ticks (sent / delivered / seen) via `delivered_at` + `read_at`
- [x] Typing indicator (realtime broadcast)
- [x] Media share with client-side compress to ~50–100KB (`src/lib/media.ts`)
- [x] Public `media` bucket upload (storage path stored in `media_url`)
- [x] Delete message (+ storage file cleanup)
- [x] Unread badge on sidebar Messages icon (`RootClient.tsx`)
- [x] DB migration written: columns, RLS update fix, delete policy, bucket
- [x] Typecheck + `next build` pass
- [x] Commit `50df6c0` + push → Vercel auto-deploy
- [x] User applied migration in Supabase SQL Editor (columns confirmed)

### Pending verification (manual QA)
- [x] Test 3-state ticks live
- [x] Test typing indicator between two users
- [x] Test media share + compression on mobile
- [x] Test delete message
- [x] Test unread sidebar badge counts/reset

#### 3. Post-v2 bug fixes + polish — DONE
- [x] Fix history not loading (inverted `deleted_at` filter returned only soft-deleted) — commit `6ca81dc`
- [x] Show user avatar in messenger (list / header / new-chat) — commit `22b2cec`
- [x] Hide global floating mobile back button on `/messages` (overlapped paperclip) — commit `44db4b3`
- [x] Fix attach-image-only send (`messages_content_check`: non-empty placeholder content for media-only) — commit `6335f9b`
- [x] Images manager: show + manage messenger `media` bucket (recursive folders + refs from `messages.media_url`) — commit `3335482`
- [x] Fix media orphan bug (client storage.remove silently failed under RLS) → server `/api/media/delete` via service_role — commit `f65dad1`
- [x] Delete-message confirmation (2-step "Confirm?") — commit `9f2d2dc`

### Pending verification (manual QA — v3)
- [x] Confirm message delete now needs 2 clicks (no accidental delete)
- [x] Confirm deleting a media message removes image from `/images` manager (no orphan)
- [x] Confirm `/images` shows Messages Media bucket

#### 4. Delete permissions + message supervision tool — DONE
- [x] Delete rights: staff sirf apna send-kiya hua delete kare; admin/developer sab (UI + `/api/media/delete` + RLS)
- [x] RLS `msg_messages_select`: admin/developer sab messages dekh sakte hain (supervise ke liye) — commit (pending)
- [x] `fetchPairMessages` helper (kisi bhi do users ki chat fetch)
- [x] `/messages/supervise` read-only tool (admin/developer: User A ⟷ User B + messages)
- [x] "Supervise chats" link messages page me (sirf admin/dev ko)
- [x] Typecheck + build pass
- [x] **USER ACTION**: RLS SQL run karna (delete-policy + select-policy) — `20260901_messenger_presence.sql` + `20260901_messenger_enhancements.sql` applied (supervise + admin-delete live)

---

## Project: Suppliers Module — Fixes & Features

> Full plan: `docs/plans/suppliers_module_plan.md` — plan status: **COMPLETE**
> Created: 2026-09-17

### Phase A — Bug fix + Supplier Payment Ledger (HIGH) — COMPLETE (commit `34bb8e0`)
- [x] Fix PO status bug — supplier detail page status map numeric vs text mismatch (`suppliers/[id]/page.tsx` + `status-colors.ts`)
- [x] **`supplier_payments` table** — amount, payment_mode (cash/upi/bank/cheque/adjustment), reference, payment_date, notes, created_by
- [x] **Payment entry modal** on supplier detail page — add payment, show total paid / outstanding
- [x] **Outstanding balance** calculation on supplier detail page (sum PO total − sum payments)
- [x] **Due column** on supplier list page — outstanding balance per supplier
- [x] **`/reports/supplier-dues`** report — all suppliers with outstanding, sortable, printable
- [x] **RLS** — staff insert, admin delete, authenticated read
- [x] **Full schema** integrate (`final_full_schema_idempotent.sql`)
- [x] **Typecheck + eslint + tests pass** (migration `20260912_supplier_payments.sql` applied)

### Phase B — Required Parts → PO + GST Fields (MEDIUM) — COMPLETE (commits `45cb463`, `b168495`)
> P1 note: planned `purchase_order_items.job_id` ki jagah `purchase_orders.transaction_id` (header-level) used — grouping per-job, supplier modal me choose hota hai.
- [x] `purchase_orders.transaction_id` — job trace (P1)
- [x] `job_required_parts.purchase_order_id` nullable FK — link part to its PO
- [x] Parts-pending report: group → "Create PO" button (`/reports/parts-pending`)
- [x] Job page: "Waiting parts ka PO banao" batch button (`JobRequiredParts.tsx`)
- [x] Supplier form: GSTIN, bank_name, bank_account, bank_ifsc, credit_limit, payment_terms, city, state
- [x] Supplier detail: show GST/bank details in info card
- [x] Full schema + typecheck + lint + tests (migrations `20260913_required_parts_po_bridge.sql` + `20260913_suppliers_gst_bank.sql` applied)

### Phase C — Reports + Expense Link (MEDIUM) — complete (P4 done)
- [x] `/reports/supplier-purchases` — date range, KPIs, per-supplier product breakdown (commit `1a0ad01`)
- [x] Add `supplier_id` FK to `expense_list` (nullable) — **P4** (migration `20260919_expense_supplier_link.sql`, folded into full schema)
- [x] Payment entry (Phase A) optionally auto-creates expense entry — **P4** (toggle in Add Payment modal → "Spare Parts Purchase" ledger entry; `supplier_payment_id` FK for dedup/traceability)
- [x] Old payments ko backfill karne ke liye payment modal me "Expense entry banao" button — **P4** (dedup via `supplier_payment_id`)

### Phase D — Active Product-Supplier Link (LOW) — complete (P5 done)
- [x] Supplier detail: "Recommended Orders" section — low-stock products linked via `spare_supplier`
- [x] Quick-add: one-click PO from suggested items (`po_draft` + `po_draft_supplier` → prefilled Create PO modal)

### Completed (this session + earlier suppliers rounds)
- [x] Supplier visiting card upload + lightbox zoom
- [x] Multiple contacts (label + phone + is_primary) + WhatsApp buttons
- [x] Search across all phones
- [x] Supplier photo API route (`/api/supplier-photo`)
- [x] Shared SupplierFormModal component
- [x] Supplier list + detail page rewrite
- [x] Image manager: spare-photos + supplier-photos buckets added to BUCKET_MAP
- [x] System menu "Images" link for admin
- [x] Global image zoom overhaul — every image display now supports double-click → fullscreen lightbox
- [x] ZoomableImage wrapper for server/public pages
- [x] (public) layout ImageLightbox mount for anonymous visitors

---

## Project: Job Required-Parts / Waiting for Spare Tracking — COMPLETE (M1–M8)

> Full plan: `docs/plans/job_required_parts_waiting_tracking.md` — **COMPLETE (2026-09-15)**
> Created: 2026-09-05 · Commit `a147034` (M1–M7) + M8 receive-sync (migration `20260915_required_parts_receive_sync.sql`)

- [x] **M1** migration `20260905_job_required_parts.sql` — table + `transaction_products.product_id` nullable (surrogate id PK) + `spare-photos` bucket + RLS (`is_frontend_staff`) + moddatetime. Applied DB (2026-09-06). Folded into full schema.
- [x] **M2** `src/lib/requiredParts.ts` — CRUD + `fetchWaitingPartsReport()` (derived auto-out) + `fetchOpenPartCounts`
- [x] **M3** `/api/spare-photos` route — upload/delete (≤200KB, requireStaff, admin client)
- [x] **M4** `JobRequiredParts` component + embed in job view page + `WaitingPartsBadge` (status<=3 && open)
- [x] **M5** Custom spare in billing (jobs edit/new) — `product_id: null` rows; printers name-snapshot safe
- [x] **M6** `/reports/parts-pending` report — KPIs + job groups + search + print + "PO banao" (P1)
- [x] **M7** Delivered(5)/Cancelled(4)/deleted auto-out (derived) + build pass
- [x] **M8** PO receive-sync — `receive_po_receipt` linked parts ki qty_received FIFO allocate + status=2 (Arrived). **USER ACTION:** `20260915_required_parts_receive_sync.sql` Supabase SQL Editor me run karo (idempotent)

---

> Client view page par "Done (To Deliver)" card + list par "Done pending" per-client total. Billing (balance) par koi effect nahi — sirf informational.

- [x] View page (`clients/[id]/view`): "Done (To Deliver)" stat card — sum of status=2 jobs
- [x] List page: per-client "Done pending" line (desktop row + mobile card)
- [x] `client-due.ts`: `repairDone` field/map + `JOB_STATUS_DONE` (kabhi `netBalance` me nahi)
- [x] `server-clients.ts`: RPC row + legacy fallback status=2 query
- [x] RPC `get_clients_page_financials` me `repair_done` aggregate — migration `20260914_clients_page_repair_done.sql` (applied) + full schema fold-in
- [x] Tests (4 naye) + tsc + eslint + build pass

---

## Project: Image Crop / Edit on Upload

> Full plan + expert advice: `docs/plans/image_crop_edit_plan.md`

### Phase 1 — Core crop + pilot (Visiting card + Product photo) — COMPLETE (commit `00185f0`)
- [x] Add `react-easy-crop` dependency
- [x] `src/lib/imageCropper.ts` — cropImage(dataUrl, crop, rotation) → File/Blob (canvas)
- [x] `src/components/ImageCropperModal.tsx` — dark full-screen editor (move, zoom, rotate 90°, aspect toggle, "Use Original" skip button)
- [x] `src/lib/useImageUpload.ts` — orchestrator hook: pick → crop → compress → CompressedImage
- [x] Pilot: SupplierFormModal visiting card wired via hook
- [x] Pilot: ProductFormModal product photo wired via hook
- [x] Typecheck + eslint + tests

### Phase 2 — Rollout (avatars 1:1) — COMPLETE (commit `4f8fbc7`)
- [x] Profile avatar
- [x] User avatar (users/[id]/edit)
- [x] Client photo
- [x] Mechanic photo
- [x] Job repair photos (batch — per-photo edit button; logo/cover/signature EXCLUDED)

### DROPPED (expert advice)
- ~ Phase 3 contrast/brightness/redo — no business value, don't build
- ~ Crop on Settings logo/cover/signature — keep original always (transparency)

---

## Project: Client Multi-Contact (1+ numbers, Call/WhatsApp har number par)

> Ek client ke 1+ mobile numbers — family/relative numbers kaun ka hai stays tracked.
> Mirror of supplier contacts pattern, par flat (`client_contacts`) — suppliers ke
> persons+phones ki zarurat nahi (client khud ek person hai).

### Implemented — COMPLETE (committed `f2064c9`, released `v1.21.0`)
- [x] Migration `supabase/migrations/20260921_client_contacts.sql` — table: id, client_id (FK→`client_list` CASCADE), name (rishta), label (Mobile/Office/WhatsApp/Shop/Other), phone, is_primary, date_created/updated. Unique(client_id, lower(trim(phone))), **partial unique index single-primary per client**. RLS staff-gate + grants + touch trigger. Folded into idempotent full schema.
- [x] `src/lib/clientContacts.ts` — `ClientContact`/`ClientContactInput` types, `CONTACT_LABELS`, `normalizeContacts` (dedup + one-primary self-heal), `fetchClientContacts`, `fetchClientContactsBulk`, `syncClientContacts` (diff-by-phone: update/insert/delete), `telLink`/`smsLink`/`waChatLink`
- [x] Client form (`clients/new` + `clients/[id]/edit` ManageClientPage): old single "WhatsApp / Contact" input replaced by **Contact Numbers editor** — star=primary, name+label per number, add/remove rows; primary phone auto-writes `client_list.contact` (legacy back-compat); save syncs via `syncClientContacts`
- [x] Client view page (`clients/[id]/view`): header "+N" extra-count badge; **Contact Numbers card** under quick tiles — har number par Call/WhatsApp/SMS buttons (name/label/star)
- [x] Client list (`ClientsBody` + `ClientCard`/`ClientTable`): list API ab `client.contacts` attach karta hai (server-side bulk `fetchContacts` in `server-clients.ts`); **WhatsApp modal ab "Send To" phone picker** — multi-contact client ke liye kisi bhi number par bhejo (primary default). Bulk WhatsApp primary hi use karta hai (intentional)
- [x] Types: `Client.contacts?: ClientContactLite[]` (`clientListHelpers.ts` + `server-clients.ts`); migration nahi laga to graceful degrade (contacts → undefined)

### USER ACTION — apply migration
- [x] `20260921_client_contacts.sql` Supabase SQL Editor me run karo — **VERIFIED live (2026-09-15)**: `client_contacts` REST probe confirmed table present (idempotent; full schema me folded hai)

---

## Project: BOM Checker — Phase 3 (Saved Templates)

> BOM Checker (`/inventory/bom-check`) Phase 1 (core check) + Phase 2 (AI summary)
> already live. Phase 3 = reusable component lists (bom_checker_plan.md §5 Phase 3).

### Implemented — COMPLETE (Phase 3, committed 2026-09-16)
- [x] Migration `supabase/migrations/20260922_bom_templates.sql` — table (id, name, description, items jsonb, created_by), FK `created_by → profiles.id ON DELETE SET NULL`, name/creator indexes, RLS `rlslock_bom_templates_staff` (is_frontend_staff), touch trigger, grants + sequence grants. Folded into idempotent full schema.
- [x] `src/app/api/bom-templates/route.ts` — GET list (with items) + POST create; `requireStaffWithRole()` cookie+RLS, no service role; server-side items validation
- [x] `src/app/api/bom-templates/[id]/route.ts` — GET single + PUT (name/desc/items partial) + DELETE
- [x] `src/lib/bomTemplates.ts` — `BomTemplateItem`/`BomTemplate` types + `itemsToLines()`
- [x] `src/app/inventory/bom-check/page.tsx` — "Save as Template" button + modal (name/desc); Saved Templates list (Load → textarea / Edit / Delete); save attaches best-match product_id from catalog; hooks before early-return guard. Phase 1 + 2 untouched.
- [x] Verified: tsc clean, eslint clean, vitest 103/103 green

### USER ACTION — apply migration
- [ ] `20260922_bom_templates.sql` Supabase SQL Editor me run karo (idempotent; full schema me folded hai)

---

## Project: Staff Passkey / Biometric Login (WebAuthn)

> Design locked — `docs/plans/passkey_biometric_login_plan.md`. PIN REJECTED (weak).
> Password = hamesha primary; passkey = optional fast-login (Windows Hello / Touch ID / Face ID /
> Android fingerprint). Client portal untouched. **Implement post-season** (G3 freeze active).
> Total ≈ 12–16 h dev + migration apply/QA.

### Phase 1 — Foundations (spike + deps)
- [ ] Spike: `supabase.auth.admin.createSession` available? pinned supabase-js me (fallback §8 plan) — decision D8 confirm
- [ ] `npm i @simplewebauthn/server @simplewebauthn/browser`
- [ ] `src/lib/admin.ts` — `getServerSupabaseAdmin()` (service role, server-only)
- [ ] `src/lib/passkeys.ts` — rpName/rpID config, challenge cookie helpers (httpOnly, signed, 5 min, one-time)

### Phase 2 — Enrollment
- [ ] Migration `supabase/migrations/YYYYMMDD_passkey_login.sql` (user_passkeys + RLS + grants + trigger) + full-schema fold-in
- [ ] `POST /api/passkey/register-begin` (auth + password re-auth + challenge)
- [ ] `POST /api/passkey/register-finish` (verify + INSERT service-role, dup reject)
- [ ] Device mgmt `src/app/api/passkey/devices/route.ts` — list/rename/delete + admin revoke-all

### Phase 3 — Login flow
- [ ] `POST /api/auth/login` mode=`passkey-begin` + mode=`passkey-verify` (sign_count + admin.createSession + throttle)

### Phase 4 — UI
- [ ] Login page: "Fingerprint se login karein" button + email reuse + error states
- [ ] Settings → "Devices (Passkey Login)": enroll, list, rename, remove, admin revoke-all

### Phase 5 — Tests + QA
- [ ] Unit: throttle path, challenge cookie one-time/expiry, sign_count reject
- [ ] Manual matrix: Windows Hello / Android fingerprint / iOS Face ID / regression / lost-device / RLS probe
- [ ] tsc + eslint + vitest + build green

### Phase 6 — Deploy gate (post-season)
- [ ] HTTPS + stable rpID note (domain change = passkeys invalid); migration apply (user); release tag + CHANGELOG

---

## Project: Frontend Performance — Loading Speed

> Baseline measured 2026-09-17 (`docs/plans/frontend_performance_plan.md`): sab routes ~1.0–1.2MB JS
> (shared floor), total static JS ~5.6MB uncompressed; fetch-heavy pages dashboard(35)/jobs(29)/
> accounting-dashboard(28). Phase A pure frontend + season-safe.

### Phase A — Season-safe quick wins
- [ ] W1: `(public)/components/qr-share.tsx` dynamic import fix (public layout se qrcode nikaldo)
- [ ] W2: Boot parallelize + `loading.tsx`/Suspense — LicenseGate/useAppBoot race, sidebar lazy
- [ ] W4: sidebar `router.prefetch()` hover/touch par (Link prefetch verify)
- [ ] W5: public pages static cache headers (Vercel)

### Phase B — Season-safe data batching
- [ ] W3a: dashboard `.from()` clusters parallel (`Promise.all`) + dedupe
- [ ] W3b: jobs page batching
- [ ] W3c: reports/accounting-dashboard batching
- [ ] Har page: tsc + eslint + vitest + visual QA green

### Phase C — Post-season (G3)
- [ ] W6: RootClient split + icons per-page + shared chunk review + Sentry tuning
- [ ] W7: RSC migration hot pages (dashboard/clients/inventory/jobs — streaming)
- [ ] W8: React Query / SWR data layer

### Phase D — Measure-repeat
- [ ] `npm run analyze:output` baseline diff + production URL Lighthouse before/after

---

## Project: Backup/Restore Tooling Fix — Lossless Backups

> Plan: `docs/plans/backup_tooling_fix_plan.md`. Audit (2026-09-17, read-only): page backup 17 live
> tables MISSING + restore column-strip loss (transaction_products.id, suppliers*, purchase_orders*,
> transaction_list, expense_list, locations) + restore.mjs dry-run executes SQL. **Code-only; live DB par
> koi write nahi.** Implementation season-safe (backup = SELECT only).

### Phase 1 — Schema import ✅ (2026-09-17)
- [x] Admin client reuse: `src/lib/admin-supabase.ts` `getAdminSupabase()` already existed
- [x] `src/app/api/backup/schema/route.ts` (GET, requireAdmin) — OpenAPI → table/col/pk map (+generated merge)
- [x] Unit test `src/lib/backupSchema.test.ts` 7 tests ✅ + live E2E probe (51/51 tables, PKs exact)

### Phase 2 — Backup page ✅ (2026-09-17)
- [x] TABLE list dynamic (golden 51 ordered list + live-schema auto-append)
- [x] TABLE_COLUMNS → runtime cols; transaction_products single-PK (id) mode; composite → runtime PK
- [x] Backup Verify: fetched vs exact count per table; mismatch → `_meta.warnings` + HARD red toast
- [x] `_meta.version → 3.0`; v2 files compatible (file's own `meta.tables`)
- [x] Restore dry-run (page): PK presence+unique + unknown-col warning + NOT NULL coverage checks (schema `notNull` se), zero writes — toast FAIL on issues
  - ✅ USER-CONFIRMED dry-run PASSED: 10,223 rows / 51 tables (v3 file); composite-PK false-positive bug fix included

### Phase 3 — Restore safety ✅ (2026-09-17)
- [x] Dynamic column strip (column-loss kill); `onConflict` explicit (single + composite)
- [x] Restore-after count verify → HARD fail report + toast on mismatch
- [x] resetSequences list + 17 naye tables; clear-step `not(pk[0],"is",null)` universal delete-all

### Phase 4 — CLI scripts ✅ (2026-09-17)
- [x] `supabase-restore.mjs --dry-run`: ab kabhi SQL execute nahi (file analysis + read-only `SELECT 1`); JSON guard (dry=parse, real=error+guidance)
- [x] `force-restore.cjs`: arg/glob filename + LIVE schema columns/PK + `onConflict` + generated strip + confirm (`--yes`)
- [x] `supabase-dump.mjs` auth/storage exclusion doc note

### Phase 5 — Verify (no live writes) 🔶 user-verified
- [x] schema API probe (live OpenAPI E2E: transaction_products/spare_supplier/user_presence/client_payments/messages/bom_templates) ✅
- [x] Live "Download Backup" ✅ **USER-CONFIRMED 2026-09-17**: `vtech_backup_2026-09-17T07-02-58.json` — 51/51 tables, counts exact (file==DB rows), net change 0, 0 warnings
- [x] v3 Diff panel (file vs DB) green — same run ✅
- [x] tsc + eslint + vitest + build green (2026-09-17) ✅ (1 pre-existing exhaustive-deps warning)

### Phase 6 — Free-tier backup strategy ✅ DONE (2026-09-17)
- [x] RESOLVED (2026-09-17): Free tier par koi platform automatic backup / PITR nahi (Pro/Team/Enterprise hi; PITR ~$100/mo). Decision: hamara apna scheduled JSON backup = free-tier ka daily backup.
  - `scripts/supabase-json-backup.mjs` (NEW): service-role, 51 tables count-verified, page-compatible v3.0 JSON → `backups/` (gitignored). Live-tested: 10,232 rows / 51 tables, net_amount skip verified.
  - `/backup` page par chhota UI (2026-09-17): "Server Backup (Scheduled)" card — "Abhi Run Karo" button + recent local backups + **cloud copies** list. API: `GET/POST /api/backup/scheduled` (requireAdmin), logic shared `src/lib/scheduledBackup.ts`. Live-tested via lib: 51/51, 10,232 rows, cloud upload ok.
  - ☁️ Cloud copy: Supabase Storage `backups` bucket (private, auto-create) — Vercel par bhi persistent. CLI `--storage` flag. Verified live (upload + list).
  - Converter v5: `public/tools/vtech_mysql_converter.html` — 46 app tables + v3.0, saare naye tables/casts, real data par verified (46 tables/10,175 rows exact).
  - Schedule: `schtasks /Create /TN "VTech Supabase Backup" /TR "node \"D:\next tech\vtech-next-frontend\scripts\supabase-json-backup.mjs\"" /SC DAILY /ST 02:00 /F`
  - 📖 Full guide (Hindi/English/Hinglish): `docs/BACKUP_GUIDE.md`.
- [x] Weekly off-site copy + "risky change se pehle fresh backup" = **ongoing routine** (guide §3 me documented, blocker nahi).
- [x] Storage buckets: manual/Dashboard export cadence note = ongoing hygiene (guide §8 me documented).

---

## Project: UI/UX Architecture Revamp — Sprint 1

### Plan
Master plan: `docs/plans/ui_ux_architecture_complete_plan.md` (Parts 0–F, 4 sprints).
Hard constraint: free/OSS only. 🛡️ Protected routes: `jobs/old` + `jobs/[id]/old` KEEP FOREVER
(toast upgrade OK; never delete/redirect-remove) — see plan §PROTECTED ROUTES.
User directive: **no commit/push** until told.

### Todos — Sprint 1 (2026-09-23)

#### 1. Single toast system + kill alert() ✅
- [x] `src/lib/toast.ts` (sonner wrapper; error=∞, success=3s, warn=5s, info=4s)
- [x] `src/lib/requireAdmin.ts` — pure `requireAdmin(userRole, action)`; deleted `useAdminGuard.ts`
- [x] Migrate ~97 `alert()` → toast (print-route server templates `print-bill`/`print-purchase-order` intentional, kept)
- [x] Migrate ~25 hand-rolled `const [toast, setToast]` banners → sonner (state + JSX + auto-clear effects removed; 0 left)
- [x] Protected routes `jobs/old/page.tsx` + `jobs/[id]/old/page.tsx`: state/effect/banner removed, `toast.*` imported — **not deleted**
- [x] Verify: `npx tsc --noEmit` OK · `npx eslint` 0 errors (2 pre-existing warnings: backup exhaustive-deps, users unused disable)

#### 3. `ui/` kit ✅
- [x] `src/components/ui/StatusBadge.tsx`, `EmptyState.tsx`, `ConfirmDialog.tsx`, `index.ts` barrel (re-exports legacy PageHeader)

#### 4. Mobile input fundamentals ✅
- [x] `globals.css` Sprint 1 block (~L3178): 16px iOS font floor (<1023px), safe-area utilities, `.h-dvh-safe`, keyboard-open FAB hide, coarse-pointer active opacity

#### 5. Shared lib helpers ✅ (naming evolved from plan)
- [x] `src/lib/status-colors.ts` — `STATUS_LABELS`, `STATUS_EXPLANATIONS`, `BADGE_COLORS`, `STATUS_BADGE_COLOR`, `DEL_STATUS`, `getLabel`/`getBadge`/`getStatusStyle` (+ legacy `JOB_STATUS`)
- [x] `src/lib/whatsapp.ts` — canonical `waLink` (double-91 safe); local dupes removed (suppliers pages)
- [x] `requireAdmin` migrated in: 7 admin pages (lenders/suppliers/services/client-loans/inventory/locations/products) + MechanicsBody + ClientsBody + `jobs/[id]/view` + attendance/MonthlyReport

#### 2. Semantic tokens migration + `!important` delete ✅ (2026-09-23)
- [x] Foundation: `globals.css` `@theme inline` me semantic color tokens (`--color-app-*` + short aliases → `bg-panel`, `text-muted` jaise Tailwind utilities) + helper classes `.card`/`.muted`/`.text-app`/`.bg-app`/`.bg-panel`
- [x] Codemod Phase 1a: top patterns hardcoded hex (`bg-[#0d1117]`, `bg-[#161b27]`, `border-[#21293d]`, etc.) + `text-slate-*`/`border-slate-*`/`bg-slate-*` → semantic token classes across **165 pages** (9,288 replacements)
- [x] Delete dark/light `!important` override blocks (~380 lines removed). Remaining 299 `!important` = glass utilities + mobile CSS + select options (intentional, non-theme)
- [x] `status-colors.ts` updated (`text-slate-400`→`text-muted` etc.)
- [x] Verify: `npx tsc --noEmit` OK · ESLint 0 errors · committed `bd6d899`

### Sprint 2 (Week 2)
- [x] #9 Keyboard shortcuts: g-prefix + `?` help + skip-to-content — `src/hooks/useKeyboardShortcuts.ts`, `ShortcutHelpOverlay.tsx`, committed `eaa898e`
- [x] #10 Image compression on ALL uploads — `compressImage` already integrated in 8 call sites (imageCompression.ts + media.ts); no new work needed
- [x] #7 Mobile bottom tab bar — committed `960c797`
- [ ] #8 Route cleanup (old redirects skip protected, ledger/salary merge, Lightbox kill from 17 files)

---

## Open Questions / Notes
- Comments Hinglish me; no emojis in UI.
- Sanitized: migration must be re-run if any part fails midway (idempotent file).
