# RSC Implementation — Best Plan (2026)

> **Status:** Plan only — execution pending user approval per phase.
> **Audit date:** 20 Nov 2026 · **Repo:** vtech-next (Next.js, cookie-auth staff app)
> **Cross-ref:** `docs/plans/rsc_phase4_plan.md` (P1 dashboard ✅, P2 jobs ✅, P3 optional),
> `docs/plans/perf_fastest_plan_2026.md` (Phase 3 backlog, Phase 4c rejected),
> `docs/plans/ledger_billing_audit_2026.md` (billing fixes done).

---

## 1. Audit — current RSC adoption

| Metric | Count | % |
|---|---:|---:|
| Total pages (`page.tsx`) | 124 | 100 |
| Client components (`"use client"`) | 70 | 56 |
| Server components (no `"use client"`) | 54 | 44 |
| Async server components | 47 | 38 |
| `force-dynamic` (cookie-auth, no edge cache) | 44 | 35 |
| **RSC first-paint seed** (server fetch → initial props) | **6** | 5 |

### RSC seed already applied (6 pages) — the real perf win
| Page | Seed file |
|---|---|
| `/reports/accounting-dashboard` | `accounting-dashboard-data` |
| `/reports/balancesheet` | balancesheet seed |
| `/reports/cash-flow` | cash-flow seed |
| `/reports/daily-done` | `daily-done-data` |
| `/reports/monthly-profit` | `monthly-profit-data` |
| `/reports/pending-jobs` | `pending-jobs-data` |

