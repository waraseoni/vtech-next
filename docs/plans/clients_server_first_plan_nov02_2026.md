# Clients Server-First + Jobs P3 Speed Plan (2026-11-02)

> **Status: PROPOSED — implementation pending (user approval ke baad).**
> **Rule: DB LIVE hai — koi schema/index/view/RPC/column/write NAHI. Sirf reads +
> transport/execution placement badalna hai.**
>
> **Goal:** Clients module ke saare high-traffic surfaces ko Jobs P0–P2 jaisa
> "instant first paint" dena (server seed + `initialData`), aur Jobs ke bache hue
> 6 client-first surfaces (P3) cover karna. Features/mutations jaisa hai waisa hi
> rahega.

---

## 1. Aaj ka state (audit, 2026-11-02)

Method: har `page.tsx` par `"use client"` check + `supabase.from()` / `useQuery`
grep. Koi file modify nahi ki gayi.

### 1.1 Clients

| Surface                         | First paint      | Data path (observed)                                                                                           | Gap                                 |
| ------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `/clients`                      | **Server-first** | `requireStaffWithRole()` + `fetchClientsPageData()` → `ClientsBody` props                                      | —                                   |
| `/clients/[id]/view`            | **Client-first** | `clientDetailOptions` (`useQuery` line ~400, **`initialData` nahi**) → `fetchClientDetail`: 8 parallel queries | Sabse bada gap: hydrate → 1 wave    |
| `/clients/[id]` (bare)          | Client-first     | `getCachedUser` → 6 parallel queries (profile + client/repairs/payments/loans/sales)                           | **Koi nav link nahi** — legacy/dead |
| `/clients/[id]/edit`            | Client-first     | Promise.all(client_list + contacts), phir update                                                               | 1 wave, chhota                      |
| `/clients/new`                  | Client-first     | Sirf duplicate-check queries (`client_list` ×4) + insert                                                       | Seed ka gain na ke barabar          |
| `/clients/[id]/add-payment`     | Client-first     | client_list → 1 wave (jobs/direct_sales/payments/loans) → 2 extra lookups                                      | 3 waves                             |
| `/clients/[id]/give-loan`       | Client-first     | client_list → 1 wave (jobs/direct_sales/payments/loans)                                                        | 2 waves                             |
| `/clients/[id]/collect-emi`     | Client-first     | client_list → loans → payments (sequential)                                                                    | 3 waves                             |
| `/clients/[id]/add-direct-sale` | Client-first     | client_list only                                                                                               | Chhota                              |
| `/clients/[id]/ledger-print`    | Client-first     | client_list → system_info → 1 wave (4 sums) → 1 wave (4 lists) → detail rows                                   | 4+ waves, 1439-line print page      |

Note: `clients` folder me **koi `layout.tsx` nahi** — Jobs wala seed pattern
clients me kahin nahi laga.

### 1.2 Jobs (bache hue, P3)

| Surface                  | Status       | Note                                       |
| ------------------------ | ------------ | ------------------------------------------ |
| `/jobs/bulk`             | Client-first | Medium traffic                             |
| `/jobs/bulk-edit`        | Client-first | Medium traffic                             |
| `/jobs/old`              | Client-first | Legacy list, v2 me nahi                    |
| `/jobs/[id]/old`         | Client-first | Legacy detail (save → redirect to `/view`) |
| `/jobs/combined-invoice` | Client-first | Client + jobs lookup                       |
| `/jobs/spot-labels`      | Client-first | Jobs + spots, print-only render            |

---

## 2. "No DB changes" ke andar kya possible hai

Clients pages ka bottleneck **browser round-trip** hai, Postgres scan nahi:

1. Har page ka pehla paint blank shell → JS download → hydrate → `getCachedUser`
   → N queries → paint. Server seed se ye poora chain first HTML me chala jata hai.
2. Jo queries aaj client par sequential hain (`add-payment`, `collect-emi`,
   `ledger-print`), unhe server par **ek Promise.all** me daalna.
3. Mutations (insert/update/delete) client-side hi rahenge — unme latency issue
   nahi hai.

DB permission milne par bhi is module me **kuch khaas nahi badlega**: ye
row-level reads hain (single client + uske rows), full-table aggregation nahi.
Isliye yahan index/RPC ka scope zero hai — plan 100% no-DB-change hai.

---

## 3. Scope

### C-P0 — `/clients/[id]/view` server seed (sabse bada gain)

