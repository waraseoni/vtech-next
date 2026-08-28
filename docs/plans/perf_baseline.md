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

## TTI / Core Web Vitals
Not yet captured live (needs browser Lighthouse on logged-in app state).
Record devtools Lighthouse TTI/FCP for the identical routes here when captured —
this table is the Web-Vitals half of G2.

| Route | FCP | LCP | TTI | CLS |
|-------|-----|-----|-----|-----|
| /dashboard |  |  |  |  |
| /clients |  |  |  |  |
| /jobs |  |  |  |  |
| /reports/cash-flow |  |  |  |  |
| /reports/monthly-profit |  |  |  |  |
| /login |  |  |  |  |
