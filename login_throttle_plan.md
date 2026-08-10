# Login Throttle (Brute-Force Protection) — Implementation Plan & TODO

*Status: PLAN ONLY — abhi kuch implement nahi karna.*
*Created: 10 Aug 2026 · Source: `vtech-rsms/classes/LoginThrottle.php` analysis + Next.js/Supabase architecture review*

## 1. Why (Problem Statement)

- Login public hai (`/login`): **staff password login** + **client email OTP** dono browser se.
- Abhi koi custom brute-force lock nahi — sirf Supabase ka built-in rate-limit hai (generic, configurable nahi).
- PHP app me ye feature tha (browser+username), par Next.js/Supabase me **lost ho gaya** during migration.
- Risk: attacker email/password guess karta rahe (dictionary/brute-force), OTP email flood.

## 2. Design Goals (best design ka bar)

| Goal | Kya |
|---|---|
| **Multi-key tracking** | Email + IP dono par track (PHP sirf browser session tha — weak) |
| **Progressive lockout** | 5 fail → 15 min, phir bhi repeat fail par badhta jaye (escalating) |
| **Zero-lockout DoS** | Sirf galat attempts count — sahi user ko kabhi lock nahi karna |
| **IP handling safe** | `x-forwarded-for` se (Vercel proxy), IP spoofing-safe |
| **Fail-closed but user-friendly** | Clear Hindi messages, remaining attempts count |
| **Service-role DB** | Throttle queries server-side (service-role) se — browser client kabhi direct nahi |
| **Cheap & fast** | Har login par 1-2 indexed queries max — no slow full-scan |
| **Operable** | Admin ko locked users list + manual unlock + reset visibility |

## 3. Architecture

```
[ Browser Login Page ]  →  POST /api/auth/check-lock  (OPTION A)   ─┐
                          POST /api/auth/login         (OPTION B)   ├─→  LoginThrottle lib (src/lib/login-throttle.ts)
                          POST /api/client/onboard                  ─┘          │
                                                                                 ├─ record_failure(email, ip)
                                                                                 ├─ check_lockout(email, ip)
                                                                                 └─ reset(email, ip)
                                                                                          │
                                                                              [ supabase login_throttle table ]  (service-role)
```

### IMPORTANT DESIGN DECISION — Kahan throttle enforce karein?

> **Supabase `signInWithPassword` / `signInWithOtp` DIRECTLY browser se call ho rahe hain** (`src/app/login/page.tsx:54,84`).
> Throttle ko enforce karne ke liye login ko **API route se** pass karna padega, ya to:

| Option | Kya | Pros | Cons |
|---|---|---|---|
| **A. Pre-check API** (`/api/auth/check-lock`) | Login form submit → pehle API check → agar lock nahi to browser se Supabase call | Login flow me big change nahi | Lock aane se pehle wali failed attempt count record nahi ho paata (browser directly Supabase call karta hai, failure bhi wahi aata hai) — sirf lock enforcement, fail-count nahi |
| **B. Full proxy login** (`/api/auth/login`) | API route hi `signInWithPassword`/`signInWithOtp` call kare, fail par throttle record | **Pura control** — fail-count, lock, IP, sab API me | Sabse sahi. Login page thoda change karna hoga (direct supabase call → fetch API) |
| **C. Client-side attempt counter** | Browser me count kare | Zero server work | Trivially bypassable (refresh/incognito) — REJECT |

> **Recommendation: Option B (proxy login).** PHP wale me bhi yahi pattern tha (PHP class server-side tha). Client OTP (`signInWithOtp`) bhi isi route se jaaye. Portal page (`/my-account`) me session creation wahi bachta hai — koi behavior change nahi.

### IP handling (safe way)
- `request.headers.get("x-forwarded-for")` → first IP (Vercel set karta hai, spoof-proof upstream se)
- Fallback: `x-real-ip`, fir connection remote address
- IPv4-mapped IPv6 normalize (`::ffff:1.2.3.4` → `1.2.3.4`)

## 4. DB Schema — `login_throttle` (Supabase)

```sql
create table if not exists public.login_throttle (
  id             bigint generated always as identity primary key,
  email          text not null,                          -- lowercased, trimmed
  ip_address     text not null,                          -- normalized client IP
  attempt_count  integer not null default 0,
  first_attempt_at timestamptz,
  lockout_until  timestamptz,
  last_attempt_at  timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Lock check: email se (fast, indexed)
create unique index if not exists login_throttle_email_uniq
  on public.login_throttle (lower(email));

-- IP-based flood detection
create index if not exists login_throttle_ip_idx
  on public.login_throttle (ip_address);

-- Cleanup (purana data auto-delete)
create index if not exists login_throttle_updated_idx
  on public.login_throttle (updated_at);

-- RLS: browser client ke liye CLOSED (sirf service-role server-side use karega)
alter table public.login_throttle enable row level security;
-- koi policy nahi = anon/authenticated ke liye zero access (deny by default)
```

