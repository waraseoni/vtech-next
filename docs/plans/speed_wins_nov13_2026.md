# Speed Wins — 13 Nov 2026 (measured)

**Kya kiya:** login ke baad dashboard/page loads dheeme the. Sab kuch **measure**
karke fix kiya — production build (`next build` + `next start -p 3100`) par
Playwright Resource-Timing + Navigation Timing se before/after numbers.

**Method:** temp Playwright specs (baad me delete) — cold (storage/cache clear) aur
warm (returning user) dono. Server render ka time `responseEnd` vs DCL se alag
pehchana (long-task 0 tha → masla server par tha, client JS me nahi).

---

## 1. Root causes (measured, before)

| #   | Symptom                                               |                  Number | Kyun                                                                                              |
| --- | ----------------------------------------------------- | ----------------------: | ------------------------------------------------------------------------------------------------- |
| 1   | `/api/ai/alerts` har dashboard load par               |             **2741 ms** | `get_business_alerts` server par 8-10 queries; widget below-fold me hai par critical path par tha |
| 2   | `/api/license/status?force=true` har full load par    |             **2327 ms** | auth RTT + 3 `system_info` reads + remote license RPC; Vercel par baaki fetch queue ho jate the   |
| 3   | Brand logo `system_info?meta_field=logo` har load par |              **631 ms** | logo saal me ek baar badalta hai                                                                  |
| 4   | `/jobs` ka server HTML response                       |             **2005 ms** | `fetchOpenPartCounts` `enrichJobRows` ke **baad** sequential chalta tha (extra RTT)               |
| 5   | Dashboard due-stats                                   | 400-950 ms × 5 requests | client-side `pageAll` full-table scans (transaction_list ke multiple 1000-row pages)              |

## 2. Fixes

