# Inventory System — Master Improvement & BOM Plan

> Status: **PLAN / DESIGN ONLY** — no code written.
> This is a single, merged, ordered plan built from two prior design docs:
>   1. `inventory_improvements_plan.md` (system-wide upgrades)
>   2. `bom_checker_plan.md` (BOM auto-check feature)
> It reconciles their overlapping concerns (single stock formula, PO partial
> receipt, RLS patterns) into one dependency-ordered timeline so we build the
> strongest foundation first and never duplicate effort.
> Existing doc `bom_checker_plan.md` retains its full detail as the BOM feature
> spec; this document is the **master sequencing** that decides what to build
> and in what order, and references it.

---

## 0. The shared foundation (why this order)

**Today, available stock is derived in the client, not stored:**

```
available = Σ inventory_list.quantity
          − Σ transaction_products.qty  (jobs, status ≠ 4 /cancelled)
          − Σ direct_sale_items.qty
```

This formula is **re-implemented manually in ≥5 places**, not all through the
canonical helper `aggregateStock()` (`src/lib/inventory.ts:75-106`):

| Location | Manual copy |
|---|---|
| `src/app/direct-sales/components/SaleForm.tsx` | `:211-259` |
| `src/app/(dashboard)/dashboard/page.tsx` | `:486-628` |
| `src/app/reports/requirement-list/page.tsx` | `:60-125` |
| `src/app/inventory/[id]/page.tsx` | `:180-309`, `:427-470` |
| `src/lib/inventory.ts` | `:75-106` (canonical) |

Both plan docs independently depend on this formula (BOM checker computes per-line
stock; PO/reorder computes `need_to_order`). Therefore **Initiative 1 (single stock
source) is the prerequisite** — it makes every downstream feature correct and DRY.

---

## 1. One timeline, five workstreams

Each workstream is independently shippable, but the **dependency chain below** is
the load-bearing constraint. We do NOT build a feature on top of a duplicated formula.

```
I1  Single stock source (RPC + client helper)          [FOUNDATION — do first]
 │
 ├────────────┬──────────────────────┬────────────────┐
 │            │                      │                │
I2          I3                     I4               I5
Stocktake   BOM Checker           PO Workflow       Oversell visibility
& adjust    (from bom_checker)    (partial+reorder)  + report
 │                                        │
 └──────────► feeds reorder / PO ──────────┘
 │
I6  Valuation report + location data-model cleanup  [LAST — touches dual location model]
```

Why this order:
- **I1** first — eliminates the duplicated-formula drift that all later work reads.
- **I2, I3, I4, I5** are independent once I1 lands (each can proceed).
- **I6** last — valuation + `place*` legacy-column retirement is the widest blast
  radius and should only happen on a provably-stable stock base.

---

## 2. Initiative details

### I1 — Single stock source (FOUNDATION)
- **Status ✓ DONE** — shipped as `20260903_inventory_single_stock_rpc.sql` (live on main
  Supabase; idempotently folded into `20260913_final_full_schema_idempotent.sql`).
  - DB RPC `get_inventory_stock(p_product_ids int8[] DEFAULT NULL)` live; anon + authed
    both verified via REST (returns `total_in, total_sold_job, total_sold_sale,
    total_sold, available, oversold, avg_purchase_cost, last_stock_date, place`).
  - Client helper `src/lib/inventoryStock.ts` → `fetchStockByProducts(ids)` wraps the
    RPC (sends `p_product_ids`). All 4 manual call sites re-pointed:
    `requirement-list`, `dashboard` low-stock, `inventory` list page (PO-link kept
    client-side), `SaleForm` direct-sale (edit-mode correction preserved). `inventory/[id]`
    detail left as ledger/history view (RPC N/A by design).
  - Bugfixes during testing: RPC arg name `p_product_ids` (PGRST202 → `{}` error) fixed
    in helper; locations fetch made fail-safe so anon/unauth never blanks the list.
  - Verified: `tsc --noEmit` clean, `eslint` clean, 18/18 inventory tests pass.
- **DB:** new RPC `get_inventory_stock(product_ids int8[] DEFAULT NULL)` returning
  per-product `total_in, total_sold, available, oversold, place` (job = non-cancelled).
