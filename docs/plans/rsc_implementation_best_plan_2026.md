# RSC Implementation — Best Plan (2026)

> **Status:** Plan only — execution pending user approval per phase.
> **Audit date:** 20 Nov 2026 · **Repo:** vtech-next (Next.js, cookie-auth staff app)
> **Cross-ref:** `docs/plans/rsc_phase4_plan.md` (P1 dashboard ✅, P2 jobs ✅, P3 optional),
> `docs/plans/perf_fastest_plan_2026.md` (Phase 3 backlog, Phase 4c rejected),
> `docs/plans/ledger_billing_audit_2026.md` (billing fixes done).

---

## 1. Audit — current RSC adoption

| Metric                                                        |   Count |   % |
| ------------------------------------------------------------- | ------: | --: |
| Total pages (`page.tsx`)                                      |     124 | 100 |
| Client components (`"use client"`)                            |      71 |  57 |
| Server components (no `"use client"`)                         |      53 |  43 |
| Async server components                                       |      47 |  38 |
| `force-dynamic` (cookie-auth, no edge cache)                  |      44 |  35 |
| **Server pages jo first-paint data fetch karte hain**         |  **48** |  39 |
| **Client pages jo mount par khud fetch karte hain (no seed)** | **60+** |   — |

> **20 Nov re-verification:** pichle draft ka "only 6 pages seeded" figure galat
> impression deta tha. Reality: 48/53 server pages already first-paint data
> (server fetch / stream) dete hain; dedicated seed modules 6 hain, baaki
> direct server fetch + props. Asli gap = 9 list/report pages (§4).

### RSC seed already applied (6 pages) — the real perf win

| Page                            | Seed file                   |
| ------------------------------- | --------------------------- |
| `/reports/accounting-dashboard` | `accounting-dashboard-data` |
| `/reports/balancesheet`         | balancesheet seed           |
| `/reports/cash-flow`            | cash-flow seed              |
| `/reports/daily-done`           | `daily-done-data`           |
| `/reports/monthly-profit`       | `monthly-profit-data`       |
| `/reports/pending-jobs`         | `pending-jobs-data`         |

### Server-component pages (53) — already RSC first-paint

Core: dashboard, jobs, clients, payments, direct-sales, expenses, inventory,
mechanics, suppliers, attendance, messages, inquiries, profile, activity-logs,
`clients/[id]/*`, `jobs/[id]/*`, `direct-sales/[id]/*`.
Reports (26+): sab report pages server components hain aur data server par fetch
karte hain; 6 ke paas dedicated seed module hai, baaki direct server fetch +
props (`PageLoader`/Suspense). **Inme naya kaam nahi bacha.**

### Client-component pages (71) — mostly interactive (RSC nahi chahiye)

Forms/wizards: `jobs/new`, `jobs/[id]/edit`, `clients/new`, `clients/[id]/edit`,
add-payment, collect-emi, give-loan, add-direct-sale, estimates, advance,
client-loans, lenders, services.
Detail/editor views: `clients/[id]/view`, `jobs/[id]/view`, `inventory/[id]`,
`suppliers/[id]`, `mechanics/[id]/*`.
Labels/print: ledger-print, combined-invoice, spot-labels, box-labels.
Admin/tools: developer, back-office, backup, `settings/*`, sync, images,
`seller/*`, `my-account/*`, `(public)/*`.

**Exception (RSC candidate):** 9 list/report pages jo client hain aur mount par
khud fetch karte hain — §4 dekho.

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

| Category                  | Count | RSC?                  | Reason                                                                  |
| ------------------------- | ----: | --------------------- | ----------------------------------------------------------------------- |
| Interactive forms/wizards |   ~20 | ❌ No                 | Modals, optimistic updates, client state — RSC adds complexity, no gain |
| Detail/editor views       |   ~15 | ❌ No                 | Heavy client state (edits, bulk actions)                                |
| Labels/print pages        |    ~5 | ❌ No                 | Print is client-side popup                                              |
| Admin/tools/settings      |   ~12 | ❌ No                 | Low traffic, no perf need                                               |
| Public pages              |    ~6 | ✅ Already static-ish | Consider ISR/revalidate (separate)                                      |
| **List/report pages**     |   ~14 | ✅ **Yes**            | High TTFB benefit, read-heavy, filters are URL-driven                   |

