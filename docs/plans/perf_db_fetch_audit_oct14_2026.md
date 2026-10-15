# Performance Audit — DB Fetch & Page Load (14 Oct 2026)

_Purpose: investigate user report "pages load hone me bahut samay lagta hai — kya
DB se fetching fast kar sakte hain". Ye doc read-only measurements + root cause +
ranked plan capture karta hai. Abhi sirf plan hai — koi code change nahi kiya._

Related docs: `perf_baseline.md` (LH baseline, Sessions 1–5), `performance_plan.md`,
`frontend_performance_plan.md`, `lightning_fast_plan.md`, `DATA_MIGRATION_NOTES.md`.

---

## TL;DR

1. **DB size is NOT the bottleneck.** Saari tables tiny hain (largest =
   `activity_logs` 4,016 rows; `transaction_list` 2,229).
2. **Global root cause = `src/proxy.ts`** (Next 16 me `middleware.ts` ka naya naam).
   Ye har matched request par `await supabase.auth.getUser()` chalata hai — jo
   Supabase Auth server ko **network round-trip** karta hai. Worse: ye call
   static/API/public early-returns se **pehle** hai, to `/api`, public pages bhi
   ye cost pay karte hain. Har navigation = +~50–220ms (cold: seconds). Isliye
   "**sabhi pages** slow, kisi me kam kisi me zyada".
3. Secondary: **Supabase cold start** (first hit after idle = 7.9s observed),
   **no client data cache** (har mount par refetch), aur per-page round-trip count.

---

## Method (read-only — peak-season freeze respected)

- `@supabase/supabase-js` (service role) se REST probes. **Sirf reads** — koi
  write/index/DDL nahi.
- Timing = wall clock around `await`.
- Koi direct Postgres connection string nahi hai (`.env.local` me sirf
  `NEXT_PUBLIC_SUPABASE_URL` + keys), isliye `EXPLAIN ANALYZE` nahi chala paye.
- Repro scripts appendix me.

---

## Findings

### 1. DB row counts (exact `count`)

| Table                  | Rows  |
| ---------------------- | ----- |
| `transaction_list`     | 2,229 |
| `activity_logs`        | 4,016 |
| `transaction_services` | 1,618 |
| `client_list`          | 531   |
| `client_payments`      | 785   |
| `inventory_list`       | 128   |
| `product_list`         | 97    |
| `direct_sales`         | 55    |
| `direct_sale_items`    | 60    |
| `payment_reminders`    | 38    |
| `messages`             | 17    |
| `client_loans`         | 4     |
| `mechanic_list`        | 4     |
| `suppliers`            | 1     |
| `purchase_orders`      | 4     |

**Conclusion:** data volume trivial hai. "DB bada hai" assumption **galat** hai.
Koi table 4k rows se upar nahi.

### 2. Query latency (warm, per query)

| Query (representative)                                | Latency          |
| ----------------------------------------------------- | ---------------- |
| `transaction_list` order `date_created` desc limit 50 | 154ms            |
| `transaction_list` status in (0,1,2,3,5) limit 30     | 90ms             |
| `transaction_list` order `date_updated` desc limit 50 | 75ms             |
| `client_list` order `firstname` limit 50              | 99ms             |
| `activity_logs` module+action day range               | 77ms             |
| `activity_logs` meta_id in(20)                        | 76ms             |
| `activity_logs` stale-scan limit 500                  | 65ms             |
| `client_payments` eq client_id order desc             | 102ms            |
| `transaction_services`/`products` by txn_id           | ~71ms            |
| **5× sequential tiny queries (waterfall sim)**        | **~270ms total** |

**Conclusion:** warm per-query ~**50–220ms** (baseline RTT + PostgREST overhead).
5 sequential tiny queries ≈ 270ms. Page load = (number of sequential round trips)
× ~55ms. Parallel batches (Promise.all) are fine; sequential chains hurt.

### 3. Cold start (the variance spike)

- **First** count query after idle: **7,883ms**.
- Same count warm: **221ms**.
- Exact vs estimated count: 221ms vs 187ms (count type is NOT the issue).

**Conclusion:** Supabase free-tier cold start / paused connection produces
multi-second first loads. Ye "kabhi-kabhi bahut slow" wala symptom explain karta hai.

### 4. Deployed site (public pages)

| URL                                   | TTFB  | HTML size |
| ------------------------------------- | ----- | --------- |
| `https://vtech-next.vercel.app/`      | 495ms | 110.5 KB  |
| `https://vtech-next.vercel.app/login` | 626ms | 47.2 KB   |

Public pages okay-ish; protected pages additionally pay the proxy auth RTT (see §6).

### 5. Code architecture (from codebase scan)

