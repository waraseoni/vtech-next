# Load-Speed Optimization Plan (Bundle/Performance)

Status: **PLAN ONLY — diagnostics complete (2026-09-17), implementation post-season.
Season (G3) me koi structural change nahi.**
Based on: `npm run analyze` (production build, `next experimental-analyze`, 113s); Turbopack.
Interactive analyzer sirf `npm run analyze` ke localhost:4000 par — exactness ke liye aage
`npm run analyze:output`/Lighthouse URL par. Numbers real build se gaye (raw + gzip).

---

## 0. VERDICT (ek line)

> **Structure pehle se achi hai — bhari libs lazy-loaded already (≈700 KB initial path me
> nahi). Sabse bada khichad = ek hi giant render-blocking CSS (363 KB/42 KB gz, har route par)
> + global JS shell ~170 KB gz. Do post-season changes se pehla-paint meaningful improve
> hoga; structure koi khataranak refactor nahi.**

---

## 1. Measured baseline (production build, Turbopack output)

### 1.1 Global render-blocking resources (har route par load)
| Asset | Raw | gzip | Note |
|---|---|---|---|
| `0i88bcw_h0tc6.css` (ek hi Tailwind output) | **363 KB** | **42 KB** | Render-blocking. Sabse bada single lever. |
| polyfill `0cz1d0mv5g_q7.js` | 110 KB | 38.5 KB | Polyfill, default. |
| shell `3jkzws6klbbvq.js` | 228 KB | 71 KB | Contains **Radix Dialog/Tabs primitives** (markers: Dialog, Tabs, zb). |
| shell `2zx3q7e7c69qs.js` | 152 KB | ~48 KB | App code/helpers + react core (koi vendor marker nahi). |
| shell remaining (`1ih9z`, `26g4tn5`, turbopack boot) | ~50 KB | ~15 KB | Bootstrap/entry. |

**Global JS shell total ≈ 540 KB raw / ~170 KB gz**, bund punya: card ko compile karta hai har route par.

### 1.2 Already-lazy (theek hai, NOT initial load me)
| Asset | Raw | gz | Kahan load hota hai |
|---|---|---|---|
| `0ihge2m883xcf.js` = **recharts** univ + d3-ish | 329 KB | 96 KB | dashboard/reports ke `dynamic()` (already split). |
| `3_ew2nx3d1122.js` = **html5-qrcode** | 361 KB | ~110 KB | sirf scan pages. |
| Supabase lib `2d9za87jnhv6s.js` | 247 KB | ~75 KB | auth shell (RootClient/useAppBoot). |
| `2rmoa64dusd70.js` (supabase + sonner) | 116 KB | ~35 KB | toasts + supabase aux. |

→ **Dynamic imports pehle se sahi** (recharts, qrcode, donut/trend charts, NativePrintPreview sab `dynamic()` me — audit: dashboard/page.tsx:9,18; RootClient.tsx:82; monthly-profit:12; cash-flow:26,34; ClientsBody:44).

### 1.3 Other observations
- **Koi external font request nahi** — no `next/font`/Google-Fonts runtime call; system font `font-sans`. Good, koi font-FOUT/CLS issue nahi.
- **Implementation list**: `withSentryConfig(withSerwist(nextConfig))` — Sentry client wrapper + Serwist SW present (minor bytes, features worth it).
- **Turbopack splits** bohat saare 40–70 KB route chunks (30+ files) — HTTP/2 + SW par theek; 4G/HTTP-1.1 waterfall par bas `preload` hints ka fayda.
- `package.json` me `robots/sitemap` present; `date-fns` tree-shake ho raha (subpath imports dekh rahe hain: `date-fns/eachDayOfInterval` etc. — sahi).

---

## 2. Prioritized actions (post-season, impact order)

### P1 — Tailwind CSS wala 363 KB kam karo  (sabse bada win)
- **Sabse zyada suspect: dynamic class template strings.** Tailwind v4 aise classes ko
  compile time par nahi dekh sakta → poora-rane wala CSS ban jata hai. Search karo:
  ```ts
  className={`text-${color}-500`} / bg-${...} / border-[${...}]
  ```
- **Fix pattern:** interpolation ki jagah total static class set (`.map` se lookup table),
  ya `@source`/safelist. Expected: CSS raw 363 → <120 KB (Tailwind ka normal darja).
- Iske bina koi CSS-preload (font, critical CSS) extra daane ka `mehfang` structure-level hi hai.

### P2 — Global shell me se Radix primitives ka lean
- `3jkzws6klbbvq.js` (71 KB gz) me Dialog/Tabs. Check: kya sab pages Dialog/Tabs use karte
  hain? Agar sirf kuch (e.g. jobs, settings par) — unko page-level lazy karo
  (`dynamic`/client import at usage). Agar shell-level shared hai — theek, bundle karo,
  kuch nahi hota.
- Expected move: shell ~170 → ~120 KB gz agar Radix route-level hua.

### P3 — Hydration/JS cost ghatana on data-heavy routes
- Heavy client pages (jobs, reports, clients) `react` reconciliation cost: components ko chota
  rakho, list virtualization jahan rows 500+ (jobs/reports) — ek simple windowing (min 1-2kb).
- Suspense boundaries on slow data (reports/print previews) — streaming render bharosa.

### P4 — HTTP-cache / SW polish (Serwist already hai)
- Hashed static chunks default `immutable` auto — verify prod headers.
- Serwist runtime cache: static chunks (immutable) + `/api` GET reports (staleWhileRevalidate)
  → repeat navigation instant. Offline shell bhi.
- 4G waterfall ke liye: critical shell preload hints (Next auto) — theek.

### P5 — Images
- Sab `<img>` ko `next/image` me, LCP image par `priority`, exact dimensions (CLS fix).
- Remote pattern (supabase storage) already config me hai.

### P6 — Measure ⇒ verify pipeline (har change band)
- `npm run analyze:output` → chunk diff; Lighthouse (mobile 4G) URL par before/after;
- Web Vitals: LCP target <2.5s, CLS <0.1 (abhum jaise bhi ho, pehle baseline lo).

---

## 3. Suggested order & effort (post-season)

| # | Task | Effort | Expected |
|---|---|---|---|
| P1 | Dynamic-class purge + CSS shrink | 1–2 din | CSS 363→~120 KB raw (biggest FCP gain) |
| P2 | Radix lean/split | 0.5–1 din | shell –40–70 KB gz |
| P3 | Windowing + suspense on jobs/reports | 1–2 din | interaction + INP acha |
| P4 | Serwist runtime-cache rules | 0.5 din | repeat-load fast/offline |
| P5 | Image audit | 0.5 dag | CLS/LCP saaf |
| P6 | Baseline + regression checks | ongoing | proof, rollback-safe |

**Total ≈ 4–7 working days post-season.** Reality check: P1+P2 = ~80% visible fayda.

---

## 4. Abhi (season me) kya karna uchit hai
- **Code change: none.** (G3 freeze.)
- **Done:** baseline milya (numbers above) — abhi koi action nahi chahiye.
- Optional read-only: production URL par Lighthouse run kar lo (deploy pe hosted ho to)
  — Web Vitals ka real-user baseline, bina code change ke. Seedha `npm run analyze:output`
  next-time for automation.