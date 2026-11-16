# RPC Grants Hardening (Security Debt) — Implementation Plan & TODO

_Status: 📝 PLAN READY — code/migration abhi likhi nahi, live DB untouched._
_Created: 16 Nov 2026 · Source: live read-only audit (anon key REST tests + `pg_proc`/`pg_policies` dump)_

---

## 1. Why (Problem Statement)

- RLS hardening (Aug 2026, `rls_hardening_plan.md`) ne **tables** band kiye — 55/55 tables par RLS ON hai. ✅
- **Lekin `security definer` functions RLS ko bypass karte hain.** Inke grants purane Supabase default
  pattern se `PUBLIC`/`anon` par khule pade hain.
- Audit (16 Nov 2026): **28 public functions me se 26 `anon` ke liye EXECUTE-able** hain.
  Frontend bundle me anon key public hota hai → **bina login** koi bhi in RPCs ko hit kar sakta hai.
- Live proof (anon key, read-only, sirf GET/POST RPC — koi write nahi):

| RPC                                                                              | anon call       | Response (live)                                                                  |
| -------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------- |
| `get_dashboard_stats`                                                            | **200**         | `totalClients: 553`, `totalJobs: 2370`, `deliveredJobs: 2006`, revenue fields    |
| `get_clients_page_financials`                                                    | **200**         | har client ka billed / paid / loan balance                                       |
| `get_monthly_revenue`                                                            | **200**         | Dec-25 se Nov-26 tak monthly revenue                                             |
| `get_inventory_stock`                                                            | **200**         | product-wise stock, oversold qty, purchase cost                                  |
| `get_financial_summary`                                                          | execute granted | sirf param cast error (`date >= text`) — param theek do to data                  |
| `get_technician_metrics`                                                         | **200**         | technician-wise revenue/commission                                               |
| `next_job_id` / `peek_next_job_id`                                               | **200**         | job-id counter burn / read (security definer, write!)                            |
| `reset_sequence`                                                                 | **200**         | `setval()` on ANY public table's `id` sequence → **inserts tod sakta hai** (DoS) |
| `get_jobs_stats` / `get_stale_jobs` / `get_due_stats` (naye, Sep-Nov 2026 batch) | **401**         | ✅ sahi pattern (anon denied)                                                    |

- **Doosra hole (same root cause):** `authenticated` role me portal ke `client` users bhi aate hain
  (profiles: staff 5, client 3, developer 1, admin 1). Wo bhi ye definer RPCs call kar sakte hain →
  doosre customers ke balances / job ids / stock. In functions me **koi `is_frontend_staff()` guard nahi**
  (sirf `receive_po_receipt`, `record_stocktake` me hai).

**Impact:** anon key = public. Aaj koi bhi (bina login) shop ke financials, client balances,
stock aur job ids padh sakta hai; `reset_sequence` se inserts break kar sakta hai.

---

## 2. Exposure matrix (live `pg_proc` audit, 16 Nov 2026)

Legend: `def` = security definer (RLS bypass), `inv` = invoker (RLS lagta hai), `anon` = anon execute,
`guard` = function ke andar staff guard maujood.

