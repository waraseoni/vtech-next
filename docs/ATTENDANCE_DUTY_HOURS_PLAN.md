# Attendance — Compact Report + Duty Schedule + Working-Hours Engine

> Status: **P1 ✅ done · P2 ✅ done · P3 ✅ done (migration live 2026-10-02)
> · ⏳ open: tooltip duty ≠ DB — next steps §9** · Created: 2026-10-02
> Scope: monthly report cell redesign, per-staff duty time with history,
> auto-checkout, working-hours/OT calculation, path to hours-based salary.
>
> **Read `docs/DATA_MIGRATION_NOTES.md` before any DB work** (AGENTS.md rule).
> Canonical schema: `supabase/migrations/20260913000000_final_full_schema_idempotent.sql`
> (new columns/tables must be mirrored there + in a new incremental migration).

---

## 0. Reference — what the PHP software does

`C:\xampp\htdocs\vtech-rsms\admin\attendance\view_report.php`

|                              | PHP                                                                                           | Next.js (before this plan)            |
| ---------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------- |
| Cell content                 | status colour bg + **date + total hours** (`.cal-hours`, `0.55rem`, sirf jab in+out dono hon) | date + status letter, **hours nahi**  |
| In/Out time                  | cell me **nahi** — sirf `attendance_hours_str()` = total                                      | sirf native `title` me (desktop)      |
| Hover                        | kuch nahi (sirf `onclick` → modal, admin only)                                                | native `title` (1s delay, plain text) |
| Footer / detail strip        | **nahi hai**                                                                                  | tha → hata diya                       |
| Duty / shift / auto-checkout | **bilkul nahi** (poore PHP me `duty\|shift\|office_close\|auto_checkout` = 0 matches)         | bhi nahi                              |

**Constraint:** cell 38-44px ka hai → in+out time andar fit nahi hote (PHP bhi
nahi dikhata). In+out **hover tooltip / tap popover** me jayenge, cell me
**worked hours** (jo aage salary banayega).

---

## 1. Decisions (approved best practices)

### D1 — Cell content: date + worked hours

```
┌────┐  ┌────┐  ┌────┐  ┌────┐
│ 01 │  │ 02 │  │ 03 │  │ 04 │   bg = status colour
│5h44│  │ P  │  │ —  │  │8h10│   line 1 = date (HAMESHA)
└────┘  └────┘  └────┘  └────┘   line 2 = hours (jab ho) / status letter
```

- Hours-first kyun: salary abhi status se chalti hai, aage **hours se chalegi**
  → hours ko cell me hi dikhao.
- `status = 0` (upcoming / no record) → sirf date.
- Status-only row (time nahi) → status letter.
- Colour-blind/a11y ke liye card header ke existing `P:{n} H:{n} A:{n}` badges hi
  legend hain (colour + letter + count) + cell `aria-label` me full word.

### D2 — Mobile tap: popover (sabke liye), Edit andar

- Tap = full details popover: date, status, duty, In, Out, worked, OT.
- Admin ke liye popover ke andar `Edit` (staff ke liye nahi).
- Desktop: wahi cheez `group-hover` / `mouseenter` se; **portal + `position: fixed`**
  (table `overflow-x-auto` hai → `MonthlyReport.tsx:458` → absolute tooltip clip ho jata).
- Footer / detail strip **delete** → page compact.
- Close: bahar mouse-leave / bahar tap / Esc / Android back.
- Kyun ye: ek hi interaction model sab roles ke liye, chhoti screen par
  accidental modal-open nahi, aur **hover mobile par hota hi nahi**.

---

## 2. Part A — Compact cell + tooltip (Phase 1, koi DB change nahi)

- Cell render dono jagah (desktop `<td>` heatmap + mobile grid) same helper se.
- Native `title` hata ke styled portal tooltip.
- State: ek hi `tip` object → `{ mechanicId, dateStr, rect, day }`.
- `openEditFor(md, dateStr)` (ab date explicit pass hogi).
- Sirf file: `src/app/attendance/components/MonthlyReport.tsx` + uska test.

---

## 3. Part B — Duty schedule **with history** (Phase 2)

### 3.1 Schema — ✅ implemented (append-only, `effective_to` NAHI)

