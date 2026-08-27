-- ════════════════════════════════════════════════════════════════════════
-- 00b_snapshot_policies_ONLY.sql — SIRF policies ka dump (1 result)
--
-- 00_snapshot_policies.sql me 2 queries the; is file me SIRF wo wali hai
-- jisse policies ke CREATE statements milte hain, taaki SQL Editor me ek hi
-- result dikhe (koi tab-confusion nahi).
--
-- KAISE:
--   1) Is poora content SQL Editor me paste karo → RUN.
--   2) 1 result aayega: column `restore_sql`, har row = ek policy ka
--      complete `drop policy if exists...; create policy ...;`
--   3) Result ke upar-right me download/export icon (⬇) → CSV → file save
--      karo:  supabase/pre-migration/snapshot-policies-2026-08-28.csv
--   4) (RLS-flags wala result pehle aapne save kar liya tha — kaafi hai.)
-- ════════════════════════════════════════════════════════════════════════

select
  E'-- 「' || p.polname || E'」 on ' || quote_ident(n.nspname) || '.' || quote_ident(c.relname) || E'\n' ||
  'drop policy if exists ' || quote_ident(p.polname) || ' on ' || quote_ident(n.nspname) || '.' || quote_ident(c.relname) || ';' || E'\n' ||
  'create policy ' || quote_ident(p.polname) || ' on ' || quote_ident(n.nspname) || '.' || quote_ident(c.relname) || E'\n' ||
  '  for ' ||
    case p.polcmd when 'r' then 'select' when 'a' then 'insert'
                  when 'w' then 'update' when 'd' then 'delete'
                  when '*' then 'all' end ||
  ' to ' || coalesce(roles.roles, 'public') ||
  case when p.polqual is not null then E'\n  using (' || pg_get_expr(p.polqual, p.polrelid) || ')' else '' end ||
  case when p.polwithcheck is not null then E'\n  with check (' || pg_get_expr(p.polwithcheck, p.polrelid) || ')' else '' end ||
  ';' || E'\n' as restore_sql
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
left join lateral (
  select string_agg(quote_ident(r.rolname), ', ' order by r.rolname) as roles
  from unnest(p.polroles) as role_oid
  join pg_roles r on r.oid = role_oid
) roles on true
where n.nspname = 'public'
order by c.relname, p.polname;