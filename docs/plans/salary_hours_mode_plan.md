# Salary Hours Mode v2 — Read-Only Per-Minute Calculator (NO-DB)

> **Status: IMPLEMENTED (2026-10-13) — H1–H4 done, gates green**
> (lib+tests, route+fetch, view+CSV, salary-page link). Rollout §8 dry-run abhi
> bhi applicable — view advisory hai, payout day-mode par.
> v1 (2026-10-03, `mechanic_salary_mode_history` migration wala) **SUPERSEDED** —
> user constraint: **zero DB changes + existing day-mode system untouched**.
>
> User requirement (2026-10-13):
>
> 1. Existing salary system ko **bina chhede** — report/master/print/payout flow zero edit.
> 2. Naya system: ham jo **daily salary decide** karte hain use working hours/minutes me
>    **todd kar per-hour (per-minute) rate** batao.
> 3. Din me kitne **ghante/minute kaam kiya** — uska **earned amount** calculate ho.
> 4. **DB me koi changes nahi** — kewal codebase (schema, migration, system_info key,
>    localStorage config — sab forbidden).
>
> **Approved decisions (2026-10-13):**
>
> | #   | Decision        | Final                                                                                                               |
> | --- | --------------- | ------------------------------------------------------------------------------------------------------------------- |
> | D1  | Denominator     | **Duty-derived**: `dutyMinutes(dutyFor(...))` — schedule → biz fallback → `DEFAULT_DUTY (10:00–20:00)`, zero config |
> | D2  | Punch-less days | **Day-rate fallback** (status 1 → full, 3 → half) + ⚠ badge — strict ₹0 rejected (legacy ~1055 punch-less rows)     |
> | D3  | Entry           | **Separate route** `/mechanics/salary/hours?month=` + salary page par **1-line link** (sirf link, logic zero touch) |
> | D4  | v1 scope        | **Wage-compare only** — commission/advance/old-balance/payout untouched (dono modes me same hain)                   |

---

## 1. Current state (facts — 2026-10-03 research, verified 2026-10-13)

| Fact                     | Detail                                                                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rate source              | `mechanic_list.daily_salary` (current) + `mechanic_salary_history` (effective-dated; `getRate` = latest `effective_date <= day`). `salary_per_day` column = dead legacy.                                                                                                                   |
| Formula (day mode)       | `netTotal = oldBalance + earnedCurr + commission − advances`; `earnedCurr = Σ(status1 ? rate : rate/2)` over `attendance_list` rows `status ∈ {1,3}`. Absent/unmarked = ₹0.                                                                                                                |
| Salary persist nahi hoti | No slip/payroll table — har render par recompute hoti hai.                                                                                                                                                                                                                                 |
| Formula copies           | `server-salary.ts`, `SalaryPageInner.loadData` clone, `api/print-salary`, 5 report APIs, 8 page files, 2 SQL RPCs, `gemini-tools.ts`. **v2 me koi refactor nahi** — hours view in sab se INDEPENDENT hai.                                                                                  |
| Attendance engine        | `computeDay()` (`src/lib/attendance-hours.ts`, 14 tests): real `time_out` wins; past-day auto-close at `duty_end` (grace 15m, `ot_min = 0`); live duty → live minutes. `attendance_list` me `worked_min/ot_min/duty_min/is_auto_closed` (derived cols, audit only — readers compute live). |
| Duty                     | `staff_duty_schedule` (append-only, `effective_from`) → biz fallback (`system_info.biz_open/biz_close`) → `DEFAULT_DUTY` (10:00–20:00, break 0 = 600 min). `dutyMinutes()` break-subtracted, overnight-aware (`src/lib/duty.ts`).                                                          |
| OT                       | `ot_min` sirf report tooltip me dikhta hai — **kahin pay nahi hota**. v2 me OT premium NAHI (deferred).                                                                                                                                                                                    |
| Payout flow              | `advance_payments` insert — v2 me **bilkul untouched**.                                                                                                                                                                                                                                    |
| Data quality             | Purane PHP-era rows me `time_in` NULL bahut zyada (~1055 `time_out IS NULL` rows, mostly punch-less) → strict hours math unhe ₹0 dega → **D2 fallback zaroori**.                                                                                                                           |
| Status rule              | `<6h = Half Day` (`dateUtils.ts:164-172`, PHP parity) — sirf day-rule/fallback me use; hours branch status-independent.                                                                                                                                                                    |

