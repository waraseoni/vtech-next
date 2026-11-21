# Login Page — Next Improvements Plan (20 Nov 2026)

> **Baseline:** commit `4e5cf66` (friendly login UX + passkey detection fix already shipped).
> **Target:** `src/app/(public)/login/page.tsx` + chhote supporting files.
> **Language:** Hinglish. **Auth/DB policy:** no service-role in browser, no schema change.

## 1. Background

Pichhle plan (`login_page_friendly_ux_plan.md`) ke baad real feedback aaya:

- PC par bina biometric/camera ke "Fingerprint / Face" button dikhta tha — fix ho gaya
  (`isUserVerifyingPlatformAuthenticatorAvailable()` gate + honest "Device PIN" label).
- Mobile browser par option tab nahi dikhta tha — reason: WebAuthn **secure-context**
  (`HTTPS`/`localhost`) maangta hai; LAN `http://<ip>` par API block hoti hai.

Ab baaki suggestions ko structured plan me badal kar implement kar rahe hain.

## 2. Scope & decisions

| #   | Improvement                                | Priority | Decision                                                                                                                                                                                                                                              |
| --- | ------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Passkey "registered hi nahi" empty-state   | P0       | Implement: `passkey-begin` 404 → friendly hint, silent `NotAllowedError` nahi                                                                                                                                                                         |
| 2   | Forgot-password fallback                   | P0       | **DB check ke baad badla gaya:** staff emails `@vtech.com` non-deliverable → self-service reset aur `/reset-password` page hataaye gaye. Login par WhatsApp + admin instruction; official raasta admin Users → Reset Password.                        |
| 3   | Dev-only HTTPS hint                        | P0       | Implement: sirf `import.meta.env.DEV && !isSecureContext`; production me invisible                                                                                                                                                                    |
| 4   | Accessibility (labels, aria, live regions) | P1       | Implement: `htmlFor`/`id`, `aria-label`, `role="alert"`/`status`, toggle `aria-pressed`                                                                                                                                                               |
| 5   | OTP 8-box segmented input                  | P1       | Implement: paste + auto-advance + backspace + arrows; actual email OTP 8-digit (user test)                                                                                                                                                            |
| 6   | Double-submit prevention                   | P1       | Implement: inputs disabled while loading, `aria-busy`, OTP length gate                                                                                                                                                                                |
| 7   | Native app (WebView) passkey               | P2       | **Deferred (external):** real integration needs Capacitor passkey plugin + Android `assetlinks.json` / iOS Associated Domains + native build + device QA. Interim: WebView me bounded hint already hai; browser HTTPS URL se biometric available hai. |
| 8   | `?next=` deep-link redirect                | P1       | Implement: same-origin path allowlist; login/passkey/OTP all use it                                                                                                                                                                                   |
| 9   | Passkey enrollment nudge after login       | P2       | Implement: one-time localStorage flag + dashboard banner → `/profile`                                                                                                                                                                                 |
| 10  | Detection helper + unit tests              | P1       | Implement: `src/lib/passkey-support.ts` + vitest cases                                                                                                                                                                                                |

## 3. Implementation details

### 3.1 Passkey empty-state

`src/lib/passkeys.ts` server already returns **404 "Is account me koi passkey registered nahi hai"**
jab email ke liye credential nahi milta. Client `beginPasskey()` is 404 ko `code: "NO_PASSKEY"`
error me badalta hai. Login handler tab yahi catch karke inline hint dikhta hai:

> "Is email par abhi passkey saved nahi hai. Password se login karke Profile → Devices me add karein."

Email badalte hi hint clear. Cancel/timeout wala existing message same rahega.

### 3.2 Forgot password (admin-driven)

DB audit me 7 staff/auth users `@vtech.com` (internal, non-deliverable) aur client
`tmp.invalid` mile — yani email par kabhi kuch nahi pahuchega. Self-service reset
galat promise tha ("check your email"), isliye use **hata diya gaya**:

- Login par ab sirf **"Password bhool gaye? Admin se sampark karein"** WhatsApp link +
  chhoti instruction: staff email IDs internal hain, email par reset link nahi aata.
- User feedback ke baad link me **prefilled reset request** bhi hai: staff email + reset
  request (`buildWhatsAppLink()` se encoded `?text=`). Password-related line hata di gayi;
  baaki message staff bhejne se pehle edit kar sakta hai. Email khaali ho to click par
  email field focus + error, taaki admin ko adhoora request na jaye.
- Official flow: **Users → user → Reset Password** → `/api/admin/reset-password`
  (service_role server-side, `requireAdmin()` guard). Email ki zarurat nahi.
- Logged-in user ke liye **Profile → Change password** pehle se kaam karta hai.
- Break-glass: agar admin khud lock ho aur passkey enroll na ho to admin UI se reset
  possible nahi — Supabase dashboard / service-role script se password update karna padega.
