"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Loader2, ArrowLeft, Calendar, DollarSign, TrendingUp, Users,
  Wrench, FileText, Clock, CheckCircle, XCircle, AlertCircle,
  ChevronLeft, ChevronRight, Eye, MessageSquare, Printer
} from "lucide-react";

type Mechanic = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  contact: string;
  designation: string | null;
  daily_salary: number;
  commission_percent: number;
  status: number;
};

type Job = {
  id: number;
  job_id: string;
  item: string;
  mechanic_commission_amount: number;
  date_updated: string;
  status: number;
};

type Advance = {
  id: number;
  reason: string;
  amount: number;
  date_paid: string;
};

type Attendance = {
  id: number;
  curr_date: string;
  status: number;
};

type Tab = "work" | "ledger" | "attendance";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: "blue" | "purple" | "emerald" | "teal" | "amber" | "red";
}) {
  const colors = {
    blue: "text-blue-400 bg-blue-500/8",
    purple: "text-purple-400 bg-purple-500/8",
    emerald: "text-emerald-400 bg-emerald-500/8",
    teal: "text-teal-400 bg-teal-500/8",
    amber: "text-amber-400 bg-amber-500/8",
    red: "text-red-400 bg-red-500/8",
  };
  return (
    <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
          <p className="text-lg font-black text-white">{value}</p>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

import { todayIST, startOfMonthIST, endOfMonthIST, formatIST, parseISTDate } from "@/lib/dateUtils";

export default function MechanicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [mechanic, setMechanic] = useState<Mechanic | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("work");

  // Date filter state
  const [fromDate, setFromDate] = useState(() => startOfMonthIST());
  const [toDate, setToDate] = useState(() => todayIST());

  // Data states
  const [jobs, setJobs] = useState<Job[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  // Stats
  const [stats, setStats] = useState({
    totalEarned: 0,
    totalSalary: 0,
    totalCommission: 0,
    totalAdvance: 0,
    periodBalance: 0,
    overallBalance: 0,
    jobCount: 0,
    workingDays: 0,
    fullDays: 0,
    halfDays: 0,
    absentDays: 0,
  });

  const fetchMechanic = useCallback(async () => {
    const { data, error } = await supabase
      .from("mechanic_list")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      router.push("/mechanics");
      return;
    }
    setMechanic(data);
  }, [id, router]);

  const fetchData = useCallback(async () => {
    if (!mechanic) return;
    setLoading(true);

    const fromTs = `${fromDate} 00:00:00`;
    const toTs = `${toDate} 23:59:59`;

    // Fetch jobs for this mechanic
    const { data: jobsData } = await supabase
      .from("transaction_list")
      .select("id, job_id, item, mechanic_commission_amount, date_updated, status")
      .eq("mechanic_id", id)
      .in("status", [3, 5])
      .gte("date_updated", fromTs)
      .lte("date_updated", toTs)
      .order("date_updated", { ascending: false });

    // Fetch advances
    const { data: advData } = await supabase
      .from("advance_payments")
      .select("id, reason, amount, date_paid")
      .eq("mechanic_id", id)
      .gte("date_paid", fromDate)
      .lte("date_paid", toDate)
      .order("date_paid", { ascending: false });

    // Fetch attendance
    const { data: attData } = await supabase
      .from("attendance_list")
      .select("id, curr_date, status")
      .eq("mechanic_id", id)
      .gte("curr_date", fromDate)
      .lte("curr_date", toDate)
      .order("curr_date", { ascending: false });

    setJobs(jobsData || []);
    setAdvances(advData || []);
    setAttendance(attData || []);

    // Calculate stats
    const totalCommission = (jobsData || []).reduce((s, j) => s + (j.mechanic_commission_amount || 0), 0);
    const fullDays = (attData || []).filter(a => a.status === 1).length;
    const halfDays = (attData || []).filter(a => a.status === 3).length;
    const totalSalary = fullDays * (mechanic.daily_salary || 0) + halfDays * ((mechanic.daily_salary || 0) / 2);
    const totalAdvance = (advData || []).reduce((s, a) => s + (a.amount || 0), 0);
    const totalEarned = totalSalary + totalCommission;
    const periodBalance = totalEarned - totalAdvance;

    // Overall balance (lifetime)
    const { data: allJobs } = await supabase
      .from("transaction_list")
      .select("mechanic_commission_amount")
      .eq("mechanic_id", id);
    const { data: allAtt } = await supabase
      .from("attendance_list")
      .select("status")
      .eq("mechanic_id", id)
      .in("status", [1, 3]);
    const { data: allAdv } = await supabase
      .from("advance_payments")
      .select("amount")
      .eq("mechanic_id", id);

    const allComm = (allJobs || []).reduce((s, j) => s + (j.mechanic_commission_amount || 0), 0);
    const allFull = (allAtt || []).filter(a => a.status === 1).length;
    const allHalf = (allAtt || []).filter(a => a.status === 3).length;
    const allSal = allFull * (mechanic.daily_salary || 0) + allHalf * ((mechanic.daily_salary || 0) / 2);
    const allAdvTotal = (allAdv || []).reduce((s, a) => s + (a.amount || 0), 0);
    const overallBalance = (allSal + allComm) - allAdvTotal;

    setStats({
      totalEarned,
      totalSalary,
      totalCommission,
      totalAdvance,
      periodBalance,
      overallBalance,
      jobCount: (jobsData || []).length,
      workingDays: fullDays + halfDays,
      fullDays,
      halfDays,
      absentDays: (attData || []).filter(a => a.status === 2).length,
    });

    setLoading(false);
  }, [id, mechanic, fromDate, toDate]);

  useEffect(() => { fetchMechanic(); }, [fetchMechanic]);
  useEffect(() => { if (mechanic) fetchData(); }, [mechanic, fetchData]);

  const name = mechanic ? [mechanic.firstname, mechanic.middlename, mechanic.lastname].filter(Boolean).join(" ") : "";

  const shiftMonth = (dir: -1 | 1) => {
    const cur = parseISTDate(fromDate);
    cur.setMonth(cur.getMonth() + dir);
    setFromDate(startOfMonthIST(cur));
    setToDate(endOfMonthIST(cur));
  };

  const setCurrentMonth = () => {
    setFromDate(startOfMonthIST());
    setToDate(todayIST());
  };

  const shareWhatsApp = () => {
    if (!mechanic) return;
    const text = `*Mechanic Report: ${name}*%0A` +
      `📅 Period: ${fromDate} to ${toDate}%0A%0A` +
      `💰 Earned: ₹${stats.totalEarned.toLocaleString("en-IN")}%0A` +
      `   ├─ Salary: ₹${stats.totalSalary.toLocaleString("en-IN")}%0A` +
      `   └─ Commission: ₹${stats.totalCommission.toLocaleString("en-IN")}%0A%0A` +
      `💸 Paid: ₹${stats.totalAdvance.toLocaleString("en-IN")}%0A%0A` +
      `⚖️ Balance: ₹${stats.periodBalance.toLocaleString("en-IN")}%0A%0A` +
      `📊 Overall: ₹${stats.overallBalance.toLocaleString("en-IN")}`;
    window.open(`https://wa.me/91${mechanic.contact}?text=${text}`);
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "work", label: "Work History", count: stats.jobCount },
    { key: "ledger", label: "Payment Ledger", count: advances.length },
    { key: "attendance", label: "Attendance", count: stats.workingDays },
  ];

  if (!mechanic && !loading) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/mechanics"
            className="p-2 rounded-xl bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 transition no-underline">
            <ArrowLeft size={16} />
          </Link>
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-black text-lg">
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-white">{name}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                mechanic?.status === 1 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-slate-500/10 border-slate-500/20 text-slate-500"
              }`}>
                {mechanic?.status === 1 ? "Active" : "Inactive"}
              </span>
              <span className="text-xs text-slate-500">{mechanic?.contact}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400">
                <Wrench size={9}/> {mechanic?.designation || "Mechanic"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={shareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/20 rounded-xl text-xs font-bold transition">
              <MessageSquare size={13}/> WhatsApp
            </button>
            <button onClick={() => window.open(`/api/print-mechanic-detail?id=${id}&from=${fromDate}&to=${toDate}`, "_blank")}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1e2637] border border-[#2a3550] text-slate-400 hover:bg-[#252f45] rounded-xl text-xs font-bold transition">
              <Printer size={13}/> Print
            </button>
            <Link href={`/mechanics/${id}/ledger`}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 rounded-xl text-xs font-bold no-underline transition">
              <FileText size={13}/> Ledger
            </Link>
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mr-2">Period:</span>
          <button onClick={() => shiftMonth(-1)}
            className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 transition">
            <ChevronLeft size={14} />
          </button>
          <div className="flex items-center gap-2">
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="px-3 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-lg text-xs text-slate-200 outline-none focus:border-blue-500"/>
            <span className="text-slate-600 text-xs">—</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="px-3 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-lg text-xs text-slate-200 outline-none focus:border-blue-500"/>
          </div>
          <button onClick={() => shiftMonth(1)}
            className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 transition">
            <ChevronRight size={14} />
          </button>
          <button onClick={setCurrentMonth}
            className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-lg text-xs font-bold transition">
            This Month
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<DollarSign size={18}/>} label="Total Earned" value={inr(stats.totalEarned)} sub={`Salary: ${inr(stats.totalSalary)} | Comm: ${inr(stats.totalCommission)}`} color="blue" />
        <StatCard icon={<TrendingUp size={18}/>} label="Total Advance" value={inr(stats.totalAdvance)} sub={`${advances.length} payments`} color="red" />
        <StatCard icon={stats.periodBalance >= 0 ? <TrendingUp size={18}/> : <TrendingUp size={18}/>} label="Period Balance" value={inr(stats.periodBalance)} sub={stats.periodBalance >= 0 ? "Payable to Staff" : "Advance Taken"} color={stats.periodBalance >= 0 ? "amber" : "red"} />
        <StatCard icon={<Users size={18}/>} label="Overall Balance" value={inr(stats.overallBalance)} sub="Lifetime Pending" color="emerald" />
      </div>

      {/* Summary Bar */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
          <div className="border-r border-[#21293d] pr-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Jobs</p>
            <p className="text-xl font-black text-blue-400">{stats.jobCount}</p>
          </div>
          <div className="border-r border-[#21293d] pr-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Avg Commission</p>
            <p className="text-xl font-black text-amber-400">{stats.jobCount > 0 ? inr(stats.totalCommission / stats.jobCount) : inr(0)}</p>
          </div>
          <div className="border-r border-[#21293d] pr-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Working Days</p>
            <p className="text-xl font-black text-teal-400">{stats.workingDays}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Avg Daily Earn</p>
            <p className="text-xl font-black text-emerald-400">{stats.workingDays > 0 ? inr(stats.totalEarned / stats.workingDays) : inr(0)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="flex border-b border-[#21293d] overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-blue-500 text-blue-400 bg-blue-500/5"
                  : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5"
              }`}>
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.key ? "bg-blue-500/20 text-blue-400" : "bg-slate-500/20 text-slate-500"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="p-5">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 size={24} className="animate-spin text-slate-600 mx-auto mb-2"/>
              <p className="text-slate-600 text-xs font-black uppercase">Loading...</p>
            </div>
          ) : (
            <>
              {/* Work History Tab */}
              {activeTab === "work" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#111520]">
                      <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                        <th className="text-left px-4 py-3">Date</th>
                        <th className="text-left px-4 py-3">Job ID</th>
                        <th className="text-left px-4 py-3">Item/Service</th>
                        <th className="text-right px-4 py-3">Commission</th>
                        <th className="text-center px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a2234]">
                      {jobs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-slate-600">
                            <Wrench size={32} className="mx-auto mb-2 text-slate-700"/>
                            <p>No work history found</p>
                          </td>
                        </tr>
                      ) : jobs.map(job => (
                        <tr key={job.id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {new Date(job.date_updated).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/jobs/${job.id}`} className="font-bold text-blue-400 hover:text-blue-300 no-underline">
                              {job.job_id}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-slate-400">{job.item}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-400">{inr(job.mechanic_commission_amount)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                              <CheckCircle size={9}/> Completed
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Payment Ledger Tab */}
              {activeTab === "ledger" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#111520]">
                      <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                        <th className="text-left px-4 py-3">Date</th>
                        <th className="text-left px-4 py-3">Note</th>
                        <th className="text-right px-4 py-3">Amount</th>
                        <th className="text-center px-4 py-3">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a2234]">
                      {advances.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-12 text-center text-slate-600">
                            <DollarSign size={32} className="mx-auto mb-2 text-slate-700"/>
                            <p>No payments found</p>
                          </td>
                        </tr>
                      ) : advances.map(adv => (
                        <tr key={adv.id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {new Date(adv.date_paid).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-4 py-3 text-slate-400">{adv.reason}</td>
                          <td className="px-4 py-3 text-right font-bold text-red-400">{inr(adv.amount)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-400">
                              Advance
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Attendance Tab */}
              {activeTab === "attendance" && (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-emerald-400">{stats.fullDays}</p>
                      <p className="text-[10px] font-black uppercase text-slate-500">Full Days</p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-amber-400">{stats.halfDays}</p>
                      <p className="text-[10px] font-black uppercase text-slate-500">Half Days</p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-red-400">{stats.absentDays}</p>
                      <p className="text-[10px] font-black uppercase text-slate-500">Absent</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#111520]">
                        <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                          <th className="text-left px-4 py-3">Date</th>
                          <th className="text-left px-4 py-3">Day</th>
                          <th className="text-center px-4 py-3">Status</th>
                          <th className="text-right px-4 py-3">Salary</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1a2234]">
                        {attendance.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-12 text-center text-slate-600">
                              <Calendar size={32} className="mx-auto mb-2 text-slate-700"/>
                              <p>No attendance records found</p>
                            </td>
                          </tr>
                        ) : attendance.map(att => {
                          const dayRate = mechanic?.daily_salary || 0;
                          let daySalary = 0;
                          let statusClass = "bg-slate-500/10 text-slate-500";
                          let statusText = "Absent";
                          if (att.status === 1) {
                            daySalary = dayRate;
                            statusClass = "bg-emerald-500/10 text-emerald-400";
                            statusText = "Full Day";
                          } else if (att.status === 3) {
                            daySalary = dayRate / 2;
                            statusClass = "bg-amber-500/10 text-amber-400";
                            statusText = "Half Day";
                          }
                          return (
                            <tr key={att.id} className="hover:bg-white/[0.02]">
                              <td className="px-4 py-3 text-slate-300 text-xs">
                                {new Date(att.curr_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              </td>
                              <td className="px-4 py-3 text-slate-400 text-xs">
                                {new Date(att.curr_date).toLocaleDateString("en-IN", { weekday: "long" })}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClass}`}>
                                  {att.status === 1 ? <CheckCircle size={9}/> : att.status === 3 ? <Clock size={9}/> : <XCircle size={9}/>}
                                  {statusText}
                                </span>
                              </td>
                              <td className={`px-4 py-3 text-right font-bold ${daySalary > 0 ? "text-emerald-400" : "text-slate-600"}`}>
                                {inr(daySalary)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
