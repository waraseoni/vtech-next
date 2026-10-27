# Performance & React Modernization Plan — v2

Created: 2026-10-27 · **v2 — `origin/main` pull (v1.68.2 → v1.70.1) ke baad rebase kiya**
Status: **PROPOSED — execution pending** · Koi code change is doc ke saath nahi hua.

Goal: data layer ek pattern par laana, write path ko standardize karna, server components
ka fayda lena, React 19 features use karna, aur bade components ka bojh kam karna.
**UI rewrite nahi** — behaviour same, architecture badlegi.

Related: `tech_adoption_sprint_plan.md` (T0–T6), `frontend_performance_plan.md`,
`perf_db_fetch_audit_oct14_2026.md`, `perf_baseline.md`, `rsc_phase4_plan.md`,
`offline_localhost_master_plan.md`, `DATA_MIGRATION_NOTES.md`.

---

## 0. v1 se kya badla (27 Oct pull review)

Pull: `c1001f1..9703613` — 49 files, +7,605 / −3,466. Release **1.70.0**.
Follow-up pull: `9703613..f65840a` — 7 files, +138 / −20. Release **1.70.1**
(`cameraSupport` fallback error → friendly message + 12 unit tests, **koi dependency change nahi**).

| Update | Kya aaya | Is plan par asar |
| --- | --- | --- |
| **Zod layer** | `zod@4.6.7` + `parseBody` + 8 API routes validated | Data/form conventions ki nayi single source of truth |
| **React Hook Form** | `react-hook-form` + `@hookform/resolvers@5` — 2 pilots (`clients/new`, `jobs/new`) | 49 forms me se 2 done; rollout T6 backlog hai |
| **Playwright e2e** | 5 smoke specs + `e2e.yml` (push = read-only, manual = writes) | **Naya acceptance gate** — converted pages ko smoke test se verify karo |
| **RQ devtools** | `@tanstack/react-query-devtools` (dev-only) | v1 ka Phase 0.5 **already done** |
| **Bundle baseline** | Per-route client KB table record hui (26 Oct) | v1 ke "initial JS 145 KB" se zyada useful metric |
| **@google/genai** | `@google/generative-ai` replaced | Bundle impact neutral |
| **Native barcode** | `BarcodeDetector` first, html5-qrcode fallback | ~250 KB chunk native path par load hi nahi hota |
| **vitest 5** | `4.1.11 → 5.0.5` (+coverage-v8 5) | Test gate updated |
| **cameraSupport fix (1.70.1)** | fallback engine ka raw `Error` friendly message me + 12 tests | Scanner UX; React usage par asar nahi |
| **TS 7** | **BLOCKED** — `typescript-eslint@8` peer `<6.1` | TS 5.9.3 par raho |
| **26 files RQ converted** | 19 Oct: products, users, services, dashboard, messages, JobsBody, suppliers, inventory, backup, attendance… | Read-side ka bada hissa ho chuka |
| **T6 backlog** | "RQ completion" + "RHF rollout" explicitly pending | **Yeh plan unhi ko detail me karta hai** |

> ⚠️ **E2E live-DB warning:** 26 Oct ke write-run ne live DB me 46 test rows bana diye
> (`docs/DB_CHANGES_E2E_AUDIT_2026-10-26.md`). Aage writes = **staging project only**,
> ya `E2E_ALLOW_WRITES=0`.

---

## 1. Baseline — measured on v1.70.0 (27 Oct)

### 1.1 Structure

| Metric | Value |
| --- | --- |
| src files / lines | 433 / ~1.46 lakh |
| App pages | 120 |
| — server components | 20 (17%) |
| — `"use client"` | 100 (83%) |
| Route handlers | 92 |
| Files > 800 lines | 51 |
| Files > 1,500 lines | 15 |

### 1.2 React API usage

| API | Count | Note |
| --- | --- | --- |
| `useState` | 1,496 | heavy local state |
| `useEffect` | 317 | |
| `useMemo` / `useCallback` / `memo` | 97 / 156 / 2 | Compiler ON hai — mostly redundant |
| `useContext` / `createContext` | 1 / 1 | global state lagbhag nahi |
| `useQuery` | 51 calls, 23 pages | 45 files total RQ use karte hain |
| **`useMutation`** | **0** | **sabse bada gap** |
| `useTransition` / `useDeferredValue` / `useOptimistic` | 0 / 0 / 0 | React 19 features unused |
| `Suspense` / `lazy`·`dynamic` | 29 / 12 | |

### 1.3 Data layer

| Metric | Value |
| --- | --- |
| Manual-fetch client files | **82** |
| `.from()` in those files | **480** |
| `useEffect` in those files | 137 |
| Files with client writes | **82** |
| `.insert/.update/.delete/.upsert` sites | **213** |
| `.rpc()` sites | 14 |
| Reports pages | 28 client / **3 server** |

