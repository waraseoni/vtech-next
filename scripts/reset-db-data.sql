-- ══════════════════════════════════════════════════════════════════════════════
-- RESET SCRIPT — saara BUSINESS DATA khali karo (schema + RLS + functions safe)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- ⚠️⚠️  DESTRUCTIVE — sirf NAYE (khali karne wale) Supabase project me chalao.
--       Chalane se pehle screen par project ka naam/URL confirm karo:
--       Supabase Dashboard → Project Settings → General / API.
--       LIVE shop DB par ye kabhi na chalao — data wapas nahi aayega
--       (sirf backup se: Dashboard → Database → Backups, ya `pg_dump`).
--
-- Kya hota hai:
--   • 52 public tables ka data TRUNCATE (structure, columns, indexes, RLS
--     policies, triggers, functions sab waise hi rahenge).
--   • Id sequences 1 se RESTART (naye project me ids 1,2,3... se shuru).
--   • RAKHI jaati hain (data ke saath): `profiles` (login/roles), `system_info`
--     (shop settings, logo, announcements), `job_id_counter` (job-id series).
--   • `auth.users` (logins) ko haath nahi lagta — login chalta rahega.
--
-- FK ka handling (kyunki `profiles` business tables ko reference karta hai):
--   • `profiles.client_id → client_list` aur `profiles.mechanic_id →
--     mechanic_list` FK truncate ko block karte hain. Script inhe is transaction
--     ke andar temporary drop karta hai, truncate ke baad wapas add karta hai.
--   • Isliye kept `profiles` rows me ye do columns NULL ho jayenge (jaisa
--     client/mechanic delete hone par hota hai). Baaki profile data safe hai.
--
-- Kya nahi hota (alag se karna hoga):
--   • Storage bucket files (job-images, product-image, ...) — DB rows wipe hone
--     se wo files orphan ho jayengi. Dashboard → Storage → bucket → empty.
--   • `auth.users` — chahiye to Dashboard → Authentication → Users.
--   • Edge function secrets / API keys / Vault — ye DB tables me nahi hain.
--
-- system_info ka dhyan: naya project purane data ka dump hai to usme purane
-- project ki encrypted AI key hogi (encryption key project-specific hoti hai) —
-- Settings me AI provider key dobara save karni padegi.
--
-- ── KAISE CHALAYE (1 step — poora file ek Run) ────────────────────────────────
--   Neeche STEP 1 me khali quotes ke beech token likho:
--       confirm_token text := 'WIPE_ALL_BUSINESS_DATA';
--   Phir poora file ek saath Run karo.
--   Token khali chhoda to script khud exception dekar ruk jayegi — kuch delete
--   nahi hoga. Poora kaam ek hi DO block (single transaction) me hai: beech me
--   koi error aaya to sab rollback ho jayega (FKs bhi wapas).
-- ══════════════════════════════════════════════════════════════════════════════

do $$
declare
  -- ── STEP 1 — GUARD TOKEN ───────────────────────────────────────────────────
  --   Khali quotes me likho:  'WIPE_ALL_BUSINESS_DATA'
  confirm_token text := '';
  -- ───────────────────────────────────────────────────────────────────────────

  keep text[] := array['profiles', 'system_info', 'job_id_counter'];

  total_tables int;
  keep_tables int;
  n bigint;
  touched bigint;
  t text;
  tbls text;
  n_tables int;
  r record;

  fk record;
  fk_list jsonb := '[]'::jsonb;
  item jsonb;
  set_sql text;
  where_sql text;

  leftover text := '';