### Server-component pages (54) — already RSC, no seed yet
Core: dashboard, jobs, clients, payments, direct-sales, expenses, inventory, mechanics, suppliers, attendance, messages, inquiries, profile, activity-logs, clients/[id]/*, jobs/[id]/*, direct-sales/[id]/*.
Reports (26+): all report pages are server components already (async + force-dynamic) — only 6 have first-paint seed.

### Client-component pages (70) — mostly interactive
Forms/wizards: jobs/new, jobs/[id]/edit, clients/new, clients/[id]/edit, add-payment, collect-emi, give-loan, add-direct-sale, estimates, advance, client-loans, lenders, services.
Detail/editor views: clients/[id]/view, jobs/[id]/view, inventory/[id], suppliers/[id], mechanics/[id]/*.
Labels/print: ledger-print, combined-invoice, spot-labels, box-labels.
Admin/tools: developer, back-office, backup, settings/*, sync, images, seller/*, my-account/*, (public)/*.

---

## 2. Pattern (pilot — copy, don't reinvent)

Established in `clients` (G3) + `dashboard` (P1) + `jobs` (P2):

```
src/app/<page>/page.tsx          ← SERVER: requireStaffWithRole() → redirect /login
                                  → fetch data (getServerSupabase, cookie+RLS)
                                  → <Body initial={seed}/>   force-dynamic
src/lib/server-<page>.ts         ← SERVER fetch lib (Promise.all, RPC fallbacks)
src/app/<page>/<Body>.tsx        ← CLIENT: existing UI, seed-aware mount
                                    (useRef skip-flags, seedMatchesFilters check)
```

Rules (from rsc_phase4_plan):
- **Split = pure code move, zero logic change.** No filter/modal/logic rewrite.
- **Service-role NEVER in page reads** — cookie+RLS only.
- **`force-dynamic`** on every authed page (no edge caching of business data — A4 lesson).
- **Graceful seed absence**: server returns `null` → client fetches as before (no blank page).
- **Double-fetch guard**: `useRef` skip-flags + `seedMatchesFilters` snapshot check (StrictMode-safe, idempotent).
- **Auth via `getClaims()`** (zero-network JWKS) with `getUser()` fallback — already app-wide.

---

## 3. Decision matrix — what gets RSC

| Category | Count | RSC? | Reason |
|---|---:|---|---|
| Interactive forms/wizards | ~20 | ❌ No | Modals, optimistic updates, client state — RSC adds complexity, no gain |
| Detail/editor views | ~15 | ❌ No | Heavy client state (edits, bulk actions) |
| Labels/print pages | ~5 | ❌ No | Print is client-side popup |
| Admin/tools/settings | ~12 | ❌ No | Low traffic, no perf need |
| Public pages | ~6 | ✅ Already static-ish | Consider ISR/revalidate (separate) |
| **List/report pages** | ~22 | ✅ **Yes** | High TTFB benefit, read-heavy, filters are URL-driven |

**Target: ~22 list/report pages → RSC first-paint seed.** Currently 6 done → **+16 to go.**

---

## 4. Candidate list (prioritized)

### Tier 1 — High impact (user-facing daily, large data) — 6 pages
1. `/clients` — already RSC server comp, but **no seed** (client fetches on mount). Add seed via `fetchClientsPageData` (already exists in `server-clients.ts`? check). Pilot G3 proved LCP 10s→5s.
2. `/payments` — list + filters, heavy.
3. `/direct-sales` — list.
4. `/expenses` — list.
5. `/attendance` — list.
6. `/messages` — list.

### Tier 2 — Reports (read-heavy, currently server comp but no seed) — 10 pages
7. `/reports/ledger` (client ledger report)
8. `/reports/client-payment`
9. `/reports/daily-sales`
10. `/reports/daily-service`
11. `/reports/monthly-sales`
12. `/reports/custom-sales`
13. `/reports/custom-service`
14. `/reports/top-customers`
15. `/reports/delivered`
16. `/reports/due-reminders`

### Tier 3 — Lower traffic but consistent — 6 pages
17. `/reports/loan`
18. `/reports/activity`
19. `/reports/oversold`
20. `/reports/requirement-list`
21. `/reports/stock-valuation`
22. `/reports/supplier-dues`, `/reports/supplier-purchases` (2)

### New pages created after this plan
- `/reports/client-parts-service` (new, currently `"use client"`) → should follow RSC seed pattern from day one (good candidate to validate pattern on a fresh page).

---

## 5. Phased execution plan

### Phase A — Template + 1 pilot (1 session)
- Pick **`/reports/client-parts-service`** (fresh page, low risk) as the validation page.
- Create `src/lib/server-client-parts-service.ts` (`fetchClientPartsServiceData(sp)`).
- Split: `page.tsx` server + `ClientPartsServiceBody.tsx` client (move existing UI verbatim).
- Seed-aware `useClientPartsService` hook with skip-flags + `seedMatchesFilters`.
- Gates: tsc ✓ · eslint ✓ · prettier ✓ · vitest ✓ · build ✓ · visual verify (filters, expand, CSV).
- **Deliverable:** reusable template documented in this file §2.

### Phase B — Tier 1 core lists (3-4 sessions, 2 pages/session)
- `/payments`, `/direct-sales`, `/expenses`, `/attendance`, `/messages`, `/clients` (add seed).
- Each: server lib + page + body split. Zero logic change. Shared query layer extraction where duplicated (jobs pattern).
- Gates per page: tsc · eslint · prettier · vitest · build · visual.

### Phase C — Tier 2 reports (2-3 sessions, 4-5 pages/session)
- Read-heavy reports, mostly already server components → add seed only.
- Smaller effort per page (no UI split needed, just server fetch + props).

### Phase D — Tier 3 + cleanup (1 session)
- Remaining reports + remove dead client-fetch code paths where seed covers.

### Phase E — Optional (later, separate plan)
- Public pages ISR (`revalidate`) — currently `force-dynamic` on some public routes; candidate for static/ISR.
- `/jobs/[id]/view`, `/clients/[id]/view` server move — high value but risky (edits). Defer.

---

## 6. Per-page effort estimate

| Work | Time |
|---|---|
| Server lib (`server-*.ts`) | 30-45 min |
| page.tsx split (server + body) | 45-60 min |
| Seed-aware hook refactor | 30-45 min |
| Tests (seed-gate regression, 3-5 tests) | 30 min |
| Visual verify | 15 min |
| **Total per page** | **~2.5-3 h** |
| 16 pages | **~40-48 h** (~6-8 sessions) |

---

## 7. Non-goals (do NOT do)

- ❌ Convert interactive forms/modals to RSC (no benefit, breaks client state).
- ❌ Edge RSC caching (`revalidate`) on authed pages — cookie-auth + `force-dynamic` (leak risk, Phase 4c rejected).
- ❌ Server pagination on `/clients` (UX break, proven).
- ❌ Payload trimming (list fields all used in UI).
- ❌ Bulk "convert all 70 client pages" — high risk, low gain.
- ❌ Service-role in page reads — RLS bypass banned (security).

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Double-fetch on mount | `useRef` skip-flags + `seedMatchesFilters` idempotent check (jobs pattern) |
| localStorage mismatch (server can't see it) | client mount-par check → seed drop + client fetch (graceful) |
| Hydration mismatch | same formatters (`inr()`), no `Date.now()` in render (pilot rule) |
| Cookie auth on server | `requireStaffWithRole()` (tested) |
| 2000-line move slips | pure move, logic edit banned; tsc + visual verify per page |
| SW/HTML stale data | `force-dynamic` + no HTML/RSC caching in SW (A4) |
| Dev `.next/dev/types` race | tsc with dev server stopped |

---

## 9. Gates (per phase, before commit)

1. `npx prettier --check` (touched files) · `npx eslint` (0 errors) · `npx tsc --noEmit`
2. `npx vitest run` (no regression; add seed-gate tests per page)
3. `npx next build` (routes/boundaries change)
4. User visual verify (numbers, filters, mobile)
5. Measured TTFB before/after per page (perf_baseline style)

Rollback = revert page.tsx (server-lib new file, safe; no DB change).

---

## 10. Old pendings cross-reference

| Pending item | Source | Status |
|---|---|---|
| Phase 3 `/clients` virtual list (react-window) | `perf_fastest_plan_2026.md` | ⬜ Backlog (2-3 hafte) |
| Phase 5 streaming polish / heavy widget boundaries | `perf_fastest_plan_2026.md` | ⬜ Minor |
| P3 cash-flow + due-reminders server move | `rsc_phase4_plan.md` | ⬜ Optional |
| JobsBody mega-component split + virtualization | `rsc_phase4_plan.md` §P2 follow-up | ⬜ Conditional on TBT measurement |
| `/jobs/[id]/view`, `/clients/[id]/view` server move | this plan §5 Phase E | ⬜ Deferred (risky) |
| Public pages ISR | this plan §5 Phase E | ⬜ Deferred |
| Ledger bug #2/#3 (delivered-only, discount split) | `ledger_billing_audit_2026.md` | ✅ Done (this session) |
| Pending-jobs separate display | ledger work | ✅ Done (this session) |
| Parts vs Service report | new feature | ✅ Done (this session) |

---

## 11. Recommended next action

**Start with Phase A on `/reports/client-parts-service`** — it's a fresh page (just built), low risk, and validates the RSC seed pattern on a brand-new feature before touching legacy pages. If Phase A succeeds (measured TTFB drop + zero regression), proceed to Phase B Tier 1.

User approval required before each phase. No bulk migration.
