# Sprint 4 — Hardening, QA & Release (27 Nov 2026)

> **Part of:** `master_completion_plan_2026-11-26.md` (W6 + FINAL) · **Depends on:** Sprint 3.
> **Status:** PLAN ONLY · **Effort:** ~6–8 working days + CSP 2-week observation (parallel).
> **Goal:** saare gates green → owner approval → **ek hi batch commit + push** (K15).

---

## 1. Scope (master IDs D5–D10 + E6 + F1–F11 + G1–G2 + FINAL)

| ID | Kaam | Owner? |
|---|---|---|
| D5 | Fallback + 5xx observability/alerting (Sprint 1 ke `rpc_fallback` events ko feed) | code |
| D6 | Generated DB types (`npm run types:gen`, clean DB par diff empty) | K11 |
| D7 | Migration tracking in CI (pending visible, applied list match) | code |
| D8 | CSP enforce — 2-week violation observation window ke baad | K14 + owner |
| D9 | Perf regression gate · PR flow/reviewer · lint cleanup · offsite backup + restore drill | owner + code |
| D10 | `docs/README.md` index + purane plan archive — master plan single source | code |
| E6 | Conditional perf: `/clients` virtual list (pehle TBT measure), streaming polish, JobsBody virtualization | measure ke baad |
| F1 | Passkey device QA matrix (Windows Hello / Android / iOS / revoke / anon probe) | ✅ owner device |
| F2 | Login UX real-device QA (fingerprint, keyboard, OTP countdown) | ✅ owner |
| F3 | Server-first visual verify — 44 authenticated routes | ✅ owner |
| F4 | Clients server-first verify + legacy redirect | ✅ owner |
| F5 | Estimate builder QA (print, draft, WA share) | ✅ owner |
| F6 | Balance Sheet QA (as-on, drill-down, tabs, CSV, A4) | ✅ owner |
| F7 | Bulk-edit live save on device | ✅ owner |
| F8 | E2E staging green → enable `push: main`; specs sirf staging par | ✅ owner |
| F9 | Public site content (photos, review link) + 7 tabs refresh | ✅ owner |
| F10 | Crop editor device matrix | ✅ owner |
| F11 | Browser smoke har wave ke baad (new/edit/view/bulk/search/print/mobile), console 0 | code + owner |
| G1 | Loans status alignment (ledger sab vs canonical status=1) | optional |
| G2 | Pending-jobs non-billing grouping (rows/totals unchanged) | optional |

---

## 2. FINAL gate (sab ek saath)

- [ ] `npx tsc --noEmit` · `npm run lint` · `npx vitest run` · `npm run schema:drift` · `npm run build`
- [ ] touched-files prettier · browser smoke (F11) · report parity (B9) · anon RPC probe (D1)
- [ ] owner sign-off: decision register K1–K15 sab resolved
- [ ] **Commit strategy (K15):** har sprint ka local commit ho sakta hai; **push ek hi baar**
      jab owner bole "ab sab ho gaya". Version bump alag explicit approval se (package.json untouched).
- [ ] `git status` clean, `origin/main` synced, final summary doc update

---

## 3. Expert note

CSP 2-week observation window code ke parallel chal sakta hai — uske liye sprint badhana zaroori
nahi, bas enforce step last me rakhna hai. Device QA (F1/F2) sabse pehle schedule karo kyunki
wo external devices par depend karta hai; baaki code kaam uske wait me nahi hai.
