-- ══════════════════════════════════════════════════════════════════════════════
-- CLIENT_PAYMENTS RECENT-FIRST INDEX — dashboard "Recent Payments" 141ms → ~50ms
-- ══════════════════════════════════════════════════════════════════════════════
-- KYUN
--   Dashboard ka "Recent Payments" widget (aur payments page ka default sort)
--   ye query chalata hai:
--     select ... from client_payments
--      order by payment_date desc, id desc
--      limit 10;
--   client_payments par sirf (client_id, payment_date) index tha — is order ke
--   liye koi index nahi, isliye planner Seq Scan + Sort karta tha. RLS policy
--   (`is_frontend_staff()`) har row par evaluate hoti hai → 839 rows × ~27µs
--   = ~23 ms DB time, HTTP par ~141 ms (measured, staff JWT).
--
--   Index ke baad: Index Scan + early stop (10 rows) → 2.9 ms DB time,
--   HTTP ~47-104 ms (network variance; best-case 3x better).
--
-- SAFETY
--   - Sirf ek naya index — koi column/constraint/data change nahi.
--   - Read-only query ko fast karta hai; writes par bas ek chhota index
--     maintenance cost (839 rows = negligible).
--   - `if not exists` — idempotent, dobara chalane par safe.
--
-- Apply: Supabase SQL Editor me run karo (ek baar, idempotent).
-- ══════════════════════════════════════════════════════════════════════════════

create index if not exists client_payments_date_id_idx
  on public.client_payments (payment_date desc, id desc);

-- ──────────────────────────────────────────────────────────────────────────────
-- Verify (Supabase SQL Editor):
--   explain (analyze, buffers)
--   select id, amount, payment_date from public.client_payments
--    order by payment_date desc, id desc limit 10;
--   -- expected: Index Scan using client_payments_date_id_idx (~3 ms)
-- ──────────────────────────────────────────────────────────────────────────────