| #   | Function                                                                                   | secdef | anon exec | staff guard | Caller (repo)                                                | Risk                                                     | Action                                                            |
| --- | ------------------------------------------------------------------------------------------ | ------ | --------- | ----------- | ------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | `get_dashboard_stats(text, text)`                                                          | def    | ⚠️ YES    | ❌          | `server-dashboard.ts` (RSC)                                  | HIGH — revenue/jobs/clients counts                       | revoke anon + staff guard                                         |
| 2   | `get_clients_page_financials()`                                                            | def    | ⚠️ YES    | ❌          | `server-clients.ts` (RSC)                                    | HIGH — har client ka balance                             | revoke anon + staff guard                                         |
| 3   | `get_monthly_revenue(int)`                                                                 | def    | ⚠️ YES    | ❌          | `server-dashboard.ts` (RSC)                                  | HIGH — revenue trend                                     | revoke anon + staff guard                                         |
| 4   | `get_financial_summary(text, text)`                                                        | def    | ⚠️ YES    | ❌          | `DashboardBody.tsx` (browser)                                | HIGH — P&L summary                                       | revoke anon + staff guard                                         |
| 5   | `get_technician_metrics(text, text)`                                                       | def    | ⚠️ YES    | ❌          | `reports/technician-performance`                             | MED — revenue/commission                                 | revoke anon + staff guard                                         |
| 6   | `get_inventory_stock(bigint[])`                                                            | def    | ⚠️ YES    | ❌          | `inventoryStock.ts`, 4 report seeds, `server-direct-sale.ts` | MED — stock/cost                                         | revoke anon + staff guard                                         |
| 7   | `next_job_id()`                                                                            | def    | ⚠️ YES    | ❌          | `jobIdCounter.ts` (browser)                                  | HIGH — counter burn (write)                              | revoke anon + staff guard                                         |
| 8   | `peek_next_job_id()`                                                                       | def    | ⚠️ YES    | ❌          | `jobIdCounterQuery.ts`                                       | LOW/MED — id leak                                        | revoke anon + staff guard                                         |
| 9   | `reset_sequence(text)`                                                                     | def    | ⚠️ YES    | ❌          | `backup/page.tsx` (browser)                                  | **CRITICAL** — arbitrary `setval` = DoS                  | revoke anon + staff guard (+ admin-only?)                         |
| 10  | `save_direct_sale(...)`                                                                    | inv    | ⚠️ YES    | —           | `SaleForm.tsx`                                               | LOW — RLS ne already blocked                             | revoke anon (hygiene)                                             |
| 11  | `get_transactions_with_client_data(date, date)`                                            | inv    | ⚠️ YES    | —           | (unused)                                                     | LOW — RLS                                                | revoke anon (hygiene)                                             |
| 12  | `get_my_client_id()` / `get_my_role()`                                                     | def    | ⚠️ YES    | —           | (app me unused; portal/RLS helper)                           | LOW — apna hi data                                       | anon revoke; `authenticated` rakhna                               |
| 13  | `is_frontend_staff()`                                                                      | def    | ⚠️ YES    | —           | RLS policies + upcoming guards                               | LOW — anon par `false`                                   | anon revoke (policies ko `authenticated` chahiye)                 |
| 14  | `handle_new_user()`, `prevent_role_escalation()`, `update_date_updated()`, `touch_*()` (6) | mix    | ⚠️ YES    | —           | DB triggers only                                             | LOW — trigger fn direct call = error                     | revoke public/anon/authenticated (triggers ko grant nahi chahiye) |
| 15  | `get_jobs_stats(...)`, `get_stale_jobs(int,int)`, `get_due_stats()`                        | def    | ✅ NO     | ❌          | jobs/dashboard                                               | —                                                        | **reference pattern** (anon denied)                               |
| 16  | `receive_po_receipt(...)` ×2, `record_stocktake(...)`                                      | def    | ⚠️ YES    | ✅          | inventory                                                    | LOW — guard hai, par anon ko grant bhi nahi hona chahiye | revoke anon + keep guard                                          |

Counts (live): 55 tables (sab RLS ON), 28 functions, **26 anon-executable**, 8 staff-only definer
read/write RPCs jinke andar guard nahi.

---

## 3. Fix design (data-safe — koi table/data touch nahi)

Do layers, alag-alag rollback-able:

### Layer 1 — Grants (zero body change, biggest win)

Har staff-only function par:

```sql
revoke all on function public.<fn>(<args>) from public;
revoke all on function public.<fn>(<args>) from anon;
grant execute on function public.<fn>(<args>) to authenticated;
grant execute on function public.<fn>(<args>) to service_role;
```

- Isse **anon exposure 100% band** — jo aaj bina login data de raha hai, kal 401 dega.
- Trigger functions (`handle_new_user`, `prevent_role_escalation`, `update_date_updated`, `touch_*`):
  `revoke ... from public, anon, authenticated` (trigger execution grant par depend nahi karta).
- `get_my_client_id` / `get_my_role`: anon revoke, `authenticated` retain (portal helpers).
- Pattern exactly `20261113_jobs_stats_stale_rpc.sql` jaisa (proven, measured 401 on anon).

### Layer 2 — Staff guard (client-role hole)

