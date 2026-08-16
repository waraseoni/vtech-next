-- ============================================================================
-- 20260816_allow_developer_role.sql
-- profiles.role me 'developer' allow karne ke liye CHECK constraint update.
--
-- Problem: /users/[id]/edit par kisi admin ko 'Developer' role set karne par
-- "violates check constraint profiles_role_check" error aata tha. App aur APIs
-- ab 'developer' role support karte hain (api-auth me admin-equivalent) lekin
-- profiles_role_check abhi sirf ('admin','staff','client') allow karta hai.
--
-- Note: CHECK constraint RLS/trigger ko bypass karne wale service-role se bhi
-- enforce hota hai — isliye sirf migration hi fix karega.
-- ============================================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'staff', 'client', 'developer'));
