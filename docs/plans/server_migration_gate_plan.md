# Server Components Migration — Gate Plan (Decision Record)

*Status: DECIDED — abhi NOT start. Trigger-based. Ye file decision + trigger conditions ka permanent record hai.*
*Kept: 28 Aug 2026. Author: opencode session (perf module 1–3 ke baad).*

---

## 1. Background / Context

Is session me 2 low-risk perf wins already banked (sab verified + pushed):

- **M1** `f821fb4` — eng-tooling (Vitest 101 tests, CI/CD, Sentry, Prettier)
- **M2** `fd968c3` — recharts defer (4 pages via `next/dynamic`, −349 lines net)
- **M3** `f313a71` — auth `getUser()` dedup (36 files, +122/−74; RootClient authoritative call + page auth rides cache)

**Architecture fact (is session ka central finding):**
- **107 pages**, quicksky **101 `"use client"`** hain → practically pura app client-side data-fetching par chalta hai (`useEffect` → fetch → spinner → render, 2 round-trips/page).
- Sirf 6–7 public marketing pages true server-rendered hain.
- **`RootClient.tsx:1660`** every protected page ko full-screen **"V-TECH Secure Boot"** loader se gate karta hai, jo server HTML ke baad bhi client auth check (`getUser()` + `profiles`) ke peeche sab blank karta hai.

**Isliye:** server-component migration ka win abhi **structurally locked** hai jab tak RootClient gate server-shell-aware nahi hota. Migration = badi + risky (101 pages, billing/inventory system, multi-tenant RLS). Bina deliberate scope ke start nahi karna.

---

## 2. THE DECISION

> **Server-component migration ABHI start nahi karna.**
>
> Eat jab ek **dedicated window** mile jo neeche ke teeno gate-conditions ko SAFE-yes kar de. Tab **RootClient gate fix ke saath** ek **pilot page** se shuru, phir phase-by-phase.

Reasoning (short):
1. **ROI locked by RootClient gate** — server-fetched content tab tak chhupa rehta hai.
2. **Koi functional pain nahi** — app stable, build clean, 101 tests green.
3. **Regression surface >= 101 pages** — bina free-QA-window + baseline metrics ke backfire risk (silent RLS / hydration bug = business loss).

---

## 3. Trigger Conditions — teeno SAFE-yes honge tabhi start

Migration shuru karne ke liye **ALL 3 must be YES**:

| # | Condition | Abhi (status) | Safe-yes hone ka matlab |
|---|-----------|---------------|--------------------------|
| **G1** | RootClient gate server-shell-aware | ❌ NO | `useEffect`-based auth fetch abhi chat client `loading` state par splash gate karta hai. Safe-yes = RootClient already server-rendered content ko display karta hai (ya ek standalone `RootClient` gate-split fix pehle hi merge ho gaya hai). |
| **G2** | Baseline metrics captured | ✅ **YES** | Bundle + Web-Vitals (Lighthouse) baseline recorded in `docs/plans/perf_baseline.md`. Live: FCP ~1.1s, LCP ~5.6–10.2s, TBT ~1–2.7s across key pages (throttled baseline). |
| **G3** | Dedicated off-peak window | ❌ NO | Koi freeze/refactor sprint scheduled nahi. Safe-yes = ek window hai jisme production churn low hai + rollback easy. |

---

## 4. Kaise teeno ko SAFE-yes karein — actionable plan

### Step A — Baseline metrics capture (abhi FREE me karo; G2 → YES)
Yeh abhi karna hai, koi risk nahi, migration ke liye green-light data banata hai.

1. `npx next build` ke baad `@next/bundle-analyzer` script add karo (`npm run analyze`) — per-page bundle size.
2. Key pages (dashboard, clients, jobs, cash-flow, monthly-profit) par **DevTools Lighthouse** ya Web Vitals extension se record:
   - `FCP`, `LCP`, `TTI`, `CLS`, `First Contentful` (logged-in app state).
3. Ek **manual network waterfall** note karo: SSR HTML → JS hydrate → useEffect fetch → spinner → data render (current 2-round-trip latency record).
4. Save sabko `docs/plans/server_migration_plan_baseline.md` (ya ek `docs/perf_baseline.md`) — pehli table in sab numbers se update.

> Iske baad G2 = YES permanently (baseline exists).