| File                                                       | Fix                                                                                                                                                                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/api/ai/alerts/route.ts`                           | Module-level TTL cache (default 120s, `AI_ALERTS_CACHE_MS`), `?fresh=1` bypass                                                                                                     |
| `src/app/components/AIAlertsWidget.tsx`                    | Idle load (1.2s + `requestIdleCallback`); Refresh button `fresh=1`                                                                                                                 |
| `src/app/api/license/status/route.ts`                      | 20s status cache + force 60s dedupe                                                                                                                                                |
| `src/app/useAppBoot.ts`                                    | Force re-verify session me max 1× / 30 min (sessionStorage — reload-safe), non-force 60s throttle reload-safe, license status sessionStorage hydrate, logo localStorage cache (6h) |
| `src/lib/server-jobs.ts`                                   | open-part counts `enrichJobRows` ke saath parallel                                                                                                                                 |
| `supabase/migrations/20261113_dashboard_due_stats_rpc.sql` | `get_due_stats()` — 5 full-table scans → 1 server-side aggregate (formula `src/lib/client-due.ts` jaisi hi)                                                                        |
| `src/app/(dashboard)/dashboard/DashboardBody.tsx`          | due-stats RPC fast-path + purana client-side fallback (RPC migrate na ho to bhi kaam)                                                                                              |

## 3. After (same machine, prod build)

| Metric                        |             Before |                                     After |
| ----------------------------- | -----------------: | ----------------------------------------: |
| `/api/ai/alerts`              |            2741 ms |                       155-330 ms (cached) |
| `license/status?force=true`   | 2327 ms (har load) | 104-326 ms; reload par force call hi nahi |
| logo query                    |  631 ms (har load) |               warm: 0 query; cold: 449 ms |
| `/dashboard` DCL              |            1081 ms |                                415-608 ms |
| `/dashboard` load             |            1249 ms |                                415-955 ms |
| `/jobs` server response → DCL |       2005-2659 ms |                               907-1283 ms |

**Behavior changes (jaan-boojh kar):**

- License remote re-verify: per tab-session 30 min me ek baar (pehle har hard refresh).
- Alerts: max ~2 min stale ho sakte hain; Refresh button fresh laata hai.
- Logo: 6h tak localStorage se (branding badalne par purane users ko 6h tak purana logo dikh sakta hai).

## 4. Pending (agla kaam, yahan naapa hua)

1. ~~**`get_due_stats` migration apply**~~ — applied + verified (batch 2, doc §5).
2. ~~**`/jobs` activity_logs**~~ — stale alert ab 1 RPC (batch 3, doc §5).
3. ~~Dashboard JS ~471 KB (40 chunks, cold) — code-split audit~~ — audit done (batch 3, §5.4).

---

## 5. Batch 3 — jobs stats RPC + stale RPC + view streaming (13 Nov 2026)

### 5.1 `get_jobs_stats()` — Quick Stats ka full-dataset scan → 1 RPC

|                                    |                                                           Before |                                    After |
| ---------------------------------- | ---------------------------------------------------------------: | ---------------------------------------: |
| Stats cost (no filters, 2358 rows) | **353 ms** (`status,amount` ke 3 chunked requests + client loop) | **76 ms** (1 RPC, koi row transfer nahi) |
| Values                             |          total 2358 / pending 238 / completed 2103 / amt 2240250 |                         **exactly same** |
| Filtered (`term=smps`)             |                                                     chunked scan |                         116 ms, 417 rows |

Parity: 10 filter combos (all / hideDelivered / date range / status 2 & 5 / spot /
term item+job_id+client-name) client-scan vs RPC — **byte-for-byte equal** (temp test).

Date-bound semantics (measured): PostgREST `timestamp without time zone` column par
`+05:30` offset ko **cast** karta hai (`2026-10-25` ka count 4 aata hai, plain-cast se 9).
Isliye RPC me `timestamptz ... at time zone 'UTC'` use kiya — session TZ se independent.

### 5.2 `get_stale_jobs()` — 3 requests → 1 RPC

|                     |                                                                      Before |                           After |
| ------------------- | --------------------------------------------------------------------------: | ------------------------------: |
| Stale alert (7 din) | **384 ms**, 3 requests (300-row candidate scan + 2 `activity_logs` queries) |               **107 ms**, 1 RPC |
| Items               |                                                                          34 | **34 (same ids + same `days`)** |

Dual-era rules same (`docs/DATA_MIGRATION_NOTES.md`): legacy key = txn id, modern key =
job_id, fallback `date_updated → date_created`. Equal-timestamp ties ka order DB-order vs
`(date_updated, id)` hai — same `changed_at` par order semantic nahi.

### 5.3 `/jobs/[id]/view` — edit-save ke baad redirect instant

Root cause: layout seed ko `await` karta tha → RSC **headers hi ~400 ms baad** jaate the,
aur `router.replace()` usi response ka wait karta hai. Ab seed fetch `Suspense` ke andar
hai (shell + `PageLoader` turant flush).

| RSC                       |                  Before |                                  After |
| ------------------------- | ----------------------: | -------------------------------------: |
| `/jobs/2461/view` headers | ~400 ms (poora payload) | **13-14 ms** (stream total 219-258 ms) |
| `/jobs/2461/edit` headers |                       — |                 ~20 ms (total ~215 ms) |
| `/jobs` headers / total   |     21 ms / 907-1283 ms |              26-30 ms / **644-677 ms** |
| `/jobs` DCL               |                  962 ms |                                 863 ms |

### 5.4 Dashboard JS audit (code-split) — nateeja

Measured (prod, cold): `/dashboard` **1022-1213 KB decoded JS, 19-26 chunks pre-DCL**
(≈471 KB gzip). Breakdown:

- **Already lazy** (post-DCL, ~572 KB): charts bundle `DashboardCharts` (recharts + d3
  deps: 311 + 145 + 65 + 51 KB) aur `AIAlertsWidget`.
- **Pre-DCL bacha hua weight shared app shell hai** — supabase (257 + 96 + 68 KB),
  react-dom (229 + 155 KB), react-query + lucide + page code. Dashboard-specific heavy
  module **koi nahi** mila, isliye aur split karne se sirf doosre routes ka bundle
  bigadta.
- Ek tweak: charts ka `DeferredMount` fallback 2.5 s → **8 s** — below-the-fold charts
  cold load par network/parse se hat gaye (IntersectionObserver scroll/viewport ke
  200 px par turant mount karta hai, isliye feature-loss nahi; 8 s baad safety mount).
  Jo user pehle view me charts tak pahunchta hai uske liye koi fark nahi — laba un
  users ko milta hai jo dashboard ke top hisse par hi rukte hain.

**Behavior changes (jaan-boojh kar):** stale list tie-order deterministic; charts khud
scroll par aate hain (warna 8 s baad).

### 5.5 DB apply (live, data-safe)

`20261113_jobs_stats_stale_rpc.sql` — sirf 2 naye read-only (`stable`, `security definer`)
functions + grants (`authenticated`/`service_role`; `anon` denied). Apply ke baad row
counts **unchanged** (transaction_list 2358, activity_logs 4535, client_list 560,
direct_sales 59, client_loans 4, client_payments 836). Full-schema snapshot me DDL append —
`npm run schema:drift` OK (26 migrations).

---

## 6. Batch 4 — Save/update ke baad "reload slow" (17 Nov 2026)

Symptom (user): jobs + clients ke **sabhi forms** me save/update ke baad page khulne me
samay lagta hai. Audit (read-only + prod build par measured) me 4 alag-alag causes mile —
teen save-handler ke andar (nav se pehle serial kaam), ek destination ka floor.

### 6.1 Measured baseline (prod build, local server 3100)

Browser → Supabase REST RTT (8 serial reads vs 1 batched read, same query):

| Probe          |                Measured |
| -------------- | ----------------------: |
| 8 serial reads | 759 ms (**~95 ms/RTT**) |
| 1 batched read |                  141 ms |

Destination RSC (jo save ke baad khulta hai — `router.replace` isi response ka wait karta hai):

| RSC               |  Headers |      Total | Payload |
| ----------------- | -------: | ---------: | ------: |
| `/clients`        | 20-30 ms | 340-367 ms |  223 KB |
| `/clients/1/view` | 20-27 ms | 165-240 ms |   12 KB |
| `/jobs`           | 22-38 ms | 726-766 ms |  227 KB |
| `/jobs/2461/view` | 31-78 ms | 312-351 ms |   14 KB |

### 6.2 Root causes (code-level)

| #   | Kahan                                                                                                                | Kya ho raha tha                                                                                                                                                                                          |                                   Cost |
| --- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------: |
| 1   | `clients/[id]/{add-payment,give-loan,collect-emi,add-direct-sale}`                                                   | `await queryClient.invalidateQueries({refetchType:"all"})` — view page **RSC seed se hi fresh** aata hai, isliye yahi 8 queries browser me dobara (serial) chal rahi thi, phir 8 wahi queries server par | ~141 ms + duplicate work, har save par |
| 2   | `clients/new`                                                                                                        | `await logActivity(...)` nav se pehle (log ka apna 5 s timeout bhi hai)                                                                                                                                  |         2 RTT ≈ **190 ms** (worst 5 s) |
| 3   | `clients/[id]/edit`                                                                                                  | `await syncClientContacts` — select + **per-contact serial** update/insert + delete + final fetch                                                                                                        |  N+2 RTT (4 contacts ≈ 6 RTT ≈ 570 ms) |
| 4   | `jobs/[id]/view` (status / spot / payment / delete), `clients/[id]/view` (bulk status / bulk move / spot / due-date) | `await logActivity` — UI state (modal/spinner) log ke **baad** band hota tha                                                                                                                             |              2 RTT ≈ 190 ms per action |
| 5   | `clients/[id]/view` **bulk** status/move, `jobs` list **bulk** status/move                                           | **per-job `await logActivity` loop** — M jobs = 2M serial RTT                                                                                                                                            |                        10 jobs ≈ 1.9 s |
| 6   | `jobs/old`, `jobs/[id]/old`                                                                                          | `setTimeout(() => router.replace(...), 800)` — artificial 0.8 s wait                                                                                                                                     |                       **800 ms** fixed |
| 7   | `jobs/bulk` save                                                                                                     | per-row `genCode()` (1 select) + `insert` (1 insert) **serial**                                                                                                                                          |               10 rows = 20 RTT ≈ 1.9 s |
| 8   | `jobs/bulk-edit` save                                                                                                | per-row serial update                                                                                                                                                                                    |              10 rows = 10 RTT ≈ 950 ms |

### 6.3 Fixes (behaviour same, blocking work hataayi)

1. **Money flows:** awaited refetch → `queryClient.removeQueries({queryKey: clientDetailKey(id)})`
   (synchronous, zero network) + turant `router.replace`. View page mount par RSC seed
   (fresh, post-write) use karta hai — purana cache flash bhi nahi.
2. **`clients/new`:** `void logActivity(...)` (audit fire-and-forget; log request cancel nahi
   hoti SPA nav par).
3. **`clientContacts.syncClientContacts`:** primary conflict fix + parallel writes + batched
   delete → **3-5 RTT (N se independent)**. (Latent bug bhi fix: purana primary demote kiye
   bina naya primary set karne par `client_contacts_primary_uidx` violation ho sakta tha.)
4. **`src/lib/activity.ts`:** naya `logActivities(entries)` — 1 profile read + 1 multi-row
   insert (2 RTT, entries se independent). `logActivity()` ab isi ka single-entry wrapper
   hai (100+ callers untouched). Unit test: `activity.test.ts` (6 tests).
5. **Bulk paths:** per-job log loops → `void logActivities([...])`; UI state turant.
6. **`jobs/old` + `jobs/[id]/old`:** 800 ms artificial delay hata diya.
7. **`jobs/bulk`:** ek code lookup + **ek multi-row insert** (2 RTT).
8. **`jobs/bulk-edit`:** rows parallel update (1 concurrent burst).

### 6.4 After (estimated from measured RTT — handler ke andar ka blocking time)

| Flow                                                              |                           Before |                             After |
| ----------------------------------------------------------------- | -------------------------------: | --------------------------------: |
| add-payment / give-loan / collect-emi / direct-sale → client view |   141 + 165-240 = **306-381 ms** |                    **165-240 ms** |
| new client → `/clients`                                           |   190 + 340-367 = **530-557 ms** |                    **340-367 ms** |
| client edit (4 contacts) → `/clients`                             |  ~570 + 340-367 = **910-937 ms** |   ~285 + 340-367 = **625-652 ms** |
| job view: status/spot/payment modal close                         |                    ~190 ms extra |               **~0 ms** (instant) |
| bulk status (10 jobs) spinner                                     |                           ~1.9 s |                       **~190 ms** |
| bulk job save (10 rows) → `/jobs`                                 | ~1.9 s + 726-766 = **2.6-2.7 s** |   ~285 + 726-766 = **1.0-1.05 s** |
| bulk-edit (10 rows) → `/jobs`                                     |       ~950 + 726-766 = **1.7 s** | ~95-190 + 726-766 = **0.8-0.9 s** |
| old job form save → view                                          |   800 + 312-351 = **1.1-1.15 s** |                    **312-351 ms** |

`logActivities` ka worst case ab bhi `LOG_ACTIVITY_TIMEOUT_MS` (5 s) se protected hai, par
ab wo **nav ke baad background** me chalta hai — user wait nahi karta.

### 6.5 Bacha hua floor (next candidates, measured)

- `/jobs` RSC **726-766 ms** — `queryJobPage + queryJobStats` (round 1) → `enrichJobRows`
  (round 2, 6 parallel queries incl. 2 `activity_logs`) → page+stats enrich ek hi RPC me
  laane se ~1 round (~300 ms) bachega.
- `/clients` payload **223 KB** (553 clients bina pagination) — list pagination/virtual
  list se transfer + hydrate dono kam honge.
- `/jobs` + `/clients` ke baad koi "instant paint" nahi — dono routes par `loading.tsx`
  maujood hai, isliye skeleton turant aata hai; data stream hone tak wahi dikhta hai.

**Verification (is batch par):** `tsc --noEmit` ✔ · `eslint` ✔ 0 errors · `npm test`
**683/683** (677 + 6 naye) ✔ · `next build` ✔ · `prettier --check` (changed files) ✔ ·
`activity_logs` multi-row insert live schema par transaction ke andar test kiya, rollback ke
baad rows **4615 → 4615** (koi data change nahi).

---

## 7. Batch 5 — list/detail first paint (17 Nov 2026, measured)

User: "page loading ko aur fast kar sakte ho kya". Sab kuch prod build
(`npx next start -p 3100`) par naapa gaya — pehle browser probe (best of 3),
phir server-side HTML fetch (8 runs, median; browser jitter hatane ke liye).

### 7.1 Kya-kya badla

| #   | Change                                                                                                                                       | File                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | `/jobs` page query se `count: "exact"` hataya — total `get_jobs_stats().total` se (bilkul wahi filters)                                      | `src/app/jobs/jobListQueries.ts`, `src/lib/server-jobs.ts` |
| 2   | **Live DB index** `transaction_list_del_status_job_id_idx (del_status, job_id DESC)`                                                         | `supabase/migrations/20261117_jobs_list_sort_index.sql`    |
| 3   | `/clients`: contacts `client_contacts_client_fk` se embed (alag round khatam); embed fail ho to graceful degrade                             | `src/lib/server-clients.ts`                                |
| 4   | `/jobs/[id]/view`: product/service naam+hsn lookups 3rd wave → 2nd wave (catalogs 97 + 25 rows)                                              | `src/app/jobs/[id]/view/jobViewQueries.ts`                 |
| 5   | `/dashboard`: data batches auth ke saath parallel (sirf profile widget auth ke baad)                                                         | `src/lib/server-dashboard.ts`, dashboard page              |
| 6   | `/clients`: data fetch auth ke saath parallel                                                                                                | `src/lib/server-clients.ts`, clients page                  |
| 7   | `loadStaffSeed`: seed loader auth ke saath parallel (60+ seed routes)                                                                        | `src/lib/server-seed.ts`                                   |
| 8   | Server seeds me `getClaims()` (local) — `getUser()` ka Auth RTT hataya (attendance, profile, messages, PO, jobs/old, direct-sale, mechanics) | `src/lib/api-auth.ts` + seeds                              |

### 7.2 DB index (live apply, data untouched)

`job_id` TEXT par poora btree index nahi tha (sirf partial unique `job_id >= 28101`),
isliye har `/jobs` load par ~2.3k rows ka sort hota tha.

| Step                                                               | Result                                    |
| ------------------------------------------------------------------ | ----------------------------------------- |
| Same query RLS ke saath, index se pehle                            | **106 ms** (4 runs, med)                  |
| Index ke baad                                                      | **39 ms** (Index Scan, execution 0.98 ms) |
| Apply (transaction me create + analyze + plan verify, phir commit) | **353 ms**                                |
| Index size                                                         | 72 kB                                     |
| `transaction_list` rows before → after                             | **2370 → 2370**                           |

### 7.3 Measured (prod build, server-side HTML, median of 8)

| Route                          |        Before |          After | Note                   |
| ------------------------------ | ------------: | -------------: | ---------------------- |
| `/dashboard`                   |    294-304 ms | **235-264 ms** | auth+data parallel     |
| `/jobs`                        | 620 ms (html) |     **179 ms** | count hata + index     |
| `/clients`                     |        224 ms |     **178 ms** | embed + auth parallel  |
| `/attendance`                  |    227-259 ms |  **66-126 ms** | seed parallel + claims |
| `/jobs/[id]/view` (items wale) |    251-291 ms | **206-230 ms** | 3 waves → 2            |
| `/profile`                     |        250 ms |     **132 ms** | claims + seed parallel |
| `/messages`                    |        251 ms |     **138 ms** | claims + seed parallel |
| `/clients/[id]/view`           |             — |     **140 ms** | unchanged pipeline     |

Browser probe (best of 3, wall — JS/hydration samet):

| Route             | Before |      After |
| ----------------- | -----: | ---------: |
| `/jobs`           | 715 ms | **356 ms** |
| `/attendance`     | 283 ms | **149 ms** |
| `/dashboard`      | 344 ms | **291 ms** |
| `/clients`        | 420 ms | **357 ms** |
| `/jobs/2461/view` | 402 ms | **307 ms** |

### 7.4 Bacha hua (next candidates)

- ~~`/jobs` enrich round ek RPC me~~ — try kiya, **reject** (7.5 me numbers).
- `/clients` 257 KB payload (553 clients bina pagination) — **reject**: pagination server-side
  karne se client-side search/tab-counts/pagination UX tootegi, aur page ke saare fields UI me
  use hote hain (grep verified) — payload trim bhi safe nahi. Sirf client-side virtual list
  bacha hai (render cost, TTFB nahi).
- `/dashboard` 264 ms — `get_monthly_revenue` + low-stock chain abhi 2 waves hain.

### 7.5 Try kiya, reject: `/jobs` page+enrich ek RPC round me (18 Nov 2026)

Idea: `get_jobs_page(p_term, p_date_from, ..., p_limit, p_offset)` — page query + 7 enrich
queries + exact total ek hi round-trip me. Live DB par implement, `security invoker` (RLS same),
materialized CTEs, ordered `jsonb_agg`. **SQL side sab measure hua aur theek tha, par HTTP par
RPC khud mehnga nikla** — isliye integration revert kiya aur function drop kiya.

**SQL sahi tha (pg me, live data):**

| Case (pg, `authenticated` + claims) | Result |
| ----------------------------------- | ------ |
| no filters | 40-44 ms (rows 25, total 2370) |
| hideDelivered / status=2 / spot / date-range | 37-76 ms |
| term=286 / term=1706 | 55-65 ms (pehle 5250 ms — `SubPlan loops=2267` fix) |
| Old pipeline vs RPC, real user JWT (11 cases) | **11/11 identical** (rows, order, total, clients, billed, payments, sales, loans, logs) |

**HTTP par wahi function 3x slow (PostgREST):**

| Probe (HTTP, user JWT, median of 7) | Time |
| ----------------------------------- | ---: |
| `get_jobs_page` (invoker) | **326-343 ms** |
| `get_jobs_page` copy as `security definer` | 331 ms |
| trivial `select count(*)` invoker function | **323 ms** |
| same count as definer function | 60 ms |
| const RPC (no table) invoker | 80 ms |
| 18 KB jsonb payload RPC (no table) | 62 ms |
| table GET page (RLS) | 67 ms |
| `get_jobs_stats` (definer RPC) | 53-63 ms |

Root cause app-code me nahi hai: **RLS-invoker RPC par PostgREST ka fixed ~250 ms overhead**
hai (trivial count bhi 323 ms), aur params Vars ban ke aane se planner estimate-based plan
leta hai (definer copy 331 ms). Literal-injected dynamic SQL (plpgsql + `format`) se bhi same
333 ms — matlab na plan, na payload; PostgREST layer hi culprit hai.

**Net effect (prod build, server HTML):** `/jobs` 179 ms → **377 ms**. Revert ke baad wapas
**175-199 ms**. Isliye: TS integration revert (`jobListQueries`/`server-jobs`/`useJobList`/
`requiredParts`/test), live DB se function drop, migration file delete.

**Seekh:** is PostgREST par RLS-heavy read RPC se round-trip bachane ka fayda nahi — RPC sirf
tab jab wo `security definer` + **chhota scalar/aggregate** ho (jaise `get_jobs_stats`
53-63 ms). Bade row payload ke liye PostgREST ke table endpoints hi fast hain.

**Verification (is batch par):** `tsc --noEmit` ✔ · `eslint src` ✔ 0 · `npm test`
**683/683** ✔ · `npm run build` ✔ · `schema:drift` ✔ (27 migrations) · live DB apply ke
baad row counts unchanged.

**Revert ke baad bhi wahi gates:** `tsc` ✔ · `npm test` **683/683** ✔ · `npm run build` ✔ ·
live DB me `transaction_list` 2370 / `activity_logs` 4615 / `client_list` 564 (unchanged),
perf/probe functions **0** bache.
