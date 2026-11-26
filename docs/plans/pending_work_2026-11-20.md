# Pending Work — Consolidated Tracker (20 Nov 2026)

> **Purpose:** saare plan files me bikhre hue pending items ek jagah. Har item
> par: status, owner (user action ya code), effort, risk.
> **Rule:** jo DONE ho use `docs/plans/completed_tasks.md` me move karo; yahan
> sirf zinda items rakho.
> **Scan date:** 20 Nov 2026 · repo `vtech-next` @ `8f0bc34` (release 1.82.1).
> **Synced:** 22 Nov 2026 · repo @ `d376164` (release 1.84.1) — B1/E1 committed
> (`4e5cf66`), login OTP/reset + WebView WhatsApp fix shipped, vitest **702/702**,
> naya `service_center_data_model_plan_2026-11-21.md` (v2 — 3 modes, coverage
> audit §15, G1–G3 adopted).
> **Synced:** 26 Nov 2026 · repo @ `9e620ad`/`727a887` (release 1.85.2, tree dirty) —
> E2 service-center **P1–P5 committed + pushed**; `20261122_service_center_fields.sql`
> owner ne apply kiya. Rev 3 (`item_name`) code local WIP; `20261126_item_name_field.sql`
> bhi owner ne apply kiya (read-only probe: 0 non-null rows). Rev 3a field-order fix +
> Rev 3b field-aware search local WIP; updated `get_jobs_stats()` RPC ko owner dobara apply karna hai.

---

## 0. At a glance

| Category                                          | Items | Sabse pehla kaam                                  |
| ------------------------------------------------- | ----: | ------------------------------------------------- |
| A. User action (live DB / device / visual verify) |     8 | Passkey device QA (migration ✅ applied)          |
| B. Code work — perf/RSC                           |     6 | RSC Phase B (3 reports) — Phase A ✅ local done   |
| C. Security debt                                  |     1 | RPC grants hardening (migration likhna)           |
| D. Data correctness                               |     2 | Loans status alignment (low priority)             |
| E. Planned features (not started)                 |     3 | Login UX ✅ local done; multi-brand / RQ decision |

---

## A. User action pending (code ready, verify/apply baaki)

### A1. Passkey / Biometric login (WebAuthn) — 🟠 device QA baaki

- **Status:** code complete (Option B custom WebAuthn), UI live, **migration APPLIED ✅**
  (20 Nov 2026 object-level verify: `user_passkeys` table 10 cols, 2 RLS
  policies, 4 indexes, touch trigger, grants, 1 live row).
- [x] Migration apply: `supabase/migrations/20261018_passkey_login.sql` — **DONE**
      (tracking table absent tha, objects se confirm).
- [ ] Manual device matrix: Windows Hello · Android fingerprint · iOS Face ID ·
      password regression · lost-device/revoke · RLS probe (anon ko 0 rows).
- [ ] Final gates: `tsc` · `eslint` · `vitest` · `build`.
- [ ] Deploy gate: HTTPS + stable rpID note (domain change = passkeys invalid),
      release tag + CHANGELOG.
- **Source:** `docs/TODO.md` §Staff Passkey (Phase 5/6),
  `docs/plans/rsc_implementation_best_plan_2026.md` §SQL migrations.
- **Note:** migration ab applied hai; graceful-off fallback ab sirf safety net
  hai. Device QA ke bina release tag mat lagana.

### A2. Public site DB content — WS-8d/8e optional

- [ ] Owner photos (workshop/team) + Google review link content.
- [ ] Admin se **Settings → Website** save + hard refresh verify (7 tabs).
- **Source:** `docs/plans/public_site_db_content_plan_nov08_2026.md`, `docs/TODO.md`.

### A3. Server-first rollout — authenticated visual verify (44 routes)

- [ ] First paint (no loader flash), non-default filters, `/jobs/old`
      Assign Technician panel.
- **Source:** `docs/plans/staff_server_first_plan_nov03_2026.md`.

