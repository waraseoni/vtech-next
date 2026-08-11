"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Loader2, Calculator, History, 
  Calendar, ChevronLeft, ChevronRight, IndianRupee,
  CreditCard, Edit3
} from "lucide-react";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { logActivity } from "@/lib/activity";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type DbRow = ReturnType<typeof JSON.parse>;

type SalaryRecord = {
  id: number;
  name: string;
  daily_salary: number;
  present: number;
  halfDays: number;
  earnedSalary: number;
  commission: number;
  oldBalance: number;
  advance: number;
  netTotal: number;
};

export default function SalaryManagement() {
  const [activeTab, setActiveTab] = useState<"report" | "master">("report");
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  
  // Report State
  const [reportData, setReportData] = useState<SalaryRecord[]>([]);
  
  // Master State
  const [mechanics, setMechanics] = useState<DbRow[]>([]);
  const [showRateModal, setShowRateModal] = useState(false);
  const [editingMech, setEditingMech] = useState<DbRow | null>(null);
  const [newRate, setNewRate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);

  // Payout Modal
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutData, setPayoutData] = useState<DbRow | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutReason, setPayoutReason] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "report") {
        const start = format(startOfMonth(new Date(month)), "yyyy-MM-dd");
        const end = format(endOfMonth(new Date(month)), "yyyy-MM-dd");
        // PHP: $prev_month_end = date('Y-m-t', strtotime($month . " -1 month"))
        const prevMonthEnd = format(endOfMonth(subMonths(new Date(month + "-01"), 1)), "yyyy-MM-dd");

        const { data: mechs } = await supabase.from("mechanic_list").select("id, firstname, lastname, daily_salary").eq("status", 1).eq("delete_flag", 0);
        if (!mechs) return;

        // PHP: ORDER BY effective_date DESC, id DESC — latest rate wins, id breaks ties
        const { data: salaryHist } = await supabase.from("mechanic_salary_history").select("*").order("effective_date", { ascending: false }).order("id", { ascending: false });

        const getRate = (mid: number, dateStr: string, defaultRate: number) => {
          const hist = (salaryHist || []).find(h => h.mechanic_id === mid && h.effective_date <= dateStr);
          return hist ? parseFloat(hist.salary) : defaultRate;
        };

        const records: SalaryRecord[] = await Promise.all(mechs.map(async (m) => {
          const mid = m.id;
          
          // 1. Old Balance Calculation
          const [prevAtt, prevComm, prevAdv] = await Promise.all([
            supabase.from("attendance_list").select("curr_date, status").eq("mechanic_id", mid).in("status", [1, 3]).lte("curr_date", prevMonthEnd),
            supabase.from("transaction_list").select("mechanic_commission_amount").eq("mechanic_id", mid).eq("status", 5).lte("date_completed", prevMonthEnd + " 23:59:59"),
            supabase.from("advance_payments").select("amount").eq("mechanic_id", mid).lte("date_paid", prevMonthEnd)
          ]);

          let earnedPrev = 0;
          (prevAtt.data || []).forEach(att => {
            const rate = getRate(mid, att.curr_date, m.daily_salary);
            earnedPrev += att.status === 1 ? rate : rate / 2;
          });
          const commPrev = (prevComm.data || []).reduce((s, c) => s + (parseFloat(c.mechanic_commission_amount) || 0), 0);
          const advPrev = (prevAdv.data || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
          const oldBalance = (earnedPrev + commPrev) - advPrev;

          // 2. Current Month Logic
          const [currAtt, currComm, currAdv] = await Promise.all([
            supabase.from("attendance_list").select("curr_date, status").eq("mechanic_id", mid).in("status", [1, 3]).gte("curr_date", start).lte("curr_date", end),
            supabase.from("transaction_list").select("mechanic_commission_amount").eq("mechanic_id", mid).eq("status", 5).gte("date_completed", start + " 00:00:00").lte("date_completed", end + " 23:59:59"),
            supabase.from("advance_payments").select("amount").eq("mechanic_id", mid).gte("date_paid", start).lte("date_paid", end)
          ]);

          let earnedCurr = 0, pCount = 0, hdCount = 0;
          (currAtt.data || []).forEach(att => {
            const rate = getRate(mid, att.curr_date, m.daily_salary);
            if (att.status === 1) { pCount++; earnedCurr += rate; }
            else { hdCount++; earnedCurr += rate / 2; }
          });

          const commCurr = (currComm.data || []).reduce((s, c) => s + (parseFloat(c.mechanic_commission_amount) || 0), 0);
          const advCurr = (currAdv.data || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
          
          const netTotal = (oldBalance + earnedCurr + commCurr) - advCurr;

          return {
            id: mid,
            name: `${m.firstname} ${m.lastname}`,
            daily_salary: m.daily_salary,
            present: pCount,
            halfDays: hdCount,
            earnedSalary: earnedCurr,
            commission: commCurr,
            oldBalance,
            advance: advCurr,
            netTotal
          };
        }));

        setReportData(records);
      } else {
        // Master Tab
        const { data: mechs } = await supabase.from("mechanic_list").select("*").eq("status", 1).eq("delete_flag", 0).order("firstname");
        // PHP: ORDER BY id desc LIMIT 1 (latest inserted entry)
        const { data: hist } = await supabase.from("mechanic_salary_history").select("mechanic_id, date_created").order("id", { ascending: false });
        
        const formatted = (mechs || []).map(m => ({
          ...m,
          last_updated: hist?.find(h => h.mechanic_id === m.id)?.date_created || null
        }));
        setMechanics(formatted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateSalaryRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMech || !newRate) return;
    setSaving(true);
    try {
      const rate = parseFloat(newRate);
      // 1. Update mechanic_list
      const { error: upErr } = await supabase.from("mechanic_list").update({ daily_salary: rate }).eq("id", editingMech.id);
      if (upErr) throw upErr;

      // 2. Add to history
      const { error: histErr } = await supabase.from("mechanic_salary_history").insert([{
        mechanic_id: editingMech.id,
        salary: rate,
        effective_date: effectiveDate
      }]);
      if (histErr) throw histErr;

      await logActivity('Updated Salary Rate', 'Mechanics', editingMech.id, `Daily wage updated to ${inr(rate)} (Effective: ${effectiveDate})`);
      setShowRateModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handlePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutData || !payoutAmount) return;
    setSaving(true);
    try {
      const amt = parseFloat(payoutAmount);
      const { error } = await supabase.from("advance_payments").insert([{
        mechanic_id: payoutData.id,
        amount: amt,
        reason: payoutReason || `Salary Payout for ${format(new Date(month), "MMMM yyyy")}`,
        date_paid: format(new Date(), "yyyy-MM-dd")
      }]);
      if (error) throw error;

      await logActivity('Staff Payout', 'Mechanics', payoutData.id, `Paid ${inr(amt)} to ${payoutData.name}`);
      setShowPayoutModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const changeMonth = (offset: number) => {
    const d = new Date(month + "-01");
    const next = offset > 0 ? addMonths(d, 1) : subMonths(d, 1);
    setMonth(format(next, "yyyy-MM"));
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Calculator size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Salary Management</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">Earnings, Deductions & Rate Master</p>
          </div>
        </div>
        <div className="flex bg-[#0d1117] p-1 rounded-xl border border-[#21293d]">
          <button 
            onClick={() => setActiveTab("report")}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'report' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Salary Report
          </button>
          <button 
            onClick={() => setActiveTab("master")}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'master' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Rate Master
          </button>
        </div>
      </div>

      {activeTab === "report" ? (
        <>
          {/* Month Navigator */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 shadow-lg flex items-center justify-center gap-4 no-print">
            <button onClick={() => changeMonth(-1)} className="w-10 h-10 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-full text-slate-400 hover:text-white transition-all">
              <ChevronLeft size={20} />
            </button>
            <div className="bg-[#0d1117] px-6 py-2 rounded-2xl border border-[#21293d] flex items-center gap-3">
               <Calendar size={18} className="text-blue-500" />
               <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                 className="bg-transparent border-none text-lg font-black text-white outline-none [color-scheme:dark]" />
            </div>
            <button onClick={() => changeMonth(1)} className="w-10 h-10 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-full text-slate-400 hover:text-white transition-all">
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Salary Table */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-[#0d1117] border-b border-[#21293d] text-[10px] font-black uppercase text-slate-500 tracking-widest">
                    <th className="px-6 py-4">#</th>
                    <th className="px-6 py-4">Staff Name</th>
                    <th className="px-6 py-4 text-center">Attendance (P|HD)</th>
                    <th className="px-6 py-4 text-right">Earned Wage</th>
                    <th className="px-6 py-4 text-right text-amber-500">Commission</th>
                    <th className="px-6 py-4 text-right">Old Balance</th>
                    <th className="px-6 py-4 text-right text-rose-500">Advance</th>
                    <th className="px-6 py-4 text-right bg-blue-500/5">Net Payable</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]">
                  {loading ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={i} className="animate-pulse"><td colSpan={9} className="px-6 py-10"><div className="h-4 bg-slate-800/50 rounded-full w-full"></div></td></tr>
                    ))
                  ) : reportData.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4 text-slate-600 font-bold">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <Link href={`/mechanics/ledger/${row.id}?month=${month}`} className="text-white font-bold hover:text-blue-400 transition-colors no-underline">
                          {row.name}
                        </Link>
                        <p className="text-[9px] text-slate-600 font-black uppercase mt-0.5">Click for ledger</p>
                      </td>
                      <td className="px-6 py-4 text-center font-bold">
                        <span className="text-emerald-400" title="Present">{row.present}</span>
                        <span className="text-slate-700 mx-1.5">|</span>
                        <span className="text-amber-400" title="Half Day">{row.halfDays}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-300">{inr(row.earnedSalary)}</td>
                      <td className="px-6 py-4 text-right font-bold text-amber-400/80">{inr(row.commission)}</td>
                      <td className={`px-6 py-4 text-right font-bold ${row.oldBalance >= 0 ? 'text-blue-400/80' : 'text-rose-400'}`}>
                        {inr(row.oldBalance)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-rose-500">{row.advance > 0 ? `-${inr(row.advance)}` : "—"}</td>
                      <td className="px-6 py-4 text-right bg-blue-500/5">
                        <span className={`px-3 py-1 rounded-lg font-black ${row.netTotal >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                          {inr(Math.abs(row.netTotal))}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {row.netTotal > 0 ? (
                          <button 
                            onClick={() => { setPayoutData(row); setPayoutAmount(row.netTotal.toFixed(0)); setPayoutReason(`Salary for ${format(new Date(month + "-01"), "MMMM yyyy")}`); setShowPayoutModal(true); }}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20"
                          >
                            <CreditCard size={12} /> Pay
                          </button>
                        ) : (
                          <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Settled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Rate Master Tab */
        <div className="bg-[#161b27] border border-[#21293d] rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-[#0d1117] border-b border-[#21293d] text-[10px] font-black uppercase text-slate-500 tracking-widest">
                  <th className="px-6 py-4">Staff Member</th>
                  <th className="px-6 py-4 text-right">Current Daily Wage</th>
                  <th className="px-6 py-4 text-center">Last Updated</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21293d]">
                {loading ? (
                   Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse"><td colSpan={4} className="px-6 py-8"><div className="h-4 bg-slate-800/50 rounded-full w-full"></div></td></tr>
                  ))
                ) : mechanics.map(m => (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-white font-bold">{m.firstname} {m.lastname}</p>
                      <p className="text-[10px] text-slate-600 font-black uppercase">{m.designation || "Mechanic"}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-lg font-black text-emerald-400">{inr(m.daily_salary)}</span>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-500 text-xs font-medium">
                      {m.last_updated ? format(new Date(m.last_updated), "dd MMM, yyyy") : "Initial Setup"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => { setEditingMech(m); setNewRate(String(m.daily_salary)); setShowRateModal(true); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                          <Edit3 size={12} /> Update Rate
                        </button>
                        <Link href={`/mechanics/commission`} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all no-underline">
                          <History size={12} /> History
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Update Rate Modal */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowRateModal(false); }}>
          <div className="bg-[#161b27] border border-[#21293d] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-[#0d1117]/50 border-b border-[#21293d] flex items-center justify-between">
              <h3 className="text-lg font-black text-white">Update Salary Rate</h3>
              <button onClick={() => setShowRateModal(false)} className="text-slate-600 hover:text-white transition-colors">
                <ChevronLeft className="rotate-180" />
              </button>
            </div>
            <form onSubmit={updateSalaryRate} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Staff Name</label>
                <input value={`${editingMech?.firstname} ${editingMech?.lastname}`} readOnly className="w-full px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-400 font-bold outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">New Daily Wage (₹)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                  <input type="number" step="0.01" value={newRate} onChange={e => setNewRate(e.target.value)} required placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-xl text-lg font-black text-white outline-none focus:border-blue-500 transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Effective Date</label>
                <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} required
                  className="w-full px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500 transition-all [color-scheme:dark]" />
                <p className="text-[9px] text-slate-600 font-bold uppercase mt-1">Select previous date for retroactive changes.</p>
              </div>
              <button type="submit" disabled={saving} className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-blue-600/25 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="animate-spin" size={18} /> : "Save Rate Change"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowPayoutModal(false); }}>
          <div className="bg-[#161b27] border border-[#21293d] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
              <h3 className="text-lg font-black text-emerald-400 flex items-center gap-2"><CreditCard size={20}/> Pay Salary</h3>
              <button onClick={() => setShowPayoutModal(false)} className="text-slate-600 hover:text-white transition-colors">
                <ChevronLeft className="rotate-180" />
              </button>
            </div>
            <form onSubmit={handlePayout} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Staff Member</label>
                <input value={payoutData?.name} readOnly className="w-full px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-300 font-bold outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Payout Amount (₹)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
                  <input type="number" step="1" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} required placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-xl text-xl font-black text-white outline-none focus:border-blue-500 transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Remarks / Month</label>
                <textarea value={payoutReason} onChange={e => setPayoutReason(e.target.value)} placeholder="e.g. Salary for Jan 2026"
                  className="w-full px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500 transition-all resize-none h-20" />
              </div>
              <button type="submit" disabled={saving} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="animate-spin" size={18} /> : "Process Payment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
