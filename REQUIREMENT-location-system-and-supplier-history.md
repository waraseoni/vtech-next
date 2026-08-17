# TODO — Location System + Supplier History

## Context
- Location abhi `product_list.place_zone/rack/bin/box` pe hai (per-product)
- `inventory_list` me bhi `place_zone/rack/bin/box` columns hain (legacy, per stock-entry)
- User ne approve kiya hai: Location Master Table + Junction Table + Supplier Detail

---

## Phase 1: Database (Migration)

### 1.1 `locations` Table — Location Master
- [ ] `id` serial PK
- [ ] `zone` text NOT NULL
- [ ] `rack` text NOT NULL DEFAULT ''
- [ ] `bin` text NOT NULL DEFAULT ''
- [ ] `box` text NOT NULL DEFAULT ''
- [ ] `label` text (auto-generated: "Zone ▸ Rack ▸ Bin ▸ Box")
- [ ] `created_at` timestamptz DEFAULT now()
- [ ] UNIQUE constraint on `(zone, rack, bin, box)`
- [ ] Index on `zone` for Spare Finder tree browsing

### 1.2 `product_locations` Junction Table
- [ ] `product_id` int REFERENCES product_list(id)
- [ ] `location_id` int REFERENCES locations(id)
- [ ] `created_at` timestamptz DEFAULT now()
- [ ] PRIMARY KEY `(product_id, location_id)`

### 1.3 Data Migration
- [ ] `product_list.place_zone/rack/bin/box` → find matching `locations` row → insert into `product_locations`
- [ ] If location not found in `locations` table → create it automatically
- [ ] Verify all products migrated correctly
- [ ] Add `NOTIFY pgrst, 'reload schema'`

### 1.4 Cleanup (later phase)
- [ ] Drop `product_list.place_zone/rack/bin/box` columns (after verification)
- [ ] Keep `inventory_list.place*` for legacy reports but stop writing to them

---

## Phase 2: Location Master Page

### 2.1 `/inventory/locations` — Location List Page
- [ ] Hero header with stats (total locations, occupied, empty)
- [ ] Table/grid view — all locations sorted by Zone ▸ Rack ▸ Bin ▸ Box
- [ ] Search/filter by zone, rack, bin, box
- [ ] "Add Location" button → modal/form
- [ ] Edit/Delete each location
- [ ] QR Generate button per location (reuse existing QR system)
- [ ] Bulk print shelf labels (reuse existing print system)

### 2.2 Location Form (Add/Edit)
- [ ] Zone field (dropdown with existing zones + new entry option)
- [ ] Rack field (same pattern)
- [ ] Bin field (same pattern)
- [ ] Box field (same pattern)
- [ ] Auto-generate `label` field on save
- [ ] Validation: unique `(zone, rack, bin, box)`
- [ ] Prevent delete if products are assigned (`product_locations` check)

### 2.3 Reverse Link — Location → Products
- [ ] Har location row pe product count dikhaye
- [ ] Location click karne pe detail view: kya products rakhe hain, kitna quantity
- [ ] "View in Spare Finder" link

### 2.4 Nav Links
- [ ] Sidebar me `/inventory/locations` ka link add karo
- [ ] Inventory page header me "Locations" button add karo
- [ ] Spare Finder page header me "Locations" link add karo

---

## Phase 3: Update Stock Entry Flow

### 3.1 Stock Entry Modal — Remove LocationPicker
- [ ] StockModal se LocationPicker hatao
- [ ] Stock entry me sirf: Quantity, Supplier, Date
- [ ] Location product se auto-linked hai — modal me mat dikhao
- [ ] Stock entry save hone pe activity log me product ki location dikhao

### 3.2 QuickScanModal — Same Changes
- [ ] QuickScanModal se LocationPicker hatao
- [ ] Stock entry me sirf: Quantity, Date
- [ ] Location auto from product

### 3.3 PO Receive — No Location in Insert
- [ ] Already done — verify ki `purchase_orders` receive me location nahi ja rahi

---

## Phase 4: Update Product Detail Page