- **~100 "use client" pages** vs ~22 server pages. Most data fetched in browser
  via `supabase.from()` in `useEffect` → skeleton → data waterfall **after**
  hydration.
- **No app-layer data cache**: no SWR / @tanstack/react-query / `React.cache` /
  `unstable_cache`. Only `getCachedUser()` 8s TTL in `src/lib/supabase.ts`
  (client-side auth dedup). **Har mount par fresh fetch.**
- **`select("*")` 72 occurrences**; worst: `src/app/clients/[id]/page.tsx` (5),
  `src/app/jobs/[id]/view/page.tsx` (4).
- **Unbounded list**: `src/app/inventory/purchase-orders/page.tsx:133`
  (`select("*")` no limit/range).
- **Sequential independent awaits** (parallelizable): `src/app/clients/[id]/page.tsx`
  lines ~188,200,208,216,224.
- **Client-side aggregation** heavy in reports/dashboard (fetch-all then reduce JS).
- Realtime channels exist (presence, messaging, notifications); no data polling loops.

### 6. ROOT CAUSE — `src/proxy.ts` auth tax (global, all pages)

`src/proxy.ts:35`:

```ts
const {
  data: { user: u },
} = await supabase.auth.getUser();
```

- `supabase.auth.getUser()` **cookie se JWT padhta hai par Supabase Auth server ko
  validate karne ke liye network call karta hai** — ye sirf cookie decode nahi hai.
- Ye call **har matched request** par chalti hai. Matcher:
  `["/((?!_next/static|_next/image|favicon.ico).*)"]` (line 108) — matlab
  **`/api/*` aur Link-prefetch requests bhi**.
- **Order bug:** `getUser()` (line 35) static/API/public early-returns (lines 61–76)
  se **pehle** hai. Matlab `/api` routes, public pages, aur favicon-ke-alawa sab
  kuch yeh network RTT pay karte hain — chahe unhe auth ki zarurat na ho.
- Har navigation + prefetch = ek extra Supabase Auth round-trip (~50–220ms warm,
  cold me seconds) **page render shuru hone se pehle**.

Ye exactly "sabhi pages, kisi me kam kisi me zyada" complaint se match karta hai
(jitne zyada navigations/prefetches, utna zyada cumulative tax).

> Note: `src/app/sw.ts:20-25` me already documented hai ki proxy ka `getUser()`
> response ko >~3s le jata tha. Ye finding usi ko quantify + root-cause karti hai.

---

## Current DB indexes (migrations scan)

Indexed: `suppliers`, `spare_supplier`, `wp_template_history`, `payment_reminders`,
`login_throttle`, `profiles(mechanic_id)`, `inventory_list/product_list.place_zone`,
`purchase_orders(status|supplier)`, `purchase_order_items`, `push_subscriptions`,
`locations(zone|code|kind)`, `product_locations`, `transaction_list(location_id)`,
`transaction_list(job_id)` unique, `job_required_parts`, `supplier_payments`,
`direct_sale_items`, `stock_counts`, `stock_adjustments`, `messages`, `user_presence`,
`expense_list`, `client_contacts`, `bom_templates`, `staff_*`, etc.

**Missing on hot filter/sort columns:**

- `transaction_list`: `status`, `client_name`, `date_created`, `date_updated`.
- `activity_logs`: `module`+`action`, `meta_id`, `date_created`.

Minor abhi (data chhota), par future-proofing ke liye.

---

## Plan (ranked — impact / effort / risk)

### Phase 1 — Fix `src/proxy.ts` auth tax ⭐ global, low risk, highest impact

**✅ IMPLEMENTED (2026-10-15, commit in this repo):**

1. Early-returns (static/api/public/extensions) **AB createServerClient se pehle**
   — in paths par auth calls = ZERO.
2. Protected routes: `getClaims()` local JWKS verify fast path → fail hone par
   `getUser()` fallback (expired-token refresh behavior preserved).
3. Latent bug fix: stale `sb-` cookie clear ab **login-redirect response par**
   lagta hai (pehle discarded `NextResponse.next()` response par set hota tha —
   redirect ke saath lost ho jata tha).
4. Contracts: `src/proxy.test.ts` (12 tests — early-returns zero-auth, claims
   fast path, fallback, cookie clear, absolute-age cap).
   Verified: vitest 360/360, `next build` ✓, anon smoke (public 200, protected
   307→login) ✓. Anon TTFB ≈ same (anon pehle se network-free tha); logged-in
   nav se per-request RTT (~50–220ms warm, cold seconds) hata — auth server
   round-trip ab sirf: (a) expired-token fallback, (b) page-level `requireStaff`
   (jo authoritative re-check hai).
   Rollback: `src/proxy.ts` + `src/proxy.test.ts` revert.

