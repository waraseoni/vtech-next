# समीक्षा (Review): `origin/main` से आगे के 16 commits

**दिनांक:** 27 अक्टूबर 2026
**शाखा:** `main` — `origin/main` से **16 commits आगे**, सभी **local** (push नहीं हुआ)
**कुल असर:** 46 files, +7,115 / −3,471 lines

यह दस्तावेज़ हर commit को तीन नज़र से समझाता है:

1. **क्या बदला** — तकनीकी परिवर्तन
2. **महत्व** — यह क्यों ज़रूरी था (कौन-सी समस्या हल हुई)
3. **उपयोग** — रोज़ के काम में इसका फ़ायदा और कैसे इस्तेमाल होता है

---

## सारांश तालिका

| # | Commit | विषय | मुख्य प्रभाव |
|---:|---|---|---|
| 1 | `034998f` | Dependency hygiene | सुरक्षित patch updates, `zod` override, `autoprefixer` हटाया |
| 2 | `73e6178` | Tech adoption plan | 6 सप्ताह का roadmap (T0–T6) |
| 3 | `7657460` | T0 — bundle baseline + devtools | React Query DevTools (सिर्फ़ dev), bundle नापा गया |
| 4 | `465947c` | T1 — Zod validation layer | `parseBody` + shared schemas + 12 tests |
| 5 | `3fc5961` | T2 — 8 API routes पर Zod | runtime validation, field-wise errors |
| 6 | `7f7074e` | T3.1 — `clients/new` RHF | form validation का पहला pilot |
| 7 | `6389fa5` | T3.2 — `jobs/new` RHF | सबसे बड़ा form (wizard) migrate |
| 8 | `f55ccd6` | T4 — Playwright setup | 5 e2e smoke tests + CI workflow |
| 9 | `33c397f` | T5.1 — `@google/genai` | पुराना AI SDK हटाया, नया SDK |
| 10 | `6091318` | T5.2 — Barcode native | ~250KB bundle बचत + तेज़ scan |
| 11 | `83a1f28` | Offline plan doc | ⚠️ मेरा काम नहीं (जैसा था वैसा रखा) |
| 12 | `236a6c0` | Vitest 4 → 5 | test runner upgrade, coverage-v8 5 |
| 13 | `e3dce5d` | T6 status docs | TS7 blocked, realtime item stale |
| 14 | `7fcb9d2` | e2e real-run fixes | actual run में मिले 7 bugs के fixes |
| 15 | `e0a174e` | T4 docs + DB audit | verification + live DB audit file |
| 16 | `d566543` | AGENTS.md heading | `next dev` का auto-generated बदलाव |

---

## 1. `034998f` — Dependency hygiene

### क्या बदला

- `@vitest/coverage-v8` और `vitest`: `4.1.11` → `4.1.12` (patch)
- `autoprefixer` devDependency **हटाया** — Tailwind v4 अपनी prefixing खुद करता है, अलग autoprefixer बेकार था
- `overrides` में `zod: 4.6.7` जोड़ा — `@serwist/*` के अंदर आने वाला दूसरा zod version एक ही कर दिया
- `package-lock.json` पूरा regenerate हुआ (2,407 जोड़ / 2,541 हटाए)

### महत्व

- **एक ही zod version** = दो अलग zod instances नहीं बनते। दो instances होने पर `instanceof ZodError` fail होता है और validation errors चुपचाप गायब हो जाते हैं — यह बहुत मुश्किल bug होता है।
- `autoprefixer` हटाने से build chain सरल हुई, कोई कार्यक्षमता कम नहीं हुई (Tailwind v4 में built-in).
- Patch updates = security/bug fixes बिना API बदलाव के।

### उपयोग

रोज़ के काम में कुछ बदलना नहीं है — बस `npm install` अब साफ़ dependency tree देता है। भविष्य में जब भी zod upgrade हो, `overrides` की वही entry अपडेट करनी होगी।

**जोखिम:** कम। lockfile बड़ा बदला है, इसलिए किसी और मशीन पर `npm ci` ज़रूर चलाकर देखें।

