# Multi-Language (हिन्दी / English) — Plan v2

- **Created:** 2026-09-17
- **Revised:** 2026-11-01 (v2 — decisions locked, phase order fixed, garbled text repaired,
  audit numbers refreshed)
- **Status:** **PLAN ONLY — implementation pending.** Season freeze + live-DB no-change rule.
  Is revision me sirf document update hua hai; koi code/DB change nahi.
- **Constraint:** zero DB writes / zero schema changes jab tak owner alag se na kahe.

---

## 0. Verdict

> **Bana sakte hain, aur karna chahiye — par incremental, glossary-first, no-framework.**
> Full i18n framework (next-intl/react-i18next) abhi overkill hai; 1,500–2,500 strings ka
> big-bang sweep season me khichri UI banayega.

| Factor                       | Assessment                | Reason                                                                                                                                                                                                       |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Technical feasibility        | Easy–safe                 | Koi i18n dependency nahi (clean slate). ~83% pages client-rendered → locale `localStorage` se pre-paint init ho sakta hai, hydration flash nahi. 24 print routes + server pages ke liye cookie read chahiye. |
| Effort vs value (full sweep) | High effort, medium value | Dedupe ke baad realistic ~700–1,000 visible strings. Asli cost translation nahi, QA/print consistency hai.                                                                                                   |
| Already half-done            | Strong head start         | Money-critical surfaces pehle se Devanagari me hain: balancesheet (ab print/CSV ke saath), ledger, vyapar-darpan, 11 WhatsApp templates. Inka source language declare karna baaki hai.                       |
| Risk if rushed               | High                      | 41 write files, template-literal strings, 24 print routes me hardcoded locale. Partial delivery = half-Hindi/half-English screens.                                                                           |
| Long-term value              | Worth it                  | Staff Hindi-first, owner Hinglish, invoices/export clients English. Tri-track demand real hai.                                                                                                               |

**Bottom line:** v2 me implementation **abhi nahi**. Pehle Phase 0 (glossary + inventory +
format layer) — wo bhi freeze ke baad. v2 ka pehla code change user-visible nahi hoga.

### 0.1 v1 → v2 me kya badla

1. **User-facing locales 3 se 2 kar diye:** `hi` (Devanagari) + `en`. Hinglish ab
   selectable language nahi — canonical authoring register + default UI voice hai
   (section 2 me reason).
2. **Phase order fix:** v1 me §3 "Option C wave-1 pehle" aur §6 "foundation pehle"
   contradictory tha. v2 ka order: glossary → format layer → foundation → pilot surfaces.
3. **Formatting ko Phase 0 me daala:** repo me 305 `"en-IN"` + 51 `"en-CA"` literals aur
   32 non-test files me copy-pasted `toLocaleString("en-IN")` hain. Ye translation se
   pehle consolidate hoga — zero user-visible change, highest consistency ROI.
4. **Print/WhatsApp language snapshot:** language record ke saath store hoga (send/print
   ke waqt), live global toggle se nahi. Reprint 6 mahine baad bhi original bhasha me.
5. **`profiles.language` migration defer:** live DB freeze. v1 me `system_info` KV +
   `localStorage` + per-device language kaafi hai.
6. **Message taxonomy add:** user-facing vs internal (logs/comments/DB values) strings
   alag. Sab kuch translate karna waste aur risky hai.
7. **Guardrails add:** dict parity test, typed keys, missing-key fallback warning,
   complete-or-original checklist, dynamic `<html lang>`.
8. **Doc corruption repair:** v1 me "Technically ->5", "kस्ट sufá", "तना़", "हिनलही",
   "kanvev", "Ism America…" jaise garbled tokens the — v2 clean hai.
9. **Factual corrections:** `<html lang="en">` static hai (`src/app/layout.tsx:104`) par
   `suppressHydrationWarning` **already present** hai (v1 ne ulta likha tha).
10. **Audit refresh (2026-11-01):** 121 `page.tsx` (100 client), 239 `.tsx`, 24 print
    routes, 11 WA defaults.

---

## 1. Design principles

1. **Ek surface = ek bhasha.** Ek screen/first-print me ek hi language; "संपत्ति (Assets)"
   jaisa gloss sirf tab jab glossary me locked term ho.
2. **Ek shabd = ek term.** Domain vocabulary owner-signed glossary se aata hai, har page
   apna translation nahi banata.
3. **Har surface apni source language declare karta hai.** Translation direction fixed:
   balancesheet/WA ka authority Devanagari; nav/toasts ka Hinglish; invoice ka English.
