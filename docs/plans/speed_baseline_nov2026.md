# Speed Baseline — Nov 2026 (post WS-1..WS-4)

**Date:** 3 Nov 2026
**Scope:** `docs/plans/speed_findings_implementation_plan_nov03_2026.md` ke
WS-0 (measurement) + WS-1..WS-4 ke baad ka snapshot.
**Constraints:** Live DB — **zero** writes. Koi authenticated login nahi kiya
(login `auth.users.last_sign_in_at` + presence update karta hai) → runtime
Lighthouse/TBT numbers **pending owner window**. Yahan sab kuch build-artifact +
read-only server measurement se hai.

---

## 1. Method

| Item                       | Kaise                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Per-route JS (upper bound) | `.next/server/app/**/page_client-reference-manifest.js` se `chunks` + `async` flags; unique `/static/chunks/*.js` ke **raw** bytes suma                |
| Static chunk totals        | `.next/static/chunks/*.js` ka raw size                                                                                                                 |
| Bundle analyzer            | `npm run analyze:output` → `.next/diagnostics/analyze` (133 MB, gitignored; interactive: `next analyze`)                                               |
| Report payload sizes       | Server data module (`fetchBalanceSheetData`, `fetchMonthlyProfitRows`) ko **service-role read-only** script se call karke `JSON.stringify` bytes naape |
| Runtime smoke              | `next start` (port 3100) + curl; unauth redirects + public routes                                                                                      |

Variance: build-to-build chunk hashes badalte hain, isliye numbers ko ±10 KB
band me padho. Sab sizes **raw (uncompressed)** hain — gzip me ~30–35%.

---

## 2. Per-route initial JS (raw KB)

| Route                   | Before (3 Nov audit) | After (this run) | Delta |
| ----------------------- | -------------------: | ---------------: | ----: |
| `/inventory`            |                  734 |              724 |   −10 |
| `/jobs`                 |                  647 |              638 |    −9 |
| `/clients`              |                  591 |              582 |    −9 |
| `/reports/ledger`       |                  578 |              568 |   −10 |
| `/reports/balancesheet` |                  575 |              566 |    −9 |
| `/messages`             |                  564 |              554 |   −10 |
| `/jobs/old`             |                  554 |              545 |    −9 |
| `/activity-logs`        |                  552 |              543 |    −9 |
| `/reports/yearly`       |                  542 |              532 |   −10 |

Shared always-loaded chunks (122 routes each): `0h-_uz3hubcx5.js` 257 KB,
`2ievmklz6o7df.js` 96 KB, `2owko7ggiy3qv.js` 68 KB, `3bhp7nvwb87pl.js` 35 KB,
`2a7p6ttjhp4ld.js` 23 KB, `06ck9mrmikpou.js` 15 KB, `16egt5jqilagu.js` 14 KB,
plus route-specific chunks.