---

## 2. `73e6178` — Tech adoption sprint plan

### क्या बदला

- नया दस्तावेज़: `docs/plans/tech_adoption_sprint_plan.md`
- इसमें baseline (26 Oct 2026), guard rails, T0–T6 हर sprint के checkboxes, skip-list और Definition of Done है।

### महत्व

- बिना लिखित plan के upgrade काम बिखर जाता है — कौन-सा package क्यों बदला, क्या छोड़ा और क्यों छोड़ा, यह रिकॉर्ड रहता है।
- "Skip list" भी उतनी ही ज़रूरी है: zustand/TanStack Table/GraphQL/Radix/Sentry 11 को **जान-बूझकर** न लेने का कारण लिखा है, ताकि बाद में कोई उसे भूलकर फिर से propose न करे।

### उपयोग

- किसी भी sprint के बाद plan doc + `docs/TODO.md` update करना इस repo का नियम बन गया।
- नया developer पहले यही file पढ़कर समझ सकता है कि project किस दिशा में जा रहा है।

---

## 3. `7657460` — T0: bundle baseline + React Query DevTools

### क्या बदला

- `@tanstack/react-query-devtools` devDependency जोड़ा
- `src/app/Providers.tsx`: DevTools **सिर्फ़ development** में dynamic import से load होते हैं; production में `() => null`
- `next.config.ts`: `withSentryConfig` का import `@sentry/nextjs` → `@sentry/nextjs/config` (deprecated path fix)
- bundle baseline दस्तावेज़ में दर्ज (सबसे भारी route: `/reports/cash-flow` 762.8 KB client JS)

### महत्व

- **Bundle baseline** के बिना पता ही नहीं चलता कि नया dependency kitna भारी पड़ा। अब नियम है: baseline से ~50 KB+ बढ़ाने वाले dependency को justify करना होगा।
- DevTools से query cache, refetch, stale time debug करना आसान — पर production bundle में **शून्य** असर, क्योंकि `NODE_ENV` build-time पर replace होता है और import dead-code बन जाता है।
- Sentry import fix: v11 में पुराना path हट जाएगा, अभी से सही path पर आ गए।

### उपयोग

- Local dev में screen के नीचे-बाएँ React Query icon दिखेगा (AI FAB और mobile tab bar से clash न हो, इसलिए bottom-left चुना)।
- Production build में वह icon कभी नहीं दिखेगा — verify करने के लिए `npm run build` के बाद bundle में devtools नाम खोज सकते हैं।

---

## 4. `465947c` — T1: Zod validation layer

### क्या बदला

- नया `src/lib/validation/index.ts`:
  - `parseBody(schema, request)` — JSON parse + schema validate, एक ही जगह
  - `parseData(schema, raw)` — form/server action के लिए
  - `fieldErrors()` — Zod error को `{ field: ["message"] }` में बदलता है
  - `badRequest()` — 400 response; पुराना `error` key बना रहता है, नया `issues` key field-wise messages देता है
- नए schemas: `client.ts`, `job.ts`, `location.ts`, `bomTemplate.ts`, `geofencePermit.ts`, `messaging.ts`
- 12 tests (`index.test.ts`)

### महत्व

- पहले routes `const body = await req.json()` और `body as { ... }` करते थे। **TypeScript का `as` runtime पर कुछ check नहीं करता** — गलत या missing field सीधे Supabase तक पहुँच जाती थी (गलत data, या DB error जो user ko समझ नहीं आता)।
- अब validation **एक ही जगह** है (single source of truth): route और form दोनों वही schema import करते हैं, इसलिए client/server में अंतर (drift) नहीं होता।
- `error` key जान-बूझकर रखी गई है ताकि पुराने client (mobile app) टूटें नहीं — यह **backwards compatibility** का सबसे ज़रूरी फ़ैसला था।

### उपयोग

नया route लिखते समय pattern:

