# Staff Geofence View-Only + Temporary Outside-Work Permit — Plan

Created: 2026-08-31
Status: **PLAN ONLY** — abhi implement nahi karna hai. Baad me is par kaam karenge.
Scope: Staff ke liye office-based write-gating (view-only jab bahar), plus kisi specific
staff ko timer ke saath geofence ke bahar kaam karne ki temporary permission.

---

## 1. Goal

- **Staff (`role === 'staff'`)** ko system me changes sirf **office ke andar** se hi karne diye jayein.
- Jab staff **office ke bahar** ho → poora app uske liye **view-only** ban jaye (wo sirf dekh sakta
  hai, koi bhi add/edit/delete/push nahi kar sakta).
- Admin/developer hamesha fully editable rahein (kabhi lock na hon).
- Naya feature: kabhi jarurat padne par, admin kisi **specific staff** ko **temporary (timer-based)**
  permission de sake taaki wo thode waqt ke liye geofence ke bahar bhi changes kar sake.

---

## 2. Existing Building Blocks (already in codebase — reuse)

| Cheez | File | Kya karta hai |
|---|---|---|
| Haversine distance | `src/lib/geofence.ts` `distanceMeters()` | do lat/lng ke beech meters me doori |
| Get current position | `src/lib/geofence.ts` `getCurrentPosition()` | `navigator.geolocation` promise wrapper |
| Geofence config load | `src/lib/geofence.ts` `loadGeofenceConfig()` | `system_info` se config padhta hai |
| Verify location | `src/lib/geofence.ts` `verifyAttendanceLocation()` | office ke andar/bahar check + Hindi errors |
| Hindi error msgs | `src/lib/geofence.ts` `geoErrorMessage()` | permission/outside/timeout messages |
| Geofence config storage | `system_info` key-value | `geofence_enabled/lat/lng/radius_m` |
| Geofence Settings UI | `src/app/settings/page.tsx` (~178-257, 1135) | enable toggle, lat/lng, radius, "Use My Current Location" |
| Attendance geofence | DailyAttendance (check-in/out) | sirf ek jagah write, simple gate |
| Roles | `profile?.role` | `admin`/`developer`/`staff`/`client` |

**Summary:** Location side almost ready. Asli kaam = "view-only" ko define + enforce karna.

---

## 3. Design Decisions (pehle confirm/decide)

### D1. Enforcement tier (SABSE IMPORTANT)
- **Tier A — Soft (client-side):** Browser geolocation se `viewOnly` flag + banner + buttons disable.
  Spoofable (devtools geolocation override), par simple, fast, honest-policy value high.
  → **Recommended starting point.**
- **Tier B — Server-enforced:** Har staff write API route par server-side distance check +
  RLS lock. Major refactor, spoof-proof. → Tabhi jab sach me "change kar hi nahi sakta" chahiye.

### D2. Fail-closed vs fail-open (jab location na mille)
Jab location unavailable/denied/timeout:
- **fail-closed:** to wo write kar hi nahi sakta (strict — internet/GPS kharab ya permission deny
  hone par user phas jata hai).
- **fail-open:** to wo likh sakta hai (lenient — geofence ka maqsad fail ho jata hai).
- Real "bahar changes nahi" ke liye **fail-closed** chahiye, saath clear Hindi error message
  (pehle se hai). Decide: kya mobile data off par office me baithe staff ko bhi block karna theek hai?

### D3. Someone exempt
- `admin`/`developer` → hamesha write (kabhi lock nahi).
- `client` → apna portal (already alag flow, geofence se alag).
- Only `staff` par ye mode lagta hai.

### D4. Business rule ki clarification
- Geofencing single-shop model ke liye hai. Agar staff legitimately client site/field par kaam
  karte hain, to strict office-only galat hai — isliye **permit feature (section 5)** zaroori hai.

### D5. View-only = sirf mutations block
- Staff ko sab kuch **dekhna** allowed rahega (reports, jobs, clients sab).
- Sirf **.insert/.update/.upsert/.delete** + external side-effects (WhatsApp push, WhatsApp, print)
  block honge.

---

## 4. Tier A — Soft View-Only Design

### 4.1 View-Only state (client context)
Ek `ViewOnlyContext` / `useViewOnly()` hook banaye jo:
- Role + geofence status rakhta hai.
- `viewOnly` = `role==='staff' && currentLocationOutside()` (with valid override, section 5).
- Main `RootClient` me ek check: staff ke liye, app load par + `focus`/interval par location verify.

### 4.2 Guard mechanism (central, har form me hathyar na karna)
Kyuki sirf 2 files aaj role-gated hain aur 41 files write karti hain, har form ko modify karna
costly hai. Clean approach:
- **Option 1 (recommended):** Ek `CanWrite` wrapper component / `useWriteGuard()` — jo
  `viewOnly` par button/controls ko `disabled` + tooltip "View Only — office se hi changes honge"
  karta hai. Naye forms/important forms isme wrap karo (incremental, safe).
