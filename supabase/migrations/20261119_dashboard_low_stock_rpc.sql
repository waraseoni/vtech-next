-- ══════════════════════════════════════════════════════════════════════════════
-- DASHBOARD LOW-STOCK RPC — 3 sequential round trips → 1
-- ══════════════════════════════════════════════════════════════════════════════
-- KYUN
--   Dashboard ka "Low Stock" widget har load par teen SEQUENTIAL HTTP calls
--   karta tha (src/lib/server-dashboard.ts → fetchWidgetsBatch):
--     1) GET  product_list        (delete_flag = 0, alert_quantity > 0)
--     2) RPC  get_inventory_stock (ids ke saath)   ┐ parallel
--     3) GET  product_locations   (embedded locations) ┘
--   Measured (prod data, PostgREST, RLS on): chain median ~140 ms
--   (product_list 171 / stock RPC 71 / places 52 — sequential = 1 + max(2,3)).
--   Widgets batch dashboard ka sabse bhaari batch hai, isliye ye seedha
--   page TTFB par jaata hai.
--
--   Ab yahi kaam ek `security definer` RPC me hota hai — 1 round trip.
--   Low-stock rows + stock + place sab ek saath.
--
-- SINGLE SOURCE OF TRUTH
--   Stock formula yahan DOBARA nahi likha — ye public.get_inventory_stock()
--   ko hi call karta hai (Initiative I1: har consumer wahi ek number padhe).
--   Formula badle to sirf wahi RPC badalta hai, ye function automatically
--   follow karta hai.
--
-- FORMULA (wahi jo pehle TS me thi — behaviour identical)
--   candidate = product_list where delete_flag = 0 and alert_quantity > 0
--   available = get_inventory_stock(candidate ids).available  (missing → 0)
--   place     = product_locations → locations ka pehla row,
--               [zone, rack, bin, box].filter(Boolean).join(' ▸ '),
--               khaali → NULL ("—" TS me)
--   low       = available < alert_quantity
--   order     = deficit (available − alert) ascending, phir product id
--   (TS side count = rows.length, items = first 12 — wahi pehle jaisa.)
--
-- SAFETY
--   - Read-only (STABLE). Koi table/column/data/constraint change nahi —
--     sirf ek naya function. Live data untouched.
--   - `security definer` + `is_frontend_staff()` guard: RLS bypass karne se
--     pehle wahi staff check hota hai jo product_list/product_locations
--     policies me hai. Client-portal users ko 0 rows.
--   - Grants: anon/PUBLIC ko execute nahi; sirf authenticated + service_role
--     (Sept 2026 migrations ka pattern).
--
-- Apply: Supabase SQL Editor me run karo (ek baar, idempotent).
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function public.get_dashboard_low_stock()
returns table(
  product_id     bigint,
  name           text,
  alert_quantity integer,
  available      bigint,
  place          text,
  deficit        bigint
)
language sql
security definer
stable
set search_path = public
as $$
  with lp as (
    select p.id, p.name, p.alert_quantity
    from public.product_list p
    where p.delete_flag = 0
      and p.alert_quantity > 0
      and public.is_frontend_staff()
  ),
  st as (
    select s.product_id, s.available
    from public.get_inventory_stock(array(select l.id::bigint from lp l)) s
  ),
  loc as (
    select distinct on (pl.product_id)
           pl.product_id,
           l.zone, l.rack, l.bin, l.box
    from public.product_locations pl
    inner join public.locations l on l.id = pl.location_id
    where pl.product_id in (select l2.id from lp l2)
    order by pl.product_id
  )
  select
    lp.id::bigint                            as product_id,
    lp.name                                  as name,
    lp.alert_quantity                        as alert_quantity,
    coalesce(st.available, 0)::bigint        as available,
    case
      when loc.product_id is null then null
      else nullif(
        concat_ws(' ▸ ', loc.zone, loc.rack, loc.bin, loc.box),
        ''
      )
    end                                      as place,
    (lp.alert_quantity::bigint - coalesce(st.available, 0)) as deficit
  from lp
  left join st  on st.product_id = lp.id::bigint
  left join loc on loc.product_id = lp.id
  where coalesce(st.available, 0) < lp.alert_quantity
  order by (coalesce(st.available, 0) - lp.alert_quantity::bigint) asc, lp.id asc;
$$;

revoke all on function public.get_dashboard_low_stock() from public;
revoke all on function public.get_dashboard_low_stock() from anon;
grant execute on function public.get_dashboard_low_stock() to authenticated;
grant execute on function public.get_dashboard_low_stock() to service_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- Verify (Supabase SQL Editor):
--   select count(*) from public.get_dashboard_low_stock();
--   select * from public.get_dashboard_low_stock() limit 5;
--   -- dashboard ke Low Stock widget se match hona chahiye (count + top rows).
-- ──────────────────────────────────────────────────────────────────────────────