**Problem:** 2654-line page, `useQuery(clientDetailOptions)` mount par 8 parallel
queries chalata hai. First paint ke liye hydrate + 1 full RTT.

**Fix:**

1. Neutral module `src/app/clients/clientDetailQueries.ts`:
   - `fetchClientDetailData(supabase: SupabaseClient, clientId: number)` —
     `src/lib/queries/client-detail.ts` ka exact logic shift (8 parallel queries +
     loan aggregation + `loanGiven/loanRepaid/monthlyEMI`), queries/filters/order
     **byte-for-byte same**.
   - Koi `next/headers` / browser-supabase import nahi.
2. `src/lib/clientContacts.ts` — `fetchClientContacts` ko
   `fetchClientContactsWith(supabase, clientId)` par delegate karo; purana export
   same signature rahe (baaki callers na tootein).
3. `src/lib/queries/client-detail.ts` — thin client wrapper: profile/browser
   client se `fetchClientDetailData` call; `clientDetailKey` /
   `clientDetailOptions` / `useClientDetail` public API unchanged (navbar
   prefetch bhi isi ko use karta hai).
4. Route-level server `src/app/clients/[id]/view/layout.tsx`:
   `force-dynamic` + `requireStaffWithRole()` → redirect `/login`; invalid id par
   seed `null`; `getServerSupabase()` + `fetchClientDetailData`; failure par
   `seed = null`. Service-role **kabhi nahi**.
5. `ClientDetailSeedProvider` (client context) — page me
   `initialData` sirf jab `seed.client.id === clientId`.
6. Page state lazy-init seed se (loader flash na ho); actions ka `refetch()`
   intact.

**Acceptance:** view page first HTML par client/contacts/summary/tabs data
present; network me duplicate initial client-detail fetch nahi; seed fail →
purana client path chalta rahe; delete/update actions pehle jaise.

### C-P1 — Edit + action pages seed

| Page              | Seed                                                                           |
| ----------------- | ------------------------------------------------------------------------------ |
| `[id]/edit`       | client row + contacts (layout + provider); update flow unchanged               |
| `add-payment`     | client + bill options (jobs/direct sales) + payments/loans — ek server wave    |
| `give-loan`       | client + wahi balance inputs — ek server wave                                  |
| `collect-emi`     | client + loans + payments — ek server wave                                     |
| `add-direct-sale` | client — optional (bahut chhota gain), sirf agar shared provider cost na badhe |
| `new`             | **skip** — sirf duplicate checks hain, seed se koi perceived gain nahi         |

Shared approach: ek neutral `src/app/clients/clientActionQueries.ts` (function
per page, sab `SupabaseClient` param) + route `layout.tsx` seed + provider.
Har page ka fallback (seed `null`) purana parallel client path hi rahega.

**Acceptance:** form/action pages par client ka naam/balance/bill options pehle
render me; save/redirect flow same; validation messages same.

### C-P2 — `/clients/[id]/ledger-print` seed

**Problem:** 4+ sequential waves, aur print page hone ki wajah se blank delay
sabse zyada dikhta hai.

**Fix:** `fetchClientLedgerData(supabase, id, filters)` neutral module — jo aaj
4 waves me hai use **2 waves** me (client+system_info ∥ sums, phir detail lists)
shift karo. Server layout seed + page `initialData`; URL query (`from/to` etc.)
`useSearchParams` se hi padho, server par `searchParams` se seed banao.

**Acceptance:** print view first render par numbers/rows present; date filter
change par client refetch (same-route `pushState` + query refetch), print output
identical.

### C-P3 — `/clients/[id]` legacy page

**Problem:** 1254-line duplicate page, **kahin link nahi** (sirf khud edit link
karta hai). `/clients/[id]/view` canonical hai.

**Fix (verify-first):** production logs/nav me usage zero confirm karo, phir
`redirect('/clients/{id}/view')` (Jobs `[id]` jaisa). File delete alag owner
signoff ke saath. **Is phase ka code change 3 lines** — data path par koi asar
nahi, sirf dead surface hatata hai.

**Acceptance:** purane bookmark `/clients/{id}` → `/view` par 307; koi 404 nahi.

### J-P3 — Jobs ke bache 6 surfaces

Priority order (traffic ke hisaab se):

1. `/jobs/bulk` + `/jobs/bulk-edit` — list/master seed (shared `jobFormQueries`
   masters reuse ho sakte hain).
