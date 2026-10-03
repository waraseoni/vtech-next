// ─────────────────────────────────────────────────────────────────
// Attendance save paths ka glue: duty load + derived columns.
// Read-time compute (report tooltip) rehta hai `attendance-hours.ts`
// me; yeh module sirf DB likhne walon ke liye — duty kahan se aayegi
// aur write payload me kya jaayega.
// ─────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabase";
import { computeDay, nowIST, type AttRow } from "@/lib/attendance-hours";
import { todayIST } from "@/lib/dateUtils";
import {
  DEFAULT_DUTY,
  bizDutyFromMeta,
  dutyFor,
  type Duty,
  type DutyScheduleRow,
} from "@/lib/duty";

/**
 * Batch: har staff ki us din ki applicable duty (history + shop fallback).
 * Bulk save me N+1 avoid karne ke liye — ek round-trip.
 */
export async function loadDutyMap(mechIds: number[], dateStr: string): Promise<Map<number, Duty>> {
  const map = new Map<number, Duty>();
  if (!mechIds.length) return map;
  const { rows, bizDuty } = await loadDutyContext(mechIds, dateStr);
  mechIds.forEach((id) =>
    map.set(
      id,
      dutyFor(
        rows.filter((r) => r.mechanic_id === id),
        dateStr,
        bizDuty
      )
    )
  );
  return map;
}

/**
 * Schedule rows + shop duty EK round-trip — caller har row ki date par
 * khud `dutyFor(rows, rowDate, bizDuty)` lagaye (month MTD jahan per-date
 * duty chahiye, ek hi fetch me sab dates cover).
 */
export async function loadDutyContext(
  mechIds: number[],
  uptoDate: string
): Promise<{ rows: DutyScheduleRow[]; bizDuty: Duty }> {
  if (!mechIds.length) return { rows: [], bizDuty: DEFAULT_DUTY };
  const [dutyRes, sysRes] = await Promise.all([
    supabase
      .from("staff_duty_schedule")
      .select("mechanic_id, duty_start, duty_end, break_minutes, effective_from")
      .in("mechanic_id", mechIds)
      .lte("effective_from", uptoDate)
      .order("effective_from", { ascending: false }),
    supabase
      .from("system_info")
      .select("meta_field, meta_value")
      .in("meta_field", ["biz_open", "biz_close"]),
  ]);
  return {
    rows: (dutyRes.data || []) as DutyScheduleRow[],
    bizDuty: bizDutyFromMeta(
      (sysRes.data as Array<{ meta_field: string; meta_value: string | null }>) || []
    ),
  };
}

/** Single staff ki us din ki duty (modal/self-checkout jahan ek hi row ho). */
export async function loadDuty(mechanicId: number, dateStr: string): Promise<Duty> {
  return (await loadDutyMap([mechanicId], dateStr)).get(mechanicId) ?? DEFAULT_DUTY;
}

/**
 * Save payload ke liye derived columns (P3 migration ke 4 cols).
 * time_in hi nahi → kuch compute nahi (nulls), warna engine output as-is.
 */
export function derivedCols(row: AttRow, duty: Duty, now = nowIST()) {
  const c = computeDay(row, duty, now);
  if (!c.hasTimeIn) {
    return { worked_min: null, ot_min: 0, duty_min: null, is_auto_closed: false };
  }
  return {
    worked_min: c.workedMin,
    ot_min: c.otMin,
    duty_min: c.dutyMin,
    is_auto_closed: c.isAutoClosed,
  };
}

/** Times clear karne par derived cols bhi reset (NULL, OT 0). */
export const CLEAR_DERIVED_COLS = {
  worked_min: null,
  ot_min: 0,
  duty_min: null,
  is_auto_closed: false,
} as const;

/**
 * §4.3: Naye check-in (aaj) par purane OPEN din auto-close — `time_out` us din
 * ke duty_end par (engine rule 3) + derived cols persist. Sirf aaj se pehle ke
 * jin rows me `time_in` hai par `time_out` NULL.
 *
 * Non-fatal (fire-and-forget): fail/0 par caller ignore karta hai — ye
 * optimization hai, "Close pending days" button se manual close bhi rehta hai.
 * @returns kitne rows close hue.
 */
export async function autoClosePrevDaysFor(mechIds: number[]): Promise<number> {
  if (!mechIds.length) return 0;
  const today = todayIST();
  const { data, error } = await supabase
    .from("attendance_list")
    .select("id, mechanic_id, curr_date, status, time_in, time_out")
    .in("mechanic_id", mechIds)
    .lt("curr_date", today)
    .is("time_out", null)
    // Bina iske ~1000+ purani "kabhi punch nahi hue" rows match hoti hain aur
    // PostgREST ka 1000-row default cap asli target rows ko result se bahar
    // kar deta tha (2026-10-03: 1055 matched, 4 needed, cap ne 4 ko drop kiya).
    .not("time_in", "is", null)
    .order("curr_date");
  if (error || !data?.length) return 0;
  const now = nowIST();
  let closed = 0;
  for (const row of data as Array<AttRow & { id: number; mechanic_id: number }>) {
    if (!row.time_in || row.time_out) continue;
    const duty = await loadDuty(row.mechanic_id, row.curr_date);
    const c = computeDay(row, duty, now);
    if (!c.effOut || !c.isAutoClosed) continue;
    const { error: updErr } = await supabase
      .from("attendance_list")
      .update({
        time_out: c.effOut,
        worked_min: c.workedMin,
        ot_min: c.otMin,
        duty_min: c.dutyMin,
        is_auto_closed: c.isAutoClosed,
      })
      .eq("id", row.id);
    if (!updErr) closed++;
  }
  return closed;
}

/** Single staff variant (self check-in / AttendanceModal save paths). */
export async function autoClosePrevDays(mechanicId: number): Promise<number> {
  return autoClosePrevDaysFor([mechanicId]);
}