### 1.4 Forms & validation

| Metric | Value |
| --- | --- |
| Files with `onSubmit` | 49 |
| On react-hook-form | **2** (`clients/new`, `jobs/new`) |
| Zod schemas | 7 files (`src/lib/validation/schemas/*`) |
| Zod-validated API routes | 8 / 92 |

### 1.5 Bundle (T0 baseline, 26 Oct — `next experimental-analyze --output`)

| Route | Client KB | Total KB |
| --- | --- | --- |
| `/reports/cash-flow` | 762.8 | 2,229.3 |
| `/dashboard` | 648.5 | 2,267.4 |
| `/reports/monthly-profit` | 633.4 | 2,105.4 |
| `/inventory` | 629.8 | 2,382.0 |
| `/clients` | 627.3 | 2,214.7 |
| `/products` | 587.5 | 2,189.9 |
| `/inventory/locate` | 575.2 | 2,183.7 |
| `/inventory/[id]` | 500.9 | 2,018.5 |
| `/jobs/[id]/view` | 491.5 | 1,997.2 |
| `/clients/[id]/view` | 490.5 | 1,994.7 |

**Rule:** koi naya dep ~50 KB+ badhaye to justify karna hoga.

### 1.6 Tests

| Gate | State |
| --- | --- |
| vitest | 429 tests green (5.0.5) |
| zod schema tests | 12+ |
| Playwright | 5 smoke specs; CI push = read-only |
| perf budget | `npm run perf:check` (FCP ≤ 2500ms, taskMs ≤ 3000, DOM ≤ 1200) |

---

## 2. Diagnosis — v2

### 2.1 Read-side kaam ho gaya, **write-side zero** (P1)

19 Oct ke round me 26 files `useQuery` par aa gayi. Par **`useMutation` abhi bhi 0** hai:
- 213 write sites manually `try/catch` + `toast` + `router.replace` likhte hain.
- Invalidation bhoolna default behaviour hai — 27 Oct ke do bugs (`job view total 0`,
  `client payment gayab`) isi se the. Fix 5 files me hua, pattern **82 files** me hai.
- `useQuery` ka cache tab hi kaam karta hai jab writes usko invalidate karein.

**Conclusion: v2 ka #1 priority read migration nahi, write layer hai.**

### 2.2 82 manual read files (P2)

`480 .from()` + `137 useEffect`. Inme se kuch **deliberately chhode gaye** hain
(`JobsBody`/`useJobList` RSC-seed gate + regression suite; `ClientsBody` fully RSC-seeded) —
unhe dobara chhedna nahi hai. Baaki convert hone chahiye.

### 2.3 RSC underused (P3)

120 pages me 20 server. Reports me 28 client / 3 server. Read-only reports browser me
fetch karte hain → client JS + waterfall.

### 2.4 Forms (P4 — alag track)

49 `onSubmit` files, sirf 2 RHF par. Zod schemas 7 files me hain par 92 routes me se
8 validated. Yeh performance nahi, **correctness/DX** track hai; T3 ke result par depend.

### 2.5 Component size (P5)

51 files > 800 lines, 15 > 1,500. `messages/page.tsx` me 12 `useEffect`.
Re-render blast radius bada.

### 2.6 Concurrent features unused (P6)

`useTransition`/`useDeferredValue`/`useOptimistic` = 0. Bade lists ke search/filter aur
write toggles ke seedhe use-case hain.

### 2.7 Manual memo vs Compiler (P7)

React Compiler ON (`babel-plugin-react-compiler@1.0.0`) — 156 `useCallback` + 97
`useMemo` mostly redundant. Note: RHF ka `watch()` compiler ko skip karwata hai
(T3 doc me documented) — isliye `useWatch` pattern follow karo.

---

## 3. Non-goals (existing decisions respect karo)

- `JobsBody`/`useJobList` **convert nahi karna** — RSC-seed regression suite hai.
- `ClientsBody` **convert nahi karna** — fully RSC-seeded, fetch-on-mount effect nahi.
- zustand/redux/jotai — global state ka problem hi nahi.
- TanStack Table / GraphQL / Radix — skip list me hain.
- Sentry 11 major — skip (critical 10.76.2 me fix).
- TypeScript 7 — **blocked** (typescript-eslint peer `<6.1`).
- CSS refactor — brotli 28.5 KB, ROI nahi.
- Supabase chunk lazy karna — auth ke liye eager chahiye.

---

## 4. Phases

Har phase shipable. Ek PR = ek domain. Behaviour change nahi.

### Phase 0 — Guardrails (~0.5 din) — **pehle**

