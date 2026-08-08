# Client Portal Plan (Client Login → Sirf Apni Details)
*Created: 08 Aug 2026 · Status: DEFERRED — "bad me karenge" · Source: current auth model analysis*

## Goal
Client ko login dekar **sirf uski apni** repairs/payments/loan details dekhne ki suvidha. Na koi aur client ka data, na internal pages.

## Current State (kya hai aaj)
- Login: Supabase Auth (email/password) → `src/app/login/page.tsx`
- Roles: `profiles` me sirf `admin` / `staff` (default `staff`)
- `clients` table me phone + naam hai, auth account nahi
- API auth guard: sirf "logged-in ya nahi" check karta hai (per-client isolation NAHI hai)
- Client data binding: jobs/direct-sales/payments mostly `client_name` (string) se join — IDOR risk

## Gap Analysis (kya karna padega)

### Phase 1 — DB (migration)
- [ ] `profiles`: `role` me `"client"` + `client_id` column (client table FK)
- [ ] `client_list`: `login_allowed` boolean flag (admin decide kare kaun login kar sakta hai)
- [ ] Migration file: `supabase/migrations/` me, date-prefixed
- [ ] **RLS policies** (sabse important):
  - `transaction_list`: client sirf apne rows padh sakta hai (`client_name` match ya `client_id` join)
  - `client_payments`, `client_loans`/loan EMI: same isolation
  - Internal (admin/staff) RLS agal-bagal rakhna — isi table par existing policies mat todo

### Phase 2 — Auth Flow
- [ ] **Phone OTP login** best fit (clients ke paas phone hai, password nahi yaad hota):
  - Supabase Auth me phone OTP enable karna (dashboard/console)
  - Login page par "Client Login" tab: phone number → OTP → verify
  - Fallback: email/password bhi ho sakta hai (optional)
- [ ] `profiles` auto-create/update on first client login: `role="client"`, `client_id` map via phone number match
- [ ] Remember-me / OTP expiry handling

### Phase 3 — Client Dashboard (UI)
- [ ] New route group `(client)/` ya `src/app/my-account/`:
  - `/my-account` — Meri Repairs (jobs list, status, amounts, delivery date)
  - `/my-account/payments` — Meri Payments (history)
  - `/my-account/loan` — Mera Loan (if `login_allowed` && loan exists)
- [ ] `layout.tsx`: `role === "client"` → alag chhota sidebar (sirf teen links), navbar me internal links hidden
- [ ] All pages inside dashboard group par client guard (redirect `/my-account`)
- [ ] WhatsApp link per job (status update share)

### Phase 4 — ⚠️ API Security (IDOR protection)
- [ ] Har data API route par check: `role === "client"` → `client_id` se match karna, warna `403`
- [ ] Verify `?client_name=` / `?id=` params client ka apna hi ho
- [ ] E2E test manually: client A ke session se client B ka id daal ke URL → 403
- [ ] Print routes (`print-bill`, `print-combined-invoice`, etc.) client ke liye block — internal hai
- [ ] Admin routes (`/api/admin/*`) client ke liye block — already hoga, verify

### Phase 5 — Cleanup / Hardening
- [ ] Login page: "Client Login" aur "Staff Login" alag tabs
- [ ] Error handling: invalid phone, OTP expired, `login_allowed=false` → proper Hindi messages
- [ ] Logout client se bhi kaam kare
- [ ] Lint/tsc/build pass

## Order of Work (recommended)
1. **Phase 1 (RLS pehle)** — bina data isolation ke kuch mat karo
2. Phase 2 (OTP login)
3. Phase 4 (API guards) — Phase 2 ke saath-saath, login thoda bhi data expose karta hai
4. Phase 3 (UI) — last, kyunki UI sirf data darshaata hai
5. Phase 5 cleanup

## Effort Estimate
- Phase 1: ~1-2 ghante
- Phase 2: ~1-2 ghante
- Phase 4: ~2-3 ghante (skip mat karna)
- Phase 3: ~2-4 ghante
- **Total: ~1-2 din**

## Open Questions (implement karne se pehle decide)
- [ ] Client login ke liye admin har client ko `login_allowed` toggle kare ya sabko automatic?
- [ ] Phone OTP ke liye Supabase ka SMS provider (Twilio/Vonage) setup hai ya abhi nahi? (cost consideration)
- [ ] Agar OTP setup nahi hai toh email/password wala route hi pehle? (dummy email per client)
- [ ] Client ko loan details dikhane hain ya sirf repairs + payments?
