# Production Hardening Plan — Public Tracking, Security & Data Safety

**Created:** 2026-10-28
**Status:** PARTIALLY IMPLEMENTED (2026-10-28) — Phase 1 + WS-A/WS-C code complete; DB untouched
**Owner:** Vikram / V-Tech

### Implementation status (2026-10-28)

Done (no DB changes):
- A1 `src/lib/tracking-token.ts` (HMAC stateless token, constant-time verify)
- A2 `/api/public/job-status`: `recent=1` → 410, IP rate limit 60/min, ID validation,
  generic errors, `no-store`/`noindex`, limited vs full response
- A3 public page: server recent list removed, browser-local recent lookups, URL
  `job_id`/`code`/`token` auto-search, limited view hides amount/remark, print carries token
- A4 `print-job-status`: token-aware limited/full print + 30/min rate limit
- B1 `activity-users` now requires staff session
- B2 baseline security headers in `next.config.ts`, including
  `Content-Security-Policy-Report-Only` (enforce later after prod noise check)
- B3 `/api/chat` per-user 20/min rate limit with `Retry-After` (429 verified by unit path)
- B4 raw DB/Supabase errors client ko nahi jaate — setup, client portal, seller, developer,
  license aur upload routes me `logger.error` + generic message
- B8 `/api/health` — read-only `system_info` probe (3s timeout), version/commit,
  env-presence booleans, 200/503, rate-limited; uptime monitor ke liye
- B9 `proxy.ts` API responses par default `Cache-Control: private, no-store` (customer
  data browser/CDN heuristic cache me na jaye)
- B5 shared `src/lib/image-upload.ts` (magic-byte JPEG/PNG/WebP, extension + content-type
  server-decided) applied to all 7 image upload routes; signature canvas data URL restricted
  to raster PNG/JPEG/WebP + 500KB cap; SVG/HTML payloads rejected
- B6 `setup` single-flight lock (per instance) + 10/hour/IP throttle with `Retry-After`
- B7 all 23 print routes ab `src/lib/print-html.ts` se serve hote hain: per-request nonce CSP
  (`default-src 'none'`, `script-src 'nonce-…'`), inline `onclick` → data-attributes +
  nonced bridge, `no-store`, `nosniff`. Client/item/remark text me injected `<script>` ab
  execute nahi hota (stored XSS in print previews blocked)
- A3+ public `/job-status` par `robots: noindex, nofollow` metadata
- C1 shared `src/lib/print-shop.ts`; **19 print routes + export-transactions** now read
  branding from `system_info`/env instead of hardcoded V-Technologies
- C2/C3 local `qrcode` generation; `https://vtech-rsms` removed; tracking QR uses
  `NEXT_PUBLIC_SITE_URL`/request origin + signed token. Also replaced the last
  `api.qrserver.com` usage (inventory location labels).
- E1 e2e writes double-gated by `E2E_ALLOW_WRITES` **and** `E2E_WRITE_HOST` host match
- E3 unit tests added: `tracking-token` (14), `rate-limit` (8), `print-shop` (8)
- Smoke (dev, read-only): public page loads, `recent=1` → 410, known job renders, local
  recents work, URL `job_id/code/token` auto-search works, print opens with token,
  headers present, rate limit returns 429, unauth `/api/activity-users` → 401,
  print page par nonce-CSP + data-attribute buttons + `no-store` verified
- Verification: `tsc --noEmit` clean, eslint/prettier clean, Vitest **515/515** pass

Pending: phone-last-4 fallback, Upstash/Redis distributed rate limit, CSP enforce
(report-only ke baad), WS-D write integrity, WS-E staging project, WS-F offsite backup,
WS-G refactors.

---

## 0. Hard Constraints (inko har item par apply karna hai)

1. **DB frozen hai.** Koi schema change, migration, seed, test row, UPDATE/DELETE nahi.
   Is plan ka **har item "DB impact: None"** hai. Jo cheezein DB change maangti hain,
   woh §7 "Parking Lot" me hain aur bina explicit approval ke nahi hongi.
2. **E2E writes band.** `E2E_ALLOW_WRITES` env se hata diya gaya hai. Write specs
   default suite me kabhi nahi chalengi. Staging-only quarantine (§5).
3. **Public tracking feature intentional hai.** Client bina login apne job ka
   status dekh sakta hai. Isko hatana nahi hai — isko **enumerate-proof, rate-limited
   aur PII-safe** banana hai.