| # | Task | Status |
| --- | --- | --- |
| 0.1 | RQ devtools (dev-only) | **DONE** (T0) |
| 0.2 | Bundle baseline record | **DONE** (T0) |
| 0.3 | Data + form conventions doc (`src/lib/queries/*`, `parseBody`, zodResolver) | TODO |
| 0.4 | CI bundle budget: `route-summaries.json` se per-route client KB threshold (baseline +10%) | TODO |
| 0.5 | ESLint guard: naye `"use client"` file me `useEffect` + `supabase.from(` → warn | TODO |
| 0.6 | Perf baseline (`npm run perf:check`) record | TODO |

### Phase 1 — Mutation layer (`useMutation`) — **highest ROI** · 3–5 din

**Problem:** 213 write sites, 0 abstraction.

**Design:** `src/lib/queries/mutations.ts` (+ per-domain files) me standard hooks:

```ts
export function useSavePayment(clientId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PaymentInput) => insertPayment(payload),
    onSuccess: async () => {
      toast.success("Payment save ho gayi!");
      await qc.invalidateQueries({ queryKey: clientDetailKey(clientId), refetchType: "all" });
    },
  });
}
```

**Rollout order (proof se shuru):**
1. 27 Oct ke 5 fixed sites — `add-payment`, `collect-emi`, `give-loan`,
   `add-direct-sale`, `jobs/[id]/edit` → inhe `useMutation` me formalize karo.
2. `clients/[id]/view` (6 writes), `clients/[id]/page` (5), `lenders` (6).
3. `jobs/new` (7), `jobs/[id]/edit` (7), `jobs/bulk`, `bulk-edit`, `spot-labels`.
4. `inventory/purchase-orders` (8), `SupplierFormModal` (8), `ProductFormModal` (4).
5. `ExpensesPageInner` (6), `SalaryPageInner` (5), `MechanicsBody` (7),
   `DailyAttendance` (4), `settings/whatsapp-templates` (4).
6. `backup` (3+RPC), `services` (4), `client-loans` (4).

**Acceptance:** `useMutation` > 0; koi bhi navigation wala write bina invalidation na ho;
e2e smoke (job-create, direct-sale) green.

### Phase 2 — Read migration 82 → 0 · 1–2 hafte

Domain batches (deliberate exclusions chhod ke):

1. **clients** — `clients/[id]/page`, `ledger-print`, `ClientsBody` (skip), `clients-admin`
2. **jobs** — `jobs/new`, `jobs/[id]/edit`, `jobs/old`, `[id]/old` (protected, sirf read), `bulk`, `bulk-edit`
3. **inventory** — `locate`, `purchase-orders/[id]`, `box-labels`
4. **mechanics** — `salary/*`, `commission`, `[id]`, `ledger/[id]`
5. **suppliers / payments / expenses / direct-sales / attendance / settings**
6. **reports** — Phase 3 ke saath overlap

**Per-file DoD:** read = `useQuery`; write = `useMutation`; loading/error query state se;
fetch-only `useEffect` delete; `typecheck + lint + test` green.

### Phase 3 — RSC for read-only reports · 1 hafta

28 client reports → server component + chhota client island (filters URL params se).

First wave (`accounting-dashboard` 28 fetches, `daily-income`, `monthly-profit`,
`stock-valuation`, `top-customers`, `technician-performance`, `due-reminders`).

**Acceptance:** route client KB gira; no hydration mismatch; filter + print same;
e2e read-only smoke green.

### Phase 4 — Concurrent UX · 3–5 din

| Feature | Kahan |
| --- | --- |
| `useDeferredValue` | `JobsBody` search, `inventory/locate`, `messages` search, clients list |
| `useTransition` | reports date-range / filter change |
| `useOptimistic` | payment add, job status toggle, stocktake rows |

**Acceptance:** typing latency < 16 ms/frame; rollback on error ke baad `invalidateQueries`.

### Phase 5 — Decomposition · 1–2 hafte

Target: koi file > 800 lines na ho.

1. `JobsBody` 3,028 → table / filters / modals / hooks (RSC-seed behaviour intact)
2. `clients/[id]/view` 2,655 → tabs
3. `SalaryPageInner` 2,168
4. `backup` 2,112 · `suppliers/[id]` 2,096 · `RootClient` 1,950 · `jobs/[id]/view` 1,902
5. `messages` 12 `useEffect` → 2–3

### Phase 6 — Forms (separate track, T3 decision ke baad) · ongoing

2/49 files RHF par. Har naye PR me 1–2 form convert karo (`zodResolver` + shared schema).
Zod routes: 8/92 → har naye PR me 2–3 (strangler pattern, T2 doc).

### Phase 7 — Memo pruning · 2–3 din

`useCallback`/`useMemo` hatao jahan sirf render optimization ke liye hain.
**Rakho** jahan effect deps ya third-party (recharts) ko stable identity chahiye.
RHF `watch()` avoid karo — `useWatch` (compiler-safe).

