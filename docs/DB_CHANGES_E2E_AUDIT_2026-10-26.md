# DB Changes Audit — E2E test runs (26 Oct 2026)

> **Status:** Audit only. Is file me listed cleanup **agent ne nahi chalaya** — sab
> kuch aap khud review karke chalayein.
>
> **Kyun bana:** `.env.local` **live Supabase project** par point karta hai aur usme
> `E2E_ALLOW_WRITES=1` set tha. Isliye Playwright ki write-specs (`job-create`,
> `direct-sale`) ne live DB me real rows bana diye. Ye audit un sab changes ki
> poori list hai — koi guess nahi, sab rows DB se read-only SELECT se verify kiye
> gaye hain.

---

## 1. Summary (kitna data)

**Sab changes ek hi window me:** 26 Oct 2026, **02:36 – 03:13 IST** (UTC 25 Oct 21:06–21:43).

| Table | Rows | ID range | Kya hai |
|---|---:|---|---|
| `direct_sales` | **12** | `75–86` | E2E direct sales (walk-in, Cash) |
| `direct_sale_items` | **12** | `93–104` | har sale ka 1 line item (qty 1) |
| `transaction_list` | **5** | `2411–2415` | E2E jobs (job_id `29515–29519`) |
| `activity_logs` | **17** | `24712–24728` | 12 sale logs + 5 job logs |
| **Total** | **46 rows** | — | — |

Koi stored **stock/finance column update nahi hua** — stock `direct_sale_items` se
derive hota hai (neeche point 4).

---

## 2. Direct sales (12)

`direct_sales` — client_id `null` (walk-in), `mechanic_id = 2`, `payment_mode = Cash`,
`remarks = null`.

| id | sale_code | product_id (item) | qty | price | total |
|---:|---|---|---:|---:|---:|
| 75 | SALE202607304057 | 1 | 1 | ₹20 | ₹20 |
| 76 | SALE202607304058 | 1 | 1 | ₹20 | ₹20 |
| 77 | SALE202607304059 | 1 | 1 | ₹20 | ₹20 |
| 78 | SALE202607304060 | 1 | 1 | ₹20 | ₹20 |
| 79 | SALE202607304061 | 1 | 1 | ₹20 | ₹20 |
| 80 | SALE202607304062 | 1 | 1 | ₹20 | ₹20 |
| 81 | SALE202607304063 | 4 | 1 | ₹5,500 | ₹5,500 |
| 82 | SALE202607304064 | 4 | 1 | ₹5,500 | ₹5,500 |
| 83 | SALE202607304065 | 4 | 1 | ₹5,500 | ₹5,500 |
| 84 | SALE202607304066 | 4 | 1 | ₹5,500 | ₹5,500 |
| 85 | SALE202607304067 | 7 | 1 | ₹2,300 | ₹2,300 |
| 86 | SALE202607304068 | 7 | 1 | ₹2,300 | ₹2,300 |

**Total value:** ₹26,720 (₹120 + ₹22,000 + ₹4,600)

`direct_sale_items` id `93–104` inhi 12 sales ke items hain (1:1).
Note: pehli 6 sales out-of-stock product par thi (oversell path), isliye product 1
ki availability negative tak gayi.

**Boundary proof:** sale `74` = `2026-10-25T09:57Z` (aapka real data), `75` = pehla
E2E sale. Sale `86` ke baad koi row nahi (max id = 86).

---

## 3. Jobs (5)

`transaction_list` — Quick Save se bane (billing skip), isliye `amount = 0`:

| id | job_id | code | fault | item | client_name | mechanic_id | status |
|---:|---:|---|---|---|---|---:|---:|
| 2411 | 29515 | 2026102601 | E2E smoke - display issue | E2E Test Device | 300 | 2 | 5 |
| 2412 | 29516 | 2026102602 | E2E smoke - display issue | E2E Test Device | 300 | 2 | 5 |
| 2413 | 29517 | 2026102603 | E2E smoke - display issue | E2E Test Device | 300 | 2 | 5 |
| 2414 | 29518 | 2026102604 | E2E smoke - display issue | E2E Test Device | 300 | 2 | 5 |
| 2415 | 29519 | 2026102605 | E2E smoke - display issue | E2E Test Device | 300 | 2 | 5 |

