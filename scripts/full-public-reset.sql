-- ══════════════════════════════════════════════════════════════════════════════
-- FULL PUBLIC SCHEMA RESET — sirf tab jab sach me schema khali/break ho
-- ══════════════════════════════════════════════════════════════════════════════
--
-- ⚠️⚠️  YEH SABSE DESTRUCTIVE SCRIPT HAI. PEHLE `scripts/reset-db-data.sql`
--       (data-only reset) try karo — wo profiles/system_info/job_id_counter aur
--       auth.users ko safe rakhta hai. Ye file sirf tab chalao jab aapko
--       poora `public` schema hi dobara banana ho.
--
-- KYA HOTA HAI:
--   • `public` schema DROP ... CASCADE + dobara CREATE (tables, views,
--     functions, triggers, RLS policies, sequences — sab jate hain).
--   • `auth.users`, `storage`, `supabase_migrations` ko haath nahi lagta.
--   • Guarded: confirm token ke bina kuch nahi hota.
--
-- KYA BACHATA HAI (alag schema me):
--   • `vtech_rescue.system_info_before_reset`
--   • `vtech_rescue.job_id_counter_before_reset`
--   • `vtech_rescue.admin_profile_before_reset`  (admin/developer profiles)
--
-- 🚨 LOCK-OUT WARNING:
--   `profiles` bhi public me hai. Agar aap yahan ke baad admin profile wapas
--   nai banate to `/backup` aur `/api/backup/auth-restore` dono 403 dein ge
--   (requireAdmin() profile se role padhta hai). Isliye neeche STEP 3 zaroori hai.
--
-- ── CHALANE KE STEPS ──────────────────────────────────────────────────────────
--   0) Pehle fresh JSON backup lo (/backup → Download) aur yahan bhi guard token
--      set karo:  confirm_token := 'WIPE_PUBLIC_SCHEMA'
--   1) Poora file Supabase SQL Editor me ek saath Run karo.
--   2) Full idempotent schema apply karo:
--      supabase/migrations/20260913000000_final_full_schema_idempotent.sql
--      (additive-only; baaki migrations isme fold ho chuki hain — drift 33 OK)
--   3) Admin profile + system_info wapas daalo (neeche STEP 3 SQL).
--   4) Ab /backup kholo → JSON restore → phir "Admin Restore" → Dry Run →
--      missing users (temp password ON) → confirm.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── STEP 1 — GUARDED WIPE (poora file ek Run) ────────────────────────────────
do $$
declare
  -- ── STEP 1a — GUARD TOKEN ─────────────────────────────────────────────────
  --   Khali quotes me likho:  'WIPE_PUBLIC_SCHEMA'
  confirm_token text := '';
  -- ───────────────────────────────────────────────────────────────────────────
  n_tables int;
  n bigint;
  t text;
begin
  if confirm_token <> 'WIPE_PUBLIC_SCHEMA' then
    raise exception 'GUARD: confirm nahi mila. confirm_token ko WIPE_PUBLIC_SCHEMA karo, phir dobara Run. Kuch delete nahi hua.';
  end if;

  select count(*) into n_tables from pg_tables where schemaname = 'public';
  if n_tables = 0 then
    raise exception 'public schema pehle se khali hai — pehle full schema apply karo.';
  end if;

  raise notice '──────── PRE-FLIGHT ────────';
  raise notice 'DB = % | user = %', current_database(), current_user;
  raise notice 'public tables = % (auth.users ko haath nahi lenge)', n_tables;

  foreach t in array array['transaction_list', 'client_list', 'system_info',
                           'profiles', 'job_id_counter', 'locations'] loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into n;
      raise notice '  % = % rows', rpad(t, 18), n;
    end if;
  end loop;

  -- ── Rescue snapshot (public drop se pehle) ─────────────────────────────────
  create schema if not exists vtech_rescue;

  execute 'drop table if exists vtech_rescue.system_info_before_reset';
  execute 'create table vtech_rescue.system_info_before_reset as select * from public.system_info';

  execute 'drop table if exists vtech_rescue.job_id_counter_before_reset';
  execute 'create table vtech_rescue.job_id_counter_before_reset as select * from public.job_id_counter';

  execute 'drop table if exists vtech_rescue.admin_profile_before_reset';
  execute 'create table vtech_rescue.admin_profile_before_reset as select * from public.profiles where role in (''admin'', ''developer'')';

  raise notice 'Rescue ready: vtech_rescue.*_before_reset';

  -- ── Actual wipe ────────────────────────────────────────────────────────────
  execute 'drop schema public cascade';
  execute 'create schema public';
  execute 'comment on schema public is ''standard public schema''';

  execute 'grant usage on schema public to anon, authenticated, service_role';
  execute 'grant all on schema public to postgres';
  execute 'grant all on all tables in schema public to postgres, anon, authenticated, service_role';
  execute 'grant all on all sequences in schema public to postgres, anon, authenticated, service_role';
  execute 'grant all on all functions in schema public to postgres, anon, authenticated, service_role';
  execute 'alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role';
  execute 'alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role';
  execute 'alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role';

  raise notice 'public schema wipe COMPLETE. Ab full schema + STEP 3 chalao.';
end $$;

-- ── STEP 3 — FULL SCHEMA KE BAAD: settings + admin wapas ──────────────────────
-- Ye hissa full schema apply karne ke BAAD alag se chalao.
--
-- insert into public.system_info (id, meta_field, meta_value)
-- select id, meta_field, meta_value from vtech_rescue.system_info_before_reset
-- on conflict (id) do update set meta_value = excluded.meta_value;
--
-- insert into public.profiles (id, full_name, email, role)
-- select id, full_name, email, role from vtech_rescue.admin_profile_before_reset
-- on conflict (id) do update
--   set full_name = excluded.full_name,
--       email = excluded.email,
--       role = excluded.role;
--
-- -- Verify: yahan aapka admin email/role dikhna chahiye, warna /setup se admin banayein.
-- select id, email, role from public.profiles where role in ('admin', 'developer');
--
-- ── KYA NAHI KARNA ────────────────────────────────────────────────────────────
-- • auth.users mat delete karo. Agar delete kiye to naye UID se login hoga aur
--   backup ke purane UID match nahi honge; admin route createMissingUsers se hi
--   users banane honge (temp password UI me milega).
-- • Storage files orphan ho sakti hain (DB rows gaye, files rahengi) — alag se saaf karo.
-- • Ye script kisi migration me NAHI hai — kabhi auto-run nahi hoga.
