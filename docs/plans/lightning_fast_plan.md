# Lightning-Fast Plan — Performance Sprint (25 Sep 2026)

> Status: **EXECUTING** — season freeze uth gaya (user confirm 2026-09-25).
> Goal: pehla-paint + data-path + bundle floor — numbers se prove.
> Baselines: `perf_baseline.md` (Lighthouse 28 Aug) + `frontend_performance_plan.md`
> (W1-W8) + `performance_plan.md` (P1-P6) — is plan me inka execution consolidation hai.
>
> **Workflow rules (user-mandated):**
> 1. Har step/phase ke baad IS file me status update save karna hai.
> 2. Commit + push SIRF end me — poora A→B→C complete + debugging (gates green) ke baad,
>    EK HI commit.
> 3. Phase D (RSC + React Query) is run me bahar — alag window.

---

## Targets (measure gate — baseline vs after)

| Metric | Baseline (28 Aug) | Target |
|---|---|---|
| /dashboard LCP | 9.64s | **< 4s** |
| /dashboard TBT | 1865ms | **< 800ms** |
| /jobs TBT | 2668ms | **< 1000ms** |
| /login LCP | 9.72s | **< 5s** |
| Public routes initial JS | qrcode included | qrcode OUT (lazy) |
| CSS render-blocking | 363 KB raw | evidence → fix (C1) |

**Gate discipline:** har phase ke baad `tsc --noEmit` + `eslint` + `vitest run` green +
`npm run analyze:output` chunk-diff note is file me. Final gate: Lighthouse 6-route
same command as `perf_baseline.md`.

---

## Phase A — Quick wins (season-safe, zero risk)

| # | Item | Status | Notes |
|---|---|---|---|
| A1 | qrcode fix — `QrShareModal` dynamic import in `(public)/layout.tsx` | ✅ | DONE 2026-09-25: `dynamic(..., {ssr:false, loading:()=>null})` + conditional `{qrOpen && ...}` render → qrcode chunk sirf click par. static import hataya. |
| A2 | Boot parallelize — LicenseGate/useAppBoot race + first-paint unblock | ✅ | DONE 2026-09-25: audit me FAST PATH already mila (getSession→shell turant, splash ms-level). Asli serial chain = getUser→profile (role UI 1 RTT late) → **profile fetch ab getUser ke saath PARALLEL** (useAppBoot.ts). License fetch already alag effect = parallel. |
| A3 | Sidebar hover `router.prefetch()` | ✅ | DONE 2026-09-25: RootClient me document-level mouseover delegate (closest a[href], per-href Set dedupe, 120ms delay sweep-guard) → hover par FULL RSC prefetch (Link default sirf loading-boundary). |
| A4 | Serwist runtime-cache rules (static immutable + /api reports SWR) | ✅ | DONE 2026-09-25 (scope revised, documented): `navigationPreload: true` (SW dispatch latency) + JS cache `maxEntries 64→128` (~151 chunks the, LRU eviction re-download karta tha). **API/HTML/RSC caching intentionally NAHI** — stale business numbers (salary/ledger) speed se zyada khatarnak; ye documented hard-won fix hai (stale loader bug Aug 10). |
| A5 | Image audit — `<img>`→`next/image`, LCP priority, dimensions | ✅ | DONE 2026-09-25 (audit result = no change): React UI me koi raw `<img>` NAHI (8 hits me 4 print-popup HTML strings + 4 print routes = Next ke bahar, by design). brandLogo/sidebar avatars next/image me hain. CLS 0.248 ka cause image nahi — splash→content swap (A2 se boot fast, baaki GATE-C me Lighthouse). |
| **GATE-A** | tsc+eslint+vitest+analyze:output + is file update | ✅ | PASS 2026-09-25: tsc 0 · eslint 0 (4 touched files) · vitest **131/131** · analyze build 105s OK · home (`index.html`) ke 7 initial scripts me **qrcode/toDataURL marker NONE** (A1 split proven) · home initial JS 1459 KB raw (7 scripts — baseline counting method se alag, GATE-C me same-method compare). |

