# V-Tech Frontend — Complete Revamp Plan (Architecture + UI/UX + Mobile + PC)

Created: 2026-09-22 · Status: **SPRINT 1 IN PROGRESS (2026-09-23)** — items 1, 3, 4, 5 ✅; item 2 (semantic tokens + `!important` delete) pending. Uncommitted (user directive: no commit/push).
Goal: poore project ko maintainable architecture + best-in-class UI/UX + mobile-first
aur PC-browser-friendly banane ka ek complete roadmap. Har item free hai (no paid service).

**How to read:** har item me `IMPACT` = ROI, `EFFORT` = din (rough), `PRIORITY` = P0 (abhi) /
P1 (agla sprint) / P2 (baad me). Phase order hi execution order hai.

---

## 🆓 HARD CONSTRAINT — sirf Free / Open-Source

**Rule:** project me koi bhi paid service nahi chalegi. Har nayi dependency, API,
hosting ya tool sirf tab allow hai jab uska **free tier permanently usable** ho ya
**fully open-source (self-host)** ho. Paid upgrade " zarurat padegi" wali soch
**banned** hai.

### Current stack — free/OSS audit (22 Sep 2026)

| Service/Dep | License/Tier | Verdict |
|---|---|---|
| Next.js, React, Tailwind, Lucide, date-fns, recharts, sonner, Vitest | MIT/ISC OSS | ✅ Free forever |
| Supabase (DB + Auth + Storage + Realtime) | Free tier (500MB DB, 1GB storage, 50k MAU) | ✅ Free tier — apne scale par enough; **kabhi paid plan na lena** |
| Serwist (PWA) / Capacitor (Android) | MIT OSS | ✅ Free |
| Sentry (error tracking) | Free tier (5k errors/mo) | ✅ Free tier; zarurat na ho to OSS self-host option bhi (GlotPress/sentry self-host — optional) |
| Groq AI (chat/copilot) | **Free tier** (settings me "Groq (Free)" labeled) | ✅ Free — default AI provider |
| Gemini AI | Free tier (rate-limited) | ✅ Free fallback — optional, default Groq |
| web-push (VAPID) | Self-generated keys, OSS lib | ✅ Free |
| GitHub (repo + Actions CI) | Free for public/private (limits ok) | ✅ Free |
| Deploy (Vercel/Netlify/own VPS) | Hobby free tier / self-host | ✅ Free tier only |
| Lighthouse, NVDA, browser DevTools | Free/OSS | ✅ Free |
| Print/PDF, Barcode (html5-qrcode), QR | Browser native / MIT | ✅ Free |

### Plan ke andar koi bhi paid nahi

Is document ka **koi bhi item** naya paid service introduce **nahi** karta:
- Design system, UI kit, DataTable, shortcuts, skeletons → **apna code (OSS)**
- Toast (sonner), charts (recharts), PWA (Serwist), Android (Capacitor) →
  **already installed OSS**
- Offline, notifications, clipboard, dvh/safe-area → **browser native APIs**
- Image compression → canvas (apna `lib/media.ts`, messenger me already)
- Virtualization (P2) → `content-visibility` CSS (native) ya `@tanstack/virtual`
  (MIT) — dono free
- Drag-drop (P2) → HTML5 native DnD ya `@dnd-kit/core` (MIT)
- PDF → browser Print-to-PDF (koi pdf-lib/paid API nahi)

**Banned examples (na kabhi add karein):** Stripe/Razorpay paid gateway (agar
billing aaye to OSS/offline flow), paid WhatsApp API (Cloud API paid — free wa.me
path already hai), OpenAI paid API, paid form builders (Typeform), paid analytics
(Segment/Amplitude — free alternative: Plausible OSS / Umami self-host / ya none),
paid CMS, paid monitoring beyond free tiers.

**Enforcement:** nayi dependency PR me `npm install` se pehle license + free-tier
check. package.json me sirf MIT/ISC/Apache/MPL/BSD + free-tier SaaS allowed.

---

## 🛡️ PROTECTED ROUTES (suraksha guarantee — har phase me valid)

