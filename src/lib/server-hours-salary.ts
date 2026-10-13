import { getServerSupabase } from "@/lib/api-auth";
import { fetchAll } from "@/lib/fetch-all";
import { nowIST, type AttRow } from "@/lib/attendance-hours";
import { bizDutyFromMeta, dutyFor, type DutyScheduleRow } from "@/lib/duty";
import {
  buildHoursDays,
  summarizeMonth,
  summarizeStaff,
  type HoursDay,
  type HoursMonthSummary,
  type HoursStaffSummary,
} from "@/lib/hours-salary";

type DbRow = { [key: string]: unknown };

export type HoursStaffRow = {
  id: number;
  name: string;
  currentRate: number;
  summary: HoursStaffSummary;
  days: HoursDay[];
};

export type HoursSalaryData = {
  month: string;
  staff: HoursStaffRow[];
  totals: HoursMonthSummary;
};

export type SalaryHistoryRow = {
  mechanic_id: number;
  salary: string;
  effective_date: string;
};

type AttDbRow = {
  mechanic_id: number;
  curr_date: string;
  status: number;
  time_in: string | null;
  time_out: string | null;
};

function dateRange(month: string) {
  const d = new Date(month + "-01");
  const start = `${month}-01`;
  const endD = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const end = `${month}-${String(endD.getDate()).padStart(2, "0")}`;
  return { start, end };
}

function rateAt(
  mid: number,
  dateStr: string,
  defaultRate: number,
  hist: SalaryHistoryRow[]
): number {
  const h = hist.find((r) => r.mechanic_id === mid && r.effective_date <= dateStr);
  return h ? parseFloat(h.salary) : defaultRate;
}

function groupBy<T>(arr: T[], key: keyof T): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of arr) {
    const k = item[key] as unknown as number;
    const existing = map.get(k);
    if (existing) existing.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/**
 * Hours-mode salary data (read-only, NO DB writes).
 *
 * G3 gate: cookie+RLS server client (`getServerSupabase`) — page reads me
 * `getAdminSupabase()` NEVER. Existing day-mode system ko touch nahi karta.
 */
export async function fetchHoursSalaryData(month: string): Promise<HoursSalaryData> {
  const supabase = await getServerSupabase();
  const { start, end } = dateRange(month);

  const [{ data: mechs }, { data: hist }] = await Promise.all([
    supabase
      .from("mechanic_list")
      .select("id, firstname, lastname, daily_salary")
      .eq("status", 1)
      .eq("delete_flag", 0)
      .order("firstname"),
    supabase
      .from("mechanic_salary_history")
      .select("mechanic_id, salary, effective_date")
      .order("effective_date", { ascending: false })
      .order("id", { ascending: false }),
  ]);

  if (!mechs) {
    return { month, staff: [], totals: summarizeMonth([]) };
  }

  const salaryHist = ((hist as DbRow[] | null) || []).map((r) => ({
    mechanic_id: r.mechanic_id as number,
    salary: r.salary as string,
    effective_date: r.effective_date as string,
  })) as SalaryHistoryRow[];

  const mechIds = (mechs as DbRow[]).map((m) => m.id as number);

  const [attData, dutyRes, sysRes] = await Promise.all([
    fetchAll<AttDbRow>(
      supabase
        .from("attendance_list")
        .select("mechanic_id, curr_date, status, time_in, time_out")
        .gte("curr_date", start)
        .lte("curr_date", end)
    ),
    supabase
      .from("staff_duty_schedule")
      .select("mechanic_id, duty_start, duty_end, break_minutes, effective_from")
      .in("mechanic_id", mechIds)
      .lte("effective_from", end)
      .order("effective_from", { ascending: false }),
    supabase
      .from("system_info")
      .select("meta_field, meta_value")
      .in("meta_field", ["biz_open", "biz_close"]),
  ]);

  const bizDuty = bizDutyFromMeta(
    (sysRes.data as Array<{ meta_field: string; meta_value: string | null }>) || []
  );
  const dutyByMech = groupBy((dutyRes.data as DutyScheduleRow[] | null) || [], "mechanic_id");
  const attByMech = groupBy(attData, "mechanic_id");
  const now = nowIST();

  const staff = (mechs as DbRow[]).map((m) => {
    const mid = m.id as number;
    const defaultRate = Number(m.daily_salary) || 0;
    const rateFor = (date: string) => rateAt(mid, date, defaultRate, salaryHist);
    const dutyForDate = (date: string) => dutyFor(dutyByMech.get(mid) || [], date, bizDuty);

    const rows = (attByMech.get(mid) || []).map((r): AttRow => ({
      curr_date: r.curr_date,
      status: r.status,
      time_in: r.time_in,
      time_out: r.time_out,
    }));

    const days = buildHoursDays({ rows, dutyFor: dutyForDate, rateFor, now });
    const summary = summarizeStaff(days, rateAt(mid, end, defaultRate, salaryHist));

    return {
      id: mid,
      name: `${String(m.firstname)} ${String(m.lastname)}`.trim(),
      currentRate: summary.currentRate,
      summary,
      days,
    };
  });

  return { month, staff, totals: summarizeMonth(staff.map((s) => s.summary)) };
}
