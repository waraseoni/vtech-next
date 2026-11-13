# Speed Wins — 13 Nov 2026 (measured)

**Kya kiya:** login ke baad dashboard/page loads dheeme the. Sab kuch **measure**
karke fix kiya — production build (`next build` + `next start -p 3100`) par
Playwright Resource-Timing + Navigation Timing se before/after numbers.

**Method:** temp Playwright specs (baad me delete) — cold (storage/cache clear) aur
warm (returning user) dono. Server render ka time `responseEnd` vs DCL se alag
pehchana (long-task 0 tha → masla server par tha, client JS me nahi).

---

## 1. Root causes (measured, before)

| # | Symptom | Number | Kyun |
| - | ------- | -----: | ---- |
| 1 | `/api/ai/alerts` har dashboard load par | **2741 ms** | `get_business_alerts` server par 8-10 queries; widget below-fold me hai par critical path par tha |
| 2 | `/api/license/status?force=true` har full load par | **2327 ms** | auth RTT + 3 `system_info` reads + remote license RPC; Vercel par baaki fetch queue ho jate the |
| 3 | Brand logo `system_info?meta_field=logo` har load par | **631 ms** | logo saal me ek baar badalta hai |
| 4 | `/jobs` ka server HTML response | **2005 ms** | `fetchOpenPartCounts` `enrichJobRows` ke **baad** sequential chalta tha (extra RTT) |
| 5 | Dashboard due-stats | 400-950 ms × 5 requests | client-side `pageAll` full-table scans (transaction_list ke multiple 1000-row pages) |

## 2. Fixes

| File | Fix |
| ---- | --- |
| `src/app/api/ai/alerts/route.ts` | Module-level TTL cache (default 120s, `AI_ALERTS_CACHE_MS`), `?fresh=1` bypass |
| `src/app/components/AIAlertsWidget.tsx` | Idle load (1.2s + `requestIdleCallback`); Refresh button `fresh=1` |
| `src/app/api/license/status/route.ts` | 20s status cache + force 60s dedupe |
| `src/app/useAppBoot.ts` | Force re-verify session me max 1× / 30 min (sessionStorage — reload-safe), non-force 60s throttle reload-safe, license status sessionStorage hydrate, logo localStorage cache (6h) |
| `src/lib/server-jobs.ts` | open-part counts `enrichJobRows` ke saath parallel |
| `supabase/migrations/20261113_dashboard_due_stats_rpc.sql` | `get_due_stats()` — 5 full-table scans → 1 server-side aggregate (formula `src/lib/client-due.ts` jaisi hi) |
| `src/app/(dashboard)/dashboard/DashboardBody.tsx` | due-stats RPC fast-path + purana client-side fallback (RPC migrate na ho to bhi kaam) |

## 3. After (same machine, prod build)

| Metric | Before | After |
| ------ | -----: | ----: |
| `/api/ai/alerts` | 2741 ms | 155-330 ms (cached) |
| `license/status?force=true` | 2327 ms (har load) | 104-326 ms; reload par force call hi nahi |
| logo query | 631 ms (har load) | warm: 0 query; cold: 449 ms |
| `/dashboard` DCL | 1081 ms | 415-608 ms |
| `/dashboard` load | 1249 ms | 415-955 ms |
| `/jobs` server response → DCL | 2005-2659 ms | 907-1283 ms |

**Behavior changes (jaan-boojh kar):**
- License remote re-verify: per tab-session 30 min me ek baar (pehle har hard refresh).
- Alerts: max ~2 min stale ho sakte hain; Refresh button fresh laata hai.
- Logo: 6h tak localStorage se (branding badalne par purane users ko 6h tak purana logo dikh sakta hai).

## 4. Pending (agla kaam, yahan naapa hua)

1. ~~**`get_due_stats` migration apply**~~ — applied + verified (batch 2, doc §5).
2. ~~**`/jobs` activity_logs**~~ — stale alert ab 1 RPC (batch 3, doc §5).
3. ~~Dashboard JS ~471 KB (40 chunks, cold) — code-split audit~~ — audit done (batch 3, §5.4).

---

## 5. Batch 3 — jobs stats RPC + stale RPC + view streaming (13 Nov 2026)

