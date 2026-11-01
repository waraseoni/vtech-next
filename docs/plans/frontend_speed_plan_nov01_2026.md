# Frontend Speed Plan — v2 comparison aur no-DB optimisation

Created: 2026-11-01
Status: **PARTIAL IMPLEMENTED (2026-11-01)** — WS-B first slice, WS-C (6
reports), WS-D accounting-dashboard batching, WS-F query/cache hygiene aur WS-G
checks done; WS-B SidebarNav lever aur runtime Lighthouse measurement pending.
**Koi code change schema/index/data touch nahi karta.**
Scope: `C:\next-vtech\vtech-next-v2` (same DB, faster) ke comparison se hamare
app ki speed improve karna — sirf app layer par. DB live hai, isliye is plan me
**koi DB write/DDL/index/data change nahi** hai.

Related docs:
`perf_db_fetch_audit_oct14_2026.md` (parent perf plan — Phase 4/7 pending),
`rsc_phase4_plan.md`, `ssr_boot_gate_plan.md` (boot-gate experiments),
`perf_baseline.md` (Lighthouse baseline method), `docs/TODO.md` Phase C (W6–W8).

---

## 0. Context — v2 fast kyon hai, DB ka role kya hai

User observation: v2 **same DB** par chalta hai par kaafi fast hai. Read-only
measurement (2026-11-01) se farq yeh nikla:

| Metric          | Hamara app                                                                             | v2                                                             |
| --------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Pages           | 121 (**99 `"use client"`**)                                                            | 19 (sab server components)                                     |
| Reports pages   | 31 (**27 client-rendered**)                                                            | 0                                                              |
| TSX files       | 239                                                                                    | 64                                                             |
| Production deps | 34 (recharts, html5-qrcode, qrcode, jsbarcode, firebase-admin, genai, groq, web-push…) | 22                                                             |
| Build JS chunks | **7.4 MB / 208 files**                                                                 | **1.1 MB / 27 files**                                          |
| First-load data | Kuch routes RSC-seeded, kai reports hydration ke baad fetch                            | Har page server par query + `PAGE_SIZE = 25` server pagination |
| Boot            | `RootClient` splash jab tak `authReady` nahi                                           | Koi boot gate nahi                                             |
| Feature scope   | Core CRUD + reports + print (24 routes) + WA templates + AI + PWA/offline              | Core CRUD only                                                 |

**Nateeja:**

1. Same DB hone se speed ka farq DB ka nahi hai — DB queries dono me lagbhag
   same cost ke hain (audit: sabse badi table ~4,016 rows).
2. v2 tez hai kyunki woh **chhota, server-first, server-paginated core-CRUD**
   app hai. Uska architecture apnana useful hai; uska **scope** apnana galat
   hoga (reports/print/AI/PWA hatana business loss hai).
3. Hamare saare visible bottlenecks **app layer** me hain — isliye target
   achievable hai **bina kisi DB change ke**.

### Pehle se done (dobara nahi karna)

- `proxy.ts` auth tax fix (`getClaims()` fast path) — Phase 1 done.
- Supabase cold-start warm cron — Phase 2 done.
- React Query cache (`staleTime 30s`, 26 files) — Phase 3 done.
- RSC seed: clients, dashboard, jobs, inventory, mechanics, expenses, payments,
  suppliers (Phase 4 P1/P2 + W7 partial).
- `/jobs` mobile progressive card mount — perf 56→68, TBT 2413→766 ms.
- Save-path fixes (logActivity timeout, parallel writes, artificial delay) — Phase 8.
- DB indexes — 2026-10-18 migration **already applied**; is plan me koi naya
  index nahi.

### Pehle try ho chuka aur band (repeat mat karo)

- **SSR content behind splash** (`NEXT_PUBLIC_SSR_CONTENT`) — HTML me content
  aaya par opaque splash occlusion ki wajah se LCP/FCP me **zero win**, payload
  bada; revert kiya (`ssr_boot_gate_plan.md`).
