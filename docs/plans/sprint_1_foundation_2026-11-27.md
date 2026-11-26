# Sprint 1 — Foundation, Security & Service Type (27 Nov 2026)

> **Part of:** `master_completion_plan_2026-11-26.md` (W0 + W1 + W2).
> **Status:** IN PROGRESS · A1/A2/A4–A7 + D1/D4/E2 code done (uncommitted) ·
> D1 apply/D2/D3/A8 owner baaki · commit/push nahi (final sprint tak). **Effort:** ~8–10 working days.
> **Goal:** owner decisions lock + sabse bada security hole band + Service Type ka data aana shuru.

---

## 1. Scope (master IDs)

| ID | Kaam | Owner? |
|---|---|---|
| K1–K7, K10, K15 | Decision register sign-off (30-min sitting) | ✅ owner |
| D1 | RPC grants hardening + `reset_sequence` service_role-only + dev probe | migration owner apply |
| D2 | Pending migrations read-only verify (profile RLS, item_name, masters, RPCs) | ✅ owner/apply |
| D3 | Live admin auth restore — asli backup se dry-run → confirm + temp passwords | ✅ browser confirm |
| D4 | Dashboard silent-zero fallback marker + `rpc_fallback` log | code |
| A0 | Stale doc headers sync (Rev 3 ab committed hai) | code (docs) |
| A1 | `expects_fault` migration file + full-schema fold-in + drift 34 OK | file code; apply owner |
| A2–A7 | `serviceType.ts`, schema, seed fix, 5 write surfaces, read surfaces, settings, tests | code |
| A8 | Purane NULL jobs ko bulk-edit se tag (tool code; run owner) | code + owner run |

**Out of scope:** numbering, brand filters, claims, G4–G15, RSC, big refactors — Sprint 2/3/4.

---

## 2. Aaj (27 Nov) — bina kisi approval/DB-write ke jo kar sakte hain

1. [x] **Decision sheet ready** — `docs/plans/owner_decision_sheet_2026-11-27.md` (ek page,
   K1–K15 + recommendation + status + kya block hai). K7/K15 effectively accepted; baaki owner
   sign-off pending. Master §2 canonical rahta hai.
2. [x] **Stale docs sync** — `service_center_data_model_plan`, `job_device_identity_ux_plan`,
   `pending_work` me "Rev 3 WIP/commit baaki" ko actual state ("committed `9e620ad`, pushed")
   se badla gaya.
3. [x] **A2 base code** (pure, DB-independent):
   - `src/lib/serviceType.ts` + test (`expectsFault`, `defaultServiceTypeId`, labels,
     `serviceTypeName`)
   - `src/lib/validation/schemas/job.ts`: `service_type_id`, UI-only `fault_required`,
     `superRefine` error path `["fault"]`; `emptyJobForm` defaults + naye test cases
   - `jobFormQueries.ts`: `JobFormServiceType` me `expects_fault`/`is_active`, select update,
     **`.eq("is_active", true)` hata diya** (deactivated type ka edit-safe)
4. [x] **A1 migration file + apply**: `20261126_service_type_expects_fault.sql` +
   full-schema fold-in + `npm run schema:drift` → **34 OK**.
   **Owner ne live apply kar diya** — `expects_fault` ab DB me hai;
   `transaction_list.fault` NOT NULL waisa hi. UI sab surfaces par wired (neeche 4b–4d).
4b. [x] **A4 write surfaces (5)**: `jobs/new` + `jobs/[id]/edit` (dynamic Fault label/gate +
   payload me `service_type_id`), `jobs/bulk` (global default + per-row override, pure
   `bulkJobValidation.ts` validation aur save-filter ek hi source), `jobs/bulk-edit` (legacy
   tagging column), `JobsBody` quick-create (compact select + Repair default). Fault text type
   badalne par preserve; faultless type par `fault: ""` (column NOT NULL unchanged).
4c. [x] **A5 read surfaces**: `jobViewQueries` me `service_type_id` + naam/requiredness same
   wave me; view chip + dynamic label; print + WA `service_type` var; `JobPreviewPanel` chip;
   public print-job-status me optional row (sirf full view me).
4d. [x] **A6 settings**: Service Types modal me "Fault required hai?" checkbox — checked →
   `NULL` (legacy default), unchecked → `false`; table me Required/Optional badge;
   deactivate-only policy unchanged.
