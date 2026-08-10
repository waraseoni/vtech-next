-- ============================================================================
-- 20260810_login_throttle.sql
-- Login Throttle (Brute-Force Protection) — plan: login_throttle_plan.md
--
-- Kya karta hai:
--  1. login_throttle table — email + IP par failed login track/lock
--  2. Indexes: email (uniq lower), IP, updated_at
--  3. RLS: browser client ke liye CLOSED (koi policy nahi = deny) —
--     sirf service-role (server-side API) is table ko use karega
--
-- NOTE:
--  - Login page /api/auth/login route se hota hai (service-role) —
--    browser client is table ko kabhi directly nahi chhoota.
--  - Idempotent: dobara run karne par error nahi aayega.
-- ============================================================================

create table if not exists public.login_throttle (
  id               bigint generated always as identity primary key,
  email            text not null,                          -- lowercased, trimmed
  ip_address       text not null,                          -- normalized client IP
  attempt_count    integer not null default 0,
  lock_repeats     integer not null default 0,             -- escalation: kitni baar lock ho chuka
  first_attempt_at timestamptz,
  lockout_until    timestamptz,
  last_attempt_at  timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Lock check: email se (fast, indexed)
create unique index if not exists login_throttle_email_uniq
  on public.login_throttle (lower(email));

-- IP-based flood detection
create index if not exists login_throttle_ip_idx
  on public.login_throttle (ip_address);

-- Cleanup (purana data auto-delete)
create index if not exists login_throttle_updated_idx
  on public.login_throttle (updated_at);

-- RLS: browser client ke liye CLOSED (sirf service-role server-side use karega)
alter table public.login_throttle enable row level security;
-- koi policy nahi = anon/authenticated ke liye zero access (deny by default)