`authenticated` me client-role bhi hai, isliye grants kaafi nahi. Guard chahiye — **body rewrite ke
bina**, `rename + thin wrapper` pattern (behaviour 1:1, original logic untouched):

```sql
-- 1) original ko private naam do (body bilkul same)
alter function public.get_dashboard_stats(text, text) rename to _impl_get_dashboard_stats;
revoke all on function public._impl_get_dashboard_stats(text, text) from public, anon, authenticated;

-- 2) public naam par thin guard wrapper
create or replace function public.get_dashboard_stats(p_today_start text, p_today_end text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_frontend_staff() then
    raise exception 'permission denied for staff-only function'
      using errcode = '42501';
  end if;
  return public._impl_get_dashboard_stats(p_today_start, p_today_end);
end;
$$;

revoke all on function public.get_dashboard_stats(text, text) from public, anon;
grant execute on function public.get_dashboard_stats(text, text) to authenticated, service_role;
```

- `security definer` wrapper hone se `_impl` ka `security definer` bhi owner ke roop me chalta hai
  (privilege check owner par hota hai) — isliye `_impl` par kisi ko grant nahi chahiye.
- Alternativa (agar wrapper pasand na aaye): function ko plpgsql me convert karke usi body me
  `if not is_frontend_staff() then raise ...` add karo. Wrapper kam risky hai kyunki
  existing SQL body ko chhua nahi jata.
- Guard sirf **staff-only** functions par: #1–#9 (upar table). `get_my_*` par nahi.
- `reset_sequence`: staff guard ke saath **admin-only** bhi sochna hai (`backup/page.tsx` staff-only
  page hai, par ye function destructive hai). Phase 2 decision — pehle staff guard.

### Layer 3 (optional, follow-up) — Regression guard

- `scripts/check-rpc-grants.mjs` (naya): DB se `pg_proc` + `has_function_privilege` padh kar list
  compare kare — koi bhi naya function `anon`-executable ho to **fail** (CI me `schema:drift` jaisa step).
- Isse ye debt dobara nahi aayegi (root cause: naya function banate waqt grants copy-paste).

---

## 4. App-impact analysis (kya tootega?)

| Caller                                                                          | Auth context                                                        | Impact                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| `server-dashboard.ts`, `server-clients.ts`, report seeds                        | **RSC + cookie session (staff)** → `authenticated` + `service_role` | ✅ staff guard pass                                    |
| `DashboardBody.tsx`, `inventoryStock.ts`, `jobIdCounter*.ts`, `backup/page.tsx` | browser, staff session                                              | ✅ pass                                                |
| `src/app/api/**` (print/export/reports)                                         | `getAdminSupabase()` (service_role)                                 | ✅ service_role grant                                  |
| Client portal (`src/app/api/client/*`, `/my-account`)                           | `requireClient()` + `getAdminSupabase()` (service_role)             | ✅ RPCs use hi nahi karta                              |
| Client-role browser user (portal UI)                                            | `authenticated` + role `client`                                     | ✅ guard se 42501 (desired)                            |
| Anon (public website)                                                           | anon key                                                            | ✅ 401 (desired — public pages ye RPCs use nahi karte) |
| DB triggers                                                                     | table owner / trigger context                                       | ✅ grant-independent                                   |

Koi bhi app path aisa nahi mila jo in RPCs ko **anon** ya **client-role** se legitimately call kare.

---

## 5. Migration — `supabase/migrations/20261116_rpc_grants_hardening.sql`

1. **Header** me: kyun, kaunse functions, rollback SQL (neeche §8), live-proof table.
2. **Layer 1:** 9 staff-only RPCs + `save_direct_sale` + `get_transactions_with_client_data` +
   `get_my_*` + `is_frontend_staff` par `revoke ... from public, anon` + `grant to authenticated, service_role`.
3. **Layer 1b:** 10 trigger functions par `revoke ... from public, anon, authenticated`.
4. **Layer 2:** 9 × (`rename to _impl_*` + guard wrapper + grants).
   - Idempotency: `do $$ ... if not exists (select 1 from pg_proc where proname='_impl_x') then alter ... rename ... end if; end $$;`
   - `create or replace function` wrapper har run par safe.
