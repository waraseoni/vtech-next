# SSR Boot-Gate — feasibility plan (authenticated pages client-rendered)

> **Status: Option A IMPLEMENTED (18 Oct 2026) — see "Option A — result" below.**
> Yeh discovery Fix #1 (`/jobs` mobile device-branch) verify karte waqt mili:
> `/jobs` (aur baaki authenticated pages) ka **content SSR HTML me nahi** aata.

## Finding (verified)

Prod `next start` par authenticated GET ka saved HTML (mobile + desktop UA):

- `<body>` me sirf **"V-TECH Secure Boot" splash** + RSC flight script.
- Page ka DOM **client par** banta hai (hydration ke baad).
- SSR HTML me **seed data** milta hai (flight payload: `transactions`,
  `mechanics`, `filterInputs`, job doc numbers) — par content **markup nahi**.

| Route      | `<body>` SSR output        | content markup                    | seed payload        |
| ---------- | -------------------------- | --------------------------------- | ------------------- |
| /jobs      | boot splash                | ✗ (0 `<table`/`<tr`, no heading)  | ✓                   |
| /mechanics | boot splash                | ✗                                 | ✓ (4 mechanics)     |
| /clients   | boot splash                | ✗                                 | ✓                   |

Mobile UA vs desktop UA `/jobs` HTML = 242200 vs 242201 bytes — farq sirf **1
byte** (`initialIsMobile` payload flag); content dono me nahi. Isliye
`useSearchParams` ka de-opt is app me **irrelevant** hai (content waise bhi SSR
nahi hota).

## Root cause

`src/app/layout.tsx:123`:

```tsx
<RootClient>{children}</RootClient>
```

`src/app/RootClient.tsx` (client component), `:1321`:

```tsx
if (!authReady) {
  return (<splash>… V-TECH Secure Boot …</splash>);
}
```

`authReady` `useAppBoot.ts:45` se aata hai — `useState(false)`; mount effect me
`supabase.auth.getSession()` (localStorage fast-path) ke baad `true`. SSR me
always `false` → `children` server par render hi nahi hote, sirf splash.

## Why it is like this (design intent)

Boot gate asli problems ke liye hai (inline comments dekho):

- **Hydration mismatch** se bachna — `isMobile` `null` (SSR↔client fix), theme
  localStorage se; server ko nahi pata.
- Stale SW cache / chunk-load hang par **boot-guard auto-reload** (6s watchdog +
  8s global guard).
- Auth **revoked/expired** par turant `/login`; license gate; idle-logout;
  presence; push subscription — sab client-side.

Yani gate "jaldi SSR" ke bajaye **fail-safe boot** ke liye hai.

## Options

### Option A — Client render cost kam karo (safe, incremental)

- `/jobs` tall card list **virtualization** + `content-visibility:auto` + CSS
  `contain` (bade list par).
- `JobsBody` mega-component ka desktop-XOR-mobile split (ek hi tree render).
- SSR content nahi milega, par remaining mobile TBT / Style & Layout girega.
- Risk: **low**. Effort: medium. **Recommended first.**

### Option B — RootClient ko SSR-friendly banao (bada, risky)

- Shell + page server par render; boot gate ko "post-hydration enhancement" banao
  (splash sirf tab tak jab tak session validate na ho; content uske peeche).
- Chahta hai: server par auth (cookie session — `requireStaffWithRole` already
  chalta hai) + `isMobile`/theme jaise client-only bits ko SSR-safe banana.
- Bade refactors alag rakho (project rule) — apne sprint me, feature-freeze ke
  baad.
- Risk: **high** (auth / service-worker / license entanglement; blast radius
  poora app). Effort: large (multi-session). Sirf tab jab A ke baad bhi FCP/LCP
  chahiye.

### Option C — Kuch nahi (document-only)

- Current RSC seeding + Fix #1 accept karo; boot gate jaise hai waise.

## Recommendation

1. Pehle **Option A** (measure-first; koi architectural risk nahi).
2. **Option B** tab uthao jab real-device field data bole ki authenticated
   first-paint content chahiye — aur usse alag, dedicated sprint me.

## Verification (jab A/B karo)

- SSR content check (HTML me page heading/rows exact-string count) —
  expect A: unchanged (0), B: >0.
- Lighthouse mobile @4× A/B (TBT, Style & Layout) — `perf_baseline.md` method.
- Gates: tsc · eslint (touched) · vitest · `next build` · dev smoke.

## Option A — result (18 Oct 2026)

