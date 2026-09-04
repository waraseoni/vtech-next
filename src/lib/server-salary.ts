import { getServerSupabase } from "@/lib/api-auth";
import { fetchAll } from "@/lib/fetch-all";

/**
 * Server-data layer for the Salary page (G3 migration).
 *
 * KEY OPTIMIZATION: Original client code had N+1 (6 queries per mechanic).
 * This server layer batch-fetches ALL records for the month and groups in memory.
 * Result: 8 queries total regardless of mechanic count (vs 2 + 6N before).
 *
 * G3 gate rule: service-role NEVER for page reads. Ye sab queries cookie+RLS
 * server client (`getServerSupabase`) se hoti hain — bilkul wahi behaviour jo
 * pehle browser client (`@/lib/supabase`) page ke `useEffect` me karta tha,
 * par ab server par render-time par. Kabhi isse `getAdminSupabase()` na use
 * karein — RLS bypass = banned.
 */

type DbRow = { [key: string]: unknown };

export type SalaryRecord = {
  id: number;
  name: string;
  image: string | null;
  daily_salary: number;
  present: number;
  halfDays: number;
  earnedSalary: number;
  commission: number;
  oldBalance: number;
  advance: number;
  netTotal: number;
};

export type MechanicRow = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  daily_salary: number;
  image_path: string | null;
  designation: string | null;
  status: number;
  delete_flag: number;
  last_updated: string | null;
};

export type SalaryHistoryRow = {
  mechanic_id: number;
  salary: string;
  effective_date: string;
};

type AttRow = { mechanic_id: number; curr_date: string; status: number };
type CommRow = { mechanic_id: number; mechanic_commission_amount: string };
type AdvRow = { mechanic_id: number; amount: string; date_paid: string };

