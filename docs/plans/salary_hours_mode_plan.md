# Salary Mode Plan — Day-wise vs Working-Hours (per-staff) + Comparison Page

> **Status: PLAN ONLY (2026-10-03) — implementation gated, user approval pending.**
> `ATTENDANCE_DUTY_HOURS_PLAN.md` ke P4/P5 ka vistar + naye requirement:
> per-staff mode selection + comparison page. **Abhi koi code nahi.**
>
> User requirement (2026-10-03):
>
> 1. Purana day-wise system **hamesha rahega** (full day = full rate, half = half,
>    absent = ₹0) — ise hatana nahi hai.
> 2. Naya option: salary **check-in/check-out ke actual hours/minutes** se nirdharit ho.
> 3. **Har staff ka apna mode** — koi staff purane tareeke se, koi naye tareeke se.
> 4. **Comparison page**: dono tareeko se banne wali salary ka antar detail me
>    (per-staff + per-day) explain kare.
> 5. P4/P5 baad me (jab salary system hours/minutes support kare) — sirf plan.

---

## 1. Current state (facts — 2026-10-03 research)

| Fact                      | Detail                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rate source               | `mechanic_list.daily_salary` (current) + `mechanic_salary_history` (effective-dated; `getRate` = latest `effective_date <= day`). `salary_per_day` column = dead legacy.                                                                                                                                                                               |
| Formula (page)            | `netTotal = oldBalance + earnedCurr + commission − advances`; `earnedCurr = Σ(status1 ? rate : rate/2)` over `attendance_list` rows `status ∈ {1,3}`. Absent/unmarked = ₹0 (query me aate hi nahi).                                                                                                                                                    |
| Salary persist nahi hoti  | No slip/payroll table — har render par recompute hoti hai.                                                                                                                                                                                                                                                                                             |
| Formula ke **15+ copies** | `server-salary.ts` (server), `SalaryPageInner.tsx loadData` (client clone), `api/print-salary`, 5 report APIs (`ledger/balancesheet/vyapar-darpan/print-ledger/print-mechanic-ledger`), 8 page files (`mechanics/[id]`, reports, dashboard), 2 SQL RPCs (`dashboard_summary` — **sirf `daily_salary`, history-aware NAHI**), `gemini-tools.ts` prompt. |
| Attendance engine data    | `attendance_list.worked_min, ot_min, duty_min, is_auto_closed` (live since 2026-10-02) + `time_in/time_out`. Engine (`attendance-hours.ts`): real out wins; auto-close me `ot_min = 0` hamesha.                                                                                                                                                        |
| OT                        | `ot_min` sirf report tooltip me dikhta hai — **kahin pay nahi hota**. `ot_multiplier`/`salary_mode` DB me exist NAHI karte.                                                                                                                                                                                                                            |
| Payout flow               | `advance_payments` insert (`reason: "Salary Payout for <Month>"`) — "month paid" flag kuch nahi. Payout dono modes me same rahega.                                                                                                                                                                                                                     |
| Status rule               | `<6h = Half Day` (`dateUtils.ts:164-172`, PHP parity). Status salary decide karta hai (day mode).                                                                                                                                                                                                                                                      |
| Data quality              | Purane (PHP-era) rows me `time_in` NULL bahut zyada (live DB me sirf `time_out IS NULL` par **1055** rows match — inme se mostly punch-less).                                                                                                                                                                                                          |
| Half-day sites            | `rate / 2` 15 jagah (upar wale copies) + 2 SQL RPCs.                                                                                                                                                                                                                                                                                                   |

**Golden rule (DATA_MIGRATION_NOTES):** _PURANA DATA PURANE RULES SE PADHO_ —
isliye mode fallback **`day`** = purana data automatically purane rule par.

---

## 2. Goals / Non-goals

**Goals**

- G1: Per-staff salary mode — `day` (legacy, default) | `hours` — dono saath-saath.
- G2: Hours mode = engine-driven (worked/OT minutes), status-independent.
- G3: Comparison page — dono modes ka month-wise + per-day delta, plain-language explanation.
- G4: Purana system untouched (day-mode staff ke liye ek bhi number na badle).
- G5: Historical months freeze — mode switch retroactively kabhi purane mahine na badle.
- G6: Ek hi formula implementation (15+ copies → 1 core) — warna per-staff mode jagah-jagah diverge.

**Non-goals (abhi)**

