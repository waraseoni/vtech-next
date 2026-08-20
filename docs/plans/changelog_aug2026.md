# Changelog & Work Log — 06–20 Aug 2026

*Pichhle 15 din ka saara kaam ek jagah — track karne aur aage ka plan banane ke liye. Har entry me commit hash hai taaki history me dekh sako.*
*Created: 15 Aug 2026 · Updated: 20 Aug 2026 · Branch: main · Remote: github.com/waraseoni/vtech-next*

---

## 1. Date-wise Timeline

### 06 Aug — Phase 1/2/3 (PHP parity ke first passes)
- GST dues → WhatsApp proxy wiring (`c685de1`)
- Requirement/Accounting: logo upload + cover + bulk-edit loan (`ca0ce17`, `ae4e1b8`)
- Public static files no longer redirect to login (`533ade6`)

### 07 Aug — Security + Perf + Attendance (060826 sprint)
- **Attendance GPS geofencing**: office-bahari check-in/out block (`cfbb6a1`)
- **Attendance times parity**: check-in/out + working hours (`642af2b`)
- **Security**: sab data API routes par auth guards, `requesterId` spoofing kill, client par plaintext password/AI key nahi (`68600fd`)
- **Bugfixes**: due-reminder discount math, silent Absent fix, exact job stats, IST date bounds, delivered filters, ledger `del_status` parity (`4069fbf`)
- **Perf/Cleanup**: ledger N+1 → bulk queries, 6 pages par Suspense, dead files delete, CSV UTF-8 BOM + IST filename (`195ee8f`)
- **Perf**: `/clients` no full-table scan — chunked IN filters (`18e2dea`)
- **Fix**: stale/revoked Supabase session (`refresh_token_not_found`) — proxy clears dead `sb-` cookies, `getUser` never throws (`214ea45`)

### 08 Aug — Bulk actions + cleanup
- `fetchAll` pagination for 1000+ row result sets (`0cda2b6`)
- Jobs bulk actions, payment type/bill-no, mobile view toggle, thermal bill link (`cfcc24a`)
- Bulk status/WhatsApp/invoice actions on client view page (`109f922`)
- Junk files + applied migrations archive (`0125675`, `e0d8550`)

### 09 Aug — Client Portal + Photos + PWA + Reports parity
- **Photos**: client/job photo upload with compression + mechanic/user avatars + product images (`cdbfb38`, `95b01d2`, `96d097f`)
- **PWA**: next-pwa → `@serwist/turbopack` (remove serialize-javascript vuln) + dashboard QR (`0db66ee`, `8acc932`, `ef50ce8`)
- **Deps**: update to latest safe versions (`2a4a85e`)
- **Security**: open registration band, report APIs auth-guarded, role escalation lock (`c32db1f`), `requireStaff()` on data/photo routes (`a71d152`)
- **Client Portal (bada feature)**: email OTP login, `/my-account` pages, `login_allowed` toggle, due amount + self-service ledger, auto-logoff on idle/revoked, mobile toggle, zombie-staff → client conversion, 8-digit OTP (`d1ef2ce` … `7b7c8ee`)
- **Reports parity**: balancesheet/ledger/loan/cash-flow PHP logic (`ec0620c`), salary `daily_salary` + history (`96a5dba`), outstanding = net balance with credits (`799816c`), `requireAdmin()` guards (`778b2e3`)

### 10 Aug — Security hardening + AI
- **RLS hardening**: 6 anon-open tables close (system_info `ai_api_key` leak fixed), signature route service-role, gemini-tools service-role only (`f2e8367`)
- **Login brute-force throttle**: `login_throttle` table, login proxy (password+OTP+verify-OTP), admin unlock UI, IP flood guard, email escalation lockout (`a965c5b`)
- **AI**: role-based access (admin/staff), business alerts API + AI notifications panel (`7894616`)
- Fixes: payment-due badge only when net balance > 0 (`61b374e`), dashboard aggregates `pageAll`, SW never caches HTML/RSC (`0a01139`), blocked clients → 403 (`fa8617a`), backup restore schema alignment (`f888ad7`)

