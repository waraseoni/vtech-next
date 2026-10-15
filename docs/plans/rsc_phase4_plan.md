# Phase 4 — RSC Data Waterfall Removal (perf_db_fetch_audit)

> **Status: PLAN (2026-10-15) — approval pending.** Implementation tab, jab user
> approve kare. Plan-first rule (bade refactor bina plan ke nahi).
>
> **Goal:** authenticated first-paint me hi data (post-hydration waterfall khatam).
> **Proven:** G3 pilot `clients` — LCP 10.13s→5.2–5.9s (SSR wins, perf_baseline).
> **Audit line:** "Dashboard/jobs/clients initial data RSC me ya ek RPC per page
> se; stream." — clients done, **baaki: dashboard + jobs**.

---

## Current state (researched 2026-10-15)

| Page | Lines | Status | First-paint data path (aaj) |
| ---- | ----- | ------ | --------------------------- |
| `clients` | 20 | ✅ **RSC pilot done** | server page → `fetchClientsPageData()` → props → `ClientsBody` |
| `(dashboard)/dashboard` | 1968 | ❌ `"use client"` | hydration → useEffect → 5-6 Promise.all batches → setState |
| `jobs` | 2992 | ❌ `"use client"` | hydration → useEffect → supabase queries → setState |
| `reports/cash-flow` | 744 | ❌ `"use client"` | (Phase 4 scope se BAHAR — baad ka batch) |

**Established infra (dobara banana nahi):**
- `requireStaffWithRole()` — server auth (`src/lib/api-auth.ts`)
- `getServerSupabase()` — cookie+RLS server client; **service-role NEVER page reads me**
- `src/lib/server-{clients,expenses,mechanics,payments,salary,hours-salary}.ts` — server fetch-lib family
- Pilot pattern: `clients/page.tsx` (force-dynamic, async, props → client body)

## Non-goals

- ❌ react-query/SWR caching (Phase 3, alag sprint — aur A4 lesson: business
  numbers ka HTML/API/SW caching **banned**, stale salary/ledger > speed)
- ❌ API routes banane ki zaroorat nahi — server lib direct call (pilot jaisa)
- ❌ `reports/monthly-profit`, `cash-flow`, baaki reports — is phase me nahi
- ❌ Koi filter/modal/logic rewrite — **split = pure code move, zero logic change**

## Pattern (pilot se copy)

```
src/app/<page>/page.tsx          ← SERVER: requireStaffWithRole + fetch + props
src/lib/server-<page>.ts         ← SERVER fetch lib (getServerSupabase, Promise.all)
src/app/<page>/components/<Body> ← CLIENT: existing UI, initial data props se
export const dynamic = "force-dynamic"
```

---

## P1 — Dashboard (1968 ln) ⭐ highest impact (login ke baad pehla page)

### P1a — `src/lib/server-dashboard.ts`

`fetchDashboardInitialData(opts)` — sirf **first-paint batch** (aaj ka
dashboard `page.tsx:315-560` wala pehla useEffect), Promise.all me:

- profile + role
- quick stats (status counts + amounts — `head:true` counts + bounded sums)
- recent jobs (limit ~10) + recent payments (limit ~10)
- low-stock items + waiting-parts summary
- status/revenue seed data (pehle month wali default range ke liye)

**Client rehta hai (props/fetch nahi):**
- date-range financial widget (`page.tsx:693+` useEffect — user change pe chalta
  hai; server initial default range la sakta hai, OPTIONAL stretch)
- due-reminders full-scan block (`page.tsx:648+` — heavy, baad me; pehle paint
  me ye blocker nahi)
- install-prompt/QR/menu/theme states, charts (`dynamic()` recharts — pehle se
  deferred ✓), interactive modals

### P1b — Split

1. `page.tsx` → server component: auth + `fetchDashboardInitialData()` + render
   `<DashboardBody initial={...} />`
2. Existing JSX/useState/useEffect **as-is** move hoga `components/DashboardBody.tsx`
   me — mount-effect jo pehla fetch karta tha wo **props present hone par skip**
   (double-fetch warning — ye hi P1 ka main bug-risk point hai)
3. Stats/recent lists ka `useState(initial)` seed — render turant, spinner nahi

### P1 verification

- [ ] Numbers: dashboard pe aaj ke values se match (stats, recent, low-stock)
- [ ] Date-range widget change → naye numbers (client path intact)
- [ ] Mobile tab bar + install prompt + QR intact
- [ ] `dynamic` charts wahi jaise the

## P2 — Jobs list (2992 ln)

### P2a — `src/lib/server-jobs.ts`

`fetchJobsInitialData(searchParams)` — URL filters (`status`, `search`, `date*`,
`spot` — `useSearchParams` ke equivalent server `searchParams`):

- jobs rows ka first page (existing limit/pagination respect)
- quick-stats counts (Total/Pending/Completed — `head:true`)
- client-name map batch (`.in` on visible ids)
- firm info (agar page use karta hai)

### P2b — Split

1. `page.tsx` → server: auth + `fetchJobsInitialData(sp)` → `<JobsBody initial={...}/>`
2. Existing filter/search/pagination useEffect **mount-fetch skip** karega jab
   `initial` present ho; user interaction wahi purane client queries chalayengi
   (filter logic ka rewrite NAHI — initial = server, interaction = client)
3. `useSearchParams` wale Suspense boundary ka pattern maintain

### P2 verification

- [ ] `/jobs?status=1&search=...` URL se load → sahi rows + counts pehle se
- [ ] Filter change → client refetch (double-fetch nahi — network tab me ek hi)
- [ ] Pagination, bulk-select, print/export intact
- [ ] Mobile quick-stats bar

---

## Gates (per phase, commit se pehle)

1. prettier/eslint (touched files) · `npx tsc --noEmit` · `npx vitest run` (360+)
2. `npx next build` (routes/boundaries change)
3. User visual verify: dashboard + jobs (numbers, filters, mobile)
4. DevServer running ho to `.next/dev/types` race — tsc dev band karke chalana
   (15 Oct ko isi race ko debug kiya tha)

**Commits:** P1a+P1b EK commit (`perf(dashboard): ...`), phir P2 ek commit.
Rollback = page revert (server-lib naya file, safe).

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Double-fetch on mount (client effect + server) | props-guard on mount effect; network tab se verify |
| Hydration mismatch (server/client numbers) | same `inr()`/formatters, koi Date.now wala render nahi (pilot me already rule) |
| Cookie auth server par | `requireStaffWithRole()` — pilot-tested |
| Dashboard 1968-line move me slip | pure move, logic edit BANNED; tsc+visual verify |
| SW/HTML caching stale data | `force-dynamic` + SW me HTML/RSC caching pehle se intentionally nahi (A4) |

## Effort

- P1: ek session (plan approved) — sabse bada chunk
- P2: ek session
- Optional P3 (later): cash-flow + due-reminders server move
