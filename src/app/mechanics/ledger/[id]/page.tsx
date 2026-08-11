"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Loader2, ArrowLeft, Calendar, Printer, FileText, 
  ChevronLeft, ChevronRight, TrendingUp, Wallet,
  Info, CheckCircle, IndianRupee
} from "lucide-react";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval } from "date-fns";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Mechanic = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  daily_salary: number;
};

type JobRow = { id: number; job_id: string; item: string; mechanic_commission_amount: string; status: number; date_created: string };

type LedgerRow = {
  date: Date;
  dateStr: string;
  attStatus: string;
  attValue: number;
  wage: number;
  jobs: JobRow[];
  commGenerated: number;
  commPayable: number;
  advance: number;
  runningBal: number;
};

export default function MechanicLedger() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const mid = params.id as string;

  // Date Logic
  const today = new Date();
  const monthParam = searchParams.get("month");
  const [from, setFrom] = useState(() => {
    const f = searchParams.get("from");
    if (f) return f;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) return format(startOfMonth(new Date(monthParam + "-01")), "yyyy-MM-dd");
    return format(startOfMonth(today), "yyyy-MM-01");
  });
  const [to, setTo] = useState(() => {
    const t = searchParams.get("to");
    if (t) return t;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) return format(endOfMonth(new Date(monthParam + "-01")), "yyyy-MM-dd");
    return format(endOfMonth(today), "yyyy-MM-dd");
  });

  const [loading, setLoading] = useState(true);
  const [mechanic, setMechanic] = useState<Mechanic | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerRow[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [totalPeriod, setTotalPeriod] = useState({ generated: 0, payable: 0, advance: 0, wage: 0 });

  const fetchData = useCallback(async () => {
    if (!mid) return;
    setLoading(true);
    try {
      // 1. Fetch Mechanic & Salary History
      const [mechRes, salaryHistRes] = await Promise.all([
        supabase.from("mechanic_list").select("id, firstname, middlename, lastname, daily_salary").eq("id", mid).single(),
        supabase.from("mechanic_salary_history").select("salary, effective_date").eq("mechanic_id", mid).order("effective_date", { ascending: false })
      ]);

      if (mechRes.error) throw mechRes.error;
      const mech = mechRes.data as Mechanic;
      setMechanic(mech);
      const salaryHist = salaryHistRes.data || [];

      const getDailyRate = (dateStr: string) => {
        const hist = salaryHist.find(h => h.effective_date <= dateStr);
        return hist ? parseFloat(hist.salary) : mech.daily_salary;
      };

      // 2. Opening Balance Calculation (History before 'from')
      const prevLimit = format(new Date(new Date(from).getTime() - 86400000), "yyyy-MM-dd");
      
      const [prevAtt, prevComm, prevAdv] = await Promise.all([
        supabase.from("attendance_list").select("curr_date, status").eq("mechanic_id", mid).in("status", [1, 3]).lte("curr_date", prevLimit),
        supabase.from("transaction_list").select("mechanic_commission_amount").eq("mechanic_id", mid).eq("status", 5).lte("date_completed", prevLimit + " 23:59:59"),
        supabase.from("advance_payments").select("amount").eq("mechanic_id", mid).lte("date_paid", prevLimit)
      ]);

      let earnedPrev = 0;
      (prevAtt.data || []).forEach(att => {
        const rate = getDailyRate(att.curr_date);
        earnedPrev += att.status === 1 ? rate : rate / 2;
      });

      const commPrev = (prevComm.data || []).reduce((s, c) => s + (parseFloat(c.mechanic_commission_amount) || 0), 0);
      const advPrev = (prevAdv.data || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

      const opBal = (earnedPrev + commPrev) - advPrev;
      setOpeningBalance(opBal);

      // 3. Period Data Fetching
      const [attPeriod, jobsPeriod, advPeriod] = await Promise.all([
        supabase.from("attendance_list").select("curr_date, status").eq("mechanic_id", mid).gte("curr_date", from).lte("curr_date", to),
        supabase.from("transaction_list").select("id, job_id, item, mechanic_commission_amount, status, date_created").eq("mechanic_id", mid).gte("date_created", from + " 00:00:00").lte("date_created", to + " 23:59:59"),
        supabase.from("advance_payments").select("amount, date_paid").eq("mechanic_id", mid).gte("date_paid", from).lte("date_paid", to)
      ]);

      // 4. Build Ledger Grid
      const days = eachDayOfInterval({ start: new Date(from), end: new Date(to) });
      let currentBal = opBal;
      let totalGen = 0, totalPay = 0, totalAdv = 0, totalWage = 0;

      const rows: LedgerRow[] = days.map(day => {
        const dStr = format(day, "yyyy-MM-dd");
        
        // Attendance logic
        const att = (attPeriod.data || []).find(a => a.curr_date === dStr);
        let attStatus = "-", attVal = 0, wage = 0;
        if (att) {
          const rate = getDailyRate(dStr);
          if (att.status === 1) { attStatus = "Present"; attVal = 1; wage = rate; }
          else if (att.status === 3) { attStatus = "Half Day"; attVal = 0.5; wage = rate / 2; }
          else { attStatus = "Absent"; attVal = 0; wage = 0; }
        }

        // Jobs logic
        const dayJobs = (jobsPeriod.data || []).filter(j => j.date_created.startsWith(dStr));
        let commGen = 0, commPay = 0;
        dayJobs.forEach(j => {
            const val = parseFloat(j.mechanic_commission_amount) || 0;
            commGen += val;
            if (j.status === 5) commPay += val;
        });

        // Advance logic
        const dayAdv = (advPeriod.data || []).filter(a => a.date_paid === dStr).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

        currentBal += (wage + commPay - dayAdv);
        
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
          runningBal: currentBal
        };
      });

      setLedgerData(rows);
      setTotalPeriod({ generated: totalGen, payable: totalPay, advance: totalAdv, wage: totalWage });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mid, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const changeMonth = (offset: number) => {
    const currentFrom = new Date(from);
    const newFrom = offset > 0 ? startOfMonth(addMonths(currentFrom, 1)) : startOfMonth(subMonths(currentFrom, 1));
    const newTo = endOfMonth(newFrom);
    
    const p = new URLSearchParams(searchParams.toString());
    p.set("from", format(newFrom, "yyyy-MM-dd"));
    p.set("to", format(newTo, "yyyy-MM-dd"));
    router.replace("?" + p.toString());
    
    setFrom(format(newFrom, "yyyy-MM-dd"));
    setTo(format(newTo, "yyyy-MM-dd"));
  };

  const handlePrint = () => {
    window.open(`/api/print-mechanic-ledger?id=${mid}&from=${from}&to=${to}&mode=created`, "_blank");
  };

  if (loading && !mechanic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  const name = mechanic ? [mechanic.firstname, mechanic.middlename, mechanic.lastname].filter(Boolean).join(" ") : "Mechanic";

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/mechanics" className="w-10 h-10 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-xl text-slate-500 hover:text-white transition-all no-print">
            <ArrowLeft size={18} />
          </Link>
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <FileText size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Daily Ledger: {name}</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">Staff Earnings & Advance History</p>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button onClick={handlePrint} className="px-4 py-2 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2">
            <Printer size={14} /> Print Ledger
          </button>
        </div>
      </div>

      {/* Filter & Navigation */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 shadow-lg no-print flex flex-wrap items-center justify-center gap-4">
        <button onClick={() => changeMonth(-1)} className="w-10 h-10 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-full text-slate-400 hover:text-white hover:border-blue-500 transition-all">
          <ChevronLeft size={20} />
        </button>
        
        <div className="flex items-center gap-3 bg-[#0d1117] px-4 py-2 rounded-2xl border border-[#21293d]">
          <Calendar size={16} className="text-blue-500" />
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="bg-transparent border-none text-sm text-white outline-none [color-scheme:dark]" />
          <span className="text-slate-600 font-bold">to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="bg-transparent border-none text-sm text-white outline-none [color-scheme:dark]" />
        </div>

        <button onClick={() => changeMonth(1)} className="w-10 h-10 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-full text-slate-400 hover:text-white hover:border-blue-500 transition-all">
          <ChevronRight size={20} />
        </button>
        
        <button onClick={fetchData} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all">
          Filter
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
         <SummaryCard label="Opening Balance" value={openingBalance} icon={<Wallet size={18}/>} color="amber" sub="History before selection" />
         <SummaryCard label="Earned Wages" value={totalPeriod.wage} icon={<TrendingUp size={18}/>} color="blue" sub="Daily pay for attendance" />
         <SummaryCard label="Payable Commission" value={totalPeriod.payable} icon={<CheckCircle size={18}/>} color="emerald" sub="Delivered jobs only" />
         <SummaryCard label="Total Advance" value={totalPeriod.advance} icon={<IndianRupee size={18}/>} color="rose" sub="Salary payouts & advances" />
      </div>

      {/* Ledger Table */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-3xl overflow-hidden shadow-2xl print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-[#0d1117] border-b border-[#21293d] text-[10px] font-black uppercase text-slate-500 tracking-widest">
                <th className="px-4 py-4 text-center">Date</th>
                <th className="px-4 py-4 text-center">Status</th>
                <th className="px-4 py-4 text-right">Wage</th>
                <th className="px-4 py-4">Jobs & Commission Details</th>
                <th className="px-4 py-4 text-right">Commission (P|G)</th>
                <th className="px-4 py-4 text-right">Advance</th>
                <th className="px-4 py-4 text-right">Running Bal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21293d]">
              {/* Opening Balance Row */}
              <tr className="bg-amber-500/5 font-bold">
                <td colSpan={6} className="px-4 py-3 text-right text-amber-500 text-[10px] uppercase tracking-widest">Opening Balance (Brought Forward):</td>
                <td className="px-4 py-3 text-right text-amber-400 font-black">{inr(openingBalance)}</td>
              </tr>
              
              {ledgerData.map((row, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-4 py-4 text-center">
                    <span className="text-slate-300 font-bold">{format(row.date, "dd MMM")}</span>
                    <br/>
                    <span className="text-[9px] text-slate-600 uppercase font-black">{format(row.date, "eee")}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                      row.attStatus === 'Present' ? 'bg-emerald-500/10 text-emerald-400' : 
                      row.attStatus === 'Half Day' ? 'bg-amber-500/10 text-amber-400' : 
                      row.attStatus === 'Absent' ? 'bg-rose-500/10 text-rose-400' : 'text-slate-700'
                    }`}>
                      {row.attStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-slate-300">
                    {row.wage > 0 ? inr(row.wage) : "—"}
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      {row.jobs.length > 0 ? row.jobs.map(j => (
                        <div key={j.id} className="flex items-center justify-between gap-4 text-[11px] bg-[#0d1117]/50 rounded-lg px-2 py-1 border border-white/[0.03]">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-blue-400 font-black">#{j.job_id}</span>
                            <span className="text-slate-500 truncate max-w-[120px]">{j.item}</span>
                            <span className={`text-[9px] font-bold ${j.status === 5 ? 'text-emerald-500' : 'text-slate-600'}`}>
                              {j.status === 5 ? 'Delivered' : 'Pending'}
                            </span>
                          </div>
                          <span className="text-slate-400 font-bold whitespace-nowrap">₹{(parseFloat(j.mechanic_commission_amount) || 0).toFixed(0)}</span>
                        </div>
                      )) : <span className="text-slate-700 italic text-xs">No jobs recorded</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-emerald-400 font-black" title="Payable (Delivered)">{row.commPayable > 0 ? inr(row.commPayable) : "—"}</span>
                      {row.commGenerated > row.commPayable && (
                        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter" title="Total Generated">Gen: {inr(row.commGenerated)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-rose-400/80">
                    {row.advance > 0 ? `-${inr(row.advance)}` : "—"}
                  </td>
                  <td className="px-4 py-4 text-right font-black text-white bg-blue-500/5">
                    {inr(row.runningBal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#0d1117] border-t-2 border-[#21293d]">
               <tr className="font-bold">
                 <td colSpan={4} className="px-4 py-4 text-right text-slate-500 text-[10px] uppercase tracking-widest">Period Totals (Wage + Pay. Comm - Adv):</td>
                 <td className="px-4 py-4 text-right">
                    <div className="text-emerald-400">{inr(totalPeriod.payable)}</div>
                    <div className="text-[9px] text-slate-600 uppercase">Total Gen: {inr(totalPeriod.generated)}</div>
                 </td>
                 <td className="px-4 py-4 text-right text-rose-400">{inr(totalPeriod.advance)}</td>
                 <td className="px-4 py-4 text-right bg-blue-500/10 text-blue-400 text-lg font-black">{inr(ledgerData[ledgerData.length - 1]?.runningBal || openingBalance)}</td>
               </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-3 no-print">
        <Info className="text-blue-400 flex-shrink-0" size={18} />
        <div className="text-xs text-slate-500 space-y-1">
          <p><strong className="text-blue-400">Ledger Logic:</strong> Running balance calculates from Opening Balance + Earned Wages + Payable Commission (Delivered only) - Advance Payments.</p>
          <p><strong className="text-emerald-400">Payable Commission:</strong> Only jobs with status &quot;Delivered&quot; are added to the running balance. Pending jobs show in blue but don&apos;t affect the balance until delivered.</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background-color: white !important; color: black !important; }
          .bg-navy { background-color: #001f3f !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #ddd !important; color: black !important; padding: 4px !important; }
          tr { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

function SummaryCard({ label, value, icon, color, sub }: { label: string, value: number, icon: React.ReactNode, color: string, sub?: string }) {
  const colors: Record<string, string> = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };
  return (
    <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 shadow-lg">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
          <p className="text-lg font-black text-white">{inr(value)}</p>
          {sub && <p className="text-[9px] text-slate-600 font-bold uppercase">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
