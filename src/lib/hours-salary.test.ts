import { describe, it, expect } from "vitest";
import {
  FALLBACK_DUTY_MIN,
  buildHoursDays,
  dayRuleEarned,
  perMinuteRate,
  resolveDay,
  summarizeMonth,
  summarizeStaff,
  type HoursDay,
} from "@/lib/hours-salary";
import type { AttRow, NowInfo } from "@/lib/attendance-hours";
import { type Duty } from "@/lib/duty";

const DAY_DUTY: Duty = { start: "10:00", end: "20:00", breakMinutes: 0 }; // 600 min
const SHORT_DUTY: Duty = { start: "10:00", end: "19:00", breakMinutes: 0 }; // 540 min

const row = (over: Partial<AttRow> = {}): AttRow => ({
  curr_date: "2026-10-01",
  status: 1,
  time_in: "10:00:00",
  time_out: "20:00:00",
  ...over,
});

const now = (date: string, hhmm: string): NowInfo => ({
  date,
  mins: Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)),
});

const futureNow = now("2026-11-05", "12:00");

const day = (over: Partial<AttRow>, rate = 500, duty: Duty = DAY_DUTY, n = futureNow) =>
  resolveDay({ row: row(over), duty, rate, now: n });

describe("perMinuteRate", () => {
  it("daily ÷ duty = per-minute rate", () => {
    expect(perMinuteRate(500, 600)).toBeCloseTo(0.8333333, 6);
    expect(perMinuteRate(600, 540)).toBeCloseTo(1.1111111, 6);
  });

  it("dutyMin ≤ 0 (0 / negative / NaN) → DEFAULT_DUTY 600 fallback", () => {
    expect(FALLBACK_DUTY_MIN).toBe(600);
    expect(perMinuteRate(500, 0)).toBeCloseTo(500 / 600, 6);
    expect(perMinuteRate(500, -30)).toBeCloseTo(500 / 600, 6);
    expect(perMinuteRate(500, NaN)).toBeCloseTo(500 / 600, 6);
  });

  it("rate ≤ 0 ya invalid → 0", () => {
    expect(perMinuteRate(0, 600)).toBe(0);
    expect(perMinuteRate(-10, 600)).toBe(0);
    expect(perMinuteRate(NaN, 600)).toBe(0);
  });
});

describe("dayRuleEarned — existing day-mode rule (status 1 = full, 3 = half)", () => {
  it("status 1 → full rate, 3 → half, 0/2 → 0", () => {
    expect(dayRuleEarned(1, 500)).toBe(500);
    expect(dayRuleEarned(3, 500)).toBe(250);
    expect(dayRuleEarned(0, 500)).toBe(0);
    expect(dayRuleEarned(2, 500)).toBe(0);
  });

  it("garbage rate → 0", () => {
    expect(dayRuleEarned(1, 0)).toBe(0);
    expect(dayRuleEarned(1, -500)).toBe(0);
    expect(dayRuleEarned(1, NaN)).toBe(0);
  });
});

describe("resolveDay — parity proofs (plan §3.2)", () => {
  it("full punch (10:00→20:00, duty 600) → EXACTLY daily rate, day se Δ 0", () => {
    const d = day({});
    expect(d.workedMin).toBe(600);
    expect(d.hoursEarned).toBe(500);
    expect(d.dayEarned).toBe(500);
    expect(d.usedFallback).toBe(false);
    expect(d.note).toBe("full");
  });

  it("auto-close past day (in 10:00, no out) → exact rate, note auto", () => {
    const d = day({ time_out: null });
    expect(d.workedMin).toBe(600);
    expect(d.hoursEarned).toBe(500);
    expect(d.note).toBe("auto");
  });

  it("late-in auto (10:05) → pro-rata shortfall (495.83), day mode full se kam", () => {
    const d = day({ time_in: "10:05:00", time_out: null });
    expect(d.workedMin).toBe(595);
    expect(d.hoursEarned).toBe(495.83);
    expect(d.dayEarned).toBe(500);
  });

  it("short real day (11:00→16:30 = 330m) → 275", () => {
    const d = day({ time_in: "11:00:00", time_out: "16:30:00" });
    expect(d.workedMin).toBe(330);
    expect(d.hoursEarned).toBe(275);
    expect(d.note).toBe("short");
  });

  it("real late checkout (10:00→21:00 = 660m) → OT included → 550, note overtime", () => {
    const d = day({ time_out: "21:00:00" });
    expect(d.workedMin).toBe(660);
    expect(d.hoursEarned).toBe(550);
    expect(d.note).toBe("overtime");
  });

  it("live duty (abhi 15:00, in 10:00) → 300m → 250, note live", () => {
    const d = day({ time_out: null }, 500, DAY_DUTY, now("2026-10-01", "15:00"));
    expect(d.workedMin).toBe(300);
    expect(d.hoursEarned).toBe(250);
    expect(d.note).toBe("live");
  });
});