**Migration file:** `supabase/migrations/20260810_login_throttle.sql`

## 5. Core Library — `src/lib/login-throttle.ts`

```
CONFIG (const):
  MAX_ATTEMPTS        = 5          // galat attempts allowed
  WINDOW_MINUTES      = 15         // counting window
  LOCKOUT_MINUTES     = 15         // base lockout duration
  ESCALATE_FACTOR     = 2          // har repeat lock par duration ×2
  MAX_LOCKOUT_MINUTES = 1440       // cap: 24 hours
  IP_MAX_ATTEMPTS     = 30         // ek IP se kitne alag emails par tries allowed
  IP_WINDOW_MINUTES   = 60

FUNCTIONS:
  getClientIp(request) -> string
  checkLockout(email, ip) -> { locked: boolean, remaining_seconds?: number }
  recordFailure(email, ip) -> { attempts_left: number, remaining_seconds?: number }
  reset(email)            -> void          // login success par
  cleanupOld(olderThanMinutes=1440) -> void // scheduled/maintenance

LOGIC (mirror PHP LoginThrottle + improvements):
  1. checkLockout:
     - row = SELECT lockout_until WHERE lower(email)
     - lockout_until > now() → locked + remaining seconds
     - expired → reset counter (fresh window), allow
  2. recordFailure:
     - INSERT on first fail (attempt_count=1)
     - window expire hone par counter reset
     - attempt_count >= MAX → lockout_until = now + (LOCKOUT × ESCALATE^repeats) capped
     - return attempts_left (5 → 4 → 3...0)
  3. IP guard (extra):
     - IP se > IP_MAX_ATTEMPTS distinct emails par failures → us IP se login block 15 min
     - Preventa distributed brute-force (ek IP se 50 emails try)
  4. reset: DELETE row email par (login success)
```

### Escalation logic (PHP se improvement)
```
lock #1 → 15 min
lock #2 (release ke baad fir se 5 fail) → 30 min
lock #3 → 60 min
...cap at 24 hours
```
Isse attacker ko "wait 15 min fir se try" ki strategy block ho jati hai.

## 6. API Routes (2 naye)

### `/api/auth/login/route.ts` — proxy login (Option B)
```
POST body: { mode: "password", email, password } | { mode: "otp", email }
          | { mode: "verify-otp", email, token }

FLOW (password):
  1. getClientIp(request)
  2. lock = checkLockout(email, ip); locked → 429 + remaining seconds (Hindi msg)
  3. supabase.auth.signInWithPassword({ email, password })
     - success → reset(email); return session ok
     - error   → recordFailure(email, ip); return 401 + attempts_left (Hindi msg)
     - Supabase "Invalid login" bhi normal failure count karta hai (PHP jaisa)

FLOW (otp request):
  1. checkLockout(email, ip) → locked? 429
  2. IP flood guard: ip attempts check
  3. supabase.auth.signInWithOtp({ email, options:{ shouldCreateUser:true } })
     - rate error ("OTP limit") → Supabase ka rate-limit message pass through

FLOW (verify-otp):
  1. supabase.auth.verifyOtp({ email, token, type:"email" })
  2. success → /api/client/onboard logic (merge karna) — ya alag rakho
  3. fail (3+ wrong OTP) → lock email 10 min (OTP guess protection)

AUTH: ye route PUBLIC (login se pehle) — isliye requireStaff NAHI
SAFETY: email/ip har response me kabhi nahi — sirf generic Hindi message
```

### `/api/admin/throttle/route.ts` — admin ops (admin-only)
```
GET  → list locked users: email, attempts, lockout_until, last_attempt_at
     → search by email, sort by lockout_until desc
     → stats: total locked, locked in last 24h, active locks count
DELETE /unlock → body: { email } → reset(email) (admin manual unlock)
DELETE /clear-ip → body: { ip } (flooded IP unblock)
```

## 7. Frontend Changes

### `src/app/login/page.tsx` (moderate)
- `handleLogin` (line ~49): `supabase.auth.signInWithPassword` → `fetch("/api/auth/login")`
- `handleSendOtp` (line ~78): `signInWithOtp` → `fetch("/api/auth/login", { mode:"otp" })`
- `handleVerifyOtp` (line ~103): `verifyOtp` → `fetch("/api/auth/login", { mode:"verify-otp" })`
- UI messages:
  - 429 → red alert: "Bahut saare galat attempts. **X min** baad try karein."
  - 401 → red alert: "Email ya password galat! **N attempts** baaki."
  - Success → onajaisa redirect (remember-me flow waisa hi)
- Loading state, error clearing — already hai, preserve karna

### Client OTP wrong-code counter (naya UI element, optional)
- Verify fail par UI me: "OTP galat. N tries baaki (10 min ke andar lock ho jayega)."

## 8. Migration & Operational