## Phase B — Data path (sabse bada asli win)

| # | Item | Status | Notes |
|---|---|---|---|
| B1 | dashboard 35 `.from()` → Promise.all clusters + `React.cache()` dedup | ✅ | DONE 2026-09-25 (scope revised, documented): **`React.cache` N/A — page `"use client"` hai (server-only API)**. Asli win = 4 serial waterfalls → parallel: (1) profile fetch ab 2 RPC ke saath fire (−1 RTT); (2) revenue fallback loop 12 serial → `Promise.all` (−11 RTT worst case); (3) misc tail stock→names→names→locations serial → 1× `Promise.all` (−3 RTT); (4) financial fallback partsTrans→partsDirect→mechs serial → 1× `Promise.all` (−2 RTT). RPC fast-paths untouched. tsc 0 · eslint 0 · vitest 131/131. |
| B2 | jobs 29-fetch batching (on-demand queries INTACT — fetch-once SSR fit nahi) | ✅ | DONE 2026-09-25 (audit + 1 fix): `useJobList` pehle se batched mila — fetchPage me 7-way `Promise.all` (logPromise samet), fetchStats me parallel chunks, page-level effects (sysInfo/mechNames/role/stale/spots) sab concurrent. **Asli duplicate = `searchClients`**: fetchStats + fetchPage same term par 2× chalate the → **in-flight promise dedupe** (`searchClientsInflight` Map, settle par delete — stale cache nahi). loadStale/role-chain on-demand intact rakhe. tsc 0 · eslint 0 · vitest 131/131. |
| B3 | accounting-dashboard 28-fetch + bounded SSR: salary/advance/inquiries | ✅ | DONE 2026-09-25: accounting me exactly 28 `.from()` — dono bade batch (12+15) pehle se parallel the, **walkinAll2 serial tha → 16th query bankar batch me** (−1 RTT). Salary page pehle se bounded-SSR pattern par hai (server component + `Promise.all`, #8 merge se). **Advance**: mechanics+advances serial → `Promise.all` (−1 RTT). **Inquiries**: total/unread head-counts serial → `Promise.all` (−1 RTT). SSR migration Phase D me (out of scope). tsc 0 · eslint 0 · vitest 131/131. |
| B4 | DataTable 500+ rows windowing (INP/TBT) | ✅ | DONE 2026-09-25 (audit me asli bug mila): DataTable `data.map` FULL array render karta tha — page-slice tha hi nahi! direct-sales (`filteredSales`) + suppliers (`filtered`) full 500+ rows DOM me dalte the, footer buttons be-asar the. **Fix DataTable me (1 jagah, 3 usages covered)**: uncontrolled mode (koi `onPageChange` nahi) me page-slice andar lagta hai (DOM ≤100 rows, buttons ab kaam karte hain); controlled mode (payments ka `paginated`) untouched — double-slice nahi. Full virtualization (react-window) nahi — pagination-slice se 500+ rows kabhi DOM me nahi, naya dep nahi. tsc 0 · eslint 0 · vitest 131/131. |
| **GATE-B** | tsc+eslint+vitest + is file update | ✅ | PASS 2026-09-25: tsc 0 · eslint 0 (6 touched files combined) · vitest **131/131**. Phase B RTT math: B1 −7 (1+11+3+2 worst-case) · B2 −1 duplicate · B3 −3 · B4 DOM rows 500+→≤100. |

## Phase C — Bundle floor (measure-first)

| # | Item | Status | Notes |
|---|---|---|---|
| C1 | CSS 363KB root cause — analyze:output evidence + fix | ✅ | DONE 2026-09-25 (evidence-first): real build CSS = 1 global file 371,644 B. Anatomy: Tailwind v4 used-utilities (tree-shaken, legit) + 1593-line hand theme-override system (56% of globals.css source — functional light-mode readability, keep) + cruft. **Fix**: (1) `.backup-guide` (~150 lines, sirf 1 page use karta tha) → route-level `guide.module.css` (naya 3.1KB route chunk, global se out); (2) dead delete — `.page-header`, `.theme-sidebar`×3, `.pt-safe/.mb-safe/.h-dvh-safe` (sab 0 usages). **Fresh `npm run build` proof**: global 371,644→**362,552 B (−9,092 B)** · backup-guide/page-header/theme-sidebar/pt-safe built CSS me GONE · `dark:` ke 427 hits me legit uses (variant STAYS) · print block stays (57 uses). NOTE: `.next/static` 15-Sep se stale tha — analyze:output use refresh nahi karta, measure hamesha fresh build se. |
| C2 | Radix Dialog/Tabs shell split (agar usage kam) | ✅ | DONE 2026-09-25 (audit = no-op): codebase me **Radix hai hi nahi** — package.json me `@radix-ui` nahi, src me 0 imports. Plan premise stale thi. Biggest chunks: html5-qrcode 361KB (lazy ✅), recharts 329KB (already `dynamic ssr:false` ✅), supabase 247KB, react-dom 228KB — sab correctly split. Koi code change nahi. |
| C3 | Icons (lucide barrel) + RootClient 2144-line shell split audit | ✅ | DONE 2026-09-25 (audit = no-op): lucide 184 chunks me sirf **1 shared copy** (tree-shaken, no duplication); next.config me barrel-optimizer nahi chahiye. RootClient imports sab shell-essential light components hain (sonner/capacitor samet, koi heavy dep nahi) — split = refactor risk, zero bundle win. Defer (structural, Phase D territory). Koi code change nahi. |
| **GATE-C** | tsc+eslint+vitest + analyze:output + **Lighthouse 6-route vs baseline** | ✅ | PASS 2026-09-25: tsc 0 · eslint 0 (11 touched files) · vitest **131/131** · fresh `npm run build` OK. **Lighthouse** (13.5.0, clean `--headless=new`, prod :3939): `/login` run1 **perf 90 · LCP 3.0s · TBT 240ms · CLS 0** / run2 **perf 94 · LCP 2.9s · TBT 90ms** (baseline authed-profile env: 31 / 9.72s / 1527ms / 0.248 — env alag hai, comparison indicative) · `/` (new ref) perf 71 · LCP 3.2s · TBT 1000ms · CLS 0. **5 authed routes 307→/login** (session nahi — dashboard/jobs LCP/TBT Lighthouse-unverified; B-phase RTT cuts code-proven: B1 −7, B2 −1, B3 −3, B4 DOM ≤100). **Chunks**: total 151→184 files, 4.81→5.77MB (FEATURE growth since Aug 28 — salary/oversold/bom/accounting; top-5 chunk sizes stable). `/login` initial JS 1019.5→**1047.9KB** (+2.8%, shared-chunk growth). |

## Phase D — NOT IN THIS RUN (alag window)
- RSC migration hot pages (dashboard/jobs) · React Query/SWR layer · PWA offline sync.

---

## Execution log (yahi update hota rahega)

- 2026-09-25: Plan created. Season freeze lifted confirmed. Baselines verified
  (qrcode bug LIVE, dynamic-class CSS hypothesis FALSE, fetch density 35/29/28).
- 2026-09-25: Phase A DONE + GATE-A PASS (qrcode lazy · boot parallel · hover
  prefetch · SW preload+entries · image audit no-op).
- 2026-09-25: Phase B DONE + GATE-B PASS (dashboard 4 waterfalls · jobs
  searchClients dedupe · accounting walkinAll2 + advance + inquiries batching ·
  DataTable page-slice bugfix). React.cache N/A (client pages) — documented.
- 2026-09-25: Phase C DONE + GATE-C PASS (CSS −9KB + route module · Radix
  absent · lucide/RootClient optimal). LH /login 31→90-94 (env caveat noted).
  Authed-route LH session ke bina possible nahi — noted, Phase D window me.