| Route | Files | Rule |
|---|---|---|
| `/jobs/old` | `src/app/jobs/old/page.tsx` | **KEEP FOREVER** — purane manually-chosen IDs ki entry (`jobs/new` auto-ID se purani id sync todta). Kabhi delete/refactor-remove nahi. |
| `/jobs/[id]/old` | `src/app/jobs/[id]/old/page.tsx` | **KEEP FOREVER** — old entry edit mode. `/jobs/:id/old-edit` 404 fix isi par. |
| Links | `jobs/page.tsx` 4 jagah (`/jobs/old`, `/jobs/:txn.id/old`) | **Intentional — remove nahi karna.** `RootClient` me bhi links rakhte jana. |

**Allowed on protected routes:** toast/alert unify, semantic tokens, StatusBadge,
mobile CSS — sirf **upgrades**. **Banned:** delete, redirect, route merge,
"cleanup" se hataana.

Ye rule `codebase_audit_sep06_2026.md` Section C (PERMANENT SAFE LIST) se
mirror hai — dono jagah same guarantee. Koi bhi future plan inhe chhue to
pehle user confirmation mandatory.

---

## 0. Current State (22 Sep 2026 explore — read-only audit)

| Aspect | Status |
|---|---|
| Stack | Next.js 16.3.3 App Router, React 19, Tailwind v4, Supabase, Serwist PWA, Capacitor Android |
| Routes | **118 `page.tsx`** + ~90 API routes |
| Tests | Vitest + Testing Library setup (`npm test`) |
| Quality scripts | `typecheck`, `lint`, `format`, `analyze` available |
| Releases | semantic-release → v1.25.1 (auto changelog + GitHub) |
| Shell | `RootClient.tsx` (2210L) — collapsible sidebar, Ctrl+K search, idle logout, license gate, dark/light |
| Mobile infra | FAB menus, SwipeNavigation, PullToRefresh, bottom-sheet selects, barcode scanner, Capacitor |
| Theming | 3-way theme (system/dark/light) BUT light mode = hundreds of `!important` overrides |
| Feedback | sonner mounted but unused; ~25 hand-rolled toasts; **~97 `window.alert()`** |
| Tables | 100+ raw `<table>`; table + mobile-cards har page khud likhta hai |
| God pages | jobs 3100L, RootClient 2210L, dashboard 1752L, client-view 2500L, PO 1505L |
| Perf baseline | ~1.0–1.2MB JS/route (shared floor), ~90% CSR, dashboard 35 serial fetches (see `frontend_performance_plan.md`) |

---

# PART A — Architecture Plan (4 Phases)

## Phase 1 — Foundation: Design System (Week 1) ⭐ sabse pehle

### 1a. Semantic tokens only — `!important` whack-a-mole khatam

**Problem:** pages me hardcoded dark hex (`bg-[#161b27]`, `border-[#21293d]`,
`text-slate-400`) aur light mode ke liye `globals.css` (3175L) me escaped-selector
`!important` overrides. Nayi page add karte hi light mode todta hai.

**Fix:**
```css
/* ❌ ab: bg-[#161b27] + .bg-\[\#161b27\].rounded-2xl... !important */
/* ✅ naya: */
.card   { background: var(--app-card-bg); border: 1px solid var(--app-border); }
.muted  { color: var(--app-muted); }
```
- Codemod/regex se hardcoded hex → token classes me migrate (top 20 patterns pehle)
- `globals.css` se ~1500L `!important` light-mode remap blocks delete
- Tailwind v4 me tokens `@theme` me map karo taaki `bg-panel`, `text-muted` jaise
  utility classes mil jayein

**IMPACT:** theme stability forever · **EFFORT:** 3 (one-time) · **PRIORITY:** P0

### 1b. `src/components/ui/` kit banao

```
src/components/ui/
├── DataTable.tsx      # desktop table + mobile cards EK component, slot-based
├── StatusBadge.tsx    # job status 0–5 single source of truth
├── Card.tsx / StatCard.tsx
├── EmptyState.tsx     # illustration + CTA (ab 50 jagah alag copy)
├── ConfirmDialog.tsx  # window.confirm/alert replacement
├── PageHeader.tsx     # (src/app/components/ui se yahan move + barrel export)
└── index.ts           # barrel exports
```

- `DataTable` props: `columns`, `rows`, `mobileCard(row)`, `sortBy`, `pagination`,
  `onRowClick` — desktop `hidden md:block` table + mobile card list internally
- 100 pages slowly migrate (pilot: suppliers, direct-sales, payments)

**IMPACT:** 2x markup drift khatam, consistency · **EFFORT:** 4 · **PRIORITY:** P0

