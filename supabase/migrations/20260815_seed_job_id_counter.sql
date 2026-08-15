-- ============================================================================
-- 20260815_seed_job_id_counter.sql
-- job_id_counter table khaali thi → counter kabhi advance nahi hota tha.
-- (new job hamesha fallback 28102, bulk 27651 — alag-alag magic numbers.)
--
-- Seed: id=1 row, last_job_id = max(existing numeric job_id, 28101) taaki
-- naye jobs continuity se chalein aur imported jobs se collide na hon.
--
-- Apply: Supabase SQL Editor me run karo (ek baar, idempotent).
-- ============================================================================

insert into public.job_id_counter (id, last_job_id)
select
  1,
  greatest(
    coalesce(
      (select max(case when job_id ~ '^[0-9]+$' then job_id::bigint end) from public.transaction_list),
      0
    ),
    28101
  )
where not exists (select 1 from public.job_id_counter where id = 1);