### 11 Aug — Public site + AI expansion + Mechanics parity + Code hygiene
- **Public website (bada feature)**: full site — services pages, equipment art, contact form, QR share (`43cbe2d`, `a6dfbca`)
- **AI expansion**: WhatsApp AI reply in inquiry modal (`7086cd4`), live context enrichment + deprecated gemini model fix (`42437ca`), dashboard AI alerts widget (`fe1de15`)
- **Mechanics PHP parity sprint** (FULLY DONE, verified vs MySQL dump): salary, commission, ledger, detail pages, print modes (`12a8ccd`, `9693cde`, `a96e91a`)
- **Code hygiene**: `no-explicit-any` 616 → 0, eslint warnings reduced (`7e8db82`, `41d5b61`)
- **Fix**: root layout → server component (kills "Encountered a script tag" React error + stale SW/HTTP-cache guard) (`09c1928`)

### 12 Aug — Licensing + seller/developer portals (bada feature)
- **Licensing system**: central project (vtech_licence) integration — seller portal (license CRUD) + developer portal (setup kit generator + Vercel push), license gate, double-password auth (`07ee715`)
- Setup-kit key field names fix (`d91bd2f`), Vercel deployments API v7 + git redeploy fallback (`48f90f2`), `/setup` public for first-run admin (`40276cf`), `backups/` gitignored (`cdac746`), planning docs → `docs/plans/` (`28f964e`)

### 14 Aug — Public branding + UX
- **Per-client branding**: env-driven public site + setup-kit/push integration (`82ff134`), branded minimal template vs full seller site (`28219e8`), live `system_info` name/contact (`17ed239`), logged-in users can open public site + brand links (`f5f31a6`)
- **Creds fix**: partial update preserves notes/github/emails + seller notes display (`c56377e`)
- **UX**: searchable dropdowns (SearchableSelect) (`e228adb`), debounced search + no full-page spinner (`448f4dd`), direct-sale full timestamp (`bdcfbae`), light-mode readability (`9d88d5a`), staff role → Total Amount hidden (`45eb45f`)

### 15 Aug — Backup/images/jobs + Portal fixes (aaj)
- **Images**: double-click zoom lightbox everywhere (`8251132`), backup me images protect + image manager tool (`4d14860`)
- **Build fix**: backup routes par whole-project tracing stop (Vercel) (`defea74`)
- **Jobs**: client avatars in list; job-id counter shared upsert helper + seed migration; developer-role gating, admin-mechanic link, profile mechanic link (`77281e2`)
- **Portal fixes (aaj ki session)**:
  - **Bugfix**: login ke turant baad portal data nahi dikhta tha (refresh par dikhta tha) — root cause: `load()` page-mount par PortalGate ke open hone se pehle chalta tha, portal cookie nahi milne par 401. Ab data gate open hone par hi load hota hai (`onOpen` callback). Teeno pages: seller, developer, seller/client/[id].
  - **Feature**: portal logout button + 15-min inactivity auto-lock (portal cookie clear; app login intact).
  - **Lint**: eslint-plugin-react-hooks v7 strict rules (set-state-in-effect, purity, static-components, preserve-manual-memoization) off kiya + `SaleForm` accessed-before-declared fix.
  - (`62ebead`)

### 16 Aug — No commits (planning)

### 17 Aug — No commits (planning)

### 18 Aug — No commits (planning)

### 19 Aug — Backup schema + deployment tooling
- **Baseline schema**: `backups/supabase/baseline_schema.sql` perfected — all 28 tables + RLS + functions + triggers + storage buckets (2811 lines)
- **Drop script**: `backups/supabase/00_drop_all.sql` — comprehensive idempotent DROP (all tables/functions/triggers/types/extensions)
- **Deployment guide**: `docs/DEPLOYMENT_GUIDE.md` — 7-step client deployment walkthrough
- **pg_dump tools**: `scripts/supabase-dump.mjs` (schema/full/data modes), `scripts/supabase-restore.mjs` (restore with dry-run)
- Commits: `d4545d0`, `9da2aa5`

