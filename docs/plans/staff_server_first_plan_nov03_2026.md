# Staff Server-First — Remaining Routes Plan (3 Nov 2026)

**Status:** DONE (3 Nov 2026) — all 44 routes seeded; gates green
**Scope owner:** V-Tech admin
**Hard constraints (unchanged):**

- Live DB hai — **zero** DB writes, zero test rows, zero schema/index/view/RPC change.
- Server reads sirf `getServerSupabase()` (cookie + RLS). **Service-role page reads banned.**
- Public no-login job tracking intentional — chhedna nahi.
- Commit/push is plan me included nahi (alag explicit approval).

---

## 1. Goal

Audit (3 Nov 2026) ke mutabik staff-facing **27 routes already server-first** hain.
Baaki **44 staff-accessible routes** abhi client-first hain — mount ke baad
`supabase.from(...)` / `useQuery` / API fetch chalta hai, isliye first paint
loading state dikhata hai.

Is plan me un sabhi 44 routes ko **server-seeded first paint** dena hai —
wahi established pattern jo Jobs P1–P3, Clients C-P0..P3, Dashboard, Payments,
Expenses, Mechanics, Suppliers aur 6 reports me already use ho raha hai.

Success = har route ka pehla HTML data ke saath aata hai; filter/action change
par purana client path hi chalta hai (koi regression nahi).

---

## 2. Architecture (existing pattern, reused)

1. **Route `layout.tsx` (server, `dynamic = "force-dynamic"`)**
   - `requireStaffWithRole()` → `null` par `/login` redirect.
   - `loadStaffSeed(label, loader)` helper: `getServerSupabase()` + try/catch →
     failure par `null` (page apna client fetch chalayega).
   - Seed ko generic `ServerSeedProvider` me daalta hai.

2. **`ServerSeedProvider` + `useServerSeed<T>(key)`** (new, client)
   - Nested providers merge karte hain, isliye har route apni key add karta hai.
   - Seed `null` ho to page bilkul purane behaviour par chalta hai.

3. **Client page me minimal change**
   - `useState(seed ? seed.data : initialEmpty)`.
   - `loading = !seed`; initial `useEffect` me `if (seed) return;`.
   - React Query pages: `initialData: seed` (default filters par hi).
   - Default filter check: seed sirf default URL/filter par use hota hai,
     non-default par client fetch (jaisa aaj hai).

4. **Server-wrapper pages** (`reports/delivered|ledger|vyapar-darpan`,
   `direct-sales/new`) already server components hain — unme data fetch karke
   client child ko `initial*` props denge (split ki zarurat nahi).

5. **Neutral rule:** server-side code kabhi `@/lib/supabase` (browser singleton)
   import nahi karega; sirf `api-auth` / `SupabaseClient` type.

---

## 3. Waves (44 routes)

### Wave A — Direct Sales + Advance (4 routes)

| Route                     | Seed                                                                            |
| ------------------------- | ------------------------------------------------------------------------------- |
| `/direct-sales/new`       | clients + mechanics + products + user role (server wrapper se `SaleForm` props) |
| `/direct-sales/[id]/view` | sale + items + client + mechanic                                                |
| `/direct-sales/[id]/edit` | same draft (existing form reuse)                                                |
| `/advance`                | mechanics + current-month advance rows (default filters)                        |

### Wave B — Mechanics (4 routes)

| Route                    | Seed                                          |
| ------------------------ | --------------------------------------------- |
| `/mechanics/[id]`        | mechanic + duties + commission/salary summary |
| `/mechanics/[id]/ledger` | mechanic + ledger rows (default month)        |
| `/mechanics/ledger/[id]` | salary/commission ledger detail               |
| `/mechanics/commission`  | mechanics + commission rows (default month)   |

### Wave C — Products / Inventory staff surfaces (8 routes)

| Route                        | Seed                                           |
| ---------------------------- | ---------------------------------------------- |
| `/products`                  | product_list (+ role) — staff-allowed page     |
| `/inventory/locations`       | locations + rack/zone + counts (staff-allowed) |
| `/inventory/locate`          | locations + products                           |
| `/inventory/stocktake`       | products + stock RPC                           |
| `/inventory/bom-check`       | products + BOM templates                       |
| `/inventory/[id]`            | product + stock + PO links                     |
| `/inventory/box-labels`      | locations + products (API-backed → DB seed)    |
| `/inventory/purchase-orders` | PO list + suppliers                            |

### Wave D — Reports (19 routes)

Client-first (16): `activity`, `custom-sales`, `custom-service`, `daily-income`,
`due-reminders`, `financial-report`, `loan`, `monthly-sales`, `oversold`,
`parts-pending`, `requirement-list`, `stock-valuation`, `supplier-dues`,
`supplier-purchases`, `top-customers`, `yearly`.
Server-wrapper but client-fetch (3): `delivered`, `ledger`, `vyapar-darpan`.

Seed = **default date range (current month / today)**, wahi query jo client
default par chalata hai. Non-default filters par client fetch.

### Wave E — Ops / misc (5 routes)

`activity-logs`, `inquiries`, `messages`, `attendance`, `profile`.

### Wave F — Clients (2 routes)

`/clients/new`, `/clients/[id]/add-direct-sale`.