begin
  if confirm_token <> 'WIPE_ALL_BUSINESS_DATA' then
    raise exception
      'GUARD: wipe confirm nahi mila. Line `confirm_token text := ''''` ko `confirm_token text := ''WIPE_ALL_BUSINESS_DATA''` karo, phir dobara Run. (Kuch delete nahi hua.)';
  end if;

  -- ── STEP 2 — PRE-FLIGHT (kya delete hone wala hai; padho) ──────────────────
  select count(*) into total_tables from pg_tables where schemaname = 'public';
  select count(*) into keep_tables from pg_tables
   where schemaname = 'public' and tablename = any (keep);

  raise notice '──────── PRE-FLIGHT ────────';
  raise notice 'DB = % | user = % | host = %', current_database(), current_user, inet_server_addr();
  raise notice 'public tables = % (keep = %, truncate = %)',
    total_tables, keep_tables, total_tables - keep_tables;

  foreach t in array array['transaction_list', 'client_list', 'client_payments',
                           'activity_logs', 'mechanic_list', 'inventory_list'] loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into n;
      raise notice '  % = % rows', rpad(t, 18), n;
    else
      raise notice '  % = MISSING (schema pehle apply karo)', t;
    end if;
  end loop;

  if total_tables = 0 then
    raise exception 'public schema khali hai — pehle full schema apply karo (supabase/migrations/…full_schema…).';
  end if;

  -- ── STEP 3 — BLOCKING FKs: temporary drop (transaction ke andar) ───────────
  -- Kept tables ke wo FK jo truncated tables ko point karte hain, TRUNCATE ko
  -- rok dete hain. Definition yaad rakh kar drop karte hain, baad me wapas.
  for fk in
    select con.conname,
           child.relname  as child_tbl,
           parent.relname as parent_tbl,
           pg_get_constraintdef(con.oid) as def,
           (select array_agg(a.attname order by k.ord)
              from unnest(con.conkey) with ordinality as k(attnum, ord)
              join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as cols
      from pg_constraint con
      join pg_class child     on child.oid  = con.conrelid
      join pg_namespace cn    on cn.oid     = child.relnamespace
      join pg_class parent    on parent.oid = con.confrelid
      join pg_namespace pn    on pn.oid     = parent.relnamespace
     where con.contype = 'f'
       and cn.nspname = 'public'
       and pn.nspname = 'public'
       and child.relname  = any (keep)
       and parent.relname <> all (keep)
     order by child.relname, con.conname
  loop
    fk_list := fk_list || jsonb_build_object(
      'child',   fk.child_tbl,
      'conname', fk.conname,
      'def',     fk.def,
      'cols',    to_jsonb(fk.cols)
    );
    execute format('alter table public.%I drop constraint %I', fk.child_tbl, fk.conname);
    raise notice 'FK temporary hataya: %.% → %', fk.child_tbl, fk.conname, fk.parent_tbl;
  end loop;

  -- ── STEP 4 — TRUNCATE (RESTART IDENTITY) ───────────────────────────────────
  select count(*), string_agg(format('%I.%I', schemaname, tablename), ', ' order by tablename)
    into n_tables, tbls
    from pg_tables
   where schemaname = 'public'
     and tablename <> all (keep);

  if tbls is null then
    raise notice 'Truncate karne ke liye koi table nahi mili.';
    return;
  end if;

  raise notice 'TRUNCATE % tables (RESTART IDENTITY)…', n_tables;
  execute 'truncate table ' || tbls || ' restart identity';
  raise notice 'Truncate done. % tables saaf ho gayi.', n_tables;

  -- ── STEP 5 — FK wapas: pehle dangling values NULL karo, phir constraint ────
  for item in select * from jsonb_array_elements(fk_list) loop
    select string_agg(format('%I = null', c), ', ')
      into set_sql
      from jsonb_array_elements_text(item -> 'cols') as c;

    select string_agg(format('%I is not null', c), ' or ')
      into where_sql
      from jsonb_array_elements_text(item -> 'cols') as c;

    execute format('update public.%I set %s where %s', item ->> 'child', set_sql, where_sql);
    get diagnostics touched = row_count;

    execute format('alter table public.%I add constraint %I %s',
      item ->> 'child', item ->> 'conname', item ->> 'def');

    raise notice 'FK wapas: %.% (NULL kiye gaye rows: %)',
      item ->> 'child', item ->> 'conname', touched;
  end loop;

  -- ── STEP 6 — VERIFY (sirf keep-tables me rows dikhni chahiye) ──────────────
  for r in select tablename from pg_tables where schemaname = 'public' order by tablename loop
    execute format('select count(*) from public.%I', r.tablename) into n;
    if n > 0 then
      leftover := leftover || format('%s=%s ', r.tablename, n);
    end if;
  end loop;
  raise notice 'Non-empty tables: %', coalesce(nullif(leftover, ''), '(none)');
end $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- OPTIONAL — chahiye to alag se (comment hata kar) chalao:
-- ══════════════════════════════════════════════════════════════════════════════
--
-- (a) AI provider config bhi rakhni hai? Upar `keep` array me 'ai_providers'
--     add kar do (STEP 2/4 dono isi ek array se chalte hain).
--
-- (b) `profiles.client_id` / `profiles.mechanic_id` upar automatically NULL ho
--     jate hain (FK ke kaaran). Alag se kuch karne ki zaroorat nahi.
--
-- (c) Job ids 28101 se fresh chahiye:
--     update public.job_id_counter set last_job_id = 28100 where id = 1;
--
-- (d) Legacy PHP `users` table bhi chahiye thi? Wo truncate ho gayi hai
--     (auth ise use nahi karta — logins `auth.users` + `profiles` se chalte hain).
--
-- (e) Storage files (dashboard se): Storage → job-images / product-image /
--     repair-images → select all → delete.
--
-- (f) Auth users bhi delete karne hain? Dashboard → Authentication → Users
--     (ya Admin API). Phir `profiles` rows bhi delete karni padengi, aur
--     /setup se dobara admin banana hoga.
-- ══════════════════════════════════════════════════════════════════════════════
