# Editable Estimate / Quotation Builder — Plan

> Date: 2026-10-31 · Status: **IMPLEMENTED (core P1–P5)** — gates green; authenticated UI/device QA pending
> Feature: admin/developer ke liye editable estimate banane ka page — client select,
> inventory item, custom part, service/custom service, totals (subtotal + discount +
> GST toggle + round-off), A4 print aur WhatsApp share.

---

## 0. Confirmed decisions (user, 2026-10-31)

| #   | Decision         | Result                                                                                                     |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| D1  | Data kahan save  | **Kahin nahi — koi DB record nahi.** Estimate sirf client ko dene ke liye hai (print / WhatsApp / screen). |
| D2  | Lifecycle/status | Koi nahi. Draft → print → done. Convert-to-job/audit tracking scope me nahi.                               |
| D3  | Totals           | Subtotal + discount + GST toggle (CGST/SGST split) + round-off + grand total.                              |
| D4  | Permissions      | **Sirf admin/developer** — page, nav aur print API teeno par. Staff ko koi access nahi.                    |

Isi wajah se: **zero migration, zero write, zero `activity_logs` entry.** Saare queries read-only
(`client_list`, `product_list`, `inventory` stock RPC, `service_list`, `system_info`).

### 0.1 Hard business invariants (user, 2026-10-31 — kabhi violate nahi)

| #      | Invariant                                                      | Implementation guarantee                                                                                                                                                                                                            |
| ------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | Estimate me use kiya saman **inventory se kam nahi hoga**      | Stock sirf read (`fetchStockByProducts`) + display. Koi `inventory_list` update, stock RPC write, reservation ya `inventory_movements` insert nahi. Print/estimate ke baad stock jaisa tha waisa hi.                                |
| **R2** | Estimate ka total **client ke khate me koi debit nahi banata** | Koi `transaction_list`, `direct_sales`, `client_payments`, `client_loans`, `payment_reminders`, ledger/expense row nahi. Client ka due/opening balance/khata bilkul untouched — total sirf estimate paper/screen par informational. |
| **R3** | Estimate kisi job/bill ka hissa nahi banta                     | `transaction_*` tables untouched; koi `logActivity`/`activity_logs` insert nahi.                                                                                                                                                    |

UI par ye note rahega: _"Ye estimate hai — stock deduct nahi hota aur koi amount client ke khate
me debit nahi hota."_ **Printed copy par default koi estimate indication/watermark/disclaimer
nahi hota** (user choice, 2026-10-31) — print options me toggle se zarurat par on kiya ja sakta
hai. Client due badge (agar add ho) sirf **display** hai — usse koi posting nahi hoti.

---

## 1. Non-goals

- Estimate records ki list/history/status tracking (D1/D2).
- Job ya direct-sale me convert karna.
- **Stock reserve/deduct karna — estimate stock ko touch nahi karta (R1).**
- **Client khate/due me koi entry (debit ya credit) — estimate financial posting nahi karta (R2).**
- GST filing/ITC data — sirf print display.
- Thermal (58mm) print — Phase 6 optional.
- Walk-in client bina `client_list` entry ke — Phase 6 optional (D1 ke saath conflict nahi, par scope bahar).

---

## 2. UX flow

1. Nav: **admin-only top-level Estimate**, Inventory section ke thik upar (Sales group me nahi).
2. Page `/estimates`:
   - Header: Ref. no. `YYYYMMDD-XXX` (auto, editable; "EST-" prefix default nahi taaki print
     par estimate type ka hint na ho), date (default aaj, IST), valid till (default aaj + 15 din),
     GST toggle + rate, discount input.
   - **Client** — `SearchableSelect` (existing pattern, `client_list` where `delete_flag = 0`). Select par naam/contact/address + total due badge (read-only `fetchClientDue` optional, Phase 5 polish — **sirf display, koi debit/posting nahi**).
   - **Items** — ek hi editable table, 3 add buttons:
     - `+ Inventory item` → product picker (name, list price, stock dikhaye) → row add.
     - `+ Custom part` → khali row (name, qty, price).
     - `+ Service` → service picker (`service_list`) ya `+ Custom service` (khali row).
   - Har row inline editable: name, qty, rate; remove; up/down reorder. Row amount auto = qty × rate.
   - Footer totals live update.
   - Actions: **Print estimate**, **WhatsApp**, **New estimate** (draft clear).
   - **Print options** (print se pehle select ho sake; draft me save):
     - `Document title print karein` — toggle, **default OFF**. ON par title text editable
       (default "ESTIMATE"; "QUOTATION" bhi likh sakte hain).
     - `Disclaimer print karein` — toggle, **default OFF**. ON par disclaimer text editable.
     - OFF hone par printed copy par koi "estimate" indication / watermark / disclaimer nahi —
       sirf firm header, client block, items aur totals print hote hain.