4. **Live data sacred.** Har change ke baad verification sirf read-only (GET/SELECT).
   Koi "temporary test entry" nahi.
5. Changes chhote PRs me, feature-flag/backward-compatible rollout ke saath.

---

## 1. Current-State Findings (evidence)

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| F1 | High | `recent=1` public endpoint last 10 jobs (item + status) sabko dikhata hai — doosre customers ka data | `src/app/api/public/job-status/route.ts:12` |
| F2 | High (functional) | Printed bill/invoice ka tracking QR hardcoded `https://vtech-rsms/...` — scan par kuch nahi khulta | `src/app/api/print-bill/route.ts:395`, `src/app/api/print-combined-invoice/route.ts:392` |
| F3 | High (privacy) | Job ID sequential + guessable; lookup par amount, service/product prices aur internal remark bhi milte hain | `src/app/api/public/job-status/route.ts:29`, page `430-500` |
| F4 | High | `/api/activity-users` bina auth, service-role se staff/mechanic names enumerate ho sakte hain | `src/app/api/activity-users/route.ts:13` |
| F5 | High (white-label) | **19/23 print routes** me `V-Technologies` + phone hardcoded (15 `SHOP` const + 4 HTML-embedded); client ka bill galat branding se print hota hai. `export-transactions` title bhi hardcoded. | `src/app/api/print-advance/route.ts:9` (representative) |
| F6 | Medium | Public tracking, print, AI par koi rate limit nahi (sirf login par throttle hai) | `src/lib/login-throttle.ts` (only login) |
| F7 | Medium | HTTP security headers (CSP/frame-ancestors/HSTS/Referrer-Policy) missing | `next.config.ts:74` |
| F8 | Medium | QR external `api.qrserver.com` par depend karta hai — offline fail, UPI ID third party ko jaata hai | `src/app/api/print-bill/route.ts:387-395` |
| F9 | High (data integrity) | Job save non-atomic: job update → services insert → products insert; beech me fail = aadha job | `src/app/jobs/new/page.tsx:652,697,713` |
| F10 | Low | Raw DB error messages client ko jaate hain | `src/app/api/public/job-status/route.ts:34` |
| F11 | Low/Med | Upload me sirf size check; file content/type verify nahi | `src/app/api/job-images/route.ts:57-70` |
| F12 | Medium | 92 API routes me sirf 9 Zod `parseBody` use karte hain; 213 direct browser writes | repo scan |
| F13 | Medium (debt) | Monolith files (JobsBody 3027 lines etc.), `useMutation` 0 | repo scan |
| F14 | Low | 4 `backup_comm_*.json` git-tracked (business data in history), 596MB `.next`, bade dumps | `git ls-files` |
| F15 | High (ops) | Cloud backup usi Supabase project me hai; offsite encrypted copy automatic nahi | `src/lib/scheduledBackup.ts:62` |
| F16 | High (ops) | `.env.local` live project par point karta hai; 26 Oct e2e ne 46 rows banaye the | `docs/DB_CHANGES_E2E_AUDIT_2026-10-26.md:24` |

---

## 2. WS-A — Public Tracking Hardening (DB impact: None)

Goal: feature wahi rahe, par koi doosre ka data na dekh sake aur scrape na ho.

### A1. Stateless signed tracking token (no DB column)

- Naya `src/lib/tracking-token.ts`:
  - `signTrackingToken(jobId, code)` → `v1.<hmac>`; HMAC-SHA256 over `jobId:code`, truncate 16 bytes, base64url.
  - `verifyTrackingToken(jobId, code, token)` → boolean, `crypto.timingSafeEqual`.
  - Secret: `PUBLIC_TRACKING_SECRET` (server-only, 32+ random bytes). Secret missing → feature
    fail-closed for full details (limited view only), warning log.
- Token permanent (warranty/old slips ke liye). Secret rotation par purane QR limited view
  par fallback karenge — documented.
- Unit tests: valid/invalid/tampered/missing-secret/constant-time path.

### A2. API response matrix (`/api/public/job-status`)

