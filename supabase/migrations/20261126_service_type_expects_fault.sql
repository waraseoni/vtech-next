-- ─── Service Type — fault required ya optional ────────────────────────────────
-- Problem: "New Installation" / "PDI / Delivery" jobs me "Fault Reported"
-- label galat hai aur field mandatory hai — user fake text likhne par majboor.
--
-- Fix (service_type_implementation_plan v2, D1/D2):
--   * `expects_fault NULL` = fault required (purana behaviour + naye admin types
--     ka safe default). Sirf explicit `false` faultless mark karta hai.
--   * `transaction_list.fault text NOT NULL` par **koi change nahi**. Faultless
--     jobs `fault = ""` likhte hain — isse report/print/restore ka poora blast
--     radius khatam hota hai. Kisi bhi phase me DROP NOT NULL mat lagao.
--   * Koi job row ka backfill nahi; purane service_type_id NULL waisa hi rehta hai.

begin;

alter table public.service_types add column if not exists expects_fault boolean;

comment on column public.service_types.expects_fault is
  'NULL or true = fault required (default). false = Work Description optional — UI label/requiredness badalta hai, DB fault column NOT NULL hi rehta hai.';

-- Sirf 2 seed types faultless. WHERE expects_fault IS NULL se admin ka apna
-- choice overwrite nahi hota (idempotent).
update public.service_types
   set expects_fault = false
 where expects_fault is null
   and name in ('New Installation', 'PDI / Delivery');

notify pgrst, 'reload schema';

commit;

-- ── Read-only verification (apply ke baad) ───────────────────────────────────
--   select id, name, expects_fault from public.service_types order by sort_order;
--   -- Repair=true(NULL bhi chalega), New Installation=false, PDI=false
--   select column_name, is_nullable, data_type
--     from information_schema.columns
--    where table_schema='public' and table_name='transaction_list'
--      and column_name='fault';
--   -- is_nullable = NO hona chahiye (unchanged).