4. **Complete-or-original.** Surface tabhi switchable hai jab uske **saare** visible
   strings (labels, empty states, toasts, validation, print, CSV headers) dict me hon.
   Warna surface untouched rehta hai — aadhi translation se better hai kuch na karna.
5. **Missing key = source fallback + dev warning.** Blank UI kabhi nahi.
6. **Formatting ek hi jagah se.** Money/date/number ek `format.ts`; Latin digits hamesha,
   `en-IN` grouping, `₹`.
7. **No DB change in v1.** Language preference device + shop KV. Profile column tab jab
   multi-staff demand aaye.

---

## 2. Language model

### 2.1 User-facing locales (v2)

| Locale                     | Role                                           | Notes                                            |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| `hi` — हिन्दी (Devanagari) | Shop-floor primary                             | Reports/WA/print me authority already Devanagari |
| `en` — English             | Invoices, export/supplier communication, owner | Labels + GST vocabulary glossary se              |

**Hinglish kyun user-facing locale nahi:**

- Hinglish koi stable register nahi — do writers do tarah likhte hain ("Save ho gaya" vs
  "Save ho gya" vs "Saved"), isliye har release me drift hoga.
- 3 options = 3× QA permutations (UI × print × WA), jabki real demand 2 tracks ki hai.
- Aaj ka Hinglish voice **authoring base** ke roop me retain hoga: naye strings pehle
  Hinglish me likhe jaate hain, phir `hi`/`en` derive hote hain.
- Agar staff Roman script maange: **`hi` ka Roman style variant** ("हिन्दी (Roman)")
  banao, teesri language nahi — wahi strings, sirf script.

### 2.2 Per-surface source authority

| Surface                                           | Source language          | Derived                |
| ------------------------------------------------- | ------------------------ | ---------------------- |
| `nav`, `status`, `common` toasts/errors           | Hinglish (authoring)     | hi, en                 |
| `reports/*` (balancesheet, ledger, vyapar-darpan) | हिन्दी                   | en (Hinglish internal) |
| `print-*` invoices                                | English (GST vocabulary) | hi later               |
| WhatsApp templates (11)                           | हिन्दी                   | en later               |
| AI assistant persona                              | Hinglish                 | hi, en — content track |

### 2.3 Content tracks (UI se independent)

`system_info` KV (koi schema change nahi): `language_default`, `wa_language`,
`invoice_language`, `ai_language`.

- UI language badalne se WhatsApp template ya invoice language nahi badalti.
- **Snapshot rule:** WA send aur invoice generation ke waqt language record/message ke
  saath store hoti hai. Reprint/resend original bhasha me — global default se nahi.

### 2.4 Resolution precedence (v2)

```
(optional future) profiles.language
  → system_info.language_default
  → localStorage "vtech_lang" (device)
  → fallback "hi"          ← default owner-confirm karega (open decision #1)
```

Per-device language shop-floor par advantage hai: har phone apni bhasha rakhta hai.
Logged-in user override tab relevant hoga jab ek device shared ho ya multi-staff ho.

---

## 3. Current-state audit (2026-11-01)

### 3.1 Infrastructure

- `package.json`: i18n/intl/locale dependency **zero**.
- `src/lib/i18n/`: **exist nahi karta**; koi `useT` / `vtech_lang` usage nahi.
- `<html lang="en" …>` static — `src/app/layout.tsx:104`; `suppressHydrationWarning`
  already present (theme boot ke liye).
- `THEME_BOOT` localStorage pre-paint pattern `layout.tsx` me already hai — locale isi
  pattern se boot hoga.

### 3.2 String surface (refreshed)

| Metric                       | Count                                                                  |
| ---------------------------- | ---------------------------------------------------------------------- |
| `page.tsx`                   | 121 (100 client-rendered ≈ 83%)                                        |
| `.tsx` files                 | 239                                                                    |
| `print-*` API routes         | 24                                                                     |
| WhatsApp default templates   | 11 (Devanagari)                                                        |
| Prior JSX text-node estimate | ~1,354 literals / ~1,500–2,500 raw strings (dedupe ke baad ~700–1,000) |

> Raw estimate v1 ka hai; Phase 0 ka extraction script actual per-surface numbers dega.
> Uske bina effort commit mat karo.

### 3.3 Four styles present today

| Style       | Example location                                 | Example                                     |
| ----------- | ------------------------------------------------ | ------------------------------------------- |
| English     | `src/lib/status-colors.ts:27`, nav, invoices     | "Pending", "TAX INVOICE"                    |
| Devanagari  | balancesheet, ledger, vyapar-darpan, WA defaults | "व्यापार चिट्ठा", "नमस्ते {client_name} जी" |
| Hinglish    | geofence/camera messages, settings toasts, login | "Aap office ke bahar hain…"                 |
| Mixed gloss | ledger, vyapar-darpan                            | "संपत्ति (Assets)"                          |