| Request | Response |
|---|---|
| `job_id` + `code` + valid `token` | Full: item, fault, status, dates, amount, service/product lines |
| `job_id` + `code`, **no/invalid token** | Limited: job_id, code, item, fault, status, dates. **No amount, no prices, no remark** |
| `phone` (last 4) match with client record | Full (legacy slips ke liye escape hatch; **implemented**, 10 attempts / 10 min / IP) |
| `recent=1` | **Removed** — 410/`[]` |
| > N requests/min/IP | `429` with `Retry-After` |

- `remark` sirf token/phone-verified request par. Internal notes leak na hon.
- Response headers: `Cache-Control: no-store`, `X-Robots-Tag: noindex`.
- Error messages generic (`Job not found`), actual error `logger.error` me.

### A3. Public page UX

- `recent=1` fetch hatao (`src/app/(public)/job-status/page.tsx:89`).
- Uski jagah **browser-local "Aapke recent lookups"** — `localStorage` me `{jobId, code, token, ts}`.
  Koi server/global list nahi.
- QR/WhatsApp link se aane par `token` query param automatically use ho.
- Manual search (Job ID + Code) par limited view + "Full bill dekhne ke liye QR scan karein
  ya registered phone ke last 4 daalein" CTA.
- Print button token ke saath `print-job-status` khole.

### A4. Print status endpoint

- `src/app/api/print-job-status/route.ts`: same token/phone verification, no token = limited
  print (status slip), full bill sirf verified.
- Rate limit + `no-store`.

### A5. Old links compatibility

- Pehle 2 hafte dual-mode: token optional (limited view), phir full-detail enforcement.
- Sabhi naye QR/WhatsApp links token ke saath generate honge.

**Acceptance:** `recent` se koi global data nahi; script se 100 sequential job IDs hit karne par
amount/remark nahi milta; 429 after threshold; token valid hone par full data; existing slips
phone-last-4 se kaam karte hain.

**Rollback:** `PUBLIC_TRACKING_ENFORCE` env flag. Default off = current UX preserved (full
details, tokens still generated). `1` = full enforcement (token/phone valid → full, otherwise
limited). Code rollback safe, DB untouched.

---

## 3. WS-B — Auth, Edge Security & Input (DB impact: None)

### B1. `activity-users` guard

- `requireStaff()` add karo; `ids` max 100; invalid → 400.
- Test: 401 without session, 200 with staff.

### B2. Security headers (`next.config.ts`)

- `Content-Security-Policy` (report-only se start): default-src 'self'; img-src 'self' data: https://*.supabase.co; connect-src 'self' https://*.supabase.co; frame-ancestors 'self' (AI drawer iframe).
- `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` (prod).
- Public tracking pages par `noindex` (result view).

### B3. Rate limiting (no Supabase table)

- Primary: Upstash Redis free tier (`UPSTASH_REDIS_REST_URL/TOKEN`) ya Vercel KV.
- Fallback: in-memory fixed window (per instance) — documented limitation.
- Routes: `/api/public/job-status`, `/api/print-job-status`, `/api/print-*`, `/api/chat`,
  `/api/auth/login` (existing throttle ke upar), `/api/setup`.
- Limits: tracking 30/min/IP; print 10/min/user; chat 20/min/user; setup 5/hour/IP.
- 429 + `Retry-After`; log only hashed IP.

### B4. Error sanitization

- Public/AI/print routes: generic client message; full error `logger.error` (no PII).
- Grep target: `error.message` direct JSON responses.

### B5. Upload validation

- `job-images`, `client-photo`, `mechanic-photo`, `product-image`, `spare-photos`,
  `repair-images`: magic-byte check (JPEG/PNG/WebP), allowed MIME + extension match,
  max dimensions; reject SVG/HTML. Storage content-type server-decided.

### B6. Setup route

- `SETUP_TOKEN` ko client packages ke liye **mandatory** recommend karo (env docs + package
  script). Missing token + no admin = setup open; race par double-admin. Add in-memory
  single-flight lock (no DB).

---

## 4. WS-C — White-Label Print & QR (DB impact: None)

### C1. Single shop-info helper

- Naya `src/lib/print-shop.ts`:
  - `getPrintShop()` → `{name, address, mobile, email, gstin, upiId}` from `system_info`
    (service-role, per-request cache; 60s module TTL).
  - Fallback: env `NEXT_PUBLIC_SITE_*`, phir generic "Your Shop" — **kabhi hardcoded
    V-Technologies nahi** except seller's own default.