- `/reset-password` page, `proxy.ts` allowlist aur uska test bhi delete kiye gaye (dead code).

### 3.3 Dev HTTPS hint

`!window.isSecureContext` par sirf dev me chhota note:
"Passkey ke liye HTTPS chahiye — abhi password se login karein." Production me kabhi nahi.

### 3.4 A11y

- Staff email/password aur client email/OTP inputs ke stable `id`, labels ke `htmlFor`.
- Eye toggle: `aria-label` (show/hide).
- Remember toggle: `aria-pressed` + `aria-label`.
- Error: `role="alert"`; info: `role="status"`; forms: `aria-busy={loading}`.

### 3.5 OTP

8 independent boxes (`inputMode="numeric"`, `maxLength=1`), pehle box par
`autoComplete="one-time-code"`. Paste 8 digits ko distribute karta hai; backspace pichhle
box par jata hai; left/right arrows navigate. Verify button tab 8 digits bhare tabhi active.
⚠️ User test par actual email OTP **8-digit** mila (changelog_aug2026.md me bhi 8-digit OTP
likha hai) — pehle 6-box assumption galat tha, `OTP_LEN = 8` karke theek kiya gaya.

### 3.6 `?next=`

Mount par param padh kar **safe path** validate:
`/` se shuru, `//` ya `\` na ho, scheme/URL na ho. Sab success redirects is path ko use karte
hain, warna staff → `/dashboard`, client → `/my-account`.

### 3.7 Enrollment nudge

Password/passkey login ke baad localStorage `vtech_passkey_nudge=1` set hota hai.
Dashboard par chhota dismissible banner: "1-tap login chahiye? Passkey add karein" → `/profile`.
User dismiss kare to flag clear.

### 3.8 Detection helper + tests

`detectPasskeySupport()` pure-ish async helper:
`{ ready, inNativeApp, insecureContext }`. Login effect aur tests dono yahi use karte hain.
Vitest cases: insecure context, native WebView, API missing, authenticator unavailable, available.

## 4. Non-goals (is round me nahi)

- Native Capacitor passkey plugin / native build / device QA (external dependency).
- Staff/client emails ko real deliverable addresses se replace karna + SMTP setup —
  data change hai, owner approval chahiye. Tabhi self-service reset / client OTP viable honge.
- Login API/DB logic, RLS, service-role rules ya passkey schema me koi badlaav.

## 5. Verification gates

`tsc --noEmit` · `eslint` · `prettier --check --end-of-line auto` · `vitest run` ·
`next build` · browser smoke (login 200, tabs, OTP boxes, console errors 0).

## 6. Status

- [x] Plan file saved (yahi file).
- [x] P0/P1 implementation: passkey empty-state, admin/WhatsApp forgot-password
      fallback, dev HTTPS hint, a11y, OTP 8-box (8-digit email OTP), double-submit gate, `?next=`
      redirect, detection helper + 6 unit tests, dashboard enrollment nudge.
- [x] Hydration mismatch fix: `src/lib/app-version.ts` commit suffix sirf
      production me — dev me server/client alag git hash pakad kar title attribute
      match nahi kar rahe the.
- [x] Final gates (reset fallback ke baad): `tsc` 0 · `eslint` 0 · `prettier` OK ·
      `vitest` **694/694** · `next build` ✓ · browser smoke: `/login` 200, console errors 0,
      inline reset form nahi, admin/WhatsApp fallback dikh raha hai. `/reset-password` ab
      307 (deleted → protected redirect), expected.
- [x] OTP length bug fix: live email me 8-digit code aaya, UI 6 boxes tha → `OTP_LEN = 8`.
- [x] WebView WhatsApp link fix (21 Nov): `<a target="_blank">` Capacitor WebView me no-op tha
      (`onCreateWindow` nahi hota). `src/lib/externalLink.ts` ab browser me nayi tab, native me
      external `ACTION_VIEW` navigation karta hai — `window.open` patch ke load hone ka intezaar
      nahi karta. `<a href>` SSR me preserved (JS-free fallback), 3 unit tests.
- [x] Commit/push approval — user ne 22 Nov ko "commit push kar do" bola; ye
      session me push ho raha hai (WebView fix + dono plan docs + tracker sync).
- [ ] User QA (real device par WhatsApp link tap) — baaki.

### External prerequisites / deferred

- Supabase redirect allowlist ab **zaroori nahi** — `/reset-password` page hi nahi hai.
- **Real email migration (owner decision):** 7 staff `@vtech.com`, client `tmp.invalid`
  → real addresses + custom SMTP ke bina na password reset na client OTP deliver hoga.
- **P2 native passkey** (Capacitor plugin + `assetlinks.json` / Associated Domains
  - native build + device QA) is round me nahi — WebView me bounded hint yahi hai.
