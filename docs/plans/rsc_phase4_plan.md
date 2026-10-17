# Phase 4 — RSC Data Waterfall Removal (perf_db_fetch_audit)

> **Status: IN PROGRESS — P1 + P2 IMPLEMENTED (2026-10-16, user verify pending);
> P2 perf follow-up (parallel auth+data, seed openPartCounts, hide_delivered
> cookie, StrictMode-safe seed gate, lazy modals) + staff-auth `getClaims()`
> fast-path 2026-10-17.**
> P3 (cash-flow + due-reminders) optional, later.
>
> **Goal:** authenticated first-paint me hi data (post-hydration waterfall khatam).
> **Proven:** G3 pilot `clients` — LCP 10.13s→5.2-5.9s (SSR wins, perf_baseline).
> **⚠️ Correction (18 Oct 2026):** ye win **RSC flight payload me data seed**
> hone se hai (client fetch waterfall khatam) — **SSR HTML DOM me content nahi** aata,
> kyunki `RootClient` boot-gate (`!authReady` → "V-TECH Secure Boot" splash) saare
> authenticated pages ko client-render karta hai. Feasibility + options:
> `ssr_boot_gate_plan.md`.
> **Audit line:** "Dashboard/jobs/clients initial data RSC me ya ek RPC per page
> se; stream." — clients + dashboard + jobs done, **baaki: cash-flow (optional)**.

---

## Current state (researched 2026-10-15)

| Page                    | Lines | Status                | First-paint data path (aaj)                                    |
| ----------------------- | ----- | --------------------- | -------------------------------------------------------------- |
| `clients`               | 20    | ✅ **RSC pilot done** | server page → `fetchClientsPageData()` → props → `ClientsBody` |
| `(dashboard)/dashboard` | 1968  | ❌ `"use client"`     | hydration → useEffect → 5-6 Promise.all batches → setState     |
| `jobs`                  | 2992  | ❌ `"use client"`     | hydration → useEffect → supabase queries → setState            |
| `reports/cash-flow`     | 744   | ❌ `"use client"`     | (Phase 4 scope se BAHAR — baad ka batch)                       |

**Established infra (dobara banana nahi):**

- `requireStaffWithRole()` — server auth (`src/lib/api-auth.ts`)
- `getServerSupabase()` — cookie+RLS server client; **service-role NEVER page reads me**
- `src/lib/server-{clients,expenses,mechanics,payments,salary,hours-salary}.ts` — server fetch-lib family
- Pilot pattern: `clients/page.tsx` (force-dynamic, async, props → client body)

## Non-goals

- ❌ react-query/SWR caching (Phase 3, alag sprint — aur A4 lesson: business
  numbers ka HTML/API/SW caching **banned**, stale salary/ledger > speed)
- ❌ API routes banane ki zaroorat nahi — server lib direct call (pilot jaisa)
- ❌ `reports/monthly-profit`, `cash-flow`, baaki reports — is phase me nahi
- ❌ Koi filter/modal/logic rewrite — **split = pure code move, zero logic change**

## Pattern (pilot se copy)

```
src/app/<page>/page.tsx          ← SERVER: requireStaffWithRole + fetch + props
src/lib/server-<page>.ts         ← SERVER fetch lib (getServerSupabase, Promise.all)
src/app/<page>/components/<Body> ← CLIENT: existing UI, initial data props se
export const dynamic = "force-dynamic"
```

---

## P1 — Dashboard (1968 ln) ⭐ highest impact (login ke baad pehla page)

### ✅ IMPLEMENTED (2026-10-16) — `perf(dashboard)` commit

**Ship kiya:**

- `src/lib/dashboard-shared.ts` (NEW) — shared types + STATUS_META (zero
  runtime deps; dono taraf single source)
- `src/lib/server-dashboard.ts` (NEW) — `fetchDashboardInitialData()`: 5
  batches `Promise.all` me (profile + stats+status + revenue 12m + widgets
  [recents+low-stock+places] + waiting summary); RPC fast-paths + purane
  legacy fallbacks AS-IS; batch-failure par `logger.warn` + sane default
  (page kabhi blank nahi hota)
