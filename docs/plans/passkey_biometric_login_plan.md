# Staff Passkey / Biometric Login — Design Doc + Implementation Plan

Created: 2026-09-17 · Status: **DESIGN LOCKED — implementation DEFERRED (peak-season freeze)**
Scope: Staff/admin/developer ke liye password ke saath **optional WebAuthn (passkey) fast-login**.
PIN **rejected** (decision record §3). Client portal untouched.

> Rule n°1: is feature ke liye koi DB write se pehle `docs/DATA_MIGRATION_NOTES.md` padho.
> Rule n°2: Koi production deploy nahi jab tak G3 (peak-season window) SAFE-no. Design + code ready
> kar sakte hain, **apply post-season window me** (server_migration_gate_plan.md §3).

---

## 1. Why (problem)

- Staff roz 5–10 bar login karte hain (desktop + mobile browser). Password typing + throttle friction
  = productive time chalta hai, aur weak-password reuse ka risk.
- Abhi login options: password / client-OTP — dono me typing + wait.
- Chaheye: ek tap par **device-level biometric** (Windows Hello / Touch ID / Face ID / Android
  fingerprint) se login, **bina password ki jagah liye** — password hamesha fallback rahega.

## 2. Existing building blocks (reuse)

| Cheez | File | Note |
|---|---|---|
| Login API (modes: password/otp/verify-otp) | `src/app/api/auth/login/route.ts` | Isi me passkey modes add honge |
| Cookie server client | `src/lib/api-auth.ts` `getServerSupabase()` | @supabase/ssr, cookie+RLS |
| Login throttle (email+ip lockout) | `src/lib/login-throttle.ts` (via login route) | Passkey attempts bhi iske through |
| Login UI | `src/app/(public)/login/page.tsx` | Passkey button yahi |
| Roles | `profiles.role` — `admin`/`developer`/`staff`/`client` | `requireStaffWithRole` pattern |
| Settings page | `src/app/settings/page.tsx` | Device management UI yahan ya alag |

## 3. Decision Record (locked)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | PIN vs Biometric | **Biometric (WebAuthn/passkey). PIN REJECTED.** | PIN = 4–6 digit = chhota brute-force space; phishable; browser ke paas built-in PIN unlock nahi. Passkey = phishing-resistant, device-level (fingerprint/face/PIN OS se), fatigue khatam. |
| D2 | Password role | **Password = primary ka hamesha. Passkey = optional fast-login.** | Device lost / new device / OS reset par fallback zaroori. Passkey kabhi sole-auth nahi. |
| D3 | Who | **Sirf `staff`/`admin`/`developer`.** Client portal untouched (alag flow, alag risk). | Client = low re-login frequency; spec keep small. |
| D4 | Enrollment | **Self-service, password re-auth ke saath.** Har user apni device passkey register kare. Admin list/remove bhi kar sake. | Staff ki device management admin par dump mat karo. |
| D5 | User verification | `userVerification: "preferred"` | Fingerprint nahi hua to device PIN/pass fallback (convenience). `required` = 100% biometric, par shared/weak devices par friction. Quick-login use-case me preferred theek. |
| D6 | Attestation | `none` (privacy), authenticator = `platform` preferred + `cross-platform` allowed | AOP's device attestation ki zarurat nahi. |
| D7 | DIscoverable | `residentKey: "preferred"`, `"mediation"` = explicit button (conditional UI baad me) | Simpler first; darwaza khula. |
| D8 | Session issue (passkey verify ke baad) | **Server-side `supabase.auth.admin.createSession(user_id)`** (service role, server-only) → normal JWT session, RLS intact | Password ki zarurat nahi; email-OTP kainner spam nahi. **Spike check:** pinned supabase-js version me `admin.createSession` available hona chahiye (Phase 1 verify; fallback §8). |
| D9 | Throttle | Passkey login bhi `checkLockout(email, ip)` + `recordFailure` se guzrega | Abusive attempts same hi door se rukenge. |
| D10 | Clone protection | `sign_count` stored + monotonic check; mismatch → verify reject + log | Device clone / fingerprint replay guard. |

## 4. Data model (migration — apply post-season)

```sql
-- Device-attached WebAuthn credentials. Password kabhi yahan nahi.
create table if not exists public.user_passkeys (
    id           bigint generated always as identity primary key,
    user_id      uuid not null references auth.users(id) on delete cascade,
    credential_id text not null unique,      -- WebAuthn credential ID (base64url)
    public_key   text not null,              -- COSE public key (base64url)
    sign_count   bigint not null default 0,  -- clone protection
    transports   jsonb,                      -- ['internal','usb',...]
    device_name  text,                       -- "Galaxy A32", "Office PC"...
    last_used_at timestamptz,
    date_created timestamptz not null default now(),   -- convention: date_* nahi created_at
    date_updated timestamptz not null default now()
);
create index user_passkeys_user_idx on user_passkeys(user_id);
create index user_passkeys_credential_idx on user_passkeys(credential_id);
```

