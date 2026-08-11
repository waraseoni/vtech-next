"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { pageAll } from "@/lib/fetch-all";
import {
  Loader2, Calendar, Printer, Store, TrendingUp, TrendingDown,
  Scale, PieChart, Info, AlertTriangle, CheckCircle2, ArrowLeft,
  DollarSign, Package, CreditCard, Users, Landmark
} from "lucide-react";
import Link from "next/link";

const inr = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type DbRow = ReturnType<typeof JSON.parse>;

function VyaparDarpanContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  // IST Date Range (Current Month)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const [from, setFrom] = useState(searchParams.get("from") || formatDate(firstDay));
  const [to,   setTo]   = useState(searchParams.get("to")   || formatDate(lastDay));
  const [loading, setLoading] = useState(true);

  const [data, setData] = useState({
    total_sales: 0,
    parts_sell_value: 0,
    shop_expenses: 0,
    emi_paid: 0,
    staff_salary: 0,
    discounts: 0,
    current_stock_val: 0,
    pending_loan: 0,
    fixed_assets: 50000, // Hardcoded as per legacy
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const start = `${from}T00:00:00+05:30`;
      const end   = `${to}T23:59:59+05:30`;

      // Pre-fetch parent IDs to avoid broken PostgREST !inner joins
      const [deliveredTxRes, dsRangeRes] = await Promise.all([
        pageAll(supabase.from("transaction_list").select("id").eq("status", 5).gte("date_completed", start).lte("date_completed", end)),
        pageAll(supabase.from("direct_sales").select("id").gte("date_created", start).lte("date_created", end)),
      ]);
      const deliveredTxIds = (deliveredTxRes.data || []).map(t => String(t.id));
      const dsRangeIds     = (dsRangeRes.data || []).map(d => String(d.id));

      const [
        repairRes, directRes,
        repPartsRes, dsPartsRes,
        expenseRes, emiRes,
        salaryRes, discountRes,
        stockRes, lendersRes, loanPaysRes
      ] = await Promise.all([
        // 1. Repair Income
        pageAll(supabase.from("transaction_list").select("amount").eq("status", 5).gte("date_completed", start).lte("date_completed", end)),
        // 2. Direct Sales
        pageAll(supabase.from("direct_sales").select("total_amount").gte("date_created", start).lte("date_created", end)),
        // 3. Repair Parts Value (use pre-fetched IDs)
        deliveredTxIds.length > 0
          ? pageAll(supabase.from("transaction_products").select("qty, price").in("transaction_id", deliveredTxIds))
          : Promise.resolve({ data: [] }),
        // 4. Direct Sale Items Value (use pre-fetched IDs)
        dsRangeIds.length > 0
          ? pageAll(supabase.from("direct_sale_items").select("qty, price").in("sale_id", dsRangeIds))
          : Promise.resolve({ data: [] }),
        // 5. Shop Expenses
        pageAll(supabase.from("expense_list").select("amount").gte("date_created", start).lte("date_created", end)),
        // 6. EMI Paid
        pageAll(supabase.from("loan_payments").select("amount_paid").gte("payment_date", start).lte("payment_date", end)),
        // 7. Staff Salary (Attendance Based)
        pageAll(supabase.from("attendance_list").select("status, mechanic_list(daily_salary)").gte("curr_date", from).lte("curr_date", to)),
        // 8. Discounts
        pageAll(supabase.from("client_payments").select("discount").gte("payment_date", start).lte("payment_date", end)),
        // 9. Current Stock (Simplified)
        pageAll(supabase.from("product_list").select("id, price").eq("delete_flag", 0)),
        // 10. Loans
        pageAll(supabase.from("lender_list").select("id, loan_amount").eq("status", 1)),
        pageAll(supabase.from("loan_payments").select("lender_id, amount_paid"))
      ]);

      // Process Stock (simplified fetch since full tracking is expensive)
      const {data: invAll} = await pageAll(supabase.from("inventory_list").select("product_id, quantity"));
      const {data: soldAll} = await pageAll(supabase.from("transaction_products").select("product_id, qty"));
      const {data: dsAll} = await pageAll(supabase.from("direct_sale_items").select("product_id, qty"));
      
      const invMap: Record<number, number> = {}; (invAll || []).forEach(r => invMap[r.product_id] = (invMap[r.product_id] || 0) + (r.quantity || 0));
      const soldMap: Record<number, number> = {}; 
      (soldAll || []).forEach(r => soldMap[r.product_id] = (soldMap[r.product_id] || 0) + (r.qty || 0));
      (dsAll || []).forEach(r => soldMap[r.product_id] = (soldMap[r.product_id] || 0) + (r.qty || 0));
      
      let currentStockVal = 0;
      (stockRes.data || []).forEach(p => {
          const qty = (invMap[p.id] || 0) - (soldMap[p.id] || 0);
          if (qty > 0) currentStockVal += (qty * (p.price || 0));
      });

      // Calculate Debt
      let loanPending = 0;
      const paysByLender: Record<number, number> = {};
      (loanPaysRes.data || []).forEach(p => paysByLender[p.lender_id] = (paysByLender[p.lender_id] || 0) + (p.amount_paid || 0));
      (lendersRes.data || []).forEach(l => {
          loanPending += ((l.loan_amount || 0) - (paysByLender[l.id] || 0));
      });

      // Calculate Salary
      let salaryTotal = 0;
      (salaryRes.data || []).forEach((a: DbRow) => {
          const daily = a.mechanic_list?.daily_salary || 0;
          if (a.status === 1) salaryTotal += daily;
          else if (a.status === 3) salaryTotal += (daily / 2);
      });

      setData({
        total_sales: ((repairRes.data || []).reduce((s, r) => s + (r.amount || 0), 0)) + ((directRes.data || []).reduce((s, r) => s + (r.total_amount || 0), 0)),
        parts_sell_value: ((repPartsRes.data || []).reduce((s, r) => s + ((r.qty || 0) * (r.price || 0)), 0)) + ((dsPartsRes.data || []).reduce((s, r) => s + ((r.qty || 0) * (r.price || 0)), 0)),
        shop_expenses: (expenseRes.data || []).reduce((s, r) => s + (r.amount || 0), 0),
        emi_paid: (emiRes.data || []).reduce((s, r) => s + (r.amount_paid || 0), 0),
        staff_salary: salaryTotal,
        discounts: (discountRes.data || []).reduce((s, r) => s + (r.discount || 0), 0),
        current_stock_val: currentStockVal,
        pending_loan: loanPending,
        fixed_assets: 50000,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const estimatedPartsCost = data.parts_sell_value * 0.90;
  const grossProfit = data.total_sales - estimatedPartsCost;
  const totalIndirectExpenses = data.shop_expenses + data.emi_paid + data.staff_salary + data.discounts;
  const netProfit = grossProfit - totalIndirectExpenses;
  
  const totalAssets = data.current_stock_val + (netProfit > 0 ? netProfit : 0) + data.fixed_assets;
  const totalLiabilities = data.pending_loan + data.staff_salary + data.shop_expenses;
  const netWorth = totalAssets - totalLiabilities;

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(searchParams.toString());
    p.set("from", from);
    p.set("to", to);
    router.replace("?" + p.toString(), { scroll: false });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full -mr-40 -mt-40 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
             <Link href="/reports" className="w-12 h-12 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-2xl text-slate-500 hover:text-white hover:bg-blue-600/10 hover:border-blue-500/40 transition-all group">
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
             </Link>
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-800 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-500/20 ring-4 ring-indigo-500/10">
              <Store size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Vyapar Darpan</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.3em]">Business Mirror & Performance Analysis</p>
            </div>
          </div>
          <button onClick={() => window.print()} className="px-6 py-3 bg-[#1e2637] border border-[#2a3550] hover:border-indigo-500/40 text-slate-400 hover:text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all flex items-center gap-3 shadow-lg">
            <Printer size={18} /> Print Analysis
          </button>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] p-5 no-print shadow-2xl flex flex-wrap items-end gap-6">
        <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-6 w-full">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] ml-2">Darpan Start</label>
            <div className="relative group">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={16} />
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="pl-12 pr-6 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-sm text-slate-200 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all [color-scheme:dark]" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] ml-2">Darpan End</label>
            <div className="relative group">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={16} />
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="pl-12 pr-6 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-sm text-slate-200 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all [color-scheme:dark]" />
            </div>
          </div>
          <button type="submit" className="px-10 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/20 active:scale-95">
            Refresh Analysis
          </button>
        </form>
      </div>

      {loading ? (
        <div className="py-32 text-center">
          <Loader2 size={48} className="animate-spin text-indigo-500 mx-auto mb-6" />
          <p className="text-slate-600 text-xs font-black uppercase tracking-[0.4em]">Polishing the Mirror...</p>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
          
          {/* Top High Level Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Kul Bikri", val: data.total_sales, sub: "Total Sales", icon: <TrendingUp className="text-blue-400" />, color: "blue" },
              { label: "Sakal Laabh", val: grossProfit, sub: "Gross Profit", icon: <DollarSign className="text-emerald-400" />, color: "emerald" },
              { label: "Shuddh Laabh", val: netProfit, sub: "Net Profit", icon: <PieChart className="text-indigo-400" />, color: "indigo" },
              { label: "Stock Value", val: data.current_stock_val, sub: "Inventory Asset", icon: <Package className="text-amber-400" />, color: "amber" },
            ].map((m, i) => (
              <div key={i} className="bg-[#161b27] border border-[#21293d] rounded-3xl p-5 shadow-xl group hover:border-indigo-500/30 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-xl bg-${m.color}-500/10 border border-${m.color}-500/20`}>{m.icon}</div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{m.label}</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">{m.sub}</p>
                  </div>
                </div>
                <h3 className="text-xl font-black text-white">{inr(m.val)}</h3>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Profit Analysis (Left 8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Gross Profit Detail */}
              <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] overflow-hidden shadow-2xl">
                <div className="px-8 py-5 border-b border-[#21293d] bg-gradient-to-r from-blue-600/10 to-transparent flex items-center justify-between">
                   <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                      <TrendingUp size={18} className="text-blue-400" /> Vyaparik Labh (Gross Profit)
                   </h3>
                </div>
                <div className="p-8 space-y-6">
                   <div className="flex justify-between items-end border-b border-white/5 pb-4">
                      <div>
                        <p className="text-xs font-bold text-slate-400">Total Income (Repair + Direct)</p>
                        <p className="text-2xl font-black text-white mt-1">{inr(data.total_sales)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Est. Parts Cost (90%)</p>
                        <p className="text-lg font-black text-red-500/80 mt-1">-{inr(estimatedPartsCost)}</p>
                      </div>
                   </div>
                   <div className="flex items-center justify-between bg-blue-500/5 p-6 rounded-2xl border border-blue-500/10 shadow-inner">
                      <h4 className="text-sm font-black text-blue-300 uppercase tracking-widest">Gross Operating Profit</h4>
                      <h4 className="text-3xl font-black text-blue-400 tracking-tighter">{inr(grossProfit)}</h4>
                   </div>
                </div>
              </div>

              {/* Indirect Expenses Detail */}
              <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] overflow-hidden shadow-2xl">
                <div className="px-8 py-5 border-b border-[#21293d] bg-gradient-to-r from-red-600/10 to-transparent flex items-center justify-between">
                   <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                      <TrendingDown size={18} className="text-red-400" /> Anya Kharche (Indirect Expenses)
                   </h3>
                </div>
                <div className="p-0">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-[#21293d]">
                      <tr className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-8 py-4 text-slate-400 flex items-center gap-3"><Users size={14} className="text-slate-600" /> Staff Salary (Attendance Based)</td>
                        <td className="px-8 py-4 text-right font-black text-red-400">-{inr(data.staff_salary)}</td>
                      </tr>
                      <tr className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-8 py-4 text-slate-400 flex items-center gap-3"><CreditCard size={14} className="text-slate-600" /> Shop Expenses & Utility Bills</td>
                        <td className="px-8 py-4 text-right font-black text-red-400">-{inr(data.shop_expenses)}</td>
                      </tr>
                      <tr className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-8 py-4 text-slate-400 flex items-center gap-3"><Landmark size={14} className="text-slate-600" /> Loan EMI Payments</td>
                        <td className="px-8 py-4 text-right font-black text-red-400">-{inr(data.emi_paid)}</td>
                      </tr>
                      <tr className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-8 py-4 text-slate-400 flex items-center gap-3"><TrendingDown size={14} className="text-slate-600" /> Client Discounts Given</td>
                        <td className="px-8 py-4 text-right font-black text-red-400">-{inr(data.discounts)}</td>
                      </tr>
                      <tr className="bg-red-500/5">
                        <td className="px-8 py-5 text-red-400 font-black uppercase text-xs tracking-widest">Total Indirect Expenses</td>
                        <td className="px-8 py-5 text-right font-black text-red-400 text-xl">{inr(totalIndirectExpenses)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sidebar Stats (Right 4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Final Chittha Card */}
              <div className={`rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl ${
                netProfit >= 0 ? "bg-gradient-to-br from-emerald-600 to-teal-800" : "bg-gradient-to-br from-red-600 to-rose-800"
              }`}>
                <div className="absolute top-0 right-0 p-8 opacity-10">
                   {netProfit >= 0 ? <CheckCircle2 size={120} /> : <AlertTriangle size={120} />}
                </div>
                <div className="relative text-center">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-80 mb-6">Final Chittha</h3>
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Savings for this period</p>
                  <h2 className="text-5xl font-black tracking-tighter mb-8">{inr(netProfit)}</h2>
                  <div className="h-px bg-white/10 mb-6" />
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs font-bold">
                       <span className="opacity-60 uppercase">Gross Profit</span>
                       <span>{inr(grossProfit)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold">
                       <span className="opacity-60 uppercase">All Expenses</span>
                       <span>{inr(totalIndirectExpenses)}</span>
                    </div>
                  </div>
                  <div className="mt-8 py-4 px-6 bg-black/10 rounded-3xl text-[11px] font-bold border border-white/10 leading-relaxed">
                     {netProfit >= 0 
                       ? "Aapka vyapar sahi disha mein hai. Assets deindari se zyada hain." 
                       : "Savdhan! Kharchon par niyantran ki zaroorat hai. Net profit negative hai."
                     }
                  </div>
                </div>
              </div>

              {/* Net Worth (Simplified Balance Sheet) */}
              <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] p-8 shadow-2xl space-y-6">
                <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                   <Scale size={18} className="text-indigo-400" /> Vyaparik Balance Sheet
                </h3>
                <div className="space-y-4">
                   <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                      <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest mb-1">Total Assets (Sampatti)</p>
                      <h4 className="text-xl font-black text-white">{inr(totalAssets)}</h4>
                      <p className="text-[8px] text-slate-600 mt-0.5 uppercase">Stock + Savings + Tools</p>
                   </div>
                   <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
                      <p className="text-[10px] font-black text-red-500/60 uppercase tracking-widest mb-1">Total Liabilities (Dindari)</p>
                      <h4 className="text-xl font-black text-white">{inr(totalLiabilities)}</h4>
                      <p className="text-[8px] text-slate-600 mt-0.5 uppercase">Loans + Salaries + Bills</p>
                   </div>
                </div>
                <div className="pt-4 border-t border-white/5 text-center">
                   <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Asli Value (Net Worth)</p>
                   <h3 className={`text-4xl font-black tracking-tighter ${netWorth >= 0 ? "text-white" : "text-red-500"}`}>
                      {inr(netWorth)}
                   </h3>
                </div>
              </div>

            </div>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-3xl p-6 flex items-start gap-4 text-blue-400/80 text-xs font-bold leading-relaxed shadow-xl">
            <Info size={24} className="flex-shrink-0" />
            <div className="space-y-2">
              <p className="uppercase tracking-widest text-[10px] font-black">Darpan Methodology Note:</p>
              <p>
                Vyapar Darpan uses the 90% Cost Assumption for parts valuation to estimate gross margins when exact purchase costs are unavailable. 
                Net Worth is calculated by summing Inventory Value, Period Savings, and Fixed Tool Assets (₹50,000), minus Outstanding Loans, 
                current month salaries, and pending expenses.
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export default function VyaparDarpan() {
  return (
    <div className="min-h-screen bg-[#0d1117] p-4 md:p-12">
      <Suspense fallback={<div className="flex items-center justify-center py-48"><Loader2 size={48} className="animate-spin text-indigo-500" /></div>}>
        <VyaparDarpanContent />
      </Suspense>
    </div>
  );
}