### 1c. Toast unify — `useToast()` → sonner

- sonner `<Toaster>` already mounted (`RootClient.tsx`) — **call sites badalne hain bas**
- **97 `window.alert()`** → `toast.error()` / `toast.success()` (regex + manual sweep)
- ~25 hand-rolled `const [toast,setToast]` banners → `useToast()`
- Error = persistent until dismiss, success = auto-dismiss bottom

**IMPACT:** sabse zyada user-visible pain · **EFFORT:** 2 · **PRIORITY:** P0

---

## Phase 2 — Shared Logic Layer (Week 1–2)

```ts
src/lib/
├── jobStatus.ts     # STATUS_MAP/colors ek jagah (6+ files se consolidate)
├── waLink.ts        # wa.me builder + 91-prefix (PO double-91 bug risk khatam)
├── useAdminGuard.ts # copy-pasted alert("Sirf Admin…") → hook
├── money.ts         # ₹ formatting (har page me repeated)
├── date.ts          # dual-era display rule (DATA_MIGRATION_NOTES compliant)
├── useToast.ts      # sonner wrapper + deprecation path for hand-rolled toasts
└── useTableState.ts # sort/page/filter persist (localStorage) for DataTable
```

**IMPACT:** bug magnet khatam · **EFFORT:** 2 · **PRIORITY:** P0

---

## Phase 3 — Route Cleanup (Week 2)

### 🛡️ PROTECTED — kabhi delete mat karna (suraksha guarantee)

| Route | Reason | Rule |
|---|---|---|
| **`/jobs/old`** (`src/app/jobs/old/page.tsx`) | **Purane data ki entry** — legacy/old records add karne ke liye zaroori | **KEEP FOREVER — kabhi delete/redirect nahi.** `jobs/page.tsx` se 4 intentional links hain (`/jobs/old`, `/jobs/:txn.id/old`) |
| **`/jobs/[id]/old`** (`src/app/jobs/[id]/old/page.tsx`) | Old entry edit mode — `/jobs/old` ka hi component `params.id` se mounted | **KEEP FOREVER — kabhi delete/redirect nahi.** `/jobs/:id/old-edit` 404 fix is route par aata hai |

- Ye dono files aapas me same component hain (`params?.id` drives mode) — `codebase_audit_sep06_2026.md` me pehle se **KEEP FOREVER** marked hain, `nextjs_updates_plan.md` CLN-2 me deletion evaluated & rejected.
- **Sirf toast/system upgrades allowed** (alert→toast, tokens, StatusBadge) — **structure/entry-flow delete nahi.**
- `jobs/page.tsx` ke purane-links (4 jagah) bhi **intentional — remove nahi karna.**

### Cleanup items (sirf ye — protected routes ke alawa)

| Action | Routes |
|---|---|
| Merge | `mechanics/[id]/ledger` + `mechanics/ledger/[id]` → ek |
| Merge | `salary` + `mechanics/salary` → ek module |
| Kill duplicate | `Lightbox.tsx` → `ImageLightbox` (suppliers pages migrate) |
| Delete | legacy `Navbar.tsx` (inline styles) → `(public)/layout` |

- Redirects `next.config.ts` `redirects()` me, SEO/old-links safe — **par protected routes par kabhi redirect nahi**
- Dead code delete → bundle + cognitive load dono kam — **protected routes exceptions**

**IMPACT:** confusion khatam (protected intact) · **EFFORT:** 1 · **PRIORITY:** P1

---

## Phase 4 — Page Modularization (Week 3–4, chalte-chalte)

- **`jobs/page.tsx` (3100L)** → `hooks/useJobList.ts` + `components/jobs/`:
  `{JobTable, JobFilters, JobActions, BulkBar, StatusChangeModal}`
- **`RootClient.tsx` (2210L)** → `nav.config.ts` (sidebar as pure data) +
  `useUniversalSearch()` + `useAppShell()` hooks
- **G3 server-component migration continue** (already done: clients, mechanics,
  expenses, payments, salary): next = suppliers, direct-sales, inventory list,
  reports hub
- Har segment standard `loading.tsx` (**skeleton**, spinner nahi) — ab sirf 8 segments
- Route-level `error.tsx` (global-error alag hai) — crash recovery UI

**IMPACT:** compile speed, merge-conflict freedom · **EFFORT:** 8 (phased) · **PRIORITY:** P1

