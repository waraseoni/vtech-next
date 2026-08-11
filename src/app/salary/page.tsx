"use client";
import { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Loader2, ChevronLeft, ChevronRight, Printer, X, Edit2, DollarSign, Wallet, ArrowUpRight, ArrowDownRight, Activity, History, Trash2, Check, RotateCcw } from "lucide-react";
import { todayIST, currentMonthIST, parseISTDate, toISTString } from "@/lib/dateUtils";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type SalaryHistory = { id: number; mechanic_id: number; salary: number; effective_date: string };
type Mechanic = { id: number; firstname: string; middlename: string | null; lastname: string; daily_salary: number; designation: string | null; last_updated?: string | null };

type DbRow = ReturnType<typeof JSON.parse>;
type RangeQuery = { range: (from: number, to: number) => PromiseLike<{ data: DbRow[] | null; error: unknown }> };

type SalaryRow = {
  id: number; name: string; daily_salary: number;
  present_count: number; half_day_count: number;
  current_fix: number; current_comm: number;
  old_balance: number; current_adv: number; net_final: number;
};

// Helper to get the correct salary rate for a specific date based on history
const getEffectiveRate = (mechanicId: number, dateStr: string, defaultRate: number, history: SalaryHistory[]) => {
  const applicableRate = history.find(h => h.mechanic_id === mechanicId && h.effective_date <= dateStr);
  return applicableRate ? applicableRate.salary : defaultRate;
};

