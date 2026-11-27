-- K8/B1 — Per-brand job number (additive, safe)
--
-- Best practice decision (owner ne "best apply" diya):
--   * Global `job_id`, `job_id_counter` aur uske indexes bilkul untouched.
--   * Nayi additive `transaction_list.brand_job_no text` (NULL allowed).
--   * URL/register me composite display: `PREFIX#001 (Ref 28101)`.
--   * Prefix `brand_job_counters.prefix` se aata hai; fallback `brands.code`,
--     phir `BR`. Naya `brands.prefix` column nahi — existing counter table hi
--     canonical hai.
--   * Atomic counter RPC `next_brand_job_no(brand_id, prefix?)` — single
--     upsert + RETURNING, isliye concurrent saves me duplicate nahi.
--   * Staff/service_role only guard (D1 pattern); anon/public ko EXECUTE nahi.
--
-- Koi backfill nahi. Purane rows me `brand_job_no` NULL rahega (legacy).
-- Owner apply karega; agent live DB write nahi karta.
--
-- Verify (apply ke baad):
--   select column_name, is_nullable, data_type
--   from information_schema.columns
--   where table_schema='public' and table_name='transaction_list'
--     and column_name='brand_job_no';
--   -- YES / text
--
--   select indexname from pg_indexes
--   where schemaname='public' and tablename='transaction_list'
--     and indexname='transaction_list_brand_job_no_uniq';
--
--   select p.proname, has_function_privilege('anon', p.oid, 'execute') anon_ok
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public' and p.proname='next_brand_job_no';
--   -- anon_ok = false hona chahiye.
--
-- Rollback:
--   drop function if exists public.next_brand_job_no(integer, text);
--   drop index if exists public.transaction_list_brand_job_no_uniq;
--   alter table public.transaction_list drop column if exists brand_job_no;

begin;

alter table public.transaction_list
  add column if not exists brand_job_no text;

create unique index if not exists transaction_list_brand_job_no_uniq
  on public.transaction_list (brand_id, brand_job_no)
  where brand_id is not null and brand_job_no is not null;

create or replace function public.next_brand_job_no(
  p_brand_id integer,
  p_prefix text default null
)
returns text
language plpgsql
security definer
stable
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

commit;