---

# PART B — Best UI/UX Improvements

## B1. Dashboard-first IA

- **"Today's Board" kanban strip**: Pending → Repairing → Ready → Delivered
  (status-change click se hi move; drag optional P2)
- Hero row: Jobs in shop · Today's done · Cash-in · Dues follow-up
- Charts secondary (fold/accordion) — ab cards + charts pehle hain
- AI alerts widget prominent (already exists)

## B2. List pages standard skeleton

```
PageHeader + Search + StatusFilter + DateRange
─────────────────────────────────────
DataTable (server-paginated, sortable)
─────────────────────────────────────
[+] New  |  Export  |  Bulk-select
```
- `EmptyState` illustration + primary CTA (ab generic text)
- Saved filter presets (localStorage via `useTableState`)

## B3. Forms (job / client / sale)

- `/jobs/new` **2-step wizard**: (1) Client+Item → (2) Fault+Mechanic+Parts
  — mobile-friendly, step indicator, back preserve
- **Validation pattern standard** (bulk page me jo kiya): red field + focus-first-error
  + inline hint — sab forms me same
- Autosave draft (localStorage) for long forms

## B4. Feedback micro-UX

- **Optimistic updates**: job status change turant UI me, API fail par rollback
- Skeleton loaders (fixed-height shimmer) instead of spinner — perceived speed
- ConfirmDialog for destructive actions (delete job/sale/PO)

## B5. WhatsApp flow

- Message **preview modal before send** (PO me already hai — broadcasts, due
  reminders, status updates me bhi)
- Template variable highlighting (`{{client}}` etc.) in editor

## B6. Reports hub

- 30+ reports ab card grid — add **search + favorites (pinned) + recent**
- Common report shell (date range + client/mech filter + export) as layout —
  har report me same chrome

**IMPACT (Part B total):** daily-driver satisfaction · **EFFORT:** 6 (phased) · **PRIORITY:** P1

---

# PART C — Mobile-Friendliness Improvements (Phone/PWA/Capacitor)

*Target: Android phone primary device (Capacitor app + PWA). iOS Safari secondary.*

## C1. Viewport & input fundamentals (P0, 1 din)

| Item | Fix |
|---|---|
| iOS zoom on input focus | global CSS: `input, select, textarea { font-size: max(16px, 1em) }` (<16px par Safari zoom karta hai) |
| `100vh` bug (mobile URL bar) | `100dvh`/`100svh` use karo layout heights me |
| Safe-area insets (notch/home bar) | `env(safe-area-inset-*)` padding — FAB, bottom bars, drawers me |
| Keyboard covering inputs | `visualViewport` listener / `scrollIntoView` on focus; forms me sticky submit |
| FAB vs keyboard overlap | keyboard open par FAB hide (`SoftInputMode` Capacitor + web check) |

## C2. Touch ergonomics (P0–P1)

- **Min tap target 44×44px** — icon-only buttons (table row actions!) audit + fix
- **8px min gap** between adjacent tap targets (mis-tap rokna)
- Hover-only interactions remove — desktop `hover:` states ko mobile par
  tap-to-reveal se replace (row ke action icons ab hidden hover se dikhte hain?)
- Sliders/steppers for qty (job parts) instead of tiny +/- (± hit area badhao)

## C3. Navigation (P1)

- **Bottom tab bar** for top 4–5: Dashboard · Jobs · Sales · Clients · More
  (sidebar drawer waise bhi rahega; tab bar thumb-zone me — one-hand use)
  - *Option:* sirf mobile (`md:hidden`), collapse on scroll
- Existing SwipeNavigation + PullToRefresh + back-FAB: ✅ already good — keep
- Breadcrumbs on deep pages (`jobs/[id]/view`) — back ke alawa orientation

## C4. Lists on small screens (P1)

- DataTable mobile cards (Part A) — **infinite scroll** ya "Load more" for
  jobs/clients (ab full list fetch → slow networks par ruk jata hai)
- **Virtualize** big lists (jobs 1000+ rows render) — `content-visibility: auto`
  se shuru, phir proper virtual list agar zaroorat
- Filter → **bottom sheet** pattern (SearchableSelect pehle se karta hai —
  filters/date-range me bhi same)
- Sticky column headers on card scroll nahi chahiye; instead compact sticky
  summary bar (count + active filters)

