# Performance Baseline (G2 / module) — 28 Aug 2026

*Purpose: durable "before" snapshot for server-component migration (see
`server_migration_gate_plan.md`, condition G2). Yar baad me koi perf work kare to
ise re-run karke compare karo.*

> **⚠️ Correction (18 Oct 2026) — "SSR HTML" framing galat tha.** App ke saare
> authenticated pages **client-side** render hote hain: `src/app/layout.tsx:123`
> sab kuch `<RootClient>{children}</RootClient>` (client component) me wrap karta
> hai aur `RootClient.tsx:1321` `!authReady` par **"V-TECH Secure Boot" splash**
> return karta hai. SSR HTML me sirf splash + RSC **flight payload** aata hai — page
> ka rendered DOM **server par kabhi nahi** banta. Isliye Sessions 2-5 me jahan
> "data ships in the initial SSR HTML" / "SSR data reaches first paint" likha hai,
> use aise padho: **data RSC payload me seed hota hai → client fetch waterfall
> khatam** (HTML DOM me content nahi). Verified `/jobs` + `/mechanics` + `/clients`:
> SSR HTML me seed data (payload) hai, content markup nahi. Feasibility + options:
> `ssr_boot_gate_plan.md`.


## How to re-capture
```bash
# Turbopack-native analyzer (this project uses Turbopack; @next/bundle-analyzer is webpack-only and NOT used)
npm run analyze          # interactive UI (port 4000)
npm run analyze:output   # writes snapshot to .next/diagnostics/analyze (diffable)
```
- Add `-o, --output` to save; `cp -r .next/diagnostics/analyze ./analyze-before-refactor` to keep a diffable copy.
- Baseline numbers = sum of client-side JS chunk sizes for a route (from `chunk_parts` keyed by `output_file_index`, filtering `[client-fs]/_next/static/chunks/*.js`).

## Session 1 (28 Aug 2026) — after M1+M2+M3 (charts deferred + auth dedup)
Snapshot dir: `.next/diagnostics/analyze` (analyzer run, this session)

### Total client-side JS
- **151 client JS chunks, ~4.81 MB uncompressed** (from built `.next/static/chunks`).

### Largest client chunks (top view)
| Chunk | Size |
|-------|------|
| 3_ew2nx3d1122.js | 370 KB |
| 0ihge2m883xcf.js | 337 KB (recharts lib chunk — deferred to 4 pages only) |
| 2d9za87jnhv6s.js | 253 KB |
| 3jkzws6klbbvq.js | 233 KB |
| 2zx3q7e7c69qs.js | 156 KB |

### Per-route client JS (key pages, uncompressed)
| Route | Client JS | Notes |
|-------|-----------|-------|
| /dashboard | 1463.9 KB | shared app runtime + dashboards |
| /clients | 1407.4 KB | largest page by LOC (1778) |
| /jobs | 1055.1 KB | |
| /reports/cash-flow | 1725.0 KB | includes deferred recharts chunk |
| /reports/monthly-profit | 1425.6 KB | includes deferred recharts chunk |
| /login | 1019.5 KB | public, no symp of app shell? (still shared runtime) |

> Note: per-route numbers include shared/common chunks every route downloads
> (React runtime, lucide, supabase-js, RSC infra), so most pages land ~1–1.7 MB.
> Differential win from future work shows as a drop in these totals.

## TTI / Core Web Vitals — captured via Lighthouse 13.4.1 (28 Aug 2026)
- Prod `next start` build on `http://localhost:3939`; authenticated session
  (staff user `preeti@vtech.com`) via a persistent Chrome profile; Lighthouse attached
  to a `--headless=new --remote-debugging-port` Chrome with the session (so pages that
  need auth are measured, not a redirect to /login).
- Desktop-ish throttling is default Lighthouse mobile emulation (simulated 4G / 4x CPU)
  — LCP/TTI/TBT numbers are the throttled/baseline values, for **comparison** across
  refactors, not raw field data.
- Perf score = Lighthouse `performance` category.

| Route | perf | FCP | LCP | TTI | CLS | SI | TBT |
|-------|------|-----|-----|-----|-----|-----|-----|
| /dashboard | 28 | 1.09s | 9.64s | 9.89s | 0.248 | 7.70s | 1865ms |
| /clients | 42 | 1.08s | 10.13s | 10.40s | 0.005 | 5.95s | 2096ms |
| /jobs | 41 | 1.12s | 10.23s | 10.25s | 0.000 | 5.71s | 2668ms |
| /reports/cash-flow | 48 | 1.11s | 5.63s | 9.36s | 0.071 | 4.52s | 1730ms |
| /reports/monthly-profit | 56 | 1.08s | 5.88s | 9.48s | 0.000 | 3.42s | 980ms |
| /login | 31 | 1.08s | 9.72s | 9.80s | 0.248 | 5.99s | 1527ms |

