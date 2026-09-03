# BOM Auto-Check System — Implementation Plan

> Status: **PLAN / DESIGN ONLY** — no code written.
> This document is a phased, reviewable design for integrating a BOM (Bill of Materials)
> checking system into V-Tech PRO. The feature lets technicians paste a component list,
> instantly see stock availability against the live inventory, and get AI-powered
> recommendations on what to order or substitute.

---

## 1. What exists today (verified)

### 1.1 Inventory stock (derived, never stored)

```
available = Σ inventory_list.quantity
          − Σ transaction_products.qty  (non-cancelled jobs, status ≠ 4)
          − Σ direct_sale_items.qty
```

Canonical helpers: `src/lib/inventory.ts` — `stockStatus()`, `alertThreshold()`, `stockStatusStyle()`, `aggregateStock()`.

### 1.2 Product catalog (`product_list`)

| Column | Purpose |
|---|---|
| `id` (int, PK) | Auto-increment |
| `name` | Display name (e.g. "NE555 Timer IC") |
| `description` | Free text — often contains aliases/keywords |
| `barcode` | Optional, unique-ish |
| `alert_quantity` | Low-stock threshold |
| `cost_price` / `price` | Pricing |
| `status` | 0=inactive, 1=active |
| `delete_flag` | Soft delete (0/1) |

**No `aliases` column exists.** Matching must use `name` + `description` + `barcode`.

### 1.3 Existing reorder system (`/reports/requirement-list`)

- Computes `need_to_order = max(0, alert_quantity - current_stock)` per product
- Shows supplier contacts via `spare_supplier` → `suppliers`
- Static list of ALL low-stock items — **not project/BOM-specific**

### 1.4 Purchase Orders (`/inventory/purchase-orders`)

- Full CRUD: create → pending → ordered → received
- `purchase_order_items`: product_id, qty_ordered, qty_received, unit_cost
- **No partial receive** (status is all-or-nothing)
- **No auto-draft from BOM** — PO is manually created

### 1.5 AI integration

- **Providers:** Gemini (`src/lib/gemini.ts`) + Groq (`src/lib/groq.ts`)
- **Shared tools:** 14 function-calling tools in `src/lib/gemini-tools.ts` (server-side, service-role Supabase)
- **Server API route:** `POST /api/chat` → resolves provider/key/model from `system_info`, injects live context, calls `getChatResponse()` or `getGroqChatResponse()`
- **Live context** (`getLiveContext`): 60s TTL cache, injects low stock / pending jobs / revenue snapshot into every AI prompt

### 1.6 Job → spare parts flow (`/jobs/new`)

- Products added via `SearchableSelect` dropdown
- Stored in `transaction_products` (product_id, product_name, qty, price)
- **No saved BOM templates** — every job builds the parts list from scratch
- Stock computed live via 4 parallel Supabase queries (same formula)

### 1.7 Location hierarchy

- 4-level: Zone → Rack → Bin → Box
- Accessed via `/api/locations/by-product` (service-role, RLS-gated)
- `locPath()` helper formats display paths
- QR label system exists for shelf labels

### 1.8 UI patterns to follow

- **Page wrapper:** `AdminPage` (role gate + scaffold) or `PageHeader` + `PremiumCard`
- **Panel style:** `bg-[#161b27] border border-[#21293d] rounded-2xl`
- **Input style:** `bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white`
- **Status badges:** `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border`
- **Table thead:** `bg-[#111520]` + `text-[10px] font-black uppercase tracking-widest text-slate-600`
- **Sidebar:** Add link in `RootClient.tsx` `SidebarNav`, under "Inventory" section

---

## 2. Feature design

### 2.1 Core concept

A **BOM Checker** page where a technician:
1. Pastes (or types) a list of components with quantities
2. System matches each line against the live `product_list` catalog
3. Shows real-time stock status per line item
4. Generates an AI summary (Hinglish) of whether the project can start
5. Optionally saves the BOM as a reusable template
6. Optionally creates a draft Purchase Order for missing parts

### 2.2 BOM input (manual + file)

**Supported formats per line:**
```
NE555 Timer IC - 2          → name: "NE555 Timer IC", qty: 2
4x IRF540N MOSFET           → name: "IRF540N MOSFET", qty: 4
10k Resistor (10)           → name: "10k Resistor", qty: 10
BC547 Transistor 5          → name: "BC547 Transistor", qty: 5
```

**File upload:** `.csv` / `.txt` — first column = component name, second = quantity (optional).

### 2.3 Part matching logic

**No `aliases` column** in DB. Match strategy:

