"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Banknote, Calendar, Percent, Clock, FileText,
  CheckCircle2, AlertCircle, Loader2, TrendingDown,
} from "lucide-react";
import Link from "next/link";

function todayIST(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const p: Record<string, string> = {};
  parts.forEach(x => { p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}`;
}

const inr = (n: number) =>
  "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const inputCls =
  "w-full px-4 py-3 bg-[#111520] border border-[#21293d] rounded-xl text-white font-bold text-sm placeholder:text-slate-700 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all [color-scheme:dark]";

const labelCls =
  "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mb-2";

export default function GiveLoanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router         = useRouter();
  const clientId       = parseInt(resolvedParams.id);

  const [loading,     setLoading]     = useState(false);
  const [fetching,    setFetching]    = useState(true);
  const [clientName,  setClientName]  = useState("");
  const [balance,     setBalance]     = useState<number | null>(null);
  const [toast,       setToast]       = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [principal,   setPrincipal]   = useState("");
  const [interestRate,setInterestRate]= useState("0");
  const [months,      setMonths]      = useState("1");
  const [loanDate,    setLoanDate]    = useState(todayIST);
  const [remarks,     setRemarks]     = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const fetchData = async () => {
      setFetching(true);
      try {
        const { data: cd } = await supabase
          .from("client_list")
          .select("firstname, middlename, lastname, opening_balance")
          .eq("id", clientId)
          .eq("delete_flag", 0)
          .single();

        if (cd) {
          setClientName(
            [cd.firstname, cd.middlename, cd.lastname].filter(Boolean).join(" ")
          );
          const [{ data: txns }, { data: sales }, { data: pays }, { data: loans }] = await Promise.all([
            supabase.from("transaction_list").select("amount").eq("client_name", String(clientId)).eq("status", 5),
            supabase.from("direct_sales").select("total_amount").eq("client_id", clientId),
            supabase.from("client_payments").select("amount, discount, loan_id").eq("client_id", clientId),
            supabase.from("client_loans").select("id, total_payable").eq("client_id", clientId).eq("status", 1),
          ]);
          const activeLoanIds = new Set((loans || []).map((l: { id: number }) => l.id));
          let loanRepaid = 0;
          const repairBilled = (txns || []).reduce((s: number, j: { amount: number }) => s + (j.amount || 0), 0);
          const directBilled = (sales || []).reduce((s: number, d: { total_amount: number }) => s + (d.total_amount || 0), 0);
          let totalPaid = 0;
          (pays || []).forEach((p: { amount: number; discount?: number; loan_id?: number }) => {
            const credit = p.amount + (p.discount || 0);
            if (!p.loan_id) totalPaid += credit;
            else if (activeLoanIds.has(p.loan_id)) loanRepaid += credit;
          });
          const loanGiven = (loans || []).reduce((s: number, l: { total_payable: number }) => s + (l.total_payable || 0), 0);
          setBalance(cd.opening_balance + repairBilled + directBilled - totalPaid + loanGiven - loanRepaid);
        }
      } catch (err) {
        console.error("fetchData:", err instanceof Error ? err.message : JSON.stringify(err));
      } finally {
        setFetching(false);
      }
    };
    fetchData();
  }, [clientId]);

  const p = parseFloat(principal) || 0;
  const r = parseFloat(interestRate) || 0;
  const m = parseInt(months) || 1;
  const totalInterest = p * (r / 100);
  const totalPayable  = p + totalInterest;
  const emi           = m > 0 ? totalPayable / m : totalPayable;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (p <= 0) {
      setToast({ type: "error", msg: "Principal amount valid rakho!" });
      return;
    }
    if (m < 1) {
      setToast({ type: "error", msg: "Kist ki avadhi kam se kam 1 month honi chahiye!" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("client_loans").insert([{
        client_id:        clientId,
        principal_amount: p,
        interest_rate:    r,
        loan_period:      m,
        total_payable:    totalPayable,
        emi_amount:       emi,
        loan_date:        `${loanDate}T00:00:00+05:30`,
        remarks:          remarks.trim() || null,
        status:           1,
      }]);
      if (error) throw error;
      setToast({ type: "success", msg: "Loan save ho gaya! ✅" });
      setTimeout(() => router.replace(`/clients/${clientId}/view`), 1000);
    } catch (err) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Loan save mein galti!" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold ${
          toast.type === "success"
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            : "bg-red-500/15 border-red-500/30 text-red-400"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
        {/* HEADER */}
        <div className="relative overflow-hidden bg-[#161b27] rounded-3xl border border-[#21293d] p-5">
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-600/8 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <Link
              href={`/clients/${clientId}/view`}
              className="w-10 h-10 flex items-center justify-center bg-[#111520] border border-[#21293d] hover:border-slate-500 rounded-xl text-slate-500 hover:text-white transition-all flex-shrink-0"
            >
              <ArrowLeft size={17} />
            </Link>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl flex items-center justify-center shadow-lg shadow-amber-900/40 flex-shrink-0">
                <Banknote className="text-white" size={20} />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-black tracking-tight text-white leading-none">Give Loan / Advance</h1>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 truncate">
                  {fetching ? "Loading…" : clientName || `Client #${clientId}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* BALANCE CONTEXT */}
        {balance !== null && (
          <div className={`rounded-2xl border p-4 flex items-center gap-4 ${
            balance > 0
              ? "bg-red-500/8 border-red-500/20"
              : "bg-emerald-500/8 border-emerald-500/20"
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              balance > 0 ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"
            }`}>
              {balance > 0 ? <TrendingDown size={18} /> : <CheckCircle2 size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                {balance > 0 ? "Current Outstanding" : "Advance Balance"}
              </p>
              <p className={`text-xl font-black mt-0.5 ${balance > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {inr(balance)}
              </p>
            </div>
          </div>
        )}

        {/* FORM */}
        <div className="bg-[#161b27] rounded-3xl border border-[#21293d] p-5 md:p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Principal */}
            <div>
              <label className={labelCls}>
                <Banknote size={13} className="text-amber-400" />
                Loan / Advance Amount (Mool Dhan) <span className="text-red-400 ml-0.5">*</span>
              </label>
              <input
                type="number" step="0.01" min="0.01" required
                value={principal} onChange={e => setPrincipal(e.target.value)}
                placeholder="0.00" className={inputCls}
              />
            </div>

            {/* Interest + Months */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  <Percent size={13} className="text-blue-400" />
                  Interest Rate (%)
                </label>
                <input
                  type="number" step="0.01" min="0"
                  value={interestRate} onChange={e => setInterestRate(e.target.value)}
                  placeholder="0" className={inputCls}
                />
                <p className="text-[10px] text-slate-600 mt-1">Byaj nahi lena to 0 rakho.</p>
              </div>
              <div>
                <label className={labelCls}>
                  <Clock size={13} className="text-violet-400" />
                  Kist ki Avadhi (Months) <span className="text-red-400 ml-0.5">*</span>
                </label>
                <input
                  type="number" min="1" required
                  value={months} onChange={e => setMonths(e.target.value)}
                  placeholder="1" className={inputCls}
                />
              </div>
            </div>

            {/* Calculated Totals */}
            <div className="rounded-2xl bg-[#111520] border border-[#21293d] p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total Payable (Byaj Sahit)</span>
                <span className="text-white font-bold text-sm tabular-nums">{inr(totalPayable)}</span>
              </div>
              <div className="h-px bg-[#21293d]" />
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Monthly EMI (Masik Kist)</span>
                <span className="text-amber-400 font-black text-lg tabular-nums">{inr(emi)}</span>
              </div>
            </div>

            {/* Loan Date */}
            <div>
              <label className={labelCls}>
                <Calendar size={13} className="text-emerald-400" />
                Loan Dene ki Tarikh <span className="text-red-400 ml-0.5">*</span>
              </label>
              <input
                type="date" required
                value={loanDate} onChange={e => setLoanDate(e.target.value)}
                className={`${inputCls} [color-scheme:dark]`}
              />
            </div>

            {/* Remarks */}
            <div>
              <label className={labelCls}>
                <FileText size={13} className="text-slate-400" />
                Remarks / Note
              </label>
              <textarea
                rows={2}
                value={remarks} onChange={e => setRemarks(e.target.value)}
                placeholder="Optional note…"
                className={`${inputCls} resize-none`}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || fetching}
              className="w-full py-3.5 rounded-xl font-black text-sm bg-amber-600 hover:bg-amber-700 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />}
              {loading ? "Saving…" : "Give Loan"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
