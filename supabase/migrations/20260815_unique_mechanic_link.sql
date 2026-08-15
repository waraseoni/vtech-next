-- ============================================================================
-- 20260815_unique_mechanic_link.sql
-- Ek mechanic sirf ek user (profile) se link ho sakta hai (1:1).
--
-- Problem: profiles.mechanic_id bina restriction ke multiple profiles par ek hi
-- mechanic ko point kar sakta tha — do users ek hi mechanic ke roop mein
-- attendance check-in kar sakte the (double entries, ambiguous attendance).
--
-- Fix: Partial unique index — mechanic_id null (bina login wala mechanic)
-- allowed hai, par ek non-null mechanic_id sirf ek hi profile par ho sakta hai.
--
-- Apply: Supabase SQL Editor me run karo (ek baar, idempotent).
-- ============================================================================

-- ── 1) Agar already koi duplicate link ho to har mechanic ke liye sirf ek
--       profile ka link rakho (deterministic: min uuid), baaki ke links null
--       karo taaki unique index ban sake.
with keep as (
  select distinct on (mechanic_id) id, mechanic_id
  from public.profiles
  where mechanic_id is not null
  order by mechanic_id, id
)
update public.profiles p
set mechanic_id = null
where p.mechanic_id is not null
  and not exists (
    select 1 from keep k
    where k.mechanic_id = p.mechanic_id and k.id = p.id
  );

-- ── 2) 1:1 enforcement — unique partial index (null allowed, duplicates nahi)
create unique index if not exists profiles_mechanic_id_unique
  on public.profiles (mechanic_id)
  where mechanic_id is not null;
