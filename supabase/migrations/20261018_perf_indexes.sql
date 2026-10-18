-- ─────────────────────────────────────────────────────────────────────────────
-- 20261018_perf_indexes.sql
-- Phase 6 (DB indexes) — docs/plans/perf_db_fetch_audit_oct14_2026.md
-- User approval: 2026-10-18 (peak-season freeze is sprint ke liye uth gaya).
--
-- KYUN
--   1. Navbar universal search (src/hooks/useNavbarSearch.ts) har keystroke
--      (300ms debounce) par 6 tables par multi-column `ILIKE '%q%'` OR
--      chalata hai. Leading-wildcard ILIKE kabhi btree index use NAHI kar
--      sakta — sirf pg_trgm GIN. Bina iske har search = sequential scan.
--   2. Bahut si HOT table par eq/sort ke liye index hi nahi hai —
--      activity_logs / direct_sales / client_payments / client_loans /
--      client_list par ZERO index. (audit §"Current DB indexes" me list thi.)
--
-- KYA NAHI KIYA
--   - Koi column drop/rename, koi data change, koi constraint nahi — sirf
--     CREATE EXTENSION + CREATE INDEX. Readers/writers bilkul same rahenge.
--   - `concurrently` NAHI use kiya (Supabase SQL editor migration ko
--     transaction block me chalata hai) — tables abhi chhoti hain (badi =
--     activity_logs 4,016 rows) isliye build instant aur lock momentary hai.
--
-- Idempotent: har statement `if not exists` — baar baar run safe.
-- Apply: Supabase SQL Editor me run karo (ek baar).
--   Verify: see "Verify" section at the bottom of this file.
-- ─────────────────────────────────────────────────────────────────────────────

-- 0) pg_trgm — trigram index ke liye zaroori (Supabase trusted extension).
--    `gin_trgm_ops` ke liye hi chahiye; baki kuch nahi badalta.
create extension if not exists pg_trgm with schema extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) NAVBAR SEARCH — pg_trgm GIN (ILIKE '%q%' seq-scan se bachne ke liye)
--    Har index me wahin columns hain jo useNavbarSearch.ts me ILIKE par
--    hote hain (ek table = ek index; OR predicates bitmap-OR se use ho jate).
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists client_list_trgm_idx
  on public.client_list using gin (
    firstname gin_trgm_ops, middlename gin_trgm_ops, lastname gin_trgm_ops,
    contact gin_trgm_ops, address gin_trgm_ops
  );

create index if not exists transaction_list_trgm_idx
  on public.transaction_list using gin (
    item gin_trgm_ops, fault gin_trgm_ops, job_id gin_trgm_ops,
    code gin_trgm_ops, uniq_id gin_trgm_ops
  );

create index if not exists product_list_trgm_idx
  on public.product_list using gin (name gin_trgm_ops);

create index if not exists mechanic_list_trgm_idx
  on public.mechanic_list using gin (firstname gin_trgm_ops, lastname gin_trgm_ops);

create index if not exists direct_sales_trgm_idx
  on public.direct_sales using gin (sale_code gin_trgm_ops, remarks gin_trgm_ops);

create index if not exists locations_trgm_idx
  on public.locations using gin (
    zone gin_trgm_ops, rack gin_trgm_ops, bin gin_trgm_ops,
    box gin_trgm_ops, label gin_trgm_ops, code gin_trgm_ops
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) HOT eq / sort filters (btree) — audit ke "missing index" list se.
-- ─────────────────────────────────────────────────────────────────────────────

-- activity_logs — pehle ZERO index. Jobs list + activity page ke reader.
-- (Dual-era convention: module 'Jobs' | 'Transactions', meta_id = PK/job_id —
--  dono module aur meta_id par filter hota hai; date_created par sort.)
create index if not exists activity_logs_module_action_date_idx
  on public.activity_logs (module, action, date_created desc);

create index if not exists activity_logs_meta_id_idx
  on public.activity_logs (meta_id);

-- direct_sales — pehle ZERO index. Client view ka sabse bada unbounded query
-- (client_name se sales) + navbar search ka sale_code/remarks (trgm se cover).
create index if not exists direct_sales_client_date_idx
  on public.direct_sales (client_id, date_created desc);

-- client_payments / client_loans — pehle ZERO index. Client view (har ek
-- payment/loan client_id par) + jobs list ke financial enrich.
create index if not exists client_payments_client_date_idx
  on public.client_payments (client_id, payment_date desc);

create index if not exists client_loans_client_status_idx
  on public.client_loans (client_id, status);

-- transaction_list — sirf location_id + unique job_id tha. Ye teen hot paths:
--   client view : client_name se saare jobs (audit: NO LIMIT tha)
--   jobs list   : del_status=0 (+ status IN) order by date_created desc
create index if not exists transaction_list_client_date_idx
  on public.transaction_list (client_name, date_created desc);

create index if not exists transaction_list_del_status_date_idx
  on public.transaction_list (del_status, date_created desc);

create index if not exists transaction_list_status_date_idx
  on public.transaction_list (status, date_created desc);

-- child tables: transaction_id par pehle se koi index nahi tha (sirf
-- transaction_products ka composite unique (transaction_id, product_id) hai,
-- jo sirf txn-leading query chalta hai — product_id-LEADING nahi).
create index if not exists transaction_services_txn_idx
  on public.transaction_services (transaction_id);

create index if not exists transaction_images_txn_idx
  on public.transaction_images (transaction_id);

create index if not exists transaction_products_product_idx
  on public.transaction_products (product_id);

-- NOTE (jaan-bujh kar NAHI banaya):
--   * `delete_flag` / `status`-jaise 2-value flags par btree/partial index —
--     98% rows active hain, to index scan seq-scan se sasta nahi padta.
--   * `mechanic_id` (sirf 4 mechanics) — selectivity hi nahi hai.
-- Inhe tab add karna jab data 10-20x ho jaye aur plan me seq-scan dikhe.

-- ─────────────────────────────────────────────────────────────────────────────
-- Verify (SQL Editor me chalao) — naye indexes dikhne chahiye:
--
--   select indexname,
--          pg_size_pretty(pg_relation_size(quote_ident(indexname)::regclass)) as size
--   from pg_indexes
--   where schemaname = 'public' and indexname in (
--     'client_list_trgm_idx','transaction_list_trgm_idx','product_list_trgm_idx',
--     'mechanic_list_trgm_idx','direct_sales_trgm_idx','locations_trgm_idx',
--     'activity_logs_module_action_date_idx','activity_logs_meta_id_idx',
--     'direct_sales_client_date_idx','client_payments_client_date_idx',
--     'client_loans_client_status_idx','transaction_list_client_date_idx',
--     'transaction_services_txn_idx','transaction_products_product_idx'
--   )
--   order by indexname;
--
--   -- navbar search ka query plan (seq scan hona band ho jana chahiye):
--   explain (analyze, buffers)
--   select id, firstname from public.client_list
--   where delete_flag = 0 and firstname ilike '%ra%';
-- ─────────────────────────────────────────────────────────────────────────────
