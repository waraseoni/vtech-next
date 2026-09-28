-- ─── Direct Sale: FK + atomic save RPC ──────────────────────────────────────
-- Apply: Supabase SQL Editor (repo me db:push script nahi hai).
--
-- ── Problem 1: `direct_sale_items` par koi FOREIGN KEY nahi tha ─────────────
-- Sirf columns (`sale_id`, `product_id`) the, koi constraint nahi. Iske do
-- nuksan:
--   a) PostgREST embedded resource (`items:direct_sale_items(...)`) resolve hi
--      nahi kar pata → PGRST200 → poori query error → SaleForm me user ko
--      bekaar "Sale not found" dikha (sale exist karti thi).
--   b) Orphan rows ban sakte the (item jiska sale hi nahi).
-- Ye table PHP-era hai jahan joins manually hote the, isliye FK reh gaya.
--
-- ── Problem 2 (zyada serious): non-atomic write ────────────────────────────
-- Edit save: `update direct_sales` → `delete direct_sale_items` → `insert
-- direct_sale_items` — TEENO alag round-trip, koi transaction nahi. Delete
-- pass + insert fail = sale ki saari line items permanently gayab, koi error
-- nahi, koi rollback nahi. (Code me "BUG FIX 10" isko "sequence" se fix karne
-- ki koshish kar raha tha par woh sirf order badalta hai, safety nahi deta.)
--
-- ── Fix ─────────────────────────────────────────────────────────────────────
--   1. FK `direct_sale_items.sale_id → direct_sales.id` ON DELETE CASCADE
--      (house pattern: `purchase_order_items_po_fk` bhi cascade hai).
--   2. FK column par INDEX — Postgres FK par auto-index nahi banata, aur
--      `sale_id` par 10+ jagah filter lagta hai (har page/report seq scan
--      karta tha).
--   3. `save_direct_sale()` RPC — poori save (insert/update + items
--      delete+insert) EK transaction me. Adhoori save ab possible nahi.
--      Total bhi server par compute hota hai (client ka total trust nahi).
--
-- SECURITY: `security invoker` (Postgres default) — RLS apni jagah lagta hai.
-- House style me zyadatar RPC `security definer` hain (wo cross-table joins
-- ke liye chahiye), par yahan dono tables ki policy `is_frontend_staff()`
-- (admin+staff+developer) hai, to invoker se koi functional loss nahi aur RLS
-- bypass bhi nahi hota. Ye jaan-boojh kar safer choice hai.

-- ── Step 0: preflight — orphan rows par FK add fail ho jayega ───────────────
-- Isliye pehle count karke, rows hain to saaf message ke saath FAIL kar dete
-- hain ( chupchaap skip karne se bekaar half-applied schema nahi banna chahiye).
do $$
declare
  v_orphans bigint;
begin
  select count(*) into v_orphans
  from public.direct_sale_items di
  left join public.direct_sales ds on ds.id = di.sale_id
  where di.sale_id is not null and ds.id is null;

  if v_orphans > 0 then
    raise exception 'FK nahi ban sakta: % orphan direct_sale_items row(s) hain (sale_id ka sale exist nahi karta). Pehle inhe clean karo, phir migration dobara chalao.', v_orphans
      using hint = 'select di.id, di.sale_id from public.direct_sale_items di left join public.direct_sales ds on ds.id = di.sale_id where di.sale_id is not null and ds.id is null;';
  end if;
end $$;

-- ── Step 1: FK (idempotent) ────────────────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'direct_sale_items_sale_fk'
      and conrelid = 'public.direct_sale_items'::regclass
  ) then
    alter table only public.direct_sale_items
      add constraint direct_sale_items_sale_fk
      foreign key (sale_id) references public.direct_sales(id) on delete cascade;
  end if;
end $$;

-- ── Step 2: FK column ka index (idempotent) ────────────────────────────────
create index if not exists direct_sale_items_sale_id_idx
  on public.direct_sale_items (sale_id);

-- product_id par bhi index — stock calcs (ledger, balancesheet, inventory)
-- hamesha `group by product_id` karte hain.
create index if not exists direct_sale_items_product_id_idx
  on public.direct_sale_items (product_id);