---

## 5. Upgrades — current state (v1.70.0)

| Item | Current | Action |
| --- | --- | --- |
| next | 16.4.2 | current |
| react / react-dom | 19.3.1 | current |
| @tanstack/react-query | 5.104.4 | current |
| react-query-devtools | 5.104.5 | **installed (dev-only)** |
| babel-plugin-react-compiler | 1.0.0 | ON — keep |
| zod | 4.6.7 (override: `@serwist/*` nested) | single instance — **override mat hatao** |
| react-hook-form / resolvers | 7.91.0 / 5.9.2 | pilot done — rollout Phase 6 |
| @playwright/test | 1.64.1 | CI enabled |
| vitest / coverage-v8 | 5.0.5 / 5.0.5 | current |
| typescript | 5.9.3 | **TS7 blocked** (eslint peer) |
| @supabase/supabase-js | 2.118.0 | current |
| @google/genai | 2.31.0 | current |
| @capacitor/* | 8.5.3 | APK rebuilt (versionCode 3) |
| sentry | 10.x | 11 major skip |

Optional: `@tanstack/query-eslint-plugin` (query key misuse pakadta hai).

---

## 6. Guardrails (har PR)

```
npm run typecheck
npm run lint              # 0 errors / 0 warnings
npm test                  # vitest 429+
npm run build             # next build
npm run e2e               # Playwright (creds ho to; warna clean skip)
npm run perf:check        # CDP budget
npm run schema:drift      # DB untouched confirm
```

Rules:
- **e2e writes sirf staging par.** `E2E_ALLOW_WRITES=1` live DB par kabhi nahi.
- Ek PR = ek domain. Behaviour change na ho to `refactor(...)`.
- Data-fetch convention: read `useQuery`, write `useMutation` + `onSuccess` invalidation.
- Zod schema ek hi jagah (`src/lib/validation/schemas/*`) — client/server dono import karein.

---

## 7. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Mutation hook me galat key → stale data | High | key factory ek jagah; e2e smoke |
| e2e live DB me write | High | staging project + `E2E_ALLOW_WRITES=0` |
| RSC conversion me hydration mismatch | Medium | chhote client islands; dates server par avoid |
| `useOptimistic` galat rollback | Medium | idempotent writes only; error par invalidate |
| RHF + React Compiler conflict | Medium | `useWatch`, `watch()` avoid |
| Decomposition regression | Medium | page-by-page + e2e |
| Bundle bloat from new deps | Low | T0 baseline + per-phase `analyze` diff |
| Season freeze | Medium | Phase 0/4/7 season-safe; 1–3,5 off-season |

---

## 8. Tracking checklist

- [ ] 0.3 conventions doc
- [ ] 0.4 CI bundle budget
- [ ] 0.5 ESLint data-fetch guard
- [ ] 0.6 perf baseline
- [ ] 1.1 27-Oct ke 5 sites → `useMutation`
- [ ] 1.2 clients writes
- [ ] 1.3 jobs writes
- [ ] 1.4 inventory/suppliers writes
- [ ] 1.5 expenses/salary/attendance writes
- [ ] 1.6 misc (backup/services/client-loans)
- [ ] 2.1–2.6 read migration (82 → 0, exclusions chhod ke)
- [ ] 3 RSC reports (28 → server)
- [ ] 4 concurrent UX
- [ ] 5 decomposition (51 → 0 files > 800 lines)
- [ ] 6 forms rollout (2 → 49)
- [ ] 7 memo pruning

**Success:** `useMutation > 0` (213 sites standardized), manual-fetch 82 → exclusions-only,
reports server 3 → 28+, no file > 800 lines, per-route client KB baseline se na bade.

---

## Appendix A — Measurement scripts

Present in `C:\Windows\Temp\opencode\` (repo `scripts/` me shift karna optional):
- `react-audit2.mjs` — structure, hooks, client/server split
- `react-plan-data.mjs` — manual-fetch files + `.from()` density
- `write-sites.mjs` — write sites (`insert/update/delete/upsert/rpc`)
- `plan-deps.mjs` — dependency versions

## Appendix B — Conventions (proposed)

```ts
// read
const q = useQuery(clientDetailOptions(clientId));

// write
const save = useMutation({
  mutationFn: savePayment,
  onSuccess: async () => {
    await qc.invalidateQueries({ queryKey: clientDetailKey(clientId), refetchType: "all" });
  },
});

// form
const form = useForm<ClientInput>({ resolver: zodResolver(clientFormSchema) });
const values = useWatch({ control: form.control }); // watch() nahi — compiler-safe
```

**Rule:** fetch-only `useEffect` = `useQuery`; navigation wala write = `useMutation` +
target key invalidation (`refetchType: "all"` jab target unmounted ho).
