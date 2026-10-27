# New Technology Adoption — Sprint Execution Plan (per-commit)

> Status: **PROPOSED** — suggestions review ke baad, ye doc sirf implementation breakdown hai.
> Created: 26 Oct 2026
> Rule 1: koi DB write se pehle `docs/DATA_MIGRATION_NOTES.md` padho.
> Rule 2: migration apply + prod deploy = **USER ACTION** (SQL Editor se).
> Rule 3: push **sirf sprint ke end me** (user rule — mid-way push nahi).
> Estimate: **~12–16 h (T0–T2 + T5)**, T3–T4 ~4–6 din alag.
> Dependency order: T0 → T1 → T2 → T3 → T4; T5 independent (kabhi bhi).

---

## 0. Baseline — aaj ki state (26 Oct 2026)

| Area | Status | Gap |
|---|---|---|
| API routes | 91 | validation = `body as {...}` type-assertion → **runtime check ZERO** |
| Forms | 51 form/onSubmit wale files | react-hook-form = **0**, validation har jagah alag |
| Data fetching | 158 files me `useEffect`, 81 me `fetch()` | TanStack Query abhi **45 files** |
| Tests | 388 unit (vitest) | **e2e = 0** (Playwright nahi) |
| State mgmt | 1 `createContext` | koi zustand/redux zaroorat nahi ✅ |
| Realtime | Supabase realtime live (messages, presence, notifications) | ✅ koi list-polling loop nahi (`perf_db_fetch_audit_oct14_2026.md`) |

Dependency audit ka latest: `npm audit` **5 vulns (0 critical)** — dep hygiene round ho chuka hai.

---

## Guard rails (har sprint ke baad)

- Gates: `tsc --noEmit` + `eslint` (touched files) + `vitest run` + `next build` (jab route/config naya ho).
- Commits: conventional format, ek sprint = **ek commit**.
- Line endings: `src/**` = LF; `docs/**` = CRLF.
- Test suite = **388/388 green**, naye test add hote jaate hain — kisi sprint me 388 se kam = regression.
- Sirf local commit; push end me user se poochh ke.
- **Single source of truth rule:** Zod schema ek hi jagah (`src/lib/validation/schemas/*`) — API route aur form dono wahi import karein (client/server drift nahi).

---

## T0 — Baseline + devtools (~1 h)

Commit: `chore(perf): bundle analyze baseline + react-query devtools`

- [x] `npm run analyze` → top-10 bundle offenders is doc me record karo (neeche "Bundle baseline" section)
- [x] `npm i -D @tanstack/react-query-devtools` → `src/app/Providers.tsx` me conditional render (sirf `NODE_ENV === "development"`, prod bundle me dead-code)
- [x] Gates (typecheck + eslint touched files)
- **Files:** `src/app/Providers.tsx`, `package.json`
- **Why:** aage har dependency ka size justification isi baseline se hoga (over-engineering rokne ke liye).

---

## T1 — Zod foundations (~2–3 h)

Commit: `feat(validation): zod schema layer + parseBody helper`

- [x] `npm i zod` (direct dep `^4.6.7`; **note:** top-level override direct dep se `EOVERRIDE` deta hai → `@serwist/*` ke andar nested override)
- [x] `src/lib/validation/index.ts`
  - `parseBody(schema, request)` → `{ ok: true, data } | NextResponse.json({ error, issues }, { status: 400 })`
  - `issues` shape: `{ fieldName: ["msg", ...] }` (Zod 4 `flattenError().fieldErrors`, refine errors `_form` me)
  - extra `parseData(schema, value)` — forms/server actions ke liye
- [x] `src/lib/validation/schemas/` — 4 schemas: `location.ts`, `bomTemplate.ts`, `geofencePermit.ts`, `messaging.ts`
- [x] Error messages **Hindi style me** (repo ka convention)
- [x] Unit tests `src/lib/validation/index.test.ts` (12 tests: valid/invalid/missing-field/blank/wrong-type/extra-key/invalid-JSON/refine/coerce)
- [x] Gates (typecheck + lint + 12/12 tests)
- **Files (new):** `src/lib/validation/**`, `src/lib/validation/index.test.ts`
- **Risk: low** — abhi koi route nahi juda, rollback = file delete.