### Wave G — Jobs legacy (2 routes)

`/jobs/old`, `/jobs/[id]/old` (pehle owner decision se deferred the; is plan me
include kiya gaya hai).

---

## 4. Explicitly excluded (staff ke liye nahi)

- **Admin-only:** `estimates`, `client-loans`, `clients-admin`, `lenders`,
  `services`, `suppliers`, `suppliers/[id]`, `inventory` (server guard),
  `inventory/locations/manage`, `inventory/purchase-orders/[id]`,
  `reports/balancesheet`, `reports/client-payment|daily-sales|daily-service|
technician-performance`, `reports/outside-work`, `settings/*`, `users/*`,
  `images`, `developer`, `sync`, `backup`, `back-office/db-tools`.
- **Client-role portal:** `my-account*`.
- **Static hubs / redirects:** `reports` (index), `back-office`,
  `direct-sales/[id]` (redirect).
- **Interactive-only:** `/ai` (chat UI, first-paint seed ka scope nahi).
- **Public:** `(public)/*`, `/`, `/login`, `/setup`.

---

## 5. Verification gates (har wave ke baad)

1. `npx tsc --noEmit`
2. `npx eslint <touched files>`
3. `npm test` (589+ tests, existing suite green)
4. `npx prettier --check <touched files>`
5. `npm run schema:drift`
6. `npm run build`
7. Smoke (unauth): har naya route `307 /login`; `/api/health` `200`.
8. **Write audit:** naye code me `insert|update|delete|upsert|rpc(write)` = 0.
   Sirf `select` queries allowed. Zero DB writes.

Build ke baad tsc dobara (Next route types regenerate hone ke baad) — known
TS2344 stale `.next/types` issue ka fix.

---

## 6. Risks / rollback

- **Risk:** seed shape client shape se mismatch → page empty dikh sakta hai.
  Mitigation: seed optional hai; `null` par purana fetch; default-filter guard.
- **Risk:** layout har navigation par extra server query karta hai.
  Mitigation: sirf default seed, bounded row limits, `Promise.all` waves.
- **Risk:** RLS ne kuch rows block kiye → server me kam data. Mitigation:
  whi cookie+RLS client, client fetch fallback.
- **Rollback:** wave ke files revert (page/layout/seed helper) — koi DB change
  nahi hone ka isliye data safe.

---

## 7. Result log

| Wave                       | Routes | Status                                                                                            |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| A — Direct Sales + Advance | 4      | done — `tsc`/`eslint`/`build` green                                                               |
| B — Mechanics              | 4      | done — `tsc`/`eslint` green                                                                       |
| C — Products / Inventory   | 8      | done — `tsc`/`eslint`/`build` green                                                               |
| D — Reports                | 19     | done — all seeded; `tsc`/`eslint`/`vitest`/`prettier`/`schema:drift`/`build` + unauth smoke green |
| E — Ops / misc             | 5      | done — same gates                                                                                 |
| F — Clients                | 2      | done — `add-direct-sale` seeded; `/clients/new` audit-only no-op                                  |
| G — Jobs legacy            | 2      | done — shared `jobsOldSeed.ts`; same gates                                                        |

### Final gate run (3 Nov 2026)

- `npx tsc --noEmit` clean (post-build, route types regenerated).
- `npx eslint` clean on all touched files.
- `npm test` — 589 passed / 54 files.
- `npm run schema:drift` — OK (24 migrations).
- `npx prettier --check` — clean on changed files (pre-existing CRLF files excluded).
- `npm run build` — success; every seeded route `ƒ` (dynamic) in build manifest.
- Unauth smoke — 13 sampled routes (incl. `/activity-logs`, `/attendance`,
  `/inquiries`, `/messages`, `/profile`, `/jobs/old`, `/jobs/123/old`,
  `/clients/123/add-direct-sale`, reports) → `307 /login`; `/api/health` → `200`.
- Zero-write audit — no `insert|update|delete|upsert` in any `*Seed.ts`; only
  read-only `get_inventory_stock` RPC. No client-only imports in seed modules.

### Implementation notes (non-obvious)

- **Default-view-only seeding:** server seeds sirf default filters (today /
  current month / `status=all`). URL params ya non-default filter par client
  apna purana fetch chalata hai (`seedReady` guard).
- **`/clients/new`** — new mode me koi first-paint fetch hi nahi (master fetch
  sirf `isEdit` par chalta hai), isliye seed ki zarurat nahi; sirf audit note.
- **`/jobs/old` + `/jobs/[id]/old`** — shared neutral `jobsOldSeed.ts`; seed me
  `userRole`/`userMechId` bhi hai (Assign Technician panel pehle paint par).
- **`/messages`** — default directory (profiles/presence/conversations) seed;
  `?to=` chat history abhi bhi client-side fetch hoti hai.
- **`activity` / `activity-logs`** — `users` RLS block hone par name fallback
  `User <id>` (client behaviour same).
- **Reports** — `delivered`, `ledger`, `vyapar-darpan` server wrappers ab data
  fetch karte hain (`*Seed.ts` / `fetchVyaparData`), pehle sirf pass-through the.
- `due-reminders` / `supplier-*` / inventory-based reports neutral modules me
  inline math use karte hain jahan client helper client-only tha.
