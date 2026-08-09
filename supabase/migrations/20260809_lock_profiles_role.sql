-- ============================================================================
-- 20260809_lock_profiles_role.sql
-- Role escalation guard for profiles table.
--
-- Problem: /signup page (ab delete) + login auto-create + admin UI anon-key
-- writes ke through koi bhi browser user role:"admin" set kar sakta tha.
--
-- Fix: Browser JWTs (anon/authenticated) kabhi bhi profile ki role ko "staff"
-- ke alawa set nahi kar sakte. Admin role changes ab service-role se hote hain
-- (/api/admin/update-profile), jo RLS/trigger ko bypass karta hai.
-- ============================================================================

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Browser clients (anon / authenticated JWT) sirf role='staff' set kar sakte hain.
  -- Service-role (admin APIs) is check se unaffected hai.
  if auth.role() in ('anon', 'authenticated') and new.role is distinct from 'staff' then
    raise exception 'Role escalation not allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_role_escalation_trigger on public.profiles;

create trigger prevent_role_escalation_trigger
  before insert or update of role on public.profiles
  for each row execute function public.prevent_role_escalation();
