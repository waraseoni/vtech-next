"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, IndianRupee, Calendar, CreditCard, Receipt,
  CheckCircle2, AlertCircle, Loader2, Wrench, ShoppingCart,
  Wallet, TrendingDown, Save,
} from "lucide-react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// TIMEZONE HELPERS — IST (UTC+5:30)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * BUG FIX 1: new Date().toISOString().split('T')[0] returns UTC date.
 * At 11:50 PM IST, UTC is already next day → wrong default date.
 * todayIST() uses Intl to get the actual current date in Asia/Kolkata.
 */
function todayIST(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const p: Record<string, string> = {};
  parts.forEach(x => { p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const inr = (n: number) =>
  "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const inputCls =
  "w-full px-4 py-3 bg-[#111520] border border-[#21293d] rounded-xl text-white font-bold text-sm placeholder:text-slate-700 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all [color-scheme:dark]";

const labelCls =
  "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mb-2";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type JobOption  = { id: number; job_id: string; code?: string; item: string; amount: number; status: number; };
type SaleOption = { id: number; sale_code: string; total_amount: number; };

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AddPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router         = useRouter();
  const clientId       = parseInt(resolvedParams.id);

  const [fetchingMeta,  setFetchingMeta]  = useState(true);
  const [loading,       setLoading]       = useState(false);
  const [clientName,    setClientName]    = useState("");
  const [balance,       setBalance]       = useState<number | null>(null);
  const [jobs,          setJobs]          = useState<JobOption[]>([]);
  const [directSales,   setDirectSales]   = useState<SaleOption[]>([]);
  const [toast,         setToast]         = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // BUG FIX 1: default date = todayIST(), not toISOString().split('T')[0]
  const [amount,        setAmount]        = useState("");
  const [paymentDate,   setPaymentDate]   = useState(todayIST);
  const [discount,      setDiscount]      = useState("0");
  const [paymentMode,   setPaymentMode]   = useState("Cash");
  const [remarks,       setRemarks]       = useState("");
  const [referenceType, setReferenceType] = useState<"none" | "job" | "sale">("none");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [billNo,        setBillNo]        = useState("");

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── FETCH ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      setFetchingMeta(true);
      try {
        // BUG FIX 3: table = client_list (not "clients")
        // BUG FIX 4: columns = firstname/middlename/lastname (not "name")
        // BUG FIX 16: filter delete_flag = 0
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

          // BUG FIX 12: calculate live balance to show context
          // BUG FIX 6: client_name in transaction_list stores id as TEXT
          const [{ data: txns }, { data: sales }, { data: pays }] = await Promise.all([
            supabase
              .from("transaction_list")
              .select("amount, status")
              .eq("client_name", String(clientId)),
            supabase
              .from("direct_sales")
              .select("total_amount")
              .eq("client_id", clientId),
            supabase
              .from("client_payments")
              .select("amount, discount")
              .eq("client_id", clientId)
              .is("loan_id", null),
          ]);
          const repairBilled = (txns  || [])
            .filter(j => j.status === 2 || j.status === 3 || j.status === 5)
            .reduce((s, j) => s + (j.amount || 0), 0);
          const directBilled = (sales || []).reduce((s, d) => s + (d.total_amount || 0), 0);
          const totalPaid    = (pays  || []).reduce((s, p) => s + (p.amount + (p.discount || 0)), 0);
          setBalance(cd.opening_balance + repairBilled + directBilled - totalPaid);
        }

        // BUG FIX 5: table = transaction_list (not "jobs")
        // BUG FIX 6: item_name→item, final_bill→amount, created_at→date_created, client_id→client_name(text)
        // BUG FIX 7: status is numeric — Cancelled=4, Delivered=5 (not string values)
        const { data: jobsData } = await supabase
          .from("transaction_list")
          .select("id, job_id, code, item, amount, status")
          .eq("client_name", String(clientId))
          .not("status", "in", "(4,5)")
          .order("date_created", { ascending: false });
        setJobs(jobsData || []);

        // BUG FIX 8: created_at → date_created
        const { data: salesData } = await supabase
          .from("direct_sales")
          .select("id, sale_code, total_amount")
          .eq("client_id", clientId)
          .order("date_created", { ascending: false });
        setDirectSales(salesData || []);

      } catch (err) {
        console.error("fetchData:", err instanceof Error ? err.message : JSON.stringify(err));
      } finally {
        setFetchingMeta(false);
      }
    };
    fetchData();
  }, [clientId]);

  // ── DERIVED ────────────────────────────────────────────────────────────
  const netAmount = (parseFloat(amount) || 0) + (parseFloat(discount) || 0);

  // ── SUBMIT ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setToast({ type: "error", msg: "Valid amount enter karo!" });
      return;
    }
    setLoading(true);
    try {
      const paymentData: Record<string, unknown> = {
        client_id:    clientId,
        amount:       parseFloat(amount),
        // BUG FIX 2: save with +05:30 offset so Supabase stores correct UTC
        // Plain "YYYY-MM-DD" → Supabase treats as UTC midnight → reads back as prev day in IST
        payment_date: `${paymentDate}T00:00:00+05:30`,
        discount:     parseFloat(discount) || 0,
        // net_amount is GENERATED ALWAYS AS (amount - discount) in DB — never insert it
        payment_mode: paymentMode,
        remarks:      remarks.trim() || null,
      };

      // BUG FIX 9: job_id in client_payments is TEXT (e.g. "JOB-001")
      // Do NOT parseInt — find the string job_id from the selected job record
      if (referenceType === "job" && selectedJobId) {
        const job = jobs.find(j => String(j.id) === selectedJobId);
        paymentData.job_id = job?.job_id ?? null;
      } else if (referenceType === "sale" && billNo) {
        paymentData.bill_no = billNo;
      }

      const { error } = await supabase.from("client_payments").insert([paymentData]);
      if (error) throw error;

      setToast({ type: "success", msg: "Payment save ho gayi! ✅" });
      // BUG FIX 11: don't push + refresh (causes warning on unmounted component)
      // Use replace — navigates cleanly without stacking history
      setTimeout(() => router.replace(`/clients/${clientId}/view`), 1000);
    } catch (err) {
      console.error("insert error:", err instanceof Error ? err.message : JSON.stringify(err));
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Payment save mein galti!" });
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    // BUG FIX 13: dark theme — bg-[#0d1117] matching rest of app
    <div className="min-h-screen bg-[#0d1117] text-white font-sans">

      {/* ── Toast notification ──────────────────────────────────────── */}
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

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-[#161b27] rounded-3xl border border-[#21293d] p-5">
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-600/8 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <Link
              href={`/clients/${clientId}/view`}
              className="w-10 h-10 flex items-center justify-center bg-[#111520] border border-[#21293d] hover:border-slate-500 rounded-xl text-slate-500 hover:text-white transition-all flex-shrink-0"
            >
              <ArrowLeft size={17} />
            </Link>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/40 flex-shrink-0">
                <IndianRupee className="text-white" size={20} />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-black tracking-tight text-white leading-none">Add Payment</h1>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 truncate">
                  {fetchingMeta ? "Loading…" : clientName || `Client #${clientId}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── BALANCE CONTEXT CARD (BUG FIX 12) ──────────────────────── */}
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
                {balance > 0 ? "Outstanding Balance (Due)" : "Advance / Credit"}
              </p>
              <p className={`text-xl font-black mt-0.5 ${balance > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {inr(balance)}
              </p>
            </div>
            {balance > 0 && (
              <button
                type="button"
                onClick={() => setAmount(balance.toFixed(2))}
                className="text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition-all whitespace-nowrap flex-shrink-0"
              >
                Full Amount
              </button>
            )}
          </div>
        )}

        {/* ── FORM ────────────────────────────────────────────────────── */}
        <div className="bg-[#161b27] rounded-3xl border border-[#21293d] p-5 md:p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Amount + Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  <IndianRupee size={13} className="text-emerald-400" />
                  Amount Received <span className="text-red-400 ml-0.5">*</span>
                </label>
                <input
                  type="number" step="0.01" min="0.01" required
                  value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0.00" className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  <Calendar size={13} className="text-blue-400" />
                  Payment Date <span className="text-red-400 ml-0.5">*</span>
                </label>
                <input
                  type="date" required
                  value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Discount + Net preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Discount (if any)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={discount} onChange={e => setDiscount(e.target.value)}
                  placeholder="0.00" className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  <Wallet size={13} className="text-violet-400" />
                  Net Amount (preview)
                </label>
                <div className={`${inputCls} flex items-center gap-2 opacity-75 cursor-not-allowed`}>
                  <span className={netAmount >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {amount ? inr(netAmount) : "—"}
                  </span>
                  {amount && parseFloat(discount) > 0 && (
                    <span className="text-slate-700 text-xs">({amount} + {discount})</span>
                  )}
                </div>
                <p className="text-[9px] text-slate-700 mt-1 ml-1">Auto-calculated by database</p>
              </div>
            </div>

            {/* Payment Mode — pill buttons */}
            <div>
              <label className={labelCls}>
                <CreditCard size={13} className="text-blue-400" />
                Payment Mode <span className="text-red-400 ml-0.5">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {["Cash", "PhonePe/GPay", "Bank Transfer", "Credit Card"].map(mode => (
                  <button
                    key={mode} type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black border transition-all ${
                      paymentMode === mode
                        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20"
                        : "bg-[#111520] border-[#21293d] text-slate-500 hover:border-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference */}
            <div>
              <label className={labelCls}>
                <Receipt size={13} className="text-amber-400" />
                Reference (Optional)
              </label>
              <div className="flex gap-2 flex-wrap mb-3">
                {(["none", "job", "sale"] as const).map(t => (
                  <button
                    key={t} type="button"
                    onClick={() => { setReferenceType(t); setSelectedJobId(""); setBillNo(""); }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black border transition-all ${
                      referenceType === t
                        ? "bg-amber-500/20 border-amber-500/30 text-amber-300"
                        : "bg-[#111520] border-[#21293d] text-slate-500 hover:border-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {t === "none" && "No Reference"}
                    {t === "job"  && <><Wrench size={11} />Link to Job</>}
                    {t === "sale" && <><ShoppingCart size={11} />Link to Sale</>}
                  </button>
                ))}
              </div>

              {referenceType === "job" && (
                <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)} className={inputCls}>
                  <option value="">— Select a job —</option>
                  {jobs.length === 0 && <option disabled>No active jobs found</option>}
                  {/* BUG FIX 14: show job_id + code + item for clear identification */}
                  {jobs.map(job => (
                    <option key={job.id} value={String(job.id)}>
                      {job.job_id || `#${job.id}`}{job.code ? ` [${job.code}]` : ""} — {job.item} — {inr(job.amount || 0)}
                    </option>
                  ))}
                </select>
              )}

              {referenceType === "sale" && (
                <select value={billNo} onChange={e => setBillNo(e.target.value)} className={inputCls}>
                  <option value="">— Select a sale —</option>
                  {directSales.length === 0 && <option disabled>No direct sales found</option>}
                  {directSales.map(sale => (
                    <option key={sale.id} value={sale.sale_code}>
                      {sale.sale_code} — {inr(sale.total_amount)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Remarks */}
            <div>
              <label className={labelCls}>Remarks</label>
              <textarea
                rows={3} value={remarks} onChange={e => setRemarks(e.target.value)}
                placeholder="Koi notes ya reason…"
                className={`${inputCls} resize-none`}
              />
            </div>

            {/* Summary strip */}
            {amount && parseFloat(amount) > 0 && (
              <div className="bg-[#111520] rounded-2xl border border-[#21293d] p-4 space-y-2.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Payment Summary</p>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Amount</span>
                  <span className="text-white font-bold">{inr(parseFloat(amount) || 0)}</span>
                </div>
                {parseFloat(discount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Discount</span>
                    <span className="text-amber-400 font-bold">− {inr(parseFloat(discount))}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t border-[#21293d] pt-2">
                  <span className="text-slate-400 font-black">Net Received</span>
                  <span className="text-emerald-400 font-black text-base">{inr(netAmount)}</span>
                </div>
                {balance !== null && balance > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Remaining After</span>
                    <span className={`font-black ${(balance - netAmount) > 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {inr(Math.max(0, balance - netAmount))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Mode</span>
                  <span>{paymentMode}</span>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit" disabled={loading}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 text-sm uppercase tracking-wide"
              >
                {loading
                  ? <><Loader2 size={17} className="animate-spin" />Saving…</>
                  : <><Save size={17} strokeWidth={2.5} />Save Payment</>}
              </button>
              <Link
                href={`/clients/${clientId}/view`}
                className="px-6 py-3.5 bg-[#111520] border border-[#21293d] hover:border-slate-500 text-slate-400 hover:text-white rounded-2xl font-bold text-sm transition-all no-underline"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}