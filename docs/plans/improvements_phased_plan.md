# V-Tech Frontend — Phased Improvements Plan (29 Aug 2026)

*Live-DB verified + docs review ke baad. Is plan ka har item FREE hai (koi paid
service nahi). Priority order me. "Iske bagair bhi chalega?" footnote har phase me.*

**How to read:** har phase me `VERIFIED` = live/actual find, `IMPACT` = ROI,
`WORTH-IT` = kya is ke bina bhi app chalega.

---

## 0. Current state (is session me live verify kiya)

| Check | Result |
|---|---|
| Live tables (OpenAPI spec se) | **40 tables**, exact columns+types captured |
| Tests | **101/101 green** |
| ESLint | **0 errors / 0 warnings** |
| tsc / build | clean |
| Working tree | clean (koi uncommitted nahi) |
| Server-component migration | **already 60% done** (clients, mechanics, expenses, payments, salary migrated — perf_baseline ses 2–5) |
| RLS (7 old tables) | hardened ✅ |
| **RLS (location tables)** | ❌ **OPEN — live confirmed** (see Phase 1) |

---

## 1. 🔴 Phase 1 — SECURITY REGRESSION: location tables anon-open

**VERIFIED (live probe, 29 Aug):**
- `locations` → anon SELECT **47 rows leak** (zone/rack/bin/box/label — inventory layout)
- `location_zones` → anon SELECT 3 rows **+ anon INSERT 201 SUCCESS** (kisi bhi anon par location zone bana sakta hai)
- `location_racks/bins/boxes` → RLS ON par policies `FOR ... USING (true)` bina role gate → anon-read allowed (abhi empty isliye 0 dikha, par open)

**Root cause:** `20260817_product_level_location.sql` + `20260820_location_hierarchy.sql`
ne location tables par policies `CREATE POLICY ... USING (true)` se banayi (koi
`is_frontend_staff()` gate nahi). Ye tables RLS-hardening (`20260910`) ke **baad** bani
hain, isliye hardening ne inhe kabhi cover nahi kiya.

**Fix (free — SQL migration, 1 file):**
- Location tables (5) + `product_locations` par policies drop karke `is_frontend_staff()` /
  `is_admin()` gate ke saath dobara banao (same pattern jo `rls_hardening` old tables
  par use karta hai). Anon ko sirf read-bhi mat do — inventory layout ka financial/ops
  lead hai.
- Verify script: `scripts/verify-rls.cjs` me ye tables add karke re-run.

**STATUS: ✅ READY (29 Aug).** `supabase/migrations/20260912_rls_location_tables.sql`
ban chuka hai (`is_frontend_staff()` gate, `product_locations` pehle se gated). 
`scripts/verify-rls.cjs` (anon 0-rows check) + `scripts/check_rls.sql` (catalog check)
update kiye. App-break audit: saare location CRUD `/api/locations*` service-role +
`requireStaff()` se hote hain → RLS bypass, app safe. **Bas user ko Supabase SQL
Editor me migration chalaana + verify karna hai.**

**WORTH-IT:** ✅ **Yes — must.** Anon write hole = data tampering. Free fix, ~1–2 hr.

---

## 2. 🟠 Phase 2 — Finish Module Selection (already IN PROGRESS)

`docs/plans/module_selection_plan.md` — **Status: IN PROGRESS, 12 steps listed, sab
bana hua nahi**. Ye seller-driven licensing feature sudah plan-hua karta hua hai.

**Kya bacha (verify karke complete karo):** `src/lib/modules.ts`, sidebar filtering,
route guard, seller checkbox UI.

**WORTH-IT:** ✅ Yes — ye business-value (P3) ka pehla item hai aur plan 90% ready.
Bina iske app chalega, par yahan se commercial differentiation aata hai. FREE.

---

## 3. 🟠 Phase 3 — WhatsApp Business API (free path only)

`php_updates_todo.md` me **sirf yaahi pending parity item** hai (baaki sab DONE).

**Important — free rehna mandatory:**
- Query params API (`https://wa.me/<num>?text=...`) **100% free** — pehle se app me hai.
- Official WhatsApp Cloud API: India me per-message **paid** → isse mat lo (reject,
  decision pehle `client_portal_plan.md` me bhi le chuke ho).

**Free wins (creative):**
- **AI auto-reply scheduling** — `completed_tasks.md` P6 ka "Next" item (unread
  inquiries par AI reply batch action). Pehle se `generateWhatsAppReply` + tooling
  ready. Isse P6 close hota hai.
