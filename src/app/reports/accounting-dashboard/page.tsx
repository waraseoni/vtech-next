"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Calculator, Printer, Loader2, RefreshCw, TrendingUp, Wallet,
  PiggyBank, TrendingDown, ArrowDownCircle, ArrowUpCircle, Scale, Package,
} from "lucide-react";
import Link from "next/link";
import { todayIST, startOfMonthIST } from "@/lib/dateUtils";
import { pageAll } from "@/lib/fetch-all";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const num = (v: unknown) => Number(v) || 0;

type Tab = "summary" | "performance" | "cash" | "assets" | "inventory";

function AccountingDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [from, setFrom] = useState(searchParams.get("from") || startOfMonthIST());
  const [to, setTo] = useState(searchParams.get("to") || todayIST());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("summary");

  const [data, setData] = useState({
    serviceRevenue: 0, salesRevenue: 0, walkinSales: 0, totalRevenue: 0,
    grossProfit: 0, netProfit: 0, commission: 0, salaryEarned: 0,
    shopExpenses: 0, staffAdvances: 0, loanEmis: 0, totalExpenses: 0,
    collections: 0, discounts: 0, cashInflow: 0, cashOutflow: 0,
    expenseCategories: [] as { category: string; total: number }[],
    topCustomers: [] as { name: string; total: number }[],
    cashOnHand: 0, accountsReceivable: 0, inventoryValue: 0, loansPayable: 0,
    stockItems: [] as { name: string; qty: number; price: number; value: number }[],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const sTs = `${from}T00:00:00+05:30`;
      const eTs = `${to}T23:59:59+05:30`;

      const [
        { data: serviceRev },
        { data: directSales },
        { data: commissions },
        { data: attendance },
        { data: mechanics },
        { data: salaryHist },
        { data: collectionRows },
        { data: expenseAll },
        { data: advances },
        { data: loanEmi },
        { data: jobCust },
        { data: clients },
      ] = await Promise.all([
        pageAll(supabase.from("transaction_list").select("amount").eq("status", 5).gte("date_completed", sTs).lte("date_completed", eTs)),
        pageAll(supabase.from("direct_sales").select("total_amount, client_id").gte("date_created", sTs).lte("date_created", eTs)),
        pageAll(supabase.from("transaction_list").select("mechanic_commission_amount").eq("status", 5).gte("date_completed", sTs).lte("date_completed", eTs)),
        pageAll(supabase.from("attendance_list").select("mechanic_id, curr_date, status").gte("curr_date", from).lte("curr_date", to).in("status", [1, 3])),
        supabase.from("mechanic_list").select("id, daily_salary"),
        supabase.from("mechanic_salary_history").select("mechanic_id, salary, effective_date"),
        pageAll(supabase.from("client_payments").select("amount, discount").gte("payment_date", sTs).lte("payment_date", eTs)),
        pageAll(supabase.from("expense_list").select("amount, category").gte("date_created", sTs).lte("date_created", eTs)),
        pageAll(supabase.from("advance_payments").select("amount").gte("date_paid", sTs).lte("date_paid", eTs)),
        pageAll(supabase.from("loan_payments").select("amount_paid").gte("payment_date", sTs).lte("payment_date", eTs)),
        pageAll(supabase.from("transaction_list").select("client_name, amount").eq("status", 5).gte("date_completed", sTs).lte("date_completed", eTs)),
        supabase.from("client_list").select("id, firstname, lastname"),
      ]);

      const serviceRevenue = (serviceRev || []).reduce((s: number, r) => s + num(r.amount), 0);
      const salesRevenue = (directSales || []).reduce((s: number, r) => s + num(r.total_amount), 0);
      const walkinSales = (directSales || []).filter((r) => r.client_id === null || r.client_id === 0 || r.client_id === "").reduce((s: number, r) => s + num(r.total_amount), 0);
      const totalRevenue = serviceRevenue + salesRevenue;
      const commission = (commissions || []).reduce((s: number, r) => s + num(r.mechanic_commission_amount), 0);

      // Salary earned — attendance-based with salary history override
      const mechRate = new Map<number, number>();
      (mechanics || []).forEach((m) => mechRate.set(m.id, num(m.daily_salary)));
      const histMap = new Map<number, { salary: number; effective_date: string }[]>();
      (salaryHist || []).forEach((h) => {
        const arr = histMap.get(h.mechanic_id) || [];
        arr.push({ salary: num(h.salary), effective_date: h.effective_date || "" });
        histMap.set(h.mechanic_id, arr);
      });
      histMap.forEach(arr => arr.sort((a, b) => (b.effective_date || "").localeCompare(a.effective_date || "")));
      let salaryEarned = 0;
      (attendance || []).forEach((a) => {
        const hist = histMap.get(a.mechanic_id) || [];
        const rate = hist.find(h => !h.effective_date || h.effective_date <= a.curr_date)?.salary ?? mechRate.get(a.mechanic_id) ?? 0;
        salaryEarned += a.status === 3 ? rate / 2 : rate;
      });

      const collections = (collectionRows || []).reduce((s: number, r) => s + num(r.amount), 0);
      const discounts = (collectionRows || []).reduce((s: number, r) => s + num(r.discount), 0);
      const shopExpenses = (expenseAll || []).reduce((s: number, r) => s + num(r.amount), 0);
      const staffAdvances = (advances || []).reduce((s: number, r) => s + num(r.amount), 0);
      const loanEmis = (loanEmi || []).reduce((s: number, r) => s + num(r.amount_paid), 0);

      const totalBusinessExpense = salaryEarned + commission + shopExpenses + loanEmis + discounts;
      const grossProfit = totalRevenue - commission;
      const netProfit = totalRevenue - totalBusinessExpense;
      const cashInflow = collections + walkinSales;
      const cashOutflow = staffAdvances + shopExpenses + loanEmis;

      // Expense breakdown by category
      const catMap = new Map<string, number>();
      (expenseAll || []).forEach((r) => catMap.set(r.category || "Other", (catMap.get(r.category || "Other") || 0) + num(r.amount)));
      const expenseCategories = [...catMap.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);

      // Top 5 customers
      const custMap = new Map<string, number>();
      const clientName = new Map<number, string>();
      (clients || []).forEach((c) => clientName.set(c.id, [c.firstname, c.lastname].filter(Boolean).join(" ").trim()));
      (jobCust || []).forEach((r) => {
        const id = String(r.client_name);
        custMap.set(id, (custMap.get(id) || 0) + num(r.amount));
      });
      const topCustomers = [...custMap.entries()]
        .map(([id, total]) => ({ name: clientName.get(Number(id)) || "Walk-in", total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Assets & Liabilities as of end date
      const [
        { data: payAll }, { data: walkinAll }, { data: expAll2 }, { data: advAll2 }, { data: loanPayAll },
        { data: invAll }, { data: prodAll },
        { data: openBal }, { data: jobAll }, { data: dsAll }, { data: loans }, { data: payAll2 },
        { data: lenders }, { data: allLoanPays }, { data: invAllStock },
      ] = await Promise.all([
        pageAll(supabase.from("client_payments").select("amount").lte("payment_date", eTs)),
        pageAll(supabase.from("direct_sales").select("total_amount").lte("date_created", eTs).is("client_id", null)),
        pageAll(supabase.from("expense_list").select("amount").lte("date_created", eTs)),
        pageAll(supabase.from("advance_payments").select("amount").lte("date_paid", eTs)),
        pageAll(supabase.from("loan_payments").select("amount_paid").lte("payment_date", eTs)),
        pageAll(supabase.from("inventory_list").select("quantity, product_id").lte("stock_date", eTs)),
        supabase.from("product_list").select("id, price, name"),
        supabase.from("client_list").select("opening_balance").eq("delete_flag", 0),
        pageAll(supabase.from("transaction_list").select("amount").eq("status", 5).lte("date_completed", eTs)),
        pageAll(supabase.from("direct_sales").select("total_amount").lte("date_created", eTs)),
        pageAll(supabase.from("client_loans").select("total_payable").eq("status", 1).lte("loan_date", eTs)),
        pageAll(supabase.from("client_payments").select("amount, discount").lte("payment_date", eTs)),
        supabase.from("lender_list").select("loan_amount").eq("status", 1),
        pageAll(supabase.from("loan_payments").select("amount_paid")),
        supabase.from("inventory_list").select("quantity, product_id"),
      ]);

      // Walk-in direct sales (client_id null OR 0 OR '') — fetch only null ones above, combine with 0/''
      const walkinAll2 = await pageAll(supabase.from("direct_sales").select("total_amount").lte("date_created", eTs).or("client_id.eq.0,client_id.eq.''"));

      const cashOnHand =
        (payAll || []).reduce((s: number, r) => s + num(r.amount), 0)
        + (walkinAll || []).reduce((s: number, r) => s + num(r.total_amount), 0)
        + (walkinAll2.data || []).reduce((s: number, r) => s + num(r.total_amount), 0)
        - (expAll2 || []).reduce((s: number, r) => s + num(r.amount), 0)
        - (advAll2 || []).reduce((s: number, r) => s + num(r.amount), 0)
        - (loanPayAll || []).reduce((s: number, r) => s + num(r.amount_paid), 0);

      const prodPrice = new Map<number, number>();
      (prodAll || []).forEach((p) => prodPrice.set(p.id, num(p.price)));
      const inventoryValue = (invAll || []).reduce((s: number, r) => s + num(r.quantity) * (prodPrice.get(r.product_id) || 0), 0);

      const accountsReceivable =
        (openBal || []).reduce((s: number, r) => s + num(r.opening_balance), 0)
        + (jobAll || []).reduce((s: number, r) => s + num(r.amount), 0)
        + (dsAll || []).reduce((s: number, r) => s + num(r.total_amount), 0)
        + (loans || []).reduce((s: number, r) => s + num(r.total_payable), 0)
        - (payAll2 || []).reduce((s: number, r) => s + num(r.amount) + num(r.discount), 0);

      const loansPayable =
        (lenders || []).reduce((s: number, r) => s + num(r.loan_amount), 0)
        - (allLoanPays || []).reduce((s: number, r) => s + num(r.amount_paid), 0);

      // Inventory health — top 5 stock items
      const prodName = new Map<number, string>();
      (prodAll || []).forEach((p) => prodName.set(p.id, p.name || "Unknown"));
      const stockMap = new Map<number, number>();
      (invAllStock || []).forEach((r) => stockMap.set(r.product_id, (stockMap.get(r.product_id) || 0) + num(r.quantity)));
      const stockItems = [...stockMap.entries()]
        .filter(([, qty]) => qty > 0)
        .map(([pid, qty]) => ({ name: prodName.get(pid) || "Unknown", qty, price: prodPrice.get(pid) || 0, value: qty * (prodPrice.get(pid) || 0) }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      setData({
        serviceRevenue, salesRevenue, walkinSales, totalRevenue,
        grossProfit, netProfit, commission, salaryEarned,
        shopExpenses, staffAdvances, loanEmis,
        totalExpenses: totalBusinessExpense,
        collections, discounts, cashInflow, cashOutflow,
        expenseCategories, topCustomers,
        cashOnHand, accountsReceivable, inventoryValue, loansPayable,
        stockItems,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(searchParams.toString());
    if (from) p.set("from", from); else p.delete("from");
    if (to) p.set("to", to); else p.delete("to");
    router.replace("?" + p.toString(), { scroll: false });
  };

  const margin = data.totalRevenue > 0 ? (data.netProfit / data.totalRevenue) * 100 : 0;
  const collectionRate = data.totalRevenue > 0 ? (data.collections / data.totalRevenue) * 100 : 0;
  const totalAssets = data.cashOnHand + data.accountsReceivable + data.inventoryValue;

  const TABS: { key: Tab; label: string }[] = [
    { key: "summary", label: "Executive Summary" },
    { key: "performance", label: "Performance Analytics" },
    { key: "cash", label: "Cash Flow" },
    { key: "assets", label: "Assets & Liabilities" },
    { key: "inventory", label: "Inventory Health" },
  ];

  const pctBar = (v: number) => <div className="h-2 bg-[#0d1117] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" style={{ width: `${Math.min(100, Math.max(0, v))}%` }} /></div>;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] p-6 shadow-2xl relative overflow-hidden no-print">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div className="flex items-center gap-5">
            <Link href="/reports" className="w-12 h-12 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-2xl text-slate-500 hover:text-white hover:bg-purple-600/10 hover:border-purple-500/40 transition-all group">
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-800 rounded-3xl flex items-center justify-center shadow-xl shadow-purple-500/20 ring-4 ring-purple-500/10">
              <Calculator size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Accounting Dashboard</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.3em]">Financial Analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/reports/balancesheet" className="flex items-center gap-2 px-5 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white hover:border-purple-500/40 transition-all">
              <Scale size={14} /> Balance Sheet
            </Link>
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-purple-600/20">
              <Printer size={14} /> Print Report
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] p-5 no-print">
        <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] ml-2">From Date</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-sm text-slate-200 outline-none focus:border-purple-500 transition-all [color-scheme:dark]" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] ml-2">To Date</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-sm text-slate-200 outline-none focus:border-purple-500 transition-all [color-scheme:dark]" />
          </div>
          <button type="submit" className="px-8 py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-purple-600/20">
            <span className="inline-flex items-center gap-2"><RefreshCw size={14} /> Update Analytics</span>
          </button>
          <div className="ml-auto px-5 py-3 bg-[#0d1117] border border-purple-500/20 rounded-2xl">
            <span className="text-xs font-black text-purple-400">
              Period: {new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(from + "T00:00:00"))} — {new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(to + "T00:00:00"))}
            </span>
          </div>
        </form>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-80"><span>Total Revenue</span><TrendingUp size={16} /></div>
          <div className="text-3xl font-black mt-1">{inr(data.totalRevenue)}</div>
          <div className="text-xs font-bold opacity-80 mt-1">Service + Sales</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-80"><span>Revenue − Commission</span><Wallet size={16} /></div>
          <div className="text-3xl font-black mt-1">{inr(data.grossProfit)}</div>
          <div className="text-xs font-bold opacity-80 mt-1">After Commission</div>
        </div>
        <div className="bg-gradient-to-br from-red-600 to-rose-900 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-80"><span>Total Expenses</span><TrendingDown size={16} /></div>
          <div className="text-3xl font-black mt-1">{inr(data.totalExpenses)}</div>
          <div className="text-xs font-bold opacity-80 mt-1">Sal+Comm+Shop+EMI+Disc</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-700 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-80"><span>Net Profit</span><PiggyBank size={16} /></div>
          <div className="text-3xl font-black mt-1">{inr(data.netProfit)}</div>
          <div className="text-xs font-bold opacity-80 mt-1">Period Earnings</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="flex flex-wrap gap-2 p-4 border-b border-[#21293d] no-print">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${tab === t.key ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20" : "bg-[#0d1117] text-slate-400 hover:text-white border border-[#21293d]"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-40"><Loader2 size={48} className="animate-spin text-purple-500" /></div>
          ) : (
            <>
              {/* EXECUTIVE SUMMARY */}
              {tab === "summary" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <h4 className="font-black text-white mb-4">Profit &amp; Loss Overview</h4>
                    <table className="w-full text-sm">
                      <thead className="bg-[#0d1117] text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">
                        <tr><th className="px-4 py-3 text-left">Description</th><th className="px-4 py-3 text-right">Amount (₹)</th></tr>
                      </thead>
                      <tbody className="divide-y divide-[#21293d] text-slate-300">
                        <tr><td className="px-4 py-3">Service/Repair Revenue <span className="text-slate-600 text-xs">(Delivered jobs)</span></td><td className="px-4 py-3 text-right">{inr(data.serviceRevenue)}</td></tr>
                        <tr><td className="px-4 py-3">Direct Sales Revenue <span className="text-slate-600 text-xs">(Walk-in + Client)</span></td><td className="px-4 py-3 text-right">{inr(data.salesRevenue)}</td></tr>
                        <tr className="bg-[#0d1117]"><td className="px-4 py-3 font-black text-white">Total Gross Revenue</td><td className="px-4 py-3 text-right font-black text-white">{inr(data.totalRevenue)}</td></tr>
                        <tr><td className="px-4 py-3 text-red-400">− Staff Salary Earned <span className="text-slate-600 text-xs">(Attendance)</span></td><td className="px-4 py-3 text-right text-red-400">({inr(data.salaryEarned)})</td></tr>
                        <tr><td className="px-4 py-3 text-red-400">− Mechanic Commissions</td><td className="px-4 py-3 text-right text-red-400">({inr(data.commission)})</td></tr>
                        <tr><td className="px-4 py-3 text-red-400">− Shop &amp; Operational Expenses</td><td className="px-4 py-3 text-right text-red-400">({inr(data.shopExpenses)})</td></tr>
                        <tr><td className="px-4 py-3 text-red-400">− Loan EMI Payments</td><td className="px-4 py-3 text-right text-red-400">({inr(data.loanEmis)})</td></tr>
                        <tr><td className="px-4 py-3 text-red-400">− Discounts Allowed</td><td className="px-4 py-3 text-right text-red-400">({inr(data.discounts)})</td></tr>
                        <tr className="bg-purple-600"><td className="px-4 py-3 font-black text-white">NET OPERATING PROFIT</td><td className="px-4 py-3 text-right font-black text-white">{inr(data.netProfit)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <h4 className="font-black text-white mb-4">Efficiency Metrics</h4>
                    <div className="bg-[#0d1117] border border-[#21293d] rounded-2xl p-5 space-y-6">
                      <div>
                        <div className="flex justify-between text-xs font-bold text-slate-400 mb-1.5">
                          <span>Net Profit Margin</span><span>{margin.toFixed(1)}%</span>
                        </div>
                        {pctBar(margin)}
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold text-slate-400 mb-1.5">
                          <span>Collection Efficiency</span><span>{collectionRate.toFixed(1)}%</span>
                        </div>
                        {pctBar(collectionRate)}
                      </div>
                      <div className="p-4 bg-[#111520] border border-[#21293d] rounded-xl text-xs text-slate-400">
                        <p className="font-black text-slate-300 mb-1">💡 Strategy Insight:</p>
                        <p>Gross Profit <b className="text-white">{inr(data.grossProfit)}</b>. Net profit badhane ke liye <b className="text-white">Shop Expenses</b> aur <b className="text-white">Discount Policies</b> optimize karein.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PERFORMANCE ANALYTICS */}
              {tab === "performance" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-black text-white mb-4">Expense Breakdown</h4>
                    <div className="bg-[#0d1117] border border-[#21293d] rounded-2xl divide-y divide-[#21293d]">
                      {data.expenseCategories.length === 0 ? (
                        <div className="p-6 text-center text-slate-600 italic">Is period me koi expense recorded nahi</div>
                      ) : data.expenseCategories.map((ex, i) => (
                        <div key={i} className="flex items-center justify-between px-5 py-3.5">
                          <span className="text-sm text-slate-300">{ex.category}</span>
                          <span className="font-black text-red-400">{inr(ex.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-black text-white mb-4">Top 5 Revenue Contributors</h4>
                    <div className="bg-[#0d1117] border border-[#21293d] rounded-2xl divide-y divide-[#21293d]">
                      {data.topCustomers.length === 0 ? (
                        <div className="p-6 text-center text-slate-600 italic">Koi revenue data nahi</div>
                      ) : data.topCustomers.map((tc, i) => (
                        <div key={i} className="flex items-center justify-between px-5 py-3.5">
                          <span className="text-sm text-slate-300">{tc.name}</span>
                          <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black">{inr(tc.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* CASH FLOW */}
              {tab === "cash" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-black text-emerald-400 mb-4 flex items-center gap-2"><ArrowDownCircle size={16} /> Cash Inflow (Receipts)</h4>
                    <div className="bg-[#0d1117] border border-[#21293d] rounded-2xl divide-y divide-[#21293d]">
                      <div className="flex justify-between px-5 py-3.5 text-sm text-slate-300"><span>Client Payments Collected</span><span className="font-bold text-emerald-400">{inr(data.collections)}</span></div>
                      <div className="flex justify-between px-5 py-3.5 text-sm text-slate-300"><span>Walk-in Direct Sales (Cash)</span><span className="font-bold text-emerald-400">{inr(data.walkinSales)}</span></div>
                      <div className="flex justify-between px-5 py-4 bg-[#111520] text-sm"><span className="font-black text-white">Total Cash In</span><span className="font-black text-emerald-400">{inr(data.cashInflow)}</span></div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-black text-red-400 mb-4 flex items-center gap-2"><ArrowUpCircle size={16} /> Cash Outflow (Payments)</h4>
                    <div className="bg-[#0d1117] border border-[#21293d] rounded-2xl divide-y divide-[#21293d]">
                      <div className="flex justify-between px-5 py-3.5 text-sm text-slate-300"><span>Shop &amp; Operational Expenses</span><span className="font-bold">{inr(data.shopExpenses)}</span></div>
                      <div className="flex justify-between px-5 py-3.5 text-sm text-slate-300"><span>Staff Advance / Salary Paid</span><span className="font-bold">{inr(data.staffAdvances)}</span></div>
                      <div className="flex justify-between px-5 py-3.5 text-sm text-slate-300"><span>Loan EMI / Debt Repayments</span><span className="font-bold">{inr(data.loanEmis)}</span></div>
                      <div className="flex justify-between px-5 py-4 bg-[#111520] text-sm"><span className="font-black text-white">Total Cash Out</span><span className="font-black text-red-400">{inr(data.cashOutflow)}</span></div>
                    </div>
                  </div>
                  <div className="lg:col-span-2">
                    <div className="p-6 bg-gradient-to-r from-purple-700 to-indigo-800 rounded-2xl text-center text-white">
                      <h4 className="font-black mb-1">Net Cash Flow (Liquidity)</h4>
                      <div className="text-4xl font-black">{inr(data.cashInflow - data.cashOutflow)}</div>
                      <small className="opacity-80">Cash In − Cash Out</small>
                    </div>
                  </div>
                </div>
              )}

              {/* ASSETS & LIABILITIES */}
              {tab === "assets" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-black text-white mb-4">Current Assets</h4>
                    <div className="bg-[#0d1117] border border-[#21293d] rounded-2xl p-5 space-y-3 text-sm">
                      <div className="flex justify-between text-slate-300"><span>Cash &amp; Bank Balance (Est.)</span><span className="font-bold">{inr(data.cashOnHand)}</span></div>
                      <div className="flex justify-between text-slate-300"><span>Accounts Receivable (Customer Dues)</span><span className="font-bold">{inr(data.accountsReceivable)}</span></div>
                      <div className="flex justify-between text-slate-300"><span>Inventory / Stock Value</span><span className="font-bold">{inr(data.inventoryValue)}</span></div>
                      <hr className="border-[#21293d]" />
                      <div className="flex justify-between font-black text-white text-base"><span>TOTAL ASSETS</span><span>{inr(totalAssets)}</span></div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-black text-white mb-4">Current Liabilities</h4>
                    <div className="bg-[#0d1117] border border-[#21293d] rounded-2xl p-5 space-y-3 text-sm">
                      <div className="flex justify-between text-slate-300"><span>Lender Loans Payable</span><span className="font-bold">{inr(data.loansPayable)}</span></div>
                      <hr className="border-[#21293d]" />
                      <div className="flex justify-between font-black text-red-400 text-base"><span>TOTAL LIABILITIES</span><span>{inr(data.loansPayable)}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* INVENTORY HEALTH */}
              {tab === "inventory" && (
                <div>
                  <h4 className="font-black text-white mb-4">Top Inventory Assets</h4>
                  <div className="bg-[#0d1117] border border-[#21293d] rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] border-b border-[#21293d]">
                        <tr><th className="px-5 py-3.5 text-left">Product Name</th><th className="px-5 py-3.5 text-center">Current Qty</th><th className="px-5 py-3.5 text-right">Unit Price</th><th className="px-5 py-3.5 text-right">Total Value</th></tr>
                      </thead>
                      <tbody className="divide-y divide-[#21293d] text-slate-300">
                        {data.stockItems.map((row, i) => (
                          <tr key={i}>
                            <td className="px-5 py-3.5">{row.name}</td>
                            <td className="px-5 py-3.5 text-center">
                              <span className={`px-3 py-1 rounded-lg text-xs font-black ${row.qty < 5 ? "bg-red-500/15 text-red-400 border border-red-500/30" : "bg-purple-500/10 text-purple-400 border border-purple-500/20"}`}>{row.qty}</span>
                            </td>
                            <td className="px-5 py-3.5 text-right">{inr(row.price)}</td>
                            <td className="px-5 py-3.5 text-right font-black">{inr(row.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#111520] border-t border-[#21293d]">
                          <td colSpan={3} className="px-5 py-3.5 text-right font-black text-white">Estimated Total Stock Value:</td>
                          <td className="px-5 py-3.5 text-right font-black text-purple-400">{inr(data.inventoryValue)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
                    <Package size={16} className="text-purple-400" /> Stock value end-date tak calculate kiya gaya hai.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export default function AccountingDashboardReport() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-48"><Loader2 size={48} className="animate-spin text-purple-500" /></div>}>
      <AccountingDashboardContent />
    </Suspense>
  );
}