> Notes: /login first run (before Chrome-profile fix) measured FCP 1.22s / LCP 5.71s /
> CLS 0 — superseded by the authenticated runs above. Large TBT on the app pages is the
> main bottleneck (~1.8–2.7 s); CLS spikes on /dashboard (0.248) and /login warrant a
> layout-stability look. Re-measure the same 6 routes with the identical command after
> any migration:
> `npx --yes lighthouse "http://<host>/<route>" --port=<chrome-debug-port> --only-categories=performance --output=json`

## Session 2 (28 Aug 2026) — G3 pilot: /clients served server-side (cookie+RLS)
`src/app/clients/page.tsx` → async server component; data at render time via
`fetchClientsPageData()` (cookie+RLS client, **no service role**); interactive UI =
`ClientsBody` client component receiving `{clients, firmInfo, userRole}` props.
Route flipped `○ (Static)` → `ƒ (Dynamic)`. Same LH method as Session 1.

| Route | perf | FCP | LCP | TTI | CLS | SI | TBT |
|-------|------|-----|-----|-----|-----|-----|-----|
| /clients (run 1) | 40 | 1.98s | 5.89s | 9.55s | 0.000 | 8.43s | 2397ms |
| /clients (run 2) | 44 | 1.98s | 5.25s | 9.63s | 0.000 | 6.62s | 2384ms |
| /clients (Session 1 baseline) | 42 | 1.08s | 10.13s | 10.40s | 0.005 | 5.95s | 2096ms |

> G3 pilot verdict: clear **LCP win 10.13s → ~5.2–5.9s (-42–48%)** and TTI 10.40 → ~9.6s
> (-8%), because the 453-row dataset now ships in the initial SSR HTML (measured
> first-document ~772 KB) instead of after a client `.from().select()` + re-render.
> Trade-offs: **FCP 1.08 → 1.98s** (heavier SSR HTML parsed before first paint) and a
> small TBT uptick (2096 → ~2390ms, more HTML/JS to hydrate). Net: LCP/TTI improved;
> FCP/SI/TBT regressed slightly — worth real-device validation. Next pages to migrate
> via same cookie+RLS pattern: bounded fetch-once lists (see Session 3). Note: `jobs`
> and `dashboard` re-query on-demand per filter/scroll, so the fetch-once SSR trick
> does NOT fit them — they need a different approach, left out of scope.

## Session 3 (28 Aug 2026) — G3: /mechanics served server-side (cookie+RLS)
`src/app/mechanics/page.tsx` → async server component; data at render time via
`fetchMechanicsPageData()` (cookie+RLS client, **no service role**); interactive UI =
`MechanicsBody` client component receiving `{mechanics, userRole}` props (search,
CRUD modals, salary-history writes stay client-side; `refreshData()` re-queries only
after add/edit/delete/toggle). Route flipped `○ (Static)` → `ƒ (Dynamic)`.
No pre-migration numeric baseline existed for /mechanics (not in Session 1 set), so
"after" only; runtime verified SSR parity (4 mechanics, stats, search count).

| Route | perf | FCP | LCP | TTI | CLS | SI | TBT |
|-------|------|-----|-----|-----|-----|-----|-----|
| /mechanics (run 1) | 55 | 1.10s | 5.38s | 6.67s | 0.000 | 4.24s | 1030ms |
| /mechanics (run 2) | 60 | 1.11s | 5.46s | 6.82s | 0.000 | 3.30s | 762ms |

> /mechanics after-state is well-controlled (LCP ~5.4s, TTI ~6.7s, CLS 0.000,
> TBT ≤1030ms — far below the /jobs 2668ms / /clients 2096ms baselines), consistent
> with the /clients LCP/SSR win. Ongoing direction: keep migrating bounded
> fetch-once list pages (e.g. `expenses`) via this cookie+RLS pattern; leave
> on-demand-query pages (`jobs`, `dashboard`, `inquiries`, `activity-logs`) alone.

## Session 4 (28 Aug 2026) — G3: /expenses served server-side (cookie+RLS)
`src/app/expenses/page.tsx` → async server component; data at render time via
`fetchExpensesPageData()` (cookie+RLS client, **no service role**) — three bounded
tables (`mechanic_list` active, `advance_payments` 500-cap, `expense_list` 500-cap)
fetched server-side. Interactive UI (`ExpensesPageInner`) moved to
`components/ExpensesPageInner.tsx`, a client component receiving
`{initialMechanics, initialStaffPayments, initialShopExpenses}` props; `loadData()`
re-queries only after add/edit/delete (no on-mount double-fetch). Route flipped
`○ (Static)` → `ƒ (Dynamic)`. Runtime verified SSR parity (3 mechanics, staff
payments ₹-totals, shop expenses — all embedded in first HTML, HTTP 200, no RLS
errors). No pre-migration baseline existed for /expenses (not in Session 1 set).