### A4. Clients server-first — visual verify

- [ ] `/clients/[id]/view` first paint, action pages (add-payment, give-loan,
      collect-emi), ledger default view, legacy `/clients/[id]` → `/view` redirect.
- **Source:** `docs/plans/clients_server_first_plan_nov02_2026.md`.

### A5. Estimate builder — QA

- [ ] Desktop/mobile print popup, draft restore, WhatsApp share, R1/R2/R3 live.
- **Source:** `docs/plans/estimate_builder_plan_oct31_2026.md` §13.1.

### A6. Balance Sheet "व्यापार चिट्ठा" — QA

- [ ] Desktop/mobile statement, as-on date change, row drill-down,
      क्लाइंट लोन + नकद tabs, CSV, A4 print chittha.
- **Source:** `docs/plans/balancesheet_chittha_ux_plan_oct31_2026.md`.

### A7. Jobs bulk-edit — live save

- [ ] Ticked-rows "Target Client" follow + confirm; live save on device
      (sirf UI verify hua tha).
- **Source:** `docs/TODO.md` (Oct 2026 log).

### A8. E2E / Playwright staging

- [ ] `workflow_dispatch` green with staging secrets → phir
      `push: branches: [main]` enable.
- [ ] Write specs sirf **staging** project par (live DB me 46 test rows bane the —
      `docs/DB_CHANGES_E2E_AUDIT_2026-10-26.md`).
- **Source:** `docs/TODO.md` T4.

### A9. Crop editor — device matrix

- [ ] Remaining matrix: parts photos, settings, pre-existing 6 images,
      phone edge-handle touch (library bug workaround `globals.css` §7).
- **Source:** `docs/TODO.md` (Oct 2026 log).

---

## B. Code work — Perf / RSC (no DB risk)

> **Audit (20 Nov):** `/clients/*` (10 pages) aur `/jobs/*` (11 pages) me
> **sab data-backed pages pehle se RSC-seeded hain** (server page ya server
> layout + `*SeedProvider`). Redirect-only aur `clients/new` form ko chhod kar
> koi RSC gap nahi. Detail: `rsc_implementation_best_plan_2026.md` §1.

### B1. RSC Phase A — `/reports/client-parts-service` seed ✅ DONE (committed `4e5cf66`)

- [x] `src/lib/client-parts-service-data.ts` (neutral query layer) + server
      `page.tsx` + client `ClientPartsServiceBody.tsx` split; 3 reads ek wave.
- [x] Seed-aware `initialData` (key match par hi), graceful `null` fallback.
- [x] Gates: tsc 0 · eslint 0 · prettier OK · vitest green · `next build` ✓.
- [x] Commit/push — `4e5cf66` (21 Nov 2026).
- [ ] **User visual verify** (filters, month nav, expand, CSV) authenticated session me.
- Effort ~2.5 h · risk low (rollback = 3 files revert, koi DB change nahi).
- **Source:** `docs/plans/rsc_implementation_best_plan_2026.md` §5 Phase A.

### B2. RSC Phase B — 3 report pages (client-fetch abhi bhi)

- [ ] `/reports/client-payment`, `/reports/daily-sales`, `/reports/daily-service`.
- Effort ~7-9 h · risk low.
- **Source:** same plan §4 Tier 1 (20 Nov re-verified).

### B3. RSC Phase C — 5 admin/legacy lists

- [ ] `/services`, `/lenders`, `/client-loans`, `/clients-admin`, `/seller`.
- Effort ~12-15 h · risk low · priority low (traffic kam).
- **Source:** same plan §4 Tier 2.

### B4. `/clients` virtual list (react-window) — ⬜ backlog

- Hydration wall ~357 → ~280 ms (estimate). TTFB same.
- 2-3 hafte ka refactor: row expansion, inline edit, mobile cards,
  selection state sab touch honge. Abhi payload 257-262 KB acceptable.
