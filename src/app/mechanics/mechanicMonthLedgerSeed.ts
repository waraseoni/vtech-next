import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/fetch-all";
import { format } from "date-fns/format";
import { startOfMonth } from "date-fns/startOfMonth";
import { endOfMonth } from "date-fns/endOfMonth";
import { eachDayOfInterval } from "date-fns/eachDayOfInterval";

/**
 * `/mechanics/ledger/[id]` ka neutral server query — page ke purane fetchData
 * ka mirror, default month ke liye. Caller cookie+RLS client pass karta hai.
 */

export type MechanicMonthLedgerMechanic = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  daily_salary: number;
};

export type MechanicMonthLedgerJob = {
  id: number;
  job_id: string;
  item: string;
  mechanic_commission_amount: string;
  status: number;
  date_created: string;
  date_completed?: string | null;
};

export type MechanicMonthLedgerRow = {
  date: Date;
  dateStr: string;
  attStatus: string;
  attValue: number;
  wage: number;
  jobs: MechanicMonthLedgerJob[];
  commGenerated: number;
  commPayable: number;
  advance: number;
  runningBal: number;
};

export type MechanicMonthLedgerSeed = {
  from: string;
  to: string;
  mechanic: MechanicMonthLedgerMechanic;
  ledgerData: MechanicMonthLedgerRow[];
  openingBalance: number;
  totalPeriod: { generated: number; payable: number; advance: number; wage: number };
};

