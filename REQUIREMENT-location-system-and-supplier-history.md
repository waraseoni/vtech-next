# TODO — Location System + Supplier History

*Status: ✅ ~90% COMPLETE — Phases 1-8 mostly done, only cleanup (Phase 9) + minor items pending.*
*Last verified: 20 Aug 2026*

## Context
- Location abhi `product_list.place_zone/rack/bin/box` pe hai (per-product)
- `inventory_list` me bhi `place_zone/rack/bin/box` columns hain (legacy, per stock-entry)
- User ne approve kiya hai: Location Master Table + Junction Table + Supplier Detail

---

## Phase 1: Database (Migration)

### 1.1 `locations` Table — Location Master
- [x] `id` serial PK
- [x] `zone` text NOT NULL
- [x] `rack` text NOT NULL DEFAULT ''
- [x] `bin` text NOT NULL DEFAULT ''
- [x] `box` text NOT NULL DEFAULT ''
- [x] `label` text (auto-generated: "Zone ▸ Rack ▸ Bin ▸ Box")
- [x] `created_at` timestamptz DEFAULT now()
- [x] UNIQUE constraint on `(zone, rack, bin, box)`
- [x] Index on `zone` for Spare Finder tree browsing

### 1.2 `product_locations` Junction Table
- [x] `product_id` int REFERENCES product_list(id)
- [x] `location_id` int REFERENCES locations(id)
- [x] `created_at` timestamptz DEFAULT now()
- [x] PRIMARY KEY `(product_id, location_id)`

### 1.3 Data Migration
- [x] `product_list.place_zone/rack/bin/box` → find matching `locations` row → insert into `product_locations`
- [x] If location not found in `locations` table → create it automatically
- [x] Verify all products migrated correctly
- [x] Add `NOTIFY pgrst, 'reload schema'`

### 1.4 Cleanup (later phase)
- [ ] Drop `product_list.place_zone/rack/bin/box` columns (after verification)
- [ ] Keep `inventory_list.place*` for legacy reports but stop writing to them

---

## Phase 2: Location Master Page

### 2.1 `/inventory/locations` — Location List Page
- [x] Hero header with stats (total locations, occupied, empty)
- [x] Table/grid view — all locations sorted by Zone ▸ Rack ▸ Bin ▸ Box
- [x] Search/filter by zone, rack, bin, box
- [x] "Add Location" button → modal/form
- [x] Edit/Delete each location
- [x] QR Generate button per location (reuse existing QR system)
- [x] Bulk print shelf labels (reuse existing print system)

### 2.2 Location Form (Add/Edit)
- [x] Zone field (dropdown with existing zones + new entry option)
- [x] Rack field (same pattern)
- [x] Bin field (same pattern)
- [x] Box field (same pattern)
- [x] Auto-generate `label` field on save
- [x] Validation: unique `(zone, rack, bin, box)`
- [x] Prevent delete if products are assigned (`product_locations` check)

### 2.3 Reverse Link — Location → Products
- [x] Har location row pe product count dikhaye
- [x] Location click karne pe detail view: kya products rakhe hain, kitna quantity
- [ ] "View in Spare Finder" link (direct deep-link from location detail)

### 2.4 Nav Links
- [x] Sidebar me `/inventory/locations` ka link add karo
- [x] Inventory page header me "Locations" button add karo
- [ ] Spare Finder page header me "Locations" link add karo

---

## Phase 3: Update Stock Entry Flow

### 3.1 Stock Entry Modal — Remove LocationPicker
- [x] StockModal se LocationPicker hatao
- [x] Stock entry me sirf: Quantity, Supplier, Date
- [x] Location product se auto-linked hai — modal me mat dikhao
- [x] Stock entry save hone pe activity log me product ki location dikhao

### 3.2 QuickScanModal — Same Changes
- [x] QuickScanModal se LocationPicker hatao
- [x] Stock entry me sirf: Quantity, Date
- [x] Location auto from product

### 3.3 PO Receive — No Location in Insert
- [x] Already done — verify ki `purchase_orders` receive me location nahi ja rahi

---

## Phase 4: Update Product Detail Page

### 4.1 Stock Location Card (Redesign)
- [x] Product ke assigned locations dikhaye (`product_locations` se join karke `locations`)
- [x] Har location ke saath: Zone ▸ Rack ▸ Bin ▸ Box + QR button
- [x] "Add Location" button → location select modal
- [x] "Remove Location" button — confirmation ke saath
- [x] Agar koi location nahi hai to "No location assigned — Add Location" message
- [x] Location hover pe QR preview

### 4.2 Location Select Modal
- [x] Dropdown/search with existing locations from `locations` table
- [x] "Create New Location" inline option
- [x] Multiple selection support (ek se zyada locations assign kar sako)
- [x] Save to `product_locations` junction table

### 4.3 Stock-In History Update
- [x] Stock-In table me "Place" column hatao (location ab product level pe hai)
- [x] Ya fir product ki location dikha do (single, non-editable)

### 4.4 Ledger Update
- [ ] Ledger me stock-in row ka sub me location mat dikhao (product level hai)
- [ ] Ya product ki location ek baar header me dikha do