## C5. Media & camera (P1)

- **All image uploads** par messenger wali compression (`src/lib/media.ts`) —
  job photos, client photos, product images (phone camera = 5–10MB photos)
- `next/image` + blur placeholder everywhere (LCP)
- Camera capture: `capture` attribute + existing BarcodeCameraScanner pattern
  (html5-qrcode already dynamic ✓)

## C6. Network & offline (P1–P2)

- **Serwist PWA** already hai — extend: offline **app shell** + last-viewed
  lists cache (jobs board, clients) with stale-while-revalidate
- `navigator.connection` (Network Information API): slow 2G par images quality
  low, skeleton heavy animations off
- Data-saver: queries me sirf needed columns (`select` specific — dashboard
  35 fetches me bohot wide `*` honge)
- Background sync (P2): offline job draft → queue → sync (see existing
  `offline_local_supabase_sync_plan.md`)

## C7. Mobile feedback & feel (P2)

- **Haptic feedback** (Capacitor Haptics) — status change, save success, QR scan
- Pull-to-refresh already ✓; add **swipe-to-reveal actions** on job cards
  (swipe right = Ready, left = Deliver) — P2
- `prefers-reduced-motion` respect — animations disable
- Skeleton shimmer speed consistent

## C8. Android/Capacitor specifics (P1)

- Splash → Shell: "V-TECH Secure Boot" splash fast rahe (license fetch timeout
  already 6s — consider <1.5s cached path)
- Back button: existing in-app history ✓ — ensure modals/sheets consume back first
- Status bar color sync with theme (`#0a0e17`)
- Share intent (Capacitor Share) — job invoice/label share native sheet

**IMPACT (Part C):** primary device experience · **EFFORT:** 5–6 · **PRIORITY:** P0–P1

---

# PART D — PC / Browser-Friendliness Improvements

*Target: Chrome/Edge desktop (billing desk, admin), Firefox secondary, Safari rare.*

## D1. Keyboard-first power use (P0–P1)

- **Ctrl+K universal search** ✓ already — add **command palette actions**
  (search + "New Job", "Export", "Go to Reports" — kamo-style)
- **Gmail-style g-shortcuts**: `g d` dashboard, `g j` jobs, `g c` clients,
  `g s` sales, `?` shortcut help overlay
- **Table keyboard nav**: ↑/↓ row, Enter open, Space select (bulk), Esc clear
- Focus-visible rings global (ab browser default inconsistency)
- **Skip-to-content** link (a11y + keyboard)

## D2. Desktop layout充分利用 (P1)

- **Wide-screen master-detail split**: list (left) + preview/detail (right) on
  `2xl` — jobs list + job preview, clients list + quick view (ab poori page nav)
- Dashboard grid: `xl` par 4-col, `2xl` par 6-col stat cards
- **Table density toggle** (comfortable/compact) — billing desk 100-row view
- Column show/hide + reorder + resize (DataTable Phase A me) — persist localStorage

## D3. Power-user interactions (P1–P2)

- **Right-click context menu** on list rows: Open, Status change, Print, WhatsApp,
  Delete (admin) — fewer mouse trips
- **Drag & drop**: file upload zones (drop image anywhere on form), row reorder
  (requirement list priority) — P2
- Multi-select with Shift+click range (bulk bar exists — enhance)
- **Tooltips on hover** (desktop) vs tap-expand (mobile) — lucide + title attr
  abhi minimal

## D4. Print & export (P0 for billing — already strong, polish)

- ~30 `/api/print-*` routes ✓ — **A4 print CSS audit**: invoice, ledger, labels
  me page-break rules, header/footer, grayscale-safe
- Browser **Print to PDF** works via same routes — add "Download PDF" button
  affordance (prints dialog) — no lib needed
- Excel/CSV export ✓ (`exportUtils`) — standardize button placement in DataTable

## D5. Multi-tab / session robustness (P1)

- **bfcache fix**: `pageshow` event par state revalidate (wapas aane par purana
  data + stale token issues — idle logout se related bug potential)
- Multi-tab: `BroadcastChannel`/`storage` event se session logout sync (ek tab
  logout → doosra tab bhi)
- `router.refresh()` already in topbar ✓

## D6. Cross-browser & resilience (P1)

- Test matrix: Chrome (primary), Edge, Firefox, Safari latest — `npm run analyze`
  ke saath bundle sanity
