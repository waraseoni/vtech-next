# Docs index — kya canonical hai (27 Nov 2026)

> **Rule:** status sirf canonical docs me update hoti hai. Neeche joh "historical" likha hai wo
> purana plan/reference hai — usme status change mat karo;agar kaam dobara aaye to canonical
> doc se track karo. Purane docs archive karne ka kaam `master_completion_plan` D10 hai.

## ⭐ Start here (canonical)

| Topic | Canonical doc | Status |
|---|---|---|
| **Saara pending kaam / scope / decision register** | `plans/master_completion_plan_2026-11-26.md` | live · 4 sprint me split |
| **Owner decisions (ek-page sign-off sheet)** | `plans/owner_decision_sheet_2026-11-27.md` | K7/K15 accepted, baaki pending |
| S1 — foundation/security/Service Type | `plans/sprint_1_foundation_2026-11-27.md` | code done, D1 DB-verified, UI regression pending |
| S2 — brand/numbering/claims | `plans/sprint_2_brand_claims_2026-11-27.md` | decision-blocked (K8/K9) |
| S3 — customer/code quality | `plans/sprint_3_customer_codequality_2026-11-27.md` | plan |
| S4 — QA/hardening/final push | `plans/sprint_4_qa_hardening_release_2026-11-27.md` | plan |

## Topic → canonical detail

| Topic | Doc |
|---|---|
| Service Type D1–D8 (fault required / faultless types) | `plans/service_type_implementation_plan_2026-11-26.md` |
| Device identity UX (item → brand → model → identifier) | `plans/job_device_identity_ux_plan_2026-11-24.md` |
| Service center data model + gap register G1–G15 | `plans/service_center_data_model_plan_2026-11-21.md` |
| RPC grants / anon deny / `reset_sequence` | `plans/rpc_grants_hardening_plan.md` + `20261127_rpc_grants_hardening.sql` |
| Backup lossless restore / auth restore | `plans/backup_tooling_fix_plan.md` (`27b8038` pushed) |
| Social login / passkey | `plans/passkey_biometric_login_plan.md`, `plans/passkey_sprint_plan.md` |
| RSC conversion (reports + lists) | `plans/rsc_implementation_best_plan_2026.md` |
| Performance baselines | `plans/perf_baseline.md`, `plans/speed_baseline_nov2026.md` |
| Staff geofence / view-only | `plans/staff_geofence_viewonly_plan.md` |
| Customer portal | `plans/client_portal_plan.md` |
| Multi-brand architecture / numbering | `plans/multi_brand_service_architecture_plan.md`, `plans/multi_brand_job_id_sequencing_plan.md` |
| PHP-era data conventions | `DATA_MIGRATION_NOTES.md` (repo root `docs/`) |

## Non-negotiables (har doc/coding se pehle)

1. `item` rename/drop/NOT NULL/type change — nahi. Naye columns NULLABLE, no backfill.
2. `fault NOT NULL` unchanged; faultless type par `fault = ""`.
3. Masters deactivate-only; global `job_id`/counter/index untouched; retroactive renumber nahi.
4. Har migration idempotent + full-schema fold-in + `npm run schema:drift` exit 0.
5. RLS `is_frontend_staff()` + anon deny; browser me service-role **kabhi nahi**.
6. Agent live DB writes nahi; secrets print nahi; commit/push final owner approval par.

## Historical (reference ke liye, status update nahi)

`plans/` me baaki 70+ plan docs (Aug–Nov 2026 ke sprint/audit/one-off plans) apne time ki
snapshot hain. Inka kaam canonical docs me merge ho chuka hai ya deferred list me hai. Naya kaam
`master_completion_plan` me ID le kar shuru karo, yahan nahi.