- wa.me deep-links me template text auto-fill (GST due / payment reminder) — free.

**WORTH-IT:** Official API nai chahiye. Sirf AI-auto-reply finish karna = P6 close, FREE.

---

## 4. 🟡 Phase 4 — Remaining bounded SSR page migrations (cookie+RLS)

perf_baseline ses 2–5 ne /clients, /mechanics, /expenses, /payments migrate kar
diyeke (LCP 10s → ~5–6s verify). **Bacha:**
- `/salary` (month-scoped aggregation), `/advance` (date/mechanic filter), `/inquiries`
  (list-shaped) — perf_baseline me khud "remaining bounded candidates" listed.

**Creative angle:** `/jobs` aur `/dashboard` on-demand query karte hain, isliye unhe SSR
fetch-once fit nahi — unke liye **React `cache()` per-request dedup** lagao (same render
me multiple components ek hi query bar-bar na karein). `.next` me abhi `React.cache` 0
usage hai.

**WORTH-IT:** Medium. LCP win already banked hai; ye 3 pages incremental. Dono free.

---

## 5. 🟡 Phase 5 — Test suite expansion (highest-risk business logic)

101 tests hain par **~55k lines / 184 files** ke liye kam. Priority:
- `numberToWords` (Indian system — GST bill words), GST math (CGST/SGST 9/9),
  due-reminder discount calc, loan EMI / salary daily-rate logic — ye sab PHP-parity me
  sabse zyada bug-prone thhe.

**WORTH-IT:** Risk-hedge, free. Kam priority agar budget tight.

---

## 6. 🟢 Phase 6 — Push Notifications (already FREE, just "product-ize" it)

`push_subscriptions` table + `web-push` + VAPID keys **already in deps .env** — 100% free.
Bootstrap ho chuka hai. Isko live feature banao:
- Low-stock alert push, job-status push (mechanic ne mark done Kiya → client), overdue reminder.
- AI alerts widget (`AIAlertsWidget`) ke same signals par push.

**WORTH-IT:** Differentiation. Infrastructure already hai, sirf wiring hai. FREE.

---

## 7. 👀 Creative / Innovative ideas (saari free)

1. **Offline-capable via PWA background sync** (Serwist already hai) — shop me network girne
   par Jobs/Inventory data queue, wifi par sync. (Bada project — sirf jab offline-first pakka.)
2. **Photo-of-fault → AI diagnostic** — client repair request me photo, Gemini description
   -> auto service-suggestion draft. (Gemini already integrated.)
3. **GST invoice PDF watermark + QR verify** — print routes me QR (qrcode dep hai) jo
   customerm ko web validation de.
4. **Dashboard "shop health" score** — recharts already hai; AI alerts ki severity se ek
   single 0–100 health index.

**WORTH-IT:** 3 & 4 quick (1–2 din), 1 & 2 sparse (1–2 hafte).

---

## Priority Order (karo, phir karo)

| # | Item | Cost | Risk if skipped |
|---|------|------|-----------------|
| 1 | 🔴 Location-table RLS fix | ~2 hr | **Anon data tamper + inventory leak (live)** |
| 2 | 🟠 Finish Module Selection (P3) | ~1 day | App chalega, differentiation nahi |
| 3 | 🟠 AI auto-reply (close P6) | ~2–3 hr | P6 adhura rahta hai |
| 4 | 🟡 3 bounded SSR pages + React cache | ~1–2 day | Perf already ok, incremental |
| 5 | 🟡 Business-logic tests | ~2–3 hr | Regression risk on financial parity |
| 6 | 🟢 Push productization | ~1 day | Already-built infra unused |
| 7 | 👀 Creative (GST QR / shop health) | ~1–2 day | Nicety |

---

## Worth-the-update verdict

- **Iske bina dikkat?** Current app **stable, secure-ish, fast, tested** — production
  me chalta rahega. Koi **blocking** issue nahi.
- **Lekin 1 dikkat hai:** location-table RLS hole (Phase 1) abhi live open hai — ye
  chhodna nahi chahiye (free, chhota, par security slash business-data leak).
- Baaki sab: **worth-it incremental / differentiation** — urgent nahi, priority-wise
  karo.

> Kabhi bhi remodel: bas migration chalao RLS wala, phir `verify_rls.cjs` + `npm test`
> + `npm run build` — teenon green = safe-release.