```sql
-- supabase/migrations/20261002_staff_duty_schedule.sql (+ canonical mirror)
CREATE TABLE public.staff_duty_schedule (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mechanic_id    integer NOT NULL REFERENCES public.mechanic_list(id) ON DELETE CASCADE,
  duty_start     time NOT NULL DEFAULT '10:00',   -- attendance_list.time_in ka same type
  duty_end       time NOT NULL DEFAULT '20:00',
  break_minutes  integer NOT NULL DEFAULT 0,       -- abhi UI me 0, P3 engine use karega
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  note           text NOT NULL DEFAULT '',
  created_by     uuid,
  created_at     timestamptz DEFAULT now(),
  CONSTRAINT staff_duty_schedule_mech_from_uniq UNIQUE (mechanic_id, effective_from),
  CONSTRAINT staff_duty_schedule_break_ck CHECK (break_minutes >= 0)
);
CREATE INDEX staff_duty_schedule_lookup_idx
  ON staff_duty_schedule(mechanic_id, effective_from DESC);
```

**Deviation (deliberate):** plan me `effective_to` + partial unique index "one open
row" tha. Implemented **append-only + UNIQUE(mechanic_id, effective_from)** —
`mechanic_salary_history` (salary change history) ke bilkul same pattern par:

- **Ek hi round-trip** (UPSERT) — client-side transaction nahi hai, do-step
  "purani row close + nayi insert" me partial failure = gap/overlap.
- Range read-time derive: is row ka `effective_from` → next-naye row ka
  `effective_from - 1 day`. History isi se dikhti hai.
- `on conflict (mechanic_id, effective_from) do update` → ek din me baar-baar
  badalne par row pile-up nahi hota.

### 3.2 History rule — ✅ `src/lib/duty.ts` (`dutyFor`, `currentSchedule`)

- Lookup: `currentSchedule(rows, date)` = `effective_from <= date` me sabse nayi
  (sorted DESC, **future rows ignore**) → row mili to `rowToDuty`, warna fallback.
- **Historical day ka hours usi duty se nikalna hai jo us din lagi thi** (aaj ka
  duty nahi) — isi liye effective-dating zaroori. Row ki `effective_from` se date
  compare string-wise chalta hai (`YYYY-MM-DD`).
- Fallback: koi row nahi → `system_info.biz_open / biz_close` (mechanics modal me
  mount par load; `DEFAULT_DUTY` = 10:00–20:00 last resort).
- **RLS deviation:** geofence-permit wala service-role API route nahi banaya —
  INSERT/UPDATE/DELETE policy **admin/developer** (`profiles.role`) tak simit hai,
  SELECT sab frontend staff ko. DB-level enforcement = API route se simpler aur
  utna hi fail-closed (UI bhi `canWriteDuty` gate karta hai).
- Batch fetch (N+1 avoid): `src/lib/server-salary.ts:11-16` wala pattern (P3 me).

### 3.3 UI — ✅ implemented

| Screen                            | Kya dikhe                                                                                     | File                                             | Phase |
| --------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----- |
| Staff Add/Edit modal              | **Duty From/To** (`type="time"`, default = `biz_open`/`biz_close`) + live length badge (`9h`) | `src/app/mechanics/components/MechanicsBody.tsx` | ✅ P2 |
| Usi modal me **history timeline** | har entry: `15 Oct 2026 se · 11:00 – 20:00 · Current/Old` (sabse nayi `effective_from` ≤ aaj) | same                                             | ✅ P2 |
| Add flow                          | duty form pre-fill (biz hours) + save par initial row (agar fallback se alag ho)              | same                                             | ✅ P2 |
| Non-admin                         | read-only duty + history (RLS bhi write block karta hai)                                      | same                                             | ✅ P2 |
| Break input                       | UI me abhi nahi (`break_minutes` DB default 0) — **engine `breakMinutes` use karta hai**      | —                                                | ✅ P3 |
| Salary screens                    | us mahine ki applicable duty + duty-hours                                                     | `src/app/salary/`, `src/lib/server-salary.ts`    | P4    |
| Monthly report header             | month ke beech me duty badli ho to note                                                       | `MonthlyReport.tsx`                              | ✅ P3 |
| **Naam ke sath duty time**        | daily list + monthly report dono me staff naam ke neeche `Duty 10:00 – 20:00`                 | `DailyAttendance.tsx`, `MonthlyReport.tsx`       | ✅ P3 |