**Honest note (Sentry):** 494 KB raw SDK chunk (`2y8rkofp88wv8.js`) **kisi bhi
initial manifest me nahi** hai. Purani assumption ("Sentry shared 257 KB chunk
me hai") galat thi — SDK pehle bhi separate chunk me tha. Isliye route JS delta
sirf −9/−10 KB hai. WS-1 ka asli fayda: SDK ab `requestIdleCallback` (timeout
4 s) / 1.5 s fallback par init hota hai, error par on-demand; **static import
unknown-error boundary se hat gaya**, to future me koi boundary ise wapas
always-loaded path me nahi khinchegi.

Static chunks total: **7.31 MB / 215 `.js` files** (sab lazy chunks included).
Initial-load metric ke liye §2 table hi authoritative hai, total nahi.

---

## 3. Report payloads

### `/reports/monthly-profit` (WS-3)

Measured on live data, year 2026 (read-only).

| Payload                          |         Size |
| -------------------------------- | -----------: |
| Old `{ data, rawData }`          | **411.4 KB** |
| New `{ data }` (12 monthly rows) |   **2.7 KB** |

Raw rows jo ab first paint me nahi jaate: 1,617 transactions · 769 client
payments · 876 attendance rows · 556 clients · 59 direct sales · 87 expenses ·
8 loan payments · 4 mechanics · 2 lenders.

Drill-down modal ab `fetchMonthlyProfitRawData()` se on-demand laata hai (same
read-only queries), ek saal ke liye cache hota hai, aur year change par reset.

### `/reports/balancesheet` (WS-3)

| Range              |  Payload | Note                     |
| ------------------ | -------: | ------------------------ |
| Monthly (Nov 2026) |  37.0 KB | default view             |
| Yearly (2026)      | 111.6 KB | 377 customer ledger rows |

Target **≤200 KB: met**. Isliye tab-wise lazy split **nahi kiya** (bina zaroorat
complexity nahi). Agar future me clients/rows 2× ho jayein to tab-wise detail
(API + `activeTab`) alag plan se ho sakta hai.

---

## 4. Charts (WS-2)

- Recharts chunk `3kjmitkdbq8o-.js` 311 KB — lazy tha aur lazy hi hai.
- Farq: `/dashboard` (`DashboardCharts`) aur `/clients` (`ClientChart`) ab
  `DeferredMount` me hain — Recharts request tab tak nahi jaata jab tak widget
  viewport ke 200 px paas na aaye; 2.5 s fallback + reserved height (CLS guard).
- Logic unit-tested (`src/components/DeferredMount.test.tsx`): defer,
  IntersectionObserver reveal, timeout fallback, observer-unavailable fallback.
- Network timing ki on-device verification authenticated browser me pending
  (login writes).

---

## 5. Boot-gate flag (WS-4)

`NEXT_PUBLIC_SSR_SHELL` (default **off**):

- **off** (default): purana behavior — client auth ke baad shell; build me 46
  static pages (unchanged).
- **`all`** ya comma-separated route prefixes: layout server se session/role
  read karke `RootClient` ko deta hai; shell + content first paint me (splash
  skip). Validation/license/idle checks post-hydration chalte hain.

**Finding (important):** flag on hone par root layout `cookies()` use karta hai
→ **poora route tree dynamic** ho jata hai (`NEXT_PUBLIC_SSR_SHELL=all` build me
sirf `_global-error` prerendered tha). Public pages (`/`, `/about`, `/contact`,
`/login`) static nahi rehte.

**Recommendation:** prod me enable karne se pehle auth read ko protected
route-group layout me move karo (jaise `(dashboard)/layout.tsx`) taaki public
marketing pages static rahein. Uske baad per-route rollout (`/jobs` se shuru).

**Verification status:** build + unauth smoke green (default-off). Authenticated
matrix (expired/revoked/license/idle) owner window me pending.

---

## 6. Smoke (default-off build, port 3100)

| Request                                               | Result          |
| ----------------------------------------------------- | --------------- |
| `/jobs`, `/dashboard`, `/clients`, `/inventory`       | 307 → `/login`  |
| `/reports/balancesheet`, `/reports/monthly-profit`    | 307 → `/login`  |
| `/`, `/about`, `/login`, `/job-status`, `/robots.txt` | 200             |
| `/api/health`                                         | 200, `db: "ok"` |

DB writes: **zero** (sirf selects; measurement script service-role read-only).

---

## 7. Still pending (owner-gated)

1. Authenticated Lighthouse/CDP (`scripts/perf-budget.mjs`): `/jobs`,
   `/dashboard`, `/clients`, `/reports/balancesheet`, `/reports/monthly-profit`
   — LCP/FCP/TBT before/after WS-1..WS-3.
2. WS-4 verification matrix: expired session, revoked client, invalid license,
   idle logout, stale SW chunk, offline first load, desktop+mobile.
3. WS-4 route-group layout refactor (public pages static rakhne ke liye) —
   tabhi flag enable karna.
