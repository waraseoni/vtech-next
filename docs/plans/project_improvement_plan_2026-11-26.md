# Project Improvement Plan - 26 Nov 2026

> **Source:** `docs/plans/project_evaluation_2026-11-26.md` (findings + evidence).
> **Snapshot:** repo @ `a9874ab` (1.87.0). Gates green: tsc 0, vitest 744/744,
> build success, eslint clean.
>
> **Rules (project conventions):**
>
> - Live DB writes (grants, RLS, indexes) **owner approval ke baad hi** - migration
>   file pehle, apply baad me, verification read-only.
> - Peak-season / business-hours me schema change nahi (indexes non-concurrent
>   hain, brief write lock lagta hai).
> - Har task ke saath: `npx tsc --noEmit`, `npx eslint <files>`,
>   `npx vitest run`, zaroorat par `npm run build`.
> - Commit/push tabhi jab user bole.

**Legend:** `[ ]` pending, `[~]` in progress, `[x]` done, `[!]` blocked (owner).
Effort: S = <=2h, M = 0.5-1 day, L = 2-3 days.

---

## 1. At a glance

| Priority | Items | Sabse pehla kaam                                  | Kya unblocks karta hai            |
| -------- | ----: | ------------------------------------------------- | --------------------------------- |
| P0       |     5 | RPC grants hardening (anon hole)                  | Security + compliance             |
| P1       |     6 | Integration tests for money logic                 | Financial correctness confidence  |
| P2       |     4 | Perf/Lighthouse gate + PR flow                    | Long-term sustainability          |

**Sequencing:** P0 week 1-2 -> P1 week 2-6 -> P2 quarter. P0-3/P0-4 parallel
chal sakte hain (alag files).

---

## 2. P0 - Blockers (2 weeks)

### P0-1. RPC grants hardening (anon-executable definer functions)

- **Why:** 26/28 public definer functions `anon` ke liye EXECUTE-able hain;
  `reset_sequence` se sequence DoS, financials/balances public read. Evidence:
  `docs/plans/rpc_grants_hardening_plan.md`.
- **Files:** `supabase/migrations/2026xxxx_rpc_grants_lockdown.sql` (new),
  `docs/plans/rpc_grants_hardening_plan.md` (status update).
- **Work:**
  1. Saare 28 functions ki list + current grants `pg_proc`/`pg_policies` se
     read-only dump (no writes).
  2. Migration: `revoke execute ... from public, anon` + `grant ... to
     authenticated` (staff-guarded) / `service_role` jahan write hai.
     Staff-only functions me body guard `public.is_frontend_staff()` add karo
     (pattern: `get_dashboard_low_stock`, `get_dashboard_recents`).
  3. `reset_sequence` jaise write-RPC ko `authenticated` se bhi hatao - sirf
     `service_role` (backup page service-role route se chalta hai, verify karo).
  4. Post-apply verification (read-only): anon key se har RPC -> expect `401/403`;
     client-role user se staff-only RPC -> expect deny.
- **Acceptance:** anon-key probe me koi data/sequence access nahi; staff flows
  (dashboard, clients page, inventory, jobs stats) kaam karte hain; backup page
  `reset_sequence` chalta hai.
- **Risk:** galat revoke se staff UI break. Mitigation: fallback/404 handling
  check + apply se pehle staging/dev project par ek baar chalao.
- **Owner:** migration apply (live DB). **Code:** ~4-6h.

### P0-2. Pending migrations verify + apply

- **Why:** pending tracker ke mutabik kuch already applied hue, par kuch
  (updated `get_jobs_stats()` RPC, profile RLS) verify karna baaki hai.
- **Work:** read-only probe list banao:
  - `profiles` UPDATE policies me `is not distinct from` (coalesce nahi)
  - `transaction_list.item_name` column + `transaction_list_item_name_idx`
  - `brands` / `device_models` / `device_identifiers` / `service_types` tables
  - `get_jobs_stats` naye columns (`item_name` search) return karta hai
  - `get_due_stats`, `get_stale_jobs`, `get_dashboard_low_stock`,
    `get_dashboard_recents`, `get_dashboard_waiting` exist + staff guard
- **Acceptance:** `/profile` save chalega; naya job form brand dropdown load
  karega; jobs search `item_name` par kaam karega; RPC probes 200.
- **Effort:** S (1h probes) + owner apply jahan missing ho.

### P0-3. Dashboard silent-zero fallback fix

- **Why:** RPC error par due-stats zeros return karta hai - galat business
  number, koi error state nahi (W7).
- **Files:** `src/app/(dashboard)/dashboard/DashboardBody.tsx` (due stats
  fallback), `src/lib/server-dashboard.ts` (low-stock/recents/waiting).
- **Work:**
  1. Fallback path chale to UI me subtle "stale/approx" marker ya toast (ek
     line) dikhao; zeros ko valid data se distinguish karo.
  2. Fallback events count karo (module-level counter + `logger.warn` me
     `event: "rpc_fallback"`), taaki P1-3 alerting usse pakad sake.