- Replace `SHOP` consts / HTML branding in **19 routes** (DB se `system_info`, fallback env):
  - `print-advance`, `print-balancesheet`, `print-client-ledger`, `print-clients`,
    `print-commission`, `print-delivered`, `print-direct-sales`, `print-job-status`,
    `print-ledger`, `print-mechanic-detail`, `print-mechanic-ledger`,
    `print-mechanics-commission`, `print-monthly-sales`, `print-salary`,
    `print-transactions` (SHOP const)
  - `print-custom-sales`, `print-custom-service`, `print-loan`, `print-top-customers`
    (HTML me hardcoded)
  - `export-transactions` (title) bhi helper par shift karo
- Already dynamic (fallback ok): `print-bill`, `print-combined-invoice`,
  `print-direct-sale-invoice`, `print-purchase-order`, `client/ledger`.

### C2. QR generation locally

- `qrcode` package already dependency. Replace `api.qrserver.com` with server-side
  `QRCode.toDataURL()` — offline-safe, UPI ID third party ko nahi jaata.
- UPI QR unchanged content; tracking QR includes token.

### C3. Tracking URL

- `NEXT_PUBLIC_SITE_URL` (already used for branding) se base URL; fallback request origin.
- `print-bill` + `print-combined-invoice` ka hardcoded `https://vtech-rsms` hatao.
- Test: generated HTML me `https://vtech-rsms` absent; token present; QR data URL local.

**Acceptance:** Har client ke print par uska naam/phone; QR scan se tracking page token ke
saath khulta hai; internet off hone par bhi bill me QR image embedded.

---

## 5. WS-D — Financial Write Integrity (DB impact: None)

### D1. Server-side totals (recommended)

- Naya server route/action `save job` jo line items leta hai aur **DB se prices/commission
  dobara compute** karta hai; client ke totals sirf display.
- Abhi client-side calculations trust ho rahi hain (`jobs/new`).
- No DB change; writes wahi tables.

### D2. Compensating rollback (interim, until approved RPC)

- Job save wrapper: agar service/product insert fail ho → created rows + job delete karo
  (best-effort), user ko clear error. `jobs/new` + `jobs/[id]/edit` dono.
- Idempotency: submit button single-flight + server-side duplicate check (same code within
  60s) — in-memory/Redis, no DB.

### D3. Zod rollout (priority order)

1. jobs save/edit
2. payments (client/direct/supplier)
3. expenses
4. inventory/purchase orders
5. attendance/advance/salary
6. settings/system_info
- Shared schemas `src/lib/validation/schemas/`; 400 with field errors; no raw DB errors.

### D4. React Query mutations

- `useMutation` adopt karo financial writes ke liye: single invalidation point, error toast,
  optimistic update, retry policy. Existing `queryClient` use karo.

---

## 6. WS-E — Testing & CI (E2E writes removed)

### E1. Quarantine write specs

- `e2e/smoke/job-create.spec.ts`, `direct-sale.spec.ts` → `e2e/write/` (default `testIgnore`).
- `E2E_ALLOW_WRITES` concept hatao; naya gate: `E2E_TARGET=staging` **and** host allowlist
  (`staging.*` / localhost), warna hard fail.
- Safety assert: `NEXT_PUBLIC_SUPABASE_URL` production ref ho to write suite refuse kare.

### E2. Read-only e2e (default)

- login, dashboard load, job list/search, public tracking (mock/known ID), print HTML 200,
  AI drawer open, settings render.
- Kabhi `Create/Save` click nahi.

### E3. Unit/contract tests (new)

- tracking-token (valid/invalid/rotation)
- print-shop resolution + fallback
- rate-limit window logic
- API guards: 401/403 for activity-users, print, public
- money/commission recalculation
- markdown href sanitization (defense-in-depth)

### E4. CI

- `ci.yml`: lint, typecheck, unit, format, schema-drift, build (already).
- Add `npm run test` coverage floor for `src/lib` (start 60%, raise).
- `e2e.yml`: push = read-only only; write suite manual + staging environment approval.

---

## 7. WS-F — Ops, Backups & Observability (DB impact: None)

### F1. Staging project

- Alag Supabase project (free tier) + `.env.e2e.local`; e2e writes sirf wahan.
- Production secrets staging me kabhi nahi.

### F2. Offsite encrypted backup (no Supabase change)