- **RLS:** SELECT sirf apni (user) + admin/developer sabki; INSERT/DELETE **sirf server API
  (service role)** — browser client se direct write NAHI (enrollment ke baad session hi valid).
- Touch trigger `moddatetime` (`date_updated`), grants (authenticated read).
- Full schema me fold-in: `supabase/migrations/20260913000000_final_full_schema_idempotent.sql`.
- Naye migration file: `supabase/migrations/YYYYMMDD_passkey_login.sql` (implementation time).

## 5. Architecture / flow

### 5.1 Passkey session establishment (the hard part)

1. Browser par staff "Fingerprint se login karein" dabata hai.
2. `POST /api/auth/login` mode=`passkey-begin` → server:
   - `checkLockout(email, ip)` → lock? return 429.
   - `generateRegistrationOptionsAuthn`... (login me) use `generateAuthenticationOptions` with
     stored credentials for `user_id` (email se user dhundo — profiles/auth lookup).
   - Challenge ko **httpOnly signed cookie** me rakho (valid 5 min, one-time).
   - Return options (challenge, allowCredentials, rpId).
3. Browser `navigator.credentials.get(options)` → assertion.
4. `POST /api/auth/login` mode=`passkey-verify` → server:
   - Cookie se challenge nikalo (delete-after-use), `checkLockout` phir.
   - `verifyAuthenticationResponse` (`@simplewebauthn/server`) + `sign_count` monotonic check.
   - Success → `supabase.auth.admin.createSession({ user_id })` via server admin client
     (`getServerSupabaseAdmin()` — service role, `src/lib` me admin client) → sessions cookies set
     (same as password login path) → `reset(email)`.
   - Failure → `recordFailure`, 401.

### 5.2 Enrollment

1. Logged-in staff → Settings → "Devices / Fingerprint Login" → "Naya device add".
2. Password re-auth (`mode=password` verify ya `/api/passkey/preflight`) → then
   `POST /api/passkey/register-begin` (challenge cookie) → `navigator.credentials.create()` →
   `register-finish` (verify + INSERT service-role; duplicate credential_id → reject).
3. Device list: show device_name / last_used_at, rename (device_name update), remove (delete),
   "Revoke all" (admin). Revoke per user_id.

### 5.3 Throttle + recovery

- Har passkey attempt `checkLockout(email, ip)` first; failures `recordFailure`.
- Device lost → password login → remove stale passkey. Password disabled hi nahi hota kabhi.

## 6. Files (likely touched)

| Area | File |
|---|---|
| Deps (ADD) | `@simplewebauthn/server`, `@simplewebauthn/browser` |
| WebAuthn lib | `src/lib/passkeys.ts` (new) — options/verify wrappers, challenge cookie helpers |
| Admin supabase client (session issue) | `src/lib/api-auth.ts` ya `src/lib/admin.ts` — `getServerSupabaseAdmin()` service role |
| Login API | `src/app/api/auth/login/route.ts` — modes `passkey-begin`, `passkey-verify` |
| Enroll API | `src/app/api/passkey/register-begin/route.ts` + `register-finish/route.ts` (new) |
| Device mgmt API | `src/app/api/passkey/devices/route.ts` (new) — list/rename/delete (+admin delete-all) |
| Migration | `supabase/migrations/YYYYMMDD_passkey_login.sql` (new) + full-schema fold-in |
| Login UI | `src/app/(public)/login/page.tsx` — passkey button + error states |
| Settings UI | `src/app/settings/page.tsx` (ya `/settings/devices`) — enroll + list + manage |
| Tests | `src/**/*.test.ts` — throttle-path unit tests; webauthn verification mocked |

## 7. Non-goals / out-of-scope

- ❌ PIN-only login, PIN as password replacement.
- ❌ Password bypass / passwordless-only.
- ❌ Client portal + client phone biometric (alag flow; portal ka apna OTP flow hai).
- ❌ Conditional UI (`"mediation": "conditional"`) — Phase-2 sugar, need nahi.
- ❌ Hardware security keys (YubiKey) ke liye dedicated UX — allowed par platform-first.

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `supabase.auth.admin.createSession` available nahi pinned version me | Low | High | Phase-1 spike; fallback: short-lived `generateLink(type:'recovery')` internal token ya OTPlike — design change, isliye pehle verify |
| Shared office PCs — multiple passkeys boundary | High | Medium | Har user apni device par enroll; `allowedCredentials` scoped to that email's user_id; remove on staff exit |
| Device lost / OS reset | Medium | Medium | Password hamesha fallback; stale credential remove |
| Fingerprint rejections on dirty/cheap readers | Medium | Low | `userVerification: "preferred"`; device PIN fallback OS-level |
| Throttle bypass via passkey endpoint | Medium | Medium | Same `checkLockout`/`recordFailure` reuse |
| Replay / clone | Low | High | sign_count monotonic + challenge cookie one-time expiry |
| RLS write from browser client | Medium | High | INSERT/DELETE sirf service-role API; browser par SELECT-only policy |

