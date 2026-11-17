# Plan: Fastest (Tier 1+2 implementation) — 18 Nov 2026

Goal: minimize TTFB + browser wall for main routes (`/dashboard`, `/jobs`, `/clients`,
`/jobs/[id]/view`, `/clients/[id]/view`) beyond current measured baseline, **without**
feature regressions or DB schema risk.

## Baseline (measured, prod build, server HTML TTFB median 8)
| Route | TTFB | Browser wall |
|---|---:|---:|
| `/dashboard` | 235-264 ms | 291 ms |
| `/jobs` | 175-199 ms | 356 ms |
| `/clients` | 178-181 ms | 357 ms |
| `/jobs/[id]/view` | 206-230 ms | 307 ms |
| `/clients/[id]/view` | 140 ms | — |

DB RTT floor: 50-100 ms (table GET RLS 67-101 ms, definer RPC 53-63 ms, ping 47-65 ms).

## Constraints (from project rules + proven findings)
- Live DB critical data — sirf additive/safe DDL, no data/column/constraint change.
- PostgREST RLS-invoker RPC has ~250 ms fixed overhead → **do not** use for large row payloads (§7.5).
- Only `security definer` + small aggregates are fast (get_jobs_stats 53-63 ms).
- Client-side pagination/search/tab-counts on `/clients` must stay (server pagination breaks UX).
- All list fields are used in UI (grep verified) → payload trim = feature removal, not perf.
- React 19 / Next 16.4.6; code-splitting already applied (recharts/donut/charts dynamic).

## Phase 1 — Streaming RSC (highest ROI, low risk)  ← START HERE
Convert blocking `await fetchX()` in page.tsx into Suspense-wrapped async components so
TTFB = auth (~50-80 ms) + shell, data streams in. Target: `/dashboard` first.

- 1.1 `src/app/(dashboard)/dashboard/page.tsx`: wrap data fetch in `<Suspense fallback={<DashboardSkeleton/>}>`.
- 1.2 Same pattern for `/jobs` (page.tsx) and `/clients` (page.tsx).
- 1.3 Skeleton components matching layout (avoid CLS).
- Verify: TTFB drops, FCP improves, no hydration errors, e2e smoke still green.

## Phase 2 — Dashboard low-stock chain merge (medium, low risk)
Merge `product_list` → `fetchStockByProducts` → `fetchPlaces` into one definer RPC
`get_dashboard_low_stock()` returning low-stock items with stock + place. Saves ~1 round trip
(~30-50 ms) in widgets batch. New migration + full-schema append + drift check.

## Phase 3 — Virtual list on `/clients` (high effort, medium gain)
react-window on the client table. TTFB unchanged, hydration wall 357 → ~280 ms.
2-3 weeks. Backlog unless user prioritizes.

## Phase 4 — Infra (no code, biggest real-world gain)
- Move Supabase project to same region as Vercel (if not already) — cuts 50-100 ms RTT.
- Enable Vercel edge caching for RSC where safe (revalidate).
- Image CDN optimization (already next/image; verify remotePatterns + sizes).

## Phase 5 — Streaming polish (medium)
Suspense boundaries around heavy client widgets (already dynamic, ssr:false). Minor.

## Not doing (rejected)
- Custom RPC for large row payloads (PostgREST overhead).
- Server-side pagination on `/clients` (UX break).
- Payload trim on `/jobs`/`/clients` (all fields used).
- Major dep upgrades (separate planned work).

## Verification gates (every phase)
`tsc --noEmit` ✔ · `eslint src` 0 · `npm test` 683/683 · `npm run build` ✔ ·
`schema:drift` ✔ (if DDL) · prod build measure on :3100 (8 runs median) · row counts unchanged.

## Rollback
Each phase = separate commit; revert commit if regression. No DB data changes ever.
