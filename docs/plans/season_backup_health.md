# Season Backup Health — Checklist & Verified Status

> Purpose: **read-only** data-safety health checks during peak season (start 2026-09-15).
> Zero production changes. Verified portion uses REST (service-role, GET/HEAD only).
> Review cadence: weekly quick check (5 min) + monthly restore dry-run.

## 1. What was verified live (2026-09-16)

Method: REST probes with service-role key (read-only) against Supabase ref
`rklyznlrcrysdpksltxm`. Direct `psql`/`pg_dump` is **not possible** from this
machine (no token, `db.<ref>` doesn't resolve, pooler for this tenant unreachable)
— so platform-level backup status must be checked via Dashboard (see §3).

| Check | Result | Notes |
|---|---|---|
| Storage buckets | ✅ 8/8 | client-photos, job-images, mechanic-photos, user-avatars, product-images, media, spare-photos, supplier-photos — all public, all reachable |
| Profiles (RLS basics) | ✅ | admin=1, staff=4, developer=1, client=3 (9 total) |
| `client_contacts` (new table) | ✅ | migration live, 0 rows — ready for use |
| DB table readability | ✅ 26/28 readable | probe `?select=id&limit=1`; see §2 |
| RLS lockdown | ✅ | evidence-chain verified: `portal_*_staff` policies + `is_frontend_staff()` live (`20260911_rls_lockdown.sql` fold-in) |
| `bom_templates` | ⏳ 404 | migration `20260922_bom_templates.sql` **applied nahi** — expected; apply → re-probe |

## 2. Readability matrix — readable (26)

transaction_list, transaction_products, transaction_images, product_list,
inventory_list, client_list, client_payments, client_loans, loan_payments,
suppliers, supplier_payments, expense_list, purchase_orders, direct_sales,
direct_sale_items, stock_adjustments, stock_counts, profiles, activity_logs,
system_info, locations, job_required_parts, mechanic_list, attendance_list,
advance_payments, payment_reminders.

**Column-name artifacts (table exists, no `id` column):**
- `transaction_services` → 400 (probe used `id`; table present)
- `product_locations` → 400 (same)

**Not yet applied:** `bom_templates` → 404 (PGRST205) — pending migration.

## 3. Weekly operator checklist (Dashboard, manual — you, not this repo)

1. **Dashboard → Database → Backups** — latest automatic backup < 48h old, no failed
   entries in last 7 days.
2. **PITR toggle** (if tier supports) — confirm ON.
3. **Storage sanity** — Dashboard → Storage: each of the 8 buckets has expected
   objects; no bucket appears emptied. Check after any "image delete/repair" runs.
4. **RLS spot check** — login as a client (or use a fresh low-privilege user) and
   confirm only own data visible; roles table unchanged.

> URL pattern: `https://supabase.com/dashboard/project/rklyznlrcrysdpksltxm/database/backups`

## 4. Monthly restore dry-run (out of peak-usage hours)

1. **Export:** Dashboard → Database → Backups → Download (or `pg_dump` with the
   Direct connection string from Settings → Database → Connection string; use the DB
   password from `.env.local` — never commit it).
2. **Restore local scratch:** `pg_restore --clean --if-exists --no-owner -d <scratch>` 
   Or SQL file: `createdb scratch && psql -d scratch -f dump.sql`
3. **Verify schema:** `\dt public` → count ≈ the consolidated schema table list
   (~50 tables; see `supabase/migrations/20260913000000_final_full_schema_idempotent.sql`).
4. **Verify data:** spot-check row counts > 0: transaction_list, product_list,
   inventory_list, client_list, expense_list, purchase_orders.
5. **Verify RLS scripts present:** `is_frontend_staff()` + `tl_*` / `portal_*_staff`
   policies present in `\d+` output.
6. Log result + date in this file (§6).

## 5. Scoping reality-check

- `/api/backups` in this repo only lists **legacy local reference files**
  (`php-ref/db/*.sql` + `vikram_db_supabase.txt`). Both are **absent** in this
  checkout — it is **not** the live backup mechanism. Do not rely on it.
- Live data safety = Supabase **platform backups + PITR** + Storage objects.
- **Storage objects are NOT included in DB backups** — badge/photo buckets need
  separate export/download cadence, or accept Supabase-managed redundancy for the
  player's risk. Decide now during season.
- This checklist intentionally performs **no writes** — all checks above are
  SELECT/HEAD level.

## 6. Run log

| Date | Who | Result |
|---|---|---|
| 2026-09-16 | opencode | Read-only REST audit PASS; 26/28 readable (+2 col-name artifacts), buckets 8/8, `bom_templates` pending migration. Platform backup schedule + PITR + storage export = user action (§3/§4). |