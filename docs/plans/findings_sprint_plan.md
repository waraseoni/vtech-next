# Findings → Sprint Implementation Plan

> **Status: DONE — Sprint 0+1+2 implemented; Sprint 3/4 not triggered (perf:check ALL PASS) (18 Oct 2026)**
> Created: 18 Oct 2026 · Basis: `ssr_boot_gate_plan.md` (Option B Stage 1 rejected) +
> `frontend_performance_plan.md` (W-status staleness) + is-session ke findings.
> Goal: pending quick-wins implement karo, aur unhe **repeatable perf guard** se lock karo.
> Rule (user): **commit/push sirf poora plan complete hone ke baad — beech me nahi.**

## Scope

- **IN:** Sprint 0 (docs truth) · Sprint 1 (W5 cache headers) · Sprint 2 (perf-budget
  guard) · Sprint 3 (conditional: W3c + P3 cash-flow) · Sprint 4 (conditional: markup/CSS trim)
- **OUT (queue, trigger ke saath):** Passkey Ph1–6 · Phase 6 DB indexes · W8 react-query ·
  W6 RootClient split · P-R1/P-R2/P-R4

## Guard rails (har sprint par — ye rules non-negotiable)

1. **A4 no-cache rule:** `Cache-Control` sirf **static assets** par. Authenticated HTML
   aur `/api/*` par kabhi `s-maxage`/`public`/`immutable` nahi. Har header change ke baad
   curl assertion (andaza nahi).
2. **File-type editing:** `docs/**` = CRLF → sirf node-script se edit (edit-tool LF
   oldString fail hota hai); `src/**` = LF → edit tool; CRLF root configs (`next.config.ts`,
   `package.json`) = node script. Prettier check CRLF files par `--end-of-line crlf`.
3. **Gates (commit se pehle):** `prettier --check` (touched) → `npx eslint <touched>` →
   `npx tsc --noEmit` → `npx vitest run` (expect 375/375) → `npx next build` jab
   config/route badle → dev smoke.
4. **Ek hi push** (sare sprints baad me — release-bot churn avoid).
5. Live DB write kabhi nahi (free-tier, read-only practice).

---

## Sprint 0 — Docs truth sync (15–30 min, code nahi)

**Files:** `docs/TODO.md` (Phase A/B/C blocks) + `docs/plans/frontend_performance_plan.md` (§3 W-table + §6 TODO)

**Stale status vs reality (verified 18 Oct):**

| W-item | Actual | Evidence |
|---|---|---|
| W1 qr dynamic import | ✅ done | `src/app/(public)/layout.tsx:28` `dynamic(() => import("./components/qr-share"))` |
| W2 loading.tsx/Suspense | ✅ done | 13 `loading.tsx` (app, (dashboard), (public), clients, jobs, mechanics, …) |
| W3a dashboard batching | ✅ done | Phase 4 P1/P2 — `DashboardBody.tsx` `pageAll(...)` batches |
| W3b jobs batching | ✅ done | Phase 4 P2 — `050218b` parallel auth+data |
| W4 router.prefetch | ✅ done | `src/app/RootClient.tsx:1315` |
| W5 cache headers | ❌ pending → Sprint 1 | `next.config.ts` me pehle koi `headers()` nahi tha |
| W3c accounting batching | ❌ pending | `reports/accounting-dashboard/page.tsx` 877 ln, 28 `.from()`, sirf 2 `Promise.all` |
| W7 RSC hot pages | 🟡 partial | clients ✅ dashboard ✅ jobs ✅ · inventory/cash-flow ❌ |
| W6 bundle / W8 react-query | ❌ pending (post-season) | `package.json` me `@tanstack/react-query` hi nahi |

**Steps:**
1. node-script se `frontend_performance_plan.md` W-table me **Status column add**
   (W1/W2/W3a/W3b/W4 ✅, W5 ✅ Sprint-1 ke baad, W3c ❌, W7 🟡, W6/W8 ❌) + §6 markers.
2. node-script se `docs/TODO.md` Phase A: `[x]` W1/W2/W4/W5 · Phase B: `[x]` W3a/W3b,
   `[ ]` W3c · Phase C W7 partial note.
3. Verify: read-back (encoding intact, koi mojibake nahi), `git diff --stat` (sirf ye 2 docs).

**Commit:** `docs(todo): sync W1-W5/W7 actual status (W3c pending)`

---

## Sprint 1 — W5 static-asset cache headers (1–2h)

**File:** `next.config.ts` (CRLF → node script; edit-tool nahi)