---

## T2 — Zod pilot on 8 routes (~3–4 h)

Commit: `feat(validation): zod pilots on 8 high-traffic API routes`

Routes (bina naye business logic ke, sirf parse swap):

- [x] `api/locations/assign/route.ts` (existing `body as {...}` + `!product_id` check hatao)
- [x] `api/locations/manage/route.ts` (POST/PUT/PATCH + `Entity` type ab schema se derived)
- [x] `api/locations/route.ts` (POST/PUT/PATCH)
- [x] `api/admin/geofence-permit/route.ts` (POST + DELETE query coerce)
- [x] `api/bom-templates/route.ts` (local `normalizeItems`/`sanitize*` helpers delete)
- [x] `api/bom-templates/[id]/route.ts` (PUT partial + refine)
- [x] `api/messages/push/route.ts` (geo-exempt write)
- [x] `api/media/delete/route.ts` (geo-exempt write)

**Result:** 8 routes me `as {...}` type-assertion khatam; 6 manual validators/helpers delete;
400/400 tests (12 naye), lint clean, `next build` pass.

Per-route checklist:

1. `const body = await request.json()` → `parseBody(Schema, request)`
2. Type assertion (`as {...}`) hatao → `z.infer` wali type use karo
3. Manual `if (!x) return 400` checks hatao (schema already kar raha hai)
4. **Error shape backwards-compatible**: purana `{ error: string }` key rehne do, `issues` naya key add ho
5. Manual smoke: wahi flow ek baar UI se chala ke 400 message check karo
6. Geofence/write-gate tests green (naya route un `NextResponse` pass-through contract se juda hai)

- **Gates:** typecheck + lint + 388 tests + `next build` + manual smoke
- **Rollback:** revert commit (helper alag hai, coupling zero)
- **Next (ongoing):** har naye PR me 2–3 routes convert — baaki 83 strangler pattern se.

---

## T3 — React Hook Form pilot (2 forms, 2–3 din)

Commits:
1. `feat(forms): react-hook-form + zod resolver — clients/new pilot`
2. `feat(forms): jobs/new wizard on react-hook-form`

### Sprint T3.1 — `clients/new` (chhota, safe)

- [x] `npm i react-hook-form @hookform/resolvers` (`^5` — **note:** v6 ka `effect@4` peerOptional conflict deta hai, isliye `@hookform/resolvers@5.9.2`)
- [x] `src/app/clients/new/page.tsx` → `useForm` + `zodResolver(clientFormSchema)` (`src/lib/validation/schemas/client.ts`)
- [x] `Controller` se contact input wrap (digit-only filter) — **visual/layout change zero**
- [x] Inline field errors (`formState.errors`) — purana `validate()` + `submitted` state delete
- [x] Submit payload diff-check: same keys/transform (`parseFloat || 0`, trim→null) — identical
- [x] Gates: typecheck + lint **0 warnings** + 408/408 tests + `next build` pass
- [ ] **USER ACTION:** local manual smoke (new client save + edit load + duplicate contact/email warning)
- **Note:** RHF ka `watch()` subscription React Compiler ko skip karwa deta hai (lint warning) — isliye duplicate checks field-level `onChange` (Controller/register) se trigger kiye.

### Sprint T3.2 — `jobs/new` (1517 lines, alag commit)

- [x] 2-step wizard + Quick Save intact: `goNext` = `trigger(["client_id","fault","mechanic_id"])`, save dono jagah `handleSubmit` se
- [x] Existing field-level validation → `jobFormSchema` (`src/lib/validation/schemas/job.ts`)
  - client / fault / mechanic required (wahi 3 checks jo `validateStep1` + `handleSave` karte the)
  - `item` yahan bhi optional — purana code use validate nahi karta tha (label par `*` hai, follow-up backlog)
  - `legacy_uniq_id` form field me — edit mode ka purana `uniq_id` fallback safe
