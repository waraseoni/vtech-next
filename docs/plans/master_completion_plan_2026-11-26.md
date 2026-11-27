# Master Completion Plan — baki saare pending/adhure kaam ek hi plan me (26 Nov 2026)

> **Status:** PLAN ONLY. Code/DB changes abhi shuru nahi. **Commit/push nahi karna** —
> jab saara kaam ho jaye aur owner approve kare, tab ek saath final commit/push.
> **Snapshot:** local `main` @ `8ee80d6` (origin/main synced) · release `v1.87.0` ·
> working tree me sirf naye plan docs (service type v2 + ye master plan) untracked.
>
> **Is doc ka kaam:** teen active plan + dono naye evaluation doc + pending tracker ko
> **ek canonical completion plan** me milana. Har task ka ID, source doc, owner aur
> acceptance criterion yahin hai. Purane docs ab **reference** hain; status update isi me hoga.
>
> **Sprint split (27 Nov 2026)** — execution is 4 sprint docs se chalegi; ye master doc
> canonical index/scope rahega:
>
> 1. `sprint_1_foundation_2026-11-27.md` — W0+W1+W2: decisions, security, Service Type
> 2. `sprint_2_brand_claims_2026-11-27.md` — W3: numbering, filters, warranty/claims
> 3. `sprint_3_customer_codequality_2026-11-27.md` — W4+W5: customer gaps, money tests, RSC
> 4. `sprint_4_qa_hardening_release_2026-11-27.md` — W6+FINAL: QA, hardening, single push

---

## 0. Sources merged (duplicate mat karo)

| Source                                                  | Kya liya                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `service_center_data_model_plan_2026-11-21.md` (v2)     | P1 ✅ · P4–P7 pending · R1–R18 · §12 reports integrity · §15 gap register G1–G15 |
| `job_device_identity_ux_plan_2026-11-24.md` (Rev 3a/3b) | P1–P5 code ✅ · P0 sign-offs · P4 note · public S/N · showIdentifier             |
| `service_type_implementation_plan_2026-11-26.md` (v2)   | Service Type ka poora pending scope (0 surfaces)                                 |
| `backup_tooling_fix_plan.md` + `27b8038`                | backup fixes ✅ · live admin-restore confirm pending                             |
| `pending_work_2026-11-20.md` (A–H)                      | user QA, RSC, security, data correctness, planned features                       |
| `project_improvement_plan_2026-11-26.md`                | P0-1…P2-4                                                                        |
| `project_evaluation_2026-11-26.md`                      | risk ranking, W1–W10                                                             |

**Golden rules (kisi phase me tootna nahi):**

1. `item` ka rename/drop/NOT NULL/type change — **nahi**. Naye columns NULLABLE, **no backfill**.
2. `fault` NOT NULL unchanged (service type v2 D2) — `faultless` par `""`.
3. `brands`/`service_types` **deactivate-only**, hard delete nahi; retroactive renumber nahi.
4. Har migration: idempotent + full-schema fold-in + `npm run schema:drift` exit 0.
5. RLS `is_frontend_staff()` + anon deny; browser me service-role **kabhi nahi**.
6. Live DB read-only probes/owner apply — agent DB writes nahi; secrets print nahi.
7. Brand filter default **All (NULL sahit)** + "Untagged (legacy)" bucket; coverage indicator.
8. Field kram har surface par `Item → Brand → Model → Identifier → (summary)`.
9. Report parity: implement se pehle/baad totals same.
10. Commit/push sirf final approval ke baad.

---

## 1. Status snapshot (26 Nov 2026)

### ✅ Done (dobara mat karo)

- Device Identity P1–P5 + Rev 3/3a/3b: migration, settings CRUD, `item_name`, shared components,
  uniform field order, field-aware search, print/public read layers — `9e620ad` pushed;
  `20261122_*` + `20261126_item_name_field.sql` owner applied.
- Gates: tsc · lint · vitest **744 tests** · schema:drift **33 OK** · build **138 pages**.
- Backup lossless fix + server-side admin auth restore + temp-password flow — `27b8038` pushed;
  browser dry-run 200 (2 rows · 1 UUID map · admin protected).
- Master docs: service type finding+v2 plan, master plan (ye doc).

### ⏳ Pending (is master plan ka scope)