- [ ] `supabase/migrations/20260810_login_throttle.sql` banaiye (schema #4)
- [ ] Supabase SQL editor me apply kariye
- [ ] Storage/RPC trigger cleanup (koi nahi chahiye — table direct hi use hoti hai)
- [ ] `.env.example` me koi change nahi (koi naya secret nahi)

## 9. Testing Checklist

- [ ] 5 galat password → 6th try par locked, msg "15 min baad"
- [ ] Lock ke andar sahi password bhi reject ho (locked check pehle hota hai)
- [ ] Lock release (15 min / DB update se simulate) → reset → phir sahi password chale
- [ ] Naye browser/IP se same email — **alag counter** (email+IP key)
- [ ] Ek hi IP se 30+ alag emails par fail → IP block 15 min
- [ ] Correct password → reset → sab clear
- [ ] Client OTP request → 5 fail OTPs → email lock
- [ ] Client OTP correct → login works
- [ ] `requireStaff/requireAdmin` wale saare routes unaffected (throttle sirf /api/auth/login me)
- [ ] `npx tsc --noEmit` pass
- [ ] `npm run build` pass
- [ ] Print/export/chat koi regression nahi (throttle unse disconnected)
- [ ] Migration idempotent (dobara run karne par error nahi)

## 10. Edge Cases & Decisions (open questions)

- [ ] **Admin ke liye unlock UI kahan:** `/users` page me inline, ya settings me? (recommend `/users` list me "Locked" badge + unlock button)
- [ ] **Email par lock notification:** locked hone par admin ko email/WhatsApp alert? (Phase 2, optional)
- [ ] **IP allowlist:** office IPs throttle se exempt? (recommend: nahi — siwaye admin ke)
- [ ] **remember-me flow:** API proxy me localStorage logic waisa hi rakho (login page me already hai)
- [ ] **Supabase rate-limit vs humara:** dono coexist — Supabase ka apna generic + hamara custom. Message me "OTP limit" Supabase wala dikh hi jata hai (line 90).
- [ ] **shouldCreateUser=true par OTP:** naya user create hone se pehle lock check ho raha hoga — ensure order (check lock → signInWithOtp)
- [ ] **Rate-limit response status:** 429 (Too Many Requests) use karo, 401 sirf galat credentials ke liye

## 11. Effort Estimate

| Task | Hours |
|---|---|
| Migration + schema | 0.5–1 |
| `login-throttle.ts` lib | 1–2 |
| `/api/auth/login` (3 modes) | 2–3 |
| `/api/admin/throttle` | 1 |
| Login page rewire | 1–1.5 |
| Test + build + regression | 1–2 |
| **Total** | **~6–10 hrs (1–1.5 din)** |

## 12. Future / Extension Ideas (Phase 2+, abhi nahi)

1. **Failed-login alert** — 5 fails ke baad admin ko WhatsApp/email notify (existing WhatsApp infra use karein)
2. **Geo/IP blacklist** — foreign/known-bad IPs se login deny (Supabase Edge Function ya in-app)
3. **Password reset with throttle** — forgot-password route par bhi same lock
4. **Audit log** — failed attempts `activity_logs` me (join with existing logging lib)
5. **Captcha** — IP/email suspicious hone par reCAPTCHA/Cloudflare Turnstile (5th attempt ke baad)
6. **Scheduled cleanup** — old throttle rows delete (edge cron / maintenance route)
7. **Admin alert dashboard card** — "X accounts locked" dashboard widget
8. **Real-time lock** — supabase realtime se admin ko live lock events (niche-priority)

---

## ⚡ EXECUTION ORDER (jab implement karna ho — ye hi TODO hai)

1. ✅ (done) Design review + plan document
2. ✅ (done 10 Aug) Migration file: `supabase/migrations/20260810_login_throttle.sql` bana — **Supabase SQL editor me apply baaki** (`lock_repeats` escalation column included)
3. ✅ (done 10 Aug) `src/lib/login-throttle.ts` (config, IP normalize, lock/fail/reset, escalation)
4. ✅ (done 10 Aug) `/api/auth/login/route.ts` (password + otp + verify-otp modes, 429/401 messages)
5. ✅ (done 10 Aug) Login page rewire (supabase → fetch API), Hindi messages, 3 handlers API se
6. ✅ (done 10 Aug) `/api/admin/throttle/route.ts` + admin UI (`/settings/throttle`, unlock modal + search)
7. ✅ (done 10 Aug) Test checklist (#9) — live DB: RLS closed (anon deny sab CRUD), 5 fail→15m lock, 6th block, escalation→30m, reset. **Bug fix**: escalation logic `login-throttle.ts` me (windowExpired pe increment — pehle kabhi trigger nahi hota tha). `tsc` + `build` pass
8. ✅ (done 10 Aug) Deploy — `a965c5b` pushed → Vercel (migration pehle se apply)
9. [ ] (Phase 2) Alert/audit/captcha/cleanup — jab requirement aaye
