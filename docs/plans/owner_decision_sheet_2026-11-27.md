# Owner decision sheet — K1–K15 (27 Nov 2026)

> **Purpose:** 30-minute sitting me sign-off ke liye ek-page. Canonical source:
> `master_completion_plan_2026-11-26.md` §2. Ye sirf presentation hai — naya decision nahi.
>
> **How to reply:** har pending ID ke saath `OK` ya apna choice likho. `OK` = neeche wali
> recommendation accept. Koi decision na aaye to related stream blocked rahega (code tayyar ho
> sakta hai, apply/merge nahi).

| ID      | Sawaal                        | Final decision                                                                                                                           | Abhi status                            | Aage ka kaam                                                      |
| ------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| **K1**  | Default `service_center_mode` | `autonomous`                                                                                                                             | ✅ owner confirmed (28 Nov)            | code me pehle se default hai                                      |
| **K2**  | Brand required?               | autonomous = optional; single/multi = required + **General / Unbranded** escape                                                          | ✅ agent best-practice apply           | B2 UI/rules                                                       |
| **K3**  | Default Service Type          | canonical seed **Repair**; code me `Repair Service` alias bhi default                                                                    | ✅ owner confirmed (28 Nov)            | alias + test done                                                 |
| **K4**  | Separator                     | `·` (print/SMS-safe)                                                                                                                     | ✅ agent best-practice apply           | B4 print QA                                                       |
| **K5**  | Public tracking me S/N        | `showIdentifier=false`; derived `item` se public variant me S/N hidden                                                                   | ✅ agent best-practice apply           | already in `/job-status`                                          |
| **K6**  | `showIdentifier` variant      | sirf public variant; internal me hamesha dikhe                                                                                           | ✅ agent best-practice apply           | already default `true`                                            |
| **K7**  | Service Type D1–D8            | `expects_fault` column; `fault NOT NULL` unchanged                                                                                       | ✅ owner applied migration             | restore smoke baaki                                               |
| **K8**  | Per-brand numbering           | global `job_id`/counter/index **unchanged**; additive `brand_job_no`; prefix existing `brand_job_counters.prefix` → `brands.code` → `BR` | ✅ applied + verified (`v`, gated)     | stats-RPC search applied (verify pending); print/WA/report parity |
| **K9**  | Claim lifecycle               | existing `warranty_claim_status` + CSV export; nayi `warranty_claims` table **nahi**                                                     | ✅ agent best-practice apply           | B3 UI/export                                                      |
| **K10** | RPC lockdown                  | `reset_sequence` = service_role only; staff RPCs = authenticated + `is_frontend_staff()`/service_role                                    | ✅ DB + UI verified                    | Portal smoke + backup reset                                       |
| **K11** | Generated DB types adopt?     | haan — one-time diff, phir CI gate                                                                                                       | ✅ agent best-practice apply           | D6 script/gate                                                    |
| **K12** | `JobsBody` split              | tab-based modules, behaviour zero                                                                                                        | ✅ agent best-practice apply           | E1 refactor                                                       |
| **K13** | G4–G14 adopt list             | G4–G10 adopt; G11–G14 defer; G15 SMTP owner approval tak blocked                                                                         | ✅ agent best-practice apply           | C stream                                                          |
| **K14** | Reviewer + CSP window         | har PR par second reviewer mandatory; CSP enforce 14 din clean observation ke baad                                                       | ✅ policy apply                        | named reviewer owner baaki                                        |
| **K15** | Final push strategy           | ek batch push (docs/code/migrations alag local commits allowed); version bump alag approval se                                           | ✅ agreed (owner standing instruction) | FINAL                                                             |

## Abhi turant kaam (decision se pehle bhi)

- **D1 apply**: dev/staging → anon probe 401/403 → staff/portal regression → live. File +
  verify query `20261127_rpc_grants_hardening.sql` me hai. Backup page ab admin-only route
  use karta hai, isliye apply ke baad `/backup` par sequence reset test zaroori.
- **D2 probes**: profile RLS (`is not distinct from`), `item_name` + index, master tables,
  `get_jobs_stats` naye columns, dashboard/stale RPCs exist.
- **D3 restore confirm**: 218 auth-linked rows; fake/custom email par link nahi — temporary
  password auto-set; current admin profile preserve. Agent DB write nahi karega.
- **A8 tagging run**: bulk-edit se purane NULL `service_type_id` jobs ko tag karo (coverage
  snapshot pehle/baad).

## Decision ke baad turant shuru

- K1/K2 → B2 brand filter + Untagged bucket + coverage indicator.
- K8 → B1 migration (additive `brand_job_no`, partial unique index, atomic counter) — global
  counter kabhi nahi chhua, retroactive renumber nahi.
- K9 → B3 warranty expiry UI + claim transitions + export.
- K11/K12/K13 → D6 / E1 / customer stream.

**Commit/push:** nahi. Final batch sirf owner ke "ab sab ho gaya" par. Docs-only changes se
version bump nahi.
