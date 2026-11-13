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

1. **`get_due_stats` migration apply** (Supabase SQL Editor) — apply hone ke baad
   dashboard due-stats 5 requests → 1 RPC; verify: widget numbers pehle jaise hi
   hone chahiye (`select public.get_due_stats();`).
2. **`/jobs` activity_logs** — 2 queries `meta_id in.(30+ ids)`; DCL ke baad
   chalte hain (blocking nahi) par network bhaari.
3. Dashboard JS ~471 KB (40 chunks, cold) — code-split audit.