3. Draft **localStorage** me autosave — refresh/close par kaam nahi jata; 7 din baad auto-expire.

---

## 3. Line item model (client-side only)

```ts
type EstimateLineKind = "inventory" | "custom_part" | "service" | "custom_service";

type EstimateLine = {
  id: string; // crypto.randomUUID()
  kind: EstimateLineKind;
  product_id: number | null; // inventory rows
  service_id: number | null; // service_list rows
  name: string; // displayed/snapshot name
  hsn: string | null; // GST print ke liye (inventory/service_list se)
  qty: number; // >= 0.01, decimals allowed
  rate: number; // >= 0
  amount: number; // derived = qty * rate
};
```

- Inventory pick par `name/rate/hsn` prefill; qty default 1. **Stock sirf display** —
  `fetchStockByProducts` se "Stock: n"; stock se zyada qty par amber warning (allowed,
  estimate na stock reserve karta hai na deduct — R1).
- Duplicate inventory product pick → naya row nahi, qty +1 (jobs/new jaisa).
- Custom part/service: `product_id`/`service_id` = null, sirf free text.
- Service rows me qty normally 1; editable rakhein (multi-qty service allowed).

---

## 4. Totals math (single pure module)

```ts
subtotal     = Σ line.amount
discountAmt  = discountPercent ? subtotal * discountPct / 100 : discountAmount
discountAmt  = clamp(discountAmt, 0, subtotal)          // negative total kabhi nahi
taxable      = subtotal - discountAmt
gstAmt       = gstEnabled ? taxable * gstRate / 100 : 0  // gstRate: 0/5/12/18 (default 18)
cgst = sgst  = gstAmt / 2                                 // print par 9%+9% default
grandRaw     = taxable + gstAmt
roundOff     = Math.round(grandRaw) - grandRaw            // nearest rupee (half up)
grandTotal   = Math.round(grandRaw)
```

- Discount input: ₹ amount **ya** % toggle (ek hi baar apply).
- GST **exclusive** (existing `print-bill` pattern: taxable par 9+9).
- Round-off line print par `+0.42` / `−0.30` dikhe.
- Amount in words (Indian system) — `numberToWords` ko `print-bill/route.ts` se
  `src/lib/numberToWords.ts` me extract karke dono jagah reuse (behaviour-preserving).
- Negative/NaN/Infinity kabhi propagate na ho — inputs par min/step + pure fn me guard.

---

## 5. Draft persistence (local only)

- Key: `vtech_estimate_draft_v1` (`{ version, savedAt, form }`).
- 500ms debounced autosave; mount par restore + toast "Draft restored"; 7 din se purana → discard.
- `New estimate` → confirm → clear draft + reset form.
- Note: draft me client name/contact local device par rehta hai; admin device assumption,
  isliye clear button + expiry. Koi network/DB write nahi.

---

## 6. Print (A4)

**Route:** `POST /api/print-estimate` — JSON payload (hidden form `target="_blank"` se open,
taaki response ke security headers/CSP lagu hoke naya tab khule; fetch+document.write me
nonce-CSP apply nahi hota).

- Auth: `requireStaffWithRole()` + `role === "admin" | "developer"` warna 403; bina session 401.
- Body: `parseBody(zodSchema, req)` — max 100 lines, name ≤ 200 chars, qty/rate finite ≥ 0,
  discount/GST bounded, `printOptions { showTitle, title ≤ 60, showDisclaimer, disclaimer ≤ 300 }`;
  **server totals khud recompute karta hai** (client numbers trust nahi).
- Render: `getPrintShop()` branding (white-label), `printHtmlResponse()` (random nonce CSP,
  click bridge) — existing print routes jaisa. **Sab user text `esc()` se escape** (name, custom
  part/service, client fields, remarks) — stored/injected `<script>` kabhi raw print na ho.
- Layout (default — koi estimate indication nahi): firm name/address/phone/GSTIN (system_info se,
  missing ho to line hide); **Ref. No.** + date + valid till; client block; items table (GST mode
  me HSN column); totals block; amount in words; remarks/terms (editable); signature lines.