-- ── Step 3: atomic save RPC ────────────────────────────────────────────────
-- p_sale_id NULL  → naya sale (INSERT)
-- p_sale_id NOT NULL → edit (UPDATE + items replace)
--
-- Item shape (jsonb array): [{ "product_id": 12|null, "qty": 2, "price": 99.5 }]
-- `product_id` NULL allowed hai — `clients/[id]/add-direct-sale` free-text
-- items banata hai (product linked nahi hota).
create or replace function public.save_direct_sale(
    p_sale_id            integer default null,
    p_sale_code          text    default null,
    p_client_id          integer default null,
    p_mechanic_id        integer default null,
    p_payment_mode       text    default null,
    p_remarks            text    default null,
    p_last_edited_by     integer default null,
    p_last_edited_by_name text   default null,
    p_items              jsonb   default null
) returns integer
language plpgsql
security invoker
set search_path to public
as $$
declare
  v_id    integer;
  v_item  jsonb;
  v_total numeric(15,2) := 0;
  -- Columns `timestamp WITHOUT time zone` hain aur readers (view page + printed
  -- invoice) `fmtIST()` use karte hain, jo `new Date(iso)` + Asia/Kolkata se
  -- aise value ko round-trip karta hai — yaani stored value ko IST WALL-CLOCK
  -- maana jata hai, koi shift nahi hoti.
  -- Isliye `now()` (jo timestamptz hai) ko plain IST wall-clock me cast karna
  -- zaroori hai. `now() at time zone 'utc'` galat hota — SaleForm pehle
  -- `toISOString()` (UTC) bhejta tha jisse us page ki sales 5:30 PEECHE dikhti
  -- thin; ye is bug ko bhi theek karta hai aur add-direct-sale ke `nowIST()`
  -- convention se match karta hai.
  v_now   timestamp := (now() at time zone 'Asia/Kolkata');
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Sale me kam se kam ek item chahiye.'
      using errcode = '22023';
  end if;

  if p_sale_id is null then
    if p_sale_code is null or btrim(p_sale_code) = '' then
      raise exception 'Naye sale ke liye sale_code zaroori hai.'
        using errcode = '22023';
    end if;

    insert into public.direct_sales (
      sale_code, client_id, mechanic_id, total_amount, payment_mode,
      remarks, last_edited_by, last_edited_by_name, last_edited_date,
      date_created
    ) values (
      btrim(p_sale_code), p_client_id, p_mechanic_id, 0, coalesce(p_payment_mode, 'Cash'),
      nullif(btrim(coalesce(p_remarks, '')), ''), p_last_edited_by,
      p_last_edited_by_name, v_now, v_now
    )
    returning id into v_id;
  else
    update public.direct_sales set
      client_id           = p_client_id,
      mechanic_id         = p_mechanic_id,
      payment_mode        = coalesce(p_payment_mode, 'Cash'),
      remarks             = nullif(btrim(coalesce(p_remarks, '')), ''),
      last_edited_by      = p_last_edited_by,
      last_edited_by_name = p_last_edited_by_name,
      last_edited_date    = v_now
      -- sale_code / date_created deliberately NAHI bhejte — DB values intact
    where id = p_sale_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Sale #% nahi mila — edit nahi ho sakta.', p_sale_id
        using errcode = 'P0002';
    end if;

    -- Purani lines hatao. Ye + neeche ka insert ek hi transaction me hai, to
    -- insert fail hua to purani lines bhi wapas aa jaati hain (pehle data loss
    -- hota tha).
    delete from public.direct_sale_items where sale_id = p_sale_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.direct_sale_items (sale_id, product_id, qty, price)
    values (
      v_id,
      nullif(btrim(coalesce(v_item->>'product_id', '')), '')::integer,
      (v_item->>'qty')::integer,
      coalesce((v_item->>'price')::numeric, 0)
    );
  end loop;

  -- Total server par compute — client ka bheja hua total trust nahi karna.
  select coalesce(sum(i.qty * i.price), 0) into v_total
  from public.direct_sale_items i
  where i.sale_id = v_id;

  update public.direct_sales set total_amount = v_total where id = v_id;

  return v_id;
end;
$$;

-- ── Step 4: RPC execute grant (house pattern) ──────────────────────────────
grant execute on function public.save_direct_sale(
  integer, text, integer, integer, text, text, integer, text, jsonb
) to authenticated;

-- ── Reload PostgREST schema cache ───────────────────────────────────────────
-- FK add hone ke baad PostgREST ko naya relationship load karna zaroori hai,
-- warna embed phir bhi fail rahega. Ye har migration ki convention hai.
NOTIFY pgrst, 'reload schema';
