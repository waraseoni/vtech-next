# Multi-Language (Hindi / English / Hinglish) — Feasibility & Implementation Plan

Created: 2026-09-17
Status: **PLAN ONLY — implementation NOT abhi.** Season me freeze (G3). Ye doc =
decision ke liye full analysis + post-season execution blueprint.
Scope: pehle **Hinglish (current, canonical) + English + Hindi-Devanagari**, framework
aisa karo ki baad me anya bhashayein (Gujarati, Marathi, Punjabi…) add hon.

---

## 0. VERDICT (pehle — ye "uchit" hai ya nahi?)

> **Technically ->5 feasible, koi blocker nahi. Ek kharabi phir bhi multi-language
> option bana sakte hain.**
>
> **Par "full framework migration" abhi overkill hai.** Honest assessment:
>
> | Factor | Score | Explanation |
> |---|---|---|
> | Technical feasibility | ✅ EASY-SAFE | No i18n lib exists (clean slate — koi legacy poochne wali nahi). App **88% client-rendered** → locale `localStorage` se pre-paint init (`layout.tsx:82-90` THEME_BOOT precedent) → **hydration-flash issue nahi**. Sirf 14 server pages + ~20 print/API routes hain jinke liye SSR cookie handling chahiye. |
> | Effort vs value (full rewrite) | ⚠️ HIGH EFFORT, MEDIUM VALUE | ~1,500–2,500 distinct strings, 143 files me JSX text (audit). Single-shop internal tool ke liye 3-language global catalog ka ROI **middling**. |
> | Already half-done (aukaat) | ✅ PRIZE | Money-critical report surfaces **pehle se Devanagari** hain: `reports/balancesheet` (full), `reports/ledger`, `reports/vyapar-darpan`, 11 WhatsApp templates, due-reminders fallback. Inka "translation" already hai — sirf muster/source-of-truth define karna baaki. |
> | Business risk if rushed | 🔴 HIGH in season | 41 write files, dynamic template-literal strings (~20+), 20 print routes me hardcoded `"en-IN"` + ₹ formatting. Partial diya to half-Hindi half-English UI = khichri. Season me **NOT**. |
> | Long-term (post-season) | ✅ WORTH IT | Subsahar shop ke staff Hindi-first hain; Devanagari pages/WA pehle se use hote hain; bilingual print/job reports barabar ka demand hai. Controlled, incremental approach = paisa-vasool. |

**Bottom line: "bana sakte hain" — haan, aur recommended hai — but as a POST-SEASON,
incremental, no-framework-first project. Phase 1 (foundation + high-value surfaces)
me ~3–4 din ka focused kaam; full 3-language sweep = aage bahut saal bhar optional.**

Kabhi: agar koi bade client/exporter English-only reports, ya staff Hindi-Devanagari-
only karta hai → ROI badh jata hai aur project higher priority par chala jata hai.

---

## 1. Vision & Scope

- **T1 (abhi pehla round):** UI chrome + nav + statuses + common toasts/errors
  teen track par: **Hinglish (default) / English / हिन्दी (Devanagari)**.
- **T2:** Money-critical data surfaces (reports, ledger, balancesheet, vyapar-darpan,
  invoices) par language toggle + print pages.
- **T3 (any time aage):** Naye language packs (Gujarati/Marathi/…), content tracks
  (WhatsApp/invoice per-language) ko framework-agnostic dict me add — bina data model
  break.
- **NOT in scope:** IDN (internationalized domain), RTL, multi-currency, Devanagari
  *digits* `०-९` default on (optional setting hi rakhenge), full next-intl adoption
  jab tak P1 ka value sabit na ho.

### Language choice clarity (importaant)
- **Hinglish = canonical base** (authoring language) — repo ka de-facto standard,
  owner + staff comfortable.
- **English** aur **Devanagari Hindi** = derived render tracks.
- Jo surfaces **pehle se Devanagari** hain (WA templates, balancesheet) — unme Devanagari
  canonical hai, Hinglish/English derived.
