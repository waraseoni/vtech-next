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
| Realtime | Supabase realtime live (messages) | polling wale 5 files baaki |

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

- [ ] `npm i -D @playwright/test` + `npx playwright install chromium`
- [ ] `playwright.config.ts` — `webServer: { command: "npm run dev", port: 3000 }`, `trace: "on-first-retry"`, CI me chromium-only project
- [ ] npm scripts: `"e2e": "playwright test"`, `"e2e:ui": "playwright test --ui"`
- [ ] `.gitignore` += `test-results/`, `playwright-report/`
- [ ] `.gitignore`/`eslint ignore` me `playwright-report` + `test-results` add

### 5 smoke tests (`e2e/smoke/`)

- [ ] `login.spec.ts` — password login → dashboard loads
- [ ] `job-create.spec.ts` — `/jobs/new` → save → redirect + list me dikhe (T3 ke baad = RHF safety net)
- [ ] `direct-sale.spec.ts` — save → RPC `save_direct_sale` success (pichhle round ka atomic fix)
- [ ] `inventory.spec.ts` — list load + filter/search
- [ ] `attendance.spec.ts` — page load + modal open

### Auth + fixtures (sabse bada setup point)

- [ ] `e2e/auth.setup.ts` — storage-state reuse (login once, share across specs)
- [ ] `e2e/seed.sql` — minimal test data (1 client, 1 product) → **staging/dev project par**, kabhi prod par nahi
- [ ] **Geofence trap:** staff user bahar ho to write-gate block karega (`viewOnly`/`writeGuard`) → test user **admin/permit wala** ho, warna 2-4 spec false-fail honge
- [ ] Env: `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` + app port → `.env.test` / CI secrets (repo me `ci.yml` ka fail-fast pattern already hai)

### CI

- [ ] `.github/workflows/e2e.yml` — `workflow_dispatch` + push par main; Playwright cache; artifact upload on failure
- [ ] Pehle **manual run** (`workflow_dispatch`) se green karwa ke hi push-trigger enable karo

- **Files (new):** `playwright.config.ts`, `e2e/**`, `.github/workflows/e2e.yml`, `package.json`
- **Risk: low** — existing code touch hi nahi. Setup time sabse zyada.

---

## T5 — Migrations / cleanup (1–2 din, independent)

### T5.1 — AI SDK

Commit: `chore(ai): migrate @google/generative-ai → @google/genai`

- [ ] `npm i @google/genai` + `npm rm @google/generative-ai`
- [ ] `src/lib/gemini.ts` — `GoogleGenerativeAI` → `GoogleGenAI` client, function-calling/response-schema API naya
- [ ] Verify: `/ai` page + `api/chat` route (groq path untouched)
- [ ] Gates + build + live 1 chat call

### T5.2 — Barcode

Commit: `refactor(scan): native BarcodeDetector with html5-qrcode fallback`

- [ ] `src/lib/scanner.ts` — `"BarcodeDetector" in window` capability detect + format list (`code128`, `qr`, `ean13`...)
- [ ] `BarcodeCameraScanner.tsx` + `QuickScanModal.tsx` → native par native, warna `html5-qrcode` (fallback **mandatory** — WebView support variable)
- [ ] Device matrix: Android Chrome/WebView + desktop (loop wale test) — inventory scan + box-labels
- [ ] html5-qrcode **mat hatao** jab tak device matrix green na ho (wo unmaintained hai par fallback kaam karta hai)

### T5.3 — Dead weight sweep

- [ ] `npm outdated` re-run → jo in-range patches aaye wo `chore(deps)` commit me
- [ ] `docs/plans/codebase_audit_sep06_2026.md` ke pending checkbox (autoprefixer) mark done

---

## T6 — Backlog (is plan ke bahar, decide T3/T4 ke baad)

- [ ] **TanStack Query completion** — 158 `useEffect` files me se top-20 hot routes (`npm run analyze` + `perf_db_fetch_audit_oct14_2026.md` se list)
- [ ] **TypeScript 5.9 → 7.0** — trial branch, `tsc --noEmit` 5-10x faster (456 files ke liye). Full suite green ho tabhi merge.
- [ ] **Vitest 4 → 5** — T4 (e2e) ke baad, taaki regression pakda ja sake
- [ ] **Supabase Realtime for lists** — 5 `setInterval` polling files
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

- [ ] T4: staging/dev Supabase par `e2e/seed.sql` apply
- [ ] T4: CI secrets set (Supabase URL/keys)
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

