# Speed Findings — Implementation Plan (3 Nov 2026)

**Status:** IMPLEMENTED (WS-1..WS-4, 3 Nov 2026) — owner-gated runtime/matrix
checks pending; numbers: `docs/plans/speed_baseline_nov2026.md`, summary §9.
**Scope owner:** V-Tech admin
**Inputs:** `docs/plans/frontend_speed_plan_nov01_2026.md`,
`docs/plans/ssr_boot_gate_plan.md`, 3 Nov 2026 build audit (this doc §2)

**Hard constraints (unchanged):**

- Live DB — **zero** DB writes/DDL/test rows. Koi schema/index/RPC change nahi.
- Server reads sirf cookie+RLS (`getServerSupabase()`); service-role page reads banned.
- Public no-login job tracking intentional — chhedna nahi.
- Commit/push alag explicit approval par.
- Measurement ke liye authenticated login owner-approved window me hi (login
  `auth.users.last_sign_in_at` + presence update kar sakta hai).

---

## 1. Goal

3 Nov 2026 audit ke findings ko ROI order me ship karna:

1. Sentry client SDK ko har route ke initial bundle se nikaalna (sabse sasta, shared win).
2. Recharts ko in-view tak defer karna (dashboard/clients).
3. Report RSC payloads ko measure + split karna (balancesheet/monthly-profit).
4. Boot-gate (Stage 2/3) — perceived-speed ka sabse bada lever, alag gated sprint.
5. Measurement harness ko repeatable banana taaki har change ka delta evidence ho.

**Non-goals:** framework/data-layer replacement (Supabase, React Query, Next,
Recharts migration), DB/index work, koi UI redesign, public tracking changes.

---

## 2. Evidence (3 Nov 2026 build)

| Item                                  | Measurement                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-route referenced JS (upper bound) | `/jobs` 647 KB · `/clients` 591 · `/inventory` 734 · `/reports/balancesheet` 575 · `/reports/ledger` 578 · `/messages` 564 · `/activity-logs` 552 · `/jobs/old` 554 · `/reports/yearly` 542 |
| Total `static/chunks`                 | 6.49 MB / 215 files                                                                                                                                                                         |
| Shared chunk `0h-_uz3hubcx5.js`       | **257 KB raw, `async:false`** — every route ke manifest me (Sentry + Supabase)                                                                                                              |
| Recharts chunk `3kjmitkdbq8o-.js`     | **310 KB raw, lazy** — page manifests me nahi; render par load                                                                                                                              |
| QR chunk `3cvogwmo2o_vh.js`           | 361 KB raw, lazy (html5-qrcode + qrcode) — correctly deferred                                                                                                                               |
| Sentry static imports                 | `src/app/error.tsx:3`, `src/app/global-error.tsx:3` → SDK shared initial chunk me                                                                                                           |
| Charts already dynamic?               | Haan (`DashboardBody.tsx:10`, `ClientsBody.tsx:50`), par **turant render** (line 733 / 529) → hydration ke baad foran load                                                                  |
| Boot gate                             | `RootClient.tsx:1419` — `!authReady` par splash; content DOM paint hi nahi hota (Stage 1 occlusion experiment net-negative, `ssr_boot_gate_plan.md`)                                        |
| Known measured wins (pre-plan)        | `/jobs` mobile@4x: TBT 2413→766 ms, perf 56→68; per-route JS −2% (WS-B)                                                                                                                     |

**Honest gap:** 44-route server-first wave ka LCP/TBT **runtime measurement nahi
hua** (authenticated login gate). Structural win verified (208+ reads first HTML
me; default view par 0 client RTT), par numbers pending.

---

## 3. Workstreams

### WS-0 — Measurement harness (P0, 0.5 din, owner-gated)

**Why:** bina baseline ke baaki changes guesswork hain.

- Reuse `scripts/perf-budget.mjs` (CDP metrics; `PERF_EMAIL/PASSWORD`, Chrome
  `--remote-debugging-port=9222`, prod `next start`).
- Routes: `/jobs`, `/dashboard`, `/clients`, `/reports/balancesheet`,
  `/reports/monthly-profit`, `/inventory`, `/login`.
- Mobile@4x, least/median of 3; snapshot results in
  `docs/plans/speed_baseline_nov2026.md`.
- Bundle snapshot: `npm run analyze:output` → copy `.next/diagnostics/analyze`
  to `analyze-before/` (diffable).
- **Gate:** owner approval (login writes). Alternative: unauth-only
  (`/login`, `(public)/*`) + deferred authenticated numbers.

**Accept:** baseline table + bundle snapshot committed; variance note (<15%).

### WS-1 — Sentry out of initial bundle (P1, 0.5–1 din, low risk)

**Change:** `src/app/error.tsx` + `src/app/global-error.tsx` me top-level
`import * as Sentry` hatao; `useEffect` me dynamic import karke capture:

```ts
import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
```