- **Error boundary** per segment + Sentry (installed ✓) — crash = friendly page
  + Reload, white-screen nahi
- Window resize: charts (recharts) re-render debounce; sidebar collapse
  breakpoints (`lg` 1024) verify at 1280/1366/1446 laptop widths
- **Zoom accessibility**: 200% browser zoom par layout na toote (rem-based
  type scale — WCAG 1.4.4)

## D7. Desktop notifications (P2)

- Job status change → **Web Notification** (permission on enable) for admin —
  desk par kaam karte hue alert
- Web-push already exists (`web-push`, `push_subscriptions`) — desktop par
  service worker push → same

## D8. Accessibility (both platforms, P1)

- Color contrast: `slate-400` on dark ≈ 3:1 → `--app-text-2` (4.5:1 target)
- `aria-label` on all icon-only buttons (FAB, row actions, theme toggle)
- Form inputs: associated `<label>` (bulk page pattern ✓ — audit rest)
- `prefers-reduced-motion` + `prefers-contrast` respect
- Screen-reader smoke pass on Dashboard, Jobs, Forms (NVDA/VoiceOver)

**IMPACT (Part D):** desk power-users + a11y compliance · **EFFORT:** 5–6 · **PRIORITY:** P0–P1

---

# PART E — Priority Roadmap

## Sprint 1 (Week 1) — Foundation ⭐

| # | Item | Effort | Status (2026-09-23) |
|---|---|---|---|
| 1 | `useToast` + kill 97 `alert()` | 2 | ✅ `src/lib/toast.ts` (sonner) · 0 UI `alert()` (print-route server templates intentional) · ~25 hand-rolled toasts migrated (0 `setToast` left) · `requireAdmin(userRole, action)` replaced `alert("Sirf Admin...")` · protected `jobs/old` + `jobs/[id]/old` toast-upgraded (kept, never deleted) |
| 2 | Semantic tokens migration + `!important` delete (codemod) | 3 | ✅ **DONE (2026-09-23)** — Codemod 9,288 replacements across 165 files (`bg-[#0d1117]`→`bg-app`, `border-[#21293d]`→`border-app`, `text-slate-400`→`text-muted`, etc.). Dark/light `!important` override blocks (~380 lines) deleted. Remaining 299 `!important` = glass/mobile/select (intentional). `!important` 413→299. `tsc` OK, ESLint 0 errors. |
| 3 | `ui/` kit: StatusBadge + EmptyState + ConfirmDialog + PageHeader move | 2 | ✅ `src/components/ui/{StatusBadge,EmptyState,ConfirmDialog}.ts(x)` + `index.ts` barrel (PageHeader re-export) |
| 4 | Mobile input fundamentals (16px, dvh, safe-area) | 1 | ✅ `globals.css` Sprint 1 block (~L3178+): iOS 16px font floor, `.pb-safe/.pt-safe/.mb-safe`, `.h-dvh-safe`, keyboard-open FAB hide, coarse-pointer active opacity |
| 5 | `lib/jobStatus.ts` + `waLink.ts` + `useAdminGuard` | 1 | ✅ evolved → `src/lib/status-colors.ts` (labels/explanations/badges/`getStatusStyle`) · `src/lib/whatsapp.ts` `waLink` (double-91 safe, +`waLinkText`/`+openWhatsApp`; dupes removed) · `src/lib/requireAdmin.ts` (pure fn; old `useAdminGuard.ts` deleted) |

## Sprint 2 (Week 2) — Core components + nav

| # | Item | Effort |
|---|---|---|
| 6 | `DataTable` (desktop table + mobile cards + sort/page) + pilot on 3 pages | 4 | ✅ **DONE** — `src/components/ui/DataTable.tsx` (generic, sortable, paginated) + pilots: suppliers ✅ (`f6d05d4`), direct-sales ✅ (`a10b487`), payments ✅ (`b336d0c`). |
| 7 | Mobile bottom tab bar (Dashboard/Jobs/Sales/Clients/More) | 2 |
| 8 | Route cleanup (old redirects, ledger/salary merge, Lightbox kill) | 1 | ✅ **Lightbox kill done** — Removed `ImageLightbox.tsx` global system + 39 files (44 total). `Lightbox.tsx` recreated simpler version. Old redirects + ledger/salary merge remaining. |
| 9 | Keyboard shortcuts: g-prefix + `?` help + skip-to-content | 1 | ✅ `src/hooks/useKeyboardShortcuts.ts` + `ShortcutHelpOverlay.tsx` + focus-visible CSS + skip-to-content link — committed `eaa898e` |
| 10 | Image compression on ALL uploads (messenger pattern reuse) | 1 | ✅ Already integrated in 8 call sites via `compressImage` (imageCompression.ts) + messenger `uploadMedia` (media.ts) — no new work needed |