- Isliye boot-gate ka asli fayda sirf **gate lift (Stage 2/3)** se milega — woh
  alag, high-risk sprint hai (WS-E), first wave me nahi.

---

## 1. Target (honest — "v2 jitna" nahi)

v2 ka 19-page scope hamare 121-page app se compare karna galat hai. Hamara target:

| Route                             | Metric              | Aaj (known)                  | Target                                                                            |
| --------------------------------- | ------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| `/jobs` mobile@4x                 | TBT                 | ~766 ms                      | **< 600 ms**                                                                      |
| `/jobs` mobile@4x                 | LCP                 | ~3.8 s                       | **< 3.5 s**                                                                       |
| `/dashboard` mobile@4x            | TBT                 | measure first                | **< 900 ms**                                                                      |
| `/clients`, `/jobs`, `/dashboard` | First-load JS       | measure first                | **−25%**                                                                          |
| `/reports/balancesheet` mobile@4x | First data paint    | measure first (client fetch) | **< 2.5 s**                                                                       |
| `/reports/balancesheet`           | Default API payload | measure first                | **< 200 KB**                                                                      |
| Poore app                         | Invariants          | —                            | Screen/print numbers identical, 0 hydration errors, tsc/eslint/vitest/build green |

Measured "aaj" values Phase 0 me same method se refresh honge; jo cells khali
hain wahan guess nahi, measurement ke baad bharenge.

---

## 2. Phase 0 — Measurement harness + budgets (0.5–1 din) — sabse pehle

Bina fair baseline ke optimisation guesswork hai. Note: same build par Lighthouse
ne pehle 40/59/45 perf diya tha (`ssr_boot_gate_plan.md`), isliye single run par
bharosa nahi.

**Method (dono projects par identical):**

1. `next build && next start` (production build, dev server nahi).
2. Lighthouse mobile preset (4x CPU throttling), **median of 3 runs**.
3. Saath me CDP `Performance.getMetrics`: DOM nodes, style-recalc, task duration,
   JS heap — Lighthouse variance ko cross-check karne ke liye.
4. Authenticated Chrome profile (`.env.local` admin creds se, alag profile dir).
5. Routes: `/jobs`, `/dashboard`, `/clients`, `/reports/balancesheet`,
   `/inventory`, `/login`.
6. v2 se comparison sirf **overlapping routes** par: `/jobs`, `/clients`.
   Reports/print/AI par comparison meaningless hai (v2 me hain hi nahi).

**Deliverables:**

- `docs/plans/speed_baseline_nov2026.md` — per-route LCP/FCP/TBT/TTFB, first-load
  JS, payload size, DOM nodes, method + variance notes.
- Perf budget table (upar §1) locked; aage har PR isi ke against measure hoga.
- Reusable script (optional, `scripts/perf/`) — sirf measurement, koi DB write nahi.

**Accept:** baseline numbers documented; 2 runs ka variance < 15% ya method note
me explain.

---

## 3. Workstreams (ROI order me)

### WS-B — Bundle diet (P1, 1–2 din) — highest certainty

**Status: FIRST SLICE DONE (2026-11-01).** Measured delta: har route par
~12–13 KB (-2%) — target -20–30% is slice se nahi mila; bacha hua lever
SidebarNav/nav icons ka alag chunk hai (neeche).

**Problem:** 7.4 MB / 208 chunks vs v2 1.1 MB / 27. Har route ka JS parse/hydrate
TBT kha raha hai. Bade reports pages 600–960 LOC client components hain.

**Kaam:**

1. ~~`experimental.optimizePackageImports` add karo~~ — **no-op confirmed**:
   Next 16 default me `lucide-react`, `date-fns`, `recharts` already optimize
   karta hai (`node_modules/next/dist/docs/.../optimizePackageImports.md`).
2. RootClient se rare/drawer-only UI dynamic chunks me nikaale (done):
   - `TeamOnline` (sirf drawer open par), `ShortcutHelpOverlay` (sirf `?` par),
     `LicenseGate` (sirf invalid license par).
   - `NativePrintPreview` pehle se lazy tha.