- **App:** re-point all 4 manual call sites + the BOM checker to this RPC (server-side,
  service-role, so RLS anon limitations don't bite). Keep `aggregateStock()` as the
  client fallback only.
- **Also installs the average-cost basis** for I6: RPC returns `avg_purchase_cost`
  per product from `inventory_list.purchase_cost`.
- **Why prerequisite:** BOM `bom_checker_plan.md §7.2` explicitly says "migrate to that
  RPC instead" once it ships. This resolves that pending decision now.

### I2 — Stocktake & stock adjustment (biggest functional gap)
- **Status ✓ DONE** — shipped as isolated additive migration
  `20260914_stocktake_stock_adjustment.sql` AND (per user's later instruction
  "full schema ko bhi idempotent add kar dena") folded idempotently into the
  consolidated `20260913_final_full_schema_idempotent.sql`, plus
  `/inventory/stocktake` admin page. **Live on main Supabase** (REST confirms
  `stock_counts`/`stock_adjustments` exposed + `record_stocktake` RPC registered).
  - DB: `stock_counts` + `stock_adjustments` (reason CHECK ∈ shrinkage/damage/
    correction/return), RLS staff-only via `is_frontend_staff()` (anon = 0),
    atomic `record_stocktake(...)` SECURITY DEFINER RPC that computes live
    `available` from I1, writes a +/− reconciliation row into `inventory_list`
    (negative allowed — no CHECK) + both ledger tables in one transaction.
  - Validated on local PG18: fresh apply clean, idempotent re-run exit 0 +
    zero data loss, +7 correction and −5 shrinkage both correct, invalid reason
    rejected, anon denied, RLS-hides, `@pgsql/parser` 32 stmts OK.
  - App: admin-only page shows derived available, counted-qty + reason + delta
    preview, save → RPC → `logActivity` → recent-adjustments list.
  - Verified: `tsc --noEmit` clean, `eslint` clean (stocktake page), my nav edits
    lint-clean (pre-existing RootClient ref warnings untouched).
Confirmed: grep finds **no** stock-count / adjust / physical-count feature anywhere.
Only stock mutations today are stock-in modal, PO receive, delete row, indirect sales/jobs.
- **DB (new, additive):**
  - `stock_counts (id bigint id, product_id, counted_qty int, counted_at timestamptz,
     counted_by uuid→profiles, note text, created_at)`.
  - `stock_adjustments (id, product_id, delta int, reason text, remark, created_at,
     created_by)`; `reason` CHECK ∈ `{shrinkage, damage, correction, return}`.
  - RLS: staff-only `rlslock_*` via `is_frontend_staff()`, anon = 0.
- **App:** `/inventory/stocktake` page — staff enters counted qty; UI shows derived
  available + computed delta; save writes a `stock_adjustments` ledger row **and**
  reconciles `inventory_list` so the formula reflects physical reality **without
  deleting history**. No silent `DELETE`/overwrite.
- Reads live stock through **I1** — this is the core reason I1 precedes I2.

### I3 — BOM Checker (from `bom_checker_plan.md`)
- **Status ✓ DONE (Phase 1 + 2)** — shipped as `src/app/inventory/bom-check/page.tsx`
  (new, untracked) + nav link in `RootClient.tsx` (Inventory → "BOM Check"). No DB
  migration needed (read-only against existing tables).
  - Phase 1: multi-line paste (name/qty formats: `- N`, `Nx Name`, `Name (N)`,
    trailing digit), match against `product_list` (exact → substring → first-token →
    barcode → description, score-based), **live stock via `fetchStockByProducts` (I1)**,
    5-state status (available/low/insufficient/outofstock/notfound) + deficit, summary
    cards (total/available/issues/can-start Go|Hold), supplier lookup via
    `spare_supplier`→`suppliers`, 3 sample BOM presets.
  - Phase 2: **AI Hinglish summary reuses existing `/api/chat` route** (staff-gated,
    provider-aware, auto live-context) — no duplicate AI server route. Button shown
    when issues exist; prompt builds per-line need/have/deficit grouped by status.
  - Verified: `tsc --noEmit` clean, `eslint` clean on the new page. RootClient my-edits
    add import + link + predicate only; its pre-existing react-ref lint errors at
    L1382/1385 untouched.
- **Full spec:** `docs/plans/bom_checker_plan.md` (phases 1–5, UI patterns, matching
  logic, acceptance criteria).
- **Ordering note:** Phase 1 (core checker) stock read uses **I1**, not the old
  4-query copy. Phases 2 (AI), 3 (templates), 4 (PO draft), 5 (job→BOM) then follow.

### I4 — PO workflow (partial receipt + auto-reorder) — ✓ DONE
- **Partially-received state:** `purchase_orders.status` CHECK now allows
  `partially_received` (guarded drop+recreate). Receiving is per-item via a new
  atomic SECURITY DEFINER writer RPC `receive_po_receipt(po_id, jsonb lines)`;
  each line's received qty is validated ≤ outstanding (`qty_ordered − qty_received`)
  **server-side** — over-receipt raises an error. Writes `inventory_list` stock-in
  rows + bumps `purchase_order_items.qty_received` + sets status
  `partially_received` (any open) or `received` (all in), stamps `received_date` once.
  App: `purchase-orders/page.tsx` got a per-item "Receive" modal (opens for both
  `ordered` and `partially_received`), new status chip/filter; the old all-or-nothing
  client insert (`receiveStock`) was replaced by the RPC.
- **Auto-reorder:** `requirement-list/page.tsx` now has a **Create PO** button that
  builds a draft from `need_to_order` (qty) + `price` (unit_cost) into
  `sessionStorage`, then opens the PO create modal prefilled
  (`/inventory/purchase-orders?create=draft`). Also feeds I3's "PO for missing".
- **Defensive:** validated server-side in the RPC (over-receipt rejected) + staff-only
  gate (`is_frontend_staff()`), not just the UI.
- **Validated on PG18:** fresh consolidated apply exit 0; constraint includes
  `partially_received`; 2-step partial→full receive works; inventory rows correct;
  over-receipt + non-staff both rejected; isolated re-run idempotent.

### I5 — Oversell visibility
Keep the allow-over-sell rule (`SaleForm.tsx:310-311, 376-377`) but:
- Amber inline warning + confirm when a line goes negative at sale time.
- New **Oversold / Negative Stock** report so management can separate deliberate
  oversell from shrinkage/typo.

### I6 — Valuation report & location data-model cleanup (LAST)
- **Stock valuation report:** Σ(available × avg purchase_cost) per location
  (zone→rack→bin→box), drillable. Data present in `inventory_list.purchase_cost`;
  avg cost surfaced by **I1**.
- **Data-model cleanup:** retire legacy `place*` columns from `inventory_list`
  in favor of canonical `product_locations`/`locations`. Must be additive + verified
  against the consolidated idempotent migration.

---

## 3. RLS / data-safety guardrails (non-negotiable, both plans agree)

- All new tables: `CREATE TABLE IF NOT EXISTS`, `ENABLE ROW LEVEL SECURITY`,
  staff-only `rlslock_*` policies via `is_frontend_staff()`, anon = 0.
- All DB changes go into a **new, isolated, additive migration file** —
  do NOT edit the existing `20260913000000_final_full_schema_idempotent.sql`,
  keeping that carefully-validated deliverable intact.
- New migration must be idempotent + re-run safe + zero data loss (same rules).
- `stock_adjustments` never does `DELETE`/`TRUNCATE`; corrections are new ledger rows.
- BOM checker is **read-only** against inventory (never writes to stock tables).
- PO partial-receipt rewrites reuse the existing, tested PO flow.
- Follow `docs/DATA_MIGRATION_NOTES.md` dual-era conventions when reading old data.

---

## 4. Acceptance criteria (per workstream)

- **I1:** ✅ dashboard / direct-sale / requirement-list / inventory all agree on one number
  for a known product (all re-pointed to `get_inventory_stock`); RPC live-tested via REST.
  `inventory-detail` excluded by design (ledger/history view).
- **I2:** ✅ after a physical-count adjustment, re-deriving stock matches the counted
  value (verified +7/−5 on PG18); history ledger complete; RLS verified (anon = 0).
- **I3:** per `bom_checker_plan.md §9` (10-component BOM matches, AI summary in ≤5s,
  templates persist, PO pre-fill quantities correct).
- **I4:** a PO can be received in two partial steps; outstanding balance persists;
  draft PO created from requirement list.
- **I5:** overselling a line shows the amber warning; negative-stock report lists them.
- **I6:** valuation report correct vs `inventory_list`; `place*` removed only after
  backfill verified.

---

## 5. Decisions needed from you

1. **Where to start:** I1 (recommended) is the foundation — do it first. Agree?
2. **I3 priority:** build BOM checker alongside, or after I2 stocktake?
   Recommendation: I1 → I2 → I3, but I3 Phase 1 is quick and high-visibility if you
   want early wins.
3. **BOM templates scope — Phase 3 now or later?** (`bom_checker_plan.md §5`).
4. **Oversell:** keep allowed-by-default, or add a per-product "allow oversell" flag (I5)?
5. **DB delivery:** confirm all new objects go in one **new** additive migration file
   (separate from the consolidated one). Recommended = yes.
6. **Sample BOMs** for I3 Phase 1: reuse the 3 presets from `bom_checker_plan.md`, or
   match your shop's typical work?

---

## 6. Revised standing deliverable

| File | Purpose |
|---|---|
| `docs/plans/inventory_improvements_plan.md` | THIS master sequencing doc |
| `docs/plans/bom_checker_plan.md` | Full BOM feature spec (unchanged) |
| `supabase/migrations/20260903_inventory_single_stock_rpc.sql` | I1 RPC (live) |
| `supabase/migrations/20260914_stocktake_stock_adjustment.sql` | I2 stocktake (isolated, live) |
| `supabase/migrations/20260915_po_partial_receipt.sql` | I4 partial receipt (isolated, live) |
| `supabase/migrations/20260913000000_final_full_schema_idempotent.sql` | Consolidated deliverable (I1 + I2 + I4 folded in) |

**Delivery rule (recorded):** each initiative ships in a **new isolated additive
migration file**; the user ALSO instructs the objects to be folded idempotently into
the consolidated `20260913_..._full_schema_idempotent.sql` ("full schema ko bhi
idempotent add kar dena") — validated re-run safe + zero data loss. So the operative
rule now: **isolated file + consolidated fold-in for every initiative** (I1, I2 and I4
all followed this).

Application code: `/inventory/stocktake` (I2) + `src/lib/inventoryStock.ts` (I1)
+ `/inventory/bom-check` (I3 P1+P2, reuses `/api/chat`) + `purchase-orders/page.tsx`
receive modal & `requirement-list/page.tsx` Create-PO draft (I4).