**Golden rule (DATA_MIGRATION_NOTES):** _PURANA DATA PURANE RULES SE PADHO_ —
isliye punch-less rows par day-rule fallback = purana data purane rule par. ✅

---

## 2. Goals / Non-goals

**Goals**

- H-G1: Hours view: per-staff **per-minute rate** (`daily_salary ÷ dutyMin`), day-wise
  worked minutes + earned, month total, day-mode ke saath **delta (Δ)**.
- H-G2: Existing day-mode system **zero touch** (regression risk = 0; rollback = route delete).
- H-G3: **Zero DB writes** — schema/system_info/localStorage sab off; view 100% read-only.
- H-G4: Engine parity — `workedMin`/`dutyMin` wahi `computeDay()` + `dutyFor()` jo
  MonthlyReport/DailyAttendance dikhta hai (display ↔ view me mismatch nahi).
- H-G5: Punch-less legacy rows → day-rate fallback + ⚠ badge (koi staff ₹0 nahi dikhega).

**Non-goals (v1)**

- Mode persistence / mode flag / per-staff switch (kuch store hi nahi hota —
  decision insaan karta hai dono columns dekh kar).
- Payout flow, commission, advances, old-balance (dono modes me identical → scope out).
- OT premium, 15-min slab, safety floor, status auto-derive (P5), `salary-core` refactor,
  print-salary mode-awareness, dashboard RPC parity.
- DB migration ya `system_info` key (jab actual payroll switch ki zarurat padegi — tab
  persistence decision fir se; **abhi advisory phase**).

---

## 3. Formula & Design

### 3.1 Core

```
perMinRate = daily_salary_effective(date) ÷ dutyMin(us din)
hoursEarned(day) = perMinRate × workedMin
dayRuleEarned(day) = status===1 ? rate : status===3 ? rate/2 : 0    // EXISTING rule
monthHours = Σ resolve(hoursEarned | dayRule fallback)
monthDay   = Σ dayRuleEarned                                        // compare column
Δ = monthHours − monthDay
```

- Rate: effective-dated `getRate` pattern (ledger pages ki tarah **local copy** —
  `server-salary.ts:68-76` private hai; precedent: `mechanics/ledger/[id]` khud banata hai).
- `dutyMin`: `computeDay` ka duty context (`dutyFor(sched, date, bizDuty)`) — DIN-wise
  (duty schedule badle to rate bhi badle — fair).
- **Denominator guard:** `dutyMin ≤ 0` → 600 (DEFAULT_DUTY) fallback + note.

### 3.2 Parity proofs (isliye duty-derived denominator)

| Scenario                              | Day mode | Hours mode                            | Δ      |
| ------------------------------------- | -------- | ------------------------------------- | ------ |
| Full duty ya auto-close (worked=duty) | rate     | `duty × (rate/duty)` = **exact rate** | **₹0** |
| Late-in 1h                            | rate     | `rate × 5/6`                          | −₹     |
| 4h kaam (half mark)                   | 0.5×rate | `rate × 4h/duty`                      | ±      |
| Real checkout late (ot 60m)           | rate     | `rate × (duty+60)/duty` (OT paid!)    | +₹     |
| Absent / no row                       | 0        | 0                                     | ₹0     |
| Present, punch MISSING                | rate     | **rate (D2 fallback)**                | **₹0** |

→ Normal din par **exact parity**, sirf real punch deviate hone par farak —
yahi user ka requirement hai. (v1 ka "punch-missing = 0" D2 se badal kar fallback hua.)

