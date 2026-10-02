// ─────────────────────────────────────────────────────────────────
// Attendance save paths ka glue: duty load + derived columns.
// Read-time compute (report tooltip) rehta hai `attendance-hours.ts`
// me; yeh module sirf DB likhne walon ke liye — duty kahan se aayegi
// aur write payload me kya jaayega.
// ─────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabase";
import { computeDay, nowIST, type AttRow } from "@/lib/attendance-hours";
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
  const [dutyRes, sysRes] = await Promise.all([
    supabase
      .from("staff_duty_schedule")
      .select("mechanic_id, duty_start, duty_end, break_minutes, effective_from")
      .in("mechanic_id", mechIds)
      .lte("effective_from", dateStr)
      .order("effective_from", { ascending: false }),
    supabase
      .from("system_info")
      .select("meta_field, meta_value")
      .in("meta_field", ["biz_open", "biz_close"]),
  ]);
  const rows = (dutyRes.data || []) as DutyScheduleRow[];
  const bizDuty = bizDutyFromMeta(
    (sysRes.data as Array<{ meta_field: string; meta_value: string | null }>) || []
  );
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