Save path: `handleSave` → mechanic save (existing) → **non-fatal** `saveDuty()`
(UPSERT on `staff_duty_schedule` + `logActivity("Updated Duty Time")`). Duty fail
ho to toast, staff record bacha rehta hai (dobara save = retry).

**Bug fix (test ne pakda):** `openEdit` me `String(m.commission_percent || "")` —
commission `0` ho to value `""` ban jaati thi → `parseFloat("") = NaN` → har edit
save par `Valid commission daalo!` fail. Ab `?? ""` (salary par bhi).

---

## 4. Part C — Working-hours engine (Phase 3) — ✅ implemented

### 4.1 Ek hi pure helper — `src/lib/attendance-hours.ts` (✅ 14 tests)

```ts
// duty.ts (P2): dutyFor(schedules, date, fallback) → { start, end, breakMinutes }
computeDay(row, duty, now) → {   // row = { curr_date, status, time_in, time_out }
  hasTimeIn,     // false = rule 2 (manual status row) — sab null/0
  effOut,        // "HH:MM" real/auto · null = live working
  isAutoClosed, working,
  workedMin,     // time_in → effOut (overnight wrap, clamp 0..1440)
  dutyMin,       // end - start - break (breakMinutes abhi 0)
  otMin,         // max(0, workedMin - dutyMin) — SIRF real late checkout
  lateInMin, earlyOutMin,
}
fmtMins(344) → "5h 44m"   // hoursBetweenIST ke exact same format ("0h 45m")
nowIST() → { date, mins }  // IST ab ka waqt (deterministic tests ke liye now param)

// attendance-derive.ts (save paths ka glue — DB me likhne waley liye):
loadDutyMap(mechIds, date)  → Map<mechId, Duty>   // batch (N+1 nahi)
loadDuty(mechId, date)      → Duty                 // single (modal/self checkout)
derivedCols(row, duty)      → { worked_min, ot_min, duty_min, is_auto_closed }
CLEAR_DERIVED_COLS          → times clear = cols reset
```

**Deviations (deliberate):**

- `effectiveTimeOut()` alag export nahi — `computeDay` ke andar rule 1-4 hi hai.
- `derivedCols` alag module me (`attendance-derive.ts`) taaki `attendance-hours.ts`
  **pure** rahe (koi supabase import nahi) → engine tests supabase mock-free.
- `fmtMins` "45m" nahi `"0h 45m"` deta hai — `hoursBetweenIST` (purana display)
  ke saath exact consistency ke liye.

### 4.2 Auto-checkout rule

1. Real `time_out` hai → **hamesha wahi** (early/late actual checkout hi jeetega).
2. `time_in` hi nahi (manual status row) → kuch compute nahi, status as-is.
3. Past day **ya** `now >= duty_end + grace` → `duty_end` auto-checkout
   (staff ki duty priority, `biz_close` sirf fallback).
4. Abhi duty chal rahi hai → `null` (live "working" dikhe).

**OT rule:** auto-closed day = **0 OT** (proof nahi ki staff duty ke baad raha).
Sirf **actual late checkout** par OT count → fake OT ka rasta band.

Defaults: `break_minutes = 0`, `grace = 15 min`, `ot_multiplier = 1.5` (P4 tak OFF).

### 4.3 Persist vs derive

- **Display:** hamesha read-time derive — **cron infra existence nahi karti**
  (`vercel.json` me `crons` nahi, `src/app/api/cron/**` khali, `node-cron` nahi).
- **Persist (audit)** day-close par: staff check-out · admin save ·
  naya **"Close pending days"** button (report header) ·
  optional: naye check-in se kal ka row auto-close (app-level, ek line).
- Persist columns: `attendance_list` → `worked_min, ot_min, duty_min, is_auto_closed`.
  Migration: **`supabase/migrations/20261002_attendance_derived_cols.sql`** (+ canonical
  mirror) — ✅ live applied (2026-10-02, user ne `information_schema` se 4/4 cols verify kiye).
- **Backfill free:** purani NULL `time_out` rows read-time par duty_end se nikal jayengi.

### 4.4 Wiring (✅ done)