**Measured gap (18 Oct, prod `next start`):**

| URL | abhi | target |
|---|---|---|
| `/icon-192x192.png` | `public, max-age=0` (har load revalidate) | `public, max-age=86400, stale-while-revalidate=604800` |
| `manifest.json` | `public, max-age=0` | `public, max-age=0, must-revalidate` (version-sensitive, explicit) |
| `/about`, `/` (public HTML) | `s-maxage=31536000` | **unchanged** (Next default) |
| `/_next/static/*` | immutable | **unchanged** |
| authed HTML (`/jobs`) | private/no-store | **unchanged — koi rule hi nahi** |
| `/api/*` | no-store | **unchanged — koi rule hi nahi** |

**Steps:**
1. `next.config.ts` me `async headers()` add (`redirects()` ke style me):
   ```ts
   async headers() {
     return [
       {
         source: "/:file((?:[^/]+\\.(?:png|jpg|jpeg|webp|svg|ico|gif|woff2?)))",
         headers: [
           { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
         ],
       },
       {
         source: "/manifest.json",
         headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
       },
     ];
   },
   ```
   **Rule: koi `source` HTML route ka nahi, koi API ka nahi.**
2. `npx next build` (config change) → `npx next start -p 3939`.
3. **Curl assertions (sab pass):**
   ```powershell
   curl.exe -s -I http://localhost:3939/icon-192x192.png   # contains: max-age=86400
   curl.exe -s -I http://localhost:3939/manifest.json       # contains: must-revalidate
   curl.exe -s -I http://localhost:3939/about               # contains: s-maxage=31536000 (unchanged)
   curl.exe -s -I http://localhost:3939/api/system-info     # NO s-maxage / NO public
   curl.exe -s -I <authed>/jobs                              # NO s-maxage / NO public
   ```
4. Gates: `tsc` + `next build` + prettier/eslint touched. Revert = 1 config file git-revert.

**Commit:** `perf(assets): cache public static assets (max-age 1d, SWR)`

---

## Sprint 2 — Perf budget guard `scripts/perf-budget.mjs` (1 session)

**Kyunki:** is machine par Lighthouse unreliable (same build: perf 40/59/45, TBT 600–2518ms)
→ deterministic CDP script hi guard rail (`ssr_boot_gate_plan` Stage 0).

**Files:** `scripts/perf-budget.mjs` (NEW) + `package.json` script `perf:check` (CRLF → node script)

**Flow:**
1. Precondition: `3939` listening (nahi to clear error: `npm run build && npm run start`),
   Chrome CDP `9222` alive (nahi to launch hint: `--headless=new --remote-debugging-port=9222
   --disable-storage-reset --user-data-dir=<profile>`).
2. Auth: `/login` par form-fill + submit (CDP `Runtime.evaluate`, React native setter + input
   event). Cookie-inject (`lh-auth`) nahi — fresh profile me session mismatch se `/login` par atakta hai.
3. Navigate `/jobs` (mobile UA + `Emulation.setCPUThrottlingRate(4)`), `PerformanceObserver`
   se FCP/LCP, ~8s idle → `Performance.getMetrics` → `RecalcStyleDuration`, `LayoutDuration`,
   `ScriptDuration`, `TaskDuration` + DOM node count.
4. Budget table print + exit code.

**Budgets (aaj ke basis; LCP jaan-bujhkar OFF):**

| Metric | Budget | Kyun |
|---|---|---|
| Style&Layout (Recalc+Layout) | **< 2000 ms** | Option A ke baad ~1690–1990ms; yehi original bottleneck tha |
| TaskDuration | **< 3000 ms** | Option A ke baad ~2800ms |
| DOM nodes | **< 1200** | aaj 878 (mobile, drawer closed) |
| FCP | **< 2500 ms** | aaj ~1675ms |
| LCP | ⚠️ **informational only** | ~6.1s boot-time Supabase latency par bound (flag ON/OFF dono same) — budget me daala to hamesha false-red |

5. `npm run perf:check` → non-zero exit on breach.

**Gates:** `tsc` + prettier + eslint.
**Commit:** `chore(perf): deterministic perf-budget check (CDP, CPU 4x)`

---

## Sprint 3 — Conditional, measure-first (1–2 sessions)

**Trigger:** Sprint 2 green **phir bhi** slow-feedback/field data bole. Alag commits, har ek ke baad `perf:check` before/after.

**3a. W3c `reports/accounting-dashboard` batching** (medium)
1. `page.tsx` (877 ln, `"use client"`) me serial chain dhoondho — 28 `.from()` me se jo
   2 `Promise.all` blocks (line ~83, ~245) ke bahar hain.
