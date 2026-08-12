# V-Tech Frontend — Project Review (Audit: 10 Aug 2026)

*Status: ARCHIVE / REFERENCE — isme se koi code change nahi karna. Future kaam me guided hoga. Completed tasks ka record → `completed_tasks.md`.*

## Tech Stack
- Next.js 16.3 (Turbopack + React Compiler), React 19, TypeScript 5.9
- Tailwind 4, Supabase (DB + Auth), Chart.js + Recharts
- AI: Gemini (`@google/generative-ai`) + Groq (`groq-sdk`)
- PWA: Serwist 9, Android: Capacitor 8, QR: qrcode

## Journey Timeline
| Period | Kya hua |
|---|---|
| Oct 2024–Jan 2025 | Project start, base setup |
| 2025 scattered | Auth, backup/restore, MySQL→Supabase converter |
| Nov 2025–Jan 2026 | Main sprint — 55 commits, full app features |
| 08 Aug 2026 | Storage buckets migration |
| 09 Aug 2026 | Security sprint + Client Portal (Phase 1) |
| 10 Aug 2026 | sync_plan.md (MariaDB↔Supabase) — sirf plan |

## Features Built
- Core business app: Dashboard (charts), Jobs/Repairs, Clients, Direct Sales, Inventory, Mechanics + salary + ledger, Loans/Lenders, Expenses, Messages, WhatsApp templates
- AI Chat (Gemini + Groq), per-role AI settings, WhatsApp reply generation, AI alerts
- Client Portal Phase 1: `login_allowed` toggle, `profiles.client_id`, RLS (2 tables), email OTP login, IDOR-safe onboarding
- Print views (ledger-print), PWA, Android (Capacitor 8)
- 48 API routes, 88 me auth guards (`requireStaff/Admin/Client`)
- MySQL→Supabase converter + backup/restore (round-trip 0-fail, tested)
- 12 SQL migrations (6 active, 6 archived)

## Stats
- 184 TS/TSX files, ~55k lines, 55 commits last 2 months (41 Jan 2026 me)
- 0 TypeScript errors (achha)
- ~~615 lint errors~~ → ✅ **0 ESLint errors** (616 `no-explicit-any` errors eliminated), 48 warnings remaining (`completed_tasks.md`)
- README default create-next-app hai — koi onboarding docs nahi

## Security Review
- **Strong:** API auth layer — 88/48 routes guard; signup band; role-escalation locked (09 Aug); public report leaks closed; IDOR-safe client onboarding
- **⚠️ Risk:** RLS sirf 2 of ~30 tables. 414 browser-side `supabase.from()` calls + 102 direct writes RLS ke bina. Anon key browser me public hai.
  - Matlab: ~16 tables (product_list, client_list, mechanic_list, client_loans, expense_list, suppliers...) browser se directly write-able
  - Plan me intentional hai: "API guards primary, RLS defense-in-depth" — par verify pending
- 1 API route bina auth: `device-info/route.ts` (harmless dev helper — documented)

## Pending / Risks
1. ~~**Client portal migration apply nahi hua**~~ → ✅ DONE (applied + tested, `completed_tasks.md`)
2. ~~**SMTP setup pending**~~ → ✅ DONE (Gmail SMTP set)
3. ~~**Client emails set + `login_allowed` toggle**~~ → ✅ DONE (working email + OTP login + toggle ON/OFF tested)
4. ~~**RLS rollout (7 tables)**~~ → ✅ DONE (migration applied + live verified 11 Aug). ⚠️ Baaki security debt: 414 browser-side `supabase.from()` calls + 102 direct writes ab bhi API-guards-primary pattern par hain (defense-in-depth RLS rollout baaki hai — optional)
5. ~~**615 lint errors cleanup**~~ → ✅ DONE (0 ESLint errors, 48 warnings, 11 Aug)
6. **6 unused/archived migrations** me confusion possible
7. README/docs nahi hai

## Future Possibilities (plans me already documented)
1. **Client Portal Phase 2-5** (`client_portal_plan.md`) — migration apply + SMTP + production test. Quick win, 1-2 din.
2. **MariaDB↔Supabase Sync** (`sync_plan.md` ready) — offline shop + online portal. Hub-spoke, outbox pattern, LWW conflict. Sabse bada differentiation feature, ~2-3 hafte ka project.
3. **WhatsApp Business API** — 167 references + templates + reply generation built. India me paid, business value high.
4. **AI expansion** — AI alerts, stock alerts, overdue reminders, WhatsApp auto-replies (tool-calling built).
5. **Android app polish** — signed APK production build.
6. **Code hygiene sprint** — lint cleanup, README, unused migrations archive.

