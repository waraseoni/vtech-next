# Performance Baseline (G2 / module) — 28 Aug 2026

*Purpose: durable "before" snapshot for server-component migration (see
`server_migration_gate_plan.md`, condition G2). Yar baad me koi perf work kare to
ise re-run karke compare karo.*

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
> via same cookie+RLS pattern: `jobs`, `dashboard`.
