# Client Portal Plan (Client Login → Sirf Apni Details)
*Created: 08 Aug 2026 · Status: ✅ COMPLETE — fully user-tested + OTP login with working email verified + admin portal toggle ON/OFF tested (11 Aug 2026). Completed task record → `completed_tasks.md`.*
*✅ 10 Aug (USER TESTED): SQL run kiya, Gmail SMTP set kiya, client email se OTP generate kiya, OTP se login kiya, admin se portal access ON/OFF toggle karke check kiya — SAB SAHI KAAM KAR RAHA HAI.*
*✅ 10 Aug (live verify): `profiles_role_check` me `client` ALREADY present (role=client upsert OK). `client_list.login_allowed` ✅, `profiles.client_id` ✅, RLS transaction_list + client_payments CLOSED ✅. Section 5 migration applied tha — plan item #5/#108 outdated.*
*⚠️ 10 Aug (data audit): Portal-enabled clients sirf 2 — #79 `hemantmehra0316@gmail.com` (email OK) aur #196 `Nihal Dehriya Palari` (email EMPTY → OTP kabhi nahi jayega). 450 clients me ~350 ke paas email hi nahi. Kaun-se clients portal payenge + unke emails — business owner ka decision hai (main invent nahi kar sakta).*
*⚠️ 09 Aug (diagnostic): `profiles_role_check` CHECK constraint sirf admin/staff allow karta hai — `role='client'` insert live me FAIL (`violates check constraint profiles_role_check`). Fix migration me section 5 me add — SQL editor me run karna hai. Email collision: client #2 (`coolguy.1595@gmail.com`) aur #3 (`vik.vtech@gmail.com`) ke emails pehle se staff auth accounts hain → unse portal login par staff UI milegi. Test ke liye non-conflicting email (e.g. #4 `preetijn65@gmail.com`).*
*⚠️ 09 Aug (root cause #2): Supabase ka auto-profile trigger (on_auth_user_created/handle_new_user) OTP signup (shouldCreateUser) par bhi `role='staff'` ki zombie profile bana deta hai → onboard role='staff' dekh kar staff UI deta tha. Fix: onboard ab zombie staff → client convert karta hai (jab email client_list+login_allowed me ho) + migration `20260809_drop_auth_profile_trigger.sql` (trigger drop — profiles ab sirf explicit insert se).*
*✅ 09 Aug (due + ledger): `/api/client/ledger` (own client_id, opening+repairs+direct sales+loans−payments=due, running balance, from/to filter), `/api/client/me` me `due`, `/my-account` me due/advance card, naya `/my-account/ledger` (date filter + print popup), sidebar me "Meri Ledger" link.*

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
- [x] `requireStaff()` helper (`src/lib/api-auth.ts`) — role `admin`/`staff` check; profile-less user reject. Sab print/export/chat/report routes ab `requireStaff()` use karte hain (done 09 Aug)
- [x] Photo upload routes (`client-photo`, `product-image`, `mechanic-photo`, `job-images`, `user-avatar`) — `requireStaff()` guard (pehle service-role POST, koi auth nahi)
- [x] `settings/signature` — `requireStaff()` guard
- [x] `print-job-status` — **public rehne ka decision**: public "Check Your Repair Status" page ka Print button isse kholta hai. Isliye public hi hai, par `client_name` (internal client ID) response se hata diya — ab public API jitna hi data expose karta hai
- [ ] `device-info` — harmless dev helper (production me `null`), leave as is

## Decisions (09 Aug)
- **Login method:** Email OTP — WhatsApp OTP **reject** (cost audit, 09 Aug): Meta Cloud API OTP sirf "authentication template" se jata hai aur **India recipients ke liye per-message charged** hai (free nahi). Twilio/Gupshup/MSG91 bhi production me paid. **Koi paid service use nahi karni** — isliye **email OTP**.
- **Email OTP delivery (FREE):** Apna SMTP use karke — free tiers: Gmail SMTP (~500/day), Zoho Mail (free plan), Brevo (300/day), Resend (3000/month). Supabase Auth me **custom SMTP** set karke `signInWithOtp` (email OTP code) use karna sabse clean hai. Supabase ki hosted email bhi free hai par rate-limited + spam risk — custom SMTP better.
- ⚠️ **Caveat:** Is shop ke clients me email adoption low ho sakta hai (zyada tar phone/WhatsApp). Isliye `login_allowed` toggle se admin sirf un clients ko portal de jo **email wale hain**. Email OTP me email valid hona zaroori hai (code usi par jata hai).
- **login_allowed:** Admin toggle — `client_list.login_allowed` flag, sirf select clients.
- **Loan scope:** Portal me **sirf repairs + payments**, loan details nahi.

## Status (09 Aug, portal implementation done — migration apply pending)
- ✅ **Migration file bana**: `supabase/migrations/20260809_client_portal.sql` — `client_list.login_allowed`, `profiles.client_id` (FK), RLS (transaction_list + client_payments: staff full, client own-row). **⚠️ ABIhi Supabase me apply nahi hua — user ko chahkar run karna hai.** RLS enable hone se pehle DB state review karna.
- ✅ **Email OTP login**: `/login` me Staff/Client tabs, `signInWithOtp` (shouldCreateUser) → `verifyOtp` → `/api/client/onboard` (service-role, client_id email se derive — IDOR safe).
- ✅ **Client API guards**: `/api/client/me|jobs|payments` — `requireClient()` (role=client + client_id). Data routes `.eq("client_name", String(cid))` / `.eq("client_id", cid)` se filter.
- ✅ **Client pages**: `/my-account` (Meri Repairs + status filter), `/my-account/payments` (Meri Payments).
- ✅ **Layout**: client role → chhota sidebar (Meri Repairs/Payments), search hidden, staff pages par redirect `/my-account`.
- ✅ **Admin toggle**: `/clients` list → Actions dropdown me "Portal Access ON/OFF" (admin, email hona zaroori).
- ✅ `npx tsc --noEmit` + `npx next build` pass.
- ⚠️ **BAAKI (user side):**
  1. Migration Supabase me run karna (sql editor) — jaise last migration kiya tha.
  2. **Custom SMTP** Supabase Auth me configure (free: Gmail app password / Zoho / Brevo / Resend). Nahin to Supabase hosted email use hoga (free, par rate-limited + spam risk).
  3. Client ke emails `client_list` me set karna + portal access toggle ON.
  4. Deploy (git push → Vercel).

## Gap Analysis (kya karna padega)

### Phase 1 — DB (migration)
- [x] `profiles`: `role` me `"client"` + `client_id` column (client table FK) — `20260809_client_portal.sql`
- [x] `client_list`: `login_allowed` boolean flag (admin decide kare kaun login kar sakta hai)
- [x] Migration file: `supabase/migrations/` me, date-prefixed
- [x] **RLS policies** (defense-in-depth) — transaction_list + client_payments:
  - `transaction_list` me numeric client_id nahi → `client_name ~ '^[0-9]+$' AND client_name::bigint = (client_id)` safe cast
  - `client_payments`: `client_id` se isolation
  - ⚠️ **RLS primary guard NAHI hai** — data routes service-role se jati hain (bypass RLS). API guards (Phase 4) hi asli isolation hai. RLS sirf browser-client direct queries (devtools) se bachata hai. **Migration abhi apply nahi hua — user ko chahkar run karna hai.**

### Phase 2 — Auth Flow
- [x] **Email OTP login** (Supabase Auth built-in flow — FREE):
  - Supabase Dashboard me **custom SMTP** configure (free provider: Gmail app password / Zoho / Brevo / Resend) — ⚠️ user action pending
  - Login page par "Client Login" tab: email → `signInWithOtp({ email, shouldCreateUser: true })` → OTP code enter → `verifyOtp({ token, type: 'email' })`
  - Login se pehle check: email `client_list` me hai aur `login_allowed=true`; nahi to clear error — `/api/client/onboard` ye karata hai (client_id client se NAHI, email se derive)
- [x] `profiles` auto-create/update on first client login: `role="client"`, `client_id` map via email lookup in `client_list` (service-role API)
- [x] OTP expiry / resend handling (Supabase built-in handles)
- [x] `client_list.email` column pehle se exist karta hai (backup schema me confirm) — OTP + client_id mapping isi se

### Phase 3 — Client Dashboard (UI)
- [x] `/my-account` — Meri Repairs (jobs list, status chips + filter, amounts, dates)
- [x] `/my-account/payments` — Meri Payments (history table)
- [x] `layout.tsx`: `role === "client"` → alag chhota sidebar (sirf do links), navbar search hidden, staff pages par redirect `/my-account`
- [ ] WhatsApp link per job (status update share) — optional, baad me
- (loan page nahi — decided: repairs + payments hi)

### Phase 4 — ⚠️ API Security (IDOR protection)
- [x] `requireClient()` helper (`src/lib/api-auth.ts`) — role `client` + `client_id` hona zaroori
- [x] Client API routes (`/api/client/me|jobs|payments`) — sirf apna client_id ka data, warna 401/403
- [x] `transaction_list` filter: `.eq("client_name", String(myClientId))` (ID TEXT me hai, naam nahi) — `/api/client/jobs`
- [x] `/api/client/onboard` — client_id client se NAHI leta (email se derive) → client A client B ka account link nahi kar sakta
- [ ] E2E test manually: client A ke session se client B ka id daal ke URL → 403 (user test)
- [ ] Print routes (`print-bill`, `print-combined-invoice`, etc.) client ke liye block — internal hai (abhi `/my-account` me print links nahi hain; UI me kabhi add karein to `requireStaff()` pehle se guard hai)
- [ ] Admin routes (`/api/admin/*`) client ke liye block — `requireAdmin()` already guard hai, verify karna
- [x] `requireStaff()` helper: profile role `admin`/`staff` hona chahiye, profile-less user reject

### Phase 5 — Cleanup / Hardening
- [x] Login page: "Client Login" aur "Staff Login" alag tabs
- [x] Error handling: invalid email, OTP expired/limit, `login_allowed=false` → proper Hindi messages
- [x] Logout client se bhi kaam kare (layout logout button)
- [x] Lint/tsc/build pass (`npx tsc --noEmit` + `npx next build` — pass 09 Aug)
- [ ] Production test: client email se login karke apne repairs/payments verify (user)
- [ ] Email templates (OTP subject/body) Supabase dashboard me apne naam se customize (optional)

## Order of Work (recommended — security pehle, RLS ki jagah API guards)
1. ✅ **Open registration band** (done 09 Aug) — signup page, login auto-create, role-escalation trigger
2. ✅ **Unauth/public endpoints lock** (done 09 Aug) — reports/ledger, reports/balancesheet, job-status client_name
3. ✅ **requireStaff() + data route guards** (done 09 Aug) — print/export/chat/reports + photo uploads + signature
4. ✅ **Phase 2 (Email OTP login) + Phase 4 client API guards** (done 09 Aug) — login tabs, onboard/me/jobs/payments, requireClient
5. ✅ **Phase 1 (RLS/migrations) apply** — `20260809_client_portal.sql` live me APPLIED (verified 10 Aug: login_allowed ✓, client_id ✓, RLS transaction_list ✓, RLS client_payments ✓, profiles_role_check 'client' ✓). Migration ke baad E2E test baaki.
6. ⬜ **SMTP setup** (user action — Gmail app password / Zoho / Brevo / Resend) + client emails set + portal toggle ON. **Abhi: #196 email empty set karna hai (Edit Client se), #79 OK hai**
7. ⬜ Phase 3 polish (optional WhatsApp link per job) + Phase 5 production test
8. ⬜ Deploy: git push → Vercel

## SMTP Setup Guide (user action — Supabase Auth me custom SMTP)

Portal email OTP ke liye Supabase Auth ko custom SMTP chahiye (nahi to hosted email use hoga — free par rate-limited + spam risk). Steps:

### Option A — Gmail (recommended, free ~500/day)
1. Gmail → Google Account → **Security** → **2-Step Verification ON** (zaroori)
2. **Search "App Passwords"** → create app password (select "Mail" / "Other") → 16-char code milta hai
3. Supabase Dashboard → Project → **Authentication → SMTP Settings**
4. Fill karo:
   - Host: `smtp.gmail.com`
   - Port: `465` (SSL) — agar 465 na chale to `587` + Enable SSL off/TLS on
   - Username: aapka Gmail (e.g. `hemantmehra0316@gmail.com`)
   - Password: 16-char **App Password** (normal Gmail password NAHI)
   - Sender name: `V-Technologies` / Sender email: same Gmail
5. Save → "Send test email" se verify karo

### Option B — Zoho Mail (free plan)
- Host `smtp.zoho.com`, port `465`, apna Zoho email + app-specific password

### Option C — Brevo (free 300/day) / Resend (free 3000/month)
- Brevo: `smtp-relay.brevo.com:587`, SMTP key (Master password nahi, SMTP key banani hoti hai)
- Resend: API key se `resend.com` (REST) — Supabase SMTP form me `smtp.resend.com:465`, username `resend`, password = API key

### Verify
- OTP email subject/body: Supabase Dashboard → Authentication → **Email Templates → OTP** me customize kar sakte ho
- Client login test: `/login` → Client tab → email → OTP code → `/my-account`

## Client Portal Launch Checklist (user)

1. ✅ Migration applied + verified (10 Aug)
2. ✅ SMTP setup (Gmail) — user done
3. ✅ Client email set + portal toggle ON — user done (OTP login + toggle ON/OFF tested OK)
4. ✅ Test: client login → repairs/payments dekhna — user verified
5. ✅ Deploy — client portal code deployed (a965c5b)


- Phase 1: ~1-2 ghante (migration + dashboard RLS apply)
- Phase 2: ~1-2 ghante (+ SMTP setup alag)
- Phase 4: ~2-3 ghante (skip mat karna)
- Phase 3: ~2-4 ghante
- **Total: ~1-2 din**

## Effort Estimate

- Phase 1: ~1-2 ghante (migration + dashboard RLS apply)
- Phase 2: ~1-2 ghante (+ SMTP setup alag)
- Phase 4: ~2-3 ghante (skip mat karna)
- Phase 3: ~2-4 ghante
- **Total: ~1-2 din**

## Open Questions (implement karne se pehle decide)
- [x] ~~Client login ke liye admin har client ko `login_allowed` toggle kare ya sabko automatic?~~ → **Admin toggle** (decided 09 Aug)
- [x] ~~Phone OTP ke liye SMS provider setup?~~ → **Email OTP** (decided 09 Aug) — WhatsApp OTP India me charged hai, isliye reject. Custom SMTP (free) se Supabase `signInWithOtp` email code.
- [ ] Email SMTP provider kaun: Gmail (app password) / Zoho / Brevo / Resend? (free tier + deliverability)
- [ ] `login_allowed` toggle UI kahaan: `/clients` list par inline, ya client detail page par?
- [x] ~~Client ko loan details dikhane hain?~~ → **Nahi, sirf repairs + payments** (decided 09 Aug)