- GitHub Action (nightly): download latest from private `backups` bucket → `age`/`gpg`
  encrypt → Cloudflare R2/S3 free tier. Retention 30 daily + 12 monthly.
- Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `R2_*`, `BACKUP_AGE_PUBLIC_KEY`.
- Restore drill: monthly staging me restore + row-count diff (read-only source).

### F3. Monitoring

- Sentry DSN production + release tag (`NEXT_PUBLIC_APP_VERSION`); sourcemaps upload
  (currently disabled) — Sentry artifact upload via CI token.
- Uptime monitor on `/` and `/login`; alert email/Telegram.
- New `/api/health` (no DB writes): env presence + 1 read-only `select 1`-equivalent
  (e.g., `system_info` limit 1) + version/commit. — **implemented**
- Uptime monitor is endpoint ko production me hit kare; alert email/Telegram.

### F4. Migration manifest

- DB frozen period me koi migration nahi. Aage ke liye `supabase/migrations/APPLIED.md`
  manifest (filename, date, applied-by, verified-by). CI schema-drift already hai.

---

## 8. WS-G — Refactor (behavior-preserving, after safety fixes)

| Item | Target | Guard |
|---|---|---|
| G1 | `JobsBody.tsx` (3027) → hooks + list/detail/modals | read-only e2e + unit before/after |
| G2 | `clients/[id]/view/page.tsx` (2654) split | screenshot diff (manual) |
| G3 | Shared `ReportLayout` for 28 report pages | one page pilot |
| G4 | `STATUS_MAP` single source (`status-colors.ts`) | unit test |
| G5 | Dead code (`salary/page` redirect, `notify.ts` if unused) | grep/0 imports |
| G6 | Remove `version:patch/minor/major` scripts | semantic-release only |

---

## 9. WS-H — Repo Hygiene (DB impact: None)

- `[x]` `backup_comm_20260912*.json` (4 files, 1526 rows each) untracked
  (`git rm --cached`, local copies intact) + `.gitignore` me `backup_comm_*.json`.
  Commit pending. **History rewrite decision alag** (force-push + filter-repo
  chahiye; tabhi jab repo shared/public ho).
- Root artifacts (`vtech_backup_*.json`, `.apk`, `mariadb dump/`) delete/archive outside repo;
  sab already gitignored, sirf disk hygiene.
- `.next` (596MB) clean; `backups/` 15MB archive.
- `.gitignore` stale rules audit.

---

## 10. Execution Order

| Phase | Items | Effort | Risk | Rollback |
|---|---|---|---|---|
| **0 — Decisions** | §12 answers, `PUBLIC_TRACKING_SECRET`, `NEXT_PUBLIC_SITE_URL`, rate-limit provider | 0.5d | None | N/A |
| **1 — Week 1** | F4 guard, F2 QR URL, F5 print branding, F7 headers, F6 rate limit, F10 errors | 3–4d | Low | Code revert; no DB |
| **2 — Week 2** | WS-A token + limited/full matrix, recent removal, local recents, print token | 4–5d | Medium | flag off = old UX; on = enforcement |
| **3 — Week 3** | WS-D server totals, compensating rollback, Zod top 5, RQ mutations | 5–7d | Medium | Feature flag; shadow compare totals |
| **4 — Month 2** | WS-E tests/staging, WS-F offsite backup + monitoring, WS-H hygiene | 4–6d | Low | Revert workflow |
| **5 — Month 3** | WS-G refactors | 2–3 weeks | Medium | Incremental PRs |

**Hard rule:** Phase 1 ke bina Phase 2 deploy na karo; Phase 4 (staging) se pehle koi naya
e2e write test na likho.

---

## 11. Env / Secrets (new)

| Var | Where | Purpose |
|---|---|---|
| `PUBLIC_TRACKING_SECRET` | server | HMAC for tracking token (32+ bytes) |
| `NEXT_PUBLIC_SITE_URL` | public | QR + tracking link base |
| `PUBLIC_TRACKING_ENFORCE` | server | **`1` recommended** (secret set hone ke baad). `1` = token/phone valid → full, warna limited. Unset/`0` = purana full-view behaviour |
| `UPSTASH_REDIS_REST_URL/TOKEN` | server | rate limiting (or Vercel KV) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | server/public | error monitoring |
| `R2_*` / `BACKUP_AGE_PUBLIC_KEY` | CI | offsite encrypted backup |

