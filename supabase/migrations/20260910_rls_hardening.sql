-- ════════════════════════════════════════════════════════════════════════
-- 20260910_rls_hardening.sql
-- RLS hardening — bina login (anon) ke khuli tables band karna
-- Security debt: frontend bundle me PUBLIC anon key hota hai, isliye koi bhi
-- anon key se REST API call karke ye tables padh/likhe sakta tha.
--   • system_info         → READ leak: ai_api_key (Groq), csrf_token,
--                           upi_id, signature publicly visible (write pehle se band)
--   • activity_logs       → anon READ + WRITE open
--   • payment_reminders   → anon READ + WRITE open (client due amounts = financial data)
--   • suppliers           → anon READ + WRITE open (Allow-all policy)
--   • spare_supplier      → anon READ + WRITE open (Allow-all policy)
--   • wp_template_history → anon READ + WRITE open (Allow-all policy)
--   • message_list        → public contact form: anon INSERT chahiye (site pe
--                           message form), par SELECT/UPDATE/DELETE sirf staff ko
-- App breaking nahi hoga: staff/admin policies fix_rls.sql jaisa hi pattern
-- use karti hain jo baaki tables par pehle se kaam kar raha hai.
-- Apply: Supabase SQL Editor me run karo (ek baar, idempotent).
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) Purani policies drop (Allow-all / koi bhi purani broad policy) ──
do $$
declare p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'system_info', 'activity_logs', 'payment_reminders',
        'suppliers', 'spare_supplier', 'wp_template_history', 'message_list'
      )
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ── 2) RLS ON (idempotent) ──────────────────────────────────────────────
alter table public.system_info          enable row level security;
alter table public.activity_logs        enable row level security;
alter table public.payment_reminders    enable row level security;
alter table public.suppliers            enable row level security;
alter table public.spare_supplier       enable row level security;
alter table public.wp_template_history  enable row level security;
alter table public.message_list         enable row level security;

-- ── 3) system_info ───────────────────────────────────────────────────────
-- anon (public website) SIRF public fields; sensitive fields (ai_api_key,
-- csrf_token, upi_id, signature) anon ko bilkul nahi.
create policy hardening_sysinfo_anon_read on public.system_info
  for select to anon
  using (meta_field in (
    'name', 'short_name', 'logo', 'cover', 'email', 'contact',
    'address', 'owner', 'biz_days', 'biz_open', 'biz_close',
    'gst_no', 'gstin', 'map_url', 'map_iframe',
    'whatsapp', 'facebook', 'instagram', 'youtube', 'footer_text', 'announcement'
  ));

-- authenticated (koi bhi logged-in, incl. client): non-sensitive fields hi
create policy hardening_sysinfo_auth_read on public.system_info
  for select to authenticated
  using (meta_field not in ('ai_api_key', 'csrf_token'));

-- staff/admin: full CRUD (settings page + signature save browser client se)
create policy hardening_sysinfo_staff on public.system_info
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

-- ── 4) activity_logs — sirf staff/admin ─────────────────────────────────
create policy hardening_activity_staff on public.activity_logs
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

-- ── 5) payment_reminders — sirf staff/admin ─────────────────────────────
create policy hardening_reminders_staff on public.payment_reminders
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

-- ── 6) suppliers — sirf staff/admin ─────────────────────────────────────
create policy hardening_suppliers_staff on public.suppliers
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

-- ── 7) spare_supplier — sirf staff/admin ────────────────────────────────
create policy hardening_spare_staff on public.spare_supplier
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

-- ── 8) wp_template_history — sirf staff/admin ───────────────────────────
create policy hardening_wptpl_staff on public.wp_template_history
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

-- ── 9) message_list — public contact form ───────────────────────────────
-- anon: sirf INSERT (kabhi bhi padh/update/delete nahi kar sakta)
create policy hardening_msgs_anon_insert on public.message_list
  for insert to anon
  with check (true);

-- staff/admin: sab kuch (inquiries page read/update/delete)
create policy hardening_msgs_staff on public.message_list
  for all to authenticated
  using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
  with check (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'));

-- ── 10) Report: applied policies ────────────────────────────────────────
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'system_info', 'activity_logs', 'payment_reminders',
    'suppliers', 'spare_supplier', 'wp_template_history', 'message_list'
  )
order by tablename, cmd;