function dateRange(month: string) {
  const d = new Date(month + "-01");
  const start = `${month}-01`;
  const endD = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const end = `${month}-${String(endD.getDate()).padStart(2, "0")}`;
  // Previous month end
  const prevD = new Date(d.getFullYear(), d.getMonth(), 0);
  const prevEnd = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, "0")}-${String(prevD.getDate()).padStart(2, "0")}`;
  return { start, end, prevEnd };
}

function getRate(
  mid: number,
  dateStr: string,
  defaultRate: number,
  hist: SalaryHistoryRow[]
): number {
  const h = hist.find((r) => r.mechanic_id === mid && r.effective_date <= dateStr);
  return h ? parseFloat(h.salary) : defaultRate;
}

export async function fetchSalaryReportData(month: string): Promise<SalaryRecord[]> {
  const supabase = await getServerSupabase();
  const { start, end, prevEnd } = dateRange(month);

  // 1. Mechanics + salary history (2 queries)
  const [{ data: mechs }, { data: hist }] = await Promise.all([
    supabase
      .from("mechanic_list")
      .select("id, firstname, lastname, daily_salary, image_path")
      .eq("status", 1)
      .eq("delete_flag", 0),
    supabase
      .from("mechanic_salary_history")
      .select("mechanic_id, salary, effective_date")
      .order("effective_date", { ascending: false })
      .order("id", { ascending: false }),
  ]);

  if (!mechs) return [];

  const salaryHist = ((hist as DbRow[] | null) || []).map((r) => ({
    mechanic_id: r.mechanic_id as number,
    salary: r.salary as string,
    effective_date: r.effective_date as string,
  })) as SalaryHistoryRow[];

  // 2. Batch-fetch ALL attendance, commissions, advances for both months (6 queries with fetchAll to bypass 1000-row cap)
  const [prevAttData, currAttData, prevCommData, currCommData, prevAdvData, currAdvData] =
    await Promise.all([
      fetchAll<AttRow>(
        supabase
          .from("attendance_list")
          .select("mechanic_id, curr_date, status")
          .in("status", [1, 3])
          .lte("curr_date", prevEnd)
      ),
      fetchAll<AttRow>(
        supabase
          .from("attendance_list")
          .select("mechanic_id, curr_date, status")
          .in("status", [1, 3])
          .gte("curr_date", start)
          .lte("curr_date", end)
      ),
      fetchAll<CommRow>(
        supabase
          .from("transaction_list")
          .select("mechanic_id, mechanic_commission_amount")
          .eq("status", 5)
          .lte("date_completed", prevEnd + " 23:59:59")
      ),
      fetchAll<CommRow>(
        supabase
          .from("transaction_list")
          .select("mechanic_id, mechanic_commission_amount")
          .eq("status", 5)
          .gte("date_completed", start + " 00:00:00")
          .lte("date_completed", end + " 23:59:59")
      ),
      fetchAll<AdvRow>(
        supabase
          .from("advance_payments")
          .select("mechanic_id, amount, date_paid")
          .lte("date_paid", prevEnd)
      ),
      fetchAll<AdvRow>(
        supabase
          .from("advance_payments")
          .select("mechanic_id, amount, date_paid")
          .gte("date_paid", start)
          .lte("date_paid", end)
      ),
    ]);

  // 3. Group by mechanic_id in memory (O(N) instead of N queries)
  const prevAttByMech = groupBy(prevAttData, "mechanic_id");
  const currAttByMech = groupBy(currAttData, "mechanic_id");
  const prevCommByMech = groupBy(prevCommData, "mechanic_id");
  const currCommByMech = groupBy(currCommData, "mechanic_id");
  const prevAdvByMech = groupBy(prevAdvData, "mechanic_id");
  const currAdvByMech = groupBy(currAdvData, "mechanic_id");

  // 4. Compute per-mechanic aggregates
  return (mechs as DbRow[]).map((m) => {
    const mid = m.id as number;
    const defaultRate = m.daily_salary as number;

    // Previous month
    const pAtt = prevAttByMech.get(mid) || [];
    const pComm = prevCommByMech.get(mid) || [];
    const pAdv = prevAdvByMech.get(mid) || [];

    let earnedPrev = 0;
    for (const att of pAtt) {
      earnedPrev +=
        att.status === 1
          ? getRate(mid, att.curr_date, defaultRate, salaryHist)
          : getRate(mid, att.curr_date, defaultRate, salaryHist) / 2;
    }
    const commPrev = pComm.reduce((s, c) => s + (parseFloat(c.mechanic_commission_amount) || 0), 0);
    const advPrev = pAdv.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    const oldBalance = earnedPrev + commPrev - advPrev;

    // Current month
    const cAtt = currAttByMech.get(mid) || [];
    const cComm = currCommByMech.get(mid) || [];
    const cAdv = currAdvByMech.get(mid) || [];

    let earnedCurr = 0,
      pCount = 0,
      hdCount = 0;
    for (const att of cAtt) {
      const rate = getRate(mid, att.curr_date, defaultRate, salaryHist);
      if (att.status === 1) {
        pCount++;
        earnedCurr += rate;
      } else {
        hdCount++;
        earnedCurr += rate / 2;
      }
    }
    const commCurr = cComm.reduce((s, c) => s + (parseFloat(c.mechanic_commission_amount) || 0), 0);
    const advCurr = cAdv.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

    const netTotal = oldBalance + earnedCurr + commCurr - advCurr;

    return {
      id: mid,
      name: `${m.firstname} ${m.lastname}`,
      image: (m.image_path as string | null) || null,
      daily_salary: defaultRate,
      present: pCount,
      halfDays: hdCount,
      earnedSalary: earnedCurr,
      commission: commCurr,
      oldBalance,
      advance: advCurr,
      netTotal,
    };
  }) as SalaryRecord[];
}

export async function fetchSalaryMasterData(): Promise<MechanicRow[]> {
  const supabase = await getServerSupabase();

  const [{ data: mechs }, { data: hist }] = await Promise.all([
    supabase
      .from("mechanic_list")
      .select("*")
      .eq("status", 1)
      .eq("delete_flag", 0)
      .order("firstname"),
    supabase
      .from("mechanic_salary_history")
      .select("mechanic_id, date_created")
      .order("id", { ascending: false }),
  ]);

  return ((mechs as DbRow[]) || []).map((m) => ({
    id: m.id as number,
    firstname: (m.firstname as string) ?? "",
    middlename: (m.middlename as string | null) ?? null,
    lastname: (m.lastname as string) ?? "",
    daily_salary: Number(m.daily_salary) || 0,
    image_path: (m.image_path as string | null) || null,
    designation: (m.designation as string | null) || null,
    status: m.status as number,
    delete_flag: m.delete_flag as number,
    last_updated:
      (((hist as DbRow[]) || []).find((h) => h.mechanic_id === m.id)?.date_created as string) ||
      null,
  })) as MechanicRow[];
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
