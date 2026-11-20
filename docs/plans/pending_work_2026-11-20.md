# Pending Work — Consolidated Tracker (20 Nov 2026)

> **Purpose:** saare plan files me bikhre hue pending items ek jagah. Har item
> par: status, owner (user action ya code), effort, risk.
> **Rule:** jo DONE ho use `docs/plans/completed_tasks.md` me move karo; yahan
> sirf zinda items rakho.
> **Scan date:** 20 Nov 2026 · repo `vtech-next` @ `8f0bc34` (release 1.82.1).

---

## 0. At a glance

| Category                                          | Items | Sabse pehla kaam                                     |
| ------------------------------------------------- | ----: | ---------------------------------------------------- |
| A. User action (live DB / device / visual verify) |     9 | Passkey migration apply + device QA                  |
| B. Code work — perf/RSC                           |     6 | RSC Phase A (`/reports/client-parts-service`)        |
| C. Security debt                                  |     1 | RPC grants hardening (migration likhna)              |
| D. Data correctness                               |     2 | Loans status alignment (low priority)                |
| E. Planned features (not started)                 |     3 | Login UX / multi-brand / RQ rollout — owner decision |

---

## A. User action pending (code ready, verify/apply baaki)

### A1. Passkey / Biometric login (WebAuthn) — 🔴 highest owner dependency

- **Status:** code complete (Option B custom WebAuthn), UI live.
- [ ] Migration apply: `supabase/migrations/20261018_passkey_login.sql`
      (`user_passkeys` + RLS + grants + trigger). Verify: REST probe table 200.
- [ ] Manual device matrix: Windows Hello · Android fingerprint · iOS Face ID ·
      password regression · lost-device/revoke · RLS probe (anon ko 0 rows).
- [ ] Final gates: `tsc` · `eslint` · `vitest` · `build`.
- [ ] Deploy gate: HTTPS + stable rpID note (domain change = passkeys invalid),
      release tag + CHANGELOG.
- **Source:** `docs/TODO.md` §Staff Passkey (Phase 5/6).
- **Note:** migration na lage to feature silently off (graceful) — koi crash nahi.

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

### B1. RSC Phase A — `/reports/client-parts-service` seed 🟢 recommended next

- [ ] `src/lib/server-client-parts-service.ts` + server `page.tsx` + client body split.
- [ ] Seed-aware hook (skip-flags + `seedMatchesFilters`), zero logic change.
- Effort ~2.5-3 h · risk low (fresh page, rollback = revert `page.tsx`).
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

### E1. Login page friendly UX revamp

- Current login still `Tab = "staff" | "client"` (2 tabs, friction).
- Plan ready: staff-first default, client OTP alag card, biometric messaging
  friendlier, "Track job without login" banner.
- **Source:** `docs/plans/login_page_friendly_ux_plan.md`.
- Effort ~1 session · risk low (public page, no DB).

### E2. Multi-brand architecture (service + job ID sequencing)

- **Status:** plan only. Code me `brand_id`/`brandId` refs = **0**, koi
  `*brand*` migration nahi. Implement shuru nahi hua.
- Decision pending: Vikalp B (dual-identity: global `job_id` + brand prefix).
- Phase 5 (brand-wise dashboard/pending/reports filters) sabse bada kaam.
- **Source:** `docs/plans/multi_brand_service_architecture_plan.md`,
  `docs/plans/multi_brand_job_id_sequencing_plan.md`.

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

1. **B1 (RSC pilot)** — 3 h, zero risk, measurable win; template bhi ban jayega.
2. **C (RPC grants)** — security debt, high value; migration + read-only sim pehle,
   apply owner approval ke baad.
3. **A1 (passkey)** — user ke paas 15 min ka kaam (migration + ek device), phir
   release tag.

Baaki (B2/B3, E1) tab jab owner bole.