Mixed gloss **galat nahi** hai — problem tab hai jab ek hi surface par ek term ke 3 roop
hon ya formatting alag ho.

### 3.4 Formatting hot-spots

- 305 `"en-IN"` + 51 `"en-CA"` literals `src/` me (tests included).
- 32 non-test files me copy-pasted `toLocaleString("en-IN")`.
- `src/lib/dateUtils.ts` me `en-CA`/`en-IN` hardcoded (`:6`, `:23`, `:31`, `:47`).
- Print routes me alag-alag money helpers (`money`, `inr`, `fmtAmount`) — same intent,
  alag implementation.
- Devanagari digits kahin nahi — teeno tracks par Latin digits chal rahe hain (intended).

### 3.5 Dynamic strings (i18n ke liye sabse sensitive)

- `${amount.toLocaleString("en-IN")} payment mil gayi` (`notify.ts`)
- `${x} min pehle` (`messaging.ts`) · `${h}h ${m}m` (`dateUtils.ts`)
- `${n} jobs ka status change karein?` (`jobs/page.tsx`)
- Teeno `{placeholder}` tokens me convert honge: `t("notify.paymentReceived", {amount})`.

### 3.6 Persistence

- `profiles`: `id, full_name, role, avatar_url, updated_at, mechanic_id, email,
date_updated, client_id` — **language column nahi** (v2 me defer).
- `system_info` generic KV — `language_default` aaj hi possible, no schema change.
- Anonymous/marketing pages → `localStorage` `vtech_lang`.

### 3.7 External side effects

- WhatsApp: 11 Devanagari defaults + placeholder registry; resolution canonical →
  override → default.
- Push notify: English titles + Hinglish bodies.
- Print/PDF: largely English HTML + selective Hinglish empty states.
- AI assistant: Hinglish persona.

---

## 4. Architecture (5 layers)

### L0 — Glossary + style guide (documentation, no code)

- `docs/i18n/glossary.md` — owner-signed mapping (~40 terms): Invoice=चालान,
  Ledger=खाता, Client=ग्राहक, Due=बकाया, Stock=स्टॉक, Salary=वेतन, Advance=अग्रिम,
  Commission=कमीशन, Job=कार्य/जॉब, Balance=शेष…
- `docs/i18n/style-guide.md` — tone (Roman verbs + English nouns for Hinglish), ticket
  aur **ke saath** Devanagari+English, amount/date format, status word list.
- Glossary hi AI-translation prompts ka input hoga; AI khud business term choose nahi
  karega — owner review per batch.

### L1 — `src/lib/i18n/` (framework-agnostic core)

```
types.ts     Lang = "hi" | "en"; SourceLang; Dict shape
dict/hi.ts   typed dict, namespaced keys
dict/en.ts   same keys (parity enforced)
t.ts         pure translate(lang, key, vars) — {placeholder} interpolation
context.tsx  LanguageProvider + useT() (client)
server.ts    getLang(cookies) for server pages / print / API
resolve.ts   precedence table (2.4)
```

**Key naming:** `surface.element.intent` — `nav.jobs`, `status.pending`,
`report.bs.title`, `common.save`, `print.invoice.taxId`. English source string ko key
**nahi** banate (copy badalte hi key brittle ho jaati hai).

**Reliability:** `Dict` type + key union → missing translation = `tsc` error; runtime me
missing key = source fallback + `console.warn` (production me silent fallback).

### L2 — `src/lib/format.ts` (Phase 0, zero behaviour change)

- `formatMoney(n, lang)` · `formatDay(d, lang)` · `formatMonth(y, m, lang)` ·
  `formatNumber(n)` · `formatRelative(minutes, lang)`.
- Grouping hamesha `en-IN`, digits Latin, symbol `₹`, timezone IST.
- Saare 24 print routes + notify + reports isi ko import karenge; purane local helpers
  delete honge.

### L3 — Surfaces (one PR per surface)

1. **Pilot:** `/reports/balancesheet` — screen + `print-balancesheet` + CSV headers ek
   hi key set se (abhi rebuild hua hai, strings already Devanagari me hain).
2. `reports/ledger`, `reports/vyapar-darpan`.
3. Nav/status/toasts/common form actions.
4. `print-invoice` pilot (labels: TAX INVOICE / कर चालान, GSTIN, HSN…).

### L4 — Content tracks

WA template editions, invoice label sets, AI persona. Har send/print par language
snapshot (2.3).