- → Kabhi "Hinglish se translate karo" nahi — **har surface apni source language
  declare karta hai**, translate direction har surface ke liye explicit.

---

## 2. Current-state audit (2026-09-17, verified file-by-file)

### 2.1 Infra
- `package.json`: koi i18n lib nahi (`i18n/intl/locale/translation` deps zero).
- Koi `locales/`/`messages/` folder nahi. Koi `next-intl` config nahi.
- Precedent: `src/app/layout.tsx:82-90` — `THEME_BOOT` inline script `localStorage`
  se pre-paint init; `<html lang="en">` hardcoded `layout.tsx:97` +
  `global-error.tsx:22`.

### 2.2 String surface (audit numbers)
- 118 `page.tsx`: **104 client** (88% CSR), 14 server. Client-heavy → locale init
  bina flash possible.
- ~143 `.tsx` files me JSX visible text; ~**1,354** text-node literals;
  ~333 placeholder/title/aria attributes; estimate **~1,500–2,500 distinct strings**
  (kafi repeats — reuse मिलता hai).
- Main string clusters: `reports/` 29 pages, `jobs/` 11, `clients/` 10,
  `inventory/` 10, `mechanics/` 6, shell `RootClient.tsx` (2,144 lines, nav+drawer),
  `settings/` 3 + shared modals.

### 2.3 String styles present today (4 flavors!)
| Style | Where | Example (file:line) |
|---|---|---|
| **English** (labels/nav/status) | RootClient nav, `status-colors.ts:25-68` (JOB_STATUS), invoices | "Dashboard", "Pending", "TAX INVOICE" |
| **Devanagari** (already!) | `reports/balancesheet` (52 ln), `reports/ledger/client.tsx` (34 ln), `reports/vyapar-darpan`, `whatsappTemplates.ts` (11 defaults), `due-reminders` FALLBACK_REMINDER | "व्यापार बैलेंस शीट", "नमस्ते {client_name} जी…" |
| **Hinglish** (dominant) | geofence.ts:118-130, cameraSupport.ts, settings toasts, login route:38-155, my-account | "Aap office ke bahar hain…", "Email ya password galat hai!" |
| **Mixed en+hi** | ledger glosses, vyapar-darpan | "संपत्ति (Assets)" |

### 2.4 Dynamic/format-sensitive strings (i18n ke liye sabse khatarnak)
- Interpolations: `notify.ts:16` `` `…र {amount.toLocaleString("en-IN")} payment …` ``,
  `messaging.ts:341-342` `` `${x} min pehle` ``, login `:155` `` `${h} ghante ${m} min` ``,
  `jobs/page.tsx:918` `` `${n} jobs ka status change karein?` ``, `dateUtils.ts:153` `` `${h}h ${m}m` ``.
- **YEH sab placeholder tokens ke roop me re-kam honge** — `t("paymentDue", {amount, days})`.
- **Currency:** ₹ + `toLocaleString("en-IN")` helper **~20 baar copy-pasted** (print-* routes,
  clients/mechanics helpers, notify.ts, gemini-tools.ts). Abhi koi shared `formatMoney` nahi.
- **Dates:** `dateUtils.ts` sab `Intl.DateTimeFormat("en-CA")`/`"en-IN"` hardcoded;
  month labels `{ month:"long" }`; `DOW_LABELS=["Su"…]` `MonthlyReport.tsx:314`;
  **Devanagari digits (०-९) kahin nahi** — teeno render track par Latin digits aram-se chalte.
- **Integer plural "X of Y"/plural inflection helper nahi** — Hinglish me plural chinta kam
  (gender/plural-free construction) → translations easy.

### 2.5 Persistence fuel
- `profiles` columns: id, full_name, role, avatar_url, updated_at, mechanic_id, email,
  date_updated, client_id → **language column NAHI** (additive migration chahiye).