### 3.3 Punch-less fallback (D2)

```
if (time_in == NULL):
  status ∈ {1,3} → dayRuleEarned (full/half), mark usedFallback=true  // ⚠ badge
  else           → 0
else → hoursEarned (status koi bhi ho — engine-driven)
```

### 3.4 Rounding

- Per-day earned: `round2()` (money display consistent) → month total = Σ rounded days
  (jo dikhaya wahi joda — drift nahi).
- `perMinRate` internal float, display 3–4 decimal (₹0.8333/min) — full rate exact
  rehne ke liye.

---

## 4. Page / UX

**Route:** `/mechanics/salary/hours?month=YYYY-MM` (SSR wrapper, `requireStaff` parity,
month param `/^\d{4}-\d{2}$/` pattern copy)

```
┌ Hours Mode — October 2026              [CSV] [← Salary Report]
│ Coverage: 96% punched · 2 days → day-fallback (⚠)
├──────────────────────────────────────────────────────────────────
│ Staff   Daily₹  Duty  ₹/min   Worked  Hours-earned  Day-earned   Δ
│ Ramesh    500    10h  0.8333   255h     ₹12,750*     ₹13,000   −250
│ Suresh    600     9h  1.1111   248h     ₹12,444      ₹12,444      0
│                        * 2 punch-less days → day-rate used
├─ row expand → day drill-down
│  Date     In–Out      Duty  Worked  ₹/min   Earned  Note
│  01 Oct   10:02–20:00  10h   9h58m  .8333   ₹497    auto-close
│  05 Oct   —            —      —       —      ₹250    no-punch → day (₹)
│  07 Oct   11:00–16:30  10h   5h30m  .8333   ₹275    short day
```

- Coverage badge (punch %) + per-row fallback note.
- Δ column (₹ + optional %) = mode decision aid — **koi action/write nahi** (B5 mode
  switch buttons v1 me OUT — persistence forbidden).
- CSV: staff summary + per-day detail (client-side, `exportToCSV` pattern reuse).
- Commission/advance/old-balance dikhana NAHI (D4) — wage earning + delta sirf.

---

## 5. Files (all NEW — 1 optional line edit)

| File                                       | Kya                                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `src/lib/hours-salary.ts`                  | PURE: `perMinuteRate()`, `dayRuleEarned()`, `resolveDay()`, `buildHoursMonth()`, guards, types |
| `src/lib/hours-salary.test.ts`             | Parity + fallback + guard tests (§7)                                                           |
| `src/app/mechanics/salary/hours/page.tsx`  | SSR wrapper (`requireStaff`, month param, fetch + render view)                                 |
| `.../hours/components/HoursSalaryView.tsx` | Client UI: summary, coverage badge, drill-down, CSV                                            |
| `SalaryPageInner.tsx` (optional, +1 line)  | Header me "Hours view →" link — **agar user chahe tabhi; zero logic touch**                    |

Fetch helpers: naya `fetchHoursSalaryData(month)` page ke andar ya view me
(attendance rows + `loadDutyContext` + rates via `fetchAll` — G3 gate: cookie+RLS
`getServerSupabase()`, `getAdminSupabase()` page-reads me BANNED).

---

## 6. Phases & commits (har phase alag commit, gates green)

| Phase  | Kya                                                            | Gate                                                         |
| ------ | -------------------------------------------------------------- | ------------------------------------------------------------ |
| **H1** | `hours-salary.ts` pure lib + `hours-salary.test.ts`            | vitest new tests green + parity proof (full punch = exact ₹) |
| **H2** | Data fetch + route skeleton (`/mechanics/salary/hours`) SSR    | tsc/eslint; month param validation; empty state render       |
| **H3** | UI: summary + drill-down + coverage/fallback badges + CSV      | manual: 1 purana month open karke day totals se sanity Δ     |
| **H4** | Optional salary-page link + plan doc status update + TODO note | full gates: prettier/eslint touched + tsc + vitest 325+new   |

