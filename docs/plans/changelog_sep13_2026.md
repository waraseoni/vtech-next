# Changelog & Work Log — 13 Sep 2026

*Date: 13 Sep 2026 · Branch: main · Remote: github.com/waraseoni/vtech-next · Released: v1.8.3 → v1.14.x*

---

## Features Implemented

### 1. Supplier Payments & Dues Ledger (`34bb8e0`)

**Problem:** PO tracked order value but no record of money actually paid to suppliers (cash, UPI, bank). Repair shops buying from 10+ suppliers couldn't track outstanding balances.

**What changed:**
- New `supplier_payments` table (migration `20260912_supplier_payments.sql` — **applied**)
- `src/lib/supplierPayments.ts` — list/add payments + `fetchSupplierDues()` ledger computation
- Supplier detail page — "Payments" section with **Outstanding Balance** = Σ PO total − Σ payments, Add Payment modal (amount, mode, reference, date, notes)
- Suppliers list — "Due" column per supplier
- New report `/reports/supplier-dues` — per-supplier billed/paid/outstanding, search + print
- PO status display fix on supplier detail page (numeric↔text status map mismatch)

---

### 2. Image Crop / Rotate Editor on Upload (`00185f0`, `4f8fbc7`)

**Problem:** Visiting cards, product photos and avatars were uploaded raw — often rotated, with unwanted edges or wrong aspect.

**What changed:**
- Added `react-easy-crop@6.2.3`; `src/lib/imageCropper.ts` (blob crop util), `src/components/ImageCropperModal.tsx` (full-screen rotate L/R 90°, zoom, Fixed↔Free aspect, "Original rakho" / "Crop Karo"), `src/lib/useImageUpload.tsx` (`openCropper(File, {aspect, title, maxDim}) → Promise<File|null>`)
- Wired to: Supplier visiting card (3:2, Phase 1 pilot) → Product photo (1:1) → Profile/User/Client/Mechanic avatars (1:1, Phase 2)
- Plan `docs/plans/image_crop_edit_plan.md` — §10 SHIPPED (Phase 1 + Phase 2)

---

### 3. Required Parts → PO Conversion Bridge (P1) (`45cb463`)

**Problem:** A job's "waiting" required parts had to be manually re-typed into a PO at `/inventory/purchase-orders` — duplicate, error-prone work.

**What changed:**
- Migration `20260913_required_parts_po_bridge.sql` (**applied**): `purchase_orders.transaction_id` (integer FK → `transaction_list.id`, source-job trace) + `job_required_parts.purchase_order_id` (bigint FK) + indexes
- Job required-parts section — **"Waiting parts ka PO banao"** button (product-linked open parts only; custom spares skip)
- `/reports/parts-pending` — per-job-group "PO banao" button
- Reuses the existing `po_draft` sessionStorage draft flow; parallel `po_parts_meta` (`{partIds, transactionId}`) carries link info
- PO save → parts auto-linked + auto-`status:1` (Ordered); PO row shows "Job #… se" chip; parts show "PO #… se linked" chip
- Normal PO creation unaffected (transaction_id sent only when conversion context present)

---

### 4. Supplier GST / Bank / Credit Form Enrichment (P2) (`b168495`)

**Problem:** No GSTIN, bank or payment-terms data on suppliers — missing for purchase bills and large payments.

**What changed:**
- Migration `20260913_suppliers_gst_bank.sql` (**applied**): `gstin`, `bank_name`, `bank_account`, `bank_ifsc`, `credit_limit` (numeric 12,2), `payment_terms`, `city`, `state`
- SupplierFormModal — fieldsets: "GST/Tax Details", "Bank Details", "Business Terms" (credit limit ₹ + payment_terms dropdown: COD / Net 15 / Net 30 / Credit 15 days / Advance), City + State; prefilled on edit, empty → NULL on save
- Supplier detail info card — conditional rows: GSTIN (mono), City/State, Bank Account, Business Terms

---

### 5. Supplier Spending / Purchase Report (P3) (`1a0ad01`)

**Problem:** No view of which suppliers are used most, purchase volume, or unit-cost comparison.

**What changed:**
- `src/lib/supplierPurchases.ts` — `fetchSupplierPurchases(from, to)`: IST day bounds, canceled POs excluded, per-supplier aggregates (PO count, qty ordered/received, spend, weighted avg unit cost), per-product breakdown, monthly trend
- New report `/reports/supplier-purchases` — date range (Today / 7 Din / 30 Din / This Month presets, default current month), KPIs (Total Spend, POs, Qty Ordered, Avg Unit Cost), monthly spend bar chart, supplier table with expandable "inhone kya-kya supply kiya" product breakdown, search + print
- Reports index — "Supplier Purchases" card (teal, NEW badge)

### 6. Stock Valuation Report (I6) — `/reports/stock-valuation`

**Problem:** "Mere store me abhi kitna paisa ka stock pada hai" — koi single answer nahi tha; available × avg purchase cost kahin nahi dikhta.

**What changed:**
- `src/lib/stockValuation.ts` — two honest views:
  - `fetchProductValuation()` — active products × `available` (I1 RPC) × `avg_purchase_cost` → per-product value (searchable table, link → inventory detail)
  - `fetchLocationValuation()` — Σ(qty × purchase_cost) over `inventory_list` grouped by shelf (Zone ▸ Rack ▸ Bin ▸ Box), expandable per-product breakdown
- New report `/reports/stock-valuation`: KPI cards (Total Stock Value / Units / In Stock / Out Of Stock), two-view note (available basis vs inbound shelf value), print header + print CSS
- Reports index — "Stock Valuation" card (emerald, NEW badge)

---

## Migrations Applied (2026-09-12/13)

| Migration | Applied | Purpose |
|---|---|---|
| `20260912_rls_location_tables.sql` | ✅ | 🔒 Location RLS lockdown (anon hole close) — verified 20/20 |
| `20260912_supplier_payments.sql` | ✅ | Supplier payments + dues ledger |
| `20260913_required_parts_po_bridge.sql` | ✅ | P1: PO ↔ required-parts bridge + job trace |
| `20260913_suppliers_gst_bank.sql` | ✅ | P2: GST/bank/credit/terms/city/state |

Full-schema backports for all three added to `20260913000000_final_full_schema_idempotent.sql` (idempotent).

**2026-09-13:** Full schema audit (har migration vs fold-in) — sirf **`20260912_rls_location_tables.sql`** backport missing tha; ab fold-in kar diya (location RLS lockdown: open `to authenticated USING(true)` policies → `rlslock_*_staff` `is_frontend_staff()` gate, dynamic policy drop = idempotent). Ab saari 41 migrations folded hain. **Live apply bhi ho gaya (SQL Editor) + behavioral verify 20/20 PASS** — anon 0 rows / insert 401, profile-less ghost 0 rows / insert 403, sab 5 tables par. 🔒 **#1 security hole CLOSED.**

---

## Verification State

- `tsc --noEmit` clean · ESLint clean (new files) · Prettier formatted · `npm run build` PASS (169 pages incl. all new routes) · Vitest 101/101 PASS
- Version tags journey: v1.8.3 → v1.9.0 → v1.10.0 → v1.11.0 → v1.12.0 → v1.13.0 (CI semantic-release)

---

## Plan Status

- `docs/plans/suppliers_module_plan.md` — **COMPLETE**: Phase A + Phase B (P1/P2/P3) shipped; P4 (expense linkage) / P5 (spare_supplier reorder) optional
- `docs/plans/image_crop_edit_plan.md` — SHIPPED Phase 1 + Phase 2