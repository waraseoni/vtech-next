import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfMonthIST, todayIST } from "@/lib/dateUtils";

/**
 * `/mechanics/[id]` ka neutral server query (client component aur RSC dono ke
 * liye). Service-role nahi — caller apna cookie+RLS client pass karta hai.
 * Numbers bilkul page ke purane fetchData jaisa hi calculate hote hain.
 */

export type MechanicDetailMechanic = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  contact: string;
  designation: string | null;
  daily_salary: number;
  commission_percent: number;
  status: number;
  image_path?: string | null;
};

export type MechanicDetailJob = {
  id: number;
  job_id: string;
  item: string;
  amount: number;
  mechanic_commission_amount: number;
  date_updated: string;
  date_completed: string;
  status: number;
  service_amount: number;
};

export type MechanicDetailAdvance = {
  id: number;
  reason: string;
  amount: number;
  date_paid: string;
};

export type MechanicDetailAttendance = {
  id: number;
  curr_date: string;
  status: number;
};

export type MechanicDetailStats = {
  totalEarned: number;
  totalSalary: number;
  totalCommission: number;
  totalAdvance: number;
  periodBalance: number;
  overallBalance: number;
  jobCount: number;
  workingDays: number;
  fullDays: number;
  halfDays: number;
  absentDays: number;
};

export type MechanicDetailSeed = {
  fromDate: string;
  toDate: string;
  mechanic: MechanicDetailMechanic;
  jobs: MechanicDetailJob[];
  advances: MechanicDetailAdvance[];
  attendance: MechanicDetailAttendance[];
  salaryHist: { effective_date: string; salary: string }[];
  stats: MechanicDetailStats;
};

export async function fetchMechanicDetailSeed(
  supabase: SupabaseClient,
  id: number
): Promise<MechanicDetailSeed | null> {
  const { data: mechanic, error } = await supabase
    .from("mechanic_list")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !mechanic) return null;

  const fromDate = startOfMonthIST();
  const toDate = todayIST();
  const fromTs = `${fromDate}T00:00:00+05:30`;
  const toTs = `${toDate}T23:59:59+05:30`;

  const { data: jobsData } = await supabase
    .from("transaction_list")
    .select(
      "id, job_id, item, amount, mechanic_commission_amount, date_updated, date_completed, status"
    )
    .eq("mechanic_id", id)
    .eq("status", 5)
    .gte("date_completed", fromTs)
    .lte("date_completed", toTs)
    .order("date_completed", { ascending: false });

  const jobs = (jobsData || []) as Omit<MechanicDetailJob, "service_amount">[];

  const svcMap: Record<number, number> = {};
  if (jobs.length > 0) {
    const { data: svcs } = await supabase
      .from("transaction_services")
      .select("transaction_id, price")
      .in(
        "transaction_id",
        jobs.map((j) => j.id)
      );
    (svcs || []).forEach((s: Record<string, unknown>) => {
      const tid = Number(s.transaction_id);
      svcMap[tid] = (svcMap[tid] || 0) + Number(s.price || 0);
    });
  }
  const jobsWithSvc: MechanicDetailJob[] = jobs.map((j) => ({
    ...j,
    service_amount: svcMap[j.id] || 0,
  }));

  const { data: salaryHistData } = await supabase
    .from("mechanic_salary_history")
    .select("salary, effective_date")
    .eq("mechanic_id", id)
    .order("effective_date", { ascending: false })
    .order("id", { ascending: false });
  const salaryHist = (salaryHistData || []) as { effective_date: string; salary: string }[];

  const localGetRate = (dateStr: string) => {
    const h = salaryHist.find((x) => x.effective_date <= dateStr);
    return h ? parseFloat(h.salary) : mechanic.daily_salary || 0;
  };

  const { data: advData } = await supabase
    .from("advance_payments")
    .select("id, reason, amount, date_paid")
    .eq("mechanic_id", id)
    .gte("date_paid", fromDate)
    .lte("date_paid", toDate)
    .order("date_paid", { ascending: false });
  const advances = (advData || []) as MechanicDetailAdvance[];

  const { data: attData } = await supabase
    .from("attendance_list")
    .select("id, curr_date, status")
    .eq("mechanic_id", id)
    .gte("curr_date", fromDate)
    .lte("curr_date", toDate)
    .order("curr_date", { ascending: false });
  const attendance = (attData || []) as MechanicDetailAttendance[];

  const totalCommission = jobsWithSvc.reduce((s, j) => s + (j.mechanic_commission_amount || 0), 0);
  const fullDays = attendance.filter((a) => a.status === 1).length;
  const halfDays = attendance.filter((a) => a.status === 3).length;
  let totalSalary = 0;
  attendance.forEach((att) => {
    const rate = localGetRate(att.curr_date);
    totalSalary += att.status === 1 ? rate : rate / 2;
  });
  const totalAdvance = advances.reduce((s, a) => s + (a.amount || 0), 0);
  const totalEarned = totalSalary + totalCommission;
  const periodBalance = totalEarned - totalAdvance;

  const [allJobs, allAtt, allAdv] = await Promise.all([
    supabase.from("transaction_list").select("mechanic_commission_amount").eq("mechanic_id", id),
    supabase
      .from("attendance_list")
      .select("curr_date, status")
      .eq("mechanic_id", id)
      .in("status", [1, 3]),
    supabase.from("advance_payments").select("amount").eq("mechanic_id", id),
  ]);
  const allComm = (allJobs.data || []).reduce(
    (s: number, j: Record<string, unknown>) => s + Number(j.mechanic_commission_amount || 0),
    0
  );
  let allSal = 0;
  (allAtt.data || []).forEach((att: Record<string, unknown>) => {
    const rate = localGetRate(String(att.curr_date));
    allSal += att.status === 1 ? rate : rate / 2;
  });
  const allAdvTotal = (allAdv.data || []).reduce(
    (s: number, a: Record<string, unknown>) => s + Number(a.amount || 0),
    0
  );

  return {
    fromDate,
    toDate,
    mechanic: mechanic as MechanicDetailMechanic,
    jobs: jobsWithSvc,
    advances,
    attendance,
    salaryHist,
    stats: {
      totalEarned,
      totalSalary,
      totalCommission,
      totalAdvance,
      periodBalance,
      overallBalance: allSal + allComm - allAdvTotal,
      jobCount: jobsWithSvc.length,
      workingDays: fullDays + halfDays,
      fullDays,
      halfDays,
      absentDays: attendance.filter((a) => a.status === 2).length,
    },
  };
}