**Effort:** ~1 din. **Risk:** low (zero existing-file edits; rollback = delete route dir).

---

## 7. Testing plan

`hours-salary.test.ts` (pure — no I/O, no mocks needed):

- **Parity:** full punch (`workedMin === dutyMin`) → `hoursEarned === dailyRate` (exact).
- **Fallback:** `time_in NULL` + status 1 → full rate + `usedFallback`; status 3 → half;
  status 0/2 → 0.
- **Short/long:** worked < duty → pro-rata; worked > duty (real checkout) → > rate.
- **Guards:** `dutyMin ≤ 0` → 600 fallback; negative/NaN inputs sane.
- **Rounding:** per-day round2, month = Σ rounded (drift-free); perMinRate precision.
- **Month build:** mixed rows (punch, punch-less, absent, half) ke saath totals +
  Δ = hours − day.
- Integration (H2/H3): `computeDay` wiring — existing `attendance-hours.test.ts` cover
  engine; view-level sanity manual month check.

---

## 8. Rollout / expert advice

1. **Dry-run 1 mahina:** view ko advisory maano — asli payout tab tak day-mode se.
   1 month day-vs-hours Δ dekh kar hi decision ki hours model apnana hai ya nahi.
2. **Punch coverage = trust gate:** coverage < 100% par ⚠; legacy punch-era months me
   fallback chalta rahega (golden rule).
3. **Jab actual switch chahiye** (kuch staff hours par pay karne ho): tab persistence
   decision — `system_info` key vs naya table vs localStorage — **fir se plan hoga**
   (wo "no-DB" constraint todta hai, isliye v1 me hi lock nahi kiya).
4. **OT chhodo** (aaj kahin pay hota nahi) — OT premium = storage chahiye → deferred.
5. **Scope discipline (D4):** commission/advance dono mode me same → mode-decision
   sirf wage ka hai; net calc me involve karne se confusion badhega.

---

## 9. Open questions — RESOLVED (2026-10-13)

| v1 Q                         | v2 final                                                  |
| ---------------------------- | --------------------------------------------------------- |
| 1. OT multiplier             | **Deferred** (OT pay hi nahi hota aaj)                    |
| 2. Break paid/unpaid         | **Engine parity** — `dutyMin` me break already subtracted |
| 3. Mode effective date       | **N/A** — koi mode store hi nahi (advisory view)          |
| 4. Comparison page placement | **Separate route** `/mechanics/salary/hours` (D3)         |
| 5. Scope of mode-awareness   | **Wage-compare only** (D4)                                |
| 6. Pilot approach            | **Dry-run rollout** (§8.1)                                |

---

### Archive — v1 superseded items (ye v2 me NAHI honge)

- ❌ `mechanic_salary_mode_history` migration (P4b) — no-DB constraint.
- ❌ Mode dropdown UI (`MechanicsBody`/Rate Master), `salaryModeOn()`, mode badges,
  "mode=hours" print/Payout note, `Updated Salary Mode` activity log.
- ❌ `salary-core.ts` single-source refactor (G6) — existing copies untouched rahega;
  hours view ka apna pure lib.
- ❌ Comparison page ke mode-switch quick actions (B5), recommendation engine,
  safety floor, month-close snapshot, status auto-derive (P5).
- ❌ §10 Q3 (effective date) — store hi nahi.

### Cross-reference

- v1 superseded draft: git history of this file (pre-2026-10-13).
- `docs/ATTENDANCE_DUTY_HOURS_PLAN.md` §5/§6 — original P4/P5 spec (abhi parked).
- `docs/DATA_MIGRATION_NOTES.md` — golden rule (punch-less → purane rule).
- Engine: `src/lib/attendance-hours.ts` (`computeDay`, 14 tests) · duty: `src/lib/duty.ts`.
- Rate pattern: `getRate` (`server-salary.ts:68-76`).
- Reuse: `fetchAll` (PostgREST 1000 cap), `exportToCSV` pattern, month param (`page.tsx:18`).