### Step B — RootClient gate analysis + standalone gate-split fix (G1 → YES)
Yeh migration ka **pre-requisite** hai. RootClient me pura change mat karo pehle — pehle **sirf gate ko server-shell-friendly** banana.

1. **Analyze** (already partly done is session): RootClient abhi `if (loading) return <SecureBoot/>;` (line 1660) — ye setTimeout/retry/idle-eviction logic ke saath juda hai. Iska ek **isolated profile** banao ki gate child render ko kaise throttles.
2. **Proposal (checkbox plan, verify each):**
   - [ ] Splash gate ko `loading` se `authReady` (mountain pehle server-fetched content ko show kare) me reframe karo.
   - [ ] RootClient ko split: auth-gate hook + theme hook + drawer + license-gate alag modules (ye pehle se `completed_tasks.md` P-R3 me listed hai — ise G1 ke liye prioritize karo).
   - [ ] Boot-guard/watchdog/idle-eviction logic **preserve** (isse kabhi mat hatao).
3. Regression hard checks: hydration mismatch zero, boot-guard no-infinite-reload, idle eviction works, stale-SW path intact.

> Iske baad G1 = YES (pehle hi one-standalone-fix merge ho chuki).

### Step C — Dedicated window plan (G3 → YES)
1. Kisi upcoming **feature-freeze / low-churn period** ko identify karo (release ke baad ka gap, peak-season ke bahar).
2. Window ko **1 sprint (2–3 hafta)** rakho — isse aage extend mat karo.
3. Rollback easy rakhne ke liye: har page ek **independent commit** par, har ek after full regression.

---

## 5. Pilot page selection

Pilot = **`clients/page.tsx`** (1778 lines, sabse bada, highest traffic, RLS-critical). Kyun:
- Sabse zyada lines → iska split sabse zyada ROI demonstrate karega.
- Client list me `login_allowed`, balance, due-logic → **RLS verification ka strong case**.
- Ek hi page — regression scope bounded, rollback trivial (1 commit revert).

**Pilot kedan ke steps:**
1. Cookie-based **`createServerClient`** page-data layer banao (`src/lib/server-supabase.ts` jaise — `proxy.ts`/`api-auth.ts` ka pattern reuse).
2. **Service-role NEVER** page-read ke liye — sirf cookie+RLS client. Har query RLS-verified.
3. Page ko split karo: `page.tsx` (server layout: fetch + pass props) + `ClientTable.tsx`/`ClientBody.tsx` (client interactive).
4. Measure: baseline (Step A) vs after-pilot on clients page — **agar TTI/FCP ka substantiate gain hai** → remaining pages phase-by-phase; **nahi to** project ko aise hi rehne do.

---

## 6. Scope matrix (kya bahar rakho)

| In-scope (bahar nahi) | Out-of-scope (banned) |
|---|---|
| `createServerClient` cookie page layer | `service_role`/`getAdminSupabase` se page-level reads (RLS bypass = kahenge) |
| `RootClient` gate-split (pre-requisite) | `src/proxy.ts` auth middleware modify |
| `clients` pilot + phased rollout | RootClient boot-guard/idle-eviction logic removal |
| Baseline metrics infra | Har page pada-pada (sabse critical pages first) |
| RLS re-verification har page par | Multi-tenant access control break |

---

## 7. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hydration mismatch (client/server split) | High | Medium | `suppressHydrationWarning` delgado nahi; past pattern follow; test har page |
| RLS bypass via wrong client | Low | **Critical** | Cookie+RLS client only; per-query SELECT verified vs anon/authenticated |
| Banner/performance regression during window | Medium | Medium | Pilot-bound, 1-commit rollback, baseline compare |
| RootClient gate fix breaks boot reliability | Medium | **High** | Gate-split standalone; watchdog/eviction tests preserved |

---

## 8. Entry checklist (publish se pehle poora):

- [x] G2 baseline captured (bundle + Lighthouse Web Vitals) — `docs/plans/perf_baseline.md`
- [x] G2 Web-Vitals (FCP/LCP/TTI/CLS) live capture on 6 key pages
- [ ] G1 RootClient gate-split fix merged + regression green
- [ ] G3 off-peak window confirmed + QA available
- [ ] Cookie `createServerClient` layer built + RLS-verified
- [ ] Pilot page (`clients`) split complete, typecheck/lint/tests/build green
- [ ] Pilot vs baseline measured — substantiate gain confirm kiye

> **Jab tak upar ke sab `[x]` nahi, migration shuru nahi.**