- [x] Client / Mechanic / JobSpotPicker → `useWatch` + `setValue` (RHF `watch()` nahi; React Compiler safe)
- [x] "Add New Client" modal → alag `quickClientFormSchema` (address optional; contact 10-digit + email rule client form se shared); manual 3 toasts delete
- [x] Service/Product rows local state hi rakhe — unka tempId + duplicate-guard flow schema me daalne ka fayda nahi tha
- [x] Submit payload diff-check: same keys, same transforms (`parseInt(mechanic_id)`, location/legacy fallback, `|| ""` remark) — identical
- [x] Gates: typecheck + lint **0 problems** + 417/417 tests + `next build` pass
- [ ] **USER ACTION:** local manual smoke (naya job step-1 → Quick Save, step-2 → Create, edit load/save, custom spare)
- [ ] **USER ACTION:** Profiler rerender count before/after (browser-only step; code side pending nahi)
- **Note:** `handleSubmit(...)` ko render me direct call karna React Compiler lint deta hai (`react-hooks/refs`) — wrapper `saveJob()` event handler me call karta hai.

- **Files:** `src/app/clients/new/page.tsx`, `src/app/jobs/new/page.tsx`, `src/lib/validation/schemas/{client,job}.ts`
- **Risk: medium (form regression)** → isliye **sirf 2 forms**. Rollback = revert commit, UI layout same hai.
- **Rule:** poora 51-form rollout **is plan ke bahar backlog me** — T3 pilot ke result dekh ke decide hoga.

---

## T4 — Playwright e2e (3–5 din)

Commit: `test(e2e): playwright setup + 5 critical-path smoke tests`

### Setup

- [x] `npm i -D @playwright/test@1.64.1` + `npx playwright install chromium`
- [x] `playwright.config.ts` — `webServer: { command: "npm run dev -- -p <PORT>" }`, `trace: "on-first-retry"`, chromium-only project; `@next/env` se `.env.local` load (Next jaisa hi)
- [x] npm scripts: `"e2e": "playwright test"`, `"e2e:ui": "playwright test --ui"`, `"e2e:install": "playwright install chromium"`
- [x] `.gitignore` += `test-results/`, `playwright-report/`, `blob-report/`, `e2e/.auth/` (saved session = credentials)
- [x] `eslint.config.mjs` `globalIgnores` me wahi artifacts — specs/config khud lint hote hain

### 5 smoke tests (`e2e/smoke/`)

- [x] `login.spec.ts` — password login → dashboard (clean storageState)
- [x] `job-create.spec.ts` — `/jobs/new` → Quick Save → job view (T3/RHF safety net)
- [x] `direct-sale.spec.ts` — Create Sale → RPC `save_direct_sale` success (atomic fix ka guard); oversell confirm click handle
- [x] `inventory.spec.ts` — list load + search empty-state + out-of-stock filter pill
- [x] `attendance.spec.ts` — hub load + daily↔monthly tab switch + admin day cell → modal

### Auth + fixtures (sabse bada setup point)

- [x] `e2e/auth.setup.ts` — storage-state reuse (login once, share across specs)
- [x] `e2e/seed.sql` **skip** — pehle-option picking (`e2e/utils.ts`) + data-dependent `test.skip` se kaam chal raha hai; seed.sql staging-only hai aur is sprint me zaroorat nahi padi
- [x] **Geofence trap:** documented + enforced — docs/specs admin/permit user maangte hain; non-admin par specs skip
- [x] Env: `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` + `E2E_ADMIN_EMAIL/PASSWORD` + optional `E2E_ALLOW_WRITES=1` → `.env.example` me documented, CI me secrets
- [x] **Write-gate:** job-create/direct-sale real rows banati hain → `E2E_ALLOW_WRITES=1` ke bina skip (prod DB safe)
- [x] `hasAdminCreds` na ho to setup + authed specs skip (conditional `storageState` inline empty state) — `npm run e2e` bina creds ke bhi clean rehta hai