- **Source:** `docs/plans/perf_fastest_plan_2026.md` Phase 3.

### B5. Streaming polish — per-widget Suspense boundaries

- Heavy client widgets already `dynamic({ssr:false})`. Gain chhota
  (total completion par asar nahi). Minor.
- **Source:** `docs/plans/perf_fastest_plan_2026.md` Phase 5.

### B6. `JobsBody` mega-component split + virtualization

- Conditional: pehle TBT measurement. Bina number ke shuru na karo.
- **Source:** `docs/plans/rsc_phase4_plan.md` §P2 follow-up.

> **❌ Not doing (decided):** RSC edge caching (`revalidate`) on authed pages —
> cookie-auth + `force-dynamic` = stale/cross-user leak risk (Phase 4c REJECT).
> Image `sizes` audit — fixed sizes, gain ~0 (Phase 4d DROP).

---

## C. Security debt — RPC grants hardening 🔴 high

- **Problem:** 26/28 functions anon-executable; 8 staff-only definer RPCs
  guard-less; client-role hole documented. `reset_sequence(text)` =
  **CRITICAL** (arbitrary `setval` = DoS).
- [ ] `20261116_rpc_grants_hardening.sql` likho: Layer 1 grants → Layer 1b
      triggers → Layer 2 guards → `NOTIFY pgrst` → verify block. Full-schema
      snapshot me append (schema:drift requirement).
- [ ] Pre-apply simulation **read-only**: client uuid = 42501, staff uuid = data.
- [ ] `has_function_privilege` matrix before/after report.
- [ ] Apply (owner approval) → anon REST 401 proof + staff/portal regression +
      row counts.
- [ ] Gates: tsc/lint/test/build/schema:drift/e2e smoke → commit (docs + migration).
- [ ] Optional: `scripts/check-rpc-grants.mjs` + CI step.
- **Source:** `docs/plans/rpc_grants_hardening_plan.md` §Execution Order.

---

## D. Data correctness — open notes

### D1. Ledger totals vs canonical loans (low priority)

- Ledger `client_loans` ke **saare** loans count karta hai; canonical due sirf
  **active (status = 1)** loans + repayments leta hai.
- Aaj ke data me loan payments sirf 2 rows — mismatch dikhe to align karo.
- **Source:** `docs/plans/ledger_billing_audit_2026.md` §6 item 4.

### D2. Pending jobs statement me alag section

- ✅ Rows me saare transactions dikh rahe hain (history), totals delivered-only.
- [ ] Optional UI: pending jobs ko alag **non-billing** section me group karna.
- **Source:** `docs/plans/ledger_billing_audit_2026.md` §6 item 5.

---

## E. Planned features — not started (owner decision chahiye)

### E1. Login page friendly UX revamp ✅ DONE (committed `4e5cf66`)

- [x] Pill switcher (staff-first), hero passkey card (`passkeyReady` gate),
      negative disclaimers cleanup, welcome chip, admin help link, OTP polish,
      44px touch targets, track-job gradient card.
- [x] Gates: tsc 0 · eslint 0 · prettier OK · vitest green · browser smoke
      (login 200, tab switch OK, console errors 0).
- [x] Commit/push — `4e5cf66` (21 Nov 2026). 8-digit OTP + admin WhatsApp reset
      follow-ups `1979ee8` me gaye.
- [ ] **User visual QA** real device par (fingerprint button, mobile keyboard,
      OTP resend countdown).
- Auth/API/DB logic unchanged; rollback = `login/page.tsx` revert.
- **Source:** `docs/plans/login_page_friendly_ux_plan.md` §6.

### E1b. Login WebView WhatsApp link fix ✅ DONE (uncommitted → 22 Nov push me)

- [x] `src/lib/externalLink.ts` — browser me `window.open(...,_blank,noopener)`,
      Capacitor WebView me `location.assign(url)` (ACTION_VIEW host-mismatch path),
      non-http(s) block; login anchor `e.preventDefault()` + empty-email guard.