```ts
const parsed = await parseBody(locationCreateSchema, request);
if (!parsed.ok) return parsed.response; // 400 + issues
// parsed.data अब पूरी तरह typed + runtime-validated है
```

UI में `issues` से inline field errors दिखा सकते हैं।

---

## 5. `3fc5961` — T2: 8 high-traffic API routes पर Zod

### क्या बदला

ये 8 routes अब `parseBody` + shared schema use करते हैं:

1. `api/admin/geofence-permit`
2. `api/bom-templates`
3. `api/bom-templates/[id]`
4. `api/locations`
5. `api/locations/assign`
6. `api/locations/manage`
7. `api/media/delete`
8. `api/messages/push`

### महत्व

- ये routes वही हैं जहाँ admin/staff सबसे ज़्यादा data भेजते हैं — गलत payload का असर सबसे ज़्यादा यहीं होता था।
- उदाहरण: geofence permit में गलत coordinates या missing user id पहले सीधे DB तक जाती थी; अब 400 + साफ़ message मिलता है।
- साथ ही एक practical फ़ायदा: गलत request अब DB तक पहुँचती ही नहीं, इसलिए आधा-अधूरा data नहीं बनता।

### उपयोग

- पुराना client वैसे ही काम करता है (`error` key वही है)।
- नया client `issues` पढ़कर field-wise error दिखा सकता है — उदाहरण: "location_id: Invalid input"।

---

## 6. `7f7074e` — T3.1: `clients/new` पर React Hook Form

### क्या बदला

- `src/app/clients/new/page.tsx` (205 lines) uncontrolled inputs से **React Hook Form + zodResolver** पर
- `src/lib/validation/schemas/client.ts` — एक ही schema जो form और (भविष्य में) API दोनों use कर सकते हैं
- 11 schema tests (`client.test.ts`)

### महत्व

- पहले हर field का validation अलग-अलग `if` से लिखा था — कहीं message अलग, कहीं check ही नहीं।
- अब validation **schema में एक जगह** है: वही नियम form में, वही API में।
- RHF render कम करता है (uncontrolled), इसलिए बड़े form में typing smooth रहती है।

### उपयोग

- गलत field भरने पर error उसी field के नीचे दिखता है, submit पर नहीं।
- **ध्यान:** इस migration में React Compiler lint के कारण `watch()` avoid किया गया — `useWatch` इस्तेमाल होता है। भविष्य में भी यही pattern रखें।

**जोखिम:** payload बिल्कुल वही रहा (verify किया गया), इसलिए DB/API side पर कोई बदलाव नहीं।

---

## 7. `6389fa5` — T3.2: `jobs/new` wizard RHF पर

### क्या बदला

- `src/app/jobs/new/page.tsx` (338 lines) — सबसे बड़ा form (client, mechanic, device, services, products, Quick Save)
- `src/lib/validation/schemas/job.ts` + 6 tests
- Controller/`useWatch` से select fields, `handleSubmit` wrapper function से (render के दौरान call नहीं)

### महत्व

- Job create रोज़ का सबसे ज़रूरी काम है — यहाँ गलत data सीधे repair workflow, billing और commission को प्रभावित करता है।
- पहले fault/item खाली छूट सकते थे; अब schema ज़रूरी fields रोकता है (item optional, fault required — पुराना behaviour बनाए रखा)।
- Quick Save (billing skip) और पूरा save — दोनों एक ही validated payload से जाते हैं।

### उपयोग

- Wizard में आगे बढ़ते समय field-level errors दिखते हैं।
- **महत्वपूर्ण:** `handleSubmit(...)` render के दौरान call न करें (React Compiler lint error देगा) — wrapper function बनाएँ, जैसा इस commit में है।

---

## 8. `f55ccd6` — T4: Playwright e2e setup

### क्या बदला

- `playwright.config.ts`, `e2e/auth.setup.ts` (एक बार login → storageState), `e2e/utils.ts`
- 5 smoke specs: `login`, `inventory`, `attendance`, `job-create`, `direct-sale`
- `.github/workflows/e2e.yml` — **सिर्फ़ manual** (`workflow_dispatch`), missing secret पर fail-fast
- npm scripts: `e2e`, `e2e:ui`, `e2e:install`
- `.gitignore` + `eslint.config.mjs` में artifacts (`test-results/`, `playwright-report/`, `e2e/.auth/`, `coverage/`)