**Re-verified 20 Nov 2026 (code scan):** 124 pages = 71 client + 53 server
(44 `force-dynamic`). **48 of 53 server pages already fetch first-paint data**
(baseline server-seeded). Sirf **9 list/report pages** abhi bhi `"use client"`
hai aur mount par khud fetch karte hain (koi server seed / layout seed nahi) —
inhi par kaam bacha hai. Client seed wrappers (layout/provider) alag se verify
kiye: `products`, `advance`, `jobs/bulk`, `jobs/bulk-edit`,
`jobs/combined-invoice`, `jobs/spot-labels`, `inventory/purchase-orders`,
`inventory/locations`, `inventory/stocktake`, `mechanics/commission` — ye
pehle se seeded hain, inse haath mat lagao.

---

## 4. Candidate list (verified — 20 Nov 2026)

> ⚠️ **Correction:** is plan ka pehla draft `/payments`, `/direct-sales`,
> `/expenses`, `/attendance`, `/messages`, `/clients` ko "no seed" likhta tha —
> **galat**. Ye sab pehle se server-seeded hain (`server-payments.ts`,
> `server-expenses.ts`, `fetchClientsBatches`, `loadStaffSeed`). Reports ke
> zyadatar pages (ledger, monthly-sales, top-customers, delivered, due-reminders,
> loan, activity, stock-valuation, `supplier-*`) bhi server components hain
> with first-paint fetch.

### Tier 1 — Reports jo abhi bhi client-fetch hain (4 pages)

1. `/reports/client-parts-service` — naya page (31 KB client component), koi seed nahi.
2. `/reports/client-payment` — `useQuery` + `.from()` mount par.
3. `/reports/daily-sales` — mount `useEffect` + `.from()`.
4. `/reports/daily-service` — mount `useEffect` + `.from()`.

### Tier 2 — Admin/legacy lists (5 pages, low traffic)

5. `/clients-admin` — `useEffect` + `.from()` (admin-only tool).
6. `/services` — `useQuery` + `.from()`.
7. `/lenders` — `useQuery` + `.from()`.
8. `/client-loans` — `useQuery` + `.from()`.
9. `/seller` — client page, seller-facing (defer; low traffic).

### Explicitly NOT in scope (verified interactive)

`jobs/new`, `jobs/[id]/edit`, `jobs/[id]/view` (seed provider se already
seeded), `clients/[id]/view` (React Query initialData), `clients/[id]/*`
action pages, `inventory/[id]`, `suppliers/[id]`, `settings/*`, `backup`,
`developer`, `images`, `sync`, `ai`, `setup`, `mechanic` ledgers,
`messages/supervise`, `users/*`, `products` (layout se seeded).

---

## 5. Phased execution plan

### Phase A — Template + 1 pilot (1 session)

- Pick **`/reports/client-parts-service`** (fresh page, low risk) as the validation page.
- Create `src/lib/server-client-parts-service.ts` (`fetchClientPartsServiceData(sp)`).
- Split: `page.tsx` server + `ClientPartsServiceBody.tsx` client (move existing UI verbatim).
- Seed-aware `useClientPartsService` hook with skip-flags + `seedMatchesFilters`.
- Gates: tsc ✓ · eslint ✓ · prettier ✓ · vitest ✓ · build ✓ · visual verify (filters, expand, CSV).
- **Deliverable:** reusable template documented in this file §2.

### Phase B — Remaining Tier 1 reports (2 sessions, 2 pages/session)

- `/reports/client-payment`, `/reports/daily-sales`, `/reports/daily-service` (+ pilot ke baad `client-parts-service`).
- Each: server lib + page + body split. Zero logic change. Shared query layer extraction where duplicated (jobs pattern).
- Gates per page: tsc · eslint · prettier · vitest · build · visual.

### Phase C — Tier 2 admin/legacy lists (1-2 sessions)

- `/services`, `/lenders`, `/client-loans`, `/clients-admin` (low traffic, sirf consistency ke liye).
- Smaller effort (simple lists, `useQuery` → `initialData`).