## 9. Implementation phases + todo

> Estimate total ≈ 12–16 focused hours (2 working days) + user migration apply/QA session.
> Execution window: **post-season** (G3 SAFE-no abhi).

### Phase 0 — Decisions — DONE (locked in this doc §3)
- [x] Design decisions D1–D10 locked (PIN rejected, passkey optional, preferred user-verification).
- [x] WebAuthn standard flow agreed (challenge cookie + admin.createSession).

### Phase 1 — Foundations (spike + deps)  ~2–3 h
- [ ] Spike: verify `supabase.auth.admin.createSession` exists in pinned `@supabase/supabase-js`.
      (If not: `docs/plans/passkey_biometric_login_plan.md` §8 fallback follow + update decision D8.)
- [ ] `npm i @simplewebauthn/server @simplewebauthn/browser`
- [ ] `src/lib/admin.ts` — `getServerSupabaseAdmin()` (service role, server-only, cookie-jo-NAHI).
- [ ] `src/lib/passkeys.ts` — rpName/rpID config (`.env`), challenge cookie helpers
      (httpOnly, signed, 5 min, one-time), base64url helpers.

### Phase 2 — Enrollment ~3 h
- [ ] Migration `supabase/migrations/YYYYMMDD_passkey_login.sql` (table + RLS + grants + trigger)
      + full-schema fold-in (`20260913000000_final_full_schema_idempotent.sql`).
- [ ] `POST /api/passkey/register-begin` (auth + password re-auth + challenge cookie).
- [ ] `POST /api/passkey/register-finish` (verify, INSERT service-role, dup-credential reject).
- [ ] Device mgmt `src/app/api/passkey/devices/route.ts` — GET/PATCH(rename)/DELETE (self) +
      DELETE?user_id= (admin revoke-all).

### Phase 3 — Login flow ~3 h
- [ ] `POST /api/auth/login` mode=`passkey-begin` (user by email, allowedCredentials, challenge cookie).
- [ ] `POST /api/auth/login` mode=`passkey-verify` (verify + sign_count + admin.createSession +
      cookies + throttle).

### Phase 4 — UI ~3–4 h
- [ ] Login page: "Fingerprint se login karein" button (password section ke under) + email input
      reuse + error/loading states + "Device support nahi" fallback message.
- [ ] Settings → "Devices (Passkey Login)": enroll button, device list (name/last_used), rename,
      remove, admin revoke-all.
- [ ] Hindi messages: consistent with existing auth error style.

### Phase 5 — Tests + QA ~3–4 h
- [ ] Unit: throttle path in passkey modes (locked/left attempts), challenge cookie expiry/one-time.
- [ ] Unit: `sign_count` monotonic reject (mocked webauthn verify).
- [ ] Manual matrix:
  - [ ] Password login unchanged (regression).
  - [ ] Enroll + login on Windows Hello (admin + staff).
  - [ ] Enroll + login on Android Chrome (fingerprint) + iOS Safari (Face ID).
  - [ ] Staff outside-geofence/in-office + passkey (geofence plan independent — no interaction).
  - [ ] Device lost → password login → remove passkey.
  - [ ] Wrong email → throttle counts.
  - [ ] RLS: browser client browser se DELETE cannot (probe 403/RLS).
  - [ ] `npx tsc --noEmit` + `npx eslint` + `npx vitest run` + `npm run build` green.

### Phase 6 — Deploy gate (post-season)
- [ ] README / deployment note: passkey needs HTTPS + stable rpID (custom domain prefer; Vercel URL bhi chalega par domain change = passkeys invalid).
- [ ] User applies migration via Supabase SQL Editor (idempotent; ui report SELECT confirm).
- [ ] Release tag + CHANGELOG entry (repo convention).

---

## 10. Security notes (must-keep)

- Challenge **hamesha server cookie**, one-time, signed, expiry ≤ 5 min — client clock par trust NAHI.
- `sign_count` monotonic check har verify par.
- Session **admin.createSession se, kabhi bhi client-supplied token se direct session nahi**.
- Device_name user-controlled (sanitize display), kabhi auth input nahi.
- Login throttle ke saath **same** email normalisation (`trim().toLowerCase()`).

_Reference: existing login route `src/app/api/auth/login/route.ts`, cookie client `src/lib/api-auth.ts` (pattern copy: cookie set/adopt + error strings style). DB naming: `date_created/date_updated` (DATA_MIGRATION_NOTES), PDF kaar-side helpers mat toda._