### महत्व

- Zod/RHF migration का असली safety net: unit tests form submit का पूरा सफ़र नहीं दिखाते, e2e दिखाता है।
- `storageState` से login **एक ही बार** होता है — 5 specs बार-बार login नहीं करतीं, इसलिए run तेज़ और स्थिर रहता है।
- `e2e/.auth/` gitignored है क्योंकि उसमें **session cookies** होती हैं — इसे commit या share करना credentials leak होगा।

### उपयोग

```bash
npm run e2e:install   # पहली बार only
npm run e2e           # headless
npm run e2e:ui        # interactive debugger
npx playwright show-report
```

---

## 9. `33c397f` — T5.1: `@google/generative-ai` → `@google/genai`

### क्या बदला

- पुराना (deprecated) package हटाया, नया `@google/genai@2.31.0`
- `src/lib/gemini.ts`: `GoogleGenAI` client, `ai.chats.create({ model, history, config })`
- Tool declarations अब `parametersJsonSchema` से (plain JSON schema — `gemini-tools.ts` का shape वही रहा, Groq path भी अछूता)
- `response.functionCalls` getter — `call.name` optional होने पर guard
- `response.text` अब `string | undefined` — fallback message जोड़ा

### महत्व

- पुराना SDK deprecated है — आगे security patch नहीं मिलेंगे।
- Function calling live verify किया गया: `get_business_summary` → tool response → final text (एक पूरा round-trip)।
- Groq path नहीं छेड़ा गया, इसलिए dual-provider setup जैसा था वैसा काम करता है।

### उपयोग

- `/ai` page पर model selector से Gemini चुनकर chat — UI बदला नहीं है।
- नया tool जोड़ते समय `gemini-tools.ts` में schema लिखें; `gemini.ts` खुद उसे `parametersJsonSchema` में बदल देता है।

**बाकी:** `/ai` page पर असली chat user action है (API key + UI)।

---

## 10. `6091318` — T5.2: native `BarcodeDetector` + fallback

### क्या बदला

- नया `src/lib/barcode-scanner.ts`:
  - `startBarcodeScanner()` — native `BarcodeDetector` हो तो getUserMedia + `<video>` + detect loop
  - नहीं हो तो **html5-qrcode** lazy-import (पुराना behaviour)
  - `hasNativeBarcodeDetector()`, `cameraErrorMessage()`
- दोनों components migrate: `BarcodeCameraScanner.tsx`, `inventory/QuickScanModal.tsx`
- दोनों engine का contract एक: पहला successful read → scanner बंद → `onScan(text)`

### महत्व

- **~250 KB bundle बचत** — असल में **सिर्फ़ Android Chrome/WebView** पर (28 Oct 2026 को headed Chrome/Edge/Playwright probe से पुष्टि: Windows desktop Chrome/Edge में `BarcodeDetector` मौजूद ही नहीं है)। Mobile-Android users के लिए यह सीधा speed फ़ायदा है।
- **सुधार (28 Oct):** पहले यहाँ "Chrome/Edge" लिखा था, जो गलत था — desktop पर fallback ही चलता है। iOS Safari/Firefox पर भी fallback — कार्यक्षमता कम नहीं होती।
- Native detector ज़्यादा तेज़ और कम battery लेता है।

### उपयोग

- Inventory scan और barcode camera दोनों जगह वही UI — user को फ़र्क नहीं दिखता।
- **बाकी:** असली device matrix (Android/iOS) पर sign-off user action है।

---

## 11. `83a1f28` — Offline/localhost master plan doc

### क्या बदला

- `docs/plans/offline_localhost_master_plan.md` (1,321 lines) जोड़ा गया

### महत्व / स्थिति

