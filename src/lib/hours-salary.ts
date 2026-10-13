import { type AttRow, type NowInfo, computeDay } from "@/lib/attendance-hours";
import { DEFAULT_DUTY, type Duty, dutyMinutes, normTime } from "@/lib/duty";

export const FALLBACK_DUTY_MIN = dutyMinutes(DEFAULT_DUTY);

export type HoursDayNote = "fallback" | "unpaid" | "live" | "short" | "overtime" | "auto" | "full";

export type HoursDay = {
  date: string;
  status: number;
  hasPunch: boolean;
  timeIn: string | null;
  effOut: string | null;
  isAutoClosed: boolean;
  working: boolean;
  workedMin: number;
  dutyMin: number;
  perMinRate: number;
  hoursEarned: number;
  dayEarned: number;
  usedFallback: boolean;
  note: HoursDayNote;
};

export type HoursDayCtx = {
  row: AttRow;
  duty: Duty;
  rate: number;
  now: NowInfo;
};

export type HoursMonthInput = {
  rows: AttRow[];
  dutyFor: (date: string) => Duty;
  rateFor: (date: string) => number;
  now: NowInfo;
};

export type HoursStaffSummary = {
  currentRate: number;
  workedMin: number;
  punchedDays: number;
  eligibleDays: number;
  fallbackDays: number;
  hoursEarned: number;
  dayEarned: number;
  delta: number;
  coverage: number;
};

export type HoursMonthSummary = {
  totalHoursEarned: number;
  totalDayEarned: number;
  delta: number;
  totalWorkedMin: number;
  fallbackDays: number;
  staffCount: number;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const sumRound2 = (vals: number[]): number =>
  Math.round(vals.reduce((s, v) => s + Math.round(v * 100), 0)) / 100;

export function perMinuteRate(rate: number, dutyMin: number): number {
  const r = Number(rate);
  if (!isFinite(r) || r <= 0) return 0;
  const dm = Number(dutyMin);
  const den = isFinite(dm) && dm > 0 ? dm : FALLBACK_DUTY_MIN;
  return r / den;
}

export function dayRuleEarned(status: number, rate: number): number {
  const r = Number(rate);
  if (!isFinite(r) || r <= 0) return 0;
  if (status === 1) return round2(r);
  if (status === 3) return round2(r / 2);
  return 0;
}

export function resolveDay({ row, duty, rate, now }: HoursDayCtx): HoursDay {
  const c = computeDay(row, duty, now);
  const dutyMin = c.dutyMin > 0 ? c.dutyMin : FALLBACK_DUTY_MIN;
  const perMin = perMinuteRate(rate, dutyMin);
  const hasPunch = c.hasTimeIn;
  const dayEarned = dayRuleEarned(row.status, rate);

  let hoursEarned: number;
  let usedFallback = false;

  if (row.status === 2) {
    hoursEarned = 0;
  } else if (!hasPunch) {
    if (row.status === 1 || row.status === 3) {
      hoursEarned = dayEarned;
      usedFallback = true;
    } else {
      hoursEarned = 0;
    }
  } else {
    hoursEarned = round2(perMin * c.workedMin);
  }

  let note: HoursDayNote;
  if (row.status === 2) note = "unpaid";
  else if (!hasPunch) note = usedFallback ? "fallback" : "unpaid";
  else if (c.working) note = "live";
  else if (c.workedMin > c.dutyMin) note = "overtime";
  else if (c.workedMin < c.dutyMin) note = "short";
  else note = c.isAutoClosed ? "auto" : "full";

  return {
    date: row.curr_date,
    status: row.status,
    hasPunch,
    timeIn: normTime(row.time_in) || null,
    effOut: c.effOut,
    isAutoClosed: c.isAutoClosed,
    working: c.working,
    workedMin: c.workedMin,
    dutyMin,
    perMinRate: perMin,
    hoursEarned,
    dayEarned,
    usedFallback,
    note,
  };
}

export function buildHoursDays({ rows, dutyFor, rateFor, now }: HoursMonthInput): HoursDay[] {
  return [...rows]
    .sort((a, b) => a.curr_date.localeCompare(b.curr_date))
    .map((row) =>
      resolveDay({ row, duty: dutyFor(row.curr_date), rate: rateFor(row.curr_date), now })
    );
}

export function summarizeStaff(days: HoursDay[], currentRate: number): HoursStaffSummary {
  const eligible = days.filter((d) => d.status === 1 || d.status === 3);
  const punchedEligible = eligible.filter((d) => d.hasPunch).length;
  const hoursEarned = sumRound2(days.map((d) => d.hoursEarned));
  const dayEarned = sumRound2(days.map((d) => d.dayEarned));
  return {
    currentRate: round2(Number(currentRate) || 0),
    workedMin: days
      .filter((d) => d.hasPunch && d.status !== 2)
      .reduce((s, d) => s + d.workedMin, 0),
    punchedDays: punchedEligible,
    eligibleDays: eligible.length,
    fallbackDays: days.filter((d) => d.usedFallback).length,
    hoursEarned,
    dayEarned,
    delta: round2(hoursEarned - dayEarned),
    coverage: eligible.length === 0 ? 1 : punchedEligible / eligible.length,
  };
}

export function summarizeMonth(staff: HoursStaffSummary[]): HoursMonthSummary {
  const totalHoursEarned = sumRound2(staff.map((s) => s.hoursEarned));
  const totalDayEarned = sumRound2(staff.map((s) => s.dayEarned));
  return {
    totalHoursEarned,
    totalDayEarned,
    delta: round2(totalHoursEarned - totalDayEarned),
    totalWorkedMin: staff.reduce((s, x) => s + x.workedMin, 0),
    fallbackDays: staff.reduce((s, x) => s + x.fallbackDays, 0),
    staffCount: staff.length,
  };
}
