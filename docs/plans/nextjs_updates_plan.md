# Next.js Feature Parity Plan (PHP RSMS → Next.js)
*Created: 06 Aug 2026 · Source: deep scan of `C:\xampp\htdocs\vtech-rsms` vs `C:\next-vtech\vtech-frontend`*

## Summary
The legacy PHP RSMS has features the Next.js port is missing. This plan tracks them by priority. It also absorbs the pending items from `php_updates_todo.md` (#5 Logo/Cover/Banner, #6 Loan & EMI Report).

## Phase 1 — HIGH (business-critical)

### 1. GST: HSN/SAC Codes + Direct-Sale Invoice GST
- PHP reference: `db/vikram_db_blank.sql`, `pdf/gst_bill.php`, `pdf/print_invoice.php`, `pdf/combined_invoice.php`, `admin/direct_sales/view_sale.php`
- [x] Supabase migration: `product_list.hsn`, `service_list.hsn` (varchar(20) default '')
- [x] Products page: HSN field in add/edit form + display in list
- [x] Services page: HSN/SAC field in form + display in list
- [x] Jobs view: HSN/SAC per line item
- [x] `print-bill`: HSN/SAC column per line
- [x] `print-combined-invoice`: HSN/SAC column per line
- [x] `print-direct-sale-invoice`: currently NO GST — add GSTIN, CGST/SGST, HSN column, and dynamic firm name/address/GSTIN from `system_info` (currently hardcoded `SHOP` constants)

### 2. Due Reminders (Payment Dues)
- PHP reference: `admin/due_reminders.php`
- [x] Supabase migration: `client_list.opening_balance`, `payment_due_date`, `payment_due_remarks`; new `payment_reminders` table (client_id, amount_due, reminder_date, channel, status, remarks)
- [x] Client add/edit: opening balance, due date, due remarks fields
- [x] New page `/reports/due-reminders`: stats cards (Total Due/Overdue/Due Today/Upcoming 7d/No Date), filters (status/from/to/search), WhatsApp reminder button logging to `payment_reminders`
- [x] Dashboard widget: overdue/today due counts + quick link

### 3. WhatsApp DB Templates wiring
- PHP reference: `admin/system_info/index.php`, `classes/Master/SystemTrait.php`
- [x] Supabase migration: `system_info.owner` (firm owner, feeds `{firm_owner}`)
- [x] Settings: Firm Owner Name field
- [x] Shared util `substituteTemplate(tpl, vars)` — placeholders: `{client_name}`, `{balance}`, `{firm_name}`, `{firm_phone}`, `{firm_address}`, `{firm_owner}`, `{job_id}`, `{code}`, `{item}`, `{amount}`, `{sale_code}`, `{total_amount}`
- [x] Wire job status messages (`/jobs/[id]/view`) to DB templates (`whatsapp_status_*`)
- [x] Wire direct-sale + client balance reminders to DB templates (`whatsapp_sale`, `whatsapp_reminder`)

## Phase 2 — MEDIUM

### 4. Requirement / Low Stock List
- PHP reference: `admin/requirement_list/index.php`
- [x] Supabase migration: `product_list.alert_quantity`
- [x] Product form: alert quantity + supplier linking
- [x] New page `/reports/requirement-list`: low-stock spares (current stock < alert), linked suppliers with phone, "Need to Order" qty, print
- [x] Replace hardcoded dashboard low-stock threshold (5) with `alert_quantity`

### 5. Accounting Dashboard
- PHP reference: `admin/reports/accounting_dashboard.php`
- [x] New page `/reports/accounting-dashboard`: date-range filters, P&L summary, performance (expense breakdown + top customers), cash flow, assets & liabilities, inventory health, print + balance-sheet link

### 6. System Logo upload
- PHP reference: `admin/system_info/index.php`, `pdf/gst_bill.php` (uses `uploads/logo.png`)
- [x] Settings: logo upload as dataURL → `system_info.logo` (storage buckets `signatures`/`logos` missing, so dataURL instead)
- [x] Print routes (`print-bill`, `print-combined-invoice`, `print-direct-sale-invoice`): show logo in header, fallback to V•TECH text
- [x] Bonus fix: `print-combined-invoice` used anon key → RLS blocked reads → always 404. Switched to service role key.

## Phase 3 — LOW

### 7. Website Cover upload
- PHP: `system_info.cover`; display on public site
- [x] Settings: cover upload as dataURL → `system_info.cover` (remove + save buttons)
- [x] Public site hero: `PublicWebsite()` fetches `system_info.cover` and renders as hero background (gradient fallback when empty or `uploads/...` legacy value)

### 8. Bulk edit transactions
- PHP: `admin/transactions/bulk_edit_transactions.php`; Next.js has only bulk *create* (`/jobs/bulk`)
- [x] New page `/jobs/bulk-edit`: source client dropdown → load transactions (del_status=0) → per-row edit (target client, item, fault, mechanic, uniq_id, remark) + "Apply New Client to All" → Save All
- [x] Linked from `/jobs` header + FAB menu

### 9. Loan & EMI Report logic parity
- Verify `/reports/loan` against PHP `admin/reports/loan_report.php`
- [x] `/reports/loan`: loans filtered by `loan_date <= month-end`, payments `<= payment_date month-end`
- [x] `received` = cumulative `amount + discount`; `pending = max(0, emi_amount - received)`; installments left = ceil of outstanding/EMI
- [x] `/api/print-loan`: same month-end filters + received logic

### 10. Misc
- [x] `log_retention` activity-log setting — Settings fieldset + `/api/admin/clean-logs` (admin-only) + Clean Old Logs button on `/reports/activity`
- [x] `product_list.barcode` on products — migration `20260806_phase3_barcode.sql` (apply via SQL Editor), field in product form + table column. Note: PHP schema has the column but exposes no admin form field; added as new functionality.
- [x] Outstanding anon-key routes fixed → service-role key: `print-advance`, `print-monthly-sales`, `export-transactions` (all verified 200 over HTTP; balancesheet/ledger were already session-based and verified working)

### 11. Attendance times parity (check-in/out + working hours)
- PHP reference: `classes/Master/StaffTrait.php` (`save_attendance()`/`save_check_in_out()`, security + 21,600s Half-Day threshold), `admin/attendance/index.php` (time modal), `admin/attendance/view_report.php` (calendar + hour cells)
- [x] Supabase migration: `attendance_list.time_in`, `attendance_list.time_out` (TIME DEFAULT NULL) — `20260806_phase3_attendance_times.sql` (apply via SQL Editor)
- [x] `src/lib/dateUtils.ts`: `nowISTTime()`, `minutesBetweenIST()` (overnight), `hoursBetweenIST()` ("Xh Ym"), `deriveStatusFromTimes()` (no in→null, in-only→1, <6h→3, else→1), `fmtTimeIST()`
- [x] `DailyAttendance`: self check-in/out card (Fingerprint, In/Out, Hours, Check In/Out), admin date picker + daily stats pills, admin In/Out time inputs + status buttons, unmarked→Absent warning, FAB/bulk save with status auto-derivation, staff read-only
- [x] `MonthlyReport`: per-day hours chip (6px) + tooltip (status + time range + hours); modal receives initial times
- [x] `AttendanceModal`: editable time inputs with live hours preview, Save In/Out Times (auto-derive), Clear Times (keeps status), status quick-buttons, error/loading states
- [x] Verified end-to-end via headless-Chrome CDP suite: staff check-in/out (derived Half Day < 6h), admin bulk save 09:00–18:00 → Present, report hours/tooltip, modal Save → Half Day, Clear Times preserves status (19/19 checks PASS, no console errors)

### 12. Attendance GPS Geofencing (new security feature)
- Problem: app is deployed on Vercel → staff can login from anywhere and fake attendance. Solution: verify GPS location on self check-in/out.
- [x] Supabase migration: `attendance_list.lat_in/lng_in/lat_out/lng_out` (DOUBLE PRECISION, audit) + `system_info` geofence config defaults (`geofence_enabled`, `geofence_lat`, `geofence_lng`, `geofence_radius_m`) — `20260807_attendance_geofence.sql` (applied via SQL Editor)
- [x] `src/lib/geofence.ts`: haversine `distanceMeters`, `getCurrentPosition` (promise), `loadGeofenceConfig`, `verifyAttendanceLocation`, Hindi `geoErrorMessage`
- [x] `DailyAttendance`: self check-in/out runs `verifyAttendanceLocation()` before writing — outside radius → blocked with Hindi message; inside → `lat_in/lng_in` (check-in) and `lat_out/lng_out` (check-out) saved on the record; disabled → no behavior change
- [x] Settings → "Attendance Geofencing" fieldset: enable toggle, office lat/lng, radius (m), "Use My Current Location" button (fill current coords), saved via existing `system_info` upsert
- [x] Verified via CDP `Emulation.setGeolocationOverride`: far (Delhi, 665km) → blocked + no DB write; office (110m) → check-in/out succeed + coords saved (7/7 checks PASS); disabled path re-verified (19/19 regression PASS)

## Verification
- `npm run build` after each phase
- Manual: create product/service with HSN, print invoices, add client due date, send WA reminder, check dashboard

## Phase 4 — Security, Bugfixes, Performance & Cleanup (06 Aug, third pass)
- [x] **SEC security hardening** (commit `68600fd`): `src/lib/api-auth.ts` (`requireUser`/`requireAdmin`/`getServerSupabase`); 21 print routes guarded (public `print-job-status` stays); backups `requireAdmin` + download whitelist (`php-ref/db/*.sql`, `vikram_db_supabase.txt`; `.env.local` → 403); `api/chat` requireUser + no client apiKey override; `export-transactions` requireUser; deleted `api/test-tx` + `api/test-logs`; signup forces `role:"staff"` (admin selector removed); login stores email only (no password); admin APIs cookie-session-verified + last-admin protection; AI key env-priority + never rendered client-side (`aiKeyConfigured` bool + masked placeholder)
- [x] **BUG data fixes** (commit `4069fbf`): due-reminders `payMap` operator-precedence; attendance unmarked rows no longer silently Absent; jobs quick-stats exact via `head:true` + paginated amount sum; `+05:30` bounds on `monthly-profit`/`activity-logs`; reports delivered searchParams awaited; ledger repair jobs `.eq("del_status",0)`
- [x] **PERF-1** ledger N+1 → 3 bulk queries (attendance in [1,3], commissions, advances date-range) + in-memory maps, day loop without await
- [x] **PERF-2** `<Suspense>` around `useSearchParams` pages: `/payments`, `/expenses`, `/direct-sales`, `/inquiries`, `/reports/cash-flow`, `/jobs/new` (verified via CDP — no prerender bailout / runtime errors)
- [x] **CLN-1** deleted dead files: `src/app/salary/page - Copy.tsx`, `src/app/backup/page_100%_restore_from_backup.tsx`, `src/app/backup/vtech_mysql_converter.html`, `public/tools/vtech_mysql_converter - Copy.html`; fixed `/jobs/old-edit/:id` 404 link → `/jobs/:id/old`
- [x] **CLN-4** CSV export: UTF-8 BOM (₹/Hindi in Excel) + IST filename; `console.log` → `console.debug` leftovers
- [x] Typecheck (`npx tsc --noEmit`) clean after each phase
- [x] **PERF-3** `/clients` no full-table scan — chunked `IN` filters (400/batch, 1000-row pages) on repairs/`last_txn_date` queries (verified via CDP, 25 rows render)
- [x] **CLN-2** evaluated, no-op: `jobs/old` (new entry) vs `jobs/[id]/old` (edit) are the same component mounted at two routes (`params?.id` drives mode) — deletion would break a route; two `StockModal.tsx` copies have diverged (view copy adds supplier select, drops `logActivity`/`productName`) — legitimately different
- [ ] **CLN-3** design-token centralization (`inputCls`/`labelCls`/fieldsets/`fHdr` across 20+ files) — deferred: cosmetic-only, high regression risk, no functional value
