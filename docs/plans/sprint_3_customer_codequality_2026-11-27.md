# Sprint 3 — Customer Gaps + Code/Money Quality (27 Nov 2026)

> **Part of:** `master_completion_plan_2026-11-26.md` (W4 + W5) · **Depends on:** Sprint 2.
> **Status:** PLAN ONLY · **Effort:** ~10–12 working days.

---

## 1. Scope (master IDs C1–C8 + E1–E5 + E7 optional)

| ID | Kaam | Decision / effort |
|---|---|---|
| C1 | G3 status-change WhatsApp prompt (ek-tap `wa.me`) in `jobs/[id]/view`, `daily-done` | ~1 din · templates already |
| C2 | G4 CSAT: public feedback link → `job_feedback` (RLS + anon deny) + rating view | ~1 din · K13 |
| C3 | G5 GST/HSN summary CSV (`service_list.hsn` + `product_list.hsn`) | ~1 din |
| C4 | G6 part warranty `transaction_products.warranty_until` + claim row | ~0.5 din |
| C5 | G7 appointments/queue + counter display | ~1.5 din |
| C6 | G8 dead stock / zero-movement report | ~1 din |
| C7 | G12 pickup/drop slot field on job | ~1 din |
| C8 | G11/G13/G14/G15 ko deferred/blocked register me mark (gap nahi, decision) | docs |
| E1 | `JobsBody.tsx` split — tab-based modules, top-level <300 LOC, behaviour zero | 🔴 2–3 din · K12 |
| E2 | Money-logic integration tests — 12–15 golden assertions (due, discount, loan, ledger, balance sheet), dual-era | 1–2 din |
| E3 | RSC B1 visual verify (already committed) | 2h · owner QA |
| E4 | RSC Phase B: `/reports/client-payment`, `daily-sales`, `daily-service` | 7–9h |
| E5 | RSC Phase C: `/services`, `/lenders`, `/client-loans`, `/clients-admin`, `/seller` | 12–15h |
| E7 | Baaki monolith splits / React Query-RHF rollout | optional · owner decision |

**Blocked se nahi:** TS7 upgrade upstream peer fix ka wait — is sprint me nahi.

---

## 2. Execution order

1. **E2 money tests pehle** (silent financial error ka insurance; fast win, DB-free).
2. **E1 JobsBody split** — `useJobList` hook consolidation → tab modules → smoke test.
   Is sprint ka sabse bada regression risk; isliye E4/E5 se pehle.
3. **C1** (customer experience, quick) → C2–C7 (K13 adopt list) → C8 docs.
4. **E3 → E4 → E5** RSC waves; har page ka seed/null fallback parity check.
5. **E7** sirf agar E1/E4/E5 green aur time bache.

---

## 3. DoD / gates

`tsc` · `lint` · `vitest` (money tests + 12–15 assertions, deliberately-wrong test red proof) ·
`build` · LOC targets (`JobsBody` top <300, module <600) · public feedback form smoke ·
CSV downloads open correctly · RSC first-paint no loader flash · **0 console errors**.

**Owner actions:** K12 split approach, K13 G4–G14 adopt/defer list, public feedback link content.
**Rollback:** per-module revert; money tests additive; Koi DB backfill nahi.