## Sprint 3 (Week 3) — UX depth

| # | Item | Effort |
|---|---|---|
| 11 | Dashboard Today's Board (kanban strip) + hero row | 3 |
| 12 | Jobs list split: `useJobList` hook ✅ DONE + component extraction ⏳ FUTURE-BACKLOG (neeche dekho) | 3 |
| 13 | Optimistic status updates + skeleton loaders | 2 |
| 14 | WA message preview modal everywhere | 1 |
| 15 | 2-step wizard `/jobs/new` | 2 |

## Sprint 4 (Week 4) — Performance + polish

| # | Item | Effort |
|---|---|---|
| 16 | RootClient split (nav.config + search hook) | 3 |
| 17 | G3 SSR: suppliers, direct-sales, inventory lists | 4 |
| 18 | Loading skeletons + error.tsx all segments | 2 |
| 19 | Desktop: master-detail wide screen + density toggle | 2 |
| 20 | Offline shell cache (Serwist) + bfcache/multi-tab sync | 3 |

**Carry-forward P2:** swipe actions on cards, drag-drop uploads, desktop
notifications, virtualized lists, context menus, haptics, infinite scroll.

**FUTURE-BACKLOG #12b (Sprint 3 #12 ka bacha hissa — hook DONE `useJobList.ts`):**
jobs `page.tsx` se bade JSX blocks nikalna — table (~300L), mobile cards
(~300L), modals (WA/bulk/move/spot/filter). Fayda: render performance +
parallel kaam + component preview. Risk: ~30 handlers ki prop-drilling, isliye
tab karna jab team badhe ya list slow lage. Behavior contract: aaj jaisa hai
waisa hi rahe (optimistic updates, skeletons, pager, preview).

---

# PART F — Success Metrics

| Metric | Baseline | Target |
|---|---|---|
| `window.alert()` call sites | ~97 | **0** |
| `!important` overrides in globals.css | ~1500L | **~0** (tokens only) |
| Hand-rolled toast copies | ~25 | **0** (sonner only) |
| Pages with inline table markup | ~100 | trending down (DataTable adoption) |
| God pages >2000L | 4 | **1** (RootClient during transition) |
| Duplicate routes | 4 pairs | **0** (protected `jobs/old` + `jobs/[id]/old` EXCEPTION — keep forever, see Phase 3) |
| Protected routes intact | `/jobs/old`, `/jobs/[id]/old` + 4 links in `jobs/page.tsx` | **100% — kabhi delete/redirect/refactor-to-remove nahi** (sirf toast/tokens jaise upgrades allowed) |
| Tap targets <44px (mobile audit) | TBD | **0** |
| Input font <16px (iOS zoom) | TBD | **0** |
| Lighthouse a11y (dashboard/jobs) | TBD | **≥90** |
| Tests | 101 green | keep green + grow with DataTable |

---

## Related plans (overlap dekh lena execution se pehle)

- `frontend_performance_plan.md` — bundle floor, CSR→SSR, fetch batching (Part A Phase 4 se juda)
- `improvements_phased_plan.md` — security/modules/WhatsApp free-path priorities
- `offline_local_supabase_sync_plan.md` — C6 offline ke saath align
- `multilanguage_plan.md` — copy language (Hinglish/English) decide karne se pehle
- `docs/DATA_MIGRATION_NOTES.md` — dual-era date/activity_logs rules (reports me already follow hota hai)

---

## Decision log (execution se pehle confirm)

1. **Bottom tab bar** — chahiye ya drawer sufficient? (C3, mobile)
2. **Master-detail split** — sirf `2xl` ya `xl` se? (D2)
3. **Kanban on dashboard** — status columns clickable-only, drag P2 rakhein? (B1)
4. **DataTable migration order** — kaunse 3 pilot pages? (suppliers, direct-sales, payments suggest)
5. **Codemod for tokens** — pehle top-20 class patterns manually ya script likhein?