### 4.1 Stock Location Card (Redesign)
- [ ] Product ke assigned locations dikhaye (`product_locations` se join karke `locations`)
- [ ] Har location ke saath: Zone ▸ Rack ▸ Bin ▸ Box + QR button
- [ ] "Add Location" button → location select modal
- [ ] "Remove Location" button — confirmation ke saath
- [ ] Agar koi location nahi hai to "No location assigned — Add Location" message
- [ ] Location hover pe QR preview

### 4.2 Location Select Modal
- [ ] Dropdown/search with existing locations from `locations` table
- [ ] "Create New Location" inline option
- [ ] Multiple selection support (ek se zyada locations assign kar sako)
- [ ] Save to `product_locations` junction table

### 4.3 Stock-In History Update
- [ ] Stock-In table me "Place" column hatao (location ab product level pe hai)
- [ ] Ya fir product ki location dikha do (single, non-editable)

### 4.4 Ledger Update
- [ ] Ledger me stock-in row ka sub me location mat dikhao (product level hai)
- [ ] Ya product ki location ek baar header me dikha do

---

## Phase 5: Update Spare Finder

### 5.1 Read from `locations` + `product_locations`
- [ ] `fetchData` me `locations` table se locations load karo
- [ ] `product_locations` se product-location mapping load karo
- [ ] `inventory_list` se sirf quantity + purchase_order_id load karo (location hatao)
- [ ] `ProductLoc` type update karo — groups ab location table se aayenge

### 5.2 Tree View Update
- [ ] `buildTree` function update — data `locations` table se
- [ ] Tree nodes me location ID bhi store ho
- [ ] Leaf nodes pe products dikhaye with quantity

### 5.3 Find Product Tab Update
- [ ] Product card me location chip — `product_locations` se
- [ ] Multiple locations dikhaye agar hain
- [ ] Location click pe tree view me reveal

### 5.4 No Location Tab Update
- [ ] Products without any `product_locations` entry
- [ ] "Set Location" link → product detail page

---

## Phase 6: Update Inventory List

### 6.1 Location Column Update
- [ ] Place column me `product_locations` se location read karo
- [ ] Location chip deep-link to Spare Finder (reuse existing)
- [ ] Agar multiple locations hain to sirf dikha do, edit nahi

### 6.2 Mobile Cards Update
- [ ] Location chip from `product_locations`

---

## Phase 7: Supplier Detail Page

### 7.1 `/suppliers/[id]` — Supplier Profile
- [ ] Supplier info card (name, contact, address, status)
- [ ] Stats: Total POs, Total Amount, Total Paid, Pending

### 7.2 Purchase Order History
- [ ] PO list table: PO code, date, items count, total amount, status
- [ ] Status badges: pending, partial, received, cancelled
- [ ] PO click pe PO detail modal/page

### 7.3 Payment Summary
- [ ] Total billed vs total paid
- [ ] Payment list: date, amount, mode
- [ ] Outstanding amount highlighted

### 7.4 Stock Impact
- [ ] Kitne POs receive hue — total stock incoming
- [ ] Per PO: kitne items, kitna receive hua

### 7.5 Nav Links
- [ ] Suppliers list page me har supplier pe clickable link → detail page
- [ ] PO page me supplier name pe link → supplier detail

---

## Phase 8: Dashboard + Other Updates

### 8.1 Dashboard
- [ ] Low stock items me location from `product_locations`
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

| File | Changes |
|------|---------|
| `supabase/migrations/20260817_product_level_location.sql` | Rewrite: locations + product_locations tables |
| `src/app/inventory/locations/page.tsx` | **NEW** — Location master page |
| `src/app/inventory/[id]/components/StockModal.tsx` | Remove LocationPicker |
| `src/app/inventory/components/QuickScanModal.tsx` | Remove LocationPicker |
| `src/app/inventory/[id]/page.tsx` | Redesign Stock Location card |
| `src/app/inventory/locate/page.tsx` | Read from locations + product_locations |
| `src/app/inventory/page.tsx` | Location column from product_locations |
| `src/app/suppliers/[id]/page.tsx` | **NEW** — Supplier detail page |
| `src/app/suppliers/page.tsx` | Add link to detail page |
| `src/app/RootClient.tsx` | Add Locations nav link |
| `src/lib/locations.ts` | Update types/helpers |
| `src/app/(dashboard)/dashboard/page.tsx` | Location from product_locations |
| `src/lib/gemini-tools.ts` | Location from product_locations |
