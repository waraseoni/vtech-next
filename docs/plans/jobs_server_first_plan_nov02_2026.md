# Jobs Server-First Speed Plan (2026-11-02)

> **Status: DONE (2026-11-02) — P0 + P1 + P2 implemented, gates green.**
> **Rule: DB LIVE hai — koi schema/index/view/RPC/column/write NAHI. Sirf reads +
> transport/execution placement badalna hai.**
>
> **Goal:** `/jobs` ke saare high-traffic surfaces ko v2 jaisa "instant first
> paint" dena — features kaate bina. v2 fast hai kyunki uska data path chhota
> hai (2-wave server fetch) aur features kam hain; v1 me wahi speed seed +
> parallel + payload diet se aayegi.

---

## 1. Aaj ka state (audit)

| Surface                       | First paint      | Data path                                                                                                                                                    | Gap                                                                                                                            |
| ----------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `/jobs` list                  | **Server-first** | RSC seed: 25 rows + exact stats + spots + open-part counts + firm info + mechanic names                                                                      | Filters/pagination client (expected); **filter `router.push` ek poori extra RSC fetch chalata hai jiska seed ignore hota hai** |
| `/jobs/[id]`                  | Server redirect  | `/jobs/[id]/view`                                                                                                                                            | —                                                                                                                              |
| `/jobs/[id]/view`             | **Client-first** | `jobViewOptions` — 4 sequential waves (job+profiles → prev/next → 9 parallel detail → name lookups), phir activity log + `/api/activity-users` + system info | Sabse bada waterfall: pehla paint ke liye 3-4 RTT                                                                              |
| `/jobs/new`                   | **Client-first** | Sequential: profile → clients → mechanics → services → products bundle → cancelled jobs; stock browser me compute                                            | ~7 sequential RTT + inventory/transaction_products/direct_sale_items ka poora payload browser ko                               |
| `/jobs/[id]/edit`             | **Client-first** | Same master load + job query                                                                                                                                 | Same                                                                                                                           |
| `/jobs/bulk`, `/bulk-edit`    | Client-first     | Apne queries                                                                                                                                                 | Medium                                                                                                                         |
| `/jobs/old`, `/jobs/[id]/old` | Client-first     | Legacy list/detail                                                                                                                                           | v2 me hai hi nahi                                                                                                              |
| `/jobs/combined-invoice`      | Client-first     | Client + jobs queries                                                                                                                                        | Medium                                                                                                                         |
| `/jobs/spot-labels`           | Client-first     | Jobs + spots                                                                                                                                                 | Client-only rendering, low risk                                                                                                |

---

## 2. "DB changes banned" ka matlab (honest answer)

Aaj hum DB se **rows** mangwate hain aur aggregation Node/browser me karte hain:

- `computeJobStats`: poore filtered dataset ko 1000-row chunks me DB se Node tak
  laakar count/sum karte hain.
- Available stock: `inventory_list` + `transaction_products` + `direct_sale_items`
  ke saare rows laakar browser me sum/subtract karte hain.

**Bina DB change ke jo ho sakta hai:**

1. Scan/aggregation **server par** shift karo → DB→server rows same rahenge, par
   server→browser payload tiny ho jayega (products with final stock number).
2. Sab queries **parallel** + per-request cache/dedupe → wall-clock RTT kam.
3. Seed se mount fetch hatao → perceived first paint instant.
4. Repeat scans par short in-process cache (TTL) — sirf read-only data.

**DB permission milne par (agar kabhi owner allow kare) extra kya milega:**

1. **Indexes** — `transaction_list(del_status, status, date_created, location_id,
job_id)` jaise composite indexes full-scan stats aur filtered list ko DB ke
   andar hi tez karenge (aaj Node tak rows aate hain).
2. **SQL aggregate RPC** — stats ek chhoti query me (`count(*) filter (...)`),
   hazaaron rows transfer nahi hongi. Yahi available-stock aggregate ke liye bhi.
3. **View/materialized view** — enriched list/detail ka join DB me; Node me
   multi-query merge nahi.
4. **Samay ke saath:** bade tables par scan cost DB→Node transfer aur Node CPU
   dono kam honge; chhote tables par farak kam dikhega.

Matlab: **DB permission se speed aur upar ja sakti hai, par aaj ka plan uske
bina hi bada hissa cover karta hai** — kyunki bottleneck browser payload +
sequential waterfall hai, na ki sirf Postgres scan.

---

## 3. Scope (is plan me)

### P0 — List page ka redundant RSC refetch hatao

**Problem:** filter handlers `router.push("?…")` karte hain. Ye naya RSC render

- `fetchJobsPageData` (25 rows + full stats scan + spots + parts) chalata hai,
  par `useJobList` ka seed sirf mount par adopt hota hai → naya seed **ignore**,
  aur client bhi apna fetch chala deta hai. Har filter change = double kaam.

**Fix:** same-route URL sync ke liye native History API
(`window.history.pushState`) — Next 16 isse `useSearchParams` ke saath integrate
karta hai aur server request nahi karta (verified in
`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`).
Applied to: date shift, desktop/mobile filter apply, reset, preview open/close.
Cross-page navigation (`/jobs/{id}/edit`) `router.push` hi rahega.

**Acceptance:** filter/preview actions par koi RSC request nahi; URL refresh-safe;
preview slide-over pehle jaisa kaam kare.

### P1 — Detail page (`/jobs/[id]/view`) server seed

**Fix:**

