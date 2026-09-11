-- ============================================================================
-- 20260916_atomic_job_id_counter.sql
--
-- PROBLEM (confirmed):
--   getNextJobId() client me READ (job_id_counter.last_job_id) → +1 → insert →
--   BAAD me bump. Read-then-write NON-ATOMIC hai. Slow connection / double
--   submit / refresh par 2+ concurrent saves same last_job_id padh lete hain →
--   same job_id + same code ban jata hai → duplicate job rows.
--   DB me (10-Sep-2026): job_id 29023 x3 rows + job_id 29027 x2 rows, same
--   item, same code, ~6 sec apart = bilkul yahi race.
--
-- FIX:
--   1) atomic next_job_id() RPC — increment + RETURN ek hi UPDATE me
--      (SECURITY DEFINER, RLS bypass) — concurrency-safe.
--   2) partial UNIQUE index sirf auto-generated ids (> = 28101) par —
--      DB-level guard bhi. Legacy (manual-era) ids < 28101 par asar nahi.
--
-- Apply: Supabase SQL Editor me run karo. Idempotent — dobara run karna safe.
--
-- ⚠️ PEHLE SE BANE DUPLICATES CLEANUP KARO, warna unique index fail hoga:
--    job_id 29023 (3 rows) + job_id 29027 (2 rows) me se extra rows delete karo.
--
-- ============================================================================

-- 1) Counter row ensure (id=1) — khaali ho to max numeric job_id ya 28101 se seed
insert into public.job_id_counter (id, last_job_id)
select
  1,
  greatest(
    coalesce(
      (select max(case when job_id ~ '^[0-9]+$' then job_id::bigint end)
         from public.transaction_list),
      0
    ),
    28101
  )
on conflict (id) do nothing;

-- 2) Atomic claim function
create or replace function public.next_job_id()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_val integer;
begin
  update public.job_id_counter
  set last_job_id = last_job_id + 1
  where id = 1
  returning last_job_id into next_val;

  if next_val is null then
    -- id=1 row missing (edge case) — seed from max numeric job_id, phir increment
    insert into public.job_id_counter (id, last_job_id)
    select 1, greatest(
      coalesce((select max(case when job_id ~ '^[0-9]+$' then job_id::bigint end)
                from public.transaction_list), 0),
      28100
    )
    on conflict (id) do update
      set last_job_id = public.job_id_counter.last_job_id + 1
    returning last_job_id into next_val;
  end if;

  return next_val;
end;
$$;

grant execute on function public.next_job_id() to anon, authenticated, service_role;

-- 3) DB-level guard: auto-generated job_ids unique (legacy < 28101 untouched).
--    NOTE: existing 29023/29027 duplicates pehle manually hatao — warna ye
--    index creation FAIL hoga (jo khud-ba-khud ye batayega ki kitne dups hain).
create unique index if not exists transaction_list_job_id_autogen_uniq
  on public.transaction_list (job_id)
  where job_id ~ '^[0-9]+$' and job_id::bigint >= 28101;