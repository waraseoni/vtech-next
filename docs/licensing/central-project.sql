-- ============================================================================
-- 2026xxxx_licensing_central.sql
-- LICENSING — SELLER'S CENTRAL PROJECT (yahi SELLER ke paas rahega)
--
-- ⚠️ IMPORTANT: Ye migration SHOP KE APP DATABASE mein NAHI chalana hai.
--    Iske liye ALAG se ek chhota Supabase project banao (e.g. "vtech-licensing")
--    aur ye SQL wahan chalana. Har shop ka app isse sirf activate/check karta hai.
--
-- Kaise banana hai (seller ke liye, ek baar):
--   1. https://supabase.com par naya project banao (koi bhi region/free plan)
--   2. SQL Editor → ye file paste karo → Run
--   3. Project Settings → API keys se le lo: Project URL + anon/public key
--   4. Wo dono apne app ke .env.local me daalo:
--        LICENSE_SERVICE_URL=http://...supabase.co
--        LICENSE_SERVICE_ANON_KEY=eyJ...
--   5. Seed license add karo (neeche seed section) — naye customer ko key do
--
-- SECURITY:
--   - licenses / activations tables par RLS + anon/authenticated se revoke
--   - Browser app direct tables kabhi nahi chhoota, sirf RPC functions:
--       activate_license(text, text, text, text) → json
--   - Ye functions `security definer` hain isliye RLS bypass karte hain
--     lekin sirf apne (licensing) tables hi chhoote hain.
-- ============================================================================

create table if not exists public.licenses (
  id              bigint generated always as identity primary key,
  license_key     text not null unique,               -- e.g. VTC-XXXX-XXXX-XXXX-XXXX
  shop_name       text,
  owner_name      text,
  owner_email     text,
  plan            text not null default 'standard',   -- standard | premium | lifetime
  max_activations integer not null default 1,         -- ek key kitne instances par chalega
  expires_at      timestamptz,                        -- NULL = lifetime
  status          text not null default 'active',     -- active | disabled | revoked
  notes           text,
  created_at      timestamptz not null default now()
);

create table if not exists public.activations (
  id            bigint generated always as identity primary key,
  license_id    bigint not null references public.licenses(id) on delete cascade,
  activation_id text not null,                        -- app instance ka unique id (host ka sha256)
  shop_url      text,
  shop_name     text,
  activated_at  timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  unique (license_id, activation_id)
);

create index if not exists activations_license_idx on public.activations (license_id);
create index if not exists activations_activation_idx on public.activations (activation_id);

-- ─── RLS: browser direct access BAND ────────────────────────────────────────
alter table public.licenses   enable row level security;
alter table public.activations enable row level security;

revoke all on table public.licenses   from anon, authenticated;
revoke all on table public.activations from anon, authenticated;

-- ─── RPC: activate_license ──────────────────────────────────────────────────
-- App (shop) ise call karta hai jab seller ka key daala jaye.
-- Params:
--   p_key          = license key (VTC-XXXX-...)
--   p_activation_id = shop ke app instance ka unique id (host sha256)
--   p_shop_url     = shop ka domain/LAN address
--   p_shop_name    = shop ka naam (system_info se)
create or replace function public.activate_license(
  p_key text, p_activation_id text, p_shop_url text, p_shop_name text
) returns json
language plpgsql security definer set search_path = public as $$
declare
  rec        licenses%rowtype;
  act_count  int;
  existing   activations%rowtype;
begin
  select * into rec from public.licenses where license_key = trim(p_key);
  if not found then
    return json_build_object('ok', false, 'error', 'INVALID_KEY');
  end if;

  if rec.status <> 'active' then
    return json_build_object('ok', false, 'error', 'LICENSE_DISABLED');
  end if;

  if rec.expires_at is not null and rec.expires_at < now() then
    return json_build_object('ok', false, 'error', 'LICENSE_EXPIRED');
  end if;

  -- Pehle se activate hai is instance par? → refresh last_seen, return ok
  select * into existing
    from public.activations
   where license_id = rec.id and activation_id = p_activation_id;
  if found then
    update public.activations
       set last_seen_at = now(),
           shop_name    = coalesce(nullif(p_shop_name, ''), shop_name),
           shop_url     = coalesce(nullif(p_shop_url, ''), shop_url)
     where id = existing.id;
    return json_build_object(
      'ok', true, 'plan', rec.plan, 'shop_name', rec.shop_name,
      'expires_at', rec.expires_at, 'already_activated', true);
  end if;

  -- Naya instance → max_activations check
  select count(*) into act_count from public.activations where license_id = rec.id;
  if act_count >= rec.max_activations then
    return json_build_object('ok', false, 'error', 'MAX_ACTIVATIONS');
  end if;

  insert into public.activations (license_id, activation_id, shop_url, shop_name)
  values (rec.id, p_activation_id, p_shop_url, p_shop_name);

  return json_build_object(
    'ok', true, 'plan', rec.plan, 'shop_name', rec.shop_name,
    'expires_at', rec.expires_at, 'already_activated', false);