- [x] Unit tests (3) + browser smoke (prefilled URL, console errors 0).
- [x] Gates: prettier · tsc 0 · eslint 0 · vitest **702/702**.
- **Source:** `docs/plans/login_page_next_improvements_2026-11-20.md`.

### E2. Multi-brand / service-center data model — 🟢 P1–P5 shipped; Rev 3 WIP

- **Status:** P1–P5 `9e620ad` se pushed; `20261122_service_center_fields.sql` applied.
  Rev 3 (`item_name` + `Item · Brand · Model · Identifier`) local code complete;
  commit/push ke liye **naya explicit approval** chahiye (abhi rok diya gaya hai).
  `20261126_item_name_field.sql` owner ne apply kar diya. Rev 3a (uniform field order)
  + Rev 3b (Item/Brand/Model/Identifier free-text search, brand resolver, RPC drift fix)
  local code complete. **Owner action:** updated `get_jobs_stats()` dobara apply karo.
  Naye env/DB par full-schema run karte samay 2 order/idempotency error mile aur dono
  fix hue: (1) `reset_sequence(text)` 42P13 (purana param `p_table_name`) →
  `DROP FUNCTION IF EXISTS` se fix; (2) `get_jobs_stats()` line ~4730 par
  `42703 column t.item_name does not exist` — function device-identity fold-in
  se pehle ban raha tha → function + grants ko columns/`brands` ke baad move kiya.
  `schema:drift` 33 OK. Owner ne full schema naye DB par run + restore bhi kar diya;
  post-restore read-only search/form smoke green (403 results + stats 403, RPC 200,
  navbar 25 results, console 0). `reset_sequence` anon grant-hole abhi bhi pending
  (alag track). P0 sign-off baaki.
- **Ab wahi plan `service_center_data_model_plan_2026-11-21.md` (v2) me hai:**
  brand/item/model/serial split + service type + **3 modes** (autonomous /
  single-brand / multi-brand) + reports-integrity guarantees (§12) + coverage
  audit (§15, G1–G3 adopted) + risks R1–R18. P0 owner decisions §9 pending
  (default mode, brand required, seed lists, live-apply approval).
- Decision pending: Vikalp B (dual-identity: global `job_id` + brand prefix) = plan ka P4.
- Phase 5/4 (brand-wise dashboard/pending/reports filters) sabse bada kaam.
- **Source:** `docs/plans/service_center_data_model_plan_2026-11-21.md` (primary),
  `docs/plans/multi_brand_service_architecture_plan.md`,
  `docs/plans/multi_brand_job_id_sequencing_plan.md`.
- **🆕 UX companion (24 Nov 2026, Rev 2):** `docs/plans/job_device_identity_ux_plan_2026-11-24.md`
  — Brand/Model ke searchable dropdown + inline "add new" (`JobSpotPicker` pattern),
  **Identifier = optional free text** (unique hota hai, dropdown nahi), field kram
  **Item → Brand → Model → Identifier**, aur item dikhne wali **40+ verify ki gayi
  jagahon** par sahi display contract (`deviceIdentity.ts` + `<DeviceIdentity />`).
  Bulk/bulk-edit me **per-row 4 alag fields** (global override hata diya). `/settings/service-center`
  ka direct sidebar link bhi add hua; `/jobs/new` ka React Compiler `useWatch` TDZ error
  `"use no memo"` se fix. Ye ux plan upper data-model plan ka P2–P5 ko detail karta hai —
  implement shuru karne se pehle dono padho.
- **Rev 2 gates:** prettier · tsc 0 · eslint 0 · vitest **712/712** · schema:drift **32 OK** ·
  build ✓ (137 pages). P1 migration DB me applied aur verified (legacy 2433 rows unchanged).
