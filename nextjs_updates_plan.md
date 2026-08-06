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

## Verification
- `npm run build` after each phase
- Manual: create product/service with HSN, print invoices, add client due date, send WA reminder, check dashboard
