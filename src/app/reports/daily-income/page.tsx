"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Loader2, Calendar, Printer, TrendingUp, TrendingDown, Wallet,
  ArrowUpCircle, ArrowDownCircle, Info, ChevronLeft, ArrowLeft
} from "lucide-react";
import Link from "next/link";

const inr = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function DailyIncomeContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  // IST Today
  const todayIST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  
  const [from, setFrom] = useState(searchParams.get("from") || todayIST);
  const [to,   setTo]   = useState(searchParams.get("to")   || todayIST);
  const [loading, setLoading] = useState(true);
  
  const [data, setData] = useState({
    repair_income: 0,
    direct_income: 0,
    loan_received: 0,
    client_payments: 0,
    expenses: 0,
    salary_paid: 0,
    loan_paid_to_lenders: 0,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const start = `${from}T00:00:00+05:30`;
      const end   = `${to}T23:59:59+05:30`;

      const [
        repairRes,
        directRes,
        loanRecRes,
        clientPayRes,
        expenseRes,
        salaryRes,
        loanPaidRes
      ] = await Promise.all([
        // 1. Repair Income (Delivered)
        supabase.from("transaction_list").select("amount").eq("status", 5).gte("date_completed", start).lte("date_completed", end),
        // 2. Direct Sales
        supabase.from("direct_sales").select("total_amount").gte("date_created", start).lte("date_created", end),
        // 3. Loan EMIs Received
        supabase.from("client_payments").select("amount").not("loan_id", "is", null).gte("payment_date", start).lte("payment_date", end),
        // 4. Client Direct Payments
        supabase.from("client_payments").select("amount").is("loan_id", null).gte("payment_date", start).lte("payment_date", end),
        // 5. Shop Expenses
        supabase.from("expense_list").select("amount").gte("date_created", start).lte("date_created", end),
        // 6. Salaries/Advances Paid
        supabase.from("advance_payments").select("amount").gte("date_paid", start).lte("date_paid", end),
        // 7. Loan Paid to Lenders
        supabase.from("loan_payments").select("amount_paid").gte("payment_date", start).lte("payment_date", end),
      ]);

      setData({
        repair_income: (repairRes.data || []).reduce((s, r) => s + (r.amount || 0), 0),
        direct_income: (directRes.data || []).reduce((s, r) => s + (r.total_amount || 0), 0),
        loan_received: (loanRecRes.data || []).reduce((s, r) => s + (r.amount || 0), 0),
        client_payments: (clientPayRes.data || []).reduce((s, r) => s + (r.amount || 0), 0),
        expenses: (expenseRes.data || []).reduce((s, r) => s + (r.amount || 0), 0),
        salary_paid: (salaryRes.data || []).reduce((s, r) => s + (r.amount || 0), 0),
        loan_paid_to_lenders: (loanPaidRes.data || []).reduce((s, r) => s + (r.amount_paid || 0), 0),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalInflow = data.repair_income + data.direct_income + data.loan_received + data.client_payments;
  const totalOutflow = data.expenses + data.salary_paid + data.loan_paid_to_lenders;
  const netCash = totalInflow - totalOutflow;

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(searchParams.toString());
    p.set("from", from);
    p.set("to", to);
    router.replace("?" + p.toString(), { scroll: false });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
             <Link href="/reports" className="w-10 h-10 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-xl text-slate-500 hover:text-white transition-all">
                <ArrowLeft size={18} />
             </Link>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <TrendingUp size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Daily Income & Cash Flow</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Track Inflow vs Outflow</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="px-4 py-2 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2">
              <Printer size={14} /> Print Report
            </button>
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 no-print shadow-lg">
        <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">From Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="pl-9 pr-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500 transition-all [color-scheme:dark]" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">To Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="pl-9 pr-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500 transition-all [color-scheme:dark]" />
            </div>
          </div>
          <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20">
            Filter Results
          </button>
          <button type="button" onClick={() => { setFrom(todayIST); setTo(todayIST); router.replace("/reports/daily-income"); }}
            className="px-4 py-2 bg-[#1e2637] text-slate-400 hover:text-white rounded-xl text-sm font-bold transition-all">
            Reset
          </button>
        </form>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <Loader2 size={32} className="animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em]">Calculating Balance...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#161b27] border border-emerald-500/20 rounded-3xl p-6 relative overflow-hidden group shadow-xl">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <ArrowDownCircle size={80} className="text-emerald-500" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <ArrowDownCircle size={18} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">Total Inflow</span>
                </div>
                <h2 className="text-3xl font-black text-white">{inr(totalInflow)}</h2>
                <p className="text-xs text-slate-500 mt-1">Income & Payments Received</p>
              </div>
            </div>

            <div className="bg-[#161b27] border border-red-500/20 rounded-3xl p-6 relative overflow-hidden group shadow-xl">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <ArrowUpCircle size={80} className="text-red-500" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
                    <ArrowUpCircle size={18} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-500/80">Total Outflow</span>
                </div>
                <h2 className="text-3xl font-black text-white">{inr(totalOutflow)}</h2>
                <p className="text-xs text-slate-500 mt-1">Expenses & Salaries Paid</p>
              </div>
            </div>

            <div className={`bg-[#161b27] border rounded-3xl p-6 relative overflow-hidden group shadow-xl ${
              netCash >= 0 ? "border-blue-500/20" : "border-amber-500/20"
            }`}>
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Wallet size={80} className={netCash >= 0 ? "text-blue-500" : "text-amber-500"} />
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    netCash >= 0 ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-amber-400"
                  }`}>
                    <Wallet size={18} />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    netCash >= 0 ? "text-blue-500/80" : "text-amber-500/80"
                  }`}>Net Cash Flow</span>
                </div>
                <h2 className="text-3xl font-black text-white">{inr(netCash)}</h2>
                <p className="text-xs text-slate-500 mt-1">{netCash >= 0 ? "Savings / Profit" : "Cash Shortage"}</p>
              </div>
            </div>
          </div>

          {/* Detailed Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Inflow Details */}
            <div className="bg-[#161b27] border border-[#21293d] rounded-3xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-[#21293d] bg-[#111520]/50 flex items-center gap-3">
                <ArrowDownCircle size={18} className="text-emerald-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Cash Inflow Details</h3>
              </div>
              <div className="p-0">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-[#21293d]">
                    <tr className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">Repair Jobs (Delivered)</td>
                      <td className="px-6 py-4 text-right font-black text-white">{inr(data.repair_income)}</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">Direct Sales Income</td>
                      <td className="px-6 py-4 text-right font-black text-white">{inr(data.direct_income)}</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">Loan EMIs (Received)</td>
                      <td className="px-6 py-4 text-right font-black text-white">{inr(data.loan_received)}</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">Client Direct Payments</td>
                      <td className="px-6 py-4 text-right font-black text-white">{inr(data.client_payments)}</td>
                    </tr>
                    <tr className="bg-emerald-500/5 border-t-2 border-emerald-500/20">
                      <td className="px-6 py-4 text-emerald-400 font-black uppercase text-xs">Total Inflow</td>
                      <td className="px-6 py-4 text-right font-black text-emerald-400 text-lg">{inr(totalInflow)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Outflow Details */}
            <div className="bg-[#161b27] border border-[#21293d] rounded-3xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-[#21293d] bg-[#111520]/50 flex items-center gap-3">
                <ArrowUpCircle size={18} className="text-red-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Cash Outflow Details</h3>
              </div>
              <div className="p-0">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-[#21293d]">
                    <tr className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">Shop Expenses (General)</td>
                      <td className="px-6 py-4 text-right font-black text-white">{inr(data.expenses)}</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">Staff Salaries & Advances</td>
                      <td className="px-6 py-4 text-right font-black text-white">{inr(data.salary_paid)}</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">Lender Loan Repayments</td>
                      <td className="px-6 py-4 text-right font-black text-white">{inr(data.loan_paid_to_lenders)}</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-slate-400 italic text-xs">Other potential outflows...</td>
                      <td className="px-6 py-4 text-right font-black text-white">₹ 0.00</td>
                    </tr>
                    <tr className="bg-red-500/5 border-t-2 border-red-500/20">
                      <td className="px-6 py-4 text-red-400 font-black uppercase text-xs">Total Outflow</td>
                      <td className="px-6 py-4 text-right font-black text-red-400 text-lg">{inr(totalOutflow)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Info Alert */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-3 text-blue-400/80 text-xs font-bold leading-relaxed shadow-lg">
            <Info size={20} className="flex-shrink-0" />
            <p>
              Note: This report tracks actual cash flow within the selected period based on payment dates and delivery dates. 
              Repair jobs income is recognized only when the job status is set to &apos;Delivered&apos;.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DailyIncomeReport() {
  return (
    <div className="min-h-screen bg-[#0d1117] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 size={32} className="animate-spin text-blue-500" /></div>}>
          <DailyIncomeContent />
        </Suspense>
      </div>
    </div>
  );
}
