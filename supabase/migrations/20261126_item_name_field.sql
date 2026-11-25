-- ─── Item name — "kya cheez repair ho rahi hai" ──────────────────────────────
-- Purana `item` column unchanged (NOT NULL, text, legacy container + derived
-- label). Naya `item_name` NULLABLE structured field hai — bill/WhatsApp label
-- ab `Item · Brand · Model · Identifier` se banta hai (deviceIdentity.ts).
-- Koi backfill nahi: purane rows me item_name NULL rahega aur unka raw `item`
-- waisa hi dikhega.

begin;

alter table public.transaction_list add column if not exists item_name text;

comment on column public.transaction_list.item_name is
  'Structured item name (e.g. Ceiling Fan). UI label = item_name · brand · model · serial_no. Legacy rows NULL — raw `item` parity.';

-- Search/filter ke liye (item_name alag se filter karne par).
create index if not exists transaction_list_item_name_idx
  on public.transaction_list (item_name) where item_name is not null;

notify pgrst, 'reload schema';

commit;

-- ── Read-only verification (apply ke baad) ───────────────────────────────────
--   select column_name, is_nullable, data_type
--     from information_schema.columns
--    where table_schema='public' and table_name='transaction_list'
--      and column_name in ('item', 'item_name');
--   Expected: item = NO, item_name = YES.
--   select count(*) as legacy_rows, count(item_name) as with_item_name
--     from public.transaction_list;
--   Expected: with_item_name = 0 (koi backfill nahi).
--
-- ── Rollback (sirf jab column khali ho — owner approval se) ──────────────────
--   drop index if exists public.transaction_list_item_name_idx;
--   alter table public.transaction_list drop column if exists item_name;
--   notify pgrst, 'reload schema';