export async function fetchMechanicMonthLedgerSeed(
  supabase: SupabaseClient,
  mid: number
): Promise<MechanicMonthLedgerSeed | null> {
  const today = new Date();
  const from = format(startOfMonth(today), "yyyy-MM-dd");
  const to = format(endOfMonth(today), "yyyy-MM-dd");

  const [mechRes, salaryHistRes] = await Promise.all([
    supabase
      .from("mechanic_list")
      .select("id, firstname, middlename, lastname, daily_salary")
      .eq("id", mid)
      .single(),
    supabase
      .from("mechanic_salary_history")
      .select("salary, effective_date")
      .eq("mechanic_id", mid)
      .order("effective_date", { ascending: false }),
  ]);

  if (mechRes.error || !mechRes.data) return null;
  const mech = mechRes.data as MechanicMonthLedgerMechanic;
  const salaryHist = (salaryHistRes.data || []) as {
    salary: string;
    effective_date: string;
  }[];

  const getDailyRate = (dateStr: string) => {
    const hist = salaryHist.find((h) => h.effective_date <= dateStr);
    return hist ? parseFloat(hist.salary) : mech.daily_salary;
  };

  const prevLimit = format(new Date(new Date(from).getTime() - 86400000), "yyyy-MM-dd");

  const [prevAtt, prevComm, prevAdv] = await Promise.all([
    fetchAll<{ curr_date: string; status: number }>(
      supabase
        .from("attendance_list")
        .select("curr_date, status")
        .eq("mechanic_id", mid)
        .in("status", [1, 3])
        .lte("curr_date", prevLimit)
    ),
    fetchAll<{ mechanic_commission_amount: string }>(
      supabase
        .from("transaction_list")
        .select("mechanic_commission_amount")
        .eq("mechanic_id", mid)
        .eq("status", 5)
        .lte("date_completed", prevLimit + " 23:59:59")
    ),
    fetchAll<{ amount: string }>(
      supabase
        .from("advance_payments")
        .select("amount")
        .eq("mechanic_id", mid)
        .lte("date_paid", prevLimit)
    ),
  ]);

  let earnedPrev = 0;
  prevAtt.forEach((att) => {
    const rate = getDailyRate(att.curr_date);
    earnedPrev += att.status === 1 ? rate : rate / 2;
  });
  const commPrev = prevComm.reduce(
    (s, c) => s + (parseFloat(c.mechanic_commission_amount) || 0),
    0
  );
  const advPrev = prevAdv.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const opBal = earnedPrev + commPrev - advPrev;

  const [attPeriod, jobsCreatedPeriod, jobsCompletedPeriod, advPeriod] = await Promise.all([
    fetchAll<{ curr_date: string; status: number }>(
      supabase
        .from("attendance_list")
        .select("curr_date, status")
        .eq("mechanic_id", mid)
        .gte("curr_date", from)
        .lte("curr_date", to)
    ),
    fetchAll<MechanicMonthLedgerJob>(
      supabase
        .from("transaction_list")
        .select("id, job_id, item, mechanic_commission_amount, status, date_created, date_completed")
        .eq("mechanic_id", mid)
        .gte("date_created", from + " 00:00:00")
        .lte("date_created", to + " 23:59:59")
    ),
    fetchAll<MechanicMonthLedgerJob>(
      supabase
        .from("transaction_list")
        .select("id, job_id, item, mechanic_commission_amount, status, date_created, date_completed")
        .eq("mechanic_id", mid)
        .eq("status", 5)
        .gte("date_completed", from + " 00:00:00")
        .lte("date_completed", to + " 23:59:59")
    ),
    fetchAll<{ amount: string; date_paid: string }>(
      supabase
        .from("advance_payments")
        .select("amount, date_paid")
        .eq("mechanic_id", mid)
        .gte("date_paid", from)
        .lte("date_paid", to)
    ),
  ]);

  const days = eachDayOfInterval({ start: new Date(from), end: new Date(to) });
  let currentBal = opBal;
  let totalGen = 0;
  let totalPay = 0;
  let totalAdv = 0;
  let totalWage = 0;

  const rows: MechanicMonthLedgerRow[] = days.map((day) => {
    const dStr = format(day, "yyyy-MM-dd");

    const att = attPeriod.find((a) => a.curr_date === dStr);
    let attStatus = "-";
    let attVal = 0;
    let wage = 0;
    if (att) {
      const rate = getDailyRate(dStr);
      if (att.status === 1) {
        attStatus = "Present";
        attVal = 1;
        wage = rate;
      } else if (att.status === 3) {
        attStatus = "Half Day";
        attVal = 0.5;
        wage = rate / 2;
      } else {
        attStatus = "Absent";
        attVal = 0;
        wage = 0;
      }
    }

    const createdOnDay = jobsCreatedPeriod.filter((j) => j.date_created.startsWith(dStr));
    const commGen = createdOnDay.reduce(
      (s, j) => s + (parseFloat(j.mechanic_commission_amount) || 0),
      0
    );

    const deliveredOnDay = jobsCompletedPeriod.filter(
      (j) => j.date_completed && j.date_completed.startsWith(dStr)
    );
    const commPay = deliveredOnDay.reduce(
      (s, j) => s + (parseFloat(j.mechanic_commission_amount) || 0),
      0
    );

    const jobMap = new Map<number, MechanicMonthLedgerJob>();
    createdOnDay.forEach((j) => jobMap.set(j.id, j));
    deliveredOnDay.forEach((j) => jobMap.set(j.id, j));
    const dayJobs = Array.from(jobMap.values());

    const dayAdv = advPeriod
      .filter((a) => a.date_paid === dStr)
      .reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

    currentBal += wage + commPay - dayAdv;
    totalGen += commGen;
    totalPay += commPay;
    totalAdv += dayAdv;
    totalWage += wage;

    return {
      date: day,
      dateStr: dStr,
      attStatus,
      attValue: attVal,
      wage,
      jobs: dayJobs,
      commGenerated: commGen,
      commPayable: commPay,
      advance: dayAdv,
      runningBal: currentBal,
    };
  });

  return {
    from,
    to,
    mechanic: mech,
    ledgerData: rows,
    openingBalance: opBal,
    totalPeriod: {
      generated: totalGen,
      payable: totalPay,
      advance: totalAdv,
      wage: totalWage,
    },
  };
}