| Jagah                                        | Kya hua                                                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `MonthlyReport` (report)                     | batch duty fetch + per-day `computeDay` · cell hours ab engine se · tooltip me **Duty time range + lambai**, OT, Late  |
| `MonthlyReport` — naam ke sath               | desktop sticky staff cell + mobile card header: `Duty 10:00 – 20:00` (month-end applicable duty)                       |
| `MonthlyReport` — header                     | **"Close {n} pending"** button (admin, confirm → update loop + `logActivity`) · **"Duty changed ×n"** chip (mid-month) |
| `DailyAttendance` — self checkout            | real checkout par `derivedCols` persist (duty = `loadDuty`)                                                            |
| `DailyAttendance` — admin save               | `loadDutyMap` batch (1 round-trip) → har row me `derivedCols`                                                          |
| `DailyAttendance` — naam ke sath             | desktop row + mobile card + self hero card: `Duty 10:00 – 20:00` (schedule row / biz-hours fallback)                   |
| `AttendanceModal` — Save Times / Clear Times | save par `derivedCols` persist; clear par `CLEAR_DERIVED_COLS` reset                                                   |

- **Not done (optional, plan §4.3):** naye check-in se kal ka pending row
  auto-close (app-level ek line) — abhi sirf admin button se close hota hai.
- Duty UI fail (RLS/network) = duty line gayab, baaki page normal — non-fatal.

---

## 5. Part D — Status + salary path

### 5.1 Status (abhi)

- **Status mat badlo** — salary abhi status se chalti hai:
  `src/lib/server-salary.ts:110,173,191` → `present × daily_salary + halfDays × daily_salary/2`
  aur salary query `time_in/time_out` **leti hi nahi** (`:110` sirf `mechanic_id, curr_date, status`).
- Default: **auto-checkout sirf hours badalta hai, status nahi.**

### 5.2 Salary — days mode → hours mode, flag ke peeche

```ts
// system_info: salary_mode = "days" (default) | "hours"
// system_info: ot_multiplier = 1.0   (benefit chahiye → 1.5)
hourly = daily_salary / dutyHoursThatDay; // duty history se
earnDay = (regularMin / 60) * hourly + (otMin / 60) * hourly * ot_multiplier;
```

- **`salary_mode` flag zaroori** — bina flag salary silently sabki badal jayegi.
- Flip se pehle **preview diff**: days mode ₹X vs hours mode ₹Y (kitne staff upar/neeche).
- **Historical salaries retroactively mat badlo** — purane mahine `days` mode me rehne do.
- Hours mode ON hone par hi status rule upgrade:
  `worked >= dutyMin → Present` · `>= dutyMin/2 → Half` · warna `Short day` · row nahi → `Absent`
  (abhi rule: `<6h = Half Day` — `src/lib/dateUtils.ts:164-172`).

---

## 6. Phases

| #      | Kaam                                                                                                                       | DB  | Salary risk               |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------- |
| **P1** | ✅ Compact cell (date+hours) + legend + portal tooltip/tap popover + strip delete + tests                                  | ❌  | None                      |
| **P2** | ✅ `staff_duty_schedule` migration + `duty.ts` (`dutyFor`) + duty UI **with history timeline** + admin-only write          | ✅  | None (write nahi ho raha) |
| **P3** | ✅ `attendance-hours.ts` engine + wire (report/daily/modal) + persist cols + **"Close pending"** button + OT badge + tests | ✅  | None (status untouched)   |
| **P4** | `salary_mode=hours` + OT multiplier + preview diff, **manual flag flip**                                                   | —   | ⚠️ Gated                  |
| **P5** | Status auto-derive (hours-based), optional cron                                                                            | —   | ⚠️ Gated                  |

Har phase alag commit. **P1→P3 tak koi salary change nahi** — sirf sahi
hours/OT dikhna shuru hota hai.

---

## 7. Verification (har phase par)

- `npx tsc --noEmit`
- `npx eslint <changed files>`
- `npx vitest run` (**312 tests / 24 files** — P1: 5 · P2: 18 `duty.test` + 4
  `MechanicsBody.test` · P3: 14 `attendance-hours.test` + 1 `DailyAttendance.test` +
  2 `MonthlyReport.test` additions)
- `npx prettier --check <naye files>` (repo me 230 files already non-conforming,
  purane files ko full reformat mat karo)
- Report: `http://localhost:3000/attendance?view=report&month=2026-09` (mobile <768px + desktop)

## 8. Out of scope / deferred

- Cron/Vercel-cron persistence (P5 optional)
- Salary ka actual hours-mode flip (P4, manual approval)
- PHP side koi bhi change (PHP retired — `AGENTS.md`)