3. Import-time heavy libs audit (verified): `html5-qrcode` already
   `await import` fallback; `qrcode` sirf dynamic qr-share/server print;
   `jsbarcode` sirf inventory routes; `@simplewebauthn/browser` sirf login/settings;
   `web-push` server-only.
4. **Remaining lever (deferred 2026-11-01):** `SidebarNav` (~895 LOC) ko alag
   module me move karke dynamic import — mobile par drawer pehli open tak load
   na ho. Deferral reason: yahi component desktop sidebar + mobile drawer dono
   me use hota hai (desktop par lazy-load se visible nav flash), move mechanical
   hai aur authenticated visual QA ke bina verify nahi ho sakta. Estimated
   ~10 KB gain; alag commit me authed QA window ke saath karna.
5. ✅ Serwist precache check done (2026-11-01) — prod build ka `sw.js`
   52,051 bytes / 228 precache entries; sirf `/_next/static/**` + public
   icons/manifest, koi route HTML/RSC nahi. Detail §5.1 WS-G.
6. Per-route first-load JS measurement — build-manifest based (upper bound):
   baseline `/jobs` 661 KB → 648 KB, `/dashboard` 598 → 586, `/clients` 604 → 592,
   `/reports/balancesheet` 589 → 577, `/inventory` 748 → 735, `/login` 580 → 568.

**Constraints:** koi feature/UI change nahi; sirf loading strategy. React
Compiler + dynamic import ka interaction build par verify karo.

**Rollback:** ek commit — next.config + RootClient (+ touched imports).

### WS-C — Reports ka first paint server se (P2, 2–3 din)

**Problem:** `/reports/*` ke 27/31 pages client hain; pehla data hydration ke
baad fetch hota hai. Example: `reports/balancesheet/page.tsx` `"use client"` hai
aur `:199` par `/api/reports/balancesheet` call karta hai.

**Kaam (top 5 reports, ek-ek commit):**

1. ✅ **DONE (2026-11-01)** `reports/balancesheet` — server page
   (`requireStaffWithRole`, admin/developer only, `force-dynamic`) +
   `fetchBalanceSheetData()` (cookie+RLS client) → `BalancesheetBody` ko
   `initialData`. Mount par API call skip; date/filter change par wahi purana
   `/api/reports/balancesheet` chalta hai. Seed fail ho to body purana client
   fetch path (error banner) le leta hai. API route unchanged.
2. ✅ **DONE (2026-11-01)** `reports/cash-flow` — ledger computation
   `src/lib/ledger-data.ts` me extract hui; `/api/reports/ledger` ab wahi shared
   module call karta hai (thin route). Server page `fetchLedgerData()` se
   `initialData` deta hai; date change par API refetch. `useSearchParams`
   dependency mount par hata di (server se `from`/`to` aate hain).
3. ✅ **DONE (2026-11-01)** `reports/monthly-profit` — `src/lib/monthly-profit-data.ts`
   (year buckets + totals) server par; body `initialData`/`initialRawData` se
   seed. Year change par client-side wahi shared module (single computation).
   Note: drill-down modals ke liye `rawData` bhi RSC payload me jata hai —
   payload size next measure par monitor karna hai (WS-D).
4. ✅ **DONE (2026-11-01)** `reports/pending-jobs` — `src/lib/pending-jobs-data.ts`;
   server page `searchParams` (`from`/`to`/`status`) resolve karke first page
   seed karta hai; React Query `initialData` sirf matching key par (30s stale).
5. ✅ **DONE (2026-11-01)** `reports/daily-done` — `src/lib/daily-done-data.ts`
   (dual-era status-log parsing + firm-info + mechanics + items); aaj ka report,
   mechanics aur firm-info server se seed; date/mechanic change par client fetch.