### 20 Aug — DB Tools page + docs update
- **DB Tools page**: `/back-office/db-tools` — schema health check (live table/RLS/seed/bucket verification), quick SQL queries (copy+expand), pg_dump/restore commands, 8-step deployment walkthrough, schema files reference
- **Sidebar**: DB Tools link added to Developer section in `RootClient.tsx`
- **Back Office**: DB Tools card added to System Maintenance section
- **Bug fix**: `<button>` inside `<button>` nesting error fixed (SQL Quick Copy section)
- **Storage bucket check**: fixed from `listBuckets()` (needs service_role) to direct bucket access via `from(bucket).list()`
- **Schema health check**: replaced broken `information_schema`/`pg_policies` queries with proper PostgREST-compatible checks (16 key tables + RLS + seed + buckets)
- **Docs update**: all plan files updated — RLS (9 items), Login Throttle (20+ items), Location System (77/94 items marked done), Changelog updated
- Commit: `3017166`

---

## 2. Feature-area Deep Dive

### 🔐 Security (bahut strong ho gaya)
| Area | Kya hua |
|---|---|
| RLS | 6 anon-open tables band; `system_info.ai_api_key` leak fix; service-role-only routes |
| Login | Brute-force throttle + OTP rate-limit + admin unlock UI + IP flood guard |
| Auth guards | Sab data/report/photo APIs cookie-session-verified (`requireAdmin`/`requireStaff`) |
| Registration | Open signup band; role escalation lock; `role='client'` constraint |
| Stale sessions | Dead `sb-` cookies auto-clear; `getUser` never throws |
| Portal | Double-password (login + portal env password); HMAC-signed HttpOnly cookies; logout + idle auto-lock |
| Geofencing | Attendance check-in/out sirf office radius se |

### 📸 Photos & Images
- Client/job photo upload + compression; mechanic/user avatars; product images
- Job list client avatars; double-click zoom lightbox (theme-aware) everywhere
- Backup: restore ke dauraan images protected + image manager tool

