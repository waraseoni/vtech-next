import type { SupabaseClient } from "@supabase/supabase-js";
import { parseISTDate, startOfMonthIST, toISTDatePart, todayIST } from "@/lib/dateUtils";

/**
 * `/mechanics/[id]/ledger` ka neutral server query. Page ka purana client
 * fetchLedger logic hi hai — bas caller cookie+RLS client pass karta hai.
 */

export type MechanicLedgerMechanic = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  daily_salary: number;
};

export type MechanicLedgerEntry = {
  date: string;
  status: string;
  statusClass: string;
  earned: number;
  commission: number;
  advance: number;
  running: number;
};

export type MechanicLedgerSeed = {
  fromDate: string;
  toDate: string;
  mechanic: MechanicLedgerMechanic;
  entries: MechanicLedgerEntry[];
  openingBalance: number;
  closingBalance: number;
  totals: { earned: number; commission: number; advance: number };
};

export async function fetchMechanicLedgerSeed(
  supabase: SupabaseClient,
  id: number
): Promise<MechanicLedgerSeed | null> {
  const { data: mechanic, error } = await supabase
    .from("mechanic_list")
    .select("id, firstname, middlename, lastname, daily_salary")
    .eq("id", id)
    .single();
  if (error || !mechanic) return null;

  const fromDate = startOfMonthIST();
  const toDate = todayIST();

  const { data: salaryHistData } = await supabase
    .from("mechanic_salary_history")
    .select("salary, effective_date")
    .eq("mechanic_id", mechanic.id)
    .order("effective_date", { ascending: false })
    .order("id", { ascending: false });
  const hist = (salaryHistData || []) as { salary: string; effective_date: string }[];
  const getDailyRate = (dateStr: string) => {
    const h = hist.find((x) => x.effective_date <= dateStr);
    return h ? parseFloat(h.salary) : mechanic.daily_salary || 0;
  };

  const d = parseISTDate(fromDate);
  d.setDate(d.getDate() - 1);
  const prevDateStr = toISTDatePart(d);

  const { data: prevAtt } = await supabase
    .from("attendance_list")
    .select("curr_date, status")
    .eq("mechanic_id", mechanic.id)
    .in("status", [1, 3])
    .lte("curr_date", prevDateStr);

  const { data: prevComm } = await supabase
    .from("transaction_list")
    .select("mechanic_commission_amount")
    .eq("mechanic_id", mechanic.id)
    .eq("status", 5)
    .lte("date_completed", `${prevDateStr}T23:59:59+05:30`);

  const { data: prevAdv } = await supabase
    .from("advance_payments")
    .select("amount")
    .eq("mechanic_id", mechanic.id)
    .lte("date_paid", prevDateStr);

  let opening = 0;
  (prevAtt || []).forEach((a: Record<string, unknown>) => {
    const rate = getDailyRate(String(a.curr_date));
    opening += a.status === 1 ? rate : rate / 2;
  });
  opening += (prevComm || []).reduce(
    (s: number, c: Record<string, unknown>) => s + Number(c.mechanic_commission_amount || 0),
    0
  );
  opening -= (prevAdv || []).reduce(
    (s: number, a: Record<string, unknown>) => s + Number(a.amount || 0),
    0
  );

  const [periodAtt, periodComm, periodAdv] = await Promise.all([
    supabase
      .from("attendance_list")
      .select("curr_date, status")
      .eq("mechanic_id", mechanic.id)
      .in("status", [1, 3])
      .gte("curr_date", fromDate)
      .lte("curr_date", toDate),
    supabase
      .from("transaction_list")
      .select("date_completed, mechanic_commission_amount")
      .eq("mechanic_id", mechanic.id)
      .eq("status", 5)
      .gte("date_completed", `${fromDate}T00:00:00+05:30`)
      .lte("date_completed", `${toDate}T23:59:59+05:30`),
    supabase
      .from("advance_payments")
      .select("date_paid, amount")
      .eq("mechanic_id", mechanic.id)
      .gte("date_paid", fromDate)
      .lte("date_paid", toDate),
  ]);

  const attMap: Record<string, number> = {};
  (periodAtt.data || []).forEach((a: Record<string, unknown>) => {
    attMap[String(a.curr_date)] = Number(a.status);
  });
  const commMap: Record<string, number> = {};
  (periodComm.data || []).forEach((c: Record<string, unknown>) => {
    const ds = toISTDatePart(String(c.date_completed));
    commMap[ds] = (commMap[ds] || 0) + Number(c.mechanic_commission_amount || 0);
  });
  const advMap: Record<string, number> = {};
  (periodAdv.data || []).forEach((a: Record<string, unknown>) => {
    const key = String(a.date_paid);
    advMap[key] = (advMap[key] || 0) + Number(a.amount || 0);
  });

  const entries: MechanicLedgerEntry[] = [];
  let runningBalance = opening;
  let totalEarned = 0;
  let totalCommission = 0;
  let totalAdvance = 0;
  const currentDate = parseISTDate(fromDate);
  const endDate = parseISTDate(toDate);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  while (currentDate <= endDate) {
    const dateStr = toISTDatePart(currentDate);
    const dayName = dayNames[currentDate.getDay()];
    const attStatus = attMap[dateStr];
    const dailyComm = commMap[dateStr] || 0;
    const dailyAdv = advMap[dateStr] || 0;

    let dailyEarned = 0;
    let status = "Absent";
    let statusClass = "bg-red-500/10 text-red-400";

    if (attStatus === 1) {
      dailyEarned = getDailyRate(dateStr);
      status = "Full Day";
      statusClass = "bg-emerald-500/10 text-emerald-400";
    } else if (attStatus === 3) {
      dailyEarned = getDailyRate(dateStr) / 2;
      status = "Half Day";
      statusClass = "bg-amber-500/10 text-amber-400";
    }

    runningBalance += dailyEarned + dailyComm - dailyAdv;
    totalEarned += dailyEarned;
    totalCommission += dailyComm;
    totalAdvance += dailyAdv;

    entries.push({
      date: `${dateStr} (${dayName})`,
      status,
      statusClass,
      earned: dailyEarned,
      commission: dailyComm,
      advance: dailyAdv,
      running: runningBalance,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    fromDate,
    toDate,
    mechanic: mechanic as MechanicLedgerMechanic,
    entries,
    openingBalance: opening,
    closingBalance: runningBalance,
    totals: { earned: totalEarned, commission: totalCommission, advance: totalAdvance },
  };
}
