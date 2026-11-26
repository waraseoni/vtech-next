# Project Evaluation - V-TECH Next ERP (26 Nov 2026)

> **Purpose:** poore project ka technical mulyankan (strengths, weaknesses, risks)
> ek jagah, evidence ke saath. Ye document **kuch change nahi karta** - sirf
> snapshot hai.
>
> **Action plan:** `docs/plans/project_improvement_plan_2026-11-26.md`
>
> **Snapshot:** repo `vtech-next` @ `a9874ab` (release 1.87.0), branch `main`,
> tree clean. Gates us din green: `tsc` 0 errors, `vitest` 744/744,
> `next build` success, `eslint` clean.

---

## 1. Snapshot (measured)

| Metric                  |                Value | Note                                                     |
| ----------------------- | -------------------: | -------------------------------------------------------- |
| Source files            |                  624 | `.ts`/`.tsx`, tests excluded                             |
| Source LOC              |             ~139,200 | approx - `[id]` jaisi bracket paths count se chhoot gaye |
| Pages                   |                  125 | `app/**/page.tsx`                                        |
| API routes              |                   98 | `app/api/**/route.ts`                                    |
| Unit tests              | 744 (73 files)       | vitest 5                                                 |
| Test LOC                |                8,091 | source ka **5.8%**                                       |
| E2E specs               |                    8 | Playwright, writes double-gated                          |
| Migrations              |                   67 | manual apply (SQL Editor)                                |
| Docs                    |                   82 | markdown                                                 |
| Commits                 |                  970 | 807 human + release bot                                  |
| Commits (last 8 weeks)  |                  264 | high velocity                                            |
| Dependencies            |             34 + 34 | runtime + dev                                            |
| Type debt               |     13 `: any`, 1 `@ts-ignore` | very low                                      |
| `eslint-disable`        |                   36 | mostly intentional                                       |
| `console.log` / TODO    |              1 / 2 | low                                                      |
| Files > 1,400 lines     |                   15 | top 6 > 2,000 lines                                      |

**Stack:** Next 16.4.6, React 19.3.1, TypeScript 5.9, Supabase (Postgres + RLS +
Storage + Auth), TanStack Query, zod, react-hook-form, Tailwind 4, Serwist PWA,
Capacitor (Android), Sentry, Playwright, Vitest 5.

**Largest files (maintainability hotspots):**

| Lines | File                                                  |
| ----: | ----------------------------------------------------- |
|  2948 | `src/app/jobs/JobsBody.tsx`                           |
|  2225 | `src/app/backup/page.tsx`                             |
|  2056 | `src/app/jobs/new/page.tsx`                           |
|  2039 | `src/app/RootClient.tsx`                              |
|  2037 | `src/app/settings/website/page.tsx`                   |
|  2035 | `src/app/mechanics/salary/components/SalaryPageInner.tsx` |
|  1880 | `src/app/settings/page.tsx`                           |
|  1813 | `src/app/reports/ledger/client.tsx`                   |
|  1510 | `src/app/reports/balancesheet/BalancesheetBody.tsx`   |
|  1506 | `src/app/clients/components/ClientsBody.tsx`          |
|  1502 | `src/app/(dashboard)/dashboard/DashboardBody.tsx`     |

---

## 2. Scorecard

| Dimension          | Rating | Basis                                                        |
| ------------------ | -----: | ------------------------------------------------------------ |
| Architecture       |  4.5/5 | RSC seeds + React Query, query semantics single-source, zod  |
| Performance        |  4.5/5 | Measured wins, DB aggregates, indexes, lazy loads            |
| Security (code)    |  4.0/5 | RLS, nonce CSP, magic bytes, encrypted keys, fail-closed auth |
| Security (live DB) |  2.0/5 | **26/28 definer RPCs anon-executable** (own audit, unfixed)  |
| Testing            |  3.0/5 | 744 tests, par money logic + integration coverage patli      |
| Maintainability    |  2.5/5 | 15 files > 1,400 lines; top file 2,948 lines                 |
| Observability      |  2.5/5 | Sentry + `/api/health` + vitals; fallback events unmeasured  |
| Documentation      |  3.5/5 | Depth excellent, 82 files me sprawl                          |
| Delivery / DevOps  |  4.0/5 | CI, e2e, semantic-release, perf + drift scripts              |
| Bus factor         |  1.5/5 | 807/970 commits ek developer                                 |