### 5.1 `get_jobs_stats()` — Quick Stats ka full-dataset scan → 1 RPC

| | Before | After |
| --- | ---: | ---: |
| Stats cost (no filters, 2358 rows) | **353 ms** (`status,amount` ke 3 chunked requests + client loop) | **76 ms** (1 RPC, koi row transfer nahi) |
| Values | total 2358 / pending 238 / completed 2103 / amt 2240250 | **exactly same** |
| Filtered (`term=smps`) | chunked scan | 116 ms, 417 rows |

Parity: 10 filter combos (all / hideDelivered / date range / status 2 & 5 / spot /
term item+job_id+client-name) client-scan vs RPC — **byte-for-byte equal** (temp test).

Date-bound semantics (measured): PostgREST `timestamp without time zone` column par
`+05:30` offset ko **cast** karta hai (`2026-10-25` ka count 4 aata hai, plain-cast se 9).
Isliye RPC me `timestamptz ... at time zone 'UTC'` use kiya — session TZ se independent.

### 5.2 `get_stale_jobs()` — 3 requests → 1 RPC

| | Before | After |
| --- | ---: | ---: |
| Stale alert (7 din) | **384 ms**, 3 requests (300-row candidate scan + 2 `activity_logs` queries) | **107 ms**, 1 RPC |
| Items | 34 | **34 (same ids + same `days`)** |

Dual-era rules same (`docs/DATA_MIGRATION_NOTES.md`): legacy key = txn id, modern key =
job_id, fallback `date_updated → date_created`. Equal-timestamp ties ka order DB-order vs
`(date_updated, id)` hai — same `changed_at` par order semantic nahi.

### 5.3 `/jobs/[id]/view` — edit-save ke baad redirect instant

Root cause: layout seed ko `await` karta tha → RSC **headers hi ~400 ms baad** jaate the,
aur `router.replace()` usi response ka wait karta hai. Ab seed fetch `Suspense` ke andar
hai (shell + `PageLoader` turant flush).

| RSC | Before | After |
| --- | ---: | ---: |
| `/jobs/2461/view` headers | ~400 ms (poora payload) | **13-14 ms** (stream total 219-258 ms) |
| `/jobs/2461/edit` headers | — | ~20 ms (total ~215 ms) |
| `/jobs` headers / total | 21 ms / 907-1283 ms | 26-30 ms / **644-677 ms** |
| `/jobs` DCL | 962 ms | 863 ms |

### 5.4 Dashboard JS audit (code-split) — nateeja

Measured (prod, cold): `/dashboard` **1022-1213 KB decoded JS, 19-26 chunks pre-DCL**
(≈471 KB gzip). Breakdown:
- **Already lazy** (post-DCL, ~572 KB): charts bundle `DashboardCharts` (recharts + d3
  deps: 311 + 145 + 65 + 51 KB) aur `AIAlertsWidget`.
- **Pre-DCL bacha hua weight shared app shell hai** — supabase (257 + 96 + 68 KB),
  react-dom (229 + 155 KB), react-query + lucide + page code. Dashboard-specific heavy
  module **koi nahi** mila, isliye aur split karne se sirf doosre routes ka bundle
  bigadta.
- Ek tweak: charts ka `DeferredMount` fallback 2.5 s → **8 s** — below-the-fold charts
  cold load par network/parse se hat gaye (IntersectionObserver scroll/viewport ke
  200 px par turant mount karta hai, isliye feature-loss nahi; 8 s baad safety mount).
  Jo user pehle view me charts tak pahunchta hai uske liye koi fark nahi — laba un
  users ko milta hai jo dashboard ke top hisse par hi rukte hain.

**Behavior changes (jaan-boojh kar):** stale list tie-order deterministic; charts khud
scroll par aate hain (warna 8 s baad).

### 5.5 DB apply (live, data-safe)

`20261113_jobs_stats_stale_rpc.sql` — sirf 2 naye read-only (`stable`, `security definer`)
functions + grants (`authenticated`/`service_role`; `anon` denied). Apply ke baad row
counts **unchanged** (transaction_list 2358, activity_logs 4535, client_list 560,
direct_sales 59, client_loans 4, client_payments 836). Full-schema snapshot me DDL append —
`npm run schema:drift` OK (26 migrations).