- UI turant render hoti rahe (error boundary synchronous).
- CSP `connect-src https://*.sentry.io` already allowed — koi config change nahi.
- Verify: analyzer diff me shared chunk se SDK nikalna chahiye; dev me throw
  karke error boundary capture check; Sentry dashboard par event (dev DSN).

**Accept:** koi route JS na badhe; shared chunk size gira; error capture intact.
**Rollback:** single commit revert.

### WS-2 — Charts render-on-visible (P2, 1 din, low risk)

**Change:** shared `src/components/DeferredMount.tsx` (IntersectionObserver
`rootMargin: "200px"` + 2.5s timeout fallback + reserved height) aur usme wrap:

- `DashboardBody` ka `<DashboardCharts>` (line ~733)
- `ClientsBody` ka `<ClientChart>` (line ~529)

- Report charts (`cash-flow`, `monthly-profit`) already lazy; unhe tabhi defer
  karo jab chart pehle viewport me na ho.
- Placeholder = same height skeleton (CLS 0); IO fail/timeout par mount.
- Recharts chunk shared hai — dashboard/clients par ab hydration ke turant baad
  load nahi hoga.

**Accept:** Recharts network request pehle viewport me na ho; visual parity;
CLS 0; measured TBT improvement (WS-0 method).
**Rollback:** per-page commit revert.

### WS-3 — Report payload audit + split (P3, 2–3 din, medium)

**Why:** default payload target <200 KB (balancesheet) aur monthly-profit
`rawData` drill-down ke liye poora jata hai.

1. RSC/API payload sizes measure (owner window ya server log of response sizes).
2. `monthly-profit`: server se sirf monthly buckets + totals; raw detail
   (job/payment rows) modal open par on-demand fetch (existing data module,
   read-only).
3. `balancesheet`: default payload ≤200 KB verify; tab-wise detail lazy.
4. Numbers shared helpers se hi aayein (`src/lib/balance-sheet-data.ts`,
   monthly-profit data module) — duplicate math nahi.
5. Vitest: new split/serialize helpers; print bytes unchanged.

**Accept:** payload targets; screen/print numbers identical; tab switch <300 ms
local; gates green.
**Rollback:** revert; API paths purane (client fetch) bane rahein.

### WS-4 — Boot-gate Stage 2/3 (P4, 4–6 din, HIGH risk, alag sprint)

**Why:** RSC data HTML/payload me hai par `authReady` tak paint nahi hota —
sabse bada perceived-speed lever. Stage 1 (opaque splash overlay) already
net-negative proven; isliye gate hatana hi real path hai.

**Staging (har stage flag + independent revert):**

1. **Stage 2a:** server session/role ko `layout.tsx` → `RootClient` tak pass karo
   (server `requireStaffWithRole` already available) taaki shell pehle paint par
   sahi ho; `isMobile` ko CSS-only responsive par shift.
2. **Stage 2b:** splash ko non-occluding skeleton shell se replace karo (content
   ko mat dhako — LCP candidate banna chahiye).
3. **Stage 3:** auth/license/idle checks post-hydration enhancement banao:
   invalid/expired par redirect; SW boot-guard + watchdog intact.
4. Per-route allowlist flag (`NEXT_PUBLIC_SSR_SHELL`) — default off, route by
   route enable.

**Verification matrix (mandatory):** auth expired, revoked, license invalid,
idle logout, SW stale chunk, first load offline, desktop+mobile, `/jobs`,
`/dashboard`, `/clients`. LCP/FCP/TBT before/after; hydration errors 0.

**Accept:** LCP `/jobs` mobile@4x <3.5 s; FCP improvement; TBT baseline se
~±10% (766 ms) na bade; matrix green.
**Fallback:** Stage 2b bhi TBT na de to Option A par ruk jao (accept current).

### WS-5 — SidebarNav extraction (DROPPED)

~10 KB gain, desktop sidebar lazy-load par visible nav flash; mobile drawer
already first-open lazy (commit `a001ebc`). ROI nahi — **mat karo**.

---

## 4. Technology replacement — decisions (no work)

| Candidate                                       | Decision                                                                                                                                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drizzle/Prisma + direct Postgres                | **Reject.** Sirf server reads ka ~10–30 ms/query bachta; DB freeze + RLS/PostgREST model todta hai; connection pooling + schema ownership chahiye. Revisit only if measured server query latency bottleneck bane. |
| React Query → SWR/RTK Query                     | **Reject.** `staleTime 30s` cache already hai; bundle/feature delta negligible.                                                                                                                                   |
| Recharts → uPlot/SVG                            | **Defer.** 310 KB lazy chunk hai; migration high-cost. Pehle WS-2 (in-view) — agar field data phir bhi bole to alag evaluate.                                                                                     |
| Next 16 + React 19 + Turbopack + React Compiler | **Keep.** Latest; koi better alternative nahi.                                                                                                                                                                    |
| Sentry replacement                              | **Keep** (error visibility); sirf lazy-load (WS-1).                                                                                                                                                               |
| html5-qrcode / Serwist / Zod / RHF / date-fns   | **Keep.** Lazy where needed already.                                                                                                                                                                              |