- Status auto-derive from hours (P5, gated alag).
- Cron / auto month-close / snapshot persistence.
- Per-hour explicit rate override, monthly-fixed salary, PF/Tax/deductions.
- PHP side changes.
- Dashboard SQL RPCs ki full parity (known divergence — Phase ke baad decide).

---

## 3. Design

### 3.1 Mode storage — effective-dated history (salary history ka same pattern)

```sql
-- Naya table (P4 migration)
create table public.mechanic_salary_mode_history (
  id            bigint generated always as identity primary key,
  mechanic_id   integer NOT NULL references public.mechanic_list(id),
  salary_mode   text NOT NULL check (salary_mode in ('day','hours')),
  effective_date date NOT NULL,
  created_at    timestamp without time zone NOT NULL default current_timestamp,
  unique (mechanic_id, effective_date)
);
-- RLS: rlslock pattern (is_frontend_staff) — upar ke migrations jaisa
-- Grants: authenticated SELECT/INSERT/DELETE (page writes client se)
```

**Mode resolution (golden rule ka implementation):**

```ts
// latest row with effective_date <= date; koi row na ho → "day" (legacy default)
function salaryModeOn(modeRows, dateStr): "day" | "hours";
```

- **No backfill** — koi row nahi → `day`. PHP-era history automatically day-mode. ✅
- Mode change = INSERT row (history append-only, `mechanic_salary_history` jaisa).
- **Default effective date = agle mahine ka 1st** (admin override allow, but UI warning
  ki past months badalne wale nahi hain — wo date rule se freeze hain).
- `mechanic_list` par koi naya column nahi (join pattern same as salary history —
  `fetchSalaryReportData` pehle se 2 bucket queries karta hai, ye 3rd batch query).

**Why history table (sirf column kyu nahi):** G5 — agar sirf current column hota to
mode switch karne par pichhle 5 mahine ki salary apne aap recompute hoti (retroactive
change — forbidden). `effective_date` freeze karta hai.

### 3.2 Hours-mode formula (recommended: pro-rata "day-equivalent")

```ts
// Har row (date) ke liye — dono rates existing getRate() se (history-aware)
dutyMin  = engine duty us din (staff_duty_schedule history → biz fallback, break-adjusted)
hourly   = daily_salary_effective(date) / (dutyMin / 60)      // per-day derive
regular  = workedMin − otMin        // engine se (otMin sirf real checkout par)
earn_day = (regular / 60) * hourly
         + (otMin / 60) * hourly * ot_multiplier              // otMultiplier (default 1.0)
// time_in NULL ya koi row hi nahi → earn_day = 0
```

**Parity proofs (isliye ye formula choose kiya):**

| Scenario                              | Day mode           | Hours mode                            | Antarr                                 |
| ------------------------------------- | ------------------ | ------------------------------------- | -------------------------------------- |
| Full duty (auto-close, worked = duty) | rate               | `duty/60 × rate/(duty/60)` = **rate** | **₹0**                                 |
| Late-in 1h (worked = duty − 60m)      | rate (full!)       | `rate × 5/6` = 0.83×rate              | −₹ (yahi chahiye tha)                  |
| 4h kaam (day me Half mark)            | 0.5×rate           | `rate × 4/9` = 0.44×rate              | −₹33 (rate 600 par)                    |
| Real checkout 1h late (ot 60m)        | rate (OT pay NAHI) | rate + `60/60 × hourly × mult`        | +OT benefit                            |
| Absent / no row                       | 0                  | 0                                     | ₹0                                     |
| Present mark, punch MISSING           | rate               | **0**                                 | ⚠️ huge — isi liye guard chahiye (3.5) |

→ **Auto-close wale din dono mode me BILKUL same** (auto `ot=0` ki wajah se).
Antarr sirf tab aata jab asli punch deviate kare — exactly user ka requirement.

**Rounding:** compute float me (existing style), display 2-dp (`inr()`).
Minutes integer hain to log deterministic hai. (15-min slab = optional later, §7.4.)

**Break rule (decision, recommended):** engine ka `workedMin`/`dutyMin` jo report
tooltip dikhata hai wahi salary lega — **display ↔ payout me kabhi mismatch nahi**.
(Agla verify: `computeDay` break ke saath kya karta hai — implement ke waqt test lock karenge.)

### 3.3 Day mode = EXACTLY current code (untouched)

`rate` if status1 else `rate/2`, `status ∈ {1,3}` query — copy-paste same.
Day-mode staff ke liye G4 guaranteed (dono formulas alag functions, ek dusre ko chhuein nahi).