| Stream | Adhura kya hai                                                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Service Type UI = **0 surfaces**; P0 sign-offs (mode, brand-required, seed, separator, public S/N, showIdentifier)                       |
| B      | Brand filter/Untagged/coverage, per-brand numbering, claim lifecycle, warranty expiry UI, print branding, legacy tagging, Tier1–2 extras |
| C      | G3 status prompt + G4–G14 adopt/karo ya defer decide karo                                                                                |
| D      | RPC grants + `reset_sequence`, pending migration verify, live restore confirm, types/CI/observability/CSP/backup drill                   |
| E      | JobsBody split, money tests, RSC Phase B/C, perf gate, monolith splits                                                                   |
| F      | Device QA (passkey/login), visual verify (44+ routes), E2E staging, public content, crop editor, bulk-edit live save                     |
| G      | Loans status alignment, pending-jobs non-billing section                                                                                 |

---

## 2. Decision register (owner sign-off — pehle ye, phir code)

| ID      | Decision                      | Final call                                                                                 | Status                 | Blocking              |
| ------- | ----------------------------- | ------------------------------------------------------------------------------------------ | ---------------------- | --------------------- |
| **K1**  | Default `service_center_mode` | `autonomous`                                                                               | ✅ owner 28 Nov        | —                     |
| **K2**  | Brand required?               | autonomous = optional; single/multi = required + General/Unbranded escape                  | ✅ best-practice apply | B2                    |
| **K3**  | Final service type seed list  | canonical `Repair`; `Repair Service` alias default bhi                                     | ✅ owner 28 Nov        | —                     |
| **K4**  | Separator `·`                 | `·` print/SMS-safe                                                                         | ✅ best-practice apply | B4                    |
| **K5**  | Public tracking me S/N        | `showIdentifier=false`; public variant me S/N hidden                                       | ✅ best-practice apply | done                  |
| **K6**  | `showIdentifier` variant      | sirf public; internal hamesha visible                                                      | ✅ best-practice apply | done                  |
| **K7**  | Service type D1–D8            | `expects_fault`; `fault` NOT NULL unchanged                                                | ✅ owner applied       | restore smoke         |
| **K8**  | Numbering (Vikalp B)          | global `job_id` untouched + additive `brand_job_no`; prefix counter → `brands.code` → `BR` | ✅ best-practice apply | owner migration apply |
| **K9**  | Claim lifecycle               | `warranty_claim_status` + CSV; nayi table nahi                                             | ✅ best-practice apply | B3                    |
| **K10** | RPC lockdown                  | `reset_sequence` service_role-only; staff RPC guards                                       | ✅ DB + UI verified    | portal + backup reset |
| **K11** | Generated DB types            | haan — one-time diff + CI gate                                                             | ✅ best-practice apply | D6                    |
| **K12** | JobsBody split                | tab-based, behaviour zero                                                                  | ✅ best-practice apply | E1                    |
| **K13** | G4–G14 adopt list             | G4–G10 adopt; G11–G14 defer; G15 blocked                                                   | ✅ best-practice apply | C                     |
| **K14** | PR flow / CSP timing          | second reviewer mandatory; CSP enforce 14 din clean observation ke baad                    | ✅ policy apply        | named reviewer owner  |
| **K15** | Final commit strategy         | sab waves green → ek batch push; version bump alag approval                                | ✅ agreed              | FINAL                 |

---

## 3. Stream A — Service Center core completion (Device Identity + Service Type)

> Source: service type v2 §4 + device identity plan status table. Owner milti hi A1 se shuru.

- [~] **A0 — Decisions K1–K7** sign-off pending; stale status headers **sync ho gaye**
  (27 Nov: `service_center_data_model_plan`, `job_device_identity_ux_plan`, `pending_work`).
- [~] **A1 — Migration file tayyar** (`20261126_service_type_expects_fault.sql`):
  `ALTER TABLE service_types ADD COLUMN IF NOT EXISTS expects_fault boolean;` + 2 seed rows
  (`New Installation`, `PDI / Delivery` → false) + full-schema fold-in + drift **34 OK**.
  **`transaction_list.fault` par koi change nahi.** **Owner ne 27 Nov ko live apply kar diya.**
- [x] **A2 — Shared logic:** `src/lib/serviceType.ts` (`expectsFault`, `defaultServiceTypeId`,
      label helpers, `serviceTypeName`); `jobFormSchema` me `service_type_id` + UI-only
      `fault_required` + `superRefine` error path `["fault"]`; `emptyJobForm` defaults. Tests ✓.