2. Unhe batch/parallel me move (RLS/session semantics same rakho — DATA_MIGRATION_NOTES rule).
3. Verify: page render, numbers same, `perf:check` + tsc/eslint/vitest.
4. Commit: `perf(reports): parallelize accounting-dashboard fetch batches`

**3b. Phase 4 P3 (optional) `reports/cash-flow` RSC move** (bigger)
1. 707 ln `"use client"` + `ssr:false` charts → body split: server `page.tsx`
   (`force-dynamic`, `requireStaffWithRole` + `getServerSupabase`) → props → client body
   (pilot pattern: `clients/page.tsx`).
2. Charts client hi rahein (chart libs SSR-unfriendly) — sirf data fetch server par.
3. Verify: numbers/filters/date-range exact-match, `perf:check`, gates.
4. Commit: `perf(reports): cash-flow server fetch (Phase 4 P3)`

---

## Sprint 4 — Conditional mobile markup/CSS trim (only if budget breach)

**Trigger:** Sprint 2 ka Style&Layout/Task budget **breach** ho.
1. `JobsBody` per-card markup audit (icons/elements count) — target: DOM < 1000.
2. CSS rule count (356KB/4266 rules) — Tailwind v4 output, unused-utility audit (measure-first).
3. Har change ke baad `perf:check` + scroll/cards regression (6→12→18→24→25).

---

## Post-season queue — abhi START NAHI

| Item | Effort | Trigger |
|---|---|---|
| Passkey Ph1–6 (`docs/TODO.md` sare `[ ]`) | 12–16h | G3 freeze khatam |
| Phase 6 DB indexes | session | peak-season freeze khatam |
| W8 react-query (**zero-cache** — dedupe/lifecycle only, A4) | 1–2 din | repeat-nav slow feedback |
| W6 RootClient split / P-R3 | 2–3 din | bundle budget breach (`analyze:output`) |
| P-R2 Sentry prod · P-R4 non-login rate-limit · P-R1 tests | medium | kabhi bhi |

---

## Definition of done (per sprint)

- [ ] Gates green (prettier/eslint touched · tsc · vitest 375 · build jab config/route)
- [ ] Sprint-specific verification (doc read-back / curl assert / perf:check / numbers visual QA)
- [ ] **Sirf end par** ek push (sare commits complete hone ke baad) → `git pull --rebase` → `git push` (alag commands)
- [ ] `git status` clean (release-bot ka version bump aa jayega — wo chhod do)
- [ ] Result plan-doc me addendum (perf_baseline.md session addendum pattern)

---

## Results (18 Oct 2026)

- **Sprint 0 ✅** — `TODO.md` + `frontend_performance_plan.md` status synced (W1/W2/W3a/W3b/W4/W5 done;
  W3c pending; W7 partial = clients/dashboard/jobs done, inventory/cash-flow baaki).
- **Sprint 1 ✅** — `next.config.ts` me `headers()`. Curl assertions **7/7 PASS**: static assets
  `public, max-age=86400, stale-while-revalidate=604800`, `manifest.json` `must-revalidate`, public HTML
  `s-maxage=31536000` unchanged, `/api/*` (no cache-control) + authed `/jobs` (`private, no-cache, no-store`)
  untouched — A4 no-cache rule intact.
- **Sprint 2 ✅** — `scripts/perf-budget.mjs` + `npm run perf:check` (CDP, mobile 390px, CPU 4x, session-aware
  login). First ALL-PASS run: Style&Layout **633ms** (<2000) · Task **1461ms** (<3000) · DOM **867** (<1200) ·
  FCP **68ms** (<2500) · LCP 536ms (informational). Non-zero exit on breach.

  Do findings (script ke): (a) `Performance.getMetrics` ka `Nodes` metric **detached/cumulative** nodes
  dikhata hai (2192 vs live 867) — DOM count hamesha `getElementsByTagName('*').length` se lo;
  (b) auth step **session-aware** hona chahiye (valid session par `/login` → `/dashboard` redirect hota hai).
- **Sprint 3 — not triggered** (perf:check green; field-data signal nahi). W3c accounting-dashboard +
  P3 cash-flow queue me rehne do.
- **Sprint 4 — not triggered** (koi budget breach nahi).
- Build issue faced: stale `.next/dev/types` (chal raha tha `next dev`) ne build type-check toda →
  dev band + types delete + rebuild (documented race, rsc_phase4_plan gates).
