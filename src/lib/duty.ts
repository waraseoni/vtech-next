// ============================================================================
// duty.ts — per-staff duty time (start/end) + effective-dated history helpers
//
// Data: `staff_duty_schedule` (migration 20261002_staff_duty_schedule.sql),
//   append-only rows with `effective_from` — bilkul `mechanic_salary_history`
//   pattern. Purani row close karna/khojna yahan hi hota hai.
// Fallback: jab koi row nahi → system_info `biz_open`/`biz_close` (09:00-19:00)
//   → warna DEFAULT_DUTY. Duty kabhi "undefined" nahi hoti.
// Pure/client-safe (koi supabase import nahi) — tests + client dono chalate hain.
// Phase P3 ka hours-engine isi module par build karega.
// ============================================================================

export type Duty = {
  start: string; // "HH:MM" (24h, normalised)
  end: string; // "HH:MM"
  breakMinutes: number; // duty ke beech ka break (abhi UI me 0)
};

export type DutyScheduleRow = {
  id?: number;
  mechanic_id: number;
  duty_start: string; // PostgREST: "HH:MM:SS" (time col) ya "HH:MM"
  duty_end: string;
  break_minutes?: number | null;
  effective_from: string; // "YYYY-MM-DD" (date col)
  note?: string | null;
  created_at?: string;
};

/** Jab bilkul kuch na mile — shop default (settings ke biz hours se alag). */
export const DEFAULT_DUTY: Duty = { start: "10:00", end: "20:00", breakMinutes: 0 };

/**
 * "10:00:00" / "10:00" jaise kisi bhi 24h time ko "HH:MM" banao.
 * Invalid → "" (caller validate karega).
 */
export function normTime(v: string | null | undefined): string {
  if (!v) return "";
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(v).trim());
  if (!m) return "";
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!isFinite(h) || !isFinite(mm) || h > 23 || mm > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** "10:00" → 600 (din ke minute). Invalid → NaN. */
export function toMins(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(normTime(t));
  if (!m) return NaN;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * Duty ki actual kaam-ki minutes (break minus karke).
 * Overnight support: 22:00 → 06:00 = 480. start == end → 0.
 * Invalid → 0.
 */
export function dutyMinutes(duty: Duty): number {
  const s = toMins(duty.start);
  const e = toMins(duty.end);
  if (isNaN(s) || isNaN(e)) return 0;
  let span = e - s;
  if (span < 0) span += 24 * 60; // overnight wrap
  if (span === 0) return 0;
  const br = Math.max(0, duty.breakMinutes || 0);
  return Math.max(0, span - br);
}

/** Form valid hai (times parse hote hain, duration > 0). */
export function isValidDuty(duty: Duty): boolean {
  if (!normTime(duty.start) || !normTime(duty.end)) return false;
  return dutyMinutes(duty) > 0;
}

/** Row → normalised Duty (PostgREST "HH:MM:SS" → "HH:MM"). */
export function rowToDuty(row: DutyScheduleRow | null | undefined): Duty | null {
  if (!row) return null;
  const duty: Duty = {
    start: normTime(row.duty_start),
    end: normTime(row.duty_end),
    breakMinutes: Math.max(0, Number(row.break_minutes ?? 0)) || 0,
  };
  return isValidDuty(duty) ? duty : null;
}

/** Naye se purane (effective_from DESC). Input mutate nahi. */
export function sortDutyDesc(rows: DutyScheduleRow[] | null | undefined): DutyScheduleRow[] {
  if (!rows || rows.length === 0) return [];
  return [...rows].sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)));
}

/**
 * `date` ("YYYY-MM-DD") tak ki row → sabse nayi jiska effective_from <= date.
 * Aaj/ future rows ignore. Row mili to uski Duty, warna null.
 */
export function currentSchedule(
  rows: DutyScheduleRow[] | null | undefined,
  date: string
): DutyScheduleRow | null {
  const sorted = sortDutyDesc(rows);
  for (const r of sorted) {
    const eff = String(r.effective_from || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eff)) continue;
    if (eff <= date) return r;
  }
  return null;
}

/**
 * Date ke liye kaun si duty lagti hai.
 * @param fallback koi row nahi ho to (default DEFAULT_DUTY; biz hours caller
 *                 system_info se laakar pass karta hai).
 */
export function dutyFor(
  rows: DutyScheduleRow[] | null | undefined,
  date: string,
  fallback: Duty = DEFAULT_DUTY
): Duty {
  const row = currentSchedule(rows, date);
  return rowToDuty(row) || fallback;
}

/** Do duty same hain ya nahi (save skip karne ke liye). */
export function dutyEqual(a: Duty | null | undefined, b: Duty | null | undefined): boolean {
  if (!a || !b) return a === b;
  return normTime(a.start) === normTime(b.start) && normTime(a.end) === normTime(b.end);
}

/** "10:00 – 19:00" (en-dash) — UI ke liye. */
export function fmtDuty(duty: Duty | null | undefined): string {
  if (!duty) return "—";
  const s = normTime(duty.start);
  const e = normTime(duty.end);
  if (!s || !e) return "—";
  return `${s} – ${e}`;
}

/** "9h" / "8h 30m" — duty ki lambai. */
export function dutyLengthLabel(duty: Duty | null | undefined): string {
  if (!duty) return "";
  const mins = dutyMinutes(duty);
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * `system_info` ki `biz_open`/`biz_close` rows → shop-level fallback duty.
 * Valid nahi (missing/galat hours) to `DEFAULT_DUTY`.
 */
export function bizDutyFromMeta(
  rows: Array<{ meta_field: string; meta_value: string | null }> | null | undefined
): Duty {
  const info: Record<string, string> = {};
  (rows || []).forEach((r) => {
    if (r.meta_value != null) info[r.meta_field] = String(r.meta_value);
  });
  const start = normTime(info.biz_open);
  const end = normTime(info.biz_close);
  if (start && end && start !== end) return { start, end, breakMinutes: 0 };
  return DEFAULT_DUTY;
}
