-- ════════════════════════════════════════════════════════════════════════
-- 20260901_messenger_enhancements.sql
-- Messenger v2 upgrades:
--   1) delivered_at — 3-state ticks (✓ sent, ✓✓ delivered, blue ✓✓ seen).
--   2) media columns  — media_url / media_type / media_name (compressed images).
--   3) deleted_at     — soft-delete (Message deleted placeholder).
--   4) FIX msg_messages_update RLS bug: with_check me sender_id=recipient_id
--      contradiction tha (update kabhi pass nahi hota) — read/delivered kabhi
--      set nahi ho paata tha. Ab with_check sirf recipient hota hai.
--   5) DELETE policy for messages.
--   6) `media` storage bucket + staff policies (upload/read/delete internal).
--
-- FULLY IDEMPOTENT. Apply: Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) messages columns ────────────────────────────────────────────────
alter table public.messages
  add column if not exists delivered_at timestamptz,
  add column if not exists media_url    text,
  add column if not exists media_type   text,
  add column if not exists media_name   text,
  add column if not exists deleted_at   timestamptz;

-- ── 2) FIX update policy (read/delivered mark) ─────────────────────────
drop policy if exists msg_messages_update on public.messages;
create policy msg_messages_update on public.messages
  for update to authenticated
  using (recipient_id = auth.uid() and public.is_frontend_staff())
  with check (
    recipient_id = auth.uid()
    and public.is_frontend_staff()
  );

-- ── 3) DELETE policy (sender/recipient dono delete kar sakte hain) ─────
drop policy if exists msg_messages_delete on public.messages;
create policy msg_messages_delete on public.messages
  for delete to authenticated
  using (
    public.is_frontend_staff()
    and (sender_id = auth.uid() or recipient_id = auth.uid())
  );

-- ── 4) Storage bucket (internal staff media) ───────────────────────────
-- Public read (internal tool ke liye simplest — img src me signed URL ki jhol
-- nahi); upload/delete par RLS hi gate karta hai (sirf staff).
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

-- Upload/overwrite: staff he media daal sakta hai.
drop policy if exists media_staff_insert on storage.objects;
create policy media_staff_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and public.is_frontend_staff()
  );

-- Delete: staff (message delete par media bhi hatao).
drop policy if exists media_staff_delete on storage.objects;
create policy media_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.is_frontend_staff());

-- ── 5) Report ──────────────────────────────────────────────────────────
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'messages'
order by ordinal_position;