6. Pattern wahi jo `src/lib/server-jobs.ts` + `JobsBody` me hai: server page →
   fetch lib → client body props/`initialData`; filters `searchParams` se, taaki
   filter change par bhi server data mile (client-side full refetch nahi).
7. Pure data-source move — koi calculation/UI logic rewrite nahi. Jo helper
   extract ho, uska vitest add karo.

**Invariants:** screen aur print/CSV ke numbers same (balancesheet me already
shared module se aate hain — isi ko maintain karo), print HTML bytes me sirf
intended change.

**Accept:** §1 ke report targets; hydration errors 0; gates green.

### WS-D — Report payload aur batching (P2.5, 2–3 din)

**Problem:** kai reports poora ledger ek saath fetch karke browser me aggregate
karte hain — bada JSON + main-thread cost.

**Kaam:**

1. Summary/KPIs server par compute karo (`buildBalanceSheet` jaisa pure helper);
   detail rows tab-wise ya paginated bhejo, poora dataset ek payload me nahi.
   **Status:** balancesheet/accounting-dashboard ke numbers shared module me
   server par hi compute hote hain; cash-flow/monthly-profit ka detail payload
   abhi bhi poora jata hai (tab/drill-down ke liye) — runtime payload measure
   hone tak tab-wise split deferred.
2. ✅ **DONE (2026-11-01)** W3c: `reports/accounting-dashboard` queries
   28 → 21, do sequential waves → ek `Promise.all`; shared
   `src/lib/accounting-dashboard-data.ts` + server seed. Detail §5.1.
3. Default payload target < 200 KB (balancesheet), tab switch locally < 300 ms —
   runtime measurement owner-approved window me (WS-E precondition).

**Constraint:** koi DB change nahi — wahi tables, wahi queries, sirf transport
aur aggregation ki jagah badal rahi hai.

### WS-F — Query/cache hygiene (P4, 1 din)

- ✅ **DONE (2026-11-01)** `system_info`/firm-info reads `React.cache` se
  per-request dedupe (`src/lib/server-firm-info.ts`); `server-jobs.ts` +
  `server-clients.ts` dono isi ek read ko share karte hain.
- ✅ Remaining report modules (WS-C/D) ek hi `Promise.all` wave use karte hain.
- ✅ Projections audit done — converted report paths explicit columns use karte
  hain; bache hue `select("*")` single-row detail fetch (print/edit by id) ya
  scope ke bahar list pages hain jahan fields broadly used hain, isliye
  intentional chhode.
- **Kabhi nahi:** ledger/salary/balance numbers ko HTML/API/SW cache me stale
  karna (audit A4 lesson) — koi money cache nahi add hua.

### WS-G — Service worker + Sentry overhead check (0.5 din)

- ✅ **DONE (2026-11-01)** Serwist sirf production me register hota hai
  (`PWAHead`: `NODE_ENV === "production"`); dev me unregister + caches clear.
- ✅ Precache verified (prod build): `sw.js` 52,051 bytes, 228 entries — sirf
  content-hashed `/_next/static/**` + public icons/manifest/tool HTML; koi route
  HTML/RSC entry nahi. HTML/RSC/API runtime rules NetworkOnly; `navigationPreload`
  on.
- ✅ Sentry: replay integration bundle me hi nahi (`replayIntegration` export
  available nahi) → `replays*` options dead the, remove kiye. Error tracking +
  `tracesSampleRate: 0.1` unchanged. Koi measurable runtime change nahi.

### WS-E — Boot-gate lift (P3, 4–6 din, alag gated sprint)

**Yahi perceived-speed ka sabse bada lever hai** — abhi har route par splash tab
tak dikhta hai jab tak `authReady` nahi (`RootClient.tsx:1398`), content DOM me
hi nahi aata; isliye LCP bhi splash par rukta hai.

Par yeh **high risk** hai (auth/license/SW/idle-logout entanglement) aur pehle
Stage 1 (content SSR behind splash) net-negative nikla. Isliye:

- Precondition: WS-B/C/D done + real-device/field data jo kahe ki first-paint
  content chahiye.
