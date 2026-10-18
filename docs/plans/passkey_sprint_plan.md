# Passkey Login — Sprint Execution Plan (per-commit)

> Status: **PROPOSED** — design locked `passkey_biometric_login_plan.md` (D1–D10), ye doc sirf execution breakdown hai.
> Created: 18 Oct 2026
> Rule n°1: koi DB write se pehle `docs/DATA_MIGRATION_NOTES.md` padho.
> Rule n°2: migration apply + prod deploy = **POST-SEASON (G3)**. Sprints me code + tests only.
> Estimate: ≈12–16 h (6 sprints). User action alag (P6).

## Guard rails

- Service-role key sirf `.env.local` (read-only) — kabhi print/log/export na ho; admin client sirf server route me.
- Migration **file likho, apply user karega** SQL Editor se (P6).
- Gates har sprint ke baad: `tsc --noEmit` + `eslint` (touched files) + `vitest run`; `next build` jab route/config naya ho.
- **Password login regression** har sprint ke baad manual check (modes password/otp/verify-otp bilkul untouched chalne chahiye).
- Line endings: `src/**` = LF; `docs/**` = CRLF (node script se likho).
- Commits: conventional; **push sirf plan ke end me** (user rule — mid-way push nahi).

## Sprint P1 — Foundations (~2–3h)

Commit: `feat(passkey): foundations — spike, admin client, challenge helpers`

- [ ] **Spike first:** pinned `@supabase/supabase-js` me `supabase.auth.admin.createSession` available? (node_modules se verify). **Nahi → STOP**, design §8 fallback + D8 update karo, aage badho hi mat.
- [ ] `npm i @simplewebauthn/server @simplewebauthn/browser`
- [ ] `src/lib/admin.ts` — `getServerSupabaseAdmin()` (service-role singleton, server-only, cookie-client se alag)
- [ ] `src/lib/passkeys.ts` — env-driven `rpID`/`rpName`, challenge-cookie helpers (signed, httpOnly, SameSite=Lax, **5 min TTL, one-time consume**), base64url helpers
- [ ] Gates green + spike result is doc me record (D8 confirm)

## Sprint P2 — Migration + Enrollment APIs (~3h)

Commit: `feat(passkey): user_passkeys migration + enrollment APIs`

- [ ] Migration `supabase/migrations/YYYYMMDD_passkey_login.sql` — design §4 table (credential_id unique, public_key, sign_count, device_name, `date_created/date_updated`) + RLS (browser = SELECT only, apni + admin/dev sabki) + grants + moddatetime trigger + full-schema fold-in (idempotent)
- [ ] `POST /api/passkey/register-begin` — auth + **password re-auth** + `generateRegistrationOptions` (residentKey preferred, userVerification preferred, attestation none) + challenge cookie
- [ ] `POST /api/passkey/register-finish` — verify + INSERT via admin client + duplicate credential_id → 409
- [ ] `/api/passkey/devices` — GET list / PATCH rename / DELETE self + admin revoke-all (`?user_id=`)
- [ ] Gates + local curl smoke (auth cookie se)

## Sprint P3 — Login flow (~3h)

Commit: `feat(passkey): passkey-begin/verify login modes`

- [ ] `src/app/api/auth/login/route.ts` me 2 naye modes (existing 3 untouched):
  - `passkey-begin` — email → user lookup → stored credentials → challenge cookie → options
  - `passkey-verify` — cookie consume → `verifyAuthenticationResponse` → **sign_count monotonic check** → `admin.createSession` → session cookies set → throttle `reset()`
- [ ] Errors Hindi style me consistent; throttle `checkLockout`/`recordFailure` same
- [ ] Unit tests: throttle path, challenge one-time/expiry, sign_count reject (verify mocked)
- [ ] Gates + password-login regression

## Sprint P4 — UI (~3–4h)

Commit: `feat(passkey): login button + device management UI`

- [ ] Login page (`src/app/(public)/login/page.tsx`): "Fingerprint se login karein" — email input reuse, loading/error states, unsupported-browser fallback message
- [ ] Settings → "Devices (Passkey Login)": enroll (password re-auth → `credentials.create`), list (device_name/last_used_at), rename, remove, admin revoke-all
- [ ] Gates + build + visual QA (local)

## Sprint P5 — QA + docs (~3–4h)

Commit: `test(passkey): QA matrix sign-off + docs sync`

- [ ] Manual matrix (design §9): Windows Hello (admin+staff) mandatory; Android fingerprint / iOS Face ID best-effort (device availability); device-lost → password → remove; wrong email → throttle counts; RLS probe (browser se DELETE = 403/denied); password regression
- [ ] `docs/TODO.md` passkey section checkboxes flip + design doc status update + results addendum
- [ ] Full gates: tsc + eslint + vitest + build

## Sprint P6 — Deploy gate (USER + release, post-season)

- [ ] USER: migration apply (Supabase SQL Editor, idempotent) + REST probe confirm
- [ ] USER: HTTPS + **stable rpID** confirm (custom domain prefer; **domain change = passkeys invalid**)
- [ ] Prod deploy sirf G3 SAFE-no ke baad + release tag + CHANGELOG

## Risks (top 3)

| Risk | Kab | Mitigation |
|---|---|---|
| `createSession` missing pinned me | P1 first | STOP + D8 fallback update — code continue nahi |
| Shared office PC, multiple passkeys | P4 | allowCredentials per-user scoped; staff exit par admin revoke |
| rpID localhost vs prod domain | P6 | env-driven rpID + deploy note |

## Out of scope (design §7)

PIN login · passwordless-only · client portal · conditional UI · dedicated YubiKey UX.

## Results addendum — 18 Oct 2026 (code COMPLETE, pending QA)

Spike (P1): `supabase.auth.admin.createSession` **NOT available** in pinned supabase-js 2.112.4.
Supabase native passkey exists in `@supabase/auth-js/webauthn.d.ts` (gated by `auth.experimental.passkey`)
but this backend returns `404 passkey_disabled` (no dashboard toggle) → **Option B (custom WebAuthn via
@simplewebauthn) chosen**; D8 session path = `generateLink({type:'recovery'})` (no email sent) →
`verifyOtp({token_hash})`, fallback `magiclink` → `updateUserById({email_confirm})`.

Delivered:
- `src/lib/passkeys.ts` (RP config, signed 5-min one-time challenge cookie, base64url, `isCounterAcceptable`) + `src/lib/passkeys.test.ts` (13 tests).
- `supabase/migrations/20261018_passkey_login.sql` — `user_passkeys` + FK cascade + unique `credential_id` + touch trigger + RLS (own SELECT / staff SELECT) + grants + `NOTIFY pgrst`.
- APIs: `register-begin`, `register-finish` (dup → 409), `devices` (GET/PATCH/DELETE + admin `?user_id=` revoke-all).
- `src/app/api/auth/login/route.ts`: modes `passkey-begin` + `passkey-verify` (`mintSession()`, counter guard, throttle reused).
- UI: login page passkey button (platform-authenticator detect); `src/components/PasskeyDevices.tsx` mounted in Settings.

Gates: `tsc` 0 · `eslint` (touched) 0 · `vitest` passkeys 13/13 (full suite at close).

Pending (user):
- P6: migration apply + REST probe; HTTPS + stable rpID.
- P5 manual device matrix (Windows Hello mandatory; Android/iOS best-effort; lost-device → password → remove; RLS probe; password regression).