end $$;

-- ─── RPC: deactivate_license (seller manually revoke kar sake) ──────────────
create or replace function public.deactivate_license(p_activation_id text)
returns json
language plpgsql security definer set search_path = public as $$
begin
  delete from public.activations where activation_id = p_activation_id;
  return json_build_object('ok', true);
end $$;

-- ─── RPC: check_license ─────────────────────────────────────────────────────
-- App HAR DIN (ya jab bhi /api/license/status call ho) ise call karta hai taaki
-- expiry enforcement asli ho — activation ke baad bhi license valid hai ya nahi.
-- Ye koi naya activation register NAHI karta, sirf verify karta hai + last_seen
-- refresh karta hai (seller ko "kitne din pehle active tha" dikhne ke liye).
-- Params:
--   p_activation_id = shop ke app instance ka unique id (host sha256)
-- Returns json:
--   ok=true  → 'active', expires_at (null = lifetime)
--   ok=false → error (NOT_ACTIVATED | LICENSE_NOT_FOUND | LICENSE_DISABLED | LICENSE_EXPIRED)
create or replace function public.check_license(p_activation_id text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  a activations%rowtype;
  l licenses%rowtype;
begin
  select * into a from public.activations
   where activation_id = p_activation_id
   order by id limit 1;
  if not found then
    return json_build_object('ok', false, 'error', 'NOT_ACTIVATED');
  end if;

  select * into l from public.licenses where id = a.license_id;
  if not found then
    return json_build_object('ok', false, 'error', 'LICENSE_NOT_FOUND');
  end if;

  if l.status <> 'active' then
    return json_build_object('ok', false, 'error', 'LICENSE_DISABLED');
  end if;

  if l.expires_at is not null and l.expires_at < now() then
    return json_build_object(
      'ok', false, 'error', 'LICENSE_EXPIRED',
      'expires_at', l.expires_at, 'plan', l.plan, 'shop_name', l.shop_name);
  end if;

  update public.activations set last_seen_at = now() where id = a.id;

  return json_build_object(
    'ok', true, 'plan', l.plan, 'shop_name', l.shop_name, 'expires_at', l.expires_at);
end $$;

-- ─── Grant: sirf RPC functions callable, tables nahi ───────────────────────
grant execute on function public.activate_license(text, text, text, text) to anon;
grant execute on function public.deactivate_license(text) to anon;
grant execute on function public.check_license(text) to anon;

-- ⚠️ Ye grant tabhi hai jab app se (browser/server) RPC call karni ho.
--    Chaho to authenticated tak hi seemit karo: anon → authenticated.

-- ─── Client credentials — seller ke liye per-client infra details ───────────
-- Har client ke Supabase / GitHub / Vercel ke access details yahan save hote hain
-- (Seller Portal ke "Client Details" page se). Sensitive values app-side AES-256
-- encrypt kar ke save hoti hain, isliye DB leak hone par bhi raw nahi dikhte.
-- RLS: browser direct access band; seller portal service-role se padhta hai.
create table if not exists public.client_credentials (
  license_id                     bigint primary key references public.licenses(id) on delete cascade,
  app_url                        text,
  -- Supabase (client ka apna data project)
  supabase_url                   text,
  supabase_anon_key              text,
  supabase_service_role_key      text,
  supabase_email                 text,
  supabase_password              text,
  -- GitHub
  github_repo                    text,
  github_token                   text,
  github_username                text,
  github_password                text,
  -- Vercel
  vercel_project_url             text,
  vercel_project_id              text,
  vercel_token                   text,
  vercel_email                   text,
  vercel_password                text,
  custom_domain                  text,
  notes                          text,
  updated_at                     timestamptz not null default now()
);

-- Purani table (jo pehle create ho chuki ho) mein naye columns add karo —
-- email/username plain, password app-side encrypted.
alter table public.client_credentials add column if not exists supabase_email   text;
alter table public.client_credentials add column if not exists supabase_password text;
alter table public.client_credentials add column if not exists github_username  text;
alter table public.client_credentials add column if not exists github_password  text;
alter table public.client_credentials add column if not exists vercel_email     text;
alter table public.client_credentials add column if not exists vercel_password  text;
alter table public.client_credentials add column if not exists custom_domain    text;

alter table public.client_credentials enable row level security;
revoke all on table public.client_credentials from anon, authenticated;

-- ─── SEED: seller ke apne shop ka license (optional) ─────────────────────────
-- ⚠️ Real license key repo mein mat daalo (public hai). Naya seller setup karte
-- waqt apni key yahan generate karke uncomment + replace karo:
-- insert into public.licenses (license_key, shop_name, owner_name, plan, max_activations, status)
-- values ('VTC-XXXX-XXXX-XXXX-XXXX', 'V-Technologies (Seller)', 'Owner', 'lifetime', 2, 'active')
-- on conflict (license_key) do nothing;
