"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { pageAll } from "@/lib/fetch-all";
import {
  Loader2, Calendar, Printer, BarChart2, PieChart, TrendingUp,
  Package, Landmark, ShieldCheck, Info, ArrowLeft
} from "lucide-react";
import Link from "next/link";

const inr = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function FinancialReportContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  // IST Range (First to Last day of month by default)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const [from, setFrom] = useState(searchParams.get("from") || formatDate(firstDay));
  const [to,   setTo]   = useState(searchParams.get("to")   || formatDate(lastDay));
  const [loading, setLoading] = useState(true);
  
  const [data, setData] = useState({
    service_rev: 0,
    parts_rev: 0,
    direct_sales_rev: 0,
    expenses: 0,
    emi_paid: 0,
    advance_paid: 0,
    stock_added_val: 0,
    current_stock_val: 0,
    loan_pending: 0,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const start = `${from}T00:00:00+05:30`;
      const end   = `${to}T23:59:59+05:30`;

      // First get the transactions in range
      const { data: txRangeData } = await pageAll(supabase
        .from("transaction_list")
        .select("id")
        .eq("status", 5)
        .gte("date_completed", start)
        .lte("date_completed", end));
      const txRangeIds = (txRangeData || []).map(t => String(t.id));

      const [
        svcRes,
        partsRes,
        directRes,
        expenseRes,
        emiRes,
        advanceRes,
        stockAddRes
      ] = await Promise.all([
        // Service Revenue (status 5 delivered)
        txRangeIds.length > 0 
          ? pageAll(supabase.from("transaction_services").select("price").in("transaction_id", txRangeIds))
          : Promise.resolve({ data: [] }),
        // Parts Revenue (status 5 delivered)
        txRangeIds.length > 0 
          ? pageAll(supabase.from("transaction_products").select("qty, price").in("transaction_id", txRangeIds))
          : Promise.resolve({ data: [] }),
        // Direct Sales
        pageAll(supabase.from("direct_sales").select("total_amount").gte("date_created", start).lte("date_created", end)),
        // Expenses
        pageAll(supabase.from("expense_list").select("amount").gte("date_created", start).lte("date_created", end)),
        // Loan EMIs Paid
        pageAll(supabase.from("loan_payments").select("amount_paid").gte("payment_date", start).lte("payment_date", end)),
        // Advances Paid
        pageAll(supabase.from("advance_payments").select("amount").gte("date_paid", start).lte("date_paid", end)),
        // Stock Added Value (Selling Price)
        pageAll(supabase.from("inventory_list").select("product_id, quantity, stock_date").gte("stock_date", start).lte("stock_date", end)),
      ]);

      // Resolve stock added value via product price map (avoid embed FK dependency)
      const { data: priceList } = await supabase.from("product_list").select("id, price");
      const priceMap = new Map((priceList || []).map((p) => [p.id, p.price || 0]));
      const stock_added_val = (stockAddRes.data || []).reduce(
        (s: number, r) => s + ((r.quantity || 0) * (priceMap.get(r.product_id) || 0)), 0
      );

      // 2. Current Stock Value & Loan Pending (Overall, not range filtered)
      const [stockValRes, lendersRes, loanPaysRes] = await Promise.all([
        // Match PHP: all products (no delete_flag filter)
        supabase.from("product_list").select("id, price"),
        supabase.from("lender_list").select("id, emi_amount, tenure_months").eq("status", 1),
        supabase.from("loan_payments").select("lender_id, amount_paid")
      ]);

      // Match PHP current stock calc: (inventory - transaction_products - direct_sale_items) * price per product
      // PHP does NOT filter transaction_products by status here, so include cancelled txn qty too.
      const [{data: invAll}, {data: tpAll}, {data: dsAll}] = await Promise.all([
          supabase.from("inventory_list").select("product_id, quantity"),
          supabase.from("transaction_products").select("product_id, qty"),
          supabase.from("direct_sale_items").select("product_id, qty")
      ]);

      const invMap: Record<number, number> = {}; (invAll || []).forEach(r => invMap[r.product_id] = (invMap[r.product_id] || 0) + (r.quantity || 0));
      const soldMap: Record<number, number> = {}; 
      (tpAll || []).forEach(r => soldMap[r.product_id] = (soldMap[r.product_id] || 0) + (r.qty || 0));
      (dsAll || []).forEach(r => soldMap[r.product_id] = (soldMap[r.product_id] || 0) + (r.qty || 0));

      let currentStockVal = 0;
      (stockValRes.data || []).forEach(p => {
          const qty = (invMap[p.id] || 0) - (soldMap[p.id] || 0);
          currentStockVal += (qty * (p.price || 0));
      });

      // Calculate Debt
      let loanPending = 0;
      const paysByLender: Record<number, number> = {};
      (loanPaysRes.data || []).forEach(p => paysByLender[p.lender_id] = (paysByLender[p.lender_id] || 0) + (p.amount_paid || 0));
      (lendersRes.data || []).forEach(l => {
          const totalToPay = (l.emi_amount || 0) * (l.tenure_months || 0);
          const paid = paysByLender[l.id] || 0;
          loanPending += (totalToPay - paid);
      });

      setData({
        service_rev: (svcRes.data || []).reduce((s, r) => s + (r.price || 0), 0),
        parts_rev: (partsRes.data || []).reduce((s, r) => s + ((r.qty || 0) * (r.price || 0)), 0),
        direct_sales_rev: (directRes.data || []).reduce((s, r) => s + (r.total_amount || 0), 0),
        expenses: (expenseRes.data || []).reduce((s, r) => s + (r.amount || 0), 0),
        emi_paid: (emiRes.data || []).reduce((s, r) => s + (r.amount_paid || 0), 0),
        advance_paid: (advanceRes.data || []).reduce((s, r) => s + (r.amount || 0), 0),
        stock_added_val,
        current_stock_val: currentStockVal,
        loan_pending: loanPending,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalRevenue = data.service_rev + data.parts_rev + data.direct_sales_rev;
  const totalCashExpenses = data.expenses + data.emi_paid + data.advance_paid;
  const cashProfit = totalRevenue - totalCashExpenses;

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
      <div className="bg-[#161b27] border border-[#21293d] rounded-3xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 blur-[100px] rounded-full -mr-40 -mt-40 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
             <Link href="/reports" className="w-10 h-10 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-xl text-slate-500 hover:text-white transition-all">
                <ArrowLeft size={18} />
             </Link>
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <BarChart2 size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Workshop Financial Report</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black">Comprehensive Profit & Asset Analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => window.print()} className="px-5 py-2.5 bg-[#1e2637] border border-[#2a3550] hover:border-purple-500/40 text-slate-400 hover:text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2">
              <Printer size={16} /> Print Statement
            </button>
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 no-print shadow-xl">
        <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Analysis From</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-purple-500 transition-all [color-scheme:dark]" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Analysis To</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-purple-500 transition-all [color-scheme:dark]" />
            </div>
          </div>
          <button type="submit" className="px-8 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-black uppercase tracking-wider transition-all shadow-lg shadow-purple-600/20 active:scale-95">
            Update Analysis
          </button>
        </form>
      </div>

      {loading ? (
        <div className="py-32 text-center">
          <Loader2 size={40} className="animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.3em]">Crunching Numbers...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Profit Section */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
            
            {/* Cash Flow Details (Left 4 cols) */}
            <div className="lg:col-span-4 bg-[#161b27] border border-[#21293d] rounded-3xl overflow-hidden shadow-2xl">
              <div className="px-6 py-4 bg-gradient-to-r from-blue-600/20 to-transparent border-b border-[#21293d] flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp size={16} className="text-blue-400" /> Cash Flow (Aay - Vyay)
                </h3>
                <span className="text-[10px] font-bold text-slate-500">{new Date(from).toLocaleDateString()} - {new Date(to).toLocaleDateString()}</span>
              </div>
              
              <div className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#111520] text-[10px] font-black uppercase text-slate-600 tracking-widest">
                      <th className="px-6 py-3 text-left">Revenue Source</th>
                      <th className="px-6 py-3 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21293d]">
                    <tr className="hover:bg-white/[0.01] transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">Service Income</td>
                      <td className="px-6 py-4 text-right font-black text-slate-200">{inr(data.service_rev)}</td>
                    </tr>
                    <tr className="hover:bg-white/[0.01] transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">Parts Sold in Jobs</td>
                      <td className="px-6 py-4 text-right font-black text-slate-200">{inr(data.parts_rev)}</td>
                    </tr>
                    <tr className="hover:bg-white/[0.01] transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">Direct Sales Revenue</td>
                      <td className="px-6 py-4 text-right font-black text-slate-200">{inr(data.direct_sales_rev)}</td>
                    </tr>
                    <tr className="bg-emerald-500/5">
                      <td className="px-6 py-4 text-emerald-400 font-black uppercase text-xs">Total Revenue (A)</td>
                      <td className="px-6 py-4 text-right font-black text-emerald-400 text-lg">{inr(totalRevenue)}</td>
                    </tr>
                    
                    <tr className="hover:bg-white/[0.01] transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">Shop Operating Expenses</td>
                      <td className="px-6 py-4 text-right font-black text-red-400">-{inr(data.expenses)}</td>
                    </tr>
                    <tr className="hover:bg-white/[0.01] transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">Staff Advance / Salaries</td>
                      <td className="px-6 py-4 text-right font-black text-red-400">-{inr(data.advance_paid)}</td>
                    </tr>
                    <tr className="hover:bg-white/[0.01] transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">Loan EMI Repayments</td>
                      <td className="px-6 py-4 text-right font-black text-red-400">-{inr(data.emi_paid)}</td>
                    </tr>
                    <tr className="bg-red-500/5">
                      <td className="px-6 py-4 text-red-400 font-black uppercase text-xs">Total Expenses (B)</td>
                      <td className="px-6 py-4 text-right font-black text-red-400 text-lg">{inr(totalCashExpenses)}</td>
                    </tr>
                    
                    <tr className="bg-[#111520] border-t-2 border-purple-500/40">
                      <td className="px-6 py-6 text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
                         <Landmark size={18} className="text-purple-400" /> Net Cash Profit (A - B)
                      </td>
                      <td className="px-6 py-6 text-right font-black text-white text-2xl tracking-tighter">{inr(cashProfit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-amber-500/5 border-t border-[#21293d] flex items-center gap-2 text-[10px] text-amber-500/70 font-bold uppercase tracking-wider">
                 <Info size={14} /> * Note: Stock Purchase cost is not deducted here as Purchase Price is not available.
              </div>
            </div>

            {/* Assets & Stock (Right 3 cols) */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Stock Card */}
              <div className="bg-[#161b27] border border-[#21293d] rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-5">
                   <Package size={120} className="text-blue-500" />
                </div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                        <Package size={20} />
                      </div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Inventory Assets</h3>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Stock Added This Period</p>
                      <h4 className="text-xl font-black text-blue-400">{inr(data.stock_added_val)}</h4>
                      <p className="text-[9px] text-slate-600 mt-0.5 uppercase tracking-tighter">Value at Selling Price</p>
                    </div>
                    
                    <div className="h-px bg-white/5" />
                    
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Total Current Stock</p>
                      <h4 className="text-2xl font-black text-white">{inr(data.current_stock_val)}</h4>
                      <p className="text-[9px] text-slate-600 mt-0.5 uppercase tracking-tighter">Available Goods Valuation</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Liability Card */}
              <div className="bg-[#161b27] border border-[#21293d] rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-5">
                   <ShieldCheck size={120} className="text-red-500" />
                </div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400">
                        <ShieldCheck size={20} />
                      </div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Financial Liability</h3>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Pending Loans (Debt)</p>
                    <h4 className="text-2xl font-black text-red-500">{inr(data.loan_pending)}</h4>
                    <p className="text-[9px] text-slate-600 mt-0.5 uppercase tracking-tighter">Outstanding Amount to Lenders</p>
                  </div>
                </div>
              </div>

              {/* Status Summary */}
              <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-6 shadow-xl shadow-indigo-900/20 text-white">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-4 opacity-70">Business Health</h3>
                <div className="flex items-center justify-between gap-4">
                   <div className="flex-1">
                      <p className="text-2xl font-black">{inr(data.current_stock_val - data.loan_pending)}</p>
                      <p className="text-[10px] font-bold uppercase opacity-60">Net Asset (Stock - Debt)</p>
                   </div>
                   <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                      <PieChart size={24} />
                   </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FinancialReport() {
  return (
    <div className="min-h-screen bg-[#0d1117] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 size={32} className="animate-spin text-blue-500" /></div>}>
          <FinancialReportContent />
        </Suspense>
      </div>
    </div>
  );
}
