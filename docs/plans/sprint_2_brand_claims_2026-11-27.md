# Sprint 2 — Brand, Numbering & Warranty/Claims (27 Nov 2026)

> **Part of:** `master_completion_plan_2026-11-26.md` (W3) · **Depends on:** Sprint 1 (A8 tagging, K1/K2).
> **Status:** PLAN ONLY · **Effort:** ~8–9 working days.

---

## 1. Scope (master IDs B1–B9)

| ID | Kaam | Risk / owner |
|---|---|---|
| B1 | Per-brand numbering (Vikalp B): additive `brand_job_no`, atomic counter RPC, partial unique index, `KMK#001 (Ref 28101)` | 🔴 med-high · K8 decision · owner apply |
| B2 | Brand filter + switcher (dashboard/pending-jobs/reports) in `jobListQueries.ts` (single source), default All + Untagged + coverage indicator | 🟠 `get_jobs_stats()` RPC drift |
| B3 | Warranty expiry UI (`warranty_until` already column) + claim lifecycle (`warranty_claim_status` already column) + `warranty_claim_no` register + CSV export | 🟠 K9 decision |
| B4 | Print branding: authorized header + logo + serial + composite number | 🟢 B1 ke baad |
| B5 | Intake contents/condition + QC/handover signoff card | 🟢 reuse upload/crop |
| B6 | Device history by serial (G9) + repeat-revisit warning (G10) | 🟢 A se data milta hai |
| B7 | Tier2: `brand_service_rates`, `mechanic_brand_map` (soft), genuine vs local parts ledger | 🟠 ~2 din |
| B8 | Legacy bulk-tag: brand tagging bhi bulk-edit se (service type Sprint 1 me already) | 🟢 |
| B9 | Report parity snapshot har change ke baad (§12.5) | gate |

**Non-negotiable:** global `job_id`/counter/index **bilkul nahi chhue**; brand filter default
**All (NULL sahit)**; koi retroactive renumber nahi; har naya column NULLABLE + fold-in + drift.

---

## 2. Execution order

1. **K8/K9 sign-off** → B1 numbering migration file + read-only sim → owner apply (alag DB window).
2. **B2 filters** pehle `jobListQueries.ts` me (RSC + client dono wahi padhte hain), phir UI:
   dashboard, pending-jobs, reports; `Untagged (legacy)` bucket + coverage `X / Y (Z%)`.
3. **B3 warranty/claims** — columns already hain; sirf UI + status transitions + export route.
   `paid` par amount capture; claim register list/filter.
4. **B4 → B5 → B6 → B7 → B8** (print, intake QC, device history, Tier2, tagging).
5. **B9 parity** har sub-step ke baad: `count(*)`, `brand_id IS NULL`, `del_status=0`,
   reports ke 3 totals same.

---

## 3. DoD / gates

`tsc` · `lint` · `vitest` · `schema:drift` (B1 ke baad 35 OK) · `build` · A4 print preview QA ·
mobile brand switcher smoke · report parity table compare · **0 console errors**.

**Owner actions:** K8 prefix decision (`brands.prefix` recommend), numbering migration apply,
`get_jobs_stats()` updated RPC apply, claim export route verify.

**Rollback:** numbering + filters UI revert; `brand_job_no`/RPC additive rahe to koi data loss nahi.