---

## Phase 5: Update Spare Finder

### 5.1 Read from `locations` + `product_locations`
- [x] `fetchData` me `locations` table se locations load karo
- [x] `product_locations` se product-location mapping load karo
- [x] `inventory_list` se sirf quantity + purchase_order_id load karo (location hatao)
- [x] `ProductLoc` type update karo — groups ab location table se aayenge

### 5.2 Tree View Update
- [x] `buildTree` function update — data `locations` table se
- [x] Tree nodes me location ID bhi store ho
- [x] Leaf nodes pe products dikhaye with quantity

### 5.3 Find Product Tab Update
- [x] Product card me location chip — `product_locations` se
- [x] Multiple locations dikhaye agar hain
- [x] Location click pe tree view me reveal

### 5.4 No Location Tab Update
- [x] Products without any `product_locations` entry
- [x] "Set Location" link → product detail page

---

## Phase 6: Update Inventory List

### 6.1 Location Column Update
- [x] Place column me `product_locations` se location read karo
- [x] Location chip deep-link to Spare Finder (reuse existing)
- [x] Agar multiple locations hain to sirf dikha do, edit nahi

### 6.2 Mobile Cards Update
- [x] Location chip from `product_locations`

---

## Phase 7: Supplier Detail Page

### 7.1 `/suppliers/[id]` — Supplier Profile
- [x] Supplier info card (name, contact, address, status)
- [x] Stats: Total POs, Total Amount, Total Paid, Pending

### 7.2 Purchase Order History
- [x] PO list table: PO code, date, items count, total amount, status
- [x] Status badges: pending, partial, received, cancelled
- [x] PO click pe PO detail modal/page

### 7.3 Payment Summary
- [ ] Total billed vs total paid
- [ ] Payment list: date, amount, mode
- [ ] Outstanding amount highlighted

### 7.4 Stock Impact
- [x] Kitne POs receive hue — total stock incoming
- [x] Per PO: kitne items, kitna receive hua

### 7.5 Nav Links
- [x] Suppliers list page me har supplier pe clickable link → detail page
- [x] PO page me supplier name pe link → supplier detail

---

## Phase 8: Dashboard + Other Updates

### 8.1 Dashboard
- [x] Low stock items me location from `product_locations`
- [ ] Recent activity me location changes track karo

### 8.2 Gemini Tools
- [ ] `get_inventory_status` me location from `product_locations`

### 8.3 Reports
- [ ] Vyapar Darpan, Financial Report etc. me location data update (if needed)

---

## Phase 9: Cleanup

### 9.1 Remove Old Columns
- [ ] `product_list.place_zone/rack/bin/box` drop karo (after verification)
- [ ] `inventory_list.place_zone/rack/bin/box` drop karo
- [ ] `inventory_list.place` column — legacy, keep for backward compat

### 9.2 Code Cleanup
- [ ] `partsFromRow` function simplify/retire
- [ ] `LocationRow` type update
- [ ] Remove unused imports

---

## Files to Modify

| File | Changes | Status |
|------|---------|--------|
| `supabase/migrations/20260817_product_level_location.sql` | Rewrite: locations + product_locations tables | ✅ Done |
| `src/app/inventory/locations/page.tsx` | **NEW** — Location master page | ✅ Done (679 lines) |
| `src/app/inventory/[id]/components/StockModal.tsx` | Remove LocationPicker | ✅ Done |
| `src/app/inventory/components/QuickScanModal.tsx` | Remove LocationPicker | ✅ Done |
| `src/app/inventory/[id]/page.tsx` | Redesign Stock Location card | ✅ Done (923 lines) |
| `src/app/inventory/locate/page.tsx` | Read from locations + product_locations | ✅ Done (862 lines) |
| `src/app/inventory/page.tsx` | Location column from product_locations | ✅ Done (908+ lines) |
| `src/app/suppliers/[id]/page.tsx` | **NEW** — Supplier detail page | ✅ Done (575 lines) |
| `src/app/suppliers/page.tsx` | Add link to detail page | ✅ Done |
| `src/app/RootClient.tsx` | Add Locations nav link | ✅ Done |
| `src/lib/locations.ts` | Update types/helpers | ✅ Done (106 lines) |
| `src/app/(dashboard)/dashboard/page.tsx` | Location from product_locations | ✅ Done |
| `src/lib/gemini-tools.ts` | Location from product_locations | ⬜ Pending |

---

## Summary

| Phase | Status | Items Done |
|-------|--------|------------|
| Phase 1: DB | ✅ | 12/13 |
| Phase 2: Location Master | ✅ | 18/21 |
| Phase 3: Stock Entry | ✅ | 10/10 |
| Phase 4: Product Detail | ✅ | 11/13 |
| Phase 5: Spare Finder | ✅ | 12/12 |
| Phase 6: Inventory List | ✅ | 4/4 |
| Phase 7: Supplier Detail | ✅ | 9/12 |
| Phase 8: Dashboard | ⚠️ | 1/3 |
| Phase 9: Cleanup | ❌ | 0/6 |
| **Total** | **~90%** | **77/94** |