### 3.4 Common net formula (dono modes same skeleton)

```
netTotal = oldBalance + earnedCurr + commission − advances
```

- **Commission / advances / payout: IDENTICAL** in both modes.
- `oldBalance` ki purani rows bhi **per-row `salaryModeOn(curr_date)`** se compute
  (mode switch ke baad bhi purane din freeze ✓).
- `earnedCurr` = Σ `earn_day(row, modeOn(date))` — mode `day` → G3 ki branch,
  mode `hours` → §3.2.

### 3.5 Config knobs

| Knob                  | Kahan                                | Default                                         | Note                                                                         |
| --------------------- | ------------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `salary_mode` per row | `mechanic_salary_mode_history`       | `day` (fallback)                                | G1                                                                           |
| `ot_multiplier`       | `system_info` (global)               | `1.0` (koi bonus nahi — user 1.5 chahe to flag) | Hours mode me hi lagta hai; day mode OT kabhi nahi (legacy)                  |
| Rate                  | `mechanic_salary_history` (existing) | —                                               | hourly yahi se derive — **alag hourly column nahi** (rate change sirf jagah) |

### 3.6 Mode switch workflow (UI)

1. Staff Add/Edit modal (`MechanicsBody`) + Rate Master me naya dropdown:
   **"Salary Calculation: Day-wise (default) | Working hours"**.
2. Save → INSERT `mechanic_salary_mode_history` (effective = **agle 1st** default;
   "immediate" option with red warning).
3. `logActivity("Updated Salary Mode", "Mechanics", mechanic_id, details)` —
   modern-era convention (`meta_id = mechanic_list.id`).
4. Confirmation dialog me **chhota preview**: is mahine day=₹X vs hours=₹Y (comparison
   engine reuse) — admin ko pata ho kya badal raha hai.

### 3.7 Data-quality guard (hours mode ka safety net)

Purane din me punch NULL → hours mode ₹0 de dega. Guard:

- **Punch coverage** per staff-month = `(rows with time_in) / (rows status ∈ {1,3})`.
- Comparison page + salary report: coverage < 100% par banner:
  _"Rahul ke is mahine me 26 present-din me se 4 par punch nahi — hours mode me
  wo 4 din ₹0 lenge."_
- Mode switch dialog me bhi coverage check: agar month hi punch-era se purana hai
  → **"Is staff ke liye hours mode reliable nahi (punch data nahi)"** block-style warning.

---

## 4. Single source of truth (P4a — prerequisite refactor)

15+ formula copies me per-staff mode deny = guaranteed divergence. Plan:

```
src/lib/salary-core.ts          ← PURE functions, koi I/O nahi (test-friendly)
  type SalaryMode = "day" | "hours"
  salaryModeOn(modeRows, date): SalaryMode
  earnDay({status,time_in...}, mode, {rate, dutyMin, otMin, otMultiplier}): number
  computeEarnedMonth(rows, ctx): { byDay..., total }   // dono modes ek me
  computeNet({earned, commission, advances}): number   // shared skeleton
```

- **Consumers (P4a me convert):** `server-salary.ts`, `SalaryPageInner.loadData`
  (clone hatao — ya client ko server se ek hi source bhejo), `api/print-salary`.
- **Consumers (baad me, flagged):** 5 report APIs + 8 pages (pehle day-mode fixed
  results, mode-aware tab jab zarurat), SQL RPCs (dashboard KPI — **abhi knowingly
  divergent**, note §7.6), `gemini-tools` prompt.
- TDD: `salary-core.test.ts` — parity cases (§3.2 table) + golden fixtures
  (existing month ka day-mode number BEFORE/AFTER refactor same aana chahiye —
  **regression fixture from live DB**).

---

## 5. Comparison page (user requirement #4)

**Route:** `/mechanics/salary/compare?month=YYYY-MM`
(Salary page header me "Compare modes" button; alag route taaki print/CSV/URL share easy.
Alternative: Salary page ki 3rd tab — §10 Q4.)

**Layout:**

