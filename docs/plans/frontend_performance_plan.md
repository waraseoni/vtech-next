# Frontend Performance Plan — "Loading time ko fastest"

Created: 2026-09-17 · Status: **BASELINE MEASURED — execution pending (post-season for big items; hot quick-wins season-safe)**
Goal: project pages ka load/time kam — client-side rendering flame pe dhyaan (app ~90% CSR hai).

---

## 1. Baseline measurement (local production build, Next.js 16.3.3 Turbopack, v1.22.1)

Measures: `npm run build` (50s clean) + `npm run analyze:output` (`.next/diagnostics/analyze`) +
per-route chunk weight sum from prerendered route HTML. Env: `.env.local`.

### 1.1 Har route ka JS weight (uncompressed, sum of route's chunks)

| Route | KB | Route | KB |
|---|---|---|---|
| /inventory | 1211 | /purchase-orders | 1066 |
| /index (/) | 1128 | /stage-lighting | 1057 |
| /jobs | 1124 | /power-supply | 1057 |
| /suppliers | 1104 | /industrial | 1057 |
| /products | 1103 | /direct-sales | 1050 |
| /about | 1081 | /monthly-profit | 1049 |
| /profile | 1079 | /inquiries | 1045 |
| /job-status | 1077 | /daily-done | 1043 |
| /dashboard | 1074 | /locate | 1043 |
| /login | 1072 | /commission | 1043 |
| /settings | 1070 | /payments | 1010 |
| /attendance | 1069 | /_not-found | 1006 |
| /box-labels | 1068 | /_global-error | 567 |

> **Key finding:** range sirf ~1.0–1.2 MB — **koi single slow page nahi**; saari routes ek bade
> **shared JS floor** ke andar hain (RootClient 2144-line shell + supabase-js + app-wide helpers +
> icons + Sentry). Total static JS ≈ **5.6 MB (uncompressed)**.

### 1.2 Data-fetch density per page (`.from(` calls — serial RTT proxy)

| Page | Fetches | Lines | Page | Fetches | Lines |
|---|---|---|---|---|---|
| dashboard | 35 | 1752 | jobs/[id]/view | 18 | 1907 |
| jobs | 29 | 3084 | salary | 18 | 1179 |
| reports/accounting-dashboard | 28 | 837 | jobs/old | 16 | 845 |
| jobs/[id]/edit | 21 | 1311 | suppliers/[id] | 15 | 2038 |
| jobs/new | 21 | 1316 | financial-report | 15 | 494 |

### 1.3 Confirmed quick win (unnecessary cost)

- `src/app/(public)/components/qr-share.tsx` static `import QRCode from "qrcode"` — `(public)/layout.tsx`
  me statically imported → **har public page** (/, /about, /contact, services…) qrcode lib load karta hai.
- BarcodeCameraScanner / QuickScanModal already dynamic-import html5-qrcode ✓ (kafi sahi pattern).
- recharts pages already `dynamic` ✓ (dashboard, monthly-profit, cash-flow).

## 2. Diagnosis (causes of perceived slowness)

1. **CSR-first (~90%)**: 104/117 pages `"use client"`; HTML aata hi khali — bundle + boot + fetch sab
   browser me. (117 pages total, sab data supabase-js browser ke through.)
2. **Boot sequence serial**: LicenseGate → useAppBoot init → phir page mount — pehla content tak chained
   awaits (RootClient.tsx).
3. **Data fetch clusters serial/unbatched**: dashboard 35, jobs 29, accounting-dashboard 28… page par
   `.from()` calls sequentially → N round-trips Supabase.
4. **App-wide shared bundle floor ~1MB+** har route par (shell + icons + client libs).
5. Public pages statically pull qrcode (1.3).

## 3. Workstreams (priority × effort · season flags)

| # | Workstream | Effort | Impact | Season-safe |
|---|---|---|---|---|
| W1 | **Public layout qrcode fix** — QrShareModal dynamic import (button-triggered) | ~30–60 min | Kam–med (har public route ka bytes kam) | ✅ |
| W2 | **Boot parallelize + instant paint** — `loading.tsx`/Suspense per (dashboard) waale sections; LicenseGate + useAppBoot ko render-blocking se race; sidebar/nav lazy | ~3–4 h | High (pehla paint + FCP) | ✅ |
| W3 | **Hot-page fetch batching** — dashboard/asbb, jobs, accounting-dashboard ke `.from()` clusters ko parallel `Promise.all` + dedupe selected lists (profile/products preload memory cache) | ~1–2 din | High (dashboard jobs ka wait khatam) | ✅ |
| W4 | **Route prefetch** — sidebar me `router.prefetch()` hover/touch par (Link default prefetch verify) | ~30–60 min | Medium (nav feel) | ✅ |
| W5 | **Public pages static cache headers** (Vercel) | ~1–2 h | Low–med | ✅ |
| W6 | **Bundle floor attack (big)** — 1) RootClient split: nav/sidebar in route groups me, 2) icons per-page, 3) supabase/helpers shared chunk review, 4) Sentry tuning | ~2–3 din | Sabse bada (har route −200–400KB) | ❌ post-season |
| W7 | **RSC migration hot pages** (dashboard/clients/inventory/jobs → server-fetch + streaming + Suspense) | ~2–4 din/page-set | High–very high | ❌ post-season |
| W8 | **React Query / SWR data layer** (cache, dedup, background refresh) | ~1–2 din | High (repeat-nav fast) | ❌ post-season |

## 4. Recommended execution order

1. **[Now, season-safe]** W1 (qrcode) → W2 (boot paint) → W4 (prefetch) → W5 (headers) — total ~1 din.
2. **[Season-safe]** W3 hot-page batching dashboard → jobs → accounting-dashboard (baari-baari, har
   changewith regression check).
3. **[Post-season]** W6 → W7 → W8 (bund ka thos katta).
4. **Measure-repeat har step ka:** `npm run analyze:output` + production URL Lighthouse/waterfall —
   number ke bina kabhi "slow par gayi" claim nahi.

## 5. Guard-rails

- Koi `proxy.ts` auth-middleware change nahi (server_migration_gate_plan G-banned) — W7 ke liye bhi.
- `date_*`/display conventions + DATA_MIGRATION_NOTES se prabhaav: W3/W7 fetch changes ki RLS/session
  semantics same rakhni hai (cookie+RLS client pattern intact).
- Har W3 page par tsc + eslint + vitest + visual QA before next.
- Season-safe items zero-DB-write; W1/W2/W4/W5 pure frontend/logic.

## 6. TODO (linked in docs/TODO.md)

- Phase A (season-safe quick wins): W1, W2, W4, W5.
- Phase B (season-safe data): W3 dashboard → jobs → accounting-dashboard.
- Phase C (post-season): W6 bundle floor → W7 RSC → W8 query layer.
- Phase D: re-measure + production URL Lighthouse baseline before/after.