- Staged: Stage 2 (shell SSR-safe) → Stage 3 (gate post-hydration enhancement),
  har stage feature flag + independent revert.
- Verification matrix: auth expired/revoked, license gate, idle logout, SW
  stale-cache reload, hydration mismatch, mobile drawer.
- **First wave me nahi.** Owner approval ke baad dedicated window.

---

## 4. Explicitly out of scope

- **DB changes:** koi schema/migration/index/data write nahi (indexes Oct 18 me
  already applied).
- v2 jaisa full rewrite ya features hatana.
- SSR content behind opaque splash (proven zero-win).
- Business numbers ko cache karna (stale risk).
- `purchase-orders` jaisi full-register lists par artificial pagination bina
  product decision ke (history chhupna = business problem).

---

## 5. Order aur effort (honest, single-owner)

| Phase                     | Kaam                                     | Din                   |
| ------------------------- | ---------------------------------------- | --------------------- |
| 0                         | Measurement harness + budgets            | 0.5–1                 |
| 1                         | WS-B bundle diet                         | 1–2                   |
| 2                         | WS-C reports first paint                 | 2–3                   |
| 3                         | WS-D payload/batching + WS-F/G           | 2–3                   |
| 4                         | WS-E boot-gate lift (gated, alag sprint) | 4–6                   |
| **Core first wave (0–3)** |                                          | **~6–9 working days** |

Har phase ke baad wahi 6 routes re-measure; target miss ho to agla phase shuru
na karo — pehle us phase ka rollback/iterate.

### 5.1 Implementation log — 2026-11-01

**Phase 0 (build-level baseline; runtime Lighthouse pending):**

- `.next/static/chunks`: 7.4 MB / 208 files (production build).
- Per-route referenced chunks (upper bound, build manifest se): `/jobs` 661 KB,
  `/dashboard` 598 KB, `/clients` 604 KB, `/reports/balancesheet` 589 KB,
  `/inventory` 748 KB, `/login` 580 KB.
- Shared baseline ~536 KB (React/Next runtime + supabase-js + sonner + query
  client) — isliye route-level JS diet ka ceiling chhota hai; first-paint data
  (WS-C) ka impact zyada hai.
- Runtime Lighthouse/CDP measurement **nahi chali**: `perf:check` authenticated
  login maangta hai aur live DB par presence/last-seen writes kar sakta hai —
  DB freeze constraint ki wajah se owner-approved window me hi chalega.

**WS-B (first slice):**

- RootClient: `TeamOnline`, `ShortcutHelpOverlay`, `LicenseGate` dynamic chunks.
- `optimizePackageImports` **nahi add kiya** — Next 16 default optimize karta hai.
- Delta: har route ~-12–13 KB (-2%). `/jobs` 661→648, `/dashboard` 598→586,
  `/clients` 604→592, `/inventory` 748→735, `/login` 580→568.
- `SidebarNav` extraction abhi pending (agla lever).

**WS-C (balancesheet):**

- `page.tsx` ab server component: `requireStaffWithRole` (admin/developer only,
  warna `/login` ya `/dashboard` redirect), `force-dynamic`,
  `getServerSupabase()` + `fetchBalanceSheetData()`. Fetch fail ho to
  `initialData=null` → body purana client fetch path.
- `BalancesheetBody.tsx` (purana client page): state `initialData` se seed;
  mount par API call skip (`fetchedRangeRef`); date/filter change par API call
  jaise pehle. `asOn` input semantics preserved (explicit value hi input me
  dikhta hai, default blank).
- API `/api/reports/balancesheet` unchanged (filter changes/refesh ke liye).
- Smoke (production `next start`, bina login): `/reports/balancesheet` →
  307 `/login`; `/api/reports/balancesheet` → 401. Koi DB write nahi.
- Gates: `tsc` clean · eslint clean · vitest **580/580** · `next build` green.

**WS-C (baaki 4 reports, 2026-11-01):**