**Overall: B+ / A-** - production-grade software hai; gaps sustainability aur
ek open security item ke hain, code quality ke nahi.

---

## 3. Strengths (pros)

1. **Layered data architecture.** RSC layout server par data fetch karta hai,
   `ServerSeed`/`*SeedProvider` se React Query `initialData` banta hai,
   `staleTime 30s` duplicate fetch rokta hai. Query semantics ek hi file me
   (browser + server dono wahi function) - parity by construction.
2. **Performance measured hai, guess nahi.** Documented before/after numbers
   (`353->76ms`, `384->107ms`, RSC headers `400->15ms`), DB-side aggregates,
   column projection, `Promise.all`, Mumbai region pinning, AVIF, immutable
   static cache, keep-alive cron.
3. **Migration-safe fallbacks.** Naye RPCs ke bina app chalta hai - purana
   client path fallback me hai. Isse live-DB change windows safe hote hain.
4. **Security engineering depth (code level).** RLS lockdown, `security definer`
   + `search_path` pinned, restricted grants, nonce CSP on print routes
   (stored XSS), magic-byte upload validation, HMAC tracking tokens,
   AES-256-GCM AI key encryption, admin gates, fail-closed auth.
5. **Hygiene.** tsc + eslint + build + 744 tests green; CI (ci/e2e/release),
   semantic-release, prettier check, bundle budget, schema drift script.
   Type debt minimal (13 `any`, 1 `@ts-ignore`).
6. **Documentation culture.** Plans me "kyun", measured results, rollback SQL,
   dual-era DB rules (`docs/DATA_MIGRATION_NOTES.md`), pending tracker.
7. **Operational care.** `/api/health` with feature flags, backup restore
   dry-run default + admin lock-out protection, PWA/WebView Clear Cache button,
   offline barcode scanning.

---

## 4. Weaknesses (cons)

### W1. Bus factor = 1 (highest structural risk)

807/970 commits ek developer. Direct `main` par push + auto-release, koi
second reviewer nahi. Docs achhe hain, par ledger math aur dual-era DB rules
ka critical knowledge ek hi jagah hai.

### W2. RPC grants ka open security hole (highest immediate risk)

`docs/plans/rpc_grants_hardening_plan.md` (16 Nov audit) ke mutabik:
**28 public functions me se 26 `anon` ke liye EXECUTE-able** hain. Anon key
bundle me public hoti hai, isliye bina login:

- `get_dashboard_stats`, `get_clients_page_financials`, `get_monthly_revenue`,
  `get_technician_metrics`, `get_inventory_stock` - **200 with real data**
- `reset_sequence` - `setval()` on any public table sequence (**DoS**)
- `next_job_id` / `peek_next_job_id` - counter burn/read
- Portal ke `client` users bhi `authenticated` hain aur wahi definer RPCs
  call kar sakte hain (cross-customer balances)

Naye batch (`get_jobs_stats`, `get_stale_jobs`, `get_due_stats`) sahi pattern
par hain (401 for anon) - matlab fix ka pattern already codebase me hai.
Ye **plan ready, migration nahi likhi** - isliye live hole khula hai.

### W3. Money-critical logic par tests patle

5.8% test LOC ratio; suite ka bada hissa utils, parsers, validation hai.
Ledger, balance sheet, EMI, advance, commission - inke liye real-DB
integration tests nahi hain. Formula galti silent financial error banti hai;
unit tests use nahi pakad sakte. E2E 8 specs hain aur writes double-gated
(sahi safety, par coverage kam).

### W4. Monolithic files

`JobsBody.tsx` 2,948 lines; 15 files > 1,400 lines. In files me review, test,
bug-isolation teeno mushkil. Regression risk yahin concentrated hai -
pichhle sprints me inhi files me sabse zyada churn hua hai.

### W5. Legacy DB dual-era conventions

PHP-era leftovers: `meta_id` keys, legacy vs modern status-log rows,
`client_name` text->bigint, `item` vs `item_name`, `delete_flag`, NULL vs
empty-string. Har naya feature ko history padhni padti hai. Types hand-written
hain - `supabase gen types` use nahi hota.