### Phase D — Cleanup (1 session)

- Seeded pages ke dead client-fetch paths hatana (jahan seed cover karta hai).
- `CLIENTS_ADMIN`/`seller` owner decision ke baad hi.

### Phase E — Optional (later, separate plan)

- Public pages ISR (`revalidate`) — currently `force-dynamic` on some public routes; candidate for static/ISR.
- `/jobs/[id]/view`, `/clients/[id]/view` full server move — already React Query/seed provider se covered, risky. Defer.

---

## 6. Per-page effort estimate

| Work                                    | Time                         |
| --------------------------------------- | ---------------------------- |
| Server lib (`server-*.ts`)              | 30-45 min                    |
| page.tsx split (server + body)          | 45-60 min                    |
| Seed-aware hook refactor                | 30-45 min                    |
| Tests (seed-gate regression, 3-5 tests) | 30 min                       |
| Visual verify                           | 15 min                       |
| **Total per page**                      | **~2.5-3 h**                 |
| 9 pages (4 reports + 5 lists)           | **~22-27 h** (~4-5 sessions) |

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

| Risk                                        | Mitigation                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| Double-fetch on mount                       | `useRef` skip-flags + `seedMatchesFilters` idempotent check (jobs pattern) |
| localStorage mismatch (server can't see it) | client mount-par check → seed drop + client fetch (graceful)               |
| Hydration mismatch                          | same formatters (`inr()`), no `Date.now()` in render (pilot rule)          |
| Cookie auth on server                       | `requireStaffWithRole()` (tested)                                          |
| 2000-line move slips                        | pure move, logic edit banned; tsc + visual verify per page                 |
| SW/HTML stale data                          | `force-dynamic` + no HTML/RSC caching in SW (A4)                           |
| Dev `.next/dev/types` race                  | tsc with dev server stopped                                                |

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

> **Poora consolidated tracker:** `docs/plans/pending_work_2026-11-20.md`
> (A = user action, B = perf/RSC, C = security, D = data, E = features).

| Pending item                                        | Source                             | Status                                                  |
| --------------------------------------------------- | ---------------------------------- | ------------------------------------------------------- |
| Phase 3 `/clients` virtual list (react-window)      | `perf_fastest_plan_2026.md`        | ⬜ Backlog (2-3 hafte)                                  |
| Phase 5 streaming polish / heavy widget boundaries  | `perf_fastest_plan_2026.md`        | ⬜ Minor                                                |
| P3 cash-flow + due-reminders server move            | `rsc_phase4_plan.md`               | ⬜ Optional                                             |
| JobsBody mega-component split + virtualization      | `rsc_phase4_plan.md` §P2 follow-up | ⬜ Conditional on TBT measurement                       |
| `/jobs/[id]/view`, `/clients/[id]/view` server move | this plan §5 Phase E               | ⬜ Deferred (already seed-provider/React Query covered) |
| Public pages ISR                                    | this plan §5 Phase E               | ⬜ Deferred                                             |
| RPC grants hardening                                | `rpc_grants_hardening_plan.md`     | 🔴 Pending (security)                                   |
| Passkey migration apply + device QA                 | `docs/TODO.md`                     | 🔴 User action                                          |
| Login page friendly UX revamp                       | `login_page_friendly_ux_plan.md`   | ⬜ Not started                                          |
| Multi-brand architecture                            | `multi_brand_*_plan.md`            | ⬜ Not started (0 code refs)                            |
| Ledger bug #2/#3 (delivered-only, discount split)   | `ledger_billing_audit_2026.md`     | ✅ Done                                                 |
| Pending-jobs separate display                       | ledger work                        | ✅ Done                                                 |
| Parts vs Service report                             | new feature                        | ✅ Done                                                 |

---

## 11. Recommended next action

**Start with Phase A on `/reports/client-parts-service`** — it's a fresh page (just built), low risk, and validates the RSC seed pattern on a brand-new feature before touching legacy pages. If Phase A succeeds (measured TTFB drop + zero regression), proceed to Phase B Tier 1.

User approval required before each phase. No bulk migration.