- `page.tsx` → 25-line server component (requireStaffWithRole → redirect
  /login → fetch → `<DashboardBody initial/>`), `force-dynamic`
- `DashboardBody.tsx` (NEW, 1537 ln) — client body; mount-fetch effects
  (main + waiting) HATE; due-reminders + financial (interactive) client par
  hi rehte hain; auth-guard/QR/install intact
- `fetchStockByProducts`/`fetchWaitingSummary` — optional `client` param
  (default browser = call-sites unchanged)

**Deviations (documented, behavior-safe):**

- `product_locations` ka place-lookup ab server par DIRECT query
  (`is_frontend_staff()` RLS — migration 20260912 verified); /api hop nahi
- stock-RPC fail → warn + low-stock khaali, recents BACHTE hain (pehle poora
  widget batch hi mar jata tha)

### P1 verification (user — deploy par)

- [ ] Numbers: stats, revenue chart, recent jobs/payments, low stock (places
      samet), waiting-parts card — pehle jaise
- [ ] Due reminders + admin financial widget → hydration ke baad bharte hain
- [ ] Date-range change → naye financial numbers
- [ ] Mobile tab bar + install prompt + QR intact
- [ ] Logged-out → /login redirect (dev smoke: 307 ✓)

## P2 — Jobs list (2992 ln)

### ✅ IMPLEMENTED (2026-10-16) — `perf(jobs)` commit

**Ship kiya:**

- `src/app/jobs/jobListQueries.ts` (NEW) — shared query layer (neutral, zero
  client/server deps): `Transaction`/`JobListStats`/`JobSpot`/`JobListFilters`
  types; `queryStatusChangeLogs` (dual-era reader), `searchClientsForTerm`
  (`.ilike`), `computeJobStats` (head:true counts + totalAmt), `queryJobPage`
  (paginated list w/ filter logic 100% AS-IS), `enrichJobRows` (client-name
  map + status-change-log enrichment), `queryJobSpots` (locations kind='job'
  - live `fetchOpenPartCounts` counts), `seedMatchesFilters` (server/client
    filter-snapshot check — localStorage hide_delivered mismatch path).
- `src/app/jobs/useJobList.ts` (refactored, 515→~300 ln) — saari DB-query
  logic jobListQueries me delegate; UI state (filters, pagination, debounce,
  URL-sync, localStorage hide_delivered) wahin; seed-aware:
  - `initial?: JobsListSeed | null` prop (default `undefined` = no-seed path,
    zero behavior change for other callers)
  - `seedMatchesFilters` mount-par localStorage-check → seed match ho to
    mount-fetches skip (`useRef` skip-flags), mismatch ho to drop + client
    fetch (aaj jaisa)
  - `searchClientsForTerm` browser-client bound wrapper: per-term module-level
    in-flight dedupe (Map) — fetchStats+fetchPage same term par duplicate
    client-search nahi
- `src/lib/server-jobs.ts` (NEW) — `fetchJobsPageData(sp, userRole)`:
  `getServerSupabase()` (cookie+RLS, service-role NEVER); URL params padhta
  hai (`search`/`date_from`/`date_to`/`hide_delivered`/`spot`); `hide_delivered`
  ka localStorage fallback SERVER ko nahi dikhta (client `seedMatchesFilters`
  mount-par check karta hai); per-request closure dedupe for client-search
  (cross-user map RLS leak = banned); batch-failure par `logger.warn` + return
  `null` (seed absent = client fetch chalega — graceful)
- `src/app/jobs/page.tsx` → 25-line server component (requireStaffWithRole →
  redirect /login → `await searchParams` → `fetchJobsPageData(sp, userRole)` →
  `<JobsBody initial={null | JobsPageSeed}/>`, `force-dynamic`)
