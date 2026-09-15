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

### Implemented — COMPLETE (local, not yet committed/pushed)
- [x] Migration `supabase/migrations/20260921_client_contacts.sql` — table: id, client_id (FK→`client_list` CASCADE), name (rishta), label (Mobile/Office/WhatsApp/Shop/Other), phone, is_primary, date_created/updated. Unique(client_id, lower(trim(phone))), **partial unique index single-primary per client**. RLS staff-gate + grants + touch trigger. Folded into idempotent full schema.
- [x] `src/lib/clientContacts.ts` — `ClientContact`/`ClientContactInput` types, `CONTACT_LABELS`, `normalizeContacts` (dedup + one-primary self-heal), `fetchClientContacts`, `fetchClientContactsBulk`, `syncClientContacts` (diff-by-phone: update/insert/delete), `telLink`/`smsLink`/`waChatLink`
- [x] Client form (`clients/new` + `clients/[id]/edit` ManageClientPage): old single "WhatsApp / Contact" input replaced by **Contact Numbers editor** — star=primary, name+label per number, add/remove rows; primary phone auto-writes `client_list.contact` (legacy back-compat); save syncs via `syncClientContacts`
- [x] Client view page (`clients/[id]/view`): header "+N" extra-count badge; **Contact Numbers card** under quick tiles — har number par Call/WhatsApp/SMS buttons (name/label/star)
- [x] Client list (`ClientsBody` + `ClientCard`/`ClientTable`): list API ab `client.contacts` attach karta hai (server-side bulk `fetchContacts` in `server-clients.ts`); **WhatsApp modal ab "Send To" phone picker** — multi-contact client ke liye kisi bhi number par bhejo (primary default). Bulk WhatsApp primary hi use karta hai (intentional)
- [x] Types: `Client.contacts?: ClientContactLite[]` (`clientListHelpers.ts` + `server-clients.ts`); migration nahi laga to graceful degrade (contacts → undefined)

### USER ACTION — apply migration
- [ ] `20260921_client_contacts.sql` Supabase SQL Editor me run karo (idempotent; full schema me folded hai)

---

## Open Questions / Notes
- Comments Hinglish me; no emojis in UI.
- Sanitized: migration must be re-run if any part fails midway (idempotent file).