- `system_info` = generic key-value (`meta_field/meta_value`) → **shop-default language
  KV aaj hi possible** (settings generic `upsertField`; no schema change).
- Anonymous/non-logged (marketing pages) → `localStorage` `vtech_lang`.

### 2.6 External side-effect strings (consistency concern)
- **WhatsApp:** 11 default templates Devanagari (`whatsappTemplates.ts`),
  placeholders `{client_name}…` (registry `:204-217`); template resolution
  `whatsapp.ts:22-24` (canonical→override→default).
- **Push notify:** English titles + Hinglish bodies (`notify.ts:15-84`).
- **Print/invoice (~20 routes):** pure English HTML + selective Hinglish empty-states.
- **AI assistant:** replies Hinglish (`gemini.ts:115`) — "ask in friendly Hinglish/Hindi".

→ **Key design consequence:** UI-language ≠ content-language independent toggles chahiye
(ya accept karo ki pehle round sirf UI track hoga, WA/print apni current tracks par).

---

## 3. Approach Options (compare & choose)

### Option A — Full i18n framework (next-intl / react-i18next)
- Sab strings `messages/en.json`/`hi.json`/`hinglish.json`; `t()` everywhere; SSR cookie routing.
- **Effort:** bada. ~1,500–2,500 key catalog + 143 files touch + formats refactor.
  Estimate **8–15 working days** single-owner; QA heavy (hydration, dynamic, prints).
- **Risk:** high mid-season; partial diya to khichri UI.
- **Kis liye:** bola na — multi-tenant enterprise/export clients.

### Option B — Lightweight locale dictionary + t() (NO framework) ✅ RECOMMENDED END-STATE
- Ek `src/lib/i18n/` (dicts per language + `t(key, vars)` + `useT()`).
- Keys = surface-intent based, Hinglish dictionary = source of truth (har language ka
  dict har surface-declared source se derive).
- Client init: `localStorage` pre-paint (THEME_BOOT pattern) + `system_info` default +
  `profiles.language` (logged-in). Server pages/API: cookie read.
- **Effort:** Phase 1 (foundation + chrome/status/toasts/forms select) ~**3–4 days**;
  full sweep gradual.
- **Risk:** low per-phase (incremental, CanRollback per surface).
- **Jaaga:** framework ki SSR complexity in dono — ye app banke dekhtay.

### Option C — Incremental per-surface (cheapest, sabse immediate value) ✅ REC FIRST WAVE
- Har high-value surface ko switchable banao bina global sweep:
  1. `reports/balancesheet`, `reports/ledger`, `reports/vyapar-darpan` — teeno me lang
     toggle (Devanagari ↔ English ↔ Hinglish) — **90% strings already exist**; sirf
     Hinglish/English derive + switch UI.
  2. **Invoice/print** `print-*-invoice` me language select (English/Devanagari) —
     GST invoice shabdavali mapping ready hai (TAX INVOICE vs "कर चालान"…).
  3. **WA templates** me per-template Devanagari/Hinglish editions (ab Devanagari
     canonical hai; English users ke liye English variant selector).
  4. `status-colors.ts` + RootClient nav/status + common toasts → t()-dict (Option B base).
- **Effort:** wave-1 ~**2–3 days**, high visible value, low risk, koi framework nahi.

### Recommendation (honest)
> **Phase 0 = Option C wave-1 (is value jo bach rahe sabse paidi hain).**
> Phase 1 = Option B foundation (`i18n/` dict + toggle + data model) — isse naye
> surfaces incremental add honge.
> **Option A tab hi, jab real demand (export clients / multi-staff languages) dikhe.**
> Season me soch-na tak nahi; ye sab **post-season window** me.

---

## 4. Data Model & State

### 4.1 Precedence (kitna granular)
1. **`profiles.language`** (logged-in user override) — additive migration
   `ALTER TABLE profiles ADD COLUMN language text DEFAULT 'hinglish'` nullable; RLS already.