- **Acceptance:** RPC galat karke (dev project par) verify: UI zeros ko
  "unavailable" dikhata hai, crash nahi; logs me structured fallback event.
- **Effort:** S (2h).

### P0-4. Split `JobsBody.tsx` (2,948 lines)

- **Why:** sabse bada churn + sabse bada file; highest regression risk (W4).
- **Files:** `src/app/jobs/JobsBody.tsx` -> `components/` modules.
- **Approach (behaviour change zero):**
  1. Shared state/hook pehle: `useJobList` already exists - filters, selection,
     bulk actions ko hook me consolidate karo.
  2. Tab-wise components: list/table, mobile cards, bulk bar, stats strip,
     stale alert, modals.
  3. Purana file sirf composition rakhe (<300 lines).
  4. Split ke baad `useJobList.test.tsx` + ek render smoke test.
- **Acceptance:** LOC target: top-level <300, koi bhi naya module >600 nahi;
  desktop + mobile tables, select-all, search, hide-delivered, bulk WA - sab
  same; `tsc`/`eslint`/`vitest`/build green.
- **Effort:** L (2-3 days).

### P0-5. Money-logic integration tests (start with ledger + due)

- **Why:** ledger/balance/EMI/commission formulas par real-DB tests nahi (W3);
  formula galti silent financial error hai.
- **Files:** new `src/lib/__tests__/ledger.integration.test.ts` (ya
  `tests/integration/`), fixtures.
- **Work:**
  1. Ek chhota fixture set: 3 clients (opening balance, delivered job, payment,
     discount, loan, direct sale).
  2. Pure computation functions ko fixture par test karo: `client-due.ts`,
     `ledger-data.ts`, `balance-sheet-data.ts`, `daily-done-data.ts`.
  3. Golden numbers hand-calculate karke test me pin karo (dual-era rules:
     legacy `Transactions` + modern `Jobs` status logs).
  4. CI me chalane ke liye DB ki zaroorat na ho - pure functions + fixture JSON
     (real DB integration optional, alag script).
- **Acceptance:** kam se kam 12-15 assertions: due/overdue buckets, payment vs
  discount split, loan outstanding, ledger running balance, balance-sheet
  totals. Sab green + ek intentionally galat formula test red hota hai.
- **Effort:** M (1-2 days).

---

## 3. P1 - Next 4-6 weeks

### P1-1. Generated DB types

- **Why:** hand-written types legacy schema ke saath drift karte hain.
- **Work:** `supabase gen types typescript --project-id ... > src/lib/db-types.ts`;
  naya script `types:gen`; `schema:drift` CI me types freshness check.
- **Acceptance:** `npm run types:gen` reproducible; diff empty on clean DB;
  no hand-edited DB types for core tables.
- **Effort:** M (half day) + migration of imports (incremental, ek-ek table).
- **Note:** bada diff - incremental approach, feature branch me.

### P1-2. Migration tracking in CI

- **Why:** 67 manual migrations, tracking nahi (W6).
- **Work:** CI job jo local `supabase/migrations/*.sql` ko remote
  `supabase_migrations.schema_migrations` se compare kare (read-only REST/RPC);
  unapplied list par fail/warn. Owner ke liye ek "apply checklist" output.
- **Acceptance:** pending migration CI me dikhti hai; applied list match par
  green.
- **Effort:** M (4-6h).

### P1-3. Observability: fallback + 5xx alerts

- **Why:** silent failures ka koi alert nahi (W7).
- **Work:** Sentry me `rpc_fallback` breadcrumb/event + release tag; Vercel
  logs se 5xx daily digest; `/api/health` me `checks.rateLimitMode`
  (`distributed|memory`) expose karo.
- **Acceptance:** dev project me RPC fail karke alert trigger verify; health
  endpoint mode dikhata hai.
- **Effort:** M (4h).

### P1-4. CSP enforce (report-only -> enforce)

- **Why:** stored-XSS ka second layer abhi sirf report-only hai.
- **Work:** 1-2 hafte `/api/csp-report` violations monitor; known
  inline-style/script exceptions allowlist (nonce/hash); phir
  `Content-Security-Policy-Report-Only` -> `Content-Security-Policy`.
- **Acceptance:** prod me violation rate ~0; login/dashboard/jobs/print sab
  kaam; rollback = header wapas Report-Only (one line).
- **Effort:** S (2h) + 2 weeks observation.

### P1-5. Remaining monoliths (rollout)

- **Why:** W4 ka baaki hissa.
- **Order (churn ke hisaab se):** `settings/website` (2,037) ->
  `jobs/new` (2,056) -> `mechanics/salary/SalaryPageInner` (2,035) ->
  `reports/ledger/client` (1,813) -> `backup/page` (2,225, sabse last kyunki
  sabse risky).
- **Rule:** ek PR me ek file, behaviour change zero, split se pehle/baad me
  smoke test.
- **Acceptance:** har file < 600 lines + modules tested.
- **Effort:** L (spread over sprints).

### P1-6. Docs consolidation

