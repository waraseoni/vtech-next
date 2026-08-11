"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import {
  Loader2, ArrowLeft, Calendar, DollarSign, TrendingUp, Users,
  Wrench, FileText, Clock, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, MessageSquare, Printer,
  Camera, Trash2, CreditCard, IndianRupee
} from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import { logActivity } from "@/lib/activity";

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
  image_path?: string | null;
};

type Job = {
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

import { todayIST, startOfMonthIST, endOfMonthIST, parseISTDate } from "@/lib/dateUtils";

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
  
  // Pagination
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

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

  // ── SALARY RATE HISTORY ─────────────────────────────────────────
  const [salaryHist, setSalaryHist] = useState<{ effective_date: string; salary: string }[]>([]);

  // PHP: latest rate with effective_date <= day (ORDER effective_date DESC, id DESC)
  const getRate = (dateStr: string) => {
    const h = salaryHist.find(x => x.effective_date <= dateStr);
    return h ? parseFloat(h.salary) : (mechanic?.daily_salary || 0);
  };

  // ── ADD PAYMENT ─────────────────────────────────────────────────
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() => todayIST());
  const [payReason, setPayReason] = useState("");
  const [savingPay, setSavingPay] = useState(false);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mechanic || !payAmount) return;
    setSavingPay(true);
    try {
      const amt = parseFloat(payAmount);
      const { error } = await supabase.from("advance_payments").insert([{
        mechanic_id: mechanic.id,
        amount: amt,
        date_paid: payDate,
        reason: payReason || `Advance Payment`
      }]);
      if (error) throw error;
      await logActivity("Staff Payment", "Mechanics", mechanic.id, `Paid ${inr(amt)} to ${name}`);
      setShowPayModal(false);
      setPayAmount("");
      setPayReason("");
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPay(false);
    }
  };

  // ── MECHANIC PHOTO ─────────────────────────────────────────
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoErr,    setPhotoErr]    = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoSaving(true);
    setPhotoErr("");
    try {
      const compressed = await compressImage(file);
      if (compressed.bytes > 100 * 1024) {
        setPhotoErr("Image abhi bhi 100KB se bada hai — kam resolution ki photo try karein");
        setPhotoSaving(false);
        return;
      }
      const fd = new FormData();
      fd.append("file", compressed.file);
      fd.append("mechanicId", String(id));
      const res = await fetch("/api/mechanic-photo", { method: "POST", body: fd });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.msg || "Upload failed");
      setMechanic(prev => prev ? { ...prev, image_path: json.url } : prev);
      setPhotoSaving(false);
    } catch (err: unknown) {
      setPhotoErr(err instanceof Error ? err.message : "Upload failed");
      setPhotoSaving(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!confirm("Kya aap mechanic ki photo delete karna chahte hain?")) return;
    setPhotoSaving(true);
    setPhotoErr("");
    try {
      const fd = new FormData();
      fd.append("mechanicId", String(id));
      fd.append("delete", "1");
      const res = await fetch("/api/mechanic-photo", { method: "POST", body: fd });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.msg || "Delete failed");
      setMechanic(prev => prev ? { ...prev, image_path: null } : prev);
      setPhotoSaving(false);
    } catch (err: unknown) {
      setPhotoErr(err instanceof Error ? err.message : "Delete failed");
      setPhotoSaving(false);
    }
  };

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

    const fromTs = `${fromDate}T00:00:00+05:30`;
    const toTs = `${toDate}T23:59:59+05:30`;

    // PHP view_mechanic: only DELIVERED (status=5), filtered by date_completed.
    // Display date column uses date_updated (PHP: date("d M, Y", strtotime(date_updated))).
    const { data: jobsData } = await supabase
      .from("transaction_list")
      .select("id, job_id, item, amount, mechanic_commission_amount, date_updated, date_completed, status")
      .eq("mechanic_id", id)
      .eq("status", 5)
      .gte("date_completed", fromTs)
      .lte("date_completed", toTs)
      .order("date_completed", { ascending: false });

    const jobs = jobsData || [];

    // PHP: Service Charge = SUM(transaction_services.price)
    const svcMap: Record<number, number> = {};
    if (jobs.length > 0) {
      const { data: svcs } = await supabase
        .from("transaction_services")
        .select("transaction_id, price")
        .in("transaction_id", jobs.map(j => j.id));
      (svcs || []).forEach(s => {
        svcMap[s.transaction_id] = (svcMap[s.transaction_id] || 0) + (s.price || 0);
      });
    }
    const jobsWithSvc = jobs.map(j => ({ ...j, service_amount: svcMap[j.id] || 0 }));

    // PHP: per-day rate from mechanic_salary_history (effective_date <= day)
    const { data: salaryHistData } = await supabase
      .from("mechanic_salary_history")
      .select("salary, effective_date")
      .eq("mechanic_id", id)
      .order("effective_date", { ascending: false })
      .order("id", { ascending: false });
    const hist = salaryHistData || [];
    setSalaryHist(hist);

    const localGetRate = (dateStr: string) => {
      const h = hist.find(x => x.effective_date <= dateStr);
      return h ? parseFloat(h.salary) : (mechanic.daily_salary || 0);
    };

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

    setJobs(jobsWithSvc);
    setAdvances(advData || []);
    setAttendance(attData || []);

    // ── Period stats (PHP: history-aware salary, status=5 commission) ──
    const totalCommission = jobsWithSvc.reduce((s, j) => s + (j.mechanic_commission_amount || 0), 0);
    const fullDays = (attData || []).filter(a => a.status === 1).length;
    const halfDays = (attData || []).filter(a => a.status === 3).length;
    let totalSalary = 0;
    (attData || []).forEach(att => {
      const rate = localGetRate(att.curr_date);
      totalSalary += att.status === 1 ? rate : rate / 2;
    });
    const totalAdvance = (advData || []).reduce((s, a) => s + (a.amount || 0), 0);
    const totalEarned = totalSalary + totalCommission;
    const periodBalance = totalEarned - totalAdvance;

    // ── Overall balance (lifetime) ──
    const [allJobs, allAtt, allAdv] = await Promise.all([
      supabase.from("transaction_list").select("mechanic_commission_amount").eq("mechanic_id", id),
      supabase.from("attendance_list").select("curr_date, status").eq("mechanic_id", id).in("status", [1, 3]),
      supabase.from("advance_payments").select("amount").eq("mechanic_id", id),
    ]);
    const allComm = (allJobs.data || []).reduce((s, j) => s + (j.mechanic_commission_amount || 0), 0);
    let allSal = 0;
    (allAtt.data || []).forEach(att => {
      const rate = localGetRate(att.curr_date);
      allSal += att.status === 1 ? rate : rate / 2;
    });
    const allAdvTotal = (allAdv.data || []).reduce((s, a) => s + (a.amount || 0), 0);
    const overallBalance = (allSal + allComm) - allAdvTotal;

    setStats({
      totalEarned,
      totalSalary,
      totalCommission,
      totalAdvance,
      periodBalance,
      overallBalance,
      jobCount: jobsWithSvc.length,
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
          <div className="relative flex-shrink-0">
            {mechanic?.image_path ? (
              <Image src={mechanic.image_path} alt={name}
                width={56} height={56} unoptimized
                className="w-14 h-14 rounded-xl object-cover shadow-lg border border-white/10 flex-shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-black text-lg">
                {name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <button onClick={() => photoRef.current?.click()} disabled={photoSaving}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg border-2 border-[#161b27] transition-colors disabled:opacity-60"
              title="Photo upload">
              {photoSaving ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            </button>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
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
              {mechanic?.image_path && (
                <button onClick={handlePhotoDelete} disabled={photoSaving}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-60">
                  <Trash2 size={9}/> Photo Delete
                </button>
              )}
            </div>
            {photoErr && <p className="text-[11px] text-red-400 font-semibold mt-1.5">{photoErr}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPayModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-xs font-bold transition">
              <CreditCard size={13}/> Add Payment
            </button>
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
              {activeTab === "work" && (() => {
                const totalJobPages = Math.ceil(jobs.length / itemsPerPage);
                const paginatedJobs = itemsPerPage === -1 ? jobs : jobs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                const totalSvc = jobs.reduce((s, j) => s + (j.service_amount || 0), 0);
                const totalComm = jobs.reduce((s, j) => s + (j.mechanic_commission_amount || 0), 0);
                return (
                <div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#111520]">
                        <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                          <th className="text-left px-4 py-3">Date</th>
                          <th className="text-left px-4 py-3">Job ID</th>
                          <th className="text-left px-4 py-3">Item/Service</th>
                          <th className="text-right px-4 py-3">Service Charge</th>
                          <th className="text-right px-4 py-3">Commission</th>
                          <th className="text-center px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1a2234]">
                        {paginatedJobs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-slate-600">
                              <Wrench size={32} className="mx-auto mb-2 text-slate-700"/>
                              <p>No work history found</p>
                            </td>
                          </tr>
                        ) : paginatedJobs.map(job => (
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
                            <td className="px-4 py-3 text-right font-bold text-white">{inr(job.service_amount || 0)}</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-400">{inr(job.mechanic_commission_amount)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                                <CheckCircle size={9}/> Completed
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {jobs.length > 0 && (
                        <tfoot>
                          <tr className="bg-[#111520] text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <td colSpan={3} className="text-right px-4 py-3 text-slate-600">Period Total ({jobs.length} jobs):</td>
                            <td className="text-right px-4 py-3 text-white">{inr(totalSvc)}</td>
                            <td className="text-right px-4 py-3 text-emerald-400">{inr(totalComm)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                  {totalJobPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-4 border-t border-[#21293d]">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>Show</span>
                        <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="bg-[#0d1117] border border-[#21293d] rounded-lg px-2 py-1.5 text-white text-xs font-bold">
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={-1}>All</option>
                        </select>
                        <span>of {jobs.length} entries</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-lg text-xs font-bold text-slate-400 hover:bg-[#1a2234] disabled:opacity-40 disabled:cursor-not-allowed">
                          <ChevronLeft size={14} />
                        </button>
                        {Array.from({ length: Math.min(5, totalJobPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalJobPages <= 5) pageNum = i + 1;
                          else if (currentPage <= 3) pageNum = i + 1;
                          else if (currentPage >= totalJobPages - 2) pageNum = totalJobPages - 4 + i;
                          else pageNum = currentPage - 2 + i;
                          return (
                            <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currentPage === pageNum ? 'bg-blue-600 text-white' : 'bg-[#0d1117] border border-[#21293d] text-slate-400 hover:bg-[#1a2234]'}`}>
                              {pageNum}
                            </button>
                          );
                        })}
                        <button onClick={() => setCurrentPage(p => Math.min(totalJobPages, p + 1))} disabled={currentPage === totalJobPages} className="px-3 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-lg text-xs font-bold text-slate-400 hover:bg-[#1a2234] disabled:opacity-40 disabled:cursor-not-allowed">
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )})()}

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
                          const dayRate = getRate(att.curr_date);
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

      {/* Add Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowPayModal(false); }}>
          <div className="bg-[#161b27] border border-[#21293d] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
              <h3 className="text-lg font-black text-emerald-400 flex items-center gap-2"><CreditCard size={20}/> New Payment</h3>
              <button onClick={() => setShowPayModal(false)} className="text-slate-600 hover:text-white transition-colors">
                <ChevronLeft className="rotate-180" />
              </button>
            </div>
            <form onSubmit={handleAddPayment} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Staff Member</label>
                <input value={name} readOnly className="w-full px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-300 font-bold outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Amount (₹)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                  <input type="number" step="1" value={payAmount} onChange={e => setPayAmount(e.target.value)} required placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-xl text-xl font-black text-white outline-none focus:border-emerald-500 transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Payment Date</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} required
                  className="w-full px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-emerald-500 transition-all [color-scheme:dark]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Remarks</label>
                <textarea value={payReason} onChange={e => setPayReason(e.target.value)} placeholder="e.g. Advance, Salary for July 2026"
                  className="w-full px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-emerald-500 transition-all resize-none h-20" />
              </div>
              <button type="submit" disabled={savingPay} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2">
                {savingPay ? <Loader2 className="animate-spin" size={18} /> : "Save Payment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