Koi secret code/repo me nahi. `.env.example` me sirf placeholders.

---

## 12. Open Decisions (user confirmation chahiye)

1. **Full details (amount/prices/remark) token ke bina dikhein ya nahi?**
   Recommendation: manual Job ID + Code par limited; full only token/phone-verified.
   **Abhi:** `PUBLIC_TRACKING_ENFORCE` unset → purana behaviour (full). Production me
   token rollout ke baad `1` karna hai.
2. **Phone last-4 fallback chahiye?** — **done:** `src/lib/phone-last4.ts` +
   `/api/public/job-status?phone=1234` (10 attempts / 10 min / IP). Page par
   limited view me "Unlock" input hai.
3. **`recent` list:** remove + browser-local recents — **done** (server list 410).
4. **Rate limit:** Upstash free vs Vercel KV? — **pending** (in-memory fallback live)
5. **Offsite backup:** Cloudflare R2 vs S3 vs Google Drive (rclone)? — **pending**
6. **Print branding fallback:** client ka `system_info` missing ho to "Your Shop" ya seller
   branding? — **implemented:** env `NEXT_PUBLIC_SITE_*`, phir "Your Shop"

---

## 13. Definition of Done

- [x] `recent=1` se koi global job list nahi milti
- [~] Sequential job IDs se amount/remark scrape nahi ho sakte — **ENFORCE=1 par
  hi true hai**. Abhi (`PUBLIC_TRACKING_ENFORCE` unset) token ke bina bhi full
  view milta hai; rate limit 60/min/IP enumeration slow karta hai, rokta nahi.
  Secret + enforce tabhi jab phone-fallback decision ho jaye.
- [x] Legacy slip phone-last-4 fallback (token ke bina full view, 10 attempts/10min/IP)
- [x] Printed bill ka QR valid URL + token ke saath scan hota hai; QR internet ke bina render
- [x] Har client ke print par uski branding (koi hardcoded V-Technologies nahi)
- [x] `activity-users` 401 without session
- [x] Image uploads magic-byte validated (JPEG/PNG/WebP); SVG/HTML/executable payloads rejected; client MIME/extension ignored
- [x] Public tracking page `noindex`; setup route single-flight + throttled, errors generic
- [x] Print pages nonce-CSP; stored text injection se script execution blocked (verified runtime header/body)
- [x] Portal/license/upload APIs raw DB errors expose nahi karte; `/api/*` default `private, no-store`
- [x] `/api/health` live (read-only DB probe + version/commit, 200/503) + rollout/env presence booleans (`trackingEnforce`, `push`, `passkey`, `license`)
- [x] Baseline security headers + CSP Report-Only live (verified on `/job-status`)
- [~] Public/print/AI routes rate-limited (public, print-job-status, chat, setup done; remaining
  authenticated print routes intentionally deferred — batch printing break na ho); 429 verified
- [ ] Job save fail par partial rows nahi bachte (compensating rollback test)
- [ ] Zod top-5 financial routes; raw DB errors client ko nahi
- [x] Default e2e read-only; write suite staging-only + host assert
- [ ] Offsite encrypted backup restore drill pass
- [x] No DB files/schema/rows touched; typecheck + unit tests + read-only smoke pass

---

## 14. Explicit Non-Goals (is plan me nahi)

- DB schema/data change (save_job RPC, loan numeric, naye indexes, token column)
- Public tracking feature removal
- UI redesign / framework migration
- New business modules (WhatsApp automation, UPI gateway, AMC/warranty) — alag feature plan
- E2E write tests production ke against

---

## 15. Parking Lot — DB changes (sirf explicit approval ke baad)

| Item | Why | Risk if deferred |
|---|---|---|
| `save_job` RPC (atomic) | multi-table job save | partial rows (mitigated by compensating rollback) |
| `loan_payments.amount_paid` → `numeric(12,2)` | float rounding | paise ka minor mismatch |
| Rate-limit table | persistent limits | in-memory per-instance limitation |
| Idempotency unique key (jobs) | duplicate submissions | server-side dedupe interim |
| Tracking token column | revocable per-job tokens | stateless HMAC acceptable |
| Migration ledger table | audit trail | `APPLIED.md` manifest interim |

Har DB item ke liye: backup snapshot → staging apply → read-only verify → prod window →
rollback script. Bina in steps ke kuch nahi.