function SalaryContent() {
  const searchParams = useSearchParams();
  const currentMonth = currentMonthIST();
  const [month, setMonth] = useState(searchParams.get("month") || currentMonth);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SalaryRow[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  
  // Modals & Tabs
  const [activeTab, setActiveTab] = useState<"report" | "control">("report");
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTarget, setPayTarget] = useState<{ id: number; name: string; amount: number } | null>(null);
  
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerTarget, setLedgerTarget] = useState<{ id: number; name: string; default_salary: number } | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState<DbRow[]>([]);
  const [ledgerFrom, setLedgerFrom] = useState("");
  const [, setLedgerTo] = useState("");
  
  const [salaryRateModal, setSalaryRateModal] = useState(false);
  const [salaryTarget, setSalaryTarget] = useState<{ id: number; name: string; salary: number } | null>(null);
  const [newSalary, setNewSalary] = useState("");
  const [newEffectiveDate, setNewEffectiveDate] = useState(todayIST());
  
  const [historyModal, setHistoryModal] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{ id: number; name: string } | null>(null);
  const [historyEntries, setHistoryEntries] = useState<SalaryHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SalaryHistory | null>(null);
  const [editSalary, setEditSalary] = useState("");
  const [editDate, setEditDate] = useState("");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Active Mechanics
      const { data: mechData } = await supabase
        .from("mechanic_list")
        .select("id, firstname, middlename, lastname, daily_salary, designation")
        .eq("status", 1)
        .eq("delete_flag", 0)
        .order("firstname");
        
      const rawMechs = mechData || [];
      const mechIds = rawMechs.map(m => m.id);

      if (mechIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Date Boundaries
      const monthStart = `${month}-01`;
      const [year, m] = month.split("-").map(Number);
      const lastDay = new Date(year, m, 0).getDate();
      const nextMonthStart = `${month}-${String(lastDay).padStart(2, "0")}T23:59:59+05:30`;

      // Helper to fully exhaust pagination
      const fetchAllData = async (queryBuilder: RangeQuery) => {
        const allData: DbRow[] = [];
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await queryBuilder.range(from, from + 999);
          if (error) { console.error(error); break; }
          if (data && data.length > 0) {
            allData.push(...data);
            from += 1000;
            if (data.length < 1000) hasMore = false;
          } else {
            hasMore = false;
          }
        }
        return allData;
      };

      // 2. Bulk Fetch all related data safely (Bypasses Supabase 1000 rows max API limit)
      const [allAtt, allComm, allAdv, allHist] = await Promise.all([
        fetchAllData(supabase.from("attendance_list").select("mechanic_id, curr_date, status").in("mechanic_id", mechIds).in("status", [1, 3]).lte("curr_date", nextMonthStart.slice(0, 10))),
        fetchAllData(supabase.from("transaction_list").select("mechanic_id, mechanic_commission_amount, status, date_completed").in("mechanic_id", mechIds).eq("status", 5).lte("date_completed", nextMonthStart)),
        fetchAllData(supabase.from("advance_payments").select("mechanic_id, amount, date_paid").in("mechanic_id", mechIds).lte("date_paid", nextMonthStart.slice(0, 10))),
        fetchAllData(supabase.from("mechanic_salary_history").select("*").in("mechanic_id", mechIds).order("effective_date", { ascending: false }).order("id", { ascending: false }))
      ]);

      const histList = allHist || [];
      const commList = (allComm || []).map(c => ({ ...c, istMonth: toISTString(new Date(c.date_completed)).slice(0, 7) }));
      const advList = allAdv || [];
      const attList = allAtt || [];

      // 3. Process Data Locally
      const enrichedMechs = rawMechs.map((m) => {
        const histForMech = histList.filter(h => h.mechanic_id === m.id);
        const latestHist = histForMech.reduce((a, b) => (a && a.id > b.id ? a : b), null);
        return { 
          ...m, 
          designation: m.designation || null,
          last_updated: latestHist?.date_created || null
        };
      });
      setMechanics(enrichedMechs);

      const salaryRows: SalaryRow[] = enrichedMechs.map((m) => {
        const name = [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ");
        const defaultSal = m.daily_salary || 0;

        // --- OLD BALANCE (Everything strictly before monthStart) ---
        let earnedPrev = 0;
        attList.filter(a => a.mechanic_id === m.id && a.curr_date < monthStart).forEach(a => {
          const rate = getEffectiveRate(m.id, a.curr_date, defaultSal, histList);
          earnedPrev += (a.status === 3 ? rate / 2 : rate);
        });

        const commPrevSum = commList.filter(c => c.mechanic_id === m.id && c.istMonth < month)
                                    .reduce((s, c) => s + (c.mechanic_commission_amount || 0), 0);
        
        const advPrevSum = advList.filter(a => a.mechanic_id === m.id && a.date_paid < monthStart)
                                  .reduce((s, a) => s + (a.amount || 0), 0);
                                  
        const oldBalance = earnedPrev + commPrevSum - advPrevSum;

        // --- CURRENT MONTH (>= monthStart AND < nextMonthStart) ---
        let currentFix = 0;
        let presentCount = 0;
        let halfDayCount = 0;

        attList.filter(a => a.mechanic_id === m.id && a.curr_date >= monthStart && a.curr_date < nextMonthStart).forEach(a => {
          const rate = getEffectiveRate(m.id, a.curr_date, defaultSal, histList);
          if (a.status === 3) {
            halfDayCount++;
            currentFix += (rate / 2);
          } else {
            presentCount++;
            currentFix += rate;
          }
        });

        const currentComm = commList.filter(c => c.mechanic_id === m.id && c.istMonth === month)
                                    .reduce((s, c) => s + (c.mechanic_commission_amount || 0), 0);

        const currentAdv = advList.filter(a => a.mechanic_id === m.id && a.date_paid >= monthStart && a.date_paid < nextMonthStart)
                                  .reduce((s, a) => s + (a.amount || 0), 0);

        const netFinal = oldBalance + currentFix + currentComm - currentAdv;

        return {
          id: m.id, name, daily_salary: defaultSal,
          present_count: presentCount, half_day_count: halfDayCount,
          current_fix: currentFix, current_comm: currentComm,
          old_balance: oldBalance, current_adv: currentAdv, net_final: netFinal
        };
      });

      setRows(salaryRows);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  }, [month]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const navigate = (dir: "prev" | "next") => {
    const d = parseISTDate(month + "-01");
    if (dir === "prev") d.setMonth(d.getMonth() - 1);
    else d.setMonth(d.getMonth() + 1);
    setMonth(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(d));
  };

  const openLedger = async (r: SalaryRow) => {
    const from = `${month}-01`;
    const [year, m] = month.split("-").map(Number);
    const lastDay = new Date(year, m, 0).getDate();
    const nextMonthBoundary = `${month}-${String(lastDay).padStart(2, "0")}T23:59:59+05:30`;
    const to = nextMonthBoundary.slice(0, 10);

    setLedgerTarget({ id: r.id, name: r.name, default_salary: r.daily_salary });
    setLedgerFrom(from); setLedgerTo(to);
    setLedgerData([]); setShowLedgerModal(true); setLedgerLoading(true);

    try {
      // Fetch historical rates for this specific mechanic to ensure ledger matches main report
      const { data: histList } = await supabase.from("mechanic_salary_history").select("*").eq("mechanic_id", r.id).order("effective_date", { ascending: false });
      const history = histList || [];

      const fetchAllData = async (queryBuilder: RangeQuery) => {
        const allData: DbRow[] = [];
        let from = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await queryBuilder.range(from, from + 999);
          if (error) { console.error(error); break; }
          if (data && data.length > 0) {
            allData.push(...data);
            from += 1000;
            if (data.length < 1000) hasMore = false;
          } else {
            hasMore = false;
          }
        }
        return allData;
      };

      const [attAll, attPrev, commAllData, advAll, advPrev] = await Promise.all([
        fetchAllData(supabase.from("attendance_list").select("curr_date, status").eq("mechanic_id", r.id).in("status", [1, 3]).gte("curr_date", from).lte("curr_date", to)),
        fetchAllData(supabase.from("attendance_list").select("curr_date, status").eq("mechanic_id", r.id).in("status", [1, 3]).lt("curr_date", from)),
        fetchAllData(supabase.from("transaction_list").select("job_id, code, mechanic_commission_amount, status, date_completed").eq("mechanic_id", r.id).eq("status", 5).lte("date_completed", nextMonthBoundary)),
        fetchAllData(supabase.from("advance_payments").select("amount, date_paid").eq("mechanic_id", r.id).gte("date_paid", from).lte("date_paid", to)),
        fetchAllData(supabase.from("advance_payments").select("amount").eq("mechanic_id", r.id).lt("date_paid", from))
      ]);

      const commAll = (commAllData || []).filter(c => toISTString(new Date(c.date_completed)).slice(0, 7) === month);
      const cp = (commAllData || []).filter(c => toISTString(new Date(c.date_completed)).slice(0, 7) < month).reduce((s, x) => s + (x.mechanic_commission_amount || 0), 0);

      // Calc opening balance accurately with historical rates
      let ep = 0;
      (attPrev || []).forEach(a => {
        const rate = getEffectiveRate(r.id, a.curr_date, r.daily_salary, history);
        ep += (a.status === 3 ? rate / 2 : rate);
      });
      const ap = advPrev?.reduce((s, x) => s + (x.amount || 0), 0) || 0;
      
      let running = ep + cp - ap;
      const entries: DbRow[] = [];
      if (running !== 0) entries.push({ date: "Opening", status: "—", wage: running, comm: 0, adv: 0, balance: running, type: "opening" });

      const dates = new Set([...(attAll?.map((a) => a.curr_date) || []), ...(commAll?.map((c) => toISTString(new Date(c.date_completed)).split("T")[0]) || []), ...(advAll?.map((a) => a.date_paid) || [])]);
      
      for (const d of Array.from(dates).sort()) {
        const att = attAll?.find((a) => a.curr_date === d);
        let wage = 0, attStatus = "Absent";
        
        if (att) { 
          const dayRate = getEffectiveRate(r.id, d, r.daily_salary, history);
          if (att.status === 1) { wage = dayRate; attStatus = "Present"; } 
          else if (att.status === 3) { wage = dayRate / 2; attStatus = "Half Day"; } 
        }
        
        const comm = commAll?.filter((c) => {
          const istD = toISTString(new Date(c.date_completed)).split("T")[0];
          return istD === d;
        }).reduce((s, c) => s + (c.mechanic_commission_amount || 0), 0) || 0;
        const adv = advAll?.filter((a) => a.date_paid === d).reduce((s, a) => s + (a.amount || 0), 0) || 0;
        
        running += wage + comm - adv;
        entries.push({ date: new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), status: attStatus, wage, comm, adv, balance: running });
      }
      setLedgerData(entries);
    } catch (e) { console.error(e); }
    finally { setLedgerLoading(false); }
  };

  const handlePaySalary = async () => {
    if (!payTarget) return;
    await supabase.from("advance_payments").insert({ mechanic_id: payTarget.id, amount: payTarget.amount, date_paid: todayIST(), reason: `Salary Settlement for ${monthLabel}` });
    setShowPayModal(false); setPayTarget(null); fetchReport();
  };

  const handleUpdateSalary = async () => {
    if (!salaryTarget || !newSalary || !newEffectiveDate) return;
    await supabase.from("mechanic_salary_history").insert({ mechanic_id: salaryTarget.id, salary: parseFloat(newSalary), effective_date: newEffectiveDate });
    await supabase.from("mechanic_list").update({ daily_salary: parseFloat(newSalary) }).eq("id", salaryTarget.id);
    setSalaryRateModal(false); setSalaryTarget(null); setNewSalary(""); fetchReport();
  };

  const openHistory = async (id: number, name: string) => {
    setHistoryTarget({ id, name });
    setHistoryModal(true);
    setHistoryLoading(true);
    const { data } = await supabase.from("mechanic_salary_history").select("*").eq("mechanic_id", id).order("effective_date", { ascending: false });
    setHistoryEntries(data || []);
    setHistoryLoading(false);
  };

  const handleDeleteHistory = async (entryId: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    const { error } = await supabase.from("mechanic_salary_history").delete().eq("id", entryId);
    if (!error && historyTarget) openHistory(historyTarget.id, historyTarget.name);
    fetchReport();
  };

  const handleUpdateHistoryEntry = async () => {
    if (!editingEntry || !editSalary || !editDate) return;
    const { error } = await supabase.from("mechanic_salary_history").update({ salary: parseFloat(editSalary), effective_date: editDate }).eq("id", editingEntry.id);
    if (!error) {
      setEditingEntry(null);
      if (historyTarget) openHistory(historyTarget.id, historyTarget.name);
      fetchReport();
    }
  };

  const monthLabel = new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // Summary Metrics
  const summaryTotals = useMemo(() => {
    return rows.reduce((acc, row) => ({
      payout: acc.payout + (row.net_final > 0 ? row.net_final : 0),
      advances: acc.advances + row.current_adv,
      commissions: acc.commissions + row.current_comm
    }), { payout: 0, advances: 0, commissions: 0 });
  }, [rows]);

  return (
    <div className="space-y-5">
      {/* Header (Hide on Print) */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2"><Wallet size={22} className="text-blue-500" /> Salary Management</h1>
          <p className="text-sm text-slate-500 mt-1">V-Tech Electronics Staff & Commission Reports</p>
        </div>
        <button onClick={() => window.open(`/api/print-salary?month=${month}`, "_blank")} className="flex items-center gap-2 px-5 py-2.5 bg-[#161b27] border border-[#21293d] rounded-xl text-sm font-bold text-slate-300 hover:text-white hover:border-blue-500/50 hover:bg-[#1c2231] transition-all shadow-sm"><Printer size={16} /> Print Report</button>
      </div>

      {/* Print Only Header */}
      <div className="hidden print:block text-center mb-6">
        <h2 className="text-2xl font-black text-black">V-Tech Electronics</h2>
        <p className="text-gray-600 font-bold">Salary Statement: {monthLabel}</p>
      </div>

      <div className="flex gap-2 print:hidden bg-[#161b27] p-1.5 rounded-2xl border border-[#21293d] w-max">
        {(["report", "control"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === t ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" : "text-slate-400 hover:text-slate-200"}`}>
            {t === "report" ? "Salary Report" : "Salary Rate Master"}
          </button>
        ))}
      </div>

      {activeTab === "report" && (
        <div className="space-y-4">
          
          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
            <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 flex items-center justify-between">
              <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Payable</p><h3 className="text-xl font-black text-emerald-400">{inr(summaryTotals.payout)}</h3></div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500"><ArrowUpRight size={20} /></div>
            </div>
            <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 flex items-center justify-between">
              <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Month Advances</p><h3 className="text-xl font-black text-red-400">{inr(summaryTotals.advances)}</h3></div>
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500"><ArrowDownRight size={20} /></div>
            </div>
            <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 flex items-center justify-between">
              <div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Commissions</p><h3 className="text-xl font-black text-blue-400">{inr(summaryTotals.commissions)}</h3></div>
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500"><Activity size={20} /></div>
            </div>
          </div>

          {/* Month Navigator */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3 print:hidden">
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => navigate("prev")} className="w-10 h-10 flex items-center justify-center bg-[#111520] border border-[#21293d] rounded-full text-slate-400 hover:text-white hover:border-blue-500/50 hover:bg-[#1c2231] transition-all"><ChevronLeft size={16} /></button>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-4 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-sm font-black text-white outline-none focus:border-blue-500/50 text-center" />
              {month !== currentMonth && (
                <button
                  onClick={() => setMonth(currentMonth)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl text-xs font-bold transition-all"
                  title="Reset filter to current month"
                >
                  <RotateCcw size={13} />
                  Reset
                </button>
              )}
              <button onClick={() => navigate("next")} className="w-10 h-10 flex items-center justify-center bg-[#111520] border border-[#21293d] rounded-full text-slate-400 hover:text-white hover:border-blue-500/50 hover:bg-[#1c2231] transition-all"><ChevronRight size={16} /></button>
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-[#161b27] print:bg-white border border-[#21293d] print:border-gray-300 rounded-2xl overflow-hidden print:rounded-none">
            <div className="overflow-x-auto">
              <table className="w-full print:text-black">
                <thead>
                  <tr className="bg-[#111520] print:bg-gray-100">
                    {["#", "Staff Name", "Attendance", "Earned Salary", "Commission", "Old Bal", "Advance", "Net Total", "Action"].map((h, idx) => (
                      <th key={h} className={`px-4 py-3 text-[10px] print:text-xs font-black uppercase text-slate-500 print:text-gray-800 tracking-widest text-left ${idx === 8 ? 'print:hidden' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]/50 print:divide-gray-300">
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-16"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto mb-2" /><p className="text-slate-500 text-xs font-bold">Crunching numbers...</p></td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-slate-500 text-sm font-bold">No staff records found.</td></tr>
                  ) : rows.map((r, i) => (
                    <tr key={r.id} className="hover:bg-white/[0.02] print:hover:bg-transparent transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-500 print:text-black text-center">{i + 1}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => openLedger(r)} className="text-sm font-black text-blue-400 print:text-black hover:text-blue-300 print:pointer-events-none transition-colors">{r.name}</button>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <Link
                          href={`/attendance?view=report&month=${month}`}
                          className="flex items-center gap-1.5 bg-[#111520] hover:bg-[#1a2030] border border-transparent hover:border-[#21293d] print:bg-transparent w-max px-2 py-1 rounded-lg print:p-0 transition-all group"
                          title="Click to view Attendance Monthly Report"
                        >
                          <span className="text-emerald-400 print:text-green-700 font-black group-hover:underline">{r.present_count}</span>
                          <span className="text-slate-600 print:text-black">|</span>
                          <span className="text-amber-400 print:text-orange-600 font-black group-hover:underline">{r.half_day_count}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-right text-slate-300 print:text-black">{inr(r.current_fix)}</td>
                      <td className="px-4 py-3 text-xs text-right font-bold text-blue-400 print:text-black">{inr(r.current_comm)}</td>
                      <td className={`px-4 py-3 text-xs text-right font-black ${r.old_balance < 0 ? "text-red-400 print:text-red-700" : "text-slate-400 print:text-black"}`}>{inr(r.old_balance)}</td>
                      <td className="px-4 py-3 text-xs text-right font-bold text-red-400 print:text-red-700">{inr(r.current_adv)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-black px-2.5 py-1.5 rounded-lg print:p-0 print:bg-transparent print:border-none ${r.net_final >= 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 print:text-green-700" : "bg-red-500/10 text-red-400 border border-red-500/20 print:text-red-700"}`}>
                          {inr(Math.abs(r.net_final))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right print:hidden">
                        {r.net_final > 0 ? (
                          <button onClick={() => setPayTarget({ id: r.id, name: r.name, amount: r.net_final })} className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-500 hover:text-white transition-all shadow-sm">
                            <DollarSign size={12} className="inline mr-1 -mt-0.5" />Pay
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 bg-[#111520] text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-wider">Settled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "control" && (
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#111520]">
                  {["#", "Staff Name", "Role", "Current Daily Wage", "Last Updated", "Action"].map((h) => (
                    <th key={h} className={`px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-widest text-left ${h === 'Last Updated' ? 'text-center' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21293d]/50">
                {mechanics.map((m, i) => (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 text-center">{i + 1}</td>
                    <td className="px-4 py-3 font-bold text-slate-200">{[m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ")}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{m.designation || "Technician"}</td>
                    <td className="px-4 py-3 text-sm font-black text-emerald-400">{inr(m.daily_salary)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 text-center">{m.last_updated ? new Date(m.last_updated).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : "N/A"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => { setSalaryTarget({ id: m.id, name: [m.firstname, m.lastname].join(" "), salary: m.daily_salary }); setNewSalary(String(m.daily_salary)); setSalaryRateModal(true); }} className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center gap-1.5">
                          <Edit2 size={12} /> Update
                        </button>
                        <button onClick={() => openHistory(m.id, [m.firstname, m.lastname].join(" "))} className="px-3 py-1.5 bg-slate-500/10 border border-[#21293d] text-slate-400 rounded-lg text-xs font-bold hover:bg-[#1c2231] hover:text-white transition-all flex items-center gap-1.5">
                          <History size={12} /> History
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {showPayModal && payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-black text-lg text-white mb-2">Issue Salary Payment</h3>
            <div className="bg-[#111520] border border-[#21293d] rounded-xl p-4 mb-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Staff Member</p>
              <p className="text-sm font-black text-slate-200 mb-3">{payTarget.name}</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Settlement Amount</p>
              <p className="text-2xl font-black text-emerald-400">{inr(payTarget.amount)}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handlePaySalary} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-black text-white shadow-lg shadow-emerald-900/20 transition-all">Confirm Payout</button>
              <button onClick={() => { setShowPayModal(false); setPayTarget(null); }} className="px-5 py-3 bg-[#111520] border border-[#21293d] text-slate-400 hover:text-white hover:bg-[#1c2231] rounded-xl text-sm font-bold transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Modal */}
      {showLedgerModal && ledgerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 bg-[#111520] border-b border-[#21293d]">
              <div>
                <h3 className="font-black text-white text-lg flex items-center gap-2"><Wallet size={18} className="text-blue-500"/> Passbook: {ledgerTarget.name}</h3>
                <p className="text-xs font-bold text-slate-500 mt-1">{new Date(ledgerFrom).toLocaleDateString('en-IN', {month:'short', year:'numeric'})}</p>
              </div>
              <button onClick={() => setShowLedgerModal(false)} className="w-9 h-9 flex items-center justify-center bg-[#161b27] border border-[#21293d] hover:border-slate-500 rounded-xl text-slate-400 hover:text-white transition-all"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-0">
              <table className="w-full">
                <thead className="sticky top-0 bg-[#161b27] shadow-sm z-10 border-b border-[#21293d]">
                  <tr>
                    {["Date", "Status", "Credit (Wage)", "Credit (Comm)", "Debit (Adv)", "Balance"].map((h) => (
                      <th key={h} className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 tracking-widest text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]/50">
                  {ledgerLoading ? (
                    <tr><td colSpan={6} className="text-center py-16"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></td></tr>
                  ) : ledgerData.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-slate-500 text-sm font-bold">No transactions this month.</td></tr>
                  ) : ledgerData.map((e, i) => (
                      <tr key={i} className={`hover:bg-white/[0.02] transition-colors ${e.type === "opening" ? "bg-amber-500/5" : ""}`}>
                        <td className="px-4 py-3 text-xs font-bold text-slate-400">{e.date}</td>
                        <td className="px-4 py-3 text-xs font-black">
                          {e.status === "Present" ? <span className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md">Present</span> : 
                           e.status === "Half Day" ? <span className="text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md">Half Day</span> : 
                           e.status === "—" ? <span className="text-slate-500">—</span> : 
                           <span className="text-red-400 bg-red-500/10 px-2 py-1 rounded-md">Absent</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-right font-bold text-emerald-400/80">{e.wage > 0 ? "+ " + inr(e.wage) : "—"}</td>
                        <td className="px-4 py-3 text-xs text-right font-bold text-blue-400/80">{e.comm > 0 ? "+ " + inr(e.comm) : "—"}</td>
                        <td className="px-4 py-3 text-xs text-right font-bold text-red-400">{e.adv > 0 ? "- " + inr(e.adv) : "—"}</td>
                        <td className={`px-4 py-3 text-sm text-right font-black ${e.balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>{inr(e.balance)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Salary Rate Master Modal */}
      {salaryRateModal && salaryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-black text-lg text-white mb-5 flex items-center gap-2"><Edit2 size={18} className="text-blue-500"/> Update Daily Rate</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1.5">Staff Name</label>
                <input value={salaryTarget.name} readOnly className="w-full px-4 py-2.5 bg-[#111520] border border-[#21293d] rounded-xl text-sm font-bold text-slate-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1.5">New Daily Wage</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                  <input type="number" value={newSalary} onChange={(e) => setNewSalary(e.target.value)} step="any" className="w-full pl-8 pr-4 py-2.5 bg-[#111520] border border-[#21293d] rounded-xl text-sm font-black text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all" placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1.5">Effective Date (From when?)</label>
                <input type="date" value={newEffectiveDate} onChange={(e) => setNewEffectiveDate(e.target.value)} className="w-full px-4 py-2.5 bg-[#111520] border border-[#21293d] rounded-xl text-sm font-bold text-slate-300 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all style-calendar" />
                <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">Select a past date if this raise was applicable from earlier this month.</p>
              </div>
              <div className="flex gap-3 pt-4 border-t border-[#21293d]">
                <button onClick={handleUpdateSalary} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-black text-white shadow-lg shadow-blue-900/20 transition-all">Save New Rate</button>
                <button onClick={() => { setSalaryRateModal(false); setSalaryTarget(null); }} className="px-5 py-3 bg-[#111520] border border-[#21293d] text-slate-400 hover:text-white hover:bg-[#1c2231] rounded-xl text-sm font-bold transition-all">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Salary History Modal */}
      {historyModal && historyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
            <div className="p-5 bg-[#111520] border-b border-[#21293d] flex items-center justify-between">
              <div>
                <h3 className="font-black text-white text-lg flex items-center gap-2"><History size={20} className="text-blue-500"/> Salary History</h3>
                <p className="text-xs font-bold text-slate-500 mt-1">{historyTarget.name}</p>
              </div>
              <button onClick={() => { setHistoryModal(false); setEditingEntry(null); }} className="w-9 h-9 flex items-center justify-center bg-[#161b27] border border-[#21293d] hover:border-slate-500 rounded-xl text-slate-400 hover:text-white transition-all"><X size={16} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-[#161b27] border-b border-[#21293d] z-10">
                  <tr>
                    {["Effective Date", "Daily Rate", "Action"].map((h) => (
                      <th key={h} className="px-5 py-3 text-[10px] font-black uppercase text-slate-500 tracking-widest text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]/50">
                  {historyLoading ? (
                    <tr><td colSpan={3} className="py-12 text-center"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></td></tr>
                  ) : historyEntries.length === 0 ? (
                    <tr><td colSpan={3} className="py-12 text-center text-slate-500 text-sm font-bold">No history records found.</td></tr>
                  ) : historyEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 text-sm font-bold text-slate-300">{new Date(e.effective_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</td>
                      <td className="px-5 py-3 text-sm font-black text-emerald-400">{inr(e.salary)}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingEntry(e); setEditSalary(String(e.salary)); setEditDate(e.effective_date); }} className="w-8 h-8 flex items-center justify-center bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500 hover:text-white transition-all"><Edit2 size={14} /></button>
                          <button onClick={() => handleDeleteHistory(e.id)} className="w-8 h-8 flex items-center justify-center bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500 hover:text-white transition-all"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editingEntry && (
              <div className="p-5 bg-[#111520] border-t border-[#21293d] animate-in slide-in-from-bottom-5 duration-300">
                <h4 className="text-xs font-black uppercase text-white tracking-widest mb-4 flex items-center gap-2">
                  <Edit2 size={12} className="text-blue-500" /> Edit Record
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1.5">New Rate</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">₹</span>
                      <input type="number" value={editSalary} onChange={(e) => setEditSalary(e.target.value)} className="w-full pl-7 pr-3 py-2 bg-[#161b27] border border-[#21293d] rounded-xl text-sm font-black text-white outline-none focus:border-blue-500/50" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1.5">Effective Date</label>
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full px-3 py-2 bg-[#161b27] border border-[#21293d] rounded-xl text-sm font-bold text-slate-300 outline-none focus:border-blue-500/50 style-calendar" />
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={handleUpdateHistoryEntry} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black text-white transition-all flex items-center justify-center gap-2"><Check size={14}/> Save Changes</button>
                  <button onClick={() => setEditingEntry(null)} className="px-5 py-2.5 bg-[#161b27] border border-[#21293d] text-slate-400 hover:text-white hover:bg-[#1c2231] rounded-xl text-xs font-bold transition-all">Cancel</button>
                </div>
              </div>
            )}

            <div className="p-4 bg-[#111520] border-t border-[#21293d] text-[10px] text-slate-500 text-center font-bold uppercase tracking-widest">
              Total History Records: {historyEntries.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalaryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-blue-500" /></div>}>
      <SalaryContent />
    </Suspense>
  );
}