5. **Verify block** (file ke end me, SQL editor ke liye): grant report + `anon`/`client` simulation
   queries (§6), expected output comment me.
6. **Grants note:** koi table/column/data statement nahi — sirf function-level.

Deploy order safe hai: migration apply **pehle ya baad me** — dono chalega, kyunki:

- app `authenticated` grant par chalta hai (jo migration ke baad bhi hai),
- wrapper signature same (PostgREST ko `create or replace` dikhta hai; `_impl_*` naye naam ignore honge),
- `NOTIFY pgrst, 'reload schema'` end me (PostgREST schema cache refresh).

---

## 6. Testing checklist

**Apply se pehle (read-only, live DB par):**

- [ ] `begin; set local role authenticated; set local request.jwt.claims = '{"sub":"<client-uuid>","role":"authenticated"}'; select public.get_dashboard_stats('2026-11-01','2026-11-16'); rollback;`
      → **abhi 200 (data)**, migration ke baad `42501` chahiye.
- [ ] Wahi simulation staff uuid (`1cae361f-…`) se → dono case me data aana chahiye.
- [ ] Row counts snapshot (55 tables) + `get_jobs_stats` / `get_stale_jobs` output — "data unchanged" proof.

**Apply ke baad (live):**

- [ ] anon REST: sabhi 9 staff-only RPCs → **401** (`42501`); `get_my_*` bhi 401.
- [ ] anon REST: tables (client_list/transaction_list) → pehle jaisa empty (RLS already OK).
- [ ] staff login → dashboard (stats + monthly revenue + due stats), `/clients` (financials),
      `/jobs` (stats/stale), `/inventory` (stock), `/reports/technician-performance`, `backup` page.
- [ ] client portal login → `/my-account`, jobs/payments/ledger API — ✅ (service-role path).
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, `npm run schema:drift`.
- [ ] e2e `login.spec.ts` (server 3100) — smoke.
- [ ] Row counts before/after identical.

---

## 7. Effort

| Task                                                               | Hours                                      |
| ------------------------------------------------------------------ | ------------------------------------------ |
| Audit + evidence (already done 16 Nov)                             | 1                                          |
| Migration (grants + 9 guard wrappers + idempotency + verify block) | 2–3                                        |
| Pre-apply JWT simulation tests                                     | 0.5                                        |
| Apply + anon/staff/portal regression                               | 1                                          |
| CI guard script (Layer 3, optional)                                | 1                                          |
| **Total**                                                          | **~4.5–6.5 hrs** (CI guard ke bina ~3.5–5) |

---

## 8. Rollback

Har layer alag revert ho sakti hai (data touch nahi hota):

```sql
-- Layer 2 rollback (ek function ka example)
drop function if exists public.get_dashboard_stats(text, text);
alter function public._impl_get_dashboard_stats(text, text) rename to get_dashboard_stats;
grant execute on function public.get_dashboard_stats(text, text) to authenticated, service_role;

-- Layer 1 rollback (agar koi internal caller anon par nikla)
grant execute on function public.<fn>(<args>) to anon;   -- public/anon default wapas
```

Triggers ko wapas grant karne ki zaroorat nahi (trigger functions grant se nahi chalte).

---

## ⚡ EXECUTION ORDER (TODO)

1. ✅ (done 16 Nov) Live audit — 26/28 anon-executable, 8 staff-only definer RPCs guard-less,
   client-role hole documented; app callers mapped (§4).
2. ⬜ `20261116_rpc_grants_hardening.sql` likho: Layer 1 grants → Layer 1b triggers → Layer 2 guards
   → `NOTIFY pgrst` → verify block. Full-schema snapshot me append karna (schema:drift requirement).
3. ⬜ Pre-apply simulation (client uuid = 42501, staff uuid = data) — **live, read-only**.
4. ⬜ Screenshot/report: `has_function_privilege` matrix before/after.
5. ⬜ Apply (owner approval ke baad) → anon REST 401 proof + staff/portal regression + row counts.
6. ⬜ `tsc` / `lint` / `test` / `build` / `schema:drift` / e2e smoke → commit (docs + migration).
7. ⬜ (Optional) `scripts/check-rpc-grants.mjs` + CI step.
