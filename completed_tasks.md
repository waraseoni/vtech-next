# Completed Tasks Log

*Record of completed tasks — plan files se yahan move kiya jata hai taaki confusion na ho. Jo yahan hai wo DONE hai, dobara mat karna. Naya kaam start karte waqt yahan check karo.*
*Updated: 11 Aug 2026*

## P1 — Security & Migration (done)

### RLS Hardening — FULLY DONE (verified live)
- ✅ Migration `20260910_rls_hardening.sql` Supabase SQL editor me applied (user, run success)
- ✅ Live RLS verify (11 Aug 2026, anon key REST):
  - `system_info` sensitive fields (`ai_api_key`, `csrf_token`, `upi_id`, `signature`) → anon SELECT 0 rows (blocked)
  - `system_info` public fields (`name`, `cover`) → anon readable (public site chalta hai)
  - `activity_logs`, `payment_reminders`, `suppliers`, `wp_template_history` → anon SELECT denied
  - `spare_supplier` → anon SELECT 400 denied
  - `message_list` → anon INSERT OK (test row id=23, phir cleanup deleted), anon SELECT denied
- ✅ Code regression safe:
  - `src/lib/ai-settings.ts` service-role use karta hai (RLS bypass) — `ai_api_key` read unaffected
  - Client portal pages (`/my-account*`) direct browser queries nahi karte — API routes (service-role) se
  - Public pages sirf `name` + `cover` padhte hain — dono anon whitelist me

### Client Portal — FULLY DONE (user tested live)
- ✅ Migration `20260809_client_portal.sql` applied + verified (10 Aug)
- ✅ Gmail SMTP set, client email se OTP login tested
- ✅ Admin se `login_allowed` toggle ON/OFF tested
- ✅ Working email assign kar ke OTP login + portal permission toggle dono verified
- ✅ `/api/client/me|jobs|payments` IDOR-safe guards

## P2 — Code Hygiene (FULLY DONE)

### `no-explicit-any` ESLint Cleanup & Warnings Reduction — DONE
- ✅ **`no-explicit-any` ESLint Errors**: **616 → 0** across all 110+ TypeScript files in `src/`.
- ✅ **Total ESLint Errors**: **0** (`npx eslint src` clean).
- ✅ **TypeScript Compilation**: Clean (`npx tsc --noEmit` exit code 0).
- ✅ **Production Build**: Successful (`npm run build` compiled cleanly in ~5.3s).
- ✅ **ESLint Warnings Reduction**: **296 → 48** warnings (all 19 `no-unused-vars` resolved; remaining 48 are intentional/behavior-sensitive Next.js image/location and react-hooks exhaustive-deps rules).
- ✅ Key structural patterns established:
  - `DbRow` alias (`type DbRow = ReturnType<typeof JSON.parse>;`) for untyped Supabase JSON rows.
  - Reusable helpers typed with generics (e.g. `sumBy<T,>`).
  - Embedded Supabase relation arrays typed (e.g. `SaleItemRow` for `sale.items`).
  - Strict type narrowing for catch blocks (`err instanceof Error`).
  - `pageAll` / `fetchAll` helper functions typed across all reporting/ledger routes.

## P3 — Business Value (pending)

## P5 — Mechanics PHP Parity (FULLY DONE, verified vs MySQL dump 11 Aug 2026)

Mechanics module ko legacy PHP (`admin/mechanics/*`, `admin/attendance/*`, `admin/salery/*`) ke exact logic par port/verify kiya:
- ✅ `mechanics/salary` — salary_report.php parity: per-day rate from `mechanic_salary_history` (effective_date <= day), attendance status 1=full/3=half, commission by `status=5` + `date_completed` range, advance period, closing balance. Data-verified vs `vikram_db_100826.sql` (mechanic 1, Aug 2026).
- ✅ `mechanics/commission` — commission report + rate master (Master tab: update `mechanic_list.commission_percent` + insert `mechanic_commission_history`).
- ✅ `mechanics/[id]` (view_mechanic.php) — work history (status=5, date_completed range, `svc_total` = Σ transaction_services.price), stats (job_count, days_count), Add Payment modal (advance_payments insert + activity log). Data-verified: 5 jobs / ₹3700 svc / ₹370 comm — MySQL == Supabase.
- ✅ `mechanics/[id]/ledger` — opening balance + period ab salary_report semantics (date_completed + status=5 + rate history), PHP `old_balance` ke barabar reconcile.
- ✅ `mechanics/ledger/[id]` — rich daily ledger (date_created attribution, pending jobs shown, delivered-only in balance). Print ab `mode=created`.
- ✅ `/api/print-mechanic-ledger` — `mode` param: `completed` (default, `mechanics/[id]/ledger`) / `created` (`mechanics/ledger/[id]`); opening = attendance + comm(date_completed, status=5) − advance, rate history.
- ✅ Salary report → ledger navigation: `?month=yyyy-MM` ab ledger page par respect hota hai.
- ⚠️ Pending-jobs report intentionally uses `date_created` (correct semantics) — no change.

## P4 — Sync Project (pending)