- **Optional print elements (default OFF, user toggle):**
  - Document title (editable, "ESTIMATE" / "QUOTATION" / kuch bhi) — OFF par heading nahi.
  - Disclaimer (editable text) — OFF par print par disclaimer nahi.
  - OFF hone par page par kahin "estimate/quote" wording, watermark ya disclaimer nahi aata.
- **Koi QR/tracking token nahi** — estimate tracked job nahi hai.
- `Cache-Control: no-store` (printHtmlResponse default).

---

## 7. WhatsApp share

- Client select hone par primary contact (multi-contact ho to picker — `client_contacts` read).
- Message: firm name, estimate no/date, line items (name × qty = amount), subtotal/discount/GST/total,
  valid-till, firm phone — `resolveTemplate`/`substituteTemplate` pattern reuse (read-only) +
  `WaPreviewModal` (editable preview) + `waLink()`. Koi template DB write nahi.

---

## 8. Permissions & routing

- Page: role guard admin/developer (client-side profiles check) → warna `/` redirect.
  `src/app/components/AdminPage.tsx` ka admin-only branch abhi developer ko allow nahi karta —
  usko `role === "admin" || role === "developer"` karna hoga (RootClient `isAdmin` ke saath
  consistent; baaki admin pages ke liye strictly zyada permissive, blast radius low).
- Nav: `RootClient.tsx` me admin-only top-level entry, Inventory section ke upar; sirf `isAdmin`
  par render.
- Module gating: `/estimates` ko `src/lib/modules.ts` `MODULE_TO_ROUTE.sales` me add karo,
  taaki seller ne sales module off kiya ho to route bhi disabled rahe.
- API: 401/403 matrix — no session 401, staff 403, admin/developer 200.
- No `logActivity()` call kahin bhi (wo DB write hai).

---

## 9. Files

**New**

| File                                               | Kaam                                                      |
| -------------------------------------------------- | --------------------------------------------------------- |
| `src/app/estimates/page.tsx`                       | Route shell + admin/developer guard                       |
| `src/app/estimates/components/EstimateBuilder.tsx` | Form state, pickers, actions                              |
| `src/app/estimates/components/EstimateLines.tsx`   | Editable item table + mobile cards                        |
| `src/app/estimates/components/EstimateTotals.tsx`  | Totals panel + discount/GST controls                      |
| `src/lib/estimate.ts`                              | Types + `computeEstimateTotals()` + draft serialize/parse |
| `src/lib/numberToWords.ts`                         | `print-bill` se extracted Indian-system words             |
| `src/app/api/print-estimate/route.ts`              | POST → branded A4 estimate HTML                           |
| `src/lib/estimate.test.ts`                         | Totals/draft tests                                        |
| `src/app/api/print-estimate/route.test.ts`         | Escaping + auth + recompute tests                         |

**Modified (small)**

- `src/app/RootClient.tsx` — nav entry (admin/developer only)
- `src/lib/modules.ts` — `/estimates` → sales module
- `src/app/components/AdminPage.tsx` — developer ko admin-only pages par allow
- `src/app/api/print-bill/route.ts` — `numberToWords` import (local copy hatao)

---

## 10. Phases & estimates

| Phase             | Kaam                                                                                                 | Effort |
| ----------------- | ---------------------------------------------------------------------------------------------------- | ------ |
| **P1**            | Types + `computeEstimateTotals` + unit tests (pure math first)                                       | 2–3 h  |
| **P2**            | `/estimates` builder: client picker, product/service pickers, custom rows, inline edit, totals panel | 1 din  |
| **P3**            | Draft autosave/restore + validation + mobile cards + nav/route guard                                 | 3–4 h  |
| **P4**            | `POST /api/print-estimate` (Zod + escaping + recompute) + A4 template + amount-in-words extract      | 3–4 h  |
| **P5**            | WhatsApp preview/share + polish (due badge, validity, remarks)                                       | 2–3 h  |
| **P6 (optional)** | Thermal 58mm print; walk-in client (free name+phone); PDF download                                   | 4–6 h  |

Total core (P1–P5): **~2 din**. DB impact: **zero**.

---

## 11. Test plan & gates

- Unit: totals matrix — discount % vs ₹, discount > subtotal clamp, GST 0/5/12/18,
  round-off both signs, empty lines, decimal qty, huge/NaN guard, words conversion.
- Route: 401 no session · 403 staff · 200 admin/developer · malformed body 400 ·
  > 100 lines 400 · `<script>` item name escaped in HTML · server totals ≠ client totals
  > (server jeetta hai) · `no-store` header.
