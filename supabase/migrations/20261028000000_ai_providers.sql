-- ============================================================
-- AI providers — multi-provider key storage (28 Oct 2026)
--
-- Problem: `system_info` me sirf ek `ai_provider` + ek `ai_api_key` + ek
-- `ai_model` row thi. Provider switch karne par purani key overwrite ho jaati
-- thi (ya stale reh jaati thi) — Groq ki key Gemini par lagne se silent
-- "API key not valid" error aata tha.
--
-- Ab: har provider ki apni row (key app-side AES-256-GCM encrypted), aur ek
-- `is_active` row jo batati hai kaunsa provider use ho raha hai.
--
-- USER ACTION: is migration ko Supabase SQL Editor me run karein.
-- Keys app encrypt karti hai (`AI_KEY_ENC_SECRET`, warna service-role se
-- derive), isliye SQL me koi plaintext key insert nahi hoti.
-- ============================================================

create table if not exists public.ai_providers (
  provider text primary key,
  label text not null default '',
  model text not null default '',
  api_key_cipher text,
  key_hint text,
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.ai_providers is
  'AI provider settings (multi-provider). API keys app-side AES-256-GCM encrypted; browser ko kabhi plaintext nahi.';
comment on column public.ai_providers.api_key_cipher is
  'v1:<iv>:<tag>:<ciphertext> (base64url). Decrypt sirf server par.';

-- Ek waqt me sirf ek provider active ho sakta hai
create unique index if not exists ai_providers_single_active
  on public.ai_providers ((is_active))
  where is_active;

-- RLS: koi policy nahi = anon/authenticated ke liye poora block.
-- Access sirf service-role se (server routes).
alter table public.ai_providers enable row level security;
revoke all on table public.ai_providers from anon, authenticated;

-- Default provider rows
insert into public.ai_providers (provider, label, model, is_active)
values
  ('groq', 'Groq (Free)', 'openai/gpt-oss-120b', false),
  ('gemini', 'Google Gemini', 'gemini-2.5-flash', false)
on conflict (provider) do nothing;

-- Legacy state ko naye table me reflect karo (key app migrate karti hai)
do $$
declare
  legacy_provider text;
  legacy_model text;
begin
  if not exists (select 1 from public.ai_providers where is_active) then
    select meta_value into legacy_provider from public.system_info where meta_field = 'ai_provider';
    select meta_value into legacy_model from public.system_info where meta_field = 'ai_model';

    update public.ai_providers
       set is_active = true
     where provider = coalesce(legacy_provider, 'groq');

    if not exists (select 1 from public.ai_providers where is_active) then
      update public.ai_providers set is_active = true where provider = 'groq';
    end if;

    if legacy_model is not null and length(trim(legacy_model)) > 0 then
      update public.ai_providers
         set model = legacy_model
       where provider = coalesce(legacy_provider, 'groq');
    end if;
  end if;
end $$;