- **Option 2 (global safety-net):** Ek global click/keyboard interceptor + form `onSubmit` guard
  jo agar `viewOnly` ho to change ko roke + banner dikhaye. Backup guard, lekin layering ke liye.
- **Option 3 (full sweep):** Hari ek of 41 write files me explicit check. Sabse adhik reliable par
  sabse adhik kaam. Jab Tier B jana ho tab yehi base banta hai.

**Recommendation:** Option 1 (primary) + Option 2 (safety-net) pehle. Option 3 sirf important
forms ya Tier B ke liye.

### 4.3 UI
- **Banner (`viewOnly === true`):** Top, red/purple — "VIEW ONLY — Aap office ke bahar hain.
  Changes sirf office andar se. (distance Xm)". Mobile + desktop dono par.
- **Buttons/inputs:** disable via `CanWrite`, grey-out + tooltip.
- **Status:** geofence config nahi hai → staff ko batao "geofence configured nahi — admin se
  Settings me set karwayein" (existing `no-config` message).

### 4.4 Edge cases
- Multiple tabs / tab background → on `visibilitychange` re-verify.
- Browser permission first time → prompt, handle `denied` graciously (fail-closed ya banner).
- Office radius generous (100–300m) due to GPS inaccuracy.

---

## 5. Temporary Outside-Work Permit (naya feature — timer-based)

**Maqsad:** Jab kisi specific staff ko geofence ke bahar kaam karna ho (client site, delivery,
field work), admin usko **limited time** ke liye write-permission de sake. Timer khatam → phir
view-only.

### 5.1 Data model
`system_info` key-value me NAHI (per-user dynamic data hai, periodic cleanup chahiye).
Naya table:
```sql
create table if not exists public.staff_geofence_permit (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  mechanic_id   int null,                    -- optional: business staff mapping
  reason        text,                        -- "client visit", "delivery", ...
  granted_by    uuid references auth.users(id), -- admin jo di
  granted_at    timestamptz not null default now(),
  expires_at    timestamptz not null,        -- timer end
  created_at    timestamptz not null default now()
);
create index staff_geofence_permit_user_idx on staff_geofence_permit(user_id);
create index staff_geofence_permit_expiry_idx on staff_geofence_permit(expires_at);
```
- RLS: browser client staff/admin READ allowed; **INSERT/DELETE sirf admin (admin-only policy) ya
  service-role API**. Staff khud ko permit nahi de sakta.
- Setup/planning page me is SQL ko apply karne ka note (like existing migrations).

### 5.2 Permit logic (Tier A ke andar)
`useViewOnly()` me:
1. `role==='staff'` + location outside current device → check active permit:
   `SELECT 1 FROM staff_geofence_permit WHERE user_id = me AND expires_at > now()`.
2. Active permit → `viewOnly = false` + green badge "**Outside-Work Permit active — X min baki**".
3. Permit nahi / expired → `viewOnly = true`.

### 5.3 Timer
- `expires_at` DB se hi decide hota hai (authoritative). Client timer bhi dikhata hai (countdown).
- Bahar kam par jaate hi page focus ho → re-verify permit still valid.
- Permit expiry → agli verification par view-only.

### 5.4 Admin UI (permit management)
Admin/developer kisi staff ko permit de:
- Staff select (from `profiles` role=staff / `mechanic_list`).
- Duration: preset (30min / 1hr / 2hr / 4hr / 8hr / 1 day) ya custom.
- Options: "abhi se", ya specific start/end.
- Reason (optional, audit).
- Active permits list + "Revoke Now" (delete row → turant view-only).
- Activity log entry (`logActivity`) — permit grant/revoke.

### 5.5 Security notes
- Permit **sirf admin/developer** grant/revoke (API/RLS enforce).
- Permit **expiry check hamesha server-side time** (`now()` in DB) se, client clock par trust NAHI.
- `expires_at` har request par re-check (ya minimum TTL cache) taaki expired permit hat jaye.
- Permit ko **better spoof-na ho** ke liye, Tier B me server bhi `expires_at > now()` check karega.

### 5.6 Edge cases
- Admin khud ko permit deta hai? Zaroorat nahi — admin hamesha write.
- Ek se zyada active permits — latest `expires_at` max consider karo.
- Purana expired data cleanup: daily cron / occasional `DELETE ... WHERE expires_at < now() - 30d`.

---

## 6. Tier B — Hard Server-Enforced (future, optional)

Agar kabhi spoof-proof chahiye:
1. Staff ke tamam write operations ko service-role API routes me normalize karo jo
   `clientLocation` (har request me bheja coords) ko **server-side** office radius se verify kare.
2. RLS lock: browser client se direct PATCH/DELETE on core tables sirf tab jab request ke saath
   verified location ho (complex — RLS me location compare nahi hoti easily). Asli rasta: sab writes
   API se, RLS browser writes band.