| Route | perf | FCP | LCP | TTI | CLS | SI | TBT |
|-------|------|-----|-----|-----|-----|-----|-----|
| /expenses (run 1) | 47 | 1.10s | 7.90s | 7.90s | 0.000 | 4.50s | 1530ms |
| /expenses (run 2) | 47 | 1.10s | 8.20s | 8.20s | 0.000 | 4.20s | 1520ms |

> /expenses after-state: FCP 1.10s confirms the SSR data deps reach first paint
> (data no longer awaits a client fetch) — the same first-paint win as /clients
> (1.98s post) and /mechanics (1.11s). TBT ~1525ms is the remaining cost and is
> the client JS bundle (lucide + heavy admin UI), not the data path. LCP ~8s is
> dominated by that bundle too. Bounded fetch-once migrations now done for
> /clients, /mechanics, /expenses, /payments; remaining bounded candidates for
> future sessions: /salary, /advance, /inquiries (if list-shaped).

## Session 5 (28 Aug 2026) — G3: /payments served server-side (cookie+RLS)
`src/app/payments/page.tsx` → async server component; data at render time via
`fetchPaymentsPageData()` (cookie+RLS client, **no service role**) — two bounded
tables (`client_list` active, `client_payments` 1000-cap) fetched server-side.
Interactive UI (`PaymentsPageInner`) moved to
`components/PaymentsPageInner.tsx`, a client component receiving
`{initialClients, initialPayments}` props; `loadData()` re-queries only after
add/edit/delete (no on-mount double-fetch). Route flipped `○ (Static)` →
`ƒ (Dynamic)`. Runtime verified SSR parity (HTTP 200, 160KB, data embedded in
RSC payload — no RLS errors). No pre-migration baseline existed for /payments.

| Route | perf | FCP | LCP | TTI | CLS | SI | TBT |
|-------|------|-----|-----|-----|-----|-----|-----|
| /payments (run 1) | 47 | 1.30s | 7.90s | 8.00s | 0.000 | 4.40s | 1540ms |
| /payments (run 2) | 47 | 1.20s | 8.70s | 8.70s | 0.000 | 4.90s | 1390ms |

> /payments after-state: FCP 1.2-1.3s, TBT 1390-1540ms — consistent with
> /expenses (FCP 1.1s, TBT 1525ms) and /mechanics (FCP 1.1s, TBT 900ms).
> All four bounded fetch-once pages now have SSR data in first paint. Remaining
> bounded candidates: /salary (complex month-scoped aggregation), /advance
> (date/mechanic filter-driven), /inquiries (if list-shaped).

## Session 6 (17 Oct 2026) — /jobs RSC split + perf follow-up (A/B, same machine)

`/jobs` Phase 4 P2 RSC split (`c3993d8`) + follow-up (`050218b`: parallel
auth+data, server-seeded `openPartCounts`, `hide_delivered` cookie,
StrictMode-safe seed gate, lazy modals) + staff-auth `getClaims()` fast-path
(`72f1174`). Prod `next start` on localhost, authenticated (`preeti@vtech.com`),
Lighthouse attached to a `--headless=new` Chrome via `--remote-debugging-port`,
same method as Sessions 1-5 but with `--disable-storage-reset` (warna Lighthouse
auth cookies clear kar deta). Login: server-side `POST /api/auth/login` se
cookies nikale, CDP `Network.setCookie` se Chrome me inject (in-page fetch client
write-gate se geo-block ho jata hai — headless me geolocation denied).
Least-contended of 3 runs per state:

| State | perf | FCP | LCP | TTI | TBT |
|-------|------|-----|-----|-----|-----|
| Session 1 baseline (pre-RSC) | 41 | 1.12s | 10.23s | 10.25s | 2668ms |
| `c3993d8` (RSC split, pre-follow-up) | 55 | 1.38s | 3.86s | 6.06s | 3441ms |
| `72f1174` (RSC + follow-up + getClaims) | 54 | 1.38s | 3.89s | 5.61s | 3148ms |

