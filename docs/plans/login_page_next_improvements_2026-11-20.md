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
| 2   | Self-service forgot-password flow          | P0       | Implement: inline email form + `/reset-password` page. Supabase dashboard me redirect URL allowlist **external prerequisite** (doc me note). Admin/WhatsApp fallback bhi rahega.                                                                      |
| 3   | Dev-only HTTPS hint                        | P0       | Implement: sirf `import.meta.env.DEV && !isSecureContext`; production me invisible                                                                                                                                                                    |
| 4   | Accessibility (labels, aria, live regions) | P1       | Implement: `htmlFor`/`id`, `aria-label`, `role="alert"`/`status`, toggle `aria-pressed`                                                                                                                                                               |
| 5   | OTP 6-box segmented input                  | P1       | Implement: paste + auto-advance + backspace + arrows; API 6-digit Supabase OTP                                                                                                                                                                        |
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

### 3.2 Forgot password

- Login card me "Password bhool gaye?" ab inline panel kholta hai (email prefill).
- `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/reset-password })`.
- Success message **generic**: "Agar email registered hai to reset link bhej diya gaya."
- Naya public page `/reset-password`: recovery session se naya password set karta hai
  (`supabase.auth.updateUser`), min 6 chars, success par `/login`.
- Admin/WhatsApp link secondary option ke taur par bana rahega.

### 3.3 Dev HTTPS hint

`!window.isSecureContext` par sirf dev me chhota note:
"Passkey ke liye HTTPS chahiye — abhi password se login karein." Production me kabhi nahi.

### 3.4 A11y

- Staff email/password aur client email/OTP inputs ke stable `id`, labels ke `htmlFor`.
- Eye toggle: `aria-label` (show/hide).
- Remember toggle: `aria-pressed` + `aria-label`.
- Error: `role="alert"`; info: `role="status"`; forms: `aria-busy={loading}`.

### 3.5 OTP

6 independent boxes (`inputMode="numeric"`, `maxLength=1`), pehle box par
`autoComplete="one-time-code"`. Paste 6 digits ko distribute karta hai; backspace pichhle
box par jata hai; left/right arrows navigate. Verify button tab 6 digits bhare tabhi active.

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
- Supabase dashboard redirect allowlist change — repo se bahar ka config, release checklist me likha hai.
- Login API/DB logic, RLS, service-role rules ya passkey schema me koi badlaav.

## 5. Verification gates

`tsc --noEmit` · `eslint` · `prettier --check --end-of-line auto` · `vitest run` ·
`next build` · browser smoke (login 200, tabs, OTP boxes, console errors 0).

## 6. Status

- [x] Plan file saved (yahi file).
- [x] P0/P1 implementation: passkey empty-state, self-service reset page + proxy
      allowlist, dev HTTPS hint, a11y, OTP 6-box, double-submit gate, `?next=`
      redirect, detection helper + 6 unit tests, dashboard enrollment nudge.
- [x] Hydration mismatch fix: `src/lib/app-version.ts` commit suffix sirf
      production me — dev me server/client alag git hash pakad kar title attribute
      match nahi kar rahe the.
- [x] Final gates: `tsc` 0 · `eslint` 0 · `prettier` OK · `vitest` **695/695** ·
      `next build` ✓ · browser smoke (login 200, reset 200, console errors 0).
- [ ] User QA + commit/push approval.

### External prerequisites / deferred

- `/reset-password` ko Supabase dashboard → Authentication → URL Configuration me
  redirect allowlist me daalna zaroori hai (production domain + localhost). Ye repo
  se bahar ka config hai.
- **P2 native passkey** (Capacitor plugin + `assetlinks.json` / Associated Domains
  - native build + device QA) is round me nahi — WebView me bounded hint yahi hai.