### CI

- [x] `.github/workflows/e2e.yml` — `workflow_dispatch` + `push: branches: [main]` (manual run green hone ke baad enable), missing-secret fail-fast, failure par report artifact
- [x] **Push trigger enabled (27 Oct):** manual run `40553212498` green → `push` trigger on. Push par `E2E_ALLOW_WRITES` hamesha khaali (read-only specs), writes sirf manual dispatch par
- [x] **Secret/verify bug fix:** verify step me `env:` block missing tha → step secrets ko khaali dekh kar hamesha fail hota tha (`23d397b`)

### Verification

- [x] `npx playwright test` (creds nahi) → **7 skipped cleanly** — koi red nahi
- [x] Real run (creds + `E2E_ALLOW_WRITES=0`) → **4 passed, 3 skipped** (2 write specs + attendance day-cell ka master-data guard)
- [x] Gates: `typecheck` 0 errors + `eslint` 0 problems + prettier (`e2e/**` + `playwright.config.ts`) clean
- [x] **USER ACTION:** `workflow_dispatch` run green (run `40553212498`, secrets set) → `push: branches: [main]` enable ho gaya

### Real-run debugging (26–27 Oct) — jo sirf actual run me mila

- [x] **`baseURL` = `localhost`, `127.0.0.1` NAHI.** `npm run dev` `-H 0.0.0.0` par chalta hai; Next dev `127.0.0.1` origin ke dev resources (chunks/HMR) block kar deta hai → client JS load nahi hota → React hydrate nahi hota → login form **native submit** ho kar `/login?` par reload. (Symptom: `waitForURL("**/dashboard")` timeout, page snapshot me `reactKeys: []`.) Fix `playwright.config.ts` me comment ke saath documented.
- [x] **Setup me route warm-up:** `auth.setup.ts` login ke baad `/dashboard`, `/inventory`, `/attendance`, `/attendance?view=report`, `/direct-sales/new`, `/jobs/new` visit karta hai — dev-mode compile parallel specs ke 30s timeout par fail hone se bachta hai.
- [x] **`SearchableSelect` clear-row bug:** menu ke top ki optional clear row bhi `div.cursor-pointer` hai → `options.first()` galti se selection **clear** kar deta tha. Naya selector: `div.cursor-pointer:has(> div.min-w-0)` (`e2e/utils.ts`).
- [x] **Options async aate hain:** instant `count()` race karta tha (job form par 537 clients + mechanics 4-5 sequential queries me aate hain) → bounded wait + per-call `timeout` (job/direct-sale me `MASTER_TIMEOUT = 90_000`).
- [x] **Direct sale me `Add` click zaroori:** product select sirf dropdown bharta hai; `Add` ke bina `items.length === 0` → Create Sale disabled. Saath hi **in-stock product prefer** kiya — out-of-stock par oversell confirm (double submit) load me flaky tha.
- [x] **Hydration se pehle ka click kho jaata hai:** attendance tab switch pehli baar URL change nahi karta tha → `clickUntilUrl()` helper (idempotent button click retry, `toPass`).
- [x] **Global `timeout: 180_000`:** dev compile + parallel load me 60s default kam padta tha.

> ⚠️ **Live DB warning (26 Oct):** `.env.local` **live/production** Supabase project par point karta hai, aur us waqt `E2E_ALLOW_WRITES=1` set tha — write specs ne live DB me 46 test rows bana diye. Poora audit + cleanup SQL: **`docs/DB_CHANGES_E2E_AUDIT_2026-10-26.md`**. Aage: writes sirf **staging project** par, ya `E2E_ALLOW_WRITES` off.

- **Files (new):** `playwright.config.ts`, `e2e/{auth.setup.ts,utils.ts,smoke/*.spec.ts}`, `.github/workflows/e2e.yml`, `package.json`, `docs/DB_CHANGES_E2E_AUDIT_2026-10-26.md` (live-DB audit)
- **Risk: low** — existing app code touch hi nahi. Setup time sabse zyada.