### Phase 2 — Kill Supabase cold start (global, low effort)

**✅ IMPLEMENTED (2026-10-15, free-tier decision):** Vercel Hobby cron
`vercel.json` → daily `30 4 * * *` UTC (≈10:00 IST) par public
`/api/system-info` route ping — wahi route pehle se ek tiny Supabase query
karta hai (service-role, whitelisted public fields, zero naya code/surface).
Effect: (a) Supabase free-tier 7-day auto-pause prevention, (b) shop ke din
ki shuruwat me DB warm. Limitation (free tier accepted): raat/weekend ke idle
baad halka cold-start possible; proper no-pause ke liye paid tier zaroori.
Rollback: `vercel.json` se `crons` hata do.

### Phase 3 — Client data cache (all pages, medium-high effort, high UX impact)

- Root par @tanstack/react-query (ya SWR) add; list/data fetches ko cache +
  stale-while-revalidate. Back/forward navigation instant.
- **Impact:** refetch-on-every-mount khatam (abhi zero cache).

### Phase 4 — Remove post-hydration waterfall (key pages, medium-high effort)

- Dashboard/jobs/clients initial data RSC me ya ek RPC per page se; stream.
- Client-view 7-query fan-out ek RPC/join me consolidate.
- **Impact:** first paint me hi data (matches `perf_baseline.md` G3 SSR wins:
  `/clients` LCP 10.13s→5.2–5.9s, `/mechanics`, `/expenses`, `/payments`).

### Phase 5 — Query hygiene (low risk)

**✅ IMPLEMENTED (2026-10-15):**

1. `clients/[id]/page.tsx` — 6 sequential awaits (role, client, repairs,
   payments, loans, sales) → **one `Promise.all`** round (role depends only on
   `getCachedUser()`; client missing → `/clients` redirect behavior preserved).
2. `jobs/[id]/view/page.tsx` — role + `system_info` + job row ek `Promise.all`
   (pehle 3 sequential); product_list + service_list name/HSN lookups ek
   `Promise.all` (pehle sequential).
3. Column projection (audit-named `select("*")` spots only):
   - `clients/[id]`: client_list / transaction_list / client_payments /
     client_loans / direct_sales — sirf page-used columns.
   - `jobs/[id]/view`: transaction_list (JobDetail fields), transaction_products,
     transaction_services, transaction_images.
   - `purchase-orders/page.tsx:133`: purchase_orders ke 11 list columns.
   - `purchase-orders` par artificial `.limit()` **nahi** laga — page poora PO
     register hai (client-side search/status filter); cap karne se history
     chhup jati. Pagination ek product decision hai, hygiene nahi.
4. Gates: prettier (touched; clients/jobs write kiye, PO ka pre-existing
   unformatted churn avoid karke sirf hunk apply) · tsc ✓ · vitest 360/360 ·
   `next build` ✓. Rollback: 3 page files revert.

### Phase 6 — DB indexes ⚠ DB WRITE → peak-season freeze ke baad

- `transaction_list(status|date_created|client_name|date_updated)`,
  `activity_logs(module,action,date_created)`, `activity_logs(meta_id)`.
- Minor now (data chhota); future-proofing.

### Phase 7 — Bundle / JS weight (heavy pages)

- jobs (2,993 LOC) + reports (1,000–1,900 LOC) ke charts/report modules
  dynamic-import se lazy-load. "Kisi page me zyada" wala hissa cover karta hai.

**Recommended first:** Phase 1 + Phase 2 (dono global, "all pages" ko seedha address
karte hain, low risk) → phir re-measure → Phase 3.

---

## Measurement plan

- Baseline: deployed site par TTFB + Lighthouse (same method as `perf_baseline.md`
  Sessions 1–5: `next start` + authenticated Chrome profile).
- Har phase ke baad same 6 routes re-measure (dashboard, clients, jobs,
  reports/cash-flow, reports/monthly-profit, login) + public TTFB.
- Watch: LCP, TTI, TBT, and server TTFB on protected routes.

---

## Appendix — repro scripts

Row counts + query timings (service role, read-only):

```js
// perf-queries.js  — run: node perf-queries.js
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
function loadEnv(f) {
  const o = {};
  if (!fs.existsSync(f)) return o;
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return o;
}
const env = { ...loadEnv(".env.local"), ...loadEnv(".env") };
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  for (const t of ["transaction_list", "activity_logs", "client_list", "client_payments"]) {
    const s = Date.now();
    const { count } = await sb.from(t).select("*", { count: "exact", head: true });
    console.log(`${count} rows  ${Date.now() - s}ms  ${t}`);
  }
})();
```

> Caution: ye service-role client hai — sirf read-only probes ke liye. Writes
> peak-season freeze ke against hain.
