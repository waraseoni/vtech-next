// ============================================================================
// attendance-hours.ts — working-hours / auto-checkout / OT engine (P3)
//
// docs/ATTENDANCE_DUTY_HOURS_PLAN.md §4 — ek hi pure helper jise report,
// daily view, modal aur (P4 me) salary sab use karein.
//
// Rules (§4.2):
//   1. Real time_out hai → HAMESHA wahi (auto-checkout kabhi override nahi).
//   2. time_in hi nahi (manual status row) → kuch compute nahi, status as-is.
//   3. Past day YA now >= duty_end + grace → duty_end auto-checkout
//      (staff ki duty priority; biz_close sirf duty fallback hai).
//   4. Abhi duty chal rahi hai → effOut = null ("live working").
//
// OT rule (§4.2): auto-closed day = 0 OT — proof nahi ki staff duty ke baad
// raha tha. Sirf ACTUAL late checkout par OT.
//
// Pure (koi supabase/Date.now nahi — `now` caller deta hai) → fully testable.
// ============================================================================

import { nowISTTime, todayIST } from "@/lib/dateUtils";
import { type Duty, dutyMinutes, normTime, toMins } from "@/lib/duty";

/** duty_end ke itni der baad tak checkout na ho to auto-close. */
export const AUTO_CLOSE_GRACE_MIN = 15;

/** attendance_list ki ek row (sirf jo compute ke liye chahiye). */
export type AttRow = {
  curr_date: string; // "YYYY-MM-DD"
  status: number; // 0/1/2/3 (sirf context; compute me use nahi hota)
  time_in: string | null; // "HH:MM:SS"
  time_out: string | null;
};

/** Ab ka waqt (IST): date + minutes-since-midnight. */
export type NowInfo = { date: string; mins: number };

export type DayHours = {
  hasTimeIn: boolean;
  /** Effective checkout "HH:MM" — real ya auto (duty_end). null = abhi kaam par. */
  effOut: string | null;
  isAutoClosed: boolean;
  /** Abhi bhi kaam par (time_in hai, checkout nahi hua, duty abhi khatam nahi). */
  working: boolean;
  workedMin: number; // live minutes jab working
  dutyMin: number;
  otMin: number; // auto-closed = hamesha 0
  lateInMin: number;
  earlyOutMin: number;
};

/** Aaj ka IST waqt — `now` argument banane ka standard tareeka. */
export const nowIST = (): NowInfo => {
  const mins = toMins(nowISTTime());
  return { date: todayIST(), mins: isNaN(mins) ? 0 : mins };
};

/** Duty overnight hai? (22:00 → 06:00) */
const isOvernight = (duty: Duty): boolean => normTime(duty.end) < normTime(duty.start);

/**
 * Clock time → duty timeline ke minutes (curr_date midnight = 0).
 * Overnight duty me, duty start se pehle ka clock time (yaani next-day wala
 * `00:15`) agle din aata hai → +1440.
 */
const offsetFor = (t: string, duty: Duty): number => {
  const m = toMins(t);
  if (isNaN(m)) return NaN;
  const start = toMins(duty.start);
  return isOvernight(duty) && m < start ? m + 1440 : m;
};

/** "YYYY-MM-DD" difference (b - a) in days. */
const dayDiff = (a: string, b: string): number => {
  const num = (s: string) =>
    Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  const na = num(a);
  const nb = num(b);
  if (isNaN(na) || isNaN(nb)) return 0;
  return Math.round((nb - na) / 86400000);
};

/** timeline offset → "HH:MM" (next-day ko 24h me wrap). */
const fmtOffset = (off: number): string => {
  const m = ((off % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** minutes → "5h 44m" (0/negative → "—"). PHP `attendance_hours_str` mirror. */
export const fmtMins = (mins: number): string => {
  if (!isFinite(mins) || mins <= 0) return "—";
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

/**
 * Din ka working-hours compute karo (auto-checkout + OT rules samet).
 *
 * @param row  attendance_list row
 * @param duty uss din applicable duty (history se; fallback caller pehle se lagaye)
 * @param now  IST waqt (fixed dene par deterministic tests)
 */
export function computeDay(row: AttRow, duty: Duty, now: NowInfo): DayHours {
  const dutyMin = dutyMinutes(duty);
  const dutyStart = toMins(duty.start);
  const overnight = isOvernight(duty);
  const dutyEndOffset = (isNaN(toMins(duty.end)) ? 0 : toMins(duty.end)) + (overnight ? 1440 : 0);

  const base: DayHours = {
    hasTimeIn: false,
    effOut: null,
    isAutoClosed: false,
    working: false,
    workedMin: 0,
    dutyMin,
    otMin: 0,
    lateInMin: 0,
    earlyOutMin: 0,
  };

  // Rule 2 — manual/absent row: kuch compute nahi.
  const inStr = normTime(row.time_in);
  if (!inStr) return base;

  const nowOffset = dayDiff(row.curr_date, now.date) * 1440 + now.mins;
  const inOff = offsetFor(inStr, duty);
  const realOut = normTime(row.time_out);

  let effOff: number | null;
  let auto = false;
  let working = false;

  if (realOut) {
    // Rule 1 — real checkout hamesha jeetta hai.
    effOff = offsetFor(realOut, duty);
    if (effOff < inOff) effOff += 1440; // clock-based wrap (data anomaly guard)
  } else if (nowOffset >= dutyEndOffset + AUTO_CLOSE_GRACE_MIN) {
    // Rule 3 — past day / duty khatam + grace → duty_end auto-checkout.
    effOff = dutyEndOffset;
    auto = true;
  } else {
    // Rule 4 — abhi duty chal rahi hai.
    effOff = null;
    working = true;
  }

  const workedRaw = effOff === null ? nowOffset - inOff : effOff - inOff;
  const workedMin = Math.max(0, Math.min(workedRaw, 1440)); // clamp: kabhi >24h nahi

  const earlyOutMin = !auto && effOff !== null ? Math.max(0, dutyEndOffset - effOff) : 0;
  // OT: sirf real late checkout. auto / live = 0.
  const otMin = !auto && effOff !== null ? Math.max(0, workedMin - dutyMin) : 0;

  return {
    hasTimeIn: true,
    effOut: effOff === null ? null : fmtOffset(effOff),
    isAutoClosed: auto,
    working,
    workedMin,
    dutyMin,
    otMin,
    lateInMin: Math.max(0, inOff - dutyStart),
    earlyOutMin,
  };
}
