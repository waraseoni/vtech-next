# Changelog & Work Log — 04 Sep 2026

*Date: 04 Sep 2026 · Branch: main · Remote: github.com/waraseoni/vtech-next*

---

## Features Implemented

### 1. Universal Search — Locations & Spots (`002886a`)

**Problem:** Navbar search only searched products and jobs. Locations (storage) and spots (repair) were not searchable.

**What changed:**
- `src/app/RootClient.tsx` — NavbarSearch now queries the `locations` table for both `kind='inventory'` (storage locations) and `kind='job'` (repair spots)
- Location results navigate to `/inventory/locate?loc=<encoded_path>` (Spare Finder with deep-link)
- Product results now navigate to `/inventory/${id}` (product detail page)
- Search header updated: "Products, Jobs, Locations & Spots dhoonden..."

**Files changed:** `src/app/RootClient.tsx`

---

### 2. LocationPicker — Hierarchy-Only Lock + Type-to-Search + Disambiguation (`002886a`)

**Problem:** Users could type free-text values in LocationPicker that weren't in the hierarchy (zone/rack/bin/box). These got saved but couldn't be displayed properly. Same-named children (e.g., "SELF 1" in multiple zones) had no disambiguation.

**What changed:**
- **Hierarchy-only selection** — Free-text input removed. Users must select from hierarchy dropdowns. "Add" button removed, replaced with "Manage Hierarchy" link to `/inventory/locations/manage`
- **Type-to-search** — Inputs are editable for filtering, but only hierarchy values are selectable. `displayValue` shows query when dropdown open, selected value when closed
- **Location code display** — `genCode()` function generates `Z1-R3-B2-X5` format codes. Code shown in picker preview badge and product detail page location display
- **Disambiguation modal** — When same-named child exists under multiple parents and no parent is selected, a modal shows all possible parent paths for user to choose. Parent chain auto-fills on selection
- **Duplicate key fix** — `[...new Set()]` deduplication in `childrenFor()` to prevent duplicate dropdown entries
- **API validation** — `/api/locations/assign` now rejects non-hierarchy values with 400 error. `/api/locations/options` no longer returns legacy free-text values

**Files changed:**
- `src/components/LocationPicker.tsx` — Major rewrite (~280 lines changed)
- `src/app/inventory/[id]/page.tsx` — Product detail updated with code badge
- `src/app/api/locations/assign/route.ts` — Hierarchy validation added
- `src/app/api/locations/options/route.ts` — Legacy values removed

---

### 3. Centralized Supplier System (`2c1ea8b`)

**Problem:** Supplier list was fetched independently in 3 places (ProductFormModal, StockModal, CreatePOModal) with inconsistent filters. No inline supplier creation — users had to navigate to `/suppliers` page, create supplier, come back, re-open modal. Supplier list never refreshed after adding a new supplier. PO creation showed inactive suppliers (missing `status=1` filter).

**What changed:**

#### New Files
- **`src/lib/useSuppliers.ts`** — Shared hook: `useSuppliers()` returns `{ suppliers, loading, refresh }`. Always filters `delete_flag=0 AND status=1`. `refresh()` re-fetches list after creating new supplier.
- **`src/components/SupplierPicker.tsx`** — Shared component supporting both single-select and multi-select modes. Features:
  - Search/filter suppliers
  - Inline "+ Naya Supplier add karo" creation form (name + contact)
  - Auto-selects newly created supplier
  - Refreshes list instantly after creation
  - Mobile bottom-sheet + desktop anchored dropdown
  - `hideIfEmpty` prop for StockModal (hides field when no suppliers exist)

#### Refactored Files
- **`src/components/ProductFormModal.tsx`** — Removed ~120 lines of hand-rolled multi-select UI, replaced with `<SupplierPicker multi>` (~5 lines). Removed supplier state, useEffect, outside-click handler.
- **`src/app/inventory/[id]/components/StockModal.tsx`** — Removed SearchableSelect + manual mapping, replaced with `<SupplierPicker>`. Removed supplier interface, state, useEffect.
- **`src/app/inventory/purchase-orders/page.tsx`** — Removed SearchableSelect + manual mapping in CreatePOModal, replaced with `<SupplierPicker>`. Now filters `status=1` (was missing). Removed Supplier interface.

#### Before vs After

| Feature | Before | After |
|---|---|---|
| Supplier list source | 3 independent fetches | 1 shared hook (`useSuppliers`) |
| Inline creation | Not possible | "+ Naya Supplier" in every dropdown |
| List refresh | Never | Auto after creating new supplier |
| Status filter | Inconsistent (PO had no filter) | Consistent: `status=1` everywhere |
| Multi-select | Custom 120-line UI | `<SupplierPicker multi>` |
| Single-select | SearchableSelect + manual mapping | `<SupplierPicker>` |

---

## Commits

| Hash | Message |
|---|---|
| `002886a` | `feat(search): add locations & spots to universal search + hierarchy-locked LocationPicker` |
| `2c1ea8b` | `feat(suppliers): centralized supplier system with inline creation` |

---

## Verification

- **TypeScript:** 0 errors (`npm run typecheck`)
- **ESLint:** 0 errors, 15 pre-existing warnings (unused imports in attendance/reports pages — not related to today's work)
