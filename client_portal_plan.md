# Client Portal Plan (Client Login → Sirf Apni Details)
*Created: 08 Aug 2026 · Status: DEFERRED — "bad me karenge" · Updated: 09 Aug 2026 (security review + hardening)*
*Source: current auth model analysis*

## Goal
Client ko login dekar **sirf uski apni** repairs/payments/loan details dekhne ki suvidha. Na koi aur client ka data, na internal pages.

## Current State (kya hai aaj)
- Login: Supabase Auth (email/password) → `src/app/login/page.tsx`
- Roles: `profiles` me sirf `admin` / `staff` (default `staff`)
- `client_list` me phone + naam hai, auth account nahi
- API auth guard: sirf "logged-in ya nahi" check karta hai (per-client isolation NAHI hai)
- ⚠️ `transaction_list.client_name` column me **client ka NAAM nahi, uska numeric ID TEXT me stored hai** (`src/app/jobs/new/page.tsx:512`) — name match RLS/lookup isse galat ho jayega
- `client_payments`, `client_loans`, `direct_sales` me proper numeric `client_id` hai
- ⚠️ `/signup` khola tha — koi bhi `role:"staff"` account bana sakta tha (ab band kiya gaya, 09 Aug)
- ⚠️ `reports/ledger` + `reports/balancesheet` bina auth ke the (ab `requireUser()` guard laga diya, 09 Aug)

## ⚠️ Security Review Findings (09 Aug) — pehle se fix kiye
1. **`/signup` open** → page delete kiya, `PUBLIC_PAGES` se hata diya. Naye users sirf `/api/admin/create-user` se (admin, service-role).
2. **Login auto-create `role:"staff"`** → hata diya (`login/page.tsx`). Raw `supabase.auth.signUp` ke baad login karne par profile nahi banti.
3. **Role escalation (DB)** → migration `supabase/migrations/20260809_lock_profiles_role.sql`: browser (anon/authenticated) role ko `staff` ke alawa set nahi kar sakta. Admin UI role change ab service-role API `/api/admin/update-profile` se hota hai.
4. **`reports/ledger` + `reports/balancesheet`** → `requireUser()` guard lagaya (pehle completely public the — full shop financials leak hota tha).
5. **`public/job-status`** → response se `client_name` (internal client ID) hata diya. `amount` UI me dikhta hai isliye rakhna pada — note: koi bhi enumerable `job_id` se job ka amount dekh sakta hai, ye intentional "Check Your Repair Status" feature hai.

### Baaki jo portal se pehle fix karna hai (TODO)
- [ ] `requireUser()` sirf login check hai — data routes par `requireStaff()` (role = admin/staff) lau; profile-less user ko block karo
- [ ] Photo upload routes (`client-photo`, `product-image`, `mechanic-photo`, `job-images`, `user-avatar`) service-role POST hai, koi auth check nahi
- [ ] `print-job-status` service-role, koi user check nahi

## Gap Analysis (kya karna padega)

### Phase 1 — DB (migration)
- [ ] `profiles`: `role` me `"client"` + `client_id` column (client table FK)
- [ ] `client_list`: `login_allowed` boolean flag (admin decide kare kaun login kar sakta hai)
- [ ] Migration file: `supabase/migrations/` me, date-prefixed
- [ ] **RLS policies** (sabse important):
  - ⚠️ `transaction_list` me `client_id` ka koi numeric column NAHI hai — pehle ye column add karo ya RLS join `client_name::int = auth.client_id` cast se karo. `client_name` string se name-match **mat** karo (usme ID stored hai)
  - `client_payments`, `client_loans`/loan EMI: `client_id` se isolation
  - ⚠️ **RLS RLS se kaam nahi karega** — zyada tar data routes service-role key se query karte hain jo RLS bypass karti hai. API guards (Phase 4) hi asli isolation hai. RLS ko defense-in-depth treat karo, primary guard nahi.

### Phase 2 — Auth Flow
- [ ] **Phone OTP login** best fit (clients ke paas phone hai, password nahi yaad hota):
  - Supabase Auth me phone OTP enable karna (dashboard/console) — SMS provider (Twilio/Vonage) setup check karo, cost consideration
  - Login page par "Client Login" tab: phone number → OTP → verify
  - Fallback: email/password bhi ho sakta hai (optional)
- [ ] `profiles` auto-create/update on first client login: `role="client"`, `client_id` map via **client_id** (phone/naam match se NAHI — duplicates possible, neeche note)
- [ ] Remember-me / OTP expiry handling
- ⚠️ `client_list.contact` par UNIQUE constraint nahi — duplicate phones/naam allowed. OTP login mapping ke liye `login_allowed` toggle ke waqt phone unique enforce karo ya admin `client_id` manually link kare.

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
- [ ] Verify `?id=` / `?client_id=` params client ka apna hi ho
- [ ] `transaction_list` filter: `.eq("client_name", String(myClientId))` (ID TEXT me hai, naam nahi)
- [ ] E2E test manually: client A ke session se client B ka id daal ke URL → 403
- [ ] Print routes (`print-bill`, `print-combined-invoice`, etc.) client ke liye block — internal hai
- [ ] Admin routes (`/api/admin/*`) client ke liye block — already hoga, verify
- [ ] `requireStaff()` helper: profile role `admin`/`staff` hona chahiye, profile-less user reject

### Phase 5 — Cleanup / Hardening
- [ ] Login page: "Client Login" aur "Staff Login" alag tabs
- [ ] Error handling: invalid phone, OTP expired, `login_allowed=false` → proper Hindi messages
- [ ] Logout client se bhi kaam kare
- [ ] Lint/tsc/build pass

## Order of Work (recommended — security pehle, RLS ki jagah API guards)
1. ✅ **Open registration band** (done 09 Aug) — signup page, login auto-create, role-escalation trigger
2. ✅ **Unauth/public endpoints lock** (done 09 Aug) — reports/ledger, reports/balancesheet, job-status client_name
3. **API guards (Phase 4)** — `requireStaff()` + client-IDOR check; ye primary isolation hai
4. Phase 2 (OTP login) — Phase 4 ke saath-saath
5. Phase 1 (RLS/migrations) — defense-in-depth, dashboard me apply karna
6. Phase 3 (UI) — last, kyunki UI sirf data darshaata hai
7. Phase 5 cleanup

## Effort Estimate
- Phase 1: ~1-2 ghante (migration + dashboard RLS apply)
- Phase 2: ~1-2 ghante (+ SMS provider setup alag)
- Phase 4: ~2-3 ghante (skip mat karna)
- Phase 3: ~2-4 ghante
- **Total: ~1-2 din**

## Open Questions (implement karne se pehle decide)
- [ ] Client login ke liye admin har client ko `login_allowed` toggle kare ya sabko automatic?
- [ ] Phone OTP ke liye Supabase ka SMS provider (Twilio/Vonage) setup hai ya abhi nahi? (cost consideration)
- [ ] Agar OTP setup nahi hai toh email/password wala route hi pehle? (dummy email per client)
- [ ] Client ko loan details dikhane hain ya sirf repairs + payments?