- Manual: desktop + mobile layout, print preview (popup blocked message), refresh restore,
  `New estimate` clear, stock warning, WhatsApp preview, GST on/off print diff.
- Print indication matrix: title/disclaimer dono OFF (default) → printed HTML me "estimate/quote"
  wording, watermark ya disclaimer nahi · title ON → sirf title · disclaimer ON → sirf disclaimer ·
  dono ON → dono; text editable aur escaped.
- **Invariant verification (R1/R2/R3)** — estimate banane + print + WhatsApp ke baad:
  - `inventory_list` / stock RPC values pehle jaisi (koi decrement nahi),
  - client ka due/opening balance bilkul same (`/clients/[id]/view` compare),
  - `transaction_list` / `direct_sales` / `client_payments` / `activity_logs` me koi nayi row nahi.
    Code review: page/route me sirf `select` aur `rpc` (read) calls — koi `insert/update/delete/upsert` nahi.
- Gates: `npx tsc --noEmit` · `npx eslint .` · `npx vitest run` · `npm run build`.
- Confirm during review: **no DB write anywhere** (only selects), no `activity_logs` row.

---

## 12. Risks / notes

| Risk                                         | Mitigation                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Estimate number duplicate (no DB uniqueness) | By design (no record); editable field; random suffix                                          |
| Shared device par draft me client PII        | 7-day expiry + explicit clear; admin-only devices                                             |
| Print popup blocked                          | Hidden form `target="_blank"` + fallback toast ("browser me popups allow karein")             |
| Custom text XSS in print                     | `esc()` + nonce CSP (existing hardening pattern)                                              |
| User baad me record/history maange           | Ye plan deliberately record-free hai; tab alag table-based plan banega (DB approval ke saath) |
| GST inclusive quotes ki zarurat              | Phase 6 optional: inclusive/exclusive toggle                                                  |

---

## 13. Definition of Done

- [x] Admin/developer `/estimates` khol kar client + inventory + custom part + service rows bana sake
      — code complete; authenticated browser QA pending
- [x] Har row editable, totals live aur spec ke exact formulas ke mutabik (16 unit tests)
- [x] **R1:** estimate banane/print karne se inventory stock bilkul kam na ho (display-only)
      — stock sirf `fetchStockByProducts` read; koi write call nahi
- [x] **R2:** client ke khate/due me koi debit/credit na bane; koi job/sale/payment row na bane
      — code review: zero insert/update/upsert/delete
- [x] **R3:** koi `activity_logs` entry na ho — koi `logActivity` call nahi
- [x] Printed copy default par koi estimate indication/watermark/disclaimer nahi; title aur
      disclaimer print-options se select/off ho sakein (default OFF) — route tests
- [x] Refresh par draft restore; `New estimate` clear — serialize/parse/expiry tests
- [x] A4 print white-label branding ke saath, GST on/off dono, amount in words, escaped inputs
- [x] Staff ko nav/page/API — teeno par access nahi (401/403 verified)
- [x] WhatsApp preview + send client ke contact par — `WaPreviewModal` + `waLink`
- [x] tsc + eslint + vitest + build green; koi DB write/migration nahi

### 13.1 Implementation status (2026-10-31)

- Files: `src/lib/estimate.ts` (+ tests), `src/lib/numberToWords.ts`, `src/lib/estimate-print.ts`,
  `src/lib/validation/schemas/estimate.ts`, `src/app/estimates/*`, `src/app/api/print-estimate/*`.
- Wiring: admin-only Estimate nav (Inventory section ke upar), `/estimates` → sales module,
  `AdminPage` admin-only branch developer ko bhi allow karta hai, `print-bill` shared
  `numberToWords` import karta hai.
- Gates: `npx tsc --noEmit` ✅ · `npx eslint .` ✅ · `npx vitest run` 563/563 ✅ · `npm run build` ✅.
- Read-only smoke: `/estimates` → 307 `/login` (proxy guard) · `POST /api/print-estimate` unauthenticated → 401.
- **Pending manual QA (authenticated admin/developer):** desktop + mobile layout, print popup +
  neutral/title/disclaimer matrix, GST on/off print, draft restore refresh ke baad, `New` clear,
  stock warning, WhatsApp preview/send, aur R1/R2/R3 live comparison (`inventory_list`/stock,
  client due, `transaction_list`/`direct_sales`/`client_payments`/`activity_logs` me koi nayi row nahi).