- `cash-flow`: shared `src/lib/ledger-data.ts` (poora ledger computation, IST
  boundaries, double-count rules same); `/api/reports/ledger` thin route ban
  gaya (auth + validation + shared module). `page.tsx` server
  (`requireStaffWithRole`, `force-dynamic`) + `CashFlowBody` (`initialData`,
  `fetchedRangeRef`) — mount par fetch skip, date change par API.
- `monthly-profit`: shared `src/lib/monthly-profit-data.ts` (single-pass month
  buckets, GATE-C behaviour preserved); server page year resolve karke
  `initialData` + `initialRawData` deta hai; body mount par refetch skip,
  year change par shared module client-side. Trade-off: drill-down `rawData`
  bhi RSC payload me — measure karna hai.
- `pending-jobs`: shared `src/lib/pending-jobs-data.ts`; server page URL filters
  (`from`/`to`/`status`) resolve karke pehla page seed karta hai; React Query
  `initialData` sirf matching key par, `staleTime` 30s.
- `daily-done`: shared `src/lib/daily-done-data.ts` (dual-era log parsing, firm
  info, mechanics, items); aaj ka data + mechanics + firm info server se seed;
  date/mechanic change par client fetch.
- Sab me service-role use nahi hua (cookie+RLS `getServerSupabase`), koi DB
  change nahi. Seed fail → client fetch fallback.
- Smoke (`next start`, bina login): chaaron routes 307 `/login`; ledger API 401.
- Gates: `tsc` clean · eslint clean · vitest **580/580** · build green; build
  table me chaaron routes `ƒ`.

> Build ke dauran ek baar disk full (`os error 112`) se Turbopack panic hua;
> `.next` (regenerable build cache) delete karke rebuild green. Repo/DB files
> ko koi nuksan nahi.

**WS-D (accounting-dashboard batching, 2026-11-01):**

- Shared `src/lib/accounting-dashboard-data.ts`: poora calculation wahi
  (IST period boundaries, `delete_flag=0` opening balance, salary-history rate,
  receivable formula, cash/inventory/loans). Server page `from`/`to` resolve
  karke `initialData` deta hai; body mount par fetch skip (`fetchedRangeRef`),
  filter change par wahi shared module client-side — screen/first-paint drift
  impossible.
- Queries **28 → 21**; do sequential waves (period + all-time) → **ek
  `Promise.all`**. Merge sirf un reads par jahan columns superset the
  (`transaction_list`, `client_payments`, `direct_sales`, `loan_payments`,
  `client_list`); period vs as-of timezone boundaries alag rakhe gaye, isliye
  numbers identical.
- Koi DB change nahi; service-role use nahi (cookie+RLS). Seed fail → server page
  `initialData=null` deta hai aur body mount par fetch karti hai (zero-flash nahi).
- `src/lib/accounting-dashboard-data.test.ts` (2 tests): mocked PostgREST se
  aggregates + as-of balances verify; isi test ne `inventoryAll` destructuring
  bug pakda (unbounded inventory read array ke bajaye `{data}` de raha tha) —
  fix ke baad tests green.

**WS-F (query/cache hygiene, 2026-11-01):**

- `src/lib/server-firm-info.ts`: `React.cache()` per-request `system_info`
  read; `server-jobs.ts` + `server-clients.ts` dono ab isi se (ek read).
- WS-C/D modules sab ek hi `Promise.all` wave me queries chalate hain.
- `select("*")` audit: converted 6 report paths explicit projections; bache
  hue hits mostly single-row detail fetches (print/edit by id) ya WS-C scope ke
  bahar list pages — fields broadly used, blind trimming UI break risk, isliye
  intentional.

**WS-G (SW + Sentry, 2026-11-01):**

- SW registration srif production (`PWAHead`); dev me unregister + caches clear.
- Built `/serwist/sw.js`: **52,051 bytes, 228 precache entries**; entry scan me
  sirf `/_next/static/**` + public icons/manifest/tool HTML — koi route
  HTML/RSC nahi. HTML/RSC/API handlers NetworkOnly; `navigationPreload: true`.
