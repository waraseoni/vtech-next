-- ════════════════════════════════════════════════════════════════════════
-- 20260903_fix_messages_update_rls.sql
-- FIX: markRead/markDelivered kabhi persist na hota (sidebar unread badge
--      atki rehti thi; hard-refresh pe hi clear hota tha, navigation pe wapas aa
--      jaata tha).
--
-- Root cause (behavioral test se confirm, 2026-09-03):
--   Live DB par `msg_messages_update` ab bhi BUGGY version hai:
--       with check (recipient_id = auth.uid() and is_frontend_staff()
--                   and sender_id = auth.uid())
--   Iska matlab update tabhi chalta jab user BOTH sender+recipient ho — yani
--   kabhi nahi (self-chat banned hai). Recipient apni INCOMING message ka
--   read_at/delivered_at set nahi kar paata → 403 "row violates row-level
--   security policy".
--
--   Confirm:
--     • Recipient markRead  → 403 (new row violates RLS policy)
--     • Sender content update → 204 (allowed — buggy with_check ke chalte)
--
-- Fix: update policy ko permissive recipient-scope banao (sirf recipient apne
-- incoming messages ka read/delivered mark kar sakta hai). Content editing ka
-- koi use-case nahi; `using(recipient_id = auth.uid())` hi read gate hai.
--
-- FULLY IDEMPOTENT. Apply: Supabase SQL Editor (ek baar).
-- Verify: node scripts/verify-messenger-rls.cjs  (yadi add kiya ho)
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists msg_messages_update on public.messages;
create policy msg_messages_update on public.messages
  for update to authenticated
  using (recipient_id = auth.uid() and public.is_frontend_staff())
  with check (recipient_id = auth.uid() and public.is_frontend_staff());

-- ── Report ──────────────────────────────────────────────────────────────
select tablename, policyname, cmd as command, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'messages'
order by cmd, policyname;