- [x] **A3 — Seed fix (critical):** `jobFormQueries.ts` me `expects_fault`, `is_active` add;
      `.eq("is_active", true)` hata diya — deactivated type wale purane job ka edit type khaali na ho.
- [x] **A4 — Write surfaces (5):** `jobs/new`, `jobs/[id]/edit`, `jobs/bulk`,
      `jobs/bulk-edit` (legacy tagging bhi), `JobsBody` quick-create. Fault label/requiredness dynamic;
      type badalne par fault text **preserve**; payload `fault: values.fault.trim()` (`""` allowed).
      `jobs/old` ×2 defer (K7) — NULL = legacy.
- [x] **A5 — Read surfaces:** `jobViewQueries.ts` me `service_type_id` + naam/requiredness;
      view chip + dynamic Fault label; print/WA; `JobPreviewPanel` chip; public print-job-status
      (sirf full view me).
- [x] **A6 — Settings:** `/settings/service-center` Service Types modal me
      "Fault required hai?" checkbox (`expects_fault`), save payload; deactivate-only unchanged.
- [~] **A7 — Tests + gates:** `serviceType.test.ts`, schema conditional-fault tests,
  `bulkJobValidation.test.ts` ✓; tsc/eslint/vitest **75 files / 765 tests**/drift 34 OK/build
  138 pages ✓; restore smoke (`expects_fault` round-trip) owner approval par baaki.
- [ ] **A8 — Legacy coverage:** bulk-edit se purane NULL `service_type_id`/`brand_id` jobs tag;
      coverage indicator (Stream B3) ke saath report.

**Acceptance:** New Installation job bina fake fault ke save hota hai, label "Work Description (optional)";
Repair par fault ab bhi mandatory; deactivated type ka purana job edit me sahi dikhta hai.

---

## 4. Stream B — Brand/report/multi-brand (parent plan P4–P5 + Tier1–2)

- [~] **B1 — Per-brand numbering (Vikalp B, K8):** additive `brand_job_no`, atomic counter RPC,
  partial unique index (`WHERE brand_id IS NOT NULL`), display `KMK#001 (Ref 28101)`.
  **Global `job_id`/counter/index kabhi nahi chhue.** Migration `20261128_brand_job_no.sql`
  prepared + full-schema fold-in; **owner ne apply + verify kiya** (column YES/text, partial
  unique index, `anon_ok=false`, `staff_ok=true`). UI wired: `claimBrandJobNo()` on all create
  paths (new / edit-create / quick / bulk / legacy), edit preserves original number, composite
  reference in jobs list, job view, public tracker. Print/WA/report parity next.
- [ ] **B2 — Brand filter + switcher + coverage:** `jobListQueries.ts` ek hi source (RSC + client);
      dashboard, pending-jobs, reports; default **All (NULL sahit)** + "Untagged (legacy)" chip;
      coverage indicator `Brand-tagged: X / Y (Z%) · Untagged: …`; `get_jobs_stats()` RPC drift check.
- [ ] **B3 — Warranty + claims (K9):** `warranty_until` delivery par compute + view badge;
      `warranty_claim_status` update UI (`submitted→approved→rejected→paid`, paid par amount);
      `warranty_claim_no` register + CSV export (naya `api/export-brand-claims`).
- [ ] **B4 — Print branding:** authorized header + logo + serial prominent + composite number
      (B1 ke baad); A4 print preview QA.