3. Location snapshot ko signed/attested karna mushkil hai — server ko client-declared coords par
   trust karna hota hai (client "office coords" bhej sakta hai). Isliye genuinely bulletproof
   server-side location auth ke liye alag solution chahiye (e.g. VPN/device mgmt) — practical me
   Tier B "decent but not absolute".

**Honest note:** Browser geolocation kabhi bhi 100% spoof-proof nahi. Tier B bahut zyada strong
karta hai par absolute guarantee nahi deta. Agar hard requirement ho, to enterprise MDM ya
dedicated device app level ka solution chahiye (is project me overkill).

---

## 7. Data-collection / write surface sweep
- **135 mutating call-sites, 41 files** in `src/app` write karte hain.
- `src/app/**` me mutating methods: `.insert()`, `.update()`, `.upsert()`, `.delete()`.
- `src/lib/*` me bhi service-role API routes (login, attendance, etc.) — unhe bhi audit karo.
- External side-effects (WhatsApp push, prints) ko bhi gate karna hai.

---

## 8. Suggested Phases (baad me implement karte waqt)

### Phase 0 — Decisions
- [ ] D1 enforcement tier choose (recommend: Tier A first).
- [ ] D2 fail-closed vs fail-open decide.
- [ ] D4 business-rule confirm (single-shop? field work?).
- [ ] Radius value confirm.

### Phase 1 — Permit DB
- [ ] `staff_geofence_permit` table migration + RLS (insert migration file).
- [ ] Admin UI: grant/revoke + list + timer presets.
- [ ] Activity-log entries.

### Phase 2 — Tier A view-only core
- [ ] `ViewOnlyContext` / `useViewOnly()` (role + location + permit).
- [ ] `RootClient` load/focus/re-interval verification.
- [ ] `CanWrite` wrapper + `useWriteGuard()`.
- [ ] Banner + button disable + Hindi messages.
- [ ] ESLint rule/helper: naye forms me `CanWrite` use karo.

### Phase 3 — Permit wiring
- [ ] `useViewOnly()` me permit check (active → write allowed + countdown badge).
- [ ] Re-verify on focus/timer; expiry → view-only.

### Phase 4 — Test matrix
- Admin inside/outside → always write.
- Staff inside → write.
- Staff outside, no permit → view-only + banner.
- Staff outside, active permit in duration → write + badge.
- Permit expired while outside → view-only (after re-verify).
- Location denied/timeout → fail-closed ya fail-open per D2.
- Desktop + mobile, multiple tabs, wifi-off in office.

### Phase 5 — Tier B (optional)
- Server-side verify + browser direct writes band, agar chahiye.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Client-side spoof (devtools coords override) | Tier B / server verify; ya policy acceptance. |
| Geolocation permission warnings annoy staff | Clear Hindi msgs; geofence toggle on/off. |
| Indoor GPS false "outside" | Generous radius (100–300m). |
| Staff phans jaye (denied/no-GPS) | D2 fail-closed decision + emergency permit from admin. |
| Permit expiry surprise mid-task | Server-time enforcement + 5min pre-expiry warning + revoke-all. |
| Scope creep (41 files) | Incremental `CanWrite` wraps; global safety-net guard. |
| RLS/client writes bypass Tier A | Tier B me API-enforced writes. |

---

## 10. Files likely touched (implementation ke waqt)

- `src/lib/geofence.ts` — extend (permit check helpers).
- `src/lib/viewOnly.tsx` (new) — `ViewOnlyContext`, `useViewOnly`, `CanWrite`, `useWriteGuard`.
- `src/app/RootClient.tsx` — mount context provider + banner + load/focus verify.
- `src/app/components/` — `ViewOnlyBanner`, `CanWrite`.
- `src/app/api/admin/geofence-permit/route.ts` (new) — grant/revoke/list (service-role, admin-only).
- `src/app/settings/page.tsx` — (optional) permit management UI ya alag page `/settings/geofence-permits`.
- `supabase/migrations/YYYYMMDD_staff_geofence_permit.sql` (new).
- `src/lib/activity.ts` — log permit actions.

---

## 11. NOT-in-scope / de-prioritized
- Client portal geofencing (alag flow, baad me ek alag plan).
- Enterprise MDM / dedicated device app (overkill is project ke liye).
- Multi-office complex rules (pehle single-shop model).

---

## 12. Summary Recommendation
1. **Tier A soft view-only** pehle — cheap, phir real-world behavior dekho.
2. **Permit table + timer UI** zaroor banao (yaha ka special demand) — ye practical value deta hai.
3. **Tier B** ko future/optional rakho; jab tak koi hard breach case na dikhe, over-engineer mat karo.
4. Tests layered: edge cases (permit expiry, fail-closed, multitab) pehle hi matrix me dalo.

_Note: Ye plan baad me implement hone ke liye hai. Implement se pehle Phase 0 decisions confirm_
_karna aur DATA_MIGRATION_NOTES.md padhna (DB work rule)._
