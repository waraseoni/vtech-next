"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, ChevronLeft, ChevronRight, Printer, Eye, X, Coins, User, Edit2, DollarSign } from "lucide-react";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type SalaryRow = {
  id: number; name: string; salary_per_day: number;
  present_count: number; half_day_count: number;
  current_fix: number; current_comm: number;
  old_balance: number; current_adv: number; net_final: number;
};

type Mechanic = { id: number; firstname: string; middlename: string | null; lastname: string; salary_per_day: number; designation: string | null };

function SalaryContent() {
  const searchParams = useSearchParams();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(searchParams.get("month") || currentMonth);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SalaryRow[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [activeTab, setActiveTab] = useState<"report" | "control">("report");
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTarget, setPayTarget] = useState<{ id: number; name: string; amount: number } | null>(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerTarget, setLedgerTarget] = useState<{ id: number; name: string; salary: number } | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [ledgerFrom, setLedgerFrom] = useState("");
  const [ledgerTo, setLedgerTo] = useState("");
  const [salaryRateModal, setSalaryRateModal] = useState(false);
  const [salaryTarget, setSalaryTarget] = useState<{ id: number; name: string; salary: number } | null>(null);
  const [newSalary, setNewSalary] = useState("");
  const [newEffectiveDate, setNewEffectiveDate] = useState(new Date().toISOString().split("T")[0]);

  const prevMonthEnd = new Date(new Date(month + "-01").getTime() - 86400000).toISOString().split("T")[0];

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const { data: mechData } = await supabase
        .from("mechanic_list").select("id, firstname, middlename, lastname, salary_per_day, designation")
        .eq("status", 1).eq("delete_flag", 0).order("firstname");
      const typed = (mechData || []).map((m) => ({ ...m, designation: m.designation || null }));
      setMechanics(typed);

      const nextMonth = new Date(month + "-01");
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthEnd = nextMonth.toISOString().split("T")[0];

      const salaryRows: SalaryRow[] = [];
      for (const m of mechData || []) {
        const name = [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ");
        const salary = m.salary_per_day || 0;

        const { data: attPrev } = await supabase.from("attendance_list").select("curr_date, status").eq("mechanic_id", m.id).in("status", [1, 3]).lte("curr_date", prevMonthEnd);
        const { data: commPrev } = await supabase.from("transaction_list").select("mechanic_commission_amount").eq("mechanic_id", m.id).lt("date_created", `${month}-01T00:00:00`);
        const { data: advPrev } = await supabase.from("advance_payments").select("amount").eq("mechanic_id", m.id).lte("date_paid", prevMonthEnd);

        const earnedPrev = attPrev?.reduce((s, r) => s + (r.status === 3 ? salary / 2 : salary), 0) || 0;
        const commPrevSum = commPrev?.reduce((s, r) => s + (r.mechanic_commission_amount || 0), 0) || 0;
        const advPrevSum = advPrev?.reduce((s, r) => s + (r.amount || 0), 0) || 0;
        const oldBalance = earnedPrev + commPrevSum - advPrevSum;

        const { data: attCurr } = await supabase.from("attendance_list").select("curr_date, status").eq("mechanic_id", m.id).in("status", [1, 3]).gte("curr_date", `${month}-01`).lte("curr_date", monthEnd);
        const { data: commCurr } = await supabase.from("transaction_list").select("mechanic_commission_amount").eq("mechanic_id", m.id).gte("date_created", `${month}-01T00:00:00`).lt("date_created", `${monthEnd}T00:00:00`);
        const { data: advCurr } = await supabase.from("advance_payments").select("amount").eq("mechanic_id", m.id).gte("date_paid", `${month}-01`).lte("date_paid", monthEnd);

        const presentCount = attCurr?.filter((r) => r.status === 1).length || 0;
        const halfDayCount = attCurr?.filter((r) => r.status === 3).length || 0;
        const currentFix = attCurr?.reduce((s, r) => s + (r.status === 3 ? salary / 2 : salary), 0) || 0;
        const currentComm = commCurr?.reduce((s, r) => s + (r.mechanic_commission_amount || 0), 0) || 0;
        const currentAdv = advCurr?.reduce((s, r) => s + (r.amount || 0), 0) || 0;
        const netFinal = oldBalance + currentFix + currentComm - currentAdv;

        salaryRows.push({ id: m.id, name, salary_per_day: salary, present_count: presentCount, half_day_count: halfDayCount, current_fix: currentFix, current_comm: currentComm, old_balance: oldBalance, current_adv: currentAdv, net_final: netFinal });
      }
      setRows(salaryRows);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [month, prevMonthEnd]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const navigate = (dir: "prev" | "next") => {
    const d = new Date(month + "-01");
    if (dir === "prev") d.setMonth(d.getMonth() - 1);
    else d.setMonth(d.getMonth() + 1);
    setMonth(d.toISOString().slice(0, 7));
  };

  const openLedger = async (r: SalaryRow) => {
    const from = `${month}-01`;
    const nextMonth = new Date(month + "-01");
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const to = nextMonth.toISOString().split("T")[0];
    setLedgerTarget({ id: r.id, name: r.name, salary: r.salary_per_day });
    setLedgerFrom(from); setLedgerTo(to);
    setLedgerData([]); setShowLedgerModal(true); setLedgerLoading(true);

    try {
      const { data: attAll } = await supabase.from("attendance_list").select("curr_date, status").eq("mechanic_id", r.id).in("status", [1, 3]).gte("curr_date", from).lte("curr_date", to);
      const { data: commAll } = await supabase.from("transaction_list").select("job_id, code, mechanic_commission_amount, date_created").eq("mechanic_id", r.id).gte("date_created", `${from}T00:00:00`).lte("date_created", `${to}T23:59:59`);
      const { data: advAll } = await supabase.from("advance_payments").select("amount, date_paid").eq("mechanic_id", r.id).gte("date_paid", from).lte("date_paid", to);
      const { data: attPrev } = await supabase.from("attendance_list").select("curr_date, status").eq("mechanic_id", r.id).in("status", [1, 3]).lt("curr_date", from);
      const { data: commPrev } = await supabase.from("transaction_list").select("mechanic_commission_amount").eq("mechanic_id", r.id).lt("date_created", `${from}T00:00:00`);
      const { data: advPrev } = await supabase.from("advance_payments").select("amount").eq("mechanic_id", r.id).lt("date_paid", from);

      const ep = attPrev?.reduce((s, x) => s + (x.status === 3 ? r.salary_per_day / 2 : r.salary_per_day), 0) || 0;
      const cp = commPrev?.reduce((s, x) => s + (x.mechanic_commission_amount || 0), 0) || 0;
      const ap = advPrev?.reduce((s, x) => s + (x.amount || 0), 0) || 0;
      let running = ep + cp - ap;
      const entries: any[] = [];
      if (running !== 0) entries.push({ date: "Opening", status: "—", wage: running, comm: 0, adv: 0, balance: running, type: "opening" });

      const dates = new Set([...(attAll?.map((a) => a.curr_date) || []), ...(commAll?.map((c) => c.date_created.split("T")[0]) || []), ...(advAll?.map((a) => a.date_paid) || [])]);
      for (const d of Array.from(dates).sort()) {
        const att = attAll?.find((a) => a.curr_date === d);
        let wage = 0, attStatus = "Absent";
        if (att) { if (att.status === 1) { wage = r.salary_per_day; attStatus = "Present"; } else if (att.status === 3) { wage = r.salary_per_day / 2; attStatus = "Half Day"; } }
        const comm = commAll?.filter((c) => c.date_created.startsWith(d)).reduce((s, c) => s + (c.mechanic_commission_amount || 0), 0) || 0;
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
    await supabase.from("advance_payments").insert({ mechanic_id: payTarget.id, amount: payTarget.amount, date_paid: new Date().toISOString().split("T")[0], reason: `Salary for ${month}` });
    setShowPayModal(false); setPayTarget(null); fetchReport();
  };

  const handleUpdateSalary = async () => {
    if (!salaryTarget || !newSalary || !newEffectiveDate) return;
    await supabase.from("mechanic_salary_history").insert({ mechanic_id: salaryTarget.id, salary: parseFloat(newSalary), effective_date: newEffectiveDate });
    await supabase.from("mechanic_list").update({ salary_per_day: parseFloat(newSalary) }).eq("id", salaryTarget.id);
    setSalaryRateModal(false); setSalaryTarget(null); setNewSalary(""); fetchReport();
  };

  const monthLabel = new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white flex items-center gap-2"><Coins size={18} className="text-blue-400" /> Salary Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">Staff salary & commission report</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-[#161b27] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:border-blue-500/40 transition-all"><Printer size={13} /> Print</button>
      </div>

      <div className="flex gap-2">
        {(["report", "control"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === t ? "bg-blue-600 text-white" : "bg-[#161b27] border border-[#21293d] text-slate-400 hover:text-white"}`}>
            {t === "report" ? "Salary Report" : "Salary Rate Master"}
          </button>
        ))}
      </div>

      {activeTab === "report" && (
        <>
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => navigate("prev")} className="w-9 h-9 flex items-center justify-center bg-[#111520] border border-[#21293d] rounded-full text-slate-400 hover:text-white hover:border-blue-500/40 transition-all"><ChevronLeft size={14} /></button>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-black text-white outline-none focus:border-blue-500/50 text-center" />
              <button onClick={() => navigate("next")} className="w-9 h-9 flex items-center justify-center bg-[#111520] border border-[#21293d] rounded-full text-slate-400 hover:text-white hover:border-blue-500/40 transition-all"><ChevronRight size={14} /></button>
            </div>
            <div className="text-center mt-2"><span className="text-sm font-black text-white">Salary Statement — {monthLabel}</span></div>
          </div>

          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#111520]">
                    {["#", "Staff", "Attendance (P | HD)", "Earned Salary", "Commission", "Old Bal", "Advance", "Net Total", "Action"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-12"><Loader2 size={20} className="animate-spin text-blue-400 mx-auto" /></td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-slate-600 text-xs font-bold">No staff found</td></tr>
                  ) : rows.map((r, i) => (
                    <tr key={r.id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5 text-xs text-slate-500 text-center">{i + 1}</td>
                      <td className="px-3 py-2.5"><button onClick={() => openLedger(r)} className="text-xs font-black text-blue-400 hover:text-blue-300 transition-colors">{r.name}</button></td>
                      <td className="px-3 py-2.5 text-xs text-center"><span className="text-emerald-400 font-bold">{r.present_count}</span><span className="text-slate-600 mx-1">|</span><span className="bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold">{r.half_day_count}</span></td>
                      <td className="px-3 py-2.5 text-xs text-right text-slate-300">{inr(r.current_fix)}</td>
                      <td className="px-3 py-2.5 text-xs text-right text-blue-400">{inr(r.current_comm)}</td>
                      <td className={`px-3 py-2.5 text-xs text-right font-bold ${r.old_balance < 0 ? "text-red-400" : "text-slate-300"}`}>{inr(r.old_balance)}</td>
                      <td className="px-3 py-2.5 text-xs text-right text-red-400">{inr(r.current_adv)}</td>
                      <td className="px-3 py-2.5 text-right"><span className={`text-xs font-black px-2 py-1 rounded-lg ${r.net_final >= 0 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>{inr(Math.abs(r.net_final))}</span></td>
                      <td className="px-3 py-2.5">{r.net_final > 0 ? <button onClick={() => setPayTarget({ id: r.id, name: r.name, amount: r.net_final })} className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-[10px] font-bold hover:bg-emerald-500/30 transition-all"><DollarSign size={10} className="inline mr-1" /> Pay</button> : <span className="px-2 py-1 bg-slate-500/20 text-slate-500 rounded-lg text-[10px] font-bold">Settled</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "control" && (
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#111520]">
                  {["#", "Staff Name", "Daily Wage", "Last Updated", "Action"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mechanics.map((m, i) => (
                  <tr key={m.id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2.5 text-xs text-slate-500 text-center">{i + 1}</td>
                    <td className="px-3 py-2.5"><div className="text-xs font-bold text-slate-200">{[m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ")}</div><div className="text-[10px] text-slate-600">{m.designation || "Staff"}</div></td>
                    <td className="px-3 py-2.5 text-sm font-bold text-emerald-400">{inr(m.salary_per_day)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">—</td>
                    <td className="px-3 py-2.5"><button onClick={() => { setSalaryTarget({ id: m.id, name: [m.firstname, m.lastname].join(" "), salary: m.salary_per_day }); setNewSalary(String(m.salary_per_day)); setSalaryRateModal(true); }} className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-[10px] font-bold hover:bg-blue-500/30 transition-all"><Edit2 size={10} className="inline mr-1" /> Update</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPayModal && payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-sm shadow-2xl p-5">
            <h3 className="font-black text-white mb-1">Pay Salary to {payTarget.name}</h3>
            <p className="text-xs text-slate-500 mb-4">Amount: {inr(payTarget.amount)}</p>
            <div className="flex gap-3">
              <button onClick={handlePaySalary} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white">Confirm Payment</button>
              <button onClick={() => { setShowPayModal(false); setPayTarget(null); }} className="px-6 py-2.5 bg-[#111520] border border-[#21293d] text-slate-400 rounded-xl text-xs font-bold hover:text-white">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showLedgerModal && ledgerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#21293d]">
              <div><h3 className="font-black text-white text-sm">Daily Ledger: {ledgerTarget.name}</h3><p className="text-[10px] text-slate-500">{ledgerFrom} to {ledgerTo}</p></div>
              <button onClick={() => setShowLedgerModal(false)} className="w-8 h-8 flex items-center justify-center bg-[#111520] hover:bg-[#21293d] rounded-lg text-slate-500 hover:text-white transition-all"><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#111520]">
                    {["Date", "Status", "Wage", "Commission", "Advance", "Balance"].map((h) => (
                      <th key={h} className="px-2 py-2 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledgerLoading ? <tr><td colSpan={6} className="text-center py-8"><Loader2 size={20} className="animate-spin text-blue-400 mx-auto" /></td></tr>
                    : ledgerData.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-slate-600 text-xs font-bold">No entries</td></tr>
                    : ledgerData.map((e, i) => (
                      <tr key={i} className={`border-t border-[#21293d]/50 ${e.type === "opening" ? "bg-amber-500/10" : ""}`}>
                        <td className="px-2 py-2 text-xs text-slate-400">{e.date}</td>
                        <td className={`px-2 py-2 text-xs font-bold ${e.status === "Present" ? "text-emerald-400" : e.status === "Half Day" || e.status === "—" ? "text-amber-400" : "text-red-400"}`}>{e.status}</td>
                        <td className="px-2 py-2 text-xs text-right text-slate-300">{e.wage > 0 ? inr(e.wage) : ""}</td>
                        <td className="px-2 py-2 text-xs text-right text-blue-400">{e.comm > 0 ? inr(e.comm) : ""}</td>
                        <td className="px-2 py-2 text-xs text-right text-red-400">{e.adv > 0 ? inr(e.adv) : ""}</td>
                        <td className={`px-2 py-2 text-xs text-right font-bold ${e.balance >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(e.balance)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {salaryRateModal && salaryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-sm shadow-2xl p-5">
            <h3 className="font-black text-white mb-4">Update Salary Rate</h3>
            <div className="space-y-3">
              <div><label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">Staff Name</label><input value={salaryTarget.name} readOnly className="w-full px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300" /></div>
              <div><label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">New Daily Wage</label><input type="number" value={newSalary} onChange={(e) => setNewSalary(e.target.value)} step="any" className="w-full px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50" /></div>
              <div><label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">Effective Date</label><input type="date" value={newEffectiveDate} onChange={(e) => setNewEffectiveDate(e.target.value)} className="w-full px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50" /></div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleUpdateSalary} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white">Save Rate</button>
                <button onClick={() => { setSalaryRateModal(false); setSalaryTarget(null); }} className="px-6 py-2.5 bg-[#111520] border border-[#21293d] text-slate-400 rounded-xl text-xs font-bold hover:text-white">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalaryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin text-blue-400" /></div>}>
      <SalaryContent />
    </Suspense>
  );
}