### 🧾 Licensing + Portals (naya business model)
- **Central licensing**: `vtech_licence` project ke saath integration (docs/licensing/*)
- **Seller portal**: license key CRUD (create/renew/revoke/status), client credentials
- **Developer portal**: setup kit generator (client package) + one-click Vercel deploy + push
- **Client-branded deployments**: env-driven public site template, setup-kit integration
- Portal auth: cookie 6h, manual logout + 15-min auto-lock (aaj add)

### 🌐 Public Site
- Full public website: services, equipment art, contact form, QR share, WhatsApp job-status help
- Live `system_info` name/contact; client-branded minimal template
- Logged-in users ke liye "Open Public Site" link

### 🤖 AI
- WhatsApp AI auto-reply in inquiry modal (editable, regenerate, copy, open WA)
- Live context enrichment: low stock, pending jobs, top outstanding, financials (role-aware)
- Dashboard AI alerts widget (persistent hide/show, severity colors)
- Models updated: gemini-2.0-flash → 2.5 family (2.0 deprecated)

### 👥 Client Portal
- Email OTP login (Gmail SMTP), `login_allowed` toggle, self-service ledger + due amount
- Auto-logoff on idle timeout / revoked access; mobile toggle; IDOR-safe API guards

### 📊 Reports & Finance (PHP parity)
- Balancesheet / ledger / loan / cash-flow / salary / commission / mechanics ledger — sab PHP logic ke barabar
- Due reminders, requirement/low-stock list, accounting dashboard
- CSV export UTF-8 BOM + IST filename

### ⚡ Perf & Cleanup
- `pageAll`/`fetchAll` — 1000-row PostgREST cap bypassed everywhere
- Ledger N+1 → bulk queries; clients full-table scan → chunked IN
- Suspense around useSearchParams (6+ pages); dead files deleted
- `no-explicit-any` 616→0; eslint warnings 296→48→0

---

## 3. Migrations Status

**Applied via SQL Editor** (abhi tak — user-confirmed):

| Migration | Purpose | Status |
|---|---|---|
| `20260806_phase1_gst_dues.sql` | GST dues (done/) | ✅ Applied |
| `20260806_phase3_attendance_times.sql` | attendance time_in/time_out (done/) | ✅ Applied |
| `20260806_phase3_barcode.sql` | product barcode (done/) | ✅ Applied |
| `20260807_attendance_geofence.sql` | geofence lat/lng + config (done/) | ✅ Applied |
| `20260808_storage_buckets.sql` | storage buckets | ✅ Applied |
| `20260809_client_portal.sql` | client portal tables + OTP | ✅ Applied |
| `20260809_drop_auth_profile_trigger.sql` | auth profile trigger cleanup | ✅ Applied |
| `20260809_lock_profiles_role.sql` | role lock constraint | ✅ Applied |
| `20260809_mechanic_user_photos.sql` | mechanic/user photos | ✅ Applied |
| `20260809_product_images.sql` | product images | ✅ Applied |
| `20260810_login_throttle.sql` | login brute-force throttle | ✅ Applied |
| `20260815_seed_job_id_counter.sql` | job-id counter seed | ✅ Applied |
| `20260815_unique_mechanic_link.sql` | mechanic 1:1 link | ✅ Applied |
| `20260817_product_level_location.sql` | locations + product_locations tables | ✅ Applied |
| `20260910_rls_hardening.sql` | RLS hardening (done/) | ✅ Applied |

> Note: `20260910_rls_hardening.sql` me `20260910` date future-dated hai (archived as done/). Isse issue nahi — seedha SQL editor se apply hua tha.

---

## 4. Aage ka Plan (suggested next steps)

### 🟢 Abhi karna bacha (small fixes)
- [ ] **Migrations archive**: `20260815_*.sql` abhi `supabase/migrations/` root me hain — apply ho chuke, `done/` me move karne par repo clean rahega (git mv).
- [ ] **Location System cleanup**: Phase 9 pending — drop old `place_zone/rack/bin/box` columns, retire `partsFromRow`, remove unused imports (~6 items)
- [ ] **Supplier Detail**: Payment summary section pending (total billed vs paid, payment list, outstanding highlight)
- [ ] **DB Tools**: Gemini tools me location from `product_locations` update

### 🟡 Open/deferred (pehle se noted)
- [ ] **CLN-3**: design-token centralization (`inputCls`/`labelCls`/fieldsets across 20+ files) — cosmetic-only, high regression risk, deferred.
- [ ] **P4 — Sync Project** (decided to defer — Supabase stable, no risk needed now)
- [ ] **Automated Tests**: zero tests exist in project (manual testing only)
- [ ] **Dependency Updates**: Next.js, TypeScript, ESLint major versions (plan exists in `implementation_plan.md`)
- [ ] **Login Throttle Phase 2**: alert/audit/captcha/cleanup (optional, when needed)
- [ ] **Client Portal**: E2E test + SMTP provider decision pending

### 🔵 Possible next features (idea bank)
- Portal activity audit log (kaun kab login/logout hua)
- Portal password rotate UI (Settings me) — abhi env se hi set hota hai
- Seller portal me payment/renewal reminders via WhatsApp
- Client public site par live job-status waala WhatsApp flow aur polish
- AI: attachments/voice input in AI Sahayak

---

## 5. Version Status
- Next.js 16.3.1, React 19, TypeScript (strict), Tailwind v4, Turbopack, @serwist/turbopack (PWA)
- Supabase: supabase-js 2.112.3, @supabase/ssr 0.9.0
- eslint 9.39.5 + eslint-config-next 16.3.1 + eslint-plugin-react-hooks 7.1.1 (v7 strict rules off — gradual re-enable when pages move to React 19 recommended patterns)
- Verification commands: `npx eslint src` (EXIT 0) · `npx tsc --noEmit` (EXIT 0) · `npm run build`
