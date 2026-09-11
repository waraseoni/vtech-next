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
- [ ] Test 3-state ticks live
- [ ] Test typing indicator between two users
- [ ] Test media share + compression on mobile
- [ ] Test delete message
- [ ] Test unread sidebar badge counts/reset

#### 3. Post-v2 bug fixes + polish — DONE
- [x] Fix history not loading (inverted `deleted_at` filter returned only soft-deleted) — commit `6ca81dc`
- [x] Show user avatar in messenger (list / header / new-chat) — commit `22b2cec`
- [x] Hide global floating mobile back button on `/messages` (overlapped paperclip) — commit `44db4b3`
- [x] Fix attach-image-only send (`messages_content_check`: non-empty placeholder content for media-only) — commit `6335f9b`
- [x] Images manager: show + manage messenger `media` bucket (recursive folders + refs from `messages.media_url`) — commit `3335482`
- [x] Fix media orphan bug (client storage.remove silently failed under RLS) → server `/api/media/delete` via service_role — commit `f65dad1`
- [x] Delete-message confirmation (2-step "Confirm?") — commit `9f2d2dc`

### Pending verification (manual QA — v3)
- [ ] Confirm message delete now needs 2 clicks (no accidental delete)
- [ ] Confirm deleting a media message removes image from `/images` manager (no orphan)
- [ ] Confirm `/images` shows Messages Media bucket

#### 4. Delete permissions + message supervision tool — DONE
- [x] Delete rights: staff sirf apna send-kiya hua delete kare; admin/developer sab (UI + `/api/media/delete` + RLS)
- [x] RLS `msg_messages_select`: admin/developer sab messages dekh sakte hain (supervise ke liye) — commit (pending)
- [x] `fetchPairMessages` helper (kisi bhi do users ki chat fetch)
- [x] `/messages/supervise` read-only tool (admin/developer: User A ⟷ User B + messages)
- [x] "Supervise chats" link messages page me (sirf admin/dev ko)
- [x] Typecheck + build pass
- [ ] **USER ACTION**: RLS SQL run karna (delete-policy + select-policy) — run karne ke baad hi history + supervise both kaam karte hain

---

## Project: Suppliers Module — Fixes & Features

> Full plan: `docs/plans/suppliers_module_plan.md`
> Created: 2026-09-17

### Pending verification (manual QA — current uncommitted work)
- [ ] Test supplier visiting card upload on live test-DB
- [ ] Test multiple contacts + WhatsApp link per contact
- [ ] Test `/images` page shows Spare Parts Photos + Supplier Visiting Cards buckets
- [ ] Test product image preview zoom in ProductFormModal
- [ ] Test chat image zoom (double-click in-app lightbox)
- [ ] Test QR zoom on dashboard + public pages

### Phase A — Bug fix + Supplier Payment Ledger (HIGH)
- [ ] **Fix PO status bug** — supplier detail page status map numeric vs text mismatch (`suppliers/[id]/page.tsx` + `status-colors.ts`)
- [ ] **`supplier_payments` table** — amount, payment_mode (cash/upi/bank/cheque/adjustment), reference, payment_date, notes, created_by
- [ ] **Payment entry modal** on supplier detail page — add payment, show total paid / outstanding
- [ ] **Outstanding balance** calculation on supplier detail page (sum PO total − sum payments)
- [ ] **Due column** on supplier list page — outstanding balance per supplier
- [ ] **`/reports/supplier-dues`** report — all suppliers with outstanding, sortable, printable
- [ ] **RLS** — staff insert, admin delete, authenticated read
- [ ] **Full schema** integrate (`final_full_schema_idempotent.sql`)
- [ ] **Typecheck + eslint + tests pass**

### Phase B — Required Parts → PO + GST Fields (MEDIUM)
- [ ] `purchase_order_items.job_id` nullable FK — which job triggered the purchase
- [ ] `job_required_parts.purchase_order_id` nullable FK — link part to its PO
- [ ] Parts-pending report: bulk-select parts → "Create PO" (group by supplier)
- [ ] Job page: per-part "Add to PO" or batch "Create PO for this supplier"
- [ ] Supplier form: GSTIN, bank_name, bank_account, bank_ifsc, credit_limit, payment_terms, city, state
- [ ] Supplier detail: show GST/bank details in info card
- [ ] Full schema + typecheck + lint + tests

### Phase C — Reports + Expense Link (MEDIUM)
- [ ] `/reports/supplier-purchases` — date range, per-supplier PO summary + product breakdown
- [ ] Add `supplier_id` FK to `expense_list` (nullable)
- [ ] Payment entry (Phase A) optionally auto-creates expense entry

### Phase D — Active Product-Supplier Link (LOW)
- [ ] Supplier detail: "Recommended Orders" section — low-stock products linked via `spare_supplier`
- [ ] Quick-add: one-click PO from suggested items

### Completed (this session)
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

## Project: Image Crop / Edit on Upload

> Full plan + expert advice: `docs/plans/image_crop_edit_plan.md`

### Phase 1 — Core crop + pilot (Visiting card + Product photo)
- [ ] Add `react-easy-crop` dependency
- [ ] `src/lib/imageCropper.ts` — cropImage(dataUrl, crop, rotation) → File/Blob (canvas)
- [ ] `src/components/ImageCropperModal.tsx` — dark full-screen editor (move, zoom, rotate 90°, aspect toggle, "Use Original" skip button)
- [ ] `src/lib/useImageUpload.ts` — orchestrator hook: pick → crop → compress → CompressedImage
- [ ] Pilot: SupplierFormModal visiting card wired via hook
- [ ] Pilot: ProductFormModal product photo wired via hook
- [ ] Typecheck + eslint + tests

### Phase 2 — Rollout (avatars 1:1)
- [ ] Profile avatar
- [ ] User avatar (users/[id]/edit)
- [ ] Client photo
- [ ] Mechanic photo
- [ ] Job repair photos (batch — per-photo edit button; logo/cover/signature EXCLUDED)

### DROPPED (expert advice)
- ~ Phase 3 contrast/brightness/redo — no business value, don't build
- ~ Crop on Settings logo/cover/signature — keep original always (transparency)

---

## Open Questions / Notes
- Comments Hinglish me; no emojis in UI.
- Sanitized: migration must be re-run if any part fails midway (idempotent file).