---

## 16. Status, Benefits & Remaining Work (2026-10-28)

**State:** Phase 1 + WS-A/WS-B/WS-C code complete aur **production par live**
(`1.71.2`, commit `7e40d44`). DB untouched. Typecheck/lint clean, Vitest
**537/537**, read-only smoke pass (dev).

### 16.1 Benefits delivered

| Fix | Pehle | Ab | Fayda |
|---|---|---|---|
| Public tracking | `recent=1` par sab customers ke jobs; amount/remark scrapeable | Token-gated full view, limited view, 60/min IP limit, browser-local recents, `noindex` | Customer privacy + safe self-service tracking |
| Print branding | 19+ print routes me hardcoded "V-Technologies" | Har client `system_info` se branding; env fallback | White-label resale, har client ka apna bill |
| Print QR | Hardcoded dead URL (`https://vtech-rsms`) | Signed tracking URL + local `qrcode` (internet-free) | Scanned bill se job tracking actually kaam karta hai |
| Print XSS | Client/item/remark text HTML me raw | 23 print routes par nonce-CSP, inline handlers data-attrs | Injected script se staff session safe |
| Uploads | Client MIME/extension trust; SVG/HTML possible | Magic-byte JPEG/PNG/WebP; extension/content-type server-decided; signature data URL restricted | Storage abuse + stored XSS blocked |
| Auth/enumeration | `activity-users` open; setup double-admin race | Staff guard 401; setup single-flight + 10/h/IP | Staff names enumerate nahi hote, setup race band |
| Headers/cache | No CSP/HSTS/referrer policy; API cache ambiguous | Baseline headers + CSP Report-Only + `/api/csp-report` sink; `/api/*` `private, no-store` | Browser hardening, customer data cache me nahi, CSP enforce ka data available |
| Ops | Koi health/uptime endpoint nahi | `/api/health` (read-only probe, 200/503, version/commit) | Monitoring/alerting possible |
| E2E safety | Write tests prod DB ke against chal sakte the | `E2E_ALLOW_WRITES` + `E2E_WRITE_HOST` double gate | Koi accidental test row nahi |
| Tests | In features ke tests nahi | 79 naye tests (tracking token, rate limit, print shop, image upload, print HTML, health, CSP report, phone last-4, public tracking matrix) | Regression safety |

### 16.2 Remaining work + estimates

| Item | Dependency | Effort | Risk |
|---|---|---|---|
| Prod env set + `PUBLIC_TRACKING_ENFORCE=1` | Vercel me `PUBLIC_TRACKING_SECRET` add | 15 min | Low (phone fallback ready) |
| CSP ko Report-Only se enforce karna | 3–5 din prod logs me `[csp-report]` observation | 0.5 din | Low |
| Distributed rate limit (Upstash REST) | Code done; **Upstash env + redeploy** | 10 min (env only) | Low (memory fallback) |
| WS-D: server-computed totals, compensating rollback, Zod top-5, `useMutation` | **Staging Supabase project** | 5–7 din | Medium |
| WS-E: staging project + read-only e2e coverage | Staging project | 2–3 din | Low |
| WS-F: offsite encrypted backup + restore drill + Sentry/uptime alerts | R2/S3/Drive choice | 2–3 din | Low |
| Optional: authenticated print routes par gentle rate limit | — (intentionally deferred) | 0.5 din | Medium (batch printing) |
| WS-G: `JobsBody.tsx` etc. refactors | Safety fixes deployed | 2–3 hafte | Medium |

**Near-term total (WS-G ke bina):** ~2–3 hafte, jisme se pehla 1–2 din sirf
deploy + prod verify + enforcement decision hai.

### 16.3 Production verification & follow-ups (2026-10-28, re-verified 2026-10-29)

- **Deploy verified (2026-10-29):** prod `version: 1.72.0`, commit `d3c5e38`,
  `/api/health` **200**, `db: ok`, `Cache-Control: no-store`.
- `/api/health` checks (2026-10-29): `trackingSecret: true`, `trackingEnforce: true`,
  `siteUrl: true`, `push: true`, `passkey: true`, `license: true`; koi secret
  value response me nahi. `PUBLIC_TRACKING_ENFORCE=1` ab live hai.
- CSP Report-Only header + `Reporting-Endpoints` prod par present; `/api/csp-report`
  par empty POST → **204** (sink reachable).
