# Plan: Fastest — 18 Nov 2026 (updated 19 Nov 2026)

Goal: minimize TTFB + browser wall for main routes (`/dashboard`, `/jobs`, `/clients`,
`/jobs/[id]/view`, `/clients/[id]/view`) **without** feature regressions or DB schema risk.

## Status (jo bacha hai, ek nazar me)

| Phase | Item | Status |
| ----- | ---- | ------ |
| 1 | Streaming RSC + skeletons (`/dashboard`, `/jobs`, `/clients`) | ✅ DONE (`6abc74f`) |
| 2 | Dashboard low-stock chain merge (1 definer RPC) | ✅ DONE (19 Nov) |
| 2b | Dashboard critical path — `client_payments` recent-first index | ✅ DONE (19 Nov) |
| 3 | `/clients` virtual list (react-window) | ⬜ BACKLOG (2-3 hafte) |
| 4a | Vercel region pin `bom1` = Supabase `ap-south-1` | ✅ DONE |
| 4b | AVIF/WebP + `_next/static` immutable cache | ✅ DONE |
| 4c | RSC edge caching (`revalidate`) | ❌ REJECT (cookie-auth + `force-dynamic` → stale/leak risk) |
| 4d | Image `sizes` audit (LCP) | ⬜ chhota, abhi measure nahi kiya |
| 5 | Streaming polish / heavy widget boundaries | ⬜ minor (dynamic `ssr:false` pehle se) |
| 6 | Web-vitals monitoring (LCP/CLS/INP) | ⬜ **NEXT** — bina iske aage ka kaam blind hai |

## Measured baseline (prod build, server HTML TTFB median of 8)

| Route | 18 Nov baseline | 19 Nov (after Phase 2) |
| ----- | --------------: | ---------------------: |
| `/dashboard` | 235-300 ms | **~180 ms** (−90 ms) |
| `/jobs` | 175-199 ms | 223-245 ms* |
| `/clients` | 178-181 ms | 211-222 ms* |
| `/jobs/[id]/view` | 206-230 ms | 195 ms |
| `/clients/[id]/view` | 140 ms | — |

\* `/jobs` + `/clients` me is batch ka koi change nahi; numbers run-to-run noise + HEAD par
streaming commits (`6abc74f`/`f4ea968`) ke baad HTML shape badla hai.

DB RTT floor: 50-100 ms (table GET RLS 67-101 ms, definer RPC 53-63 ms, ping 47-65 ms).

## Constraints (project rules + proven findings)

- Live DB critical data — sirf additive/safe DDL, no data/column/constraint change.
- PostgREST **RLS-invoker** RPC par ~250 ms fixed overhead (§7.5) → bade row payload ke liye use na karo.
- Sirf `security definer` + chhota result fast hai (`get_jobs_stats` 53-63 ms, `get_dashboard_low_stock` 54-60 ms).
- `/clients` par client-side pagination/search/tab-counts rehna hi hai (server pagination = UX break).
- List fields sab UI me use hote hain → payload trim = feature removal, perf nahi.
- Per-page measure karo, **per-batch bhi** — warna critical-path miss ho jata hai (§7.6).

## Phase 1 — Streaming RSC ✅ DONE

Shipped in `6abc74f` (dashboard/jobs/clients page.tsx + `DashboardSkeleton`/`JobsSkeleton`/
`ClientsSkeleton`), plus `f4ea968` (client detail stream + 1-year immutable static cache).
Note: streaming ka fayda **TTFB/FCP** me hai; total HTML completion time me nahi (isliye
sirf total-completion probe se judge mat karo).

## Phase 2 — Dashboard low-stock RPC ✅ DONE (19 Nov)

`supabase/migrations/20261119_dashboard_low_stock_rpc.sql` +
`src/lib/server-dashboard.ts` (`fetchLowStock`, legacy 3-call chain fallback ke saath).

- Old chain: `product_list` → (`get_inventory_stock` ‖ `product_locations`) = **115-140 ms**.
- New RPC: **54-60 ms**, 578 bytes, **5/5 rows identical** (name/alert/available/place/order).
- Stock formula duplicate nahi: RPC `get_inventory_stock()` ko hi call karta hai + `is_frontend_staff()` guard.

## Phase 2b — Dashboard critical path ✅ DONE (19 Nov)

Low-stock RPC alone se page-level gain **~0** tha (chain critical path nahi thi). Batch
breakdown se asli hot spot mila: `client_payments` recent-10 = DB 23 ms / HTTP **132-141 ms**
(Seq Scan + Sort, `is_frontend_staff()` 839 rows par).

`supabase/migrations/20261119_client_payments_recent_index.sql`:
`(payment_date desc, id desc)` index → Index Scan + early stop, DB **2.9 ms**.

**Net:** `/dashboard` ~270 → **~180 ms** (median of 9 × 8 runs).

## Phase 3 — `/clients` virtual list ⬜ BACKLOG

react-window on the client table. TTFB same, hydration wall ~357 → ~280 ms (estimate).
2-3 hafte ka refactor (row expansion, inline edit, mobile cards, selection state sab touch honge).
Tab tak ke liye: `/clients` payload 257-262 KB acceptable hai (all fields used).

## Phase 4 — Infra

- 4a ✅ `vercel.json` → `"regions": ["bom1"]`; Supabase `ap-south-1` (same city).
- 4b ✅ `images.formats = ["image/avif", "image/webp"]`; `_next/static` immutable cache.
- 4c ❌ Edge caching: pages cookie-auth + `force-dynamic` hain. Auth-aware caching design ke
  bina RSC ko edge par cache karna stale data ya cross-user leak ka risk hai — **nahi karna**.
- 4d ⬜ Image `sizes` audit (LCP): `ZoomableImage`/avatars/product images par explicit `sizes`
  add karna. Chhota, low risk, par abhi measure nahi hua.

## Phase 5 — Streaming polish ⬜ MINOR

Heavy client widgets already `dynamic({ ssr:false })`. Baaki: per-widget Suspense boundaries
taaki ek slow widget poore page ko na roke. Gain chhota; pehle Phase 6 (monitoring) chahiye.

## Phase 6 — Web-vitals monitoring ⬜ NEXT

Abhi sab measurement **local synthetic** hai (localhost, prod build, staff login). Real users
ke LCP/CLS/INP ka koi data nahi. Isliye:

- `web-vitals` → Sentry ya Vercel Analytics (jo already wired hai) par report karo.
- Route-wise percentile (p75) dashboard banao; regression detection isi par hone chahiye.
- Iske bina aage ka koi optimization guess-work hoga.

## Not doing (rejected, dobara try na karein)

- Custom **RLS-invoker** RPC for large row payloads — PostgREST ~250 ms overhead (§7.5).
- Server-side pagination on `/clients` — UX break.
- Payload trim on `/jobs`/`/clients` — saare fields UI me used.
- Streaming RSC ko total-completion probe se judge karna — galat metric.
- Auth'd RSC ko edge par cache karna without auth-aware design.
- Major dep upgrades (separate planned work).

## Verification gates (every phase)

`tsc --noEmit` ✔ · `eslint` 0 warnings ✔ · `npm test` **683/683** ✔ · `npm run build` ✔ ·
`schema:drift` ✔ (DDL wale phase me) · prod build measure on :3100 (median of 8) ·
live DB row counts unchanged · old-vs-new behaviour equivalence (jahan logic badle).

## Rollback

Har phase = alag commit. Regression par wahi commit revert. DB me sirf additive objects
(function/index) — drop karna safe, data touch nahi hota.