2. **`system_info` KV `language_default`** (shop default, settings page se set — generic
   upsert already hai, no schema change).
3. **`localStorage` `vtech_lang`** (anonymous / marketing / bina override).

Resolution: `user → shop(default) → 'hinglish'`.

### 4.2 Content tracks (WA/print/AI) — independent toggle
- `system_info` KV: `wa_language` (Devanagari default), `invoice_language` (English
  default), `ai_language` (Hinglish default) — har surface apni language manage kare;
  UI toggle unpar map kare. Ye "content" language **UI language se alag** rakh sakte hain.

### 4.3 Formatters (critical refactor, saf)
- `dateUtils.ts`/money helpers me locale param pass karo (`fmtIST(locale)`, `fmtINR` shared —
  aaj ka copy-paste ki jagah ek `src/lib/format.ts` `formatMoney(n, locale)`).
- `Intl.NumberFormat(locale, {style:"currency", currency:"INR"})` + ₹ premium optional.
- Months: `{month:"long"}` locale-driven (hi me "जनवरी", en me "January" — approx free).
- **Devanagari digits optional** setting (`use_devdigits`) — default OFF (Latin digits
  universal).

---

## 5. Dictionary Design (framework-agnostic)

- `src/lib/i18n/context.tsx` — `LanguageProvider`, `useT`, `lang` state, pre-paint bootstrap.
- `src/lib/i18n/dicts.ts` — `Record<Lang, Dict>`; `t(key, vars)` interpolation
  `{placeholder}` syntax (already WhatsApp `substituteTemplate` pattern se match).
- **Surfaces declare `sourceLang`:** e.g. `balancesheet: "hi"`, `nav/status: "en"`,
  `toasts/errors: "hinglish"` — dict per surface per lang. Map:
  ```
  nav.dashboard: hinglish "Dashboard", en "Dashboard", hi "डैशबोर्ड"
  nav.jobs:      hinglish "Jobs",    en "Jobs",    hi "काम/जॉब्स"
  toast.saved:   hinglish "Save ho gaya!", en "Saved!", hi "सेव हो गया!"
  ```
- **Glossary (source of truth)** — `src/lib/i18n/glossary.ts`: firm/domain terms ka
  fixed mapping (Invoice=चालान, Balance=kस्ट sufá, Client=ग्राहक, Stock=स्टॉक, Job=काम,
  Salary=tना़, Ledger=लेंडर/खाता…) — AI-translation consistency inhi se.
- **AI-assisted first pass:** current strings → LLM hinalhi gloss+en + sourced via glossary
  → **owner review har batch** (business terms owner ki manzoori se). Kabhi auto-commit-then-forget nahi.

---

## 6. Phased Execution (post-season)

### Phase 0 — Decisions (is document ke andar mark)
- [ ] Option confirm: **C wave-1 first, phir B** (recommended) — ya full B/A.
- [ ] Devanagari digits: no (default). Confirm.
- [ ] English target audience confirm: sepaysia? salary/invoice English chahiye?
- [ ] Kantan keys: `existing-lang` per surface mapping final karo.

### Phase 1 — Foundation (Option B base) ~3–4 din
- [ ] `src/lib/i18n/` context+dicts+t()+format.ts (shared `fmtINR(locale)`, fmtIST locale param).
- [ ] Prelude bootstrap: `vtech_lang` localStorage pre-paint (THEME_BOOT jaisa),
      `system_info.language_default`, `profiles.language` (migration + profile fetch).
- [ ] Language switch UI: settings + sidebar footer + mobile drawer (`RootClient.tsx`).
- [ ] Rollout: `status-colors.ts`, nav chrome, common placeholders/titles, login/throttle
      Errors, geofence/camera Hindi msgs — sab t() me.
- [ ] Tests: `npx tsc --noEmit`, eslint, `npx vitest run` (har dict spot-check),
      hydration saaf, build green.