---

## T5 — Migrations / cleanup (1–2 din, independent)

### T5.1 — AI SDK

Commit: `chore(ai): migrate @google/generative-ai → @google/genai`

- [x] `npm i @google/genai@2.31.0` + `npm rm @google/generative-ai@0.24.1`
- [x] `src/lib/gemini.ts` — `GoogleGenAI` client + `ai.chats.create({ model, history, config })`
  - tools ab `parametersJsonSchema` se jaate hain (plain JSON schema) — `gemini-tools.ts` ka shape waisa hi, Groq path untouched
  - `response.functionCalls` (getter) → `call.name` optional hai, isliye guard; `functionResponse` wahi shape
  - `response.text` ab `string | undefined` — fallback message add kiya
- [x] Verify: `api/chat` route compile + build pass (`/ai` page code untouched)
- [x] Gates + build + **live Gemini call** (function calling round-trip: `get_business_summary` → tool response → final text)
- [ ] **USER ACTION:** `/ai` page par ek real chat (model selector se Gemini) — UI se confirm

### T5.2 — Barcode

Commit: `refactor(scan): native BarcodeDetector with html5-qrcode fallback`

- [x] `src/lib/barcode-scanner.ts` — `BarcodeDetector` capability detect + `getSupportedFormats()` se format list filter (`qr_code`, `code_128`, `code_39`, `ean_13`, `ean_8`, `upc_a`, `upc_e`)
- [x] Native path: `getUserMedia` + apna `<video>` + 120ms detect loop (ek waqt me ek detect call)
- [x] `BarcodeCameraScanner.tsx` + `QuickScanModal.tsx` → native par native, warna `html5-qrcode` (fallback **mandatory** — WebView support variable)
- [x] html5-qrcode **hataya nahi** — dependency waisi hi, sirf jab native na ho tab lazy import hota hai (native path par ~250KB chunk load hi nahi hota)
- [x] **Platform reality check (28 Oct, headed Chrome + Edge + Playwright chromium par probe):** native `BarcodeDetector` **sirf Android Chrome/WebView** me milta hai. **Windows desktop Chrome/Edge me `BarcodeDetector` hai hi nahi** (isliye wahan fallback hi chalta hai), aur iOS Safari/Firefox me bhi nahi. Yani ~250KB bachat ka faayda mobile-Android par hai — desktop par nahi. Fallback isliye mandatory hai, "optional" nahi.
- [x] `cameraSupport.ts` fix: fallback engine ka raw `Error` (`Error getting userMedia, error = NotAllowedError: ...`) bhi ab friendly message me map hota hai (pehle user ko kachcha technical text dikhta tha) + 11 unit tests
- [x] First-scan par scanner khud band, phir `onScan` — dono components ka purana behaviour same
- [ ] **USER ACTION:** Device matrix — Android Chrome/WebView + desktop (loop wale test), inventory scan + box-labels dono

### T5.3 — Dead weight sweep

- [x] `npm outdated` re-run → in-range patches pending nahi (T0 ke `npm update` me ho gaya); jo bacha hai wo major hi hai (TS7/Vitest5/Sentry11/@hookform-resolvers6) = T6/skip list
- [x] `docs/plans/codebase_audit_sep06_2026.md` ke `autoprefixer` checkbox done mark (dep T0 me remove ho chuki hai)

---

## T6 — Backlog (is plan ke bahar, decide T3/T4 ke baad)

