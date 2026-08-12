# Backup / Restore / Converter — Schema Fix Plan

Created: 2026-08-09
Status: Backup/restore fix APPLIED + VERIFIED. Converter fix pending (plan below).

## Test Results (2026-08-09)

- Safety snapshot: 30 public tables, service-role se captured, per-table checksums
  `C:\Windows\Temp\opencode\vtech\safety-20260809-a\`
- RLS-path check: temporary staff user + profile se app-equivalent backup run kiya —
  saare 27 tables ki counts service-role ke barabar (0 issues). Test user cleanup done.
- Lint (non-destructive): restore strip-logic par backup JSON — pehle 16 columns
  data-loss thi, fix ke baad **0 data-loss** (sirf generated net_amount exempt).
- Naye NOT NULL columns (hsn, login_allowed, alert_quantity) me koi null nahi — restore safe.
- **Barcode finding:** live DB me `product_list.barcode` NORMAL column hai (generated nahi)
  — throwaway-row insert/PATCH test se confirm. App GENERATED_COLS me galat tha;
  ab barcode TABLE_COLUMNS me hai + GENERATED_COLS se hataya — restore par preserve hoga.
- `reset_sequence` RPC exists (verify OK).
- Round-trip test script ready: `C:\Windows\Temp\opencode\vtech\roundtrip-restore.cjs`
  (delete reverse-order + upsert batches + sequence reset + pre/post checksum compare).

## Round-Trip Test Results (2026-08-09) — VERIFIED ✓

Real restore chalaaya (delete all 28 tables + upsert + sequence reset, service-role):
`C:\Windows\Temp\opencode\vtech\roundtrip-20260809-b\` (app-backup.json, pre.json, post.json)

- 8546 rows restore, **0 failed**.
- Post-restore verify (authoritative, paginated + canonical checksums):
  - 28/28 tables: **count match ✓**
  - 27/28 tables: **checksum exact match ✓** (zero data loss)
  - `mechanic_list`: sirf `date_updated` (4 rows) restore-time par overwrite —
    SQL Editor me manually bana `set_updated_at`-style UPDATE-trigger hai jo
    `date_updated = now()` force karta hai. NO_DELETE (profiles FK) + upsert
    path ke wajah se app ise bypass nahi kar sakta. Baaki sab columns intact.
    (Ye pre-existing app behavior hai, round-trip me confirm kiya.)
- Sequences reset OK (app list + payment_reminders). transaction_products/
  transaction_services par id column nahi — app unhe reset karne ki koshish
  nahi karta, isliye koi issue nahi.
- Leftover test user/profile: cleanup verify — 0 matches.

**Verdict: Backup + Restore feature sahi kaam karta hai. Data-loss bugs fix ho
gaye. Koi original data loss nahi hua (sirf mechanic_list ke 4 rows ka
date_updated audit timestamp trigger ki wajah se restore-time ho gaya — cosmetic).**

## Fixed in src/app/backup/page.tsx (verified, tsc clean)

- TABLE_COLUMNS: client_list (+payment_due_date, payment_due_remarks, login_allowed),
  mechanic_list (+image_path), product_list (+hsn, alert_quantity, barcode),
  service_list (+hsn), attendance_list (+time_in, time_out, lat_in, lng_in, lat_out,
  lng_out), inventory_list (+purchase_cost, courier_charges), activity_logs (+id),
  payment_reminders (naya entry).
- BACKUP_TABLES_ORDERED: + payment_reminders (order 14).
- GENERATED_COLS: sirf client_payments.net_amount (barcode remove).
- Restore normalize: hsn null→'', login_allowed → boolean coercion.
- resetSequences: + payment_reminders.

## Problem

Backup page `src/app/backup/page.tsx` `select *` se naye columns capture karta hai,
lekin restore har row se un columns ko **strip** kar deta hai jo `TABLE_COLUMNS`
(page.tsx:66-94) me nahi hain (page.tsx:367-373). Yeh stale schema snapshot hai.
Har restore par naye columns **silently data-loss** hote hain.

MySQL converter (`public/tools/vtech_mysql_converter.html`) bhi mostly pass-through
karta hai par usme bhi gaps hain.

## Findings — live DB vs backup page vs converter

### A. TABLE_COLUMNS stale → restore par data loss (CRITICAL)

| Table | Missing columns (live me exist, restore strip karega) |
|---|---|
| `client_list` | `payment_due_date`, `payment_due_remarks`, `login_allowed` |
| `mechanic_list` | `image_path` |
| `product_list` | `hsn`, `alert_quantity` |
| `service_list` | `hsn` |
| `attendance_list` | `time_in`, `time_out`, `lat_in`, `lng_in`, `lat_out`, `lng_out` |
| `inventory_list` | `purchase_cost`, `courier_charges` |
| `activity_logs` | `id` (live me hai, list me nahi → restore par naye ids banenge) |

Sabse important: `login_allowed` strip hone par restore ke baad **saare client
portal logins disable** ho jayenge (default false).

### B. `payment_reminders` table
Backup list (page.tsx:11-53), converter `TABLES`, aur sequence-reset list
(page.tsx:483) — kisi me nahi → bilkul backup nahi hota.
Live columns: `id`, `client_id`, `amount_due`, `reminder_date`, `channel`, `status`, `remarks`.
Koi FK nahi (dono taraf), delete order se koi farak nahi.

### C. Restore text-normalize loop (page.tsx:382)
- `hsn` (`product_list.hsn`, `service_list.hsn`) `NOT NULL DEFAULT ''` hai —
  null value restore par row **fail** karegi. Normalize list me chahiye.

### D. RLS (client_portal migration 20260809)
- `transaction_list`, `client_payments`, `direct_sales`, `client_loans` par RLS ON.
- Browser backup/restore tab hi chalega jab logged-in user ke `profiles` me
  `role in ('admin','staff')` ho.
- Admin ke paas profile row nahi → ye tables **silently 0 rows** (backup) /
  delete+insert blocked (restore).
- `direct_sales` / `client_loans` delete ke liye `scripts/fix_rls.sql` ki
  `portal_direct_sales_staff` / `portal_client_loans_staff` policies zaroori hain.

### E. Converter (`vtech_mysql_converter.html`)
- `payment_reminders` missing from `TABLES`.
- `hsn` (numeric HSN/SAC) → generic cast me `parseInt` → number ban jata hai;
  `STR_F` me dalna chahiye.
- `payment_due_date` → `DATE_ONLY` me nahi (abhi luck se string reh kar kaam
  karta hai).
- `purchase_cost` / `courier_charges` → `FLOAT_F` me nahi (generic kaam karta
  hai, cleaner fix chahiye).
- `login_allowed` — agar PHP/MySQL me ho (tinyint 0/1), converter number 0/1
  emit karega aur boolean column restore par **fail** ho jayega; boolean
  handling chahiye.

## Plan (ordered)

1. **`TABLE_COLUMNS` update** (page.tsx:66-94)
   - `client_list` += `payment_due_date`, `payment_due_remarks`, `login_allowed`
   - `mechanic_list` += `image_path`
   - `product_list` += `hsn`, `alert_quantity`
   - `service_list` += `hsn`
   - `attendance_list` += `time_in`, `time_out`, `lat_in`, `lng_in`, `lat_out`, `lng_out`
   - `inventory_list` += `purchase_cost`, `courier_charges`
   - `activity_logs` += `id`

2. **`payment_reminders` add karo**
   - `BACKUP_TABLES_ORDERED` me last order (koi FK nahi)
   - `TABLE_COLUMNS` me entry
   - `resetSequences` list me
   - Converter `TABLES` me

3. **Restore normalize fix** (page.tsx:382 area)
   - `hsn` → null/undefined → `''`
   - `login_allowed` → null → `false` (boolean default)
   - Clean approach: chhota per-column-default map.

4. **Converter updates**
   - `TABLES` += `payment_reminders`
   - `STR_F` += `hsn` (product_list, service_list)
   - `DATE_ONLY` += `payment_due_date`
   - `FLOAT_F` += `purchase_cost`, `courier_charges` (inventory_list)
   - Optional: boolean cast handling for `login_allowed`

5. **Verify (SQL run karke)**
   - Admin user ke paas `profiles` row `role='admin'`/`'staff'` hai
   - `fix_rls.sql` policies applied hain
   - Nahin to backup/restore RLS ki wajah se silent fail karega

6. **Optional: sequence-reset list** (page.tsx:483)
   - `suppliers`, `spare_supplier`, `loan_payments`, `transaction_products`,
     `transaction_services`, `transaction_images` bhi add (explicit-ID restore
     me zaroori nahi, par consistency ke liye).

## Reference — verified live schema (service-role query, 2026-08-09)

- `client_list`: id, firstname, middlename, lastname, contact, email, address,
  image_path, opening_balance, delete_flag, date_created, date_updated,
  payment_due_date, payment_due_remarks, login_allowed
- `mechanic_list`: id, firstname, middlename, lastname, contact, designation,
  daily_salary, avatar, commission_percent, status, delete_flag, date_added,
  date_updated, salary_per_day, image_path
- `product_list`: id, name, description, cost_price, price, image_path, status,
  delete_flag, date_created, date_updated, hsn, alert_quantity, barcode (generated)
- `service_list`: id, name, description, price, status, delete_flag,
  date_created, date_updated, hsn
- `attendance_list`: id, mechanic_id, status, curr_date, time_in, time_out,
  lat_in, lng_in, lat_out, lng_out
- `inventory_list`: id, product_id, quantity, place, stock_date, date_created,
  date_updated, supplier_id, purchase_cost, courier_charges
- `activity_logs`: id, user_id, action, module, meta_id, details, date_created
- `payment_reminders`: id, client_id, amount_due, reminder_date, channel, status, remarks
- `client_payments`: id, client_id, job_id, loan_id, bill_no, payment_date,
  amount, discount, net_amount (generated), payment_mode, payment_type, remarks, created_at