---

## 9. NEXT SESSION — open issue + instructions (saved 2026-10-02, sab commit/push ho chuka)

### ⏳ Open: tooltip duty ≠ DB duty (user report)

**Observation** (`http://localhost:3000/attendance?view=report&month=2026-10`,
staff **Hemant Mehra**):

- Naam ke neeche label = `Duty 12:00 – 20:00` = DB ✓ = staff edit modal ✓
  (refresh ke baad dono sahi — user confirm).
- **Hover tooltip Thu, 01 Oct 2026**: `In 12:16 PM · Total 5h 44m · Duty 11:00 –
  20:00 (9h 0m) · Late 76m` — DB/current duty (12:00–20:00) se ALAG.
  User: "hover tool DB se match nahi karta · Edit modal me galat aa raha hai".

**Root cause (code-verified — data nahi, logic se prove):**

Sab duty displays ek hi `dutyFor()` use karte — sirf **basis date** alag hai:

| Display                        | Basis date      | Code                    |
| ------------------------------ | --------------- | ----------------------- |
| Staff edit modal               | `todayIST()`    | `MechanicsBody.tsx:168` |
| Report row label (name ke neeche) | month `endDate` | `MonthlyReport.tsx:509` |
| Report hover tooltip           | per-day `dateStr` | `MonthlyReport.tsx:452` |
| DailyAttendance                | selected date   | `DailyAttendance.tsx:296` |
| AttendanceModal save (derivedCols) | row ka `date` | `AttendanceModal.tsx:150` |

Hemant ki `12:00 – 20:00` row ka `effective_from = 2026-10-02` (aaj modal se set
hui). **01 Oct < effective_from** → `currentSchedule` purani row / biz-fallback
(`11:00 – 20:00`) lata hai → tooltip wahi dikhata hai, aur `Late 76m` (12:16 −
11:00) **us purani duty se internally consistent** hai. Yani tooltip historically
sahi hai, par user ko DB wali duty (12:00 – 20:00) chahiye.

**Design fork — fix se pehle decide karna:**

- **Option A — tooltip duty = label basis (`min(monthEnd, today)`)**: har din DB
  duty dikhegi (user ki demand) · but pre-change days ke Total/OT/Late purani
  duty se bane hain → inconsistent (Late 76m vs 12:00 start). Metrics bhi
  recompute kiye = **historical hours badlenge** → wo approval chahiye.
- **Option B — per-day (current) retain + clarify**: jab day ki applicable duty
  current se alag ho, duty row me marker `11:00 – 20:00 (us din)`; label ke
  paas "Duty changed ×1" chip already hai.
- **Option C (hybrid, recommended)** — current/DB duty primary, alag ho to
  chhoti line me "us din: 11:00 – 20:00" note.

**Next steps (order):**

1. User se Option A/B/C confirm (ya C seedha implement, agar "DB match hona
   chahiye" hi final answer maana jaaye).
2. `MonthlyReport.tsx` DayTip (rows ~219-245) + `DayData` field badlo; test
   `MonthlyReport.test.tsx` me tooltip assertions add/adjust (`data-testid="day-tip"`).
3. "Edit modal" wala complaint verify: `AttendanceModal` me **duty TEXT dikhta
   hi nahi** (sirf times + working-hours preview), duty sirf `derivedCols`
   persist ke liye load hoti hai — user se exact value/screenshot poochho agar
   Option ke baad bhi dikhta ho.
4. Gates: `npx vitest run` (312+) · `npx tsc --noEmit` · `npx eslint <changed>`
   · `npx prettier --check <touched files>` (repo me 230 files already non-conforming).
5. Verify report: `?view=report&month=2026-10` (desktop hover + mobile tap).

### Baaki pending (plan ke hisaab se)

- **P4 gated**: `salary_mode=hours` + `ot_multiplier` (1.5) + preview diff —
  explicit go chahiye; `src/lib/server-salary.ts` abhi days-based (untouched).
- **P5 gated**: status auto-derive (hours-based) + optional cron.
- Optional §4.3: naye check-in se kal ka pending row auto-close (app-level ek line).
- Recent session rules: linter par sirf touched files (`eslint .` me unrelated
  root/.cjs/android errors); PowerShell se file content rewrite mat karo
  (UTF-8 corrupt) — edit/write tools hi use karo.