- **यह मेरा काम नहीं है** — यह commit मेरे काम के बीच में history में आ गया था।
- आपके निर्देश पर इसे **जैसा है वैसा** रखा गया है (soft undo नहीं किया)।

---

## 12. `236a6c0` — Vitest 4 → 5

### क्या बदला

- `vitest` और `@vitest/coverage-v8`: `4.1.12` → `5.0.5`
- code change **शून्य** — सिर्फ़ test runner upgrade
- परिणाम: **417/417 tests green**, coverage report भी green

### महत्व

- Test runner का major upgrade समय पर करना ज़रूरी है, वरना बाद में Node/React upgrade के साथ दो बड़े बदलाव एक साथ करने पड़ते हैं।
- coverage-v8 का वही major रखना ज़रूरी है, वरना coverage report बनती ही नहीं।

### उपयोग

```bash
npm run test            # 417 tests
npm run test:coverage   # coverage report
```

---

## 13. `e3dce5d` — T6 status docs

### क्या बदला

- plan doc में T6 backlog का असली status:
  - `vitest 5` — **done**
  - `TypeScript 5.9 → 7.0` — **blocked**: `typescript-eslint` का peer `typescript <6.1.0` है
  - `realtime lists` — **stale**: audit के हिसाब से list-polling loops बचे ही नहीं (जो `setInterval` हैं वे clock/heartbeat हैं)

### महत्व

- "काम बाकी है" और "काम की ज़रूरत ही नहीं" — दोनों का फ़र्क लिखित होना चाहिए, वरना backlog हमेशा भारी दिखता है।
- TS7 को बिना वजह try करने से lockfile और lint पूरा टूट सकता था — इसलिए block को दर्ज किया।

### उपयोग

जब `typescript-eslint` TS7 support दे, तब plan doc का T6 item खोलकर retry करें (trial branch + पूरा suite)।

---

## 14. `7fcb9d2` — e2e real-run fixes

### क्या बदला

- `playwright.config.ts`: `baseURL` **`localhost`** (पहले `127.0.0.1`)
- `e2e/auth.setup.ts`: login के बाद critical routes का warm-up
- `e2e/utils.ts`: `SearchableSelect` की clear row skip (`div.cursor-pointer:has(> div.min-w-0)`), async options का bounded wait + per-call timeout
- `direct-sale.spec.ts`: product के बाद **`Add`** click, in-stock product preference
- `attendance.spec.ts`: `clickUntilUrl()` — hydration से पहले का click repeat
- global `timeout: 180_000`

### महत्व (यह सबसे ज़रूरी commit है — असली run में मिले bugs)

| समस्या | असली कारण | Fix |
|---|---|---|
| Login `/login?` पर लौट आता था | `127.0.0.1` origin पर Next dev cross-origin resources block करता है → client JS load नहीं → React hydrate नहीं → form native submit | `localhost` baseURL |
| 5 specs में से 4 fail | dev server पर पहली hit पर route compile धीमा | setup में route warm-up |
| Selection खुद clear हो जाती थी | menu की clear row भी `div.cursor-pointer` थी | `:has(> div.min-w-0)` selector |
| Job form "master data खाली" बताकर skip | 537 clients 4-5 sequential queries में आते हैं, instant count गलत | bounded wait + 90s timeout |
| Direct sale पर Create Sale disabled | product select से सिर्फ़ dropdown भरता है, line item `Add` से बनती है | `Add` click |
| Attendance tab switch बेअसर | hydration से पहले click | `clickUntilUrl` retry |

### उपयोग

- अब `npm run e2e` में write specs बंद रहने पर **4 passed / 3 skipped** — कोई red नहीं।
- यह commit यह भी सिखाता है कि dev-mode e2e में **hydration** और **compile time** कोई भी test को झूठा fail करा सकते हैं — इसलिए retry/timeout helpers रखे गए।

---

## 15. `e0a174e` — T4 docs + live DB audit

### क्या बदला