```
┌─ KPIs ────────────────────────────────────────────────────────────┐
│ Staff jinka mode=hours: 2  │  Day total ₹1,42,300                 │
│ Hours total ₹1,38,940      │  Δ −₹3,360 (−2.4%)  │  Upar: 1  Neeche: 2 │
├─ Table (sortable, search, filter: all/up/down/same) ─────────────┤
│ Staff    Mode   Day ₹     Hours ₹    Δ ₹     Δ%   Punch%  Action │
│ Rahul    day    15,000    14,240     −760    −5%   100%    [Try hours] │
│ Hemant   hours  12,600    12,600       0      0%  100%    [day pe wapas]│
│ Preeti   day     9,300    10,050    +750    +8%    92%  ⚠ punch missing │
├─ Row expand → per-day drill-down ────────────────────────────────┤
│ Date      Status   In→Out      Worked Duty OT │ Day ₹  Hours ₹  Δ ₹ │
│ 01 Sep    P        09:12→19:00  588m  540m 48m │ 600.00  653.33 +53 │
│ 02 Sep    P        10:30→18:00  450m  540m  0m │ 600.00  500.00 −100 │
│ 03 Sep    H        11:00→15:00  240m  540m  0m │ 300.00  266.67 −33 │
│ 04 Sep    P        (punch nahi)   —     —    — │ 600.00    0.00 −600 │
│ Explanation (plain Hindi): "Preeti ne 18 din 9h poori kiya (dono same),│
│  4 din late-in/early-out → hours me ₹X kam; 4 din punch missing → ₹0."│
└──────────────────────────────────────────────────────────────────┘
```

**Features:**

- **B1:** Dono totals per staff + grand total + delta (₹, %).
- **B2:** Per-day drill-down (rows ka split) — "detail me explain" ✓.
- **B3:** Auto **insight line** per staff (creativity): rules se Hindi sentence —
  _"avg worked 8.4h vs 9h duty → −7% ; OT 2.3h → +₹140"_.
- **B4:** Punch-coverage % + ⚠ badge (§3.7).
- **B5:** Mode-aware quick actions: `[Day par rakhein] [Hours par rakhein]`
  → §3.6 flow (default effective = agla 1st).
- **B6:** CSV export (staff summary + per-day detail sheet-like sections).
- **B7:** Kisi bhi **purane mahine** par bhi chalega (both formulas derived hain) —
  punch-era warning ke saath.
- **B8:** Page pure READ hai — koi write nahi (sirf mode-change action likhta hai).

**Pehla use-case:** flip se pehle 1-2 historical months dry-run karke dekho →
phir staff-wise mode decide (rollout §7.1).

---

## 6. UI changes (implement scope list)

| #   | Jagah                              | Kya                                                                                                          |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| U1  | `MechanicsBody` staff modal        | Salary mode dropdown + help text                                                                             |
| U2  | `SalaryPageInner` Rate Master      | Mode column + inline edit (effective date wala modal)                                                        |
| U3  | `SalaryPageInner` Report           | Row badge `Day`/`Hours`; hours staff ke liye columns: `hours worked`, `OT h` (extra, tab jabh mode=hours ho) |
| U4  | Salary header                      | "Compare modes" button → §5 route                                                                            |
| U5  | Print salary (`/api/print-salary`) | Mode badge + hours-summary line (total h, OT h)                                                              |
| U6  | Payout modal                       | (same) — sirf note `mode=hours` display                                                                      |
| U7  | Comparison page                    | §5 (naya)                                                                                                    |
| U8  | Activity log                       | `Updated Salary Mode` action (module `Mechanics`)                                                            |

**Slip me naya:** `Mode: Working hours · 212h worked · 6h OT · rate ₹66.67/h`

---

## 7. Creative options (meri suggestions — optional, ranked)

1. **Dry-run rollout (recommended):** P4 ke baad pehle 1 mahina — sab staff day par
   rakhe kar comparison page se "kaun hours se better fit" identify (variance > ±5%
   - punch 100%), phir top-2 staff pilot, phir spread. Sudden sab switch mat karo.
2. **Recommendation engine (light):** Compare page row par auto-tag —
   `💡 Hours recommended` jab |Δ| ≥ 5% aur punch coverage = 100%; `⚠ Punch fix pehle`
   jab coverage < 100%. Admin ko decision 1 click me.
3. **Safety floor (defensive, optional):** `mechanic_salary_mode_history` ke saath
   ek `min_monthly_floor` (nullable) — hours mode me month total floor se neeche
   jaaye to floor par cap. (Staff protection; complexity +1 — default OFF/NULL.)
4. **Roundings:** v1 = exact minutes, 2-dp rupees. Option later: **15-min slab**
   (`Math.round(min/15)*15`) taaki chhote punch-bounce ka delta na dikhe.