- Public tracking read-only checks (2026-10-29): no params → 400, `recent=1` → 410,
  unknown job/code → `job: null`, injected `<script>` id → 400, malformed
  `phone` → 400, API headers `no-store` + `noindex`.
- Service worker audit (`src/app/sw.ts`): API routes aur RSC pehle se
  `NetworkOnly` the, par image matcher sirf file extension dekhta tha —
  cross-origin Supabase storage (client/job photos) 30 din Cache Storage me
  reh sakti thin. Ab images sirf same-origin + non-`/api/` cache hoti hain.
- CSP observation ab actionable: `report-uri` + `report-to` `/api/csp-report`
  par set hain. Endpoint fire-and-forget (hamesha 204, 60/min/IP, 8KB cap) hai
  aur sirf sanitized fields (directive, blocked origin, document pathname —
  query string strip) prod function logs me likhta hai. 3–5 din me
  `[csp-report]` noise dekh kar enforce decision liya ja sakta hai.
- Legacy slip escape hatch **implemented**: `?phone=<last4>` (client record se
  match, 10 attempts / 10 min / IP, sirf enforced mode me) + limited view par
  "Unlock" input. `client_name` (internal client id) ab full response me bhi
  strip hota hai.
- **QR limited/full matrix verified (2026-10-29, real job, read-only):** printed QR
  (local decode, job_id `29539`) → with token: `limited: false`, amount/remark +
  services present, `client_name` absent; without token: `limited: true`, sirf
  id/job_id/code/item/fault/status/date, amount/remark absent; wrong token:
  limited; wrong last-4: limited (koi error oracle nahi); malformed phone: 400.
  Sab responses `no-store` + `noindex`.
- Phone unlock ka **positive** path (sahi last-4) owner ke ek test se verify karna
  bacha hai — code path same hai, isliye risk low.
- **Distributed rate limit implemented (2026-10-29):** `rateLimit()` ab async hai.
  `UPSTASH_REDIS_REST_URL/TOKEN` set hon to fixed window Redis pipeline
  (`INCR` + `PEXPIRE`) se shared chalti hai; env na ho ya Redis fail/timeout
  (1s) ho to per-instance memory fallback (throttled warn ke saath) — request
  block nahi hoti. `/api/health` me `checks.distributedRateLimit`. Local prod
  server check: bina env 31st request par 429; fake unreachable endpoint par
  flag `true`, health 200 aur fallback warn. **Prod rollout baki:** Upstash env
  add + redeploy.

### 16.4 Vercel Production env checklist

| Feature | Vars (Production scope) | Notes |
|---|---|---|
| Core DB/Auth | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Service role server-only; `NEXT_PUBLIC_*` build-time embedded → change = redeploy |
| Tracking rollout | `PUBLIC_TRACKING_SECRET`, `PUBLIC_TRACKING_ENFORCE=1`, `NEXT_PUBLIC_SITE_URL` | Secret **rotate na karein** (printed QR invalid); health me `trackingSecret`/`trackingEnforce` se verify |
| Push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (+ `VAPID_EMAIL` optional), `FIREBASE_SERVICE_ACCOUNT` (Android) | Health flag: `push` |
| Passkeys | `WEBAUTHN_SECRET` (fallback: service-role), `WEBAUTHN_ORIGIN`/`RP_ID` optional | Health flag: `passkey` |
| License | `LICENSE_SERVICE_URL`, `LICENSE_SERVICE_ANON_KEY` | Health flag: `license` |
| Seller-only deployment | `LICENSE_SERVICE_SERVICE_ROLE_KEY`, `SELLER_PORTAL_PASSWORD`, `DEV_PORTAL_PASSWORD`, `SELLER_CREDS_ENCRYPTION_KEY` | Customer deployments par **kabhi nahi** |
| Optional | `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`, `UPSTASH_REDIS_REST_URL/TOKEN` | Monitoring/distributed rate limit; health flag `distributedRateLimit` |
| Never in Production | `E2E_ALLOW_WRITES`, `E2E_WRITE_HOST`, E2E test creds | Write specs live DB me rows bana sakte hain |

Sab server secrets Vercel me **Sensitive** mark karein; `SETUP_TOKEN`/AI keys par
"Needs Attention" aaye to rotate karke dobara set karein.