2. `/jobs/combined-invoice` — client + jobs seed.
3. `/jobs/spot-labels` — jobs + spots seed (print-only).
4. `/jobs/old` + `/jobs/[id]/old` — **sabse last**; legacy surface hai, v2 me
   exist hi nahi karta. Sirf tab jab owner kahe.

Har page pe wahi pattern: neutral query module + server layout + provider.

---

## 4. Shared infra (dono modules)

- `requireStaffWithRole()` + `getServerSupabase()` (cookie + RLS). Service-role
  page reads me **never**.
- Seed provider per route tree; seed `null` = graceful fallback.
- React Query global `staleTime: 30_000` + `refetchOnWindowFocus: false` already
  hai — isliye seed ke baad mount par duplicate fetch nahi hota.
- Same-route URL changes `window.history.pushState` (Jobs P0 me verified Next 16
  pattern) — ledger-print filters par bhi yahi.

---

## 5. Files (expected)

**Naye**

- `src/app/clients/clientDetailQueries.ts`
- `src/app/clients/clientActionQueries.ts`
- `src/app/clients/[id]/view/layout.tsx`
- `src/app/clients/[id]/view/ClientDetailSeedProvider.tsx`
- `src/app/clients/[id]/edit/layout.tsx`
- `src/app/clients/[id]/{add-payment,give-loan,collect-emi,add-direct-sale}/layout.tsx`
- `src/app/clients/[id]/ledger-print/layout.tsx`
- `src/lib/server-clients-detail.ts` (server seed helpers)
- `src/app/clients/clientDetailQueries.test.ts` (pure aggregation tests)

**Modified**

- `src/lib/queries/client-detail.ts` (thin wrapper)
- `src/lib/clientContacts.ts` (`fetchClientContactsWith` delegate)
- `src/app/clients/[id]/view/page.tsx` (seed init + `initialData`)
- `src/app/clients/[id]/edit/page.tsx`, `add-payment`, `give-loan`,
  `collect-emi`, `add-direct-sale`, `ledger-print` (seed init + fallback)
- `src/app/clients/[id]/page.tsx` (redirect — C-P3)

**Jobs P3 (alag commits)**

- `src/app/jobs/{bulk,bulk-edit,old,combined-invoice,spot-labels}/layout.tsx`
- `src/app/jobs/[id]/old/layout.tsx` + respective pages

---

## 6. Risks

| Risk                                         | Mitigation                                                                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RSC payload bada (heavy clients)             | Measure: client ke jobs/payments rows seed me jayenge. Agar > ~200KB JSON, seed se lists hata kar sirf client+summary bhejo aur lists React Query par chhodo (semantics same) |
| Seed/client drift                            | Ek neutral module; client wrapper wahi function call karta hai                                                                                                                |
| `fetchClientContacts` refactor se regression | Purana export same signature, sirf delegate; contacts order (`is_primary desc, id asc`) same                                                                                  |
| Auth/RLS regression                          | `requireStaffWithRole()` + cookie client; unauth par 307 `/login`                                                                                                             |
| Live DB                                      | Sirf `select`; koi write/test row nahi; E2E writes already env se off                                                                                                         |
| Seed stale on action                         | Actions ke baad existing `fetchData()`/`refetch()` + 30s staleTime                                                                                                            |
| Legacy `[id]` redirect se data loss          | Pehle usage verify; redirect reversible (ek line)                                                                                                                             |

---

## 7. Verification gates (har phase)

1. `npx tsc --noEmit`
2. `npx eslint` (touched files)
3. `npx vitest run` (existing 584 + naye pure aggregation tests)
4. `npm run build` (production)
5. Fresh `next start` smoke: naye layouts ke routes unauth → 307 `/login`
   (`/clients/1/view`, `/clients/1/edit`, `/clients/1/add-payment`,
   `/clients/1/give-loan`, `/clients/1/collect-emi`, `/clients/1/ledger-print`)
6. Static: network me duplicate initial fetch nahi (code + build output)
7. Zero DB writes (koi insert/update/delete test nahi)

---

## 8. Rollback

Har phase independent:

- Layout se provider hatao (seed `null`) → page automatic purane client fetch
  path par.
- Neutral modules tab bhi reusable rahenge.
- C-P3 redirect ek line revert.

---

## 9. Suggested order

1. **C-P0** (view seed) — sabse bada perceived gain.
2. **C-P1** (edit + 3 action pages) — form latency.
3. **C-P2** (ledger-print) — heavy print page.
4. **C-P3** (legacy redirect) — 3-line cleanup.
5. **J-P3** — bulk/bulk-edit → combined-invoice → spot-labels → old (last).