---

## 5. Sequence & dependencies

```
WS-0 (baseline, owner window)
  ├─→ WS-1 (Sentry lazy)          — 0.5–1 din, safe
  ├─→ WS-2 (charts in-view)       — 1 din, safe
  ├─→ WS-3 (payload split)        — 2–3 din, medium
  └─→ WS-4 (boot gate 2/3)        — 4–6 din, HIGH; separate approval
```

WS-1/2 implementation independent hain, par **verification** WS-0 numbers par
hogi. WS-4 tabhi jab WS-0 field data kahe ki first paint chahiye.

---

## 6. Gates (har workstream)

1. `npx tsc --noEmit`
2. `npx eslint <touched>`
3. `npm test`
4. `npx prettier --check <touched>` (Linux/LF content par — CRLF masking ka dhyan)
5. `npm run build` + `npm run analyze:output` diff
6. Perf numbers (WS-0 method) — least/median of 3
7. Zero-write audit: koi naya insert/update/delete/upsert nahi
8. Multi-route smoke (unauth 307→`/login`, health 200) + authed visual QA

Final: `npm run schema:drift` (migrations untouched hone chahiye), docs/TODO
update, plan status.

---

## 7. Risks

| Risk                                 | Mitigation                                                                |
| ------------------------------------ | ------------------------------------------------------------------------- |
| Sentry lazy load error-time par fail | capture `.catch(()=>{})`; UI independent; Sentry transport retry built-in |
| Charts defer se blank section        | reserved height + 2.5s timeout fallback + IO rootMargin                   |
| Report split se numbers mismatch     | shared helpers hi use; print byte comparison; vitest                      |
| Boot gate auth/license regression    | flag + per-route allowlist + full matrix + staged revert                  |
| Measurement variance                 | CDP metrics + median of 3 + baseline doc note                             |
| CRLF masking (local prettier)        | CI/LF blob check (`git show` + prettier) before push                      |

**Rollback:** har workstream independent commit(s); koi DB change nahi, isliye
code revert kaafi hai.

---

## 8. Open questions (owner)

1. Authenticated measurement window approve? (login `last_sign_in_at` + presence
   update karega — ek session, off-hours recommended)
2. WS-4 boot-gate sprint kab? (high-risk, alag approval)
3. WS-3 ke liye monthly-profit drill-down on-demand fetch acceptable? (tab click
   par ~150–300 ms extra, default payload chhota)

---

## 9. Results (3 Nov 2026)

| Workstream | Kya hua                                                                                                                                                                                                                                                                                              | Evidence                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **WS-1**   | `sentry.client.config.ts` + `error.tsx`/`global-error.tsx` se static SDK import hataya; `src/lib/sentry-lazy.ts#ensureSentry()` idle init (`requestIdleCallback`, 4 s timeout / 1.5 s fallback) aur error-time capture dono handle karta hai. SDK chunk 494 KB kisi initial manifest me nahi.        | route JS −9…−10 KB; `2y8rkofp88wv8.js` inspect                                                |
| **WS-2**   | `src/components/DeferredMount.tsx` (IO 200 px + 2.5 s fallback + reserved height) me `DashboardCharts` + `ClientChart` wrap. Recharts 311 KB request ab in-view tak nahi.                                                                                                                            | 3 unit tests; chunk lazy                                                                      |
| **WS-3**   | `monthly-profit-data.ts` split: `fetchMonthlyProfitRows` / `computeMonthlyProfit` / `fetchMonthlyProfitData` (`{data}` only) / `fetchMonthlyProfitRawData` + `buildMonthlyDetailRows`. Modal raw rows on-demand (year-cached). Balancesheet payload verify (37 KB / 111.6 KB) — tab split nahi kiya. | payload 411.4 KB → 2.7 KB; 15 unit tests                                                      |
| **WS-4**   | `NEXT_PUBLIC_SSR_SHELL` (default off): `src/lib/ssr-shell.ts` + `src/lib/server-ssr-auth.ts`; layout → `RootClient` → `useAppBoot({ ssrAuth })`. Server auth se `authReady`/`profile` first render me; splash skip; validation/license/idle post-hydration.                                          | default-off build: 46 static pages; flag-on build green (lekin all-dynamic — §5 baseline doc) |
| **WS-5**   | Plan ke mutabik nahi kiya (ROI neeche).                                                                                                                                                                                                                                                              | —                                                                                             |

Gates: `tsc` clean · `eslint` clean · `vitest` **611 passed** · `prettier`
(formatted touched files; CI LF-blob caveat) · `next build` green ·
`schema:drift` OK (24 migrations) · unauth smoke (307→`/login`, public 200,
health db ok). **Zero DB writes.**

Pending (owner): authenticated Lighthouse/TBT numbers, WS-4 verification
matrix, aur WS-4 ke liye route-group layout refactor (public pages static
rakhne ke liye) — uske bina flag prod me enable na karein.