### Phase 2 — Wave-1 value surfaces (Option C) ~2–3 din
- [ ] balancesheet / ledger / vyapar-darpan lang toggle (derived tracks already exist).
- [ ] Print invoices: language select (English/Devanagari) — 1 print route pilota (~20 nahi).
- [ ] WA templates: per-template edition selector (Devanagari default + English variant).

### Phase 3 — Content tracks + polish
- [ ] `wa_language`/`invoice_language`/`ai_language` KV + UI mapping.
- [ ] Empty-states wipe (jo Hinglish strings print HTML me hain — unko derived karo).
- [ ] RTL/Digits-devotional optional settings refactor (small).

### Phase 4 — Scale
- [ ] Any other language pack (Gujarati/Marathi): ek naya `dicts.ts` entry, glossary
      review, content track — bina data model change.
- [ ] Bounded to say: per-language **type-safe keys** (key union) so missing translation
      = type error (cieless bug-pa).

---

## 7. Test Matrix

| Case | Expectation |
|---|---|
| Staff selects Hindi → nav/toasts/reports Devanagari; no hydration flash | pass |
| Anonymous marketing (Power Supply page) `vtech_lang=en` | English, pre-paint correct |
| Admin override vs shop default precedence | user > shop > hinglish |
| Print invoice language select | Indian GST labels in chosen lang |
| Income month names (जनवरी/January) in balancesheet | locale-driven |
| ₹ amounts, `en-IN` grouping in hi/en/hinglish | same digits, correct thousands |
| WhatsApp template English edition | sent template = selected, placeholders substitute |
| Dynamic strings (`X min pehले`, `n jobs change`) | placeholders render, no missing key |
| Missing key defense (new string, un-translated) | falls back Hinglish + console warn (NOT blank) |
| Multi-tab + logout/login | locale reset per user, no leak |
| Rollback: remove dict prefix from any page | page renders as before (safe per-surface) |

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Scope creep (143 files) | Inspire: surfaces declare sourceLang; incremental per-phase; NOT full sweep on day 1 |
| Khichri UI (partial translation) | Per-surface "complete-or-original" rule: surface tabhi switchable hai jab uska dict complete (тест) |
| Price/date formatting drift | Shared `format.ts`; locale param; existing print routes lagatar port |
| Dynamic strings break (template literal → placeholder) | Prefer placeholder refactor per string; tests har dynamic key |
| Hydration mismatch (SSR vs client lang) | 88% CSR → localStorage pre-paint; sirf 14 server pages cookie SSR; `suppressHydrationWarning` nahi |
| AI translation galti | Glossary + owner review batch-by-batch; AI koi business term khud na choose kare |
| Business disruption mausam me | G3 freeze: abhi code nahi; window me hi |
| English kanvev about term (Challan vs Invoice) | Glossary owner-locked; per-client expectation check |

---

## 9. Effort Estimate (honest, single-owner)

| Scope | Days |
|---|---|
| Phase 1 (foundation) | 3–4 |
| Phase 2 (value surfaces C wave-1) | 2–3 |
| Phase 3 (content tracks + polish) | 2–3 |
| Phase 4 (extra language pack) | 1–2 per language |
| QA loop (incl. prints/tests) | 2–3 |
| **Total core (P1–P3)** | **~7–13 working days** (spread post-season, not consecutive) |

> Baaki i18n framework (Option A) to is rakh par alag +6–10 days, inclined jab
> multi-language (3+) ya multi-tenant ho.

---

## 10. Summary Recommendation (again, ek line)

> **Haan, bana sakte hain — but incremental, no-framework, post-season.**
> Ism America already Devanagari present honh — ise reuse; pehle **report/invoice/WA
> surfaces ko switchable** banao, phir foundation Layer (dict+toggle) banakar baaki UI
> gradual par lao. Framework full abhi nahi.

_Note: implementation se pehle Phase 0 decisions confirm karo + `docs/DATA_MIGRATION_NOTES.md`
(agar `profiles.language` jaane to additive migration). Season me kuch bhi deploy nahi._