- Sentry: replay integration bundle me nahi (`replayIntegration` export hi
  nahi) → `replaysSessionSampleRate`/`replaysOnErrorSampleRate` dead config the,
  remove kiye. Error tracking + `tracesSampleRate: 0.1` unchanged; measurable
  runtime change nahi.
- `SidebarNav` (~895 LOC, desktop + drawer shared) extraction deferred —
  authenticated visual verification ke bina safe nahi; alag commit.

**Final gates (WS-D/F/G ke baad, 2026-11-01):**

- `tsc` clean · eslint clean · vitest **582/582** · `next build` green.
- Build output: chhe converted routes dynamic (`ƒ`); `/reports/accounting-dashboard`
  bhi server-seeded.
- Unauth smoke (`next start`, port 3100): balancesheet, cash-flow, monthly-profit,
  pending-jobs, daily-done, accounting-dashboard → **307 `/login`**; ledger API
  → **401**. Koi DB write/read side-effect nahi.

---

## 6. Risks aur mitigations

| Risk                                             | Mitigation                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Lighthouse variance (same build 40/59/45 seen)   | Median of 3 + CDP metrics; decision CDP delta par, single LH score par nahi          |
| RSC conversion se report filters/CSV/print toote | Pure data-source move; print/CSV golden comparison; per-report commit + revert       |
| Bundle split se chunk-load failure (PWA/SW)      | Serwist precache verify; prod build smoke; dynamic import fallback error boundary    |
| Boot-gate lift se auth/license regression        | Alag flag + staged sprint + full regression matrix; first wave me nahi               |
| Numbers screen vs print drift                    | Shared server module (`balance-sheet-data.ts`) hi single source rahe; invariant test |
| Season/business disruption                       | Deploy sirf owner-approved window me; har phase independently revertible             |
| Scope creep (121 pages)                          | Sirf top routes/5 reports; baaki "measure karke" baad me                             |

---

## 7. Open decisions (owner)

1. Reports ke pehle 5: balancesheet, cash-flow, monthly-profit, pending-jobs,
   daily-done — theek hain ya koi swap?
2. Boot-gate lift (WS-E) ko post-season dedicated sprint ke roop me approve
   karna hai ya abhi sirf WS-B–D?
3. §1 ke perf budgets accept hain?
4. Deployment window kaunsa (season freeze respect)?
5. v2 ka long-term role kya hai (parallel product / future replacement)? Isse
   pata chalega ki kaunsa kaam v2 me duplicate hoga.

---

## 8. Evidence appendix (read-only, 2026-11-01)

- Chunk size: `du -sh .next/static/chunks` → ours 7.4M / 208 files; v2 1.1M / 27 files.
- Pages: `find src/app -name page.tsx` → 121 total, 99 `"use client"`; reports 31 total, 27 client.
- Deps: `package.json` → 34 production deps.
- Boot gate: `src/app/layout.tsx:128` wraps children in `RootClient`;
  `src/app/RootClient.tsx:1398` splash branch.
- Reports pattern: `src/app/reports/balancesheet/page.tsx:1` client;
  fetch at `:199`.
- No package-import optimisation: `next.config.ts:54-61`; v2 has it at
  `vtech-next-v2/next.config.ts:20`.
- RSC already done: `src/app/jobs/page.tsx`, `src/app/clients/page.tsx`,
  `src/app/(dashboard)/dashboard/page.tsx`, `src/app/inventory/page.tsx` are
  server pages with client bodies.
- Prior results: `/jobs` mobile perf 56→68, TBT 2413→766 ms
  (`ssr_boot_gate_plan.md`); clients RSC LCP 10.13→5.2–5.9 s
  (`rsc_phase4_plan.md`).

> **DB safety:** is plan ka har item read-only queries ya build-time code change
> hai. Koi test/cron/smoke data write nahi karega. Implementation se pehle
> owner approval + deployment window confirm karna hai.