- [ ] **TanStack Query completion** — 158 `useEffect` files me se top-20 hot routes (`npm run analyze` + `perf_db_fetch_audit_oct14_2026.md` se list)
- [ ] **TypeScript 5.9 → 7.0** — **BLOCKED:** `typescript-eslint@8.72` ka peer `typescript >=4.8.4 <6.1.0`; TS7 install hi peer conflict deta hai. typescript-eslint ka TS7 support aane par retry (tab trial branch + full suite).
- [x] **Vitest 4 → 5** — vitest 5.0.5 + coverage-v8 5.0.5, 417/417 tests + coverage report green (code change zero)
- [x] ~~**Supabase Realtime for lists** — 5 `setInterval` polling files~~ **stale**: oct14 audit ke hisaab se list-polling loops nahi bache; jo `setInterval` hain wo clock/heartbeat/license check hain (unhe realtime me badalne ka koi fayda nahi)
- [ ] **MSW** — tabhi zaroori jab component tests fast chahiye (abhi Playwright cover kar lega)
- [ ] **RHF rollout baaki 49 forms** — T3.1/T3.2 ka result dekh ke

---

## ❌ Skip list (deliberately NAHI add karna)

| Tech | Wajah |
|---|---|
| zustand / redux / jotai | Global state ka problem hi nahi (1 context hai) |
| TanStack Table | Apna `DataTable` already works, migration cost > benefit |
| GraphQL | Supabase REST + RPC sufficient hai |
| Radix / headless UI | UI kit bana hua hai = bada rewrite, zero user value |
| Sentry 11 major | Critical already 10.76.2 me fix ho chuka hai |
| npm `uuid` override | Fix = `@capacitor/cli` breaking downgrade; dev-only build tool |

---

## Definition of Done (poore plan ke liye)

- [ ] `npm run analyze` baseline doc me recorded
- [ ] 8 routes Zod-validated, `body as {...}` un 8 me khatam
- [ ] 2 forms RHF par, payload diff = zero
- [ ] 5 e2e smoke locally green + CI me manual-run se pass
- [ ] `@google/genai` migrated, AI page live verify
- [ ] Barcode native-first (fallback intact), device matrix signed off
- [ ] Gates: typecheck ✅ lint 0 problems ✅ 388+ tests ✅ build ✅ schema:drift ✅

## Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| RHF me form regression | High (data entry) | Sirf 2 pilots + payload diff-check + e2e smoke |
| E2E false fail (geofence write-gate) | Medium | Admin/permit test user |
| Playwright env secrets CI me nahi | Medium | `workflow_dispatch` pehle, phir enable |
| Zod 400 purana client tode | Medium | `error` key backwards-compatible rakho |
| Native barcode WebView me absent | Medium | html5-qrcode fallback mandatory |
| Naye deps se bundle bloat | Low | T0 baseline + bundle size check per phase |

## USER ACTION (code ke bahar)

- [ ] T4: writes sirf **staging** Supabase par (`E2E_ALLOW_WRITES=1` wahan); live DB par `E2E_ALLOW_WRITES=0`
- [ ] T4: CI secrets set (Supabase URL/keys — staging project)
- [ ] T5.2: real device par barcode matrix sign-off
- [ ] Plan end: push ka final approval

---

## Bundle baseline (T0 — 26 Oct 2026)

`next experimental-analyze --output` → `.next/diagnostics/analyze/data/route-summaries.json`
(per-route client JS+CSS, compressed):

| Route | Client (KB) | Total (KB) |
|---|---|---|
| `/reports/cash-flow` | 762.8 | 2229.3 |
| `/dashboard` | 648.5 | 2267.4 |
| `/reports/monthly-profit` | 633.4 | 2105.4 |
| `/inventory` | 629.8 | 2382.0 |
| `/clients` | 627.3 | 2214.7 |
| `/products` | 587.5 | 2189.9 |
| `/inventory/locate` | 575.2 | 2183.7 |
| `/inventory/[id]` | 500.9 | 2018.5 |
| `/jobs/[id]/view` | 491.5 | 1997.2 |
| `/clients/[id]/view` | 490.5 | 1994.7 |

**Rule:** is table se ~50 KB+ badhne wale koi bhi naye dep ko justify karna hoga.
**Baseline dates:** 26 Oct 2026 (v1.68.3 + dep hygiene round).

Analyze run me mila: `withSentryConfig` import deprecation (v11 me break hoga) — T0 me
`@sentry/nextjs/config` se import kar diya.