---

## 5. Message taxonomy (kya translate hoga, kya nahi)

| Category                                            | Translate?              | Where it lives          |
| --------------------------------------------------- | ----------------------- | ----------------------- |
| UI labels, nav, buttons, tabs, empty states         | Haan                    | L1 dict                 |
| Toasts, validation, user-facing API `error` strings | Haan                    | L1 dict                 |
| Domain terms                                        | Haan, glossary se       | L0 + L1                 |
| Print/invoice/WA/AI content                         | Haan, content track     | L4, snapshot per record |
| Status integers, DB enum values                     | Nahi — label key me map | `status.*`              |
| IDs, routes, URLs, file names                       | Nahi                    | —                       |
| Logs, comments, stack traces, internal errors       | Nahi                    | —                       |

> Aaj API `error` strings seedha UI me dikhte hain (e.g. "from date, to date se baad nahi
> ho sakti"). Ye user-facing category hai — validation messages dict me aayenge.

---

## 6. Phased execution (post-freeze)

### Phase 0 — Prep (docs + zero-behaviour refactor) ~1–2 din

- [ ] Owner decisions confirm (section 11) — default locale, English audience, glossary.
- [ ] `docs/i18n/glossary.md` v1 + `style-guide.md`; owner sign-off.
- [ ] Read-only string inventory script (`scripts/i18n-inventory.mjs`): per-surface
      counts, dynamic literals, duplicate terms. Counts commit karo, estimate refresh.
- [ ] `src/lib/format.ts` extraction + parity tests (`formatMoney` old output == new).
- [ ] Repo me hardcoded `en-IN`/`en-CA` inventory freeze: naye occurrences banned
      (review rule; lint automation optional).
- [ ] `<html lang>` dynamic design note (implementation Phase 1).

**Acceptance:** glossary signed; inventory numbers documented; format refactor ke baad
koi UI diff nahi (screenshot/print compare); tests green.

### Phase 1 — Foundation ~3–4 din

- [ ] `src/lib/i18n/` core + `hi`/`en` dicts (nav, status, common, login errors).
- [ ] Pre-paint bootstrap: `vtech_lang` (THEME_BOOT pattern) + `system_info.language_default`.
- [ ] `LanguageProvider` + `useT()`; server `getLang(cookies)`.
- [ ] Language switcher: settings + sidebar footer + mobile drawer.
- [ ] `<html lang>` locale ke saath; mixed-gloss spans par `lang="hi"`.
- [ ] Tests: dict parity, missing-key fallback, no hydration mismatch (client + 1 server page).

**Acceptance:** nav/status/toasts/login errors 100% switch; reload par no flash;
`tsc`/eslint/prettier/vitest/build green.

### Phase 2 — Pilot surfaces (one PR each) ~2–4 din

- [ ] balancesheet screen + print + CSV headers (shared keys, print snapshot = page).
- [ ] ledger + vyapar-darpan.
- [ ] `print-invoice` pilot route (English/Devanagari label set).
- [ ] Complete-or-original checklist har surface ke liye (desktop/mobile/print).

### Phase 3 — Content tracks ~2–3 din

- [ ] `wa_language`/`invoice_language`/`ai_language` KV + settings UI.
- [ ] WA: per-record language snapshot + English editions of 11 templates (owner review).
- [ ] Invoice: generation-time language snapshot (reprint immutable).

### Phase 4 — Scale ~1–2 din per language

- [ ] Naya language pack = ek dict file + glossary review + content track; koi data model
      change nahi.
- [ ] (Optional) `profiles.language` additive migration — sirf jab multi-staff demand ho
      aur owner DB window de.

**Not in v2:** next-intl/react-i18next, RTL, Devanagari digits default, multi-currency,
locale-prefixed URLs (internal tool me SEO need nahi), machine-translated commits.

---

## 7. Guardrails & CI

- **Dict parity test:** `Object.keys(hi).sort()` == `Object.keys(en).sort()`.
- **Typed keys:** key union + `satisfies Dict` → missing translation compile error.
- **No blank UI:** missing key → source text + dev-only warning (tested).
- **Complete-or-original checklist** per surface: labels, placeholders, titles, aria,
  empty states, toasts, validation, print, CSV.
- **Single formatter:** `format.ts` ke bahar naya `toLocaleString("en-IN")` / `₹` manual
  concat code review me reject.
- **No translation of internals:** logger/comments/DB values untouched.
- **QA per surface:** desktop + mobile + print/PDF screenshot compare (hi vs en).

---

## 8. Formatting policy

| Item          | Rule                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| Currency      | `₹` + `en-IN` grouping, 0 decimals UI me, print me bhi same                  |
| Digits        | Latin `0-9` always (Devanagari digits optional setting = deferred)           |
| Date display  | `dd MMM yyyy`, month names locale se (`Intl`), IST fixed                     |
| Relative time | `formatRelative(minutes, lang)` — `hi` me "5 मिनट पहले", `en` me "5 min ago" |
| Negative      | `−₹1,234` (minus prefix), zero UI me `—`, print me `—`                       |
| Timezone      | Sab `Asia/Kolkata`; koi locale-based TZ switch nahi                          |

---

## 9. Test matrix

| Case                                                        | Expectation                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| Staff `hi` select → nav/toasts/reports Devanagari, no flash | pass                                                       |
| Anonymous page `vtech_lang=en`                              | English, pre-paint correct                                 |
| Precedence                                                  | user (future) > shop KV > device > default                 |
| Print chittha `hi` vs `en`                                  | same numbers, labels switch, A4 fit                        |
| Reprint after shop default change                           | original language (snapshot)                               |
| `₹` + grouping across 3 tracks                              | same digits, correct thousands                             |
| Dynamic strings (`{amount}`, `{n}`, `{min}`)                | rendered, no raw braces                                    |
| Missing key                                                 | source fallback + dev warn, not blank                      |
| Dict parity                                                 | CI fail on mismatch                                        |
| Multi-tab / logout-login                                    | no language leak across users on shared device             |
| Rollback                                                    | surface dict hatao → original rendering (per-surface safe) |

---

## 10. Risks & mitigations

| Risk                                    | Mitigation                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| Khichri UI                              | Complete-or-original + per-surface PRs                                              |
| Scope creep (239 tsx / 24 print)        | Surface list phase-locked; naya surface = naya PR                                   |
| Formatting drift                        | L2 `format.ts` Phase 0 me; review rule                                              |
| Dynamic string breakage                 | `{placeholder}` conversion + tests per dynamic key                                  |
| Hydration mismatch                      | Pre-paint localStorage; server pages cookie; no `suppressHydrationWarning` shortcut |
| AI translation business-term error      | Glossary + owner batch review; AI term khud na chune                                |
| Live DB risk                            | v1 me zero schema change; `profiles.language` deferred                              |
| Season disruption                       | Freeze ke baad hi Phase 0; implementation "bad me"                                  |
| Hinglish drift (agar 3rd locale banaya) | v2 me selectable nahi; Roman variant of `hi`                                        |

---

## 11. Open decisions (owner)

1. **Default locale** naye device par: `hi` (recommended — staff Hindi-first) ya `en`?
2. **English audience:** sirf invoices/print ya export clients ke liye UI bhi?
3. **Hinglish option:** staff ko Roman-script choice chahiye ya `hi`/`en` kaafi?
4. **Glossary v1** ke 40 terms owner approve karega (sign-off date).
5. **Devanagari digits:** confirm OFF (recommended).
6. **`profiles.language`:** multi-staff demand aane tak defer — confirm.

---

## 12. Effort estimate (single owner, post-freeze)

| Scope                                                                     | Days                                              |
| ------------------------------------------------------------------------- | ------------------------------------------------- |
| Phase 0 — glossary + inventory + format layer                             | 1–2                                               |
| Phase 1 — foundation                                                      | 3–4                                               |
| Phase 2 — pilot surfaces (balancesheet + ledger/vyapar + 1 invoice print) | 2–4                                               |
| Phase 3 — content tracks (WA/invoice snapshot)                            | 2–3                                               |
| Phase 4 — per extra language pack                                         | 1–2                                               |
| QA loop (prints, mobile, tests)                                           | 2–3                                               |
| **Core total (P0–P3)**                                                    | **~8–14 working days**, spread — consecutive nahi |

> Full framework (Option A) is par alag +6–10 din; tabhi jab 3+ languages ya
> multi-tenant demand aaye.

---

## 13. References

- `src/app/layout.tsx` — `<html lang>` static, THEME_BOOT precedent.
- `src/lib/status-colors.ts` — English status labels (Phase 1 target).
- `src/lib/dateUtils.ts` — hardcoded `en-CA`/`en-IN`.
- `src/lib/whatsappTemplates.ts` — 11 Devanagari defaults.
- `src/app/reports/balancesheet/page.tsx` + `src/app/api/print-balancesheet/route.ts` —
  Phase 2 pilot (screen + print + CSV).
- `docs/DATA_MIGRATION_NOTES.md` — dual-era data conventions (agar future me
  `profiles.language` aaye to migration note update karna).