- plan doc T4: verification नतीजे + real-run debugging list + live DB warning
- `docs/TODO.md`: T4 entry update
- **नया:** `docs/DB_CHANGES_E2E_AUDIT_2026-10-26.md` — 46 test rows की पूरी list + verification + cleanup SQL
- `.env.example`: `E2E_ALLOW_WRITES` **सिर्फ़ staging** पर — warning

### महत्व

- **सबसे ज़रूरी सबक:** `.env.local` **live/production** Supabase project पर point करता है। उस समय `E2E_ALLOW_WRITES=1` था, इसलिए write specs ने live DB में 46 rows बना दिए (12 sales, 12 items, 5 jobs, 17 logs)।
- Audit file में exact IDs हैं, इसलिए cleanup deterministic है — "कुछ rows थीं" जैसी अंदाज़ा-बाज़ी नहीं।
- `.env.example` में चेतावनी अब हर developer को build से पहले दिखती है।

### उपयोग

- Cleanup SQL आप खुद चलाएँ (agent नहीं चलाएगा)।
- `job_id_counter` को reset **नहीं** करना — वह अब real jobs (29520–29528) से legitimate है।
- आगे: writes सिर्फ़ **staging project** पर, live पर `E2E_ALLOW_WRITES=0` (अभी आपने कर दिया है)।

---

## 16. `d566543` — AGENTS.md heading fix

### क्या बदला

- `AGENTS.md` में `# This is NOT the Next.js you know` → `## ...`

### महत्व / उपयोग

- यह `next dev` के `generate-agent-files.js` से **अपने आप** लिखा जाता है। इसे commit न करने पर हर `npm run dev` के बाद working tree गंदा दिखता है।
- कार्यक्षमता पर शून्य असर — सिर्फ़ repo साफ़ रखने के लिए।

---

## सत्यापन (Verification) स्थिति

| जाँच | परिणाम |
|---|---|
| `npm run typecheck` | ✅ 0 errors |
| `npx eslint .` | ✅ 0 problems |
| `npm run test` | ✅ **417/417 passed** |
| prettier (`e2e/**` + `playwright.config.ts`) | ✅ clean |
| `npm run e2e` (writes **off**) | ✅ 4 passed / 3 skipped |
| `npm run e2e` (writes on, 26 Oct) | ⚠️ 6 passed / 1 skipped — **live DB में 46 rows** (audit file) |

---

## जो अभी बाकी है (सिर्फ़ आपके actions)

| # | काम | क्यों |
|---|---|---|
| 1 | Live DB cleanup — audit file की SQL चलाएँ | 46 test rows हटाना |
| 2 | GitHub में staging secrets + `E2E_ALLOW_WRITES` variable | e2e CI के लिए |
| 3 | Actions → **E2E (Playwright)** → Run workflow → green | push-trigger enable करने से पहले proof |
| 4 | उसके बाद `push: branches: [main]` जोड़ना | हर merge पर e2e |
| 5 | `/ai` page पर Gemini chat (UI check) | T5.1 का आख़िरी verification |
| 6 | Android/iOS पर barcode scan sign-off | T5.2 device matrix |
| 7 | Push approval (16 commits) | आपके निर्देश पर अभी local |

---

## छोटी शब्दावली (जो terms बार-बार आए)

| Term | सरल अर्थ |
|---|---|
| **Zod** | Runtime validation library — data का shape/type सच में जाँचती है (TypeScript सिर्फ़ compile-time पर जाँचता है) |
| **`parseBody`** | Request body पढ़कर schema से validate करने वाला helper |
| **RHF (React Hook Form)** | Form state + validation संभालने की library; कम re-render |
| **`storageState`** | Playwright में saved login session (cookies) — बार-बार login न करना पड़े |
| **hydration** | Server के HTML पर React का client-side JS जुड़ना; इससे पहले click बेअसर हो सकता है |
| **bundle baseline** | Build के बाद हर route का JS size — तुलना का पैमाना |
| **write-gate** | `E2E_ALLOW_WRITES=1` के बिना DB में लिखने वाली e2e specs skip |
| **storageState / `.auth/`** | Login tokens — gitignored, कभी commit नहीं |
