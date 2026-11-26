# RPC Grants Hardening (Security Debt) — Implementation Plan & TODO

_Status (27 Nov 2026): 🟡 **`get_inventory_stock` SQL→plpgsql do regressions (42702 ambiguity +
42804 type mismatch) — dono fix ready, owner re-apply baaki** — grant/guard verification sab pass
hai. Owner ne `20261127_rpc_grants_hardening.sql`
**aur** full-schema dono successfully chalaye (42883 + 42804 ke baad). Anon REST 7/7 block,
`reset_sequence` anon 401, `has_function_privilege` matrix 9/9 exact, client-role GUC guard proof
`42501 permission denied for staff-only function` (RAISE line 12) — sab pass. Staff UI smoke:
dashboard/clients/jobs green; `get_inventory_stock` wale 3 reports me pehle 42702, re-apply ke
baad 42804 type mismatch mila — dono fix ho gaye. Baaki: patched migration re-apply → 3 reports
re-smoke → portal smoke + backup sequence reset (owner). Apply environment (dev/staging ya live)
confirm baaki._
_Created: 16 Nov 2026 · Source: live read-only audit (anon key REST tests + `pg_proc`/`pg_policies` dump)_

> **27 Nov update:** Layer 2 me `rename + thin wrapper` ke jagah **same-name `create or replace`
> + guard injection** kiya gaya (body same) — isse full-schema fold-in me `_impl_*` duplicate
> naye functions nahi bante aur fresh/install dono me final guarded definition milti hai.
>
> **42883 fix (owner dry-run):** seedha `revoke ... on function public.inventory_sync_place_path()`
> live DB par `42883 function does not exist` deta tha — kyunki `20260925_i6_phase2_place_drop.sql`
> is dead trigger function ko **drop kar chuka hai**. Ab saare REVOKE/GRANT ek `do $$` block me
> `to_regprocedure()` se guarded hain: missing function = skip, baaki sab waisa hi. Migration
> ab idempotent + do baar chalane par bhi safe. (D2 note: ye drop intentional hai — function
> wapas create nahi karna.)
>
> **42804 fix (owner dry-run #2):** `get_clients_page_financials()` scalar `jsonb` return hai;
> generator ne SQL→plpgsql conversion me uski query ko `RETURN QUERY` se wrap kiya tha —
> `RETURN QUERY` sirf `SETOF`/`TABLE` functions me chalata hai. Ab `RETURN (WITH ... SELECT ...)`
> used hai; body/result waisa hi. (`get_inventory_stock()` `RETURNS TABLE` hai — uska
> `RETURN QUERY` sahi hai.) Dono migration files (standalone + full-schema fold-in) patched.
>
> **42702 regression (owner UI smoke):** `/reports/oversold` par `get_inventory_stock` HTTP 400
> de raha tha — `{"code":"42702","message":"column reference \"product_id\" is ambiguous"}`.
> SQL→plpgsql conversion me `RETURNS TABLE(product_id, ..., place)` ke OUT variables unqualified
> column names se clash kar gaye (original `LANGUAGE sql` me ye nahi hota). Fix: function body ke
> start me `#variable_conflict use_column` — unqualified naam ab hamesha table column. Dono files
> patched + drift 35 OK. **Owner ko patched migration dobara apply karni hogi** (DB abhi purana
> definition chalata hai). Baaki RPCs par aisa nahi hai — sirf yahi `RETURNS TABLE` wali function thi.
>
> **42804 follow-up (owner re-apply ke baad):** ambiguity nahi rahi, par ab
> `Returned type integer does not match expected type bigint in column 1` — plpgsql `RETURN QUERY`
> original `LANGUAGE sql` se zyada strict hai. Final SELECT ke **saare 10 output columns** ko
> `RETURNS TABLE` wale types me explicitly cast kiya (`product_id::bigint`, qty/total/available/
> oversold `::bigint`, avg `::numeric`, date/text). Dono files patched + drift 35 OK.
> **Owner ko ek baar aur re-apply karna hoga**, phir oversold/requirement-list/stock-valuation re-smoke.
> Guard = `is_frontend_staff() OR JWT role service_role` (API routes service-role use karte hain;
> sirf staff guard unhe block kar deta). `reset_sequence` browser anon RPC hataya gaya —
> `/api/admin/reset-sequence` (admin-only) + `src/lib/resetSequence.ts` allowlist se service-role
> se chalata hai. DB par sirf `service_role` ko grant.

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
2. ✅ `20261127_rpc_grants_hardening.sql` likha: Layer 1 grants → Layer 1b triggers → Layer 2 guards
   → `NOTIFY pgrst` → verify block. Full-schema snapshot me append kiya (schema:drift **35 OK**).
3. ⬜ Pre-apply simulation (client uuid = 42501, staff uuid = data) — **live, read-only** (owner).
4. ⬜ Screenshot/report: `has_function_privilege` matrix before/after.
5. ✅ Apply (owner, 27 Nov) — standalone + full-schema dono success.
   ✅ **Anon REST proof (read-only):** `get_dashboard_stats`, `get_clients_page_financials`,
   `get_monthly_revenue`, `get_financial_summary`, `get_technician_metrics`, `get_inventory_stock`,
   `peek_next_job_id` — **7/7 HTTP 401 / 42501 `permission denied for function`**.
   `reset_sequence` bhi anon se block (**401**) — safe probe: nonexistent table naam diya,
   `pg_get_serial_sequence` NULL → SKIP, koi `setval` nahi hua.
   `next_job_id` anon se **call nahi kiya** (grant open hota to counter increment hota); migration
   me function exist karti hai aur REVOKE chal chuka hai, isliye denial expected — direct proof
   SQL matrix se karna hai. `GET /rest/v1/` OpenAPI root anon ke liye 401 (empty body) hai,
   wo probe **inconclusive** — usse koi nishkarsh nahi.
   ✅ **Owner `has_function_privilege` matrix (SQL editor):** 9/9 par `anon_ok=false`;
   `auth_ok=true` 8 par (sirf `reset_sequence` par `false`); `svc_ok=true` 9/9 — exact expected.
   `next_job_id` ka anon denial bhi isi se direct prove ho gaya.
   ✅ **Owner GUC guard proof:** `set request.jwt.claims = '{"role":"authenticated"}'` ke saath
   `get_dashboard_stats` → `42501 permission denied for staff-only function`,
   `CONTEXT: PL/pgSQL function get_dashboard_stats(text,text) line 12 at RAISE` — client-role
   authenticated user body guard se block. `reset request.jwt.claims` ke baad staff calls normal.
   ✅ **Staff UI smoke (browser, preeti staff login):** `/dashboard` (data + welcome),
   `/clients` (Customer Registry), `/jobs` (Transactions), `/reports/requirement-list`,
   `/reports/stock-valuation`, `/job-status` (public) — sab green, koi 42501 nahi.
   `/inventory` aur backup ke kuch APIs "Admin only" 401 — preeti staff hai, expected (unrelated).
   ❌ `/reports/oversold` → `get_inventory_stock` HTTP 400 / `42702 product_id ambiguous` —
   D1 SQL→plpgsql conversion se aaya; `#variable_conflict use_column` se fix (dono files).
   ❌ Owner re-apply ke baad wahi 3 reports → `42804 Returned type integer does not match expected
   type bigint in column 1` — final SELECT ke 10 output columns me explicit casts (dono files).
   ⬜ Owner final patched migration dobara apply kare → 3 reports re-smoke; portal smoke (client
   credentials chahiye) + backup sequence reset baaki.
6. ⬜ `tsc` / `lint` / `test` / `build` / `schema:drift` / e2e smoke → commit (docs + migration).
7. ⬜ (Optional) `scripts/check-rpc-grants.mjs` + CI step.