- **Rev 3 (26 Nov):** naya nullable `item_name`; default label `Item · Brand · Model · Identifier`;
  advanced override opt-in (identifier bill label se chhoot jayega, DB/card me rahega).
  `20261126_item_name_field.sql` + full-schema fold-in; gates green (vitest **713**,
  schema:drift **33 OK**, build ✓ 137 pages), read-only browser smoke ✓ (console 0 errors).
  Read-only REST probe: `item_name` selectable, `with_item_name = 0` — migration applied.
  Rev 3a: saare form surfaces par field kram `Item → Brand → Model → Identifier`, advanced
  toggle + final-label preview niche summary me; browser DOM order verify, console 0 errors.

### E3. React Query completion / RHF rollout

- Bada kaam, user decision pending. React Query foundation + 26 pages already
  converted (Oct 2026). Baaki forms RHF par migrate karna optional.
- **Source:** `docs/TODO.md` T6.

### E4. TS7 upgrade — ⛔ blocked

- `typescript-eslint` peer `<6.1` — upstream fix ka wait.

---

## F. Stale/closed notes (dobara mat karo)

| Item                                                                                                           | Kahan likha tha         | Reality (20 Nov 2026)                                       |
| -------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| RSC "Tier 1 lists no seed" (`/payments`, `/direct-sales`, `/expenses`, `/attendance`, `/messages`, `/clients`) | RSC plan ka pehla draft | ❌ Galat — sab already server-seeded. Plan corrected.       |
| `W7 inventory RSC pending`                                                                                     | `docs/TODO.md`          | ✅ Done — `inventory/page.tsx` server fetch + layout seeds. |
| `W8 React Query data layer`                                                                                    | `docs/TODO.md`          | ✅ Mostly done (Phase A3, 26 pages).                        |
| Ledger Bug #2/#3, pending display, discount split                                                              | ledger audit            | ✅ Done.                                                    |
| Parts-vs-Service report                                                                                        | new feature             | ✅ Done (UI QA baaki nahi).                                 |
| Phase 4c edge caching / 4d image sizes                                                                         | perf plan               | ❌ Permanently rejected/dropped.                            |

---

## G. Suggested order (next 3 sessions)

1. ✅ **B1 (RSC pilot)** — committed `4e5cf66`; visual verify baaki.
2. **C (RPC grants)** — security debt, high value; migration + read-only sim pehle,
   apply owner approval ke baad. (Service-center plan ke P1 ke saath ek window me
   karne ki suggestion hai — §8 of that plan.)
3. **A1 (passkey)** — migration ✅ done; user ke paas ab device QA + HTTPS/rpID
   check (15 min), phir release tag.

**Status (26 Nov):** login OTP/reset + WebView fix + profile RLS push ho chuke
(`0f61d88`). Service-center **P1–P5 push + migration apply ho chuka** (`9e620ad`).
Rev 3 `item_name` code local complete, gates + read-only browser smoke green;
`20261126_item_name_field.sql` owner ne apply kar diya. Agla step: P0 sign-off aur
explicit approval par commit/push (user ne abhi commit rok diya hai).

---

## H. Project-level evaluation (26 Nov 2026)

Poore project ka mulyankan + action plan alag docs me hai; yahan sirf pointer
aur top items (taaki tracker single source rahe):

- **Findings:** `docs/plans/project_evaluation_2026-11-26.md`
  (metrics, strengths, weaknesses, risk ranking, verdict).
- **Plan:** `docs/plans/project_improvement_plan_2026-11-26.md`
  (P0/P1/P2 tasks, effort, acceptance criteria, status tracker).

Top 3 jo yahan se unblock hote hain:

1. **P0-1 RPC grants hardening** - `rpc_grants_hardening_plan.md` ke saath ek hi
   window me (anon-executable definer functions). Highest security risk.
2. **P0-2 Pending migrations verify** - profile RLS, `item_name`, updated
   `get_jobs_stats()`; read-only probes ke baad owner apply.
3. **P0-5 Money-logic integration tests** - ledger/due/balance/EMI formulas par
   fixture-based tests (silent financial errors ka insurance).
