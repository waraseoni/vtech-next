# SSR Boot-Gate — feasibility plan (authenticated pages client-rendered)

> **Status: INVESTIGATION ONLY (18 Oct 2026) — koi code change nahi.**
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