1. **Exact match:** lowercase `name` = query
2. **Substring match:** `name.toLowerCase().includes(query)` or vice versa
3. **First-token match:** query matches the first word of `name` (e.g. "NE555" matches "NE555 Timer IC")
4. **Barcode match:** if query looks like a barcode, match against `product_list.barcode`
5. **Description fallback:** `description.toLowerCase().includes(query)` (descriptions often contain keywords)

Each BOM line → best match from `product_list` (score-based, highest wins).

### 2.4 Stock status per line

Reuse existing `stockStatus()` from `src/lib/inventory.ts`:

| Status | Condition | Badge |
|---|---|---|
| `available` | `available >= needed` AND `available > alert_quantity` | Green "Available" |
| `low` | `available >= needed` BUT `available <= alert_quantity` | Amber "Low stock" |
| `insufficient` | `0 < available < needed` | Orange "Insufficient" |
| `outofstock` | `available === 0` | Red "Out of stock" |
| `notfound` | No product match found | Gray "Not in catalog" |

### 2.5 Summary cards (top of results)

Four stat cards:
- **Total parts:** count of BOM lines
- **Available:** count with status `available` or `low`
- **Issues:** count with `outofstock` / `insufficient` / `notfound`
- **Can start:** `✓ Go` or `✗ Hold` based on whether all lines have sufficient stock

### 2.6 AI summary (server-side, Gemini/Groq)

**Server route:** `POST /api/bom-check`

**Prompt construction:**
```
You are an electronics workshop inventory assistant.
Technician submitted a BOM for project: {projectName}

BOM Results:
- Available: {list with need vs have}
- Low stock: {list}
- Insufficient: {list with deficit}
- Out of stock: {list}
- Not found: {list}

Respond in Hindi/Hinglish. 3-4 lines max:
1. Can project start? (haan/nahi + reason)
2. Urgently order what?
3. Common substitutes for missing parts?
```

**Uses:** existing `getChatResponse()` (Gemini) or `getGroqChatResponse()` (Groq) from `src/lib/gemini.ts` / `src/lib/groq.ts`. Resolves API key from `getAiSettings()`. **No Anthropic dependency.**

### 2.7 Save BOM as template

**New table:** `bom_templates`

```sql
CREATE TABLE IF NOT EXISTS bom_templates (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  description text DEFAULT '',
  items       jsonb NOT NULL,  -- [{product_id, product_name, qty, notes}]
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
```

- RLS: staff-only (same `rlslock_*` pattern as other tables)
- Items reference `product_id` (FK not enforced at DB level since jsonb, validated in app)
- Pre-loaded sample BOMs stored as seed data or hardcoded defaults

### 2.8 BOM → Purchase Order draft

**Flow:**
1. After BOM check, user clicks "Create PO for missing items"
2. System collects all lines with status `outofstock` / `insufficient` / `notfound`
3. For `notfound` items: skip (no product_id to reference)
4. For `outofstock`: `qty_to_order = needed - available`
5. For `insufficient`: `qty_to_order = needed - available`
6. Opens the existing PO creation form with items pre-filled
7. User selects supplier, reviews, saves

**Implementation:** Reuse existing PO creation flow from `/inventory/purchase-orders/page.tsx`. Pass items via query params or a shared state store.

### 2.9 Supplier info per BOM line

For each matched product, show linked suppliers from `spare_supplier` → `suppliers`:
- Supplier name + phone (clickable `tel:` link)
- Helps technician call supplier directly for urgent parts

---

## 3. New files & routes

### 3.1 Routes

| Route | File | Purpose |
|---|---|---|
| `/inventory/bom-check` | `src/app/inventory/bom-check/page.tsx` | Main BOM checker page |
| `/api/bom-check` | `src/app/api/bom-check/route.ts` | AI summary server route |
| `/api/bom-templates` | `src/app/api/bom-templates/route.ts` | CRUD for saved BOMs |

### 3.2 Shared components

| Component | Purpose |
|---|---|
| `src/components/BomLineInput.tsx` | Single BOM line with product match dropdown + qty + status badge |
| `src/components/BomResultRow.tsx` | Result row showing match, stock, location, suppliers |
| `src/components/BomOrderList.tsx` | Order summary card for missing parts |

### 3.3 Sidebar link

In `src/app/RootClient.tsx` → `SidebarNav`, add under the "Inventory" `SubMenu`:
```tsx
<BomIcon size={12} className="text-amber-400" />
BOM Check
```
Route: `/inventory/bom-check`, guarded by `canSeeInventory` (admin/staff).

---

## 4. Data flow

