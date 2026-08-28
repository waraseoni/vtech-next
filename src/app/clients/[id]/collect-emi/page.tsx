"use client";
import { useState, useEffect, use, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  CreditCard,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Banknote,
  Clock,
  IndianRupee,
} from "lucide-react";
import Link from "next/link";

function todayIST(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const p: Record<string, string> = {};
  parts.forEach((x) => {
    p[x.type] = x.value;
  });
  return `${p.year}-${p.month}-${p.day}`;
}

const inr = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const inputCls =
  "w-full px-4 py-3 bg-[#111520] border border-[#21293d] rounded-xl text-white font-bold text-sm placeholder:text-slate-700 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all [color-scheme:dark]";

const labelCls =
  "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mb-2";

type ActiveLoan = {
  id: number;
  principal_amount: number;
  total_payable: number;
  emi_amount: number;
  loan_date: string;
  remarks?: string;
  paid: number;
  balance: number;
};

export default function CollectEMIPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = parseInt(resolvedParams.id);
  const preselectedLoanId = searchParams.get("loan_id");

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [clientName, setClientName] = useState("");
  const [loans, setLoans] = useState<ActiveLoan[]>([]);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [selectedLoanId, setSelectedLoanId] = useState<string>(preselectedLoanId || "");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIST);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [remarks, setRemarks] = useState("");

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
          .select("firstname, middlename, lastname")
          .eq("id", clientId)
          .eq("delete_flag", 0)
          .single();

        if (cd) {
          setClientName([cd.firstname, cd.middlename, cd.lastname].filter(Boolean).join(" "));
        }

        const { data: loansData } = await supabase
          .from("client_loans")
          .select("id, principal_amount, total_payable, emi_amount, loan_date, remarks, status")
          .eq("client_id", clientId)
          .eq("status", 1)
          .order("loan_date", { ascending: false });

        const activeLoans: ActiveLoan[] = [];
        for (const loan of loansData || []) {
          const { data: pays } = await supabase
            .from("client_payments")
            .select("amount, discount")
            .eq("loan_id", loan.id);
          const paid = (pays || []).reduce((s, p) => s + p.amount + (p.discount || 0), 0);
          const balance = loan.total_payable - paid;
          if (balance > 0) {
            activeLoans.push({ ...loan, paid, balance });
          }
        }
        setLoans(activeLoans);
      } catch (err) {
        console.error("fetchData:", err instanceof Error ? err.message : JSON.stringify(err));
      } finally {
        setFetching(false);
      }
    };
    fetchData();
  }, [clientId]);

  useEffect(() => {
    if (preselectedLoanId) setSelectedLoanId(preselectedLoanId);
  }, [preselectedLoanId]);

  const selectedLoan = useMemo(
    () => loans.find((l) => String(l.id) === selectedLoanId) || null,
    [loans, selectedLoanId]
  );

  useEffect(() => {
    if (selectedLoan) {
      const autoAmount = Math.min(selectedLoan.emi_amount, selectedLoan.balance);
      setAmount(autoAmount > 0 ? autoAmount.toFixed(2) : "");
      setRemarks("Monthly EMI Payment");
    } else {
      setAmount("");
      setRemarks("");
    }
  }, [selectedLoan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) {
      setToast({ type: "error", msg: "Amount valid rakho!" });
      return;
    }
    if (selectedLoan && amt > selectedLoan.balance) {
      setToast({
        type: "error",
        msg: `Balance se zyada nahi de sakte! Max: ${inr(selectedLoan.balance)}`,
      });
      return;
    }
    setLoading(true);
    try {
      const paymentData: Record<string, unknown> = {
        client_id: clientId,
        amount: amt,
        payment_date: `${paymentDate}T00:00:00+05:30`,
        payment_mode: paymentMode,
        remarks: remarks.trim() || null,
        payment_type: selectedLoan ? "Loan EMI" : "Cash",
      };
      if (selectedLoan) {
        paymentData.loan_id = selectedLoan.id;
      }
      const { error } = await supabase.from("client_payments").insert([paymentData]);
      if (error) throw error;
      setToast({ type: "success", msg: "EMI jama ho gayi! ✅" });
      setTimeout(() => router.replace(`/clients/${clientId}/view`), 1000);
    } catch (err) {
      setToast({
        type: "error",
        msg: err instanceof Error ? err.message : "Payment save mein galti!",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold ${
            toast.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/15 border-red-500/30 text-red-400"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
        {/* HEADER */}
        <div className="relative overflow-hidden bg-[#161b27] rounded-3xl border border-[#21293d] p-5">
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-orange-600/8 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <Link
              href={`/clients/${clientId}/view`}
              className="w-10 h-10 flex items-center justify-center bg-[#111520] border border-[#21293d] hover:border-slate-500 rounded-xl text-slate-500 hover:text-white transition-all flex-shrink-0"
            >
              <ArrowLeft size={17} />
            </Link>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-11 h-11 bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/40 flex-shrink-0">
                <TrendingUp className="text-white" size={20} />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-black tracking-tight text-white leading-none">
                  Collect EMI
                </h1>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 truncate">
                  {fetching ? "Loading…" : clientName || `Client #${clientId}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* NO ACTIVE LOANS */}
        {!fetching && loans.length === 0 && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-6 text-center">
            <Banknote size={32} className="mx-auto text-amber-400/60 mb-3" />
            <p className="text-amber-300 font-bold text-sm">Koi active loan nahi hai</p>
            <p className="text-slate-500 text-xs mt-1">
              Pehle &quot;Give Loan&quot; se loan do, phir EMI collect karo.
            </p>
            <Link
              href={`/clients/${clientId}/give-loan`}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 rounded-xl font-bold text-sm bg-amber-600 hover:bg-amber-700 text-white transition-all no-underline"
            >
              <Banknote size={14} /> Give Loan
            </Link>
          </div>
        )}

        {/* LOAN SELECTOR */}
        {!fetching && loans.length > 0 && (
          <div className="bg-[#161b27] rounded-3xl border border-[#21293d] p-5 md:p-6">
            <label className={labelCls}>
              <Banknote size={13} className="text-amber-400" />
              Select Loan <span className="text-red-400 ml-0.5">*</span>
            </label>
            <select
              value={selectedLoanId}
              onChange={(e) => setSelectedLoanId(e.target.value)}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">— Loan select karo —</option>
              {loans.map((l) => (
                <option key={l.id} value={l.id}>
                  Loan #{l.id} — Balance: {inr(l.balance)} — EMI:{" "}
                  {inr(Math.min(l.emi_amount, l.balance))}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* SELECTED LOAN DETAILS CARD */}
        {selectedLoan && (
          <div className="rounded-2xl border border-amber-500/20 bg-[#161b27] p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <Banknote size={14} className="text-amber-400" />
              </div>
              <span className="text-sm font-bold text-white">Loan #{selectedLoan.id}</span>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full ml-auto">
                Active
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-[#111520] border border-[#21293d] p-3">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                  Principal
                </p>
                <p className="text-white font-bold mt-1">{inr(selectedLoan.principal_amount)}</p>
              </div>
              <div className="rounded-xl bg-[#111520] border border-[#21293d] p-3">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                  Total Payable
                </p>
                <p className="text-white font-bold mt-1">{inr(selectedLoan.total_payable)}</p>
              </div>
              <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-3">
                <p className="text-[9px] font-black uppercase tracking-wider text-emerald-400">
                  Paid
                </p>
                <p className="text-emerald-400 font-bold mt-1">{inr(selectedLoan.paid)}</p>
              </div>
              <div className="rounded-xl bg-red-500/8 border border-red-500/20 p-3">
                <p className="text-[9px] font-black uppercase tracking-wider text-red-400">
                  Balance
                </p>
                <p className="text-red-400 font-bold mt-1">{inr(selectedLoan.balance)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <Clock size={11} />
              EMI/Month:{" "}
              <span className="text-amber-400 font-bold">{inr(selectedLoan.emi_amount)}</span>
              <span className="mx-1">·</span>
              Loan Date:{" "}
              <span className="text-white font-semibold">
                {selectedLoan.loan_date?.slice(0, 10)}
              </span>
            </div>
          </div>
        )}

        {/* PAYMENT FORM */}
        {!fetching && loans.length > 0 && (
          <div className="bg-[#161b27] rounded-3xl border border-[#21293d] p-5 md:p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Amount */}
              <div>
                <label className={labelCls}>
                  <IndianRupee size={13} className="text-orange-400" />
                  Amount Paid (Jama Rakam) <span className="text-red-400 ml-0.5">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={inputCls}
                />
                {selectedLoan && (
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setAmount(
                          Math.min(selectedLoan.emi_amount, selectedLoan.balance).toFixed(2)
                        )
                      }
                      className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all"
                    >
                      EMI ({inr(Math.min(selectedLoan.emi_amount, selectedLoan.balance))})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmount(selectedLoan.balance.toFixed(2))}
                      className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                    >
                      Full Settlement ({inr(selectedLoan.balance)})
                    </button>
                  </div>
                )}
              </div>

              {/* Date + Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    <Calendar size={13} className="text-blue-400" />
                    Payment Date <span className="text-red-400 ml-0.5">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className={`${inputCls} [color-scheme:dark]`}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    <CreditCard size={13} className="text-violet-400" />
                    Payment Mode <span className="text-red-400 ml-0.5">*</span>
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className={`${inputCls} cursor-pointer`}
                  >
                    <option>Cash</option>
                    <option>PhonePe/GPay</option>
                    <option>Online</option>
                    <option>Cheque</option>
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className={labelCls}>
                  <FileText size={13} className="text-slate-400" />
                  Remarks / Note
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional note…"
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || fetching || !selectedLoanId}
                className="w-full py-3.5 rounded-xl font-black text-sm bg-orange-600 hover:bg-orange-700 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <TrendingUp size={16} />
                )}
                {loading ? "Saving…" : "Collect EMI"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