describe("resolveDay — punch-less fallback (D2, legacy rows)", () => {
  it("status 1, no punch → day rate full + usedFallback + note fallback", () => {
    const d = day({ time_in: null, time_out: null });
    expect(d.hasPunch).toBe(false);
    expect(d.hoursEarned).toBe(500);
    expect(d.dayEarned).toBe(500);
    expect(d.usedFallback).toBe(true);
    expect(d.note).toBe("fallback");
  });

  it("status 3, no punch → half rate fallback", () => {
    const d = day({ status: 3, time_in: null, time_out: null });
    expect(d.hoursEarned).toBe(250);
    expect(d.usedFallback).toBe(true);
  });

  it("status 0 / 2, no punch → 0, note unpaid", () => {
    expect(day({ status: 0, time_in: null, time_out: null }).hoursEarned).toBe(0);
    const absent = day({ status: 2, time_in: null, time_out: null });
    expect(absent.hoursEarned).toBe(0);
    expect(absent.note).toBe("unpaid");
  });
});

describe("resolveDay — status edges", () => {
  it("status 2 (admin absent) WITH full punch → dono mode 0 (admin override)", () => {
    const d = day({ status: 2 });
    expect(d.hoursEarned).toBe(0);
    expect(d.dayEarned).toBe(0);
    expect(d.note).toBe("unpaid");
  });

  it("status 0 WITH punch → engine-driven (hours me paisa, day me 0)", () => {
    const d = day({ status: 0, time_in: "11:00:00", time_out: "16:30:00" });
    expect(d.hoursEarned).toBe(275);
    expect(d.dayEarned).toBe(0);
  });

  it("status 3 WITH punch → engine-driven, half-rule se alag", () => {
    const d = day({ status: 3, time_in: "10:00:00", time_out: "14:00:00" });
    expect(d.hoursEarned).toBe(200);
    expect(d.dayEarned).toBe(250);
    expect(d.usedFallback).toBe(false);
  });
});

describe("buildHoursDays — month wiring", () => {
  it("rows sorted by date; rateFor/dutyFor per date lagte hain", () => {
    const rates: Record<string, number> = { "2026-10-01": 500, "2026-10-20": 600 };
    const duties: Record<string, Duty> = { "2026-10-01": DAY_DUTY, "2026-10-20": SHORT_DUTY };
    const days = buildHoursDays({
      rows: [row({ curr_date: "2026-10-20" }), row({ curr_date: "2026-10-01" })],
      dutyFor: (d) => duties[d],
      rateFor: (d) => rates[d],
      now: futureNow,
    });
    expect(days.map((d) => d.date)).toEqual(["2026-10-01", "2026-10-20"]);
    expect(days[0].perMinRate).toBeCloseTo(500 / 600, 6);
    expect(days[1].perMinRate).toBeCloseTo(600 / 540, 6);
    expect(days[1].workedMin).toBe(600);
    expect(days[1].hoursEarned).toBe(666.67);
    expect(days[1].note).toBe("overtime");
  });

  it("rate change mid-month → purane din purane rate par (effective-dated)", () => {
    const days = buildHoursDays({
      rows: [row({ curr_date: "2026-10-01" }), row({ curr_date: "2026-10-20" })],
      dutyFor: () => DAY_DUTY,
      rateFor: (d) => (d < "2026-10-16" ? 500 : 600),
      now: futureNow,
    });
    expect(days[0].hoursEarned).toBe(500);
    expect(days[1].hoursEarned).toBe(600);
  });
});

describe("rounding — no drift", () => {
  it("0.8333... × 330 do baar → 275 + 275 = 550 exact", () => {
    const days = [
      day({ time_in: "11:00:00", time_out: "16:30:00" }),
      day({ time_in: "11:00:00", time_out: "16:30:00" }),
    ];
    const s = summarizeStaff(days, 500);
    expect(s.hoursEarned).toBe(550);
    expect(s.dayEarned).toBe(1000);
    expect(s.delta).toBe(-450);
  });
});

describe("summarizeStaff / summarizeMonth", () => {
  const days: HoursDay[] = [
    day({}), // full punch → 500
    day({ time_in: null, time_out: null }), // fallback → 500
    day({ status: 3, time_in: null, time_out: null }), // fallback half → 250
    day({ status: 2 }), // absent → 0
    day({ status: 0, time_in: "11:00:00", time_out: "16:30:00" }), // punch, day 0 → 275
  ];

  it("staff summary: totals + coverage + fallback count", () => {
    const s = summarizeStaff(days, 500);
    expect(s.hoursEarned).toBe(1525);
    expect(s.dayEarned).toBe(1250);
    expect(s.delta).toBe(275);
    expect(s.eligibleDays).toBe(3); // status 1,1,3
    expect(s.punchedDays).toBe(1);
    expect(s.coverage).toBeCloseTo(1 / 3, 6);
    expect(s.fallbackDays).toBe(2);
    expect(s.workedMin).toBe(600 + 330); // punch wale (status ≠ 2)
    expect(s.currentRate).toBe(500);
  });

  it("eligible 0 → coverage 1 (koi paid day hi nahi)", () => {
    const s = summarizeStaff([], 0);
    expect(s.coverage).toBe(1);
    expect(s.hoursEarned).toBe(0);
    expect(s.eligibleDays).toBe(0);
  });

  it("month summary = staff totals ka sum", () => {
    const a = summarizeStaff(days, 500);
    const b = summarizeStaff([day({})], 500);
    const m = summarizeMonth([a, b]);
    expect(m.totalHoursEarned).toBe(2025);
    expect(m.totalDayEarned).toBe(1750);
    expect(m.delta).toBe(275);
    expect(m.staffCount).toBe(2);
    expect(m.fallbackDays).toBe(2);
    expect(m.totalWorkedMin).toBe(a.workedMin + 600);
  });
});