```
Technician pastes BOM text
         │
         ▼
┌─────────────────────┐
│  Client-side parse   │  parseBOM() — splits lines, extracts name + qty
│  + fuzzy match       │  matchItem() — scores against product_list
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Supabase queries    │  product_list (active, not deleted)
│  (parallel)          │  inventory_list (stock-in)
│                      │  transaction_products (job deductions)
│                      │  direct_sale_items (sale deductions)
│                      │  product_locations (via /api/locations/by-product)
│                      │  spare_supplier → suppliers (linked suppliers)
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Compute stock +     │  Reuse stockStatus() from src/lib/inventory.ts
│  status per line     │  Location via locPath() from src/lib/locations.ts
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Render results      │  Summary cards + line-by-line table + order list
└─────────┬───────────┘
          │
          ▼  (user clicks "Check with AI")
┌─────────────────────┐
│  POST /api/bom-check │  Builds prompt with all results
│  → Gemini / Groq     │  Calls getChatResponse() or getGroqChatResponse()
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  AI summary shown    │  Hinglish response: can start? order what? substitutes?
└─────────────────────┘
```

---

## 5. Phased implementation

### Phase 1 — Core BOM Checker (MVP)

**Scope:** Input → match → stock check → status display

**Files to create:**
- `src/app/inventory/bom-check/page.tsx` — main page
- DB: no new tables needed

**Files to modify:**
- `src/app/RootClient.tsx` — add sidebar link under Inventory

**What it does:**
1. Textarea for BOM input (multi-line, one component per line)
2. Project name input (optional)
3. "Sample BOMs" quick-load buttons (3 presets: 555 circuit, Arduino sensor, motor driver)
4. Parse lines → match against `product_list` using name/description/barcode
5. Compute live stock per line using the 4-query pattern
6. Display: summary cards + line-by-line table with status badges, stock info, locations
7. Order list card for missing parts (static, no PO creation yet)
8. Supplier info per matched line

**Estimated scope:** ~500-700 lines (single page component, no API routes yet)

---

### Phase 2 — AI Summary + Server Route

**Scope:** AI-powered analysis of BOM results

**Files to create:**
- `src/app/api/bom-check/route.ts` — POST endpoint

**What it does:**
1. Server route receives BOM results JSON
2. Builds prompt with project name + per-line stock data
3. Calls `getChatResponse()` (Gemini) or `getGroqChatResponse()` (Groq) via `getAiSettings()`
4. Returns Hinglish summary: can project start? urgent orders? substitutes?
5. Client shows "AI Analysis" card with the response

**Estimated scope:** ~80 lines (API route) + ~50 lines (client integration)

---

### Phase 3 — Saved BOM Templates

**Scope:** Save/load reusable BOM lists

**Files to create:**
- `src/app/api/bom-templates/route.ts` — GET (list) + POST (create)
- `src/app/api/bom-templates/[id]/route.ts` — GET (single) + PUT (update) + DELETE
- New migration: `bom_templates` table + RLS policies

**Migration (additive, idempotent):**
```sql
CREATE TABLE IF NOT EXISTS bom_templates (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  description text DEFAULT '',
  items       jsonb NOT NULL DEFAULT '[]',
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE bom_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY rlslock_bom_templates ON bom_templates
  USING (is_frontend_staff()) WITH CHECK (is_frontend_staff());

CREATE INDEX idx_bom_templates_name ON bom_templates (name);
```

**What it does:**
1. "Save as Template" button → modal with name + description
2. Saved to `bom_templates` with items JSON
3. "Load Template" dropdown → lists saved BOMs
4. Click template → populates BOM input textarea
5. Edit/delete templates

**Estimated scope:** ~150 lines (API routes) + ~100 lines (client) + migration

---

### Phase 4 — BOM → Purchase Order Draft

**Scope:** Auto-create PO from missing parts

**Files to create:** none (reuses existing PO page)

**Files to modify:**
- `src/app/inventory/bom-check/page.tsx` — add "Create PO" button
- `src/app/inventory/purchase-orders/page.tsx` — accept pre-filled items from query/state

**What it does:**
1. "Create PO for missing items" button appears when issues exist
2. Collects outofstock + insufficient lines (skips notfound)
3. Computes `qty_to_order = needed - available`
4. Navigates to PO creation with items pre-filled (via URL params or sessionStorage)
5. User picks supplier, reviews, saves PO

**Estimated scope:** ~80 lines (bom-check modifications) + ~50 lines (PO page modifications)

---

### Phase 5 — Job → BOM integration (future)

**Scope:** Auto-fill BOM from past jobs / create BOM from job template

**Concept:**
- On job creation page (`/jobs/new`), add "Load BOM Template" option
- If a saved BOM exists for this repair type, pre-fill the spare parts
- After job completion, optionally save the parts list as a new BOM template

**This phase is speculative** — depends on whether technicians repeat the same component sets frequently.

---

## 6. Dependency graph