Implemented (`4a30c0d`): `/jobs` mobile card list **progressive mount** —
`CARD_CHUNK = 6`, scroll par `IntersectionObserver` sentinel chunk-by-chunk
badhata hai (max = page size). `content-visibility`/`contain` try kiya tha par
**koi measurable win nahi** (nodes DOM me rehte hain) → revert.

Mobile@4× (prod `next start`, CDP `Performance.getMetrics`): DOM 2798 → ~985
(initial, cards=6), Style-recalc ~4100 → ~1500ms, TaskDuration ~5510 → ~2800ms.
Lighthouse mobile @4×: **perf 56 → 68, TBT 2413 → 766ms (−68%), Style & Layout
4729 → 1793ms (−62%)**; LCP/FCP ~flat.

Verified (CDP): scroll par cards 6→12→18→24→25, card-pager intact. Implementation
note: observer **callback-ref** se attach karo — plain `useEffect` sentinel ka node
skeleton→cards transition par replace hone se detached ho jata hai aur phir kabhi
fire nahi karta.

Bache hue (optional) levers: per-card markup/icon count aur app CSS rule count
(356KB / 4266 rules). **Option B** (RootClient SSR-friendly) abhi bhi alag,
dedicated, feature-freeze-ke-baad sprint me — tab jab field data kahe.

### Option A — extra: mobile drawer nav lazy mount (18 Oct 2026)

`RootClient` mobile drawer ka `SidebarNav` + `TeamOnline` sirf **pehli open** par
mount hote hain (pehle har mobile load par, drawer band hone par bhi). Mobile DOM
985 → 878; drawer band 133 → 32 elements; saath me 2 DB queries/load
(`profiles`+`user_presence`) tab tak nahi chalti jab tak drawer na khule.
Container (`<aside>`) mounted rehta hai → slide animation intact (`aiOpenedOnce`
pattern). Commit `a001ebc`.

## Implementation plan (staged) — dedicated sprint

Best practice: staged, flag-guarded, revertible. Har stage apne PR me; har stage
ke baad gates (tsc/eslint/prettier/vitest/build) + multi-route smoke (public +
protected) + Lighthouse mobile@4x (least of 3). Ek stage break kare to usi PR me
revert — aage nahi badhna.

### Stage 0 — Guard rails

- Perf budget (fail CI/manual): `/jobs` mobile@4x **TBT < 900ms**, **LCP < 4.2s**
  (aaj baseline: TBT ~766ms, LCP ~3.8s).
- SSR-content assertion: authenticated GET ke HTML me page-specific markup
  (e.g. `job_id` / table rows) — abhi 0; Stage 1 ke baad >0.
- Feature flag `NEXT_PUBLIC_SSR_CONTENT` (default **off**) — instant rollback bina
  code change.

### Stage 1 — Content SSR, splash as overlay (content-only)

- `RootClient` ke `!authReady` branch: splash ko `fixed inset-0 z-[100]` overlay
  banao, aur `children` ko `<ViewOnlyProvider role={undefined}><main class="flex-1
  p-3 sm:p-5 theme-body">` wrapper me render karo (authed branch jaisa structure).
- Fayda: content SSR HTML me → **FCP/LCP** better (paint boot-fetch se pehle).
- Risk: splash→shell transition me `children` **remount** ho sakta hai → page body
  dobara render → **TBT badh sakta hai** (isi liye flag + TBT measure). Agar TBT
  bade to Stage 1 reject.
- Chhoti baatein: SSR par `isMobile=null` + `profile=null` → shell nav khaali,
  desktop margin shift. Content-only stage me shell render nahi hota, isliye mvmt
  Stage 2 tak.

### Stage 2 — Shell ko SSR-safe banao

- Sidebar/header/theme/density ko server par bhi render karo (server session se
  role) — `useAppBoot` ka auth server + client dono se hydrate ho.
- Layout shift + hydration mismatch risk: `suppressHydrationWarning` + server role;
  `matchMedia`-based `isMobile` ko CSS-only responsive par shift karo.

### Stage 3 — Boot gate ko post-hydration enhancement banao

- Splash sirf tab jab tak session validate na ho; watchdog/license/idle/presence
  client-side enhancement rahe. Saare protected routes ka full app-wide verification.

> **Ek saath sab nahi.** Har stage independent + flag-guarded. Agar Stage 1 bhi TBT
> na de, to Option A par ruk jao (RSC seed already data-waterfall hata chuka hai).