- `transaction_services` aur `transaction_products`: **0 rows** (spec ne koi
  service/product add nahi kiya) — isliye in tables me cleanup ki zaroorat nahi.
- Financial impact: **₹0** (amount 0, koi due/commission nahi).

---

## 4. Derived effect (stored nahi hai)

Inventory/stock query `direct_sale_items` ko sum karke available stock nikalta hai —
`product_list` me koi stock column hi nahi hai. Isliye:

| product_id | Naam | E2E ne ghataaya |
|---:|---|---:|
| 1 | Par Led Bead GRB 3W | 6 |
| 4 | Lamp 380w Osram stan | 4 |
| 7 | lamp 230 w | 2 |

Sales delete karte hi availability apne aap restore ho jayegi — **product row edit
karne ki zaroorat nahi**.

---

## 5. Jo bilkul nahi chhua (verified)

| Table | Status |
|---|---|
| `client_list` | koi "E2E" client nahi bana (0 rows) |
| `product_list` | koi update nahi |
| `attendance_list` | 26 Oct ki rows `1294` (mechanic 2, 11:59:57) + `1295` (mechanic 1, 13:21:33) — dono real staff ki, meri nahi |
| `transaction_services` / `transaction_products` | 0 rows |
| `profiles` / `user_passkeys` | koi change nahi (password login use hua, passkey nahi) |
| `job_id_counter` | counter 29514 → 29519 meri 5 jobs se badha, **par abhi `29528` hai jo real jobs 29520–29528 se legitimate hai — ise reset mat karein** |

---

## 6. Verification queries (read-only, pehle chalayein)

```sql
select id, sale_code, client_id, mechanic_id, total_amount, payment_mode, date_created
from public.direct_sales
where id between 75 and 86
order by id;

select id, sale_id, product_id, qty, price
from public.direct_sale_items
where sale_id between 75 and 86
order by id;

select id, job_id, code, client_name, mechanic_id, item, fault, amount, status, date_created
from public.transaction_list
where id between 2411 and 2415
order by id;

select id, action, module, meta_id, details, date_created
from public.activity_logs
where id between 24712 and 24728
order by id;
```

---

## 7. Cleanup SQL (aap chalayein — agent ne nahi chalaya)

> `job_id_counter` ko **reset na karein** (29528 current real value hai). Delete ke
> baad job_id 29515–29519 gap rahenge — ye safe hai, unhe reuse karne ki koshish
> mat karein. Agla sale id 87 hoga (`SALE...069`) — koi collision nahi.

```sql
begin;

delete from public.direct_sale_items where sale_id between 75 and 86;
delete from public.direct_sales      where id between 75 and 86;

delete from public.transaction_list
where id between 2411 and 2415
  and fault ilike '%E2E%';

delete from public.activity_logs
where id between 24712 and 24728;

commit;
```

Cleanup ke baad dobara verify:

```sql
select count(*) from public.direct_sales      where id between 75 and 86;     -- 0
select count(*) from public.direct_sale_items where sale_id between 75 and 86; -- 0
select count(*) from public.transaction_list  where id between 2411 and 2415;  -- 0
select count(*) from public.activity_logs     where id between 24712 and 24728; -- 0
```

Optional: cleanup ke baad Supabase SQL editor me `notify pgrst, 'reload schema';`
chala dein (PostgREST cache refresh).

---

## 8. Dobara na ho — prevention

1. `.env.local` se `E2E_ALLOW_WRITES=1` **hata dein** (ya `0`) — write specs
   (`job-create`, `direct-sale`) skip ho jayengi, sirf read-only specs chalengi.
2. Behtar solution: e2e ke liye **alag staging Supabase project** (`.env.e2e.local`
   type setup), live project par write specs kabhi na chalein.
3. CI (`.github/workflows/e2e.yml`) me `E2E_ALLOW_WRITES` **sirf staging** par `1`
   rakhein; prod secrets ke saath khaali chhodein.

---

## 9. Ye audit kaise banaya

- Evidence: Playwright run logs + `test-results/` + DB read-only SELECT
  (`service_role` key, sirf GET requests).
- Koi INSERT/UPDATE/DELETE agent ne nahi chalaya — na audit ke waqt, na cleanup
  ke liye.
- Numbers DB se cross-check kiye: `activity_logs` id `24712–24728` lagataar hain
  (koi gap nahi), aur unke `meta_id` bilkul inhi sale/job ids par point karte hain.