### W6. Migrations manual hain

67 migration files, apply SQL Editor se by hand. `schema_migrations` tracking
nahi - isliye "kaunsi migration applied hai" ka answer object-level probes se
dhoondna padta hai (pending tracker me isi ka example hai). Drift script hai,
par process-level guarantee nahi.

### W7. Silent fallbacks observability chhupate hain

RPC fail -> legacy path (`logger.warn` only); due-stats error -> **zeros
return** (galat number, koi error UI nahi); rate limiter Redis fail -> memory
(protection kam). In events ka koi metric/alert nahi hai.

### W8. Docs sprawl

82 markdown files, overlapping plans (speed wins, RSC, pending tracker,
hardening, audit). Naye banda ke liye canonical source pata karna mushkil;
stale docs code se contradict kar sakte hain.

### W9. Perf continuous nahi hai

Sab measurement manual/one-off. Lighthouse CI ya LCP regression budget nahi
(bundle budget tak hi). Aaj fast hai; 3 mahine baad drift pakda nahi jayega.

### W10. Chhote but real items

- CSP abhi **report-only** hai (enforce pending).
- `npm audit`: 5 transitive vulnerabilities.
- `hardRefresh` ka localStorage regex `/(serwist|nextjs|precache|sw)/i` broad
  hai - future key (jaise `..._swipe`) galti se wipe ho sakti hai.
- Restore flow temp credentials response me deta hai - log me na jaye, ensure
  karna hai.
- Route restructure ke baad stale `.next` `tsc` todta hai (local DX friction).

---

## 5. Risk ranking

| Rank | Risk                                    | Impact                    | Likelihood | Priority |
| ---: | --------------------------------------- | ------------------------- | ---------- | -------- |
|    1 | Anon-executable definer RPCs            | Data leak + DoS           | High       | P0       |
|    2 | Bus factor = 1                          | Delivery continuity       | High       | P1       |
|    3 | Money logic without integration tests   | Silent financial errors   | Medium     | P0/P1    |
|    4 | Monolith regression (JobsBody etc.)     | Bugs in core flows        | Medium     | P0/P1    |
|    5 | Manual migrations / drift               | Broken feature after deploy | Medium   | P1       |
|    6 | Silent fallbacks (zeros)                | Wrong business decisions  | Medium     | P0       |
|    7 | Docs sprawl                             | Onboarding + wrong info   | Low/Med    | P2       |
|    8 | No perf regression gate                 | Slow drift                | Low/Med    | P2       |

---

## 6. Pehle se covered items (duplicate na karein)

| Item                                | Existing doc                                        |
| ----------------------------------- | --------------------------------------------------- |
| RPC grants hardening                | `docs/plans/rpc_grants_hardening_plan.md`           |
| Pending user actions / device QA    | `docs/plans/pending_work_2026-11-20.md`             |
| Production hardening (CSP, backups) | `docs/plans/production_hardening_plan_oct28_2026.md` |
| Perf history / measured wins        | `docs/plans/speed_wins_nov13_2026.md`, `perf_fastest_plan_2026.md` |
| RSC rollout                         | `docs/plans/rsc_implementation_best_plan_2026.md`   |
| DB dual-era rules                   | `docs/DATA_MIGRATION_NOTES.md`                      |
| Service-center data model           | `docs/plans/service_center_data_model_plan_2026-11-21.md` |

---

## 7. Verdict

Project **B+ / A-** hai. Breadth (job -> billing -> ledger -> inventory ->
purchase -> mechanics -> loans -> reports -> messaging -> AI -> public site ->
Android) aur depth (RLS, RSC, measured perf) dono impressive hain, aur code
hygiene in-house ERPs ke average se kaafi upar hai.

Asli weakness "code kharab hai" nahi - **sustainability** hai:

1. ek hi developer ke paas saara critical knowledge,
2. kuch bahut bade files jahan sabse zyada change hota hai,
3. financial logic par tests ki kami.

Aur ek **immediate security item** (W2) jo already documented hai par applied
nahi hai. In chaar cheezon par kaam hua to project A grade ban jayega.