- `src/app/jobs/JobsBody.tsx` (NEW, ~2960 ln) — copy of old page.tsx +
  edits: `JobsPageSeed` prop, `useJobList(initial)`, sysInfo/mechNames/
  userRole effects HATE (server props se seed), Suspense boundary intact

**Design decisions (documented):**

- `hide_delivered` localStorage lazily hides delivered — server URL se padta
  hai, client seed-match check par decide karta hai. Mismatch par client fetch
  chalta hai (aaj ka behavior, no regression).
- `status` filter always `""` at mount (URL-sync nahi hota — seed snapshot bhi
  same).
- Shared query extraction chosen over duplication (drift risk elimination —
  hsn-lesson spirit).

### P2 verification (user — deploy par)

- [ ] `/jobs` load → first paint pehle se rows + stats + spots (no "Loading..." after hydration)
- [ ] `?search=...&date_from=...` URL se load → filtered rows
- [ ] Filter/search/pagination change → client refetch (double-fetch nahi — network tab me ek hi)
- [ ] localStorage hide_delivered: reload par last choice yaad; server URL-hide_delivered mismatch → graceful fallback (no blank list)
- [ ] Quick-stats bar (Total/Pending/InProgress/Completed/totalAmt) sahi
- [ ] Bulk-select, print/export, mobile quick-stats bar intact
- [ ] Bulk move, spot edit, WA send, mobile FAB — sab waise ka waise
- [ ] Logged-out → /login redirect (dev smoke: 307 ✓)

### P2 perf follow-up (2026-10-17) — `/jobs` load-time fixes

Reason: `/jobs` abhi bhi dev + Vercel dono par slow lag raha tha. Diagnosis:
Vercel function region already correct (bom1 ↔ Supabase MUM — `x-vercel-id`);
DB warm ~220 ms (bottleneck nahi). Do asli costs: (1) client bundle/hydration
(baseline `/jobs` ~1055 KB, TBT 2668 ms — sabse zyada), (2) server render
waterfall (auth `getUser()` RTT ke BAAD data) + chhupi double-fetch.

Ship kiya:

- **Parallel auth + data** (`page.tsx`): pehle `requireStaffWithRole()` (getUser
  RTT + profiles) ke baad hi `fetchJobsPageData` chalta tha (sequential ~250 ms
  waste). Ab `Promise.all([requireStaffWithRole(), fetchJobsPageData(sp, …)])`.
  Isliye `userRole` server-jobs se hataya — page auth se attach karta hai
  (`JobsPageData = Omit<JobsPageSeed,"userRole">`).
- **Seed `openPartCounts`**: `fetchOpenPartCounts(txnIds, client?)` (optional
  cookie+RLS client, jaise `fetchWaitingSummary`); `JobsListSeed.openPartCounts`;
  server list ke saath counts bhi bhejta hai. Badge mount-par ek extra client RTT
  hata; client effect seed page par skip (`useJobList`).
- **`hide_delivered` cookie** (`jobs_hide_delivered`): client localStorage mirror
  - server ise padhta hai → localStorage-only case me bhi seed match, double-fetch
    kam. URL param ab bhi authoritative.
- **StrictMode-safe seed gate** (`useJobList`): purane "ek baar" skip-refs dev
  StrictMode (effect double-invoke) me pehli run me consume ho kar DOOSRI run me
  phir fetch kar dete the (dev-only double-fetch). Ab IDEMPOTENT check — current
  fetch-inputs seed snapshot se match ho to skip; `seedConsumed` ek hi baar
  false→true.
- **Lazy modals** (`JobsBody`): `WaPreviewModal`, `JobSpotPicker`,
  `JobPreviewPanel` ab `next/dynamic({ ssr:false })` — initial JS/hydration se
  bahar (sirf interaction par load).
- **`useJobList.test.tsx`** (NEW, 5 tests): seed-gate behaviour lock — valid seed
  par zero mount-fetch, **StrictMode double-invoke** par bhi zero fetch (purana
  skip-ref pattern yahin toot jata tha — regression guard), hide_delivered cookie
  mismatch → seed drop + fetch, filter-change → refetch, cookie init + mirror.