- **Why:** 82 docs, canonical source unclear (W8).
- **Work:** `docs/README.md` index (topic -> canonical doc -> status); completed
  plans `docs/plans/archive/` me; pending items sirf
  `pending_work_*.md` tracker me.
- **Acceptance:** koi bhi naya banda 5 min me sahi doc dhoond le; duplicate
  pending items zero.
- **Effort:** S (2h).

---

## 4. P2 - Quarter

### P2-1. Perf regression gate

- **Work:** Lighthouse CI (ya existing `WebVitals` sink + synthetic check) on
  `/`, `/login`, `/dashboard`, `/jobs`; LCP/TBT budgets; `npm run perf:check`
  ko CI me.
- **Acceptance:** budget breach par PR fail; monthly trend visible.

### P2-2. PR flow + second reviewer (bus factor) — DEFERRED (28 Nov 2026)

- **Decision:** solo owner + agent setup me PR-required/approval gate fake tha
  (author aur reviewer same account). Owner ne simple direct-`main` flow wapas
  choose kiya; force-push/delete block rakha gaya. Feature branch sirf risky
  experiments ke liye optional.
- **Work (future, jab doosra human aaye):** `main` par PR required + 1 approval
  + green CI enable karna; tab semantic-release same rahega.
- **Acceptance (future):** direct push to `main` blocked; release notes me
  reviewer field. Abhi compensation: local gates + owner oversight.

### P2-3. Lint/quality cleanup

- **Work:** 36 `eslint-disable` review (kaunse justified hain); `hardRefresh`
  localStorage regex narrow karo (`^(serwist|nextjs-)` + explicit precache
  keys); `npm audit` 5 vulns triage (transitive vs reachable).
- **Acceptance:** disable count justified list ke saath; audit triage note.

### P2-4. Offsite encrypted backup + restore drill

- **Work:** production hardening doc ka pending item; restore ko ek baar dry-run
  + ek baar real (non-prod project) me end-to-end chalao; RTO/RPO note karo.
- **Acceptance:** documented drill result + rollback steps.

---

## 5. Verification gates (har task par)

```powershell
npx tsc --noEmit
npx eslint src
npx vitest run
npm run build          # UI/route change par
npm run schema:drift   # migration/DB change par
npm run perf:check     # bundle-touching change par
```

Manual smoke (jo task touch karta hai): dashboard, jobs list + view + form,
clients view, ledger, balancesheet, reports/delivered, backup page, print routes.

---

## 6. Rollback notes

- **RPC grants:** revoke wapas grant karke restore (`grant execute ... to anon`
  sirf emergency me - phir turant fix). Migration reversible hai; copy of
  original grants plan doc me hai.
- **CSP enforce:** header name `Content-Security-Policy-Report-Only` par wapas.
- **File splits:** behaviour change zero hone chahiye, isliye revert ek commit.
- **Generated types:** purane hand-written types wapas import (feature branch
  isolate).
- **Indexes:** `drop index if exists ...` (apply ke baad 24h observe).

---

## 7. Status tracker

| ID    | Item                                  | Status | Effort | Owner       |
| ----- | ------------------------------------- | ------ | ------ | ----------- |
| P0-1  | RPC grants hardening + apply          | `[ ]`  | M      | code+owner  |
| P0-2  | Pending migrations verify/apply       | `[ ]`  | S      | owner       |
| P0-3  | Silent-zero fallback fix              | `[ ]`  | S      | code        |
| P0-4  | Split `JobsBody.tsx`                  | `[ ]`  | L      | code        |
| P0-5  | Money-logic integration tests         | `[ ]`  | M      | code        |
| P1-1  | Generated DB types                    | `[ ]`  | M      | code        |
| P1-2  | Migration tracking in CI              | `[ ]`  | M      | code        |
| P1-3  | Fallback + 5xx observability          | `[ ]`  | M      | code        |
| P1-4  | CSP enforce                           | `[ ]`  | S      | code+owner  |
| P1-5  | Remaining monolith splits             | `[ ]`  | L      | code        |
| P1-6  | Docs index + archive                  | `[ ]`  | S      | code        |
| P2-1  | Perf regression gate                  | `[ ]`  | M      | code        |
| P2-2  | PR flow + second reviewer             | `[ ]`  | S      | owner       |
| P2-3  | Lint/quality cleanup                  | `[ ]`  | S      | code        |
| P2-4  | Offsite backup + restore drill        | `[ ]`  | M      | owner       |

---

## 8. Decisions needed (owner)

1. **RPC lockdown window** - kaunse functions `service_role`-only honge
   (`reset_sequence` definitely), aur kin me `is_frontend_staff()` guard
   lagega. Ek baar decide hone par migration likhna straightforward hai.
2. **Generated DB types** - adopt karein (bada but one-time diff) ya hand types
   rakhein (faster but drift risk)?
3. **`JobsBody` split approach** - tab-based components (recommended) ya
   feature-folder refactor?
4. **PR flow** - second reviewer available hai (kaun), ya self-review checklist
   + delay process chalayein?
5. **CSP enforce timing** - violations ka 2-week observation window kab shuru
   karein?
