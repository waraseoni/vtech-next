-- K8/B1 — Brand numbering only in single_brand / multi_brand mode.
--
-- Owner decision (28 Nov): autonomous me brand wala job-id system chalna hi
-- nahi chahiye — wahan purana global `job_id` single source rahega. Brand
-- autonomous me sirf optional device metadata hai; uska counter nahi badhega.
--
-- DB-level guard authoritative hai (kisi bhi create path se bypass na ho).
-- Client helper bhi mode pehle check karta hai taaki autonomous me user ko
-- unnecessary error na dikhe. Missing/unknown key = autonomous (fail closed).
--
-- Signature, grants, column, index aur global job_id/counter/index unchanged.
-- Purane jobs ke brand_job_no preserved — koi backfill/renumber nahi.
--
-- Owner apply karein; agent live DB write nahi karta.
--
-- Verify:
--   select p.provolatile,
--          pg_get_functiondef(p.oid) ilike '%service_center_mode%' as mode_gated
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public' and p.proname='next_brand_job_no';
--   -- expected: v / true

alter function public.next_brand_job_no(integer, text) volatile;

create or replace function public.next_brand_job_no(
  p_brand_id integer,
  p_prefix text default null
)
returns text
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_prefix text;
  v_seq integer;
begin
  if not (
    public.is_frontend_staff()
    or coalesce(
         nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
         ''
       ) = 'service_role'
  ) then
    raise exception 'permission denied for staff-only function' using errcode = '42501';
  end if;

  -- Autonomous (ya missing/unknown mode) me brand numbering bilkul band.
  if not exists (
    select 1
    from public.system_info
    where meta_field = 'service_center_mode'
      and lower(btrim(coalesce(meta_value, ''))) in ('single_brand', 'multi_brand')
  ) then
    raise exception 'brand numbering disabled in autonomous mode' using errcode = 'check_violation';
  end if;

  select coalesce(nullif(btrim(p_prefix), ''), nullif(btrim(b.code), ''), 'BR')
    into v_prefix
  from public.brands b
  where b.id = p_brand_id
    and b.is_active;
  if not found then
    raise exception 'active brand not found: %', p_brand_id using errcode = '23503';
  end if;

  insert into public.brand_job_counters (brand_id, last_sequence_number, prefix)
  values (p_brand_id, 1, v_prefix)
  on conflict (brand_id) do update
     set last_sequence_number = brand_job_counters.last_sequence_number + 1,
         prefix = coalesce(nullif(btrim(p_prefix), ''), brand_job_counters.prefix),
         date_updated = now()
  returning last_sequence_number into v_seq;

  return v_prefix || '#' || lpad(v_seq::text, 3, '0');
end;
$$;

revoke all on function public.next_brand_job_no(integer, text) from public, anon;
grant execute on function public.next_brand_job_no(integer, text) to authenticated, service_role;

notify pgrst, 'reload schema';