- [ ] **B5 — Intake accountability (Tier1 #3/#4):** intake contents/condition checklist + photo
      (existing crop/upload reuse), QC pass + handover signoff — job view me chhota card.
- [ ] **B6 — Device history by serial (G9) + repeat revisit (G10):** `serial_no` se purane jobs;
      same device + same complaint dobara aaye to warranty me warning.
- [ ] **B7 — Tier2 (P7):** `brand_service_rates` (rate card), `mechanic_brand_map` (soft suggestion),
      genuine vs local parts ledger. Brand-wise commission.
- [ ] **B8 — Legacy bulk-tag tool:** A8 me service type ho gaya; brand tagging bhi bulk-edit se
      (alag tool mat banao); coverage % report.
- [ ] **B9 — Report parity gate:** har filter/warranty change ke baad §12.5 snapshot compare.

**Owner action:** B1/B3 ke migrations read-only sim ke baad apply; RPC changes drift fold-in.

---

## 5. Stream C — Customer/compliance gaps (G3–G15)

> K13 decide hone ke baad: G4–G10 adopt, G11–G14 defer, G15 blocked (SMTP owner approval).

- [ ] **C1 — G3 status WhatsApp prompt:** status badalte par "Bhejein?" modal + ek tap `wa.me`
      (`jobs/[id]/view`, `daily-done`); 5 templates already hain. Full automation browser se impossible —
      Business API alag project.
- [ ] **C2 — G4 CSAT:** delivery ke baad public feedback link → `job_feedback` table + RLS;
      technician performance view me simple rating.
- [ ] **C3 — G5 GST/HSN summary CSV:** `service_list.hsn` + `product_list.hsn` se monthly GSTR summary.
- [ ] **C4 — G6 part warranty:** `transaction_products.warranty_until` + claim me part-wise row.
- [ ] **C5 — G7 appointments/queue:** `appointments` (client, slot, type) + counter turn display.
- [ ] **C6 — G8 dead stock:** N din zero-movement inventory report.
- [ ] **C7 — G12 pickup/drop:** `pickup_slot` + delivery-type field on job.
- [ ] **C8 — G11/G13/G14/G15** ko deferred/blocked register me openly mark karo (decision, gap nahi).

---

## 6. Stream D — Security, DB, infra (highest risk pehle)

- [~] **D1 — RPC grants hardening (P0-1 / K10):** migration file ab
  `20261127_rpc_grants_hardening.sql` — Layer 1 anon/public REVOKE + authenticated/service_role
  GRANT; Layer 1b trigger functions; Layer 2 me 9 staff RPCs par `is_frontend_staff()` ya
  service_role guard (body same); `NOTIFY pgrst` + verify block; full-schema fold-in + drift **35 OK**.
  **`reset_sequence(text)` sirf service_role** — backup page anon RPC hataya gaya; naya admin-only
  `/api/admin/reset-sequence` route + allowlist (`src/lib/resetSequence.ts`, tests ✓).
  **Owner ne 27 Nov ko standalone + full-schema dono apply kiye — success** (42883/42804 fix ke baad).
  **DB verification ✅:** anon REST 7/7 401 · `reset_sequence` anon 401 · matrix `anon_ok=false` 9/9 ·
  client-role guard proof `42501` (RAISE line 12). Staff UI smoke **final ✅**: dashboard/clients/jobs
  - 3 inventory reports + public job-status green; SQL→plpgsql se mile **42702 OUT-var ambiguity** aur
    **42804 integer≠bigint** dono fix ho gaye (`#variable_conflict use_column` + 10 explicit casts),
    owner ne final patched migration re-apply kiya → `get_inventory_stock` HTTP **200**, koi 400/42501
    nahi. Baaki: portal smoke (client credentials) + backup sequence reset (owner).
- [~] **D2 — Pending migrations verify (P0-2):** 28 Nov owner probes — `item_name` + index,
  master tables, `get_jobs_stats`, `get_due_stats`/`get_stale_jobs`/`get_dashboard_*` ✅;
  profiles `qual` expected, `with_check` null-safe query baaki; B1 `brand_job_no` apply baaki.
- [ ] **D3 — Live admin auth restore:** asli backup se dry-run → confirm (`confirm: true`),
      custom/fake emails ke liye `setTempPasswords: true`, 218 auth-linked rows clear,
      current admin profile preserve. **Agent DB write nahi** — owner/browser confirm.
- [x] **D4 — P0-3 dashboard silent-zero fallback:** Financial Summary + Due Reminders par
      "Stale / fallback data" / "Data unavailable · zeros" badge; structured `event:"rpc_fallback"`
      (dev `logger.warn`, prod stdout JSON); zeros ko valid data se distinguish.
- [ ] **D5 — P1-3 observability:** fallback + 5xx alerting (D4 events ko feed karo).
- [ ] **D6 — P1-1 generated DB types (K11):** `npm run types:gen` reproducible, clean DB par diff empty.
- [ ] **D7 — P1-2 migration tracking CI:** pending migrations CI me visible, applied list match.
- [ ] **D8 — P1-4 CSP enforce:** 2-week violation observation → enforce; breakage triage.
- [ ] **D9 — P2-1 perf regression gate**, **P2-2 PR flow/reviewer (K14)**, **P2-3 lint cleanup**,
      **P2-4 offsite backup + restore drill** (documented drill + rollback).
- [~] **D10 — P1-6 docs index + archive:** `docs/README.md` ban gaya (topic → canonical → status +
  historical note). Purane 70+ plan docs **archive physically nahi kiye** — unme status update
  nahi, canonical ye master plan hai.
- [x] **D11 — Schema → backup/restore golden rule (27 Nov):** `AGENTS.md` + DATA_MIGRATION_NOTES
      me standing rule; `docs/backup_restore_contract.md` canonical (60 tables/512 migration columns,
      10 surfaces); `npm run backup:contract` + CI gate; `npm run verify:data`. Purana backup me na hone
      wale naye tables ab preserve (delete nahi); count mismatch error toast. Baaki legacy gaps
      (schema snapshot, converter bool maps, CLI alphabetical order, grants backup) recorded.
      Roadmap: `plans/backup_restore_readiness_plan_2026-11-27.md` (B1–B20, owner decisions + acceptance).

---

## 7. Stream E — Code quality / perf / money correctness

- [ ] **E1 — P0-4 `JobsBody.tsx` split (K12):** tab-based modules, top-level <300 LOC,
      naya module <600; behaviour zero; `useJobList` hook consolidation; render smoke + all gates.
- [x] **E2 — P0-5 money-logic integration tests:** `money-logic.integration.test.ts` me **15 golden
      assertions** (dual-era `client_name` string + numeric `client_id`, payment+discount,
      active-loan-only repayment, Done-job red proof, dueLabel, balance-sheet identity, cash-flow `asOn`,
      previousPeriod). Ledger running balance ka coverage `client-due.test.ts` + balance-sheet tests se
      milta hai; naya file poora pipeline ek hi fixture se chalata hai.
- [ ] **E3 — RSC Phase B1 visual verify** (already committed `4e5cf66`): filters/month nav/expand/CSV.
- [ ] **E4 — RSC Phase B (3 reports):** `/reports/client-payment`, `daily-sales`, `daily-service`.
- [ ] **E5 — RSC Phase C (5 low-traffic lists):** `/services`, `/lenders`, `/client-loans`,
      `/clients-admin`, `/seller`.
- [ ] **E6 — Conditional perf:** `/clients` virtual list (pehle TBT measure), streaming polish,
      `JobsBody` virtualization E1 ke baad measure karke.
- [ ] **E7 — P1-5 baaki monolith splits**, **E3 optional React Query/RHF rollout** (owner decision),
      **TS7 upgrade** blocked upstream (peer `<6.1`) — wait.

---

## 8. Stream F — User/owner QA (code ready, verify baaki)

- [ ] **F1 — Passkey device QA:** Windows Hello · Android fingerprint · iOS Face ID · password
      regression · lost-device revoke · anon RLS probe; HTTPS + stable rpID note; phir release tag.
- [ ] **F2 — Login UX real-device QA:** fingerprint button, mobile keyboard, OTP resend countdown.
- [ ] **F3 — Server-first visual verify:** 44 authenticated routes, first paint (no loader flash),
      non-default filters, `/jobs/old` technician panel.
- [ ] **F4 — Clients server-first verify:** `/clients/[id]/view`, add-payment/give-loan/collect-emi,
      ledger default, legacy redirect.
- [ ] **F5 — Estimate builder QA:** desktop/mobile print popup, draft restore, WhatsApp share.
- [ ] **F6 — Balance Sheet QA:** desktop/mobile, as-on date, drill-down, tabs, CSV, A4 chittha.
- [ ] **F7 — Bulk-edit live save:** ticked rows "Target Client" follow + confirm + save on device.
- [ ] **F8 — E2E staging:** `workflow_dispatch` green with staging secrets → `push: main` enable;
      write specs **sirf staging** par.
- [ ] **F9 — Public site content:** owner photos + Google review link; Settings → Website save +
      hard refresh (7 tabs).
- [ ] **F10 — Crop editor device matrix:** parts photos, settings, 6 pre-existing images, phone
      edge-handle touch workaround.
- [ ] **F11 — Browser smoke (har wave ke baad):** `/jobs/new`, `/jobs/[id]/edit/view`, bulk,
      bulk-edit, navbar search, print preview, mobile viewport — console errors 0.

---

## 9. Stream G — Data correctness (chhote par asli)

- [ ] **G1 — Loans status alignment (D1):** ledger `client_loans` sab loans count karta hai,
      canonical due sirf `status=1` + repayments — mismatch dikhe to align (low priority).
- [ ] **G2 — Pending-jobs non-billing section (D2):** optional UI grouping (rows history,
      totals delivered-only — behaviour badalna nahi).

---

## 10. Execution waves (dependency order)

| Wave                                     | Kaam                                                                                                                                                        | Gate                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **W0 — Decide**                          | K1–K15 sign-off; stale doc headers sync; D2 read-only probes                                                                                                | Decision register complete                                       |
| **W1 — Security + DB**                   | D1, D3, D4; A1 migration file (owner apply); P0-2 results                                                                                                   | anon 401 probe, staff regression, drift 34 OK, 218 rows resolved |
| **W2 — Service Type + sign-off closure** | A2–A7, K5 public variant; A8 tagging shuru                                                                                                                  | conditional-fault tests, restore smoke, browser smoke            |
| **W3 — Brand + reports**                 | B1–B9 (numbering → filters → claims → print → Tier1/2)                                                                                                      | report parity, A4 print QA, drift green                          |
| **W4 — Customer gaps**                   | C1–C8 (K13 ke anusaar)                                                                                                                                      | public forms/CSV smoke                                           |
| **W5 — Code + money**                    | E1–E7, G1–G2                                                                                                                                                | 12–15 money assertions, LOC targets, all gates                   |
| **W6 — QA + docs**                       | F1–F11, D5–D10                                                                                                                                              | device matrix, staging E2E green, docs index live                |
| **FINAL**                                | Sab gates ek saath: tsc · lint · vitest · drift · build · smoke · parity · owner approval → **ek batch commit + push** (K15), version bump alag approval se | clean tree, main synced                                          |

> Waves parallel ho sakte hain (jaise W1 owner DB window + W2 code), par **har wave ka gate**
> cross-wave chhodne se pehle green hona chahiye. Koi DB write agent nahi karta.

---

## 11. Expert advice

1. **Pehle K1–K15 decide karo, code nahi** — saare rework ka source yahi hai (service type,
   numbering, public S/N, CSP, reviewer sab owner decisions). Ek 30-min decision sitting baaki
   kaam 2× tez hogi.
2. **Security ek hi window me** (D1+D2+D3): anon RPC hole, `reset_sequence`, auth restore aur
   migration verify alag-alag review me gire to 4 baar same proof dobara banana padega.
3. **Service Type me `fault` nullable mat karo** (v2 correction) — yahi sabse bada blast-radius
   bachat hai. Label + requiredness se asli problem hal hoti hai.
4. **Numbering sabse last me jhootho** (W3 me B1 pehle lekin core filters se pehle nahi) — global
   `job_id` chhune ki koshish bhi mat karo; additive column hi safe hai.
5. **Money tests ko "nice to have" mat samjho** (E2) — finance core professional-grade hai par
   tests patle hain; ek silent formula galti poora trust tod deti hai.
6. **QA ko code ka hissa samjho** (F stream) — passkey/login/dashboard ke 6 item "code done"
   hain par device par verify nahi; release tag tabhi lagao jab F1/F2 green.
7. **G4–G14 ko "pending" me mat chhodo** — ya adopt karo (C1–C7) ya K13 me **deferred** mark karo.
   Khula gap register hi sabse zyada confusiondeti hai.
8. **Ek final commit** — tumne kaha "sab hone ke bad karenge": isi ko follow karo; beech-mein
   publish mat karo. Migrations + docs + code alag commits ho sakte hain, push ek hi baar.
9. **Docs sprawl abhi hi control karo** (D10) — 70+ plan files hain; is master plan ko single
   source banao, baaki archive. Naye aadmi ko 5 min me sahi doc milna chahiye.

---

## 12. Explicit out-of-scope (decision hai, gap nahi)

- Multi-tenant data isolation (alag project).
- AMC contracts (G11) — demand aaye tab.
- SMS/email delivery (G15) — SMTP owner approval tak blocked.
- Tool/asset tracking (G13), technician certs (G14) — chhote center ke liye optional.
- WhatsApp Business API automation — browser se possible nahi; 1-tap prompt hi Phase 1.
- TS7 upgrade — upstream peer fix ka wait.
- `fault` NOT NULL change, `item` rewrite, retroactive renumber — **bilkul nahi**.

---

## 13. Master checklist (quick)

- [ ] K1–K15 signed off
- [ ] A0–A8 · B1–B9 · C1–C8 · D1–D10 · E1–E7 · F1–F11 · G1–G2
- [ ] Har wave gates green + report parity + owner probes
- [ ] Final batch commit + push (K15) — **abhi nahi**
