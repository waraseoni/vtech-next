"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { Loader2, History, Pencil, IndianRupee, ChevronLeft, ChevronRight } from "lucide-react";

type Mechanic = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  designation: string | null;
  daily_salary: number | null;
  salary_per_day: number | null;
  status: number;
  delete_flag: number;
};

type Attendance = {
  mechanic_id: number;
  curr_date: string;
  status: number; // 1 present, 3 half-day
};

type SalaryHist = {
  id: number;
  mechanic_id: number;
  salary: number;
  effective_date: string;
  date_created: string;
};

type TxnComm = {
  mechanic_id: number | null;
  mechanic_commission_amount: number | null;
  date_created: string;
};

type Advance = {
  mechanic_id: number;
  amount: number;
  date_paid: string;
};

const card = "bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden";
const btn =
  "px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98]";
const btnNavy = `${btn} bg-blue-600 hover:bg-blue-500 text-white`;
const btnGhost = `${btn} bg-white/[0.04] hover:bg-white/[0.07] text-slate-300 border border-[#21293d]`;
const input =
  "w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-slate-700";
const label = "block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5";

function ym(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function monthStart(month: string) {
  return `${month}-01`;
}
function monthEnd(month: string) {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(y, m, 0);
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${month}-${dd}`;
}
function addMonths(month: string, diff: number) {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(y, m - 1 + diff, 1);
  return ym(dt);
}
function money(n: number) {
  return `Rs.${Number(n || 0).toFixed(2)}`;
}

function pickBaseRate(m: Mechanic): number {
  const a = Number(m.salary_per_day ?? NaN);
  const b = Number(m.daily_salary ?? NaN);
  if (!Number.isNaN(a) && a > 0) return a;
  if (!Number.isNaN(b) && b > 0) return b;
  return 0;
}

function rateForDate(history: SalaryHist[], baseRate: number, date: string) {
  // history assumed sorted DESC by effective_date then id
  for (const h of history) {
    if (h.effective_date <= date) return Number(h.salary || 0);
  }
  return baseRate;
}

export default function SalaryPage() {
  const [tab, setTab] = useState<"report" | "master">("report");
  const [month, setMonth] = useState<string>(ym());

  const [loading, setLoading] = useState(true);
  const [mechs, setMechs] = useState<Mechanic[]>([]);
  const [salaryHist, setSalaryHist] = useState<SalaryHist[]>([]);
  const [prevAtt, setPrevAtt] = useState<Attendance[]>([]);
  const [currAtt, setCurrAtt] = useState<Attendance[]>([]);
  const [prevComm, setPrevComm] = useState<TxnComm[]>([]);
  const [currComm, setCurrComm] = useState<TxnComm[]>([]);
  const [prevAdv, setPrevAdv] = useState<Advance[]>([]);
  const [currAdv, setCurrAdv] = useState<Advance[]>([]);
  const [err, setErr] = useState("");

  // Modals
  const [salaryModal, setSalaryModal] = useState<{
    open: boolean;
    mechanic?: Mechanic;
  }>({ open: false });
  const [newSalary, setNewSalary] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [savingSalary, setSavingSalary] = useState(false);

  const [payModal, setPayModal] = useState<{
    open: boolean;
    mechanic?: Mechanic;
    amount?: number;
  }>({ open: false });
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payReason, setPayReason] = useState("");
  const [paying, setPaying] = useState(false);

  const from = useMemo(() => monthStart(month), [month]);
  const to = useMemo(() => monthEnd(month), [month]);
  const prevEnd = useMemo(() => {
    const dt = new Date(from);
    dt.setDate(dt.getDate() - 1);
    return dt.toISOString().slice(0, 10);
  }, [from]);

  const histByMech = useMemo(() => {
    const m = new Map<number, SalaryHist[]>();
    for (const h of salaryHist) {
      const arr = m.get(h.mechanic_id) || [];
      arr.push(h);
      m.set(h.mechanic_id, arr);
    }
    // sort DESC (effective_date, id)
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => (a.effective_date < b.effective_date ? 1 : a.effective_date > b.effective_date ? -1 : b.id - a.id));
      m.set(k, arr);
    }
    return m;
  }, [salaryHist]);

  const prevCommByMech = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of prevComm) {
      if (!r.mechanic_id) continue;
      m.set(Number(r.mechanic_id), (m.get(Number(r.mechanic_id)) || 0) + Number(r.mechanic_commission_amount || 0));
    }
    return m;
  }, [prevComm]);
  const currCommByMech = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of currComm) {
      if (!r.mechanic_id) continue;
      m.set(Number(r.mechanic_id), (m.get(Number(r.mechanic_id)) || 0) + Number(r.mechanic_commission_amount || 0));
    }
    return m;
  }, [currComm]);
  const prevAdvByMech = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of prevAdv) m.set(r.mechanic_id, (m.get(r.mechanic_id) || 0) + Number(r.amount || 0));
    return m;
  }, [prevAdv]);
  const currAdvByMech = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of currAdv) m.set(r.mechanic_id, (m.get(r.mechanic_id) || 0) + Number(r.amount || 0));
    return m;
  }, [currAdv]);

  const prevAttByMech = useMemo(() => {
    const m = new Map<number, Attendance[]>();
    for (const a of prevAtt) {
      const arr = m.get(a.mechanic_id) || [];
      arr.push(a);
      m.set(a.mechanic_id, arr);
    }
    return m;
  }, [prevAtt]);
  const currAttByMech = useMemo(() => {
    const m = new Map<number, Attendance[]>();
    for (const a of currAtt) {
      const arr = m.get(a.mechanic_id) || [];
      arr.push(a);
      m.set(a.mechanic_id, arr);
    }
    return m;
  }, [currAtt]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const { data: mechData, error: mechErr } = await supabase
          .from("mechanic_list")
          .select("id, firstname, middlename, lastname, designation, daily_salary, salary_per_day, status, delete_flag")
          .eq("status", 1)
          .eq("delete_flag", 0)
          .order("firstname", { ascending: true });
        if (mechErr) throw mechErr;
        const list = (mechData || []) as Mechanic[];
        setMechs(list);

        const ids = list.map((m) => m.id);
        if (ids.length === 0) {
          setSalaryHist([]);
          setPrevAtt([]);
          setCurrAtt([]);
          setPrevComm([]);
          setCurrComm([]);
          setPrevAdv([]);
          setCurrAdv([]);
          setLoading(false);
          return;
        }

        const [
          histRes,
          prevAttRes,
          currAttRes,
          prevCommRes,
          currCommRes,
          prevAdvRes,
          currAdvRes,
        ] = await Promise.all([
          supabase
            .from("mechanic_salary_history")
            .select("id, mechanic_id, salary, effective_date, date_created")
            .in("mechanic_id", ids)
            .lte("effective_date", to)
            .order("effective_date", { ascending: false })
            .order("id", { ascending: false }),

          supabase
            .from("attendance_list")
            .select("mechanic_id, curr_date, status")
            .in("mechanic_id", ids)
            .in("status", [1, 3])
            .lte("curr_date", prevEnd),

          supabase
            .from("attendance_list")
            .select("mechanic_id, curr_date, status")
            .in("mechanic_id", ids)
            .in("status", [1, 3])
            .gte("curr_date", from)
            .lte("curr_date", to),

          supabase
            .from("transaction_list")
            .select("mechanic_id, mechanic_commission_amount, date_created")
            .in("mechanic_id", ids as any)
            .lte("date_created", `${prevEnd}T23:59:59`),

          supabase
            .from("transaction_list")
            .select("mechanic_id, mechanic_commission_amount, date_created")
            .in("mechanic_id", ids as any)
            .gte("date_created", `${from}T00:00:00`)
            .lte("date_created", `${to}T23:59:59`),

          supabase
            .from("advance_payments")
            .select("mechanic_id, amount, date_paid")
            .in("mechanic_id", ids)
            .lte("date_paid", prevEnd),

          supabase
            .from("advance_payments")
            .select("mechanic_id, amount, date_paid")
            .in("mechanic_id", ids)
            .gte("date_paid", from)
            .lte("date_paid", to),
        ]);

        if (histRes.error) throw histRes.error;
        if (prevAttRes.error) throw prevAttRes.error;
        if (currAttRes.error) throw currAttRes.error;
        if (prevCommRes.error) throw prevCommRes.error;
        if (currCommRes.error) throw currCommRes.error;
        if (prevAdvRes.error) throw prevAdvRes.error;
        if (currAdvRes.error) throw currAdvRes.error;

        setSalaryHist((histRes.data || []) as SalaryHist[]);
        setPrevAtt((prevAttRes.data || []) as Attendance[]);
        setCurrAtt((currAttRes.data || []) as Attendance[]);
        setPrevComm((prevCommRes.data || []) as TxnComm[]);
        setCurrComm((currCommRes.data || []) as TxnComm[]);
        setPrevAdv((prevAdvRes.data || []) as Advance[]);
        setCurrAdv((currAdvRes.data || []) as Advance[]);
      } catch (e: any) {
        setErr(e?.message || "Failed to load salary data");
      } finally {
        setLoading(false);
      }
    })();
  }, [from, to, prevEnd]);

  const rows = useMemo(() => {
    return mechs.map((m) => {
      const base = pickBaseRate(m);
      const hist = histByMech.get(m.id) || [];

      // Old earned
      let oldEarned = 0;
      for (const a of prevAttByMech.get(m.id) || []) {
        const r = rateForDate(hist, base, a.curr_date);
        oldEarned += a.status === 3 ? r / 2 : r;
      }
      const oldBal = (oldEarned + (prevCommByMech.get(m.id) || 0)) - (prevAdvByMech.get(m.id) || 0);

      // Current month
      let currFix = 0;
      let present = 0;
      let half = 0;
      for (const a of currAttByMech.get(m.id) || []) {
        const r = rateForDate(hist, base, a.curr_date);
        if (a.status === 3) {
          half++;
          currFix += r / 2;
        } else {
          present++;
          currFix += r;
        }
      }

      const currC = currCommByMech.get(m.id) || 0;
      const currA = currAdvByMech.get(m.id) || 0;
      const net = (oldBal + currFix + currC) - currA;

      const name = [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ");
      return {
        mechanic: m,
        name,
        present,
        half,
        oldBal,
        currFix,
        currC,
        currA,
        net,
      };
    });
  }, [
    mechs,
    histByMech,
    prevAttByMech,
    currAttByMech,
    prevCommByMech,
    currCommByMech,
    prevAdvByMech,
    currAdvByMech,
  ]);

  const lastUpdatedByMech = useMemo(() => {
    const m = new Map<number, string>();
    for (const h of salaryHist) {
      if (!m.has(h.mechanic_id)) m.set(h.mechanic_id, h.date_created);
    }
    return m;
  }, [salaryHist]);

  const openUpdateSalary = (m: Mechanic) => {
    setSalaryModal({ open: true, mechanic: m });
    const base = pickBaseRate(m);
    setNewSalary(String(base || 0));
    setEffectiveDate(new Date().toISOString().slice(0, 10));
  };

  const saveSalaryRate = async () => {
    if (!salaryModal.mechanic) return;
    const mid = salaryModal.mechanic.id;
    const ns = Number(newSalary);
    if (!ns || ns < 0) return;
    setSavingSalary(true);
    try {
      const { error: insErr } = await supabase.from("mechanic_salary_history").insert({
        mechanic_id: mid,
        salary: ns,
        effective_date: effectiveDate,
      });
      if (insErr) throw insErr;

      // Keep current master fields in sync (matches PHP UX)
      const { error: upErr } = await supabase
        .from("mechanic_list")
        .update({ daily_salary: ns, salary_per_day: ns })
        .eq("id", mid);
      if (upErr) throw upErr;

      setSalaryModal({ open: false });
      // refresh
      setMonth((m) => m);
    } catch (e: any) {
      alert(e?.message || "Failed to update salary rate");
    } finally {
      setSavingSalary(false);
    }
  };

  const openPaySalary = (m: Mechanic, amt: number) => {
    setPayModal({ open: true, mechanic: m, amount: amt });
    const monthText = new Date(from).toLocaleString("en-IN", { month: "long", year: "numeric" });
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayReason(`Salary for ${monthText}`);
  };

  const paySalary = async () => {
    if (!payModal.mechanic || !payModal.amount) return;
    setPaying(true);
    try {
      const { error } = await supabase.from("advance_payments").insert({
        mechanic_id: payModal.mechanic.id,
        amount: Number(payModal.amount),
        date_paid: payDate,
        reason: payReason || null,
      });
      if (error) throw error;
      setPayModal({ open: false });
      // refresh
      setMonth((m) => m);
    } catch (e: any) {
      alert(e?.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  return (
    <AdminPage title="Salary" subtitle="PHP parity: Salary Report + Salary Rate Master">
      <div className="flex flex-col gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            className={tab === "report" ? btnNavy : btnGhost}
            onClick={() => setTab("report")}
          >
            Salary Report
          </button>
          <button
            className={tab === "master" ? btnNavy : btnGhost}
            onClick={() => setTab("master")}
          >
            Salary Rate Master
          </button>
        </div>

        {/* Month selector */}
        {tab === "report" && (
          <div className={`${card} px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}>
            <div className="flex items-center gap-2">
              <button className={btnGhost} onClick={() => setMonth(addMonths(month, -1))} title="Prev Month">
                <ChevronLeft size={16} />
              </button>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={input}
                style={{ maxWidth: 180 }}
              />
              <button className={btnGhost} onClick={() => setMonth(addMonths(month, 1))} title="Next Month">
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="text-slate-600 text-xs font-extrabold uppercase tracking-[0.3em]">
              Period: {from} → {to}
            </div>
          </div>
        )}

        {err && (
          <div className={`${card} p-4 text-red-400 text-sm`}>{err}</div>
        )}

        {loading ? (
          <div className={`${card} p-10 flex items-center justify-center gap-2 text-slate-600 text-xs font-extrabold uppercase tracking-[0.3em]`}>
            <Loader2 size={16} className="animate-spin" /> Loading...
          </div>
        ) : tab === "report" ? (
          <div className={card}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#111520] text-slate-600 text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="text-left px-4 py-3">Staff</th>
                    <th className="text-center px-4 py-3">Attendance (P | HD)</th>
                    <th className="text-right px-4 py-3">Earned Salary</th>
                    <th className="text-right px-4 py-3">Commission</th>
                    <th className="text-right px-4 py-3">Old Bal</th>
                    <th className="text-right px-4 py-3">Advance</th>
                    <th className="text-right px-4 py-3">Net Total</th>
                    <th className="text-right px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2234]">
                  {rows.map((r) => {
                    const m = r.mechanic;
                    const netAbs = Math.abs(r.net);
                    const name = r.name;
                    return (
                      <tr key={m.id} className="hover:bg-white/[0.03]">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <Link
                              href={`/salary/${m.id}/ledger?from=${from}&to=${to}`}
                              className="text-slate-200 font-black hover:text-blue-400 transition-colors"
                            >
                              {name}
                            </Link>
                            <span className="text-slate-600 text-xs">{m.designation || "Staff"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-emerald-300 font-black">{r.present}</span>
                          <span className="text-slate-700 mx-2">|</span>
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-black">
                            {r.half}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-200 font-bold">{money(r.currFix)}</td>
                        <td className="px-4 py-3 text-right text-blue-300 font-black">{money(r.currC)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${r.oldBal < 0 ? "text-red-300" : "text-slate-200"}`}>
                          {money(r.oldBal)}
                        </td>
                        <td className="px-4 py-3 text-right text-red-300 font-black">{money(r.currA)}</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={
                              r.net >= 0
                                ? "inline-flex px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-black"
                                : "inline-flex px-2.5 py-1 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 font-black"
                            }
                          >
                            {money(netAbs)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.net > 0 ? (
                            <button
                              className={`${btnNavy} inline-flex items-center gap-2`}
                              onClick={() => openPaySalary(m, r.net)}
                            >
                              <IndianRupee size={14} />
                              Pay
                            </button>
                          ) : (
                            <span className="text-slate-600 text-xs font-black uppercase tracking-widest">
                              Settled
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-[#21293d] text-[10px] text-slate-700 font-black uppercase tracking-widest">
              Note: Old Balance is computed from attendance+commission−advance up to {prevEnd}.
            </div>
          </div>
        ) : (
          <div className={card}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#111520] text-slate-600 text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="text-left px-4 py-3">Staff</th>
                    <th className="text-right px-4 py-3">Current Daily Wage</th>
                    <th className="text-center px-4 py-3">Last Updated</th>
                    <th className="text-right px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2234]">
                  {mechs.map((m) => {
                    const nm = [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ");
                    const last = lastUpdatedByMech.get(m.id);
                    return (
                      <tr key={m.id} className="hover:bg-white/[0.03]">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-slate-200 font-black">{nm}</span>
                            <span className="text-slate-600 text-xs">{m.designation || "Staff"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-300 font-black">
                          {money(pickBaseRate(m))}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500">
                          {last ? String(last).slice(0, 10) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button className={btnGhost} onClick={() => openUpdateSalary(m)}>
                              <span className="inline-flex items-center gap-2">
                                <Pencil size={14} /> Update
                              </span>
                            </button>
                            <Link
                              href={`/salary/${m.id}/ledger?from=${from}&to=${to}`}
                              className={`${btnGhost} inline-flex items-center gap-2`}
                            >
                              <History size={14} /> Ledger
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Salary Rate Modal */}
        {salaryModal.open && salaryModal.mechanic && (
          <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#0d1117] border border-[#21293d] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#21293d] bg-gradient-to-r from-blue-600/15 to-transparent">
                <div className="text-white font-black">Update Salary Rate</div>
                <div className="text-slate-600 text-sm">
                  {[salaryModal.mechanic.firstname, salaryModal.mechanic.lastname].filter(Boolean).join(" ")}
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <div className={label}>New Daily Wage</div>
                  <input className={input} type="number" step="any" value={newSalary} onChange={(e) => setNewSalary(e.target.value)} />
                </div>
                <div>
                  <div className={label}>Effective Date</div>
                  <input className={input} type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                  <div className="text-slate-700 text-xs mt-1">
                    Backdate allowed (PHP parity).
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-[#21293d] flex items-center justify-end gap-2">
                <button className={btnGhost} onClick={() => setSalaryModal({ open: false })} disabled={savingSalary}>
                  Cancel
                </button>
                <button className={btnNavy} onClick={saveSalaryRate} disabled={savingSalary}>
                  {savingSalary ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Saving</span> : "Save Rate"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pay Salary Modal */}
        {payModal.open && payModal.mechanic && (
          <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#0d1117] border border-[#21293d] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#21293d] bg-gradient-to-r from-emerald-600/15 to-transparent">
                <div className="text-white font-black">Pay Salary</div>
                <div className="text-slate-600 text-sm">
                  {[payModal.mechanic.firstname, payModal.mechanic.lastname].filter(Boolean).join(" ")} · {money(payModal.amount || 0)}
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <div className={label}>Payment Date</div>
                  <input className={input} type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                </div>
                <div>
                  <div className={label}>Reason</div>
                  <input className={input} value={payReason} onChange={(e) => setPayReason(e.target.value)} placeholder="Salary for ..." />
                </div>
              </div>
              <div className="px-5 py-4 border-t border-[#21293d] flex items-center justify-end gap-2">
                <button className={btnGhost} onClick={() => setPayModal({ open: false })} disabled={paying}>
                  Cancel
                </button>
                <button className={btnNavy} onClick={paySalary} disabled={paying}>
                  {paying ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Paying</span> : "Pay"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  );
}