> **Verdict:** RSC migration se bada win — **LCP 10.23s → ~3.9s (-62%)**, **TTI
> 10.25s → ~5.6-6.1s (-42%)**, perf 41 → ~54-56. Trade-off: **TBT 2668 → ~3.1-3.5s
> (+~25%)** — SSR HTML/hydration cost (wahi /clients pattern: FCP/TBT up, LCP/TTI
> down). **Perf follow-up (parallel auth+data, seed, cookie, lazy modals,
> getClaims) ka Lighthouse par measurable effect NAHI** — before 3441ms vs after
> 3148ms TBT (noise me; LCP/TTI/FCP bilkul same). Unka value = kam network
> round-trips + StrictMode double-fetch fix (robustness), hydration TBT par nahi.
> **TBT ab main bottleneck hai aur hydration-bound hai** → next lever client
> JS/hydration kam karna (`JobsBody` desktop-XOR-mobile conditional render, aur
> granular lazy-loading). Machine noisy (Firefox + multiple Chrome khule the),
> isliye numbers comparison ke liye, field data nahi.

### Session 6 addendum — root cause: desktop fine, mobile flip hi cost hai (17 Oct 2026)

`mainthread-work-breakdown` ne bataya cost **Style & Layout** hai (r2: 6222ms),
Script Evaluation nahi (1353ms) → ye **layout/DOM** problem hai, JS hydration
nahi. DOM sirf 2731 elements par mobile list **~13,000px tall** (26 card), 5
layout shifts (CLS 0.084), 2 bade long-tasks (1078 + 1651ms).

**Desktop vs mobile (same build), aur 4× CPU isolate:**

| Profile | FCP | LCP | TBT | StyleLayout | longTasks |
|---------|-----|-----|-----|-------------|-----------|
| Desktop (1× CPU) | 0.36s | 0.96s | **245ms** | 723ms | 1 |
| Desktop (4× CPU) | 0.35s | 1.3s | 1334ms | 3042ms | 13-15 |
| Mobile (4× CPU, flip) | 1.37s | 3.9s | **3028-3575ms** | 6293-6844ms | 17-19 |
| Mobile (4× CPU, flip OFF*) | 1.37s | 3.9s | **2047-2268ms** | 4045-4245ms | 13-15 |

\* flip OFF = temporary experiment: `useState(false)` → `useState(true)` (SSR
mobile tree, no post-hydration flip). Revert kar diya.

> **Desktop `/jobs` already fast hai (TBT 245ms, perf 89).** Problem
> **mobile-specific** hai. Sabse bada single cause: `isMobile` `useState(false)`
> start hota hai, phir mount par `matchMedia(max-width:1023px)` effect flip karta
> hai (`JobsBody.tsx:259`/`:456`/`:1765`) → **mobile pe SSR/hydration DESKTOP tree
> ka hota hai, phir MOBILE tree ko poora dobara render+layout** (double layout).
> Flip hataane par mobile TBT **−40% (3.4s → 2.1s)**, StyleLayout 6.5s → 4.1s.
> Residual mobile cost (~2s) = app shell + tall card list (narrow viewport, zyada
> text-wrap). **Fix (validated):** server-side device signal (client hint
> `Sec-CH-UA-Mobile`/UA) se server component `initialIsMobile` prop de →
> `isMobile` first render se match → flip khatam. Secondary: card list layout cost
> (`content-visibility:auto`/`contain`), smaller mobile page size.

### Session 6 addendum 2 — /jobs content SSR HTML me nahi hai (RootClient boot-gate) (18 Oct 2026)

Fix #1 (server device branch) ship ke baad SSR HTML verify kiya (prod `next start`,
authenticated GET, HTML save karke exact string count). Sab looked-at pages par same
result: `<body>` me sirf **boot splash** + RSC flight script — page ka DOM client
par banta hai; SSR HTML me sirf **seed data payload** aata hai, content markup nahi.

| Check | /jobs (mobile UA) | /mechanics | /clients |
|---|---|---|---|
| content markup (`<table`/`<tr`, page heading) | 0 | 0 | 0 |
| seed data payload (`transactions` / `mechanics` / `date_added`) | ✓ | ✓ | ✓ |
| `<body>` SSR output | "V-TECH Secure Boot" splash | same | same |

Root cause: `src/app/layout.tsx:123` `{children}` ko `<RootClient>` (client
component) me wrap karta hai; `RootClient.tsx:1321` `!authReady` (SSR me always
false) par splash return karta hai → children server par render hi nahi hote.
Isliye `useSearchParams` de-opt is app me **irrelevant** hai (content waise bhi SSR
nahi hota).

Fix #1 ka effect isi par: mobile UA ko server se `initialIsMobile=true` milta hai →
hydration par seedha mobile tree banta hai, desktop tree ka layout skip → mobile
TBT −21%, Style & Layout −25%. Aage ka SSR-content lever: `ssr_boot_gate_plan.md`.