1. Neutral module `src/app/jobs/[id]/view/jobViewQueries.ts` — saari read queries
   (`fetchJobViewData(supabase, id, role)`), koi browser/server-only import nahi.
2. `src/lib/queries/job-view.ts` = thin client wrapper (auth role resolve) + wahi
   `jobViewOptions` + type re-exports (existing imports na tootein).
3. Route-level server `layout.tsx` — `requireStaffWithRole()` + cookie/RLS
   `getServerSupabase()` se snapshot fetch; failure = `null` seed (client aaj
   jaisa fetch karega).
4. Client `JobViewSeedProvider` context — page `useQuery` me `initialData`
   (sirf jab `seed.job.id === numId`). Global 30s staleTime already hai, isliye
   mount par duplicate fetch nahi; payments/actions ka `refetch()` intact.

**Acceptance:** view page first paint par job/client/mechanic/images/lines sab
present; network me duplicate initial job-view fetch nahi; seed fail → purana
client path.

### P2 — New/Edit master data + stock server seed

**Fix:**

1. Neutral `src/app/jobs/jobFormQueries.ts`:
   - `fetchJobFormMasters(supabase)` — clients/mechanics/services/products +
     inventory/sold/cancelled rows **ek Promise.all** me, phir pure
     `buildAvailableStock()` se final stock.
   - `resolveCurrentUser(supabase, authUserId)` — `profiles.mechanic_id`.
2. `src/lib/server-job-form.ts` — server seed (auth session + masters parallel).
3. Route-level layouts: `/jobs/new` aur `/jobs/[id]/edit` server seed +
   client `JobFormSeedProvider`.
4. Pages: lazy state init seed se; effect sirf fallback par purana load chalaye,
   aur fallback bhi **parallel** ho (7 sequential RTT → ~2). `?client_id=`
   auto-select dono modes me intact.
5. Stock numbers **exact same formula/query filters** — koi semantic change nahi
   (PostgREST default row cap bhi same rehta hai, isliye displayed values same).

**Acceptance:** new/edit form par dropdowns + stock pehle render me; no master
waterfall; fallback (seed null) par bhi pehle se tez; save flow unchanged.

---

## 4. Out of scope (separate plan)

- **P3:** bulk / bulk-edit / old / combined-invoice / spot-labels ka server seed.
- **P4:** list page par Suspense streaming (stats/spots/parts), row-hover
  prefetch, stale-jobs panel lazy-load.
- Koi bhi DB schema/index/view/RPC change (owner approval ke bina banned).
- Feature removal (legacy `old` routes owner decision).

---

## 5. Risks

| Risk                                      | Mitigation                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| Seed stale data                           | Server seed request-time par fresh; React Query 30s staleTime; actions `refetch()` karte hain |
| Seed/client drift (query semantics)       | Ek neutral module; client wrapper wahi function call karta hai                                |
| RSC payload bada (masters)                | Wahi rows jo aaj client fetch karta hai; product rows final stock ke saath compact            |
| Native history API se router state desync | Next 16 documented integration; URL refresh-safe; preview test                                |
| Auth/RLS regression                       | `requireStaffWithRole()` + cookie client; service-role NEVER page reads                       |
| Live DB                                   | Sirf `select`; koi write/test row nahi                                                        |

---

## 6. Verification gates

1. `npx tsc --noEmit`
2. `npx eslint` (touched files)
3. `npx vitest run` (existing suite + new pure stock-builder test)
4. `npm run build` (production)
5. Fresh prod server smoke: `/jobs`, `/jobs/new`, `/jobs/1/view`, `/jobs/1/edit`
   unauth → `/login` (307), API unchanged.
6. Static check: view/new/edit route trees me duplicate initial fetch nahi
   (code-level + build output).

---

## 7. Result (2026-11-02)

| Item | Kya badla                                                                                                                                                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0   | `JobsBody` ke 6 same-route URL sync calls `window.history.pushState` par — filter/date/reset/preview par server RSC refetch nahi. Cross-page nav `router.push` hi hai.                                                                                        |
| P1   | `jobViewQueries.ts` neutral extract; `job-view.ts` thin wrapper; server `view/layout.tsx` seed + provider; page state `seedSnap` se init aur React Query `initialData`. Detail ab 1 server wave + 2 dependency waves (pehle 4 client waves + activity/parts). |
| P2   | `jobFormQueries.ts` (types + pure `buildAvailableStock` + `fetchJobFormMasters`), `server-job-form.ts`, `new`/`[id]/edit` layouts + provider. Pages seed se init; fallback 7 sequential RTT → 1 wave. Stock formula byte-for-byte same.                       |

**Gates:** `tsc` clean, `eslint` clean, `vitest 584/584` (2 naye stock tests), production
`next build` green, fresh `next start` smoke — `/jobs`, `/jobs/new`, `/jobs/1/view`,
`/jobs/1/edit`, `/jobs/bulk`, `/jobs/old`, `/jobs/combined-invoice`, `/jobs/spot-labels`
sab unauth 307 `/login`. Zero DB writes.

**Pending user check:** authenticated admin se `/jobs` filter/preview (URL change par
network me RSC request nahi honi chahiye), `/jobs/{id}/view` first paint, aur
`/jobs/new` + `/jobs/{id}/edit` dropdown/stock.

## 8. Rollback

Har phase independent hai:

- P0: helper call ko `router.push` par wapas karo.
- P1/P2: layout se provider hatao (seed `null`) — pages automatically purane
  client fetch path par chale jayenge; neutral modules tab bhi reusable hain.