Bundle data (post-change, build manifest): `/jobs` first-load JS ≈ 1150 KB
uncompressed; polyfill (110 KB) `noModule` hai → modern browsers skip. `/jobs`
specific code minority hai — baaki shared floor (React/Next ~430 KB + supabase-js
cluster ~250 KB + lucide + sonner + capacitor). Koi accidental heavy-lib leak
nahi (recharts/qrcode/firebase/groq jobs bundle me nahi).

Gates: tsc ✓ · eslint (touched) ✓ · prettier ✓ (no unrelated churn) ·
vitest **368/368** ✓ · next build ✓ (`/jobs` ƒ Dynamic) · smoke 307→/login ✓.

### Auth fast-path — `getClaims()` (2026-10-17, app-wide)

`requireStaffWithReason`/`requireStaffWithRole`/`requireStaff`/`requireStaffWriter`
ab `getUser()` (Auth-server RTT ~250 ms/request) ke bajaye local `getClaims()`
(JWKS verify, zero network) use karte hain, `getUser()` par fallback (expired/
invalid claims → server validate + refresh). Sirf staff path — `requireUser`/
`requireClient`/`requireAdmin` untouched (unhe full `User`/`user_metadata`
chahiye). `ServerUser` type (`{id, email?, user_metadata?}`) claims se fill hota
hai; dashboard `full_name`/`email` wahi se. Lock: `api-auth.staffRole.test.ts`
me 3 tests — valid claims par `getUser` call hi nahi; sub missing / getClaims
throw → fallback. Benefit: **har staff API call + server page** se ~250 ms kam
(free tier me bhi).

Remaining (next lever): `JobsBody` mega-component split /
desktop-table-XOR-mobile-cards conditional render (hydration TBT) — sirf tab jab
real TBT measurement bataye ki abhi bhi high.
>
> **Update (18 Oct 2026):** TBT measurement ho gayi — mobile TBT **layout-bound**
> hai (desktop TBT 245ms, mobile ~3s; render flip akela ~40%). **Device-branch fix
> ship ho gaya** (mobile TBT −21%, Style & Layout −25%). Ab next lever: (a) list
> virtualization + `contain`/`content-visibility` (client render cost), (b)
> SSR-content — bada/risky, plan: `ssr_boot_gate_plan.md`.

---

## Gates (per phase, commit se pehle)

1. prettier/eslint (touched files) · `npx tsc --noEmit` · `npx vitest run` (360+)
2. `npx next build` (routes/boundaries change)
3. User visual verify: dashboard + jobs (numbers, filters, mobile)
4. DevServer running ho to `.next/dev/types` race — tsc dev band karke chalana
   (15 Oct ko isi race ko debug kiya tha)

**Commits:** P1a+P1b EK commit (`perf(dashboard): ...`), phir P2 ek commit.
Rollback = page revert (server-lib naya file, safe).

## Risks

| Risk                                                           | Mitigation                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Double-fetch on mount (client effect + server)                 | `useRef` skip-flags + seed-validity check; network tab se verify                                 |
| localStorage hide_delivered mismatch (server URL se padta hai) | client mount-par `seedMatchesFilters` check → mismatch ho to seed drop + client fetch (graceful) |
| Hydration mismatch (server/client numbers)                     | same `inr()`/formatters, koi Date.now wala render nahi (pilot me already rule)                   |
| Cookie auth server par                                         | `requireStaffWithRole()` — pilot-tested                                                          |
| Dashboard 1968-line move me slip                               | pure move, logic edit BANNED; tsc+visual verify                                                  |
| SW/HTML caching stale data                                     | `force-dynamic` + SW me HTML/RSC caching pehle se intentionally nahi (A4)                        |

## Effort

- P1: ek session — sabse bada chunk ✅ done
- P2: ek session ✅ done
- Optional P3 (later): cash-flow + due-reminders server move