5. [x] **D1 migration file + apply** `20261127_rpc_grants_hardening.sql` (owner ne 27 Nov ko
   standalone + full-schema dono chalaye — **success**):
   Layer 1 anon/public REVOKE + authenticated/service_role GRANT; Layer 1b trigger functions
   direct grant hataya; Layer 2 me 9 staff RPCs par `is_frontend_staff()` ya service_role guard
   (body same, `create or replace`); `NOTIFY pgrst` + verify block; full-schema fold-in.
   **`reset_sequence` ab service_role-only** — browser anon RPC hataya gaya, naya
   `/api/admin/reset-sequence` admin-only route service-role se RPC chalata hai + table allowlist
   (`src/lib/resetSequence.ts`). **DB verify ✅** — anon REST 7/7 401, `reset_sequence` 401,
   owner matrix 9/9 `anon_ok=false`, client-role GUC guard proof `42501 at RAISE line 12`.
   Staff UI smoke **final ✅**: dashboard/clients/jobs + 3 inventory reports + public job-status
   green; 42702 ambiguity + 42804 type mismatch dono fix (use_column + explicit casts), owner ne
   final patched migration re-apply kiya → `get_inventory_stock` 200, koi 400/42501 nahi.
   Portal smoke + backup sequence reset baaki.
6. [x] **D4 code** — dashboard Financial Summary + Due Reminders par DataFreshnessBadge
   ("Stale / fallback data" / "Data unavailable · zeros"); structured `event:"rpc_fallback"` dev me
   `logger.warn`, prod me stdout JSON (D5 alerting isi ko feed karega — `logger.warn` prod me no-op tha).
7. [x] **E2 money tests** — `src/lib/money-logic.integration.test.ts` me **15 golden assertions**:
   dual-era `client_name` string + numeric `client_id`, payment+discount, active-loan-only repayment,
   Done-job red proof, dueLabel, balance-sheet identity, cash-flow `asOn` cut-off, previousPeriod.
8. [x] **D11 golden rule** — schema change ke saath backup/restore update bina bole: `AGENTS.md` +
   DATA_MIGRATION_NOTES, `docs/backup_restore_contract.md`, `npm run backup:contract` CI gate,
   old-backup me na hone wale tables preserve, count mismatch → error toast.
   Readiness roadmap: `plans/backup_restore_readiness_plan_2026-11-27.md` (B1–B20 pending).

> Inme se 1–8 sab **code/docs** hain — koi DB write, koi secret, koi commit nahi.
>
> **Aaj ke gates (D1/D4/E2/D11 ke baad):** `tsc --noEmit` ✓ · `eslint` (touched) ✓ ·
> `vitest run` **77 files / 783 tests** ✓ · `verify:data` (schema:drift 35 OK +
> backup:contract 60 tables/512 columns) ✓ · `next build` **139 pages** ✓ ·
> touched files prettier ✓. Commit/push **nahi**.

---

## 3. Owner gates (code ke baad, ek hi window me)

- [ ] K1–K7, K10, K15 decisions confirm
- [ ] D1 migration dev/staging par pehle → anon 401/403 probe + staff regression → live apply
- [ ] D2 probes: missing migrations apply (item_name, master tables, `get_jobs_stats`, RPC guards)
- [x] A1 migration apply (owner) → `schema:drift` 34 OK ✓; restore smoke (`expects_fault` round-trip) baaki
- [ ] D3 asli backup se browser dry-run → confirm checkbox → `setTempPasswords: true`;
      218 auth-linked rows clear, admin profile protected
- [ ] A8 bulk-edit se legacy tagging run (coverage snapshot pehle/ baad)

---

## 4. DoD / gates

`npx tsc --noEmit` · `npm run lint` · `npx vitest run` · `npm run schema:drift` ·
`npm run build` · touched-files prettier · browser smoke:
`/jobs/new`, `/jobs/[id]/edit`, `/jobs/bulk`, `/jobs/bulk-edit`, `/settings/service-center`,
navbar search — console errors 0.

**Acceptance:** New Installation job bina fake fault ke save; Repair par fault mandatory;
deactivated type ka purana job edit me sahi; anon RPC access 0; 218 rows resolved.

**Rollback:** UI files revert; migrations khali columns chhod deti hain (kisi existing row ko effect nahi).
