-- ─────────────────────────────────────────────────────────────────────────────
-- 20261117_jobs_list_sort_index.sql
-- /jobs list first-paint perf (docs/plans/speed_wins_nov13_2026.md §6.5)
--
-- KYUN
--   Jobs list ka page query:  del_status = 0  order by job_id desc  limit 25
--   `job_id` TEXT hai aur uspar koi poora btree index nahi (sirf partial unique
--   index job_id >= 28101 ke liye) — isliye har load par 2.3k rows ka sort.
--
--   Measured (RLS ke saath, same query, transaction test + rollback):
--     bina index : ~106 ms (PostgREST par ~250 ms, gateway overhead ke saath)
--     index ke baad: ~39 ms (Index Scan, execution 0.98 ms)
--   Yahi query client-side pagination/filter par bhi chalti hai.
--
-- KYA NAHI KIYA
--   - Koi column/constraint/data change nahi. Sirf ek naya btree index.
--   - `concurrently` nahi (Supabase SQL editor transaction me chalata hai);
--     table chhoti hai (1752 kB) — build instant, lock momentary.
--   - Sort semantics same: job_id desc (id/date_created par nahi badla).
--
-- Idempotent: `if not exists`. Apply: Supabase SQL Editor (ek baar).
--
-- Verify (SQL Editor):
--   select indexname,
--          pg_size_pretty(pg_relation_size(quote_ident(indexname)::regclass)) as size
--     from pg_indexes
--    where schemaname = 'public'
--      and indexname = 'transaction_list_del_status_job_id_idx';
--
--   explain (analyze, buffers, costs off)
--   select * from public.transaction_list
--    where del_status = 0
--    order by job_id desc
--    limit 25;
--   -- "Index Scan using transaction_list_del_status_job_id_idx" dikhna chahiye.
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists transaction_list_del_status_job_id_idx
  on public.transaction_list (del_status, job_id desc);

NOTIFY pgrst, 'reload schema';
