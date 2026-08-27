-- ════════════════════════════════════════════════════════════════════════
-- 00_snapshot_policies.sql — PRE-MIGRATION SNAPSHOT (rollback ka data)
--
-- SBSE PEHLE YE CHALAO: migration (20260911_rls_lockdown.sql) apply karne
-- se PEHLE Supabase SQL Editor me ye queries run karo.
--
-- Kis liye:
--   20260911 migration section-2 drop-loop me 19 tables ki SAB purani
--   policies drop karke nayi banata hai. Agar kabhi "pehle jaisa" restore
--   karna ho to purani policies ki EXACT definition chahiye — wo isi file
--   ke output se milti hai.
--
-- KAISE RUN + SAVE KAREIN:
--   1) Supabase Dashboard > SQL Editor me ye file ka poora content paste karo.
--   2) RUN karo.
--   3) Result 1 (restore_sql) ko copy karke file me save karo:
--        supabase/pre-migration/snapshot-policies-2026-08-28.sql
--      (filename me aaj ki date daalo)
--   4) Result 2 (rls_flags) bhi same file ke end me paste karo.
--   → Ye save hui file exactly "purani state ka SQL" hai.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) HAR POLICY ka replayable CREATE POLICY (drop karke recreate) ──────
-- Iska output directly ek restore script hai: har row ek complete
-- `drop policy if exists ...; create policy ... using (...) with check (...);`
-- Hamesha public schema ke sab policies (unhe bhi jo migration drop karegi).
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

-- ── 2) RLS flags (kaunsi table par RLS ON/FORCE hai) ─────────────────────
select
  quote_ident(n.nspname) || '.' || quote_ident(c.relname) as table_name,
  c.relrowsecurity      as rls_enabled,
  c.relforcerowsecurity as force_rsl
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;