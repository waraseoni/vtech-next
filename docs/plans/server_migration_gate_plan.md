# Server Components Migration — Gate Plan (Decision Record)

*Status: DECIDED — complete migration abhi NOT start. G1 gate-split DONE (2026-09-15), pilot (`clients`) DONE + measured (LCP −48%, TTI −8%, 28 Aug). G3 **DEFERRED (season started 2026-09-15)** — peak me freeze, post-season window milte hi execute. Ye file decision + trigger conditions ka permanent record hai.*
*Kept: 28 Aug 2026. Author: opencode session (perf module 1–3 ke baad).*
*Updated: 15 Sep 2026 (G1 + cookie layer + pilot complete — is session).*

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
| **G1** | RootClient gate server-shell-aware | ✅ **YES** | Safe-yes achieved (2026-09-15): standalone gate-split merged — splash gate `loading` → `authReady` reframe (positive semantics), theme logic `useAppTheme` hook me nikal li (RootClient/useAppBoot se), boot-guard/watchdog/idle eviction preserved. Regression: tsc clean, eslint clean, 103/103 vitest green. |
| **G2** | Baseline metrics captured | ✅ **YES** | Bundle + Web-Vitals (Lighthouse) baseline recorded in `docs/plans/perf_baseline.md`. Live: FCP ~1.1s, LCP ~5.6–10.2s, TBT ~1–2.7s across key pages (throttled baseline). |
| **G3** | Dedicated off-peak window | ⏳ **DEFERRED** | Season start (2026-09-15): work load high, koi calm period available nahi → **freeze** during peak. Wide migration + I6 Phase-2 dono isi window par wait karte hain. Post-season re-evaluate (window milte hi execute). |

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

### Step B — RootClient gate analysis + standalone gate-split fix (G1 → YES) ✅ DONE 2026-09-15
Yeh migration ka **pre-requisite** hai. RootClient me pura change mat karo pehle — pehle **sirf gate ko server-shell-friendly** banana.

1. **Analyze**: RootClient abhi `if (loading) return <SecureBoot/>;` — ye setTimeout/retry/idle-eviction logic ke saath juda hai. Boot state hook (`useAppBoot`) me already aleag tha.
2. **Done (ise G1 ke liye prioritize kiya):**
   - [x] Splash gate ko `loading` se `authReady` (mountain pehle server-fetched content ko show kare) me reframe karo. → `useAppBoot.ts` state invert: `authReady=false` start, boot complete par `true`. Boot-guard watchdog bhi reverse (jab tak not-ready, active).
   - [x] RootClient ko split: auth-gate hook + theme hook + drawer + license-gate alag modules → theme ab `useAppTheme.ts` me (isolated hook, `useAppBoot` se compose). Drawer/license-gate boot-logic ke saath coupled hain — apne module me tabhi, jab migration window me.
   - [x] Boot-guard/watchdog/idle-eviction logic **preserve** (isse kabhi mat hatao) — hataya nahi, verified.
3. Regression hard checks: hydration mismatch zero, boot-guard no-infinite-reload, idle eviction works, stale-SW path intact → `npx tsc --noEmit` clean, eslint clean, `npx vitest run` 103/103 green, `npm run build` green (2026-09-15 verify).

> Iske baad G1 = YES — 2026-09-15 confirmed.

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

**Pilot kedan ke steps — ✅ DONE (2026-09-15, isise pehle ek session me):**
1. [x] Cookie-based **`createServerClient`** page-data layer banao → **exists**: `src/lib/api-auth.ts` `getServerSupabase()` (@supabase/ssr, cookie+RLS) + `src/lib/server-clients.ts` `fetchClientsPageData` (authHelper + role filtering). `src/proxy.ts` untouched.
2. [x] **Service-role NEVER** page-read ke liye — sirf cookie+RLS client (`getServerSupabase`). Page data queries RLS/role double-checked (admin vs staff).
3. [x] Page split: `src/app/clients/page.tsx` = **server component** (`fetchClientsPageData` + props pass) → `<ClientsBody>` (client interactive). 

> Pilot split live + **measured** — verdict CLEAR-YES: `perf_baseline.md` Sessions 2–5 (28 Aug) me `/clients` LCP 10.13s→5.2–5.9s (−48%), TTI −8%; /mechanics, /expenses, /payments same cookie+RLS pattern, sab SSR-data-first-paint. Gain substantiated hai → sirf G3 window baaki.

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
- [x] G1 RootClient gate-split fix merged + regression green — 2026-09-15 (authReady reframe + useAppTheme split; tsc/eslint/vitest 103/build green)
- [ ] G3 off-peak window confirmed + QA available  ← **abhi kala hi trigger**
- [x] Cookie `createServerClient` layer built + RLS-verified — `getServerSupabase`/`server-clients.ts` (already in use)
- [x] Pilot page (`clients`) split complete, typecheck/lint/tests/build green — server `page.tsx` + `ClientsBody` live
- [x] Pilot vs baseline measured — substantiate gain confirm — **verdict CLEAR-YES** (perf_baseline.md Sessions 2–5, 28 Aug): `/clients` **LCP 10.13s → 5.2–5.9s (−42–48%), TTI 10.40s → 9.6s (−8%)**; /mechanics LCP 5.4s/TTI 6.7s (well below /jobs /clients baselines), /expenses, /payments bhi SSR data first-paint me — cookie+RLS pattern proven on 4 pages.

> **Jab tak G3 (off-peak window) confirm nahi, wide migration shuru nahi.** Status 2026-09-15: **season start → G3 DEFERRED, peak me freeze** — wide migration, I6 Phase-2, aur bade refactors abhi NOT. Baaki sab (G1/G2/cookie/pilot/measurement) green hain.