## Recommended Priority Order
1. ~~Portal live karo (migration + SMTP + test)~~ → ✅ DONE (10-11 Aug)
2. ~~RLS hardening (7 tables)~~ → ✅ DONE (11 Aug, migration applied + live verified)
3. WhatsApp/AI expansion — jab business ready
4. Sync plan — sirf jab offline-first requirement pakki (sabse bada project)

## Reference Files
- `client_portal_plan.md` — portal design + security fixes (detailed)
- `sync_plan.md` — MariaDB↔Supabase sync architecture
- `implementation_plan.md` — dependency update plan
- `src/app/reports/comparison_report.md` — PHP vs Next.js comparison
- `supabase/migrations/` — schema migrations

## Data Bug Fix (10 Aug 2026) — Supabase 1000-row cap
**Root cause:** PostgREST har request max **1000 rows** deta hai (server max-rows). `.limit(5000)` likhne par bhi sirf 1000 aati hain — baaki silently drop. `src/lib/fetch-all.ts` (`pageAll`/`fetchAll`) isi liye bana tha, par dashboard me old `.limit(5000)` queries bachi hui thin.

**Jagah aur asar (live DB se reproduce):**
| Location | Query | Before | After |
|---|---|---|---|
| `src/app/page.tsx` due-reminders widget | `transaction_list` status=5 (1410 rows) | ₹1,03,500 / 29 clients | ₹1,53,050 / 44 clients |
| `src/app/reports/accounting-dashboard/page.tsx` all-time cumulative | `transaction_list` status=5 sum | ₹10,23,620 | ₹14,91,050 (₹4,67,430 farak) |
| `src/app/page.tsx` financial widget (date-range) | "This Year" → 1046 tx | truncate | full |
| `src/app/page.tsx` revenue chart (monthly) | per-month targeted | safe (defensive fix) | pageAll |
| `src/app/page.tsx` low-stock widget | `transaction_products`/`direct_sale_items` full scans | truncate risk | pageAll |

**Fix (committed):** sab `.limit(5000)` → `pageAll(...)` wrap (`{ data }` shape same, destructuring unaffected). Affected files: `src/app/page.tsx`, `src/app/reports/accounting-dashboard/page.tsx`. `pageAll` paginates via `.range()` → har chunk 1000 rows, sab milati hai.

**Lesson:** `<1000` row tables (`client_list` 437, `client_payments` 624, `attendance_list` 814) safe hain; koi bhi aggregate query jo table 1000+ ho sakti hai wahan `.limit(5000)` kabhi use nahi karna — hamesha `pageAll`/`fetchAll` use karo.

## PWA Loader-Atak Bug Fix (10 Aug 2026) — stale SW HTML/RSC cache
**Symptom:** Page refresh / login ke baad kabhi-kabhi "V-TECH Secure Boot" loader par atak jata hai; sirf **Ctrl+F5** (hard refresh) se load hota hai.

**Root cause:** Service worker (Serwist `defaultCache`) HTML + RSC/Flight payloads ko **NetworkFirst (3s timeout)** cache karta tha + `navigationPreload: true` on.
1. Har navigation/RSC request par `src/proxy.ts` me `supabase.auth.getUser()` chalta hai (network round-trip). Response >~3s slow → SW stale cache se **purane build ka HTML/RSC** serve kar deta hai.
2. Purana HTML/RSC naye build ke chunk URLs nahi jaanta → chunk 404 → App Router hydration fail → loader hamesha ke liye atakta hai.
3. Ctrl+F5 SW bypass karta hai → fresh HTML+chunks → load hota hai (isi liye sirf tabhi kaam karta tha).

**Fix (committed):**
- `src/app/sw.ts` — `defaultCache` hata, custom `runtimeCaching`: **HTML navigation + RSC → `NetworkOnly`** (online hamesha fresh, offline precache fallback); `/_next/static/*.js`/images/fonts/css → hashed URLs cache (fast); `/api/*` → `NetworkOnly`; `navigationPreload: false`; `activate` par purane `pages`/`pages-rsc`/`apis`/`others` caches delete.
- `src/app/layout.tsx` — 2 safety nets: (a) **loader watchdog** — 12s tak loader atka → ek baar auto hard-reload (`vtech_boot_reloaded` sessionStorage guard); (b) **chunk-error auto-reload** — chunk load fail → 30s cooldown ke saath auto reload.

**Verify:** `tsc --noEmit` clean, `npm run build` success, generated `/serwist/sw.js` me custom matchers confirm kiye.

**Lesson:** Next.js 16 App Router + Supabase SSR + PWA me SW se HTML/RSC kabhi cache nahi karna — sirf content-hashed static assets cache karo. Auth proxy (`getUser()` har request par) navigation/RSC ko slow kar deta hai jo NetworkFirst stale-cache fallback trigger karta hai.