```
Phase 1 (Core BOM Checker)
    │
    ├──▶ Phase 2 (AI Summary)         — depends on Phase 1 results format
    │
    ├──▶ Phase 3 (Saved Templates)    — depends on Phase 1 UI
    │
    └──▶ Phase 4 (→ PO Draft)         — depends on Phase 1 + existing PO system
            │
            └──▶ Phase 5 (Job → BOM)  — depends on Phase 3 + job system
```

- Phases 2, 3, 4 are **independent of each other** (all depend on Phase 1 only)
- Phase 5 is the most speculative and furthest out

---

## 7. Key design decisions

### 7.1 Matching: client-side or server-side?

**Client-side.** The `product_list` table is small (typically <500 rows for a repair shop). Fetch all active products once, match in browser. No server round-trip for matching. Server only called for AI summary.

### 7.2 Stock computation: client-side or RPC?

**Client-side (initially).** Reuse the existing 4-query pattern from `jobs/new/page.tsx`. This matches the established codebase convention. If Initiative 1 from `inventory_improvements_plan.md` (single stock RPC) ships first, migrate to that RPC instead.

### 7.3 AI provider

**Reuse existing Gemini/Groq stack.** No new provider. Route calls `getAiSettings()` to determine which provider/key/model is configured. Same pattern as `/api/chat`.

### 7.4 Separate page or embedded widget?

**Separate page** at `/inventory/bom-check`. Reasons:
- It's a multi-step workflow (input → check → review → act)
- Needs its own URL for sharing/bookmarking
- Fits naturally under the Inventory sidebar section
- Can be a standalone tool even outside a specific job context

### 7.5 File upload scope

**Phase 1: text paste only.** File upload (CSV/TXT) is a nice-to-have but not essential — technicians can paste from WhatsApp/email. Can add in Phase 2 or later.

---

## 8. RLS / data-safety guardrails

- **All new tables** follow existing pattern: `CREATE TABLE IF NOT EXISTS`, `ENABLE ROW LEVEL SECURITY`, staff-only `rlslock_*` policies via `is_frontend_staff()`.
- `bom_templates` is additive — zero impact on existing tables.
- No existing table is modified or deleted.
- The BOM checker is **read-only** against inventory data — it never writes to `product_list`, `inventory_list`, or any stock table.
- PO creation (Phase 4) rewrites are handled by the existing, tested PO flow.
- AI summary uses service-role Supabase (same as `gemini-tools.ts`) for data fetching inside the prompt context.

---

## 9. Acceptance criteria

### Phase 1
- Pasting a BOM of 10 components → all 10 lines matched with correct stock status
- Unrecognized component → shown as "Not in catalog" with clear message
- Summary cards show correct counts (total / available / issues / can-start)
- Order list shows all out-of-stock and insufficient items with deficit quantity
- Supplier phone shown for each matched product
- Location shown for each matched product (from `locPath()`)
- Sidebar link visible for admin/staff roles only

### Phase 2
- Clicking "Check with AI" → Hinglish summary within 5 seconds
- Summary correctly reflects: can start / what to order / substitutes
- Falls back gracefully if AI API is down (shows "AI summary unavailable")
- Uses Gemini or Groq based on system_info settings

### Phase 3
- Save BOM → listed in "Load Template" dropdown
- Load template → textarea populated with saved components
- Delete template → removed from list
- Templates survive page refresh (persisted in Supabase)

### Phase 4
- Click "Create PO" → navigates to PO page with missing items pre-filled
- Quantities correct: `qty_to_order = needed - available`
- User can modify before saving PO
- PO saved via existing flow (no changes to PO schema)

---

## 10. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Fuzzy matching misses parts | Technician sees false "not found" | Use multi-signal matching (name + description + first-token + barcode); show suggestions |
| AI API latency / downtime | Feature feels broken | Graceful fallback message; AI is optional enhancement, not blocking |
| Large BOM (50+ lines) performance | Slow client-side stock queries | Batch all product IDs in single query set; 4 parallel Supabase calls regardless of BOM size |
| Technician enters wrong part name | Wrong stock shown | "Did you mean...?" suggestions from top fuzzy matches |
| Saved templates become stale | Product deleted but template references it | On load, validate product_ids still exist; show warnings for stale entries |

---

## 11. Decisions needed from you

1. **Phase priority:** Ship Phase 1 (core) first, then which of 2/3/4 next? My recommendation: Phase 2 (AI) since it differentiates the feature.
2. **Sample BOMs:** Use the 3 from the reference code (555 Astable, Arduino Sensor Node, Motor Driver) or different ones for your shop's typical work?
3. **Location display:** Show full path (Zone > Rack > Bin > Box) or short path (Bin > Box)?
4. **Integration with `/reports/requirement-list`:** Should BOM-missing items also appear in the existing requirement list report? Or keep them separate?
5. **Standalone vs in-job:** Should this also work inside the job creation page (`/jobs/new`) as a quick-check panel, or only as a standalone page?
