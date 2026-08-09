-- ============================================================================
-- 20260809_drop_auth_profile_trigger.sql
--
-- Root cause: Supabase ka standard auto-profile trigger (function
-- handle_new_user / trigger on_auth_user_created) kisi bhi naye auth user ke
-- liye profiles me turant role='staff' ki row bana deta hai — isme email OTP
-- signup (signInWithOtp, shouldCreateUser) bhi aata hai. Isse client login par
-- /api/client/onboard ko pehle se role='staff' wali profile milti hai aur wo
-- client banne se pehle hi "/" (staff UI) par redirect ho jata hai — client ka
-- portal kabhi nahi khulta aur har baar "staff create" hota dikhta hai.
--
-- Fix: trigger drop karo. Profiles ab sirf EXPLICIT inserts se banti hain:
--   - staff/admin → /api/admin/create-user (explicit insert, role admin/staff)
--   - client      → /api/client/onboard (upsert, role='client', client_id)
--
-- Idempotent hai — trigger naam na mile to kuch nahi hota.
-- ============================================================================

do $$
declare
  t record;
begin
  for t in
    select tgname
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname in ('on_auth_user_created', 'handle_new_user_trigger', 'auth_user_created')
  loop
    execute format('drop trigger if exists %I on auth.users', t.tgname);
    raise notice 'dropped trigger %', t.tgname;
  end loop;
end
$$;