5. **Month-close snapshot (future P6 idea):** payout karte hi `salary_slips` table me
   frozen row (mode, totals, inputs JSON) — audit + "ye slip permanently paid" flag.
   Abhi zarurat nahi (recompute deterministic hai), par payout-id se link karne ka plan.
6. **Dashboard RPC divergence:** `dashboard_summary` RPC abhi `daily_salary` (history
   unaware) use karta hai — pehle se ek known mismatch. P4 ke baad decide:
   dashboard KPI ko `salary-core` se parity (RPC update) ya "approx KPI" label.
7. **Hindi insight generator (§5 B3)** — comparison samjhane ka sabse asardaar tarika;
   rules template-based (no AI dependency), testable.

---

## 8. Phases & commits (har phase alag commit, gates green)

| Phase                | Kya                                                                                                                                                       | DB           | Gate                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------- |
| **P4a**              | `salary-core.ts` (pure) + tests + **golden fixture regression** (purane month ke numbers same); `server-salary` + `SalaryPageInner` + print route convert | —            | vitest + manual: purana month EXACT same ₹          |
| **P4b**              | `mechanic_salary_mode_history` migration + `salaryModeOn` + U1/U2/U8 (mode setting UI)                                                                    | ✅ migration | mode switch se day-mode staff ke numbers na badle   |
| **P4c**              | Hours branch (§3.2) + salary report/CSV/print mode-aware (U3/U5/U6) + coverage guard (§3.7)                                                               | —            | hours staff ka report = hand-computed proof         |
| **P4d**              | Comparison page (§5, U4/U7) + insights + CSV                                                                                                              | —            | dono modes ka total = report totals se match        |
| **P5** (alag, gated) | Status auto-derive from hours (`worked ≥ duty → P`, `≥ duty/2 → H`, `else short-day`, `no row → A`) + optional cron                                       | —            | explicit go; sirf day-mode display rule badalta hai |
| Later                | 5 report APIs + 8 pages + SQL RPC parity + snapshot (§7.5-7.6)                                                                                            | —            | decide-on-need                                      |

**P4/P5 ki entry condition:** user ka explicit "go" (abhi PLAN ONLY).
**Rollback:** mode history rows delete → sab `day` fallback (data nahi bigadta).

---

## 9. Testing plan

- `salary-core.test.ts`: §3.2 parity table (auto-close = equal, late-in delta,
  half-day pro-rata, OT multiplier, punch-missing = 0), `salaryModeOn` fallback/date
  edges, net formula shared path.
- **Golden regression:** live DB se ek purane month ka `SalaryRecord[]` fixture →
  refactor se pehle/baad me serialize-compare (exactly equal).
- Comparison page tests (RTL): totals match components, coverage warning render,
  drill-down expand, filter up/down.
- Mode switch: INSERT + activity log + effective-date default (next 1st).
- SQL: migration idempotent + RLS lock pattern + grants (upar ke migrations jaisa).

---

## 10. Open questions (implementation se pehle jawab chahiye)

1. **OT multiplier default:** `1.0` (bonus nahi) ya `1.5` (plan doc ka purana sujhav)?
   Global `system_info` me rakhun?
2. **Break paid/unpaid:** hours pay me schedule `break_minutes` subtract hona
   chahiye (unpaid) ya engine `workedMin` jaisa as-is (paid)? _(Recommend: engine
   parity — jo dikhe wahi mile.)_
3. **Mode effective date:** default "agle 1st" theek? "Immediate" option chahiye
   (warning ke saath)?
4. **Comparison page placement:** alag route `/mechanics/salary/compare`
   _(recommended)_ ya Salary page ki 3rd tab?
5. **Scope of mode-awareness:** P4 me sirf salary page + print + CSV _(recommended)_,
   ya reports/dashboard APIs bhi usi sprint me?
6. **Pilot approach:** §7.1 dry-run rollout manzoor, ya sab staff ek saath?

---

### Cross-reference

- `docs/ATTENDANCE_DUTY_HOURS_PLAN.md` §5/§6 — P4/P5 original spec (ye doc uska
  supersede/expand hai: global `system_info.salary_mode` ki jagah **per-staff
  history table**, comparison page add).
- `docs/DATA_MIGRATION_NOTES.md` — golden rule (fallback `day`), activity_logs
  modern convention (module `Mechanics`, `meta_id = mechanic_list.id`).
- Engine: `src/lib/attendance-hours.ts`, derived cols migration `20261002`.
- Rate pattern: `mechanic_salary_history` + `getRate` (`server-salary.ts:68-76`).
