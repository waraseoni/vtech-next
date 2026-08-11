"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { pageAll } from "@/lib/fetch-all";
import {
  Loader2, Calendar, Printer, TrendingUp, TrendingDown, Wallet,
  ArrowDownCircle, ArrowUpCircle, Info, ChevronLeft, ChevronRight, X
} from "lucide-react";

const inr = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type ModalType = "payments" | "spot" | "advances" | "expenses" | "loan" | "salary" | "commission" | "discount" | "repairs" | "sales";
type DbRow = ReturnType<typeof JSON.parse>;

function DailyIncomeContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const todayIST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  const [from, setFrom] = useState(searchParams.get("from") || todayIST);
  const [to,   setTo]   = useState(searchParams.get("to")   || todayIST);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalType | null>(null);

  const [data, setData] = useState({
    revenue_repair: 0,
    revenue_sales: 0,
    total_revenue: 0,
    salary_earned: 0,
    commission: 0,
    discounts: 0,
    expenses: 0,
    loan_emi: 0,
    total_business_expense: 0,
    cash_payments: 0,
    cash_spot_sales: 0,
    total_cash_in: 0,
    staff_advances: 0,
    total_cash_out: 0,
    net_cash_flow: 0,
    net_profit: 0,
  });

  const [details, setDetails] = useState<Record<string, DbRow[]>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const start = `${from}T00:00:00+05:30`;
      const end   = `${to}T23:59:59+05:30`;

      // 1. Repair jobs revenue (status 5, date_completed in range)
      const { data: repairs } = await pageAll(supabase
        .from("transaction_list")
        .select("job_id, item, client_name, mechanic_id, amount, date_completed")
        .eq("status", 5)
        .gte("date_completed", start)
        .lte("date_completed", end));

      // 2. Direct sales (date_created in range)
      const { data: sales } = await pageAll(supabase
        .from("direct_sales")
        .select("id, sale_code, client_id, total_amount, payment_mode, remarks, date_created")
        .gte("date_created", start)
        .lte("date_created", end));

      // 3. Attendance based salary earned
      const { data: attendance } = await pageAll(supabase
        .from("attendance_list")
        .select("mechanic_id, curr_date, status")
        .in("status", [1, 3])
        .gte("curr_date", from)
        .lte("curr_date", to));
      const { data: mechanics } = await pageAll(supabase
        .from("mechanic_list")
        .select("id, firstname, lastname, daily_salary"));
      const { data: salaryHistory } = await pageAll(supabase
        .from("mechanic_salary_history")
        .select("mechanic_id, salary, effective_date"));

      // 4. Commission (status 5, date_completed in range)
      const { data: commRows } = await pageAll(supabase
        .from("transaction_list")
        .select("job_id, mechanic_id, amount, mechanic_commission_amount, date_completed")
        .eq("status", 5)
        .gte("date_completed", start)
        .lte("date_completed", end));

      // 5. Discounts (client_payments, discount > 0, payment_date in range)
      const { data: discRows } = await pageAll(supabase
        .from("client_payments")
        .select("amount, discount, client_id, payment_date")
        .gt("discount", 0)
        .gte("payment_date", from)
        .lte("payment_date", to));

      // 6. General expenses
      const { data: expenseRows } = await pageAll(supabase
        .from("expense_list")
        .select("id, amount, category, remarks, payment_mode, date_created")
        .gte("date_created", start)
        .lte("date_created", end));

      // 7. Loan EMI paid to lenders
      const { data: loanRows } = await pageAll(supabase
        .from("loan_payments")
        .select("lender_id, amount_paid, payment_date, remarks")
        .gte("payment_date", from)
        .lte("payment_date", to));

      // 8. Client payments (all, cash inflow)
      const { data: payRows } = await pageAll(supabase
        .from("client_payments")
        .select("client_id, amount, payment_mode, remarks, payment_date")
        .gte("payment_date", from)
        .lte("payment_date", to));

      // 9. Staff advances
      const { data: advRows } = await pageAll(supabase
        .from("advance_payments")
        .select("mechanic_id, amount, reason, date_paid")
        .gte("date_paid", from)
        .lte("date_paid", to));

      // Meta lookups
      const { data: clients } = await pageAll(supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname"));
      const { data: lenders } = await pageAll(supabase
        .from("lender_list")
        .select("id, fullname"));

      const clientName = (id: number | string) => {
        const c = (clients || []).find((x) => x.id === id);
        return c ? [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ") : "Walk-in";
      };
      const mechName = (id: number | string) => {
        const m = (mechanics || []).find((x) => x.id === id);
        return m ? `${m.firstname} ${m.lastname}`.trim() : "Unknown";
      };
      const lenderName = (id: number | string) => {
        const l = (lenders || []).find((x) => x.id === id);
        return l ? l.fullname : "Unknown Lender";
      };

      // Salary earned (mirror PHP: rate from history <= curr_date, half day = rate/2)
      const histByMech: Record<number, { salary: number; effective_date: string }[]> = {};
      (salaryHistory || []).forEach((h) => {
        (histByMech[h.mechanic_id] = histByMech[h.mechanic_id] || []).push(h);
      });
      Object.values(histByMech).forEach((list) => list.sort((a, b) => a.effective_date.localeCompare(b.effective_date)));

      let salary_earned = 0;
      const salary_detail: DbRow[] = [];
      (attendance || []).forEach((a) => {
        const m = (mechanics || []).find((x) => x.id === a.mechanic_id);
        const history = (histByMech[a.mechanic_id] || []).filter((h) => h.effective_date <= a.curr_date);
        const rate = history.length > 0 ? history[history.length - 1].salary : m?.daily_salary || 0;
        const earned = a.status === 3 ? rate / 2 : rate;
        salary_earned += earned;
        salary_detail.push({ curr_date: a.curr_date, name: mechName(a.mechanic_id), status: a.status, rate, earned });
      });

      const revenue_repair = (repairs || []).reduce((s, r) => s + (r.amount || 0), 0);
      const revenue_sales = (sales || []).reduce((s, r) => s + (r.total_amount || 0), 0);
      const commission = (commRows || []).reduce((s, r) => s + (r.mechanic_commission_amount || 0), 0);
      const discounts = (discRows || []).reduce((s, r) => s + (r.discount || 0), 0);
      const expenses = (expenseRows || []).reduce((s, r) => s + (r.amount || 0), 0);
      const loan_emi = (loanRows || []).reduce((s, r) => s + (r.amount_paid || 0), 0);
      const cash_payments = (payRows || []).reduce((s, r) => s + (r.amount || 0), 0);
      const spotSales = (sales || []).filter((s) => s.client_id == null || s.client_id === 0 || s.client_id === "");
      const cash_spot_sales = spotSales.reduce((s, r) => s + (r.total_amount || 0), 0);
      const staff_advances = (advRows || []).reduce((s, r) => s + (r.amount || 0), 0);

      const total_revenue = revenue_repair + revenue_sales;
      const total_business_expense = salary_earned + commission + discounts + expenses + loan_emi;
      const total_cash_in = cash_payments + cash_spot_sales;
      const total_cash_out = staff_advances + expenses + loan_emi;
      const net_cash_flow = total_cash_in - total_cash_out;
      const net_profit = total_revenue - total_business_expense;

      setData({
        revenue_repair, revenue_sales, total_revenue,
        salary_earned, commission, discounts, expenses, loan_emi, total_business_expense,
        cash_payments, cash_spot_sales, total_cash_in,
        staff_advances, total_cash_out, net_cash_flow, net_profit,
      });

      setDetails({
        repairs: (repairs || []).map((r) => ({ ...r, client_name: clientName(r.client_name), mechanic_name: mechName(r.mechanic_id) })),
        sales: (sales || []).map((r) => ({ ...r, client_name: r.client_id == null || r.client_id === 0 || r.client_id === "" ? "Walk-in" : clientName(r.client_id) })),
        salary: salary_detail,
        commission: (commRows || []).map((r) => ({ ...r, mechanic_name: mechName(r.mechanic_id) })),
        discounts: (discRows || []).map((r) => ({ ...r, client_name: clientName(r.client_id) })),
        expenses: (expenseRows || []),
        loan: (loanRows || []).map((r) => ({ ...r, lender_name: lenderName(r.lender_id) })),
        payments: (payRows || []).map((r) => ({ ...r, client_name: clientName(r.client_id) })),
        spot: spotSales.map((r) => ({ ...r, client_name: "Walk-in" })),
        advances: (advRows || []).map((r) => ({ ...r, staff_name: mechName(r.mechanic_id) })),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(searchParams.toString());
    p.set("from", from);
    p.set("to", to);
    router.replace("?" + p.toString(), { scroll: false });
  };

  const shiftDay = (diff: number) => {
    const shift = (d: string) => {
      const t = new Date(d + "T12:00:00+05:30");
      t.setDate(t.getDate() + diff);
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
    };
    setFrom(shift(from));
    setTo(shift(to));
  };

  const modalTitle: Record<ModalType, string> = {
    payments: "Client Payments Details",
    spot: "Spot Sales (Walk-in) Details",
    advances: "Staff Advances Paid",
    expenses: "Shop Expenses Details",
    loan: "Loan EMI Payments",
    salary: "Attendance Based Salary Earned",
    commission: "Mechanic Commissions Details",
    discount: "Customer Discount Details",
    repairs: "Repair Jobs Billed Details",
    sales: "Direct Sales Billed Details",
  };

  const modalTotal = (type: ModalType) => {
    const rows = details[type] || [];
    if (type === "payments" || type === "salary" || type === "discount" || type === "advances" || type === "expenses") return rows.reduce((s, r) => s + (r.amount || 0), 0);
    if (type === "spot" || type === "sales") return rows.reduce((s, r) => s + (r.total_amount || 0), 0);
    if (type === "loan") return rows.reduce((s, r) => s + (r.amount_paid || 0), 0);
    if (type === "commission") return { job: rows.reduce((s, r) => s + (r.amount || 0), 0), comm: rows.reduce((s, r) => s + (r.mechanic_commission_amount || 0), 0) };
    if (type === "repairs") return rows.reduce((s, r) => s + (r.amount || 0), 0);
    return 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <TrendingUp size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Daily Income & Cash Flow Report</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Revenue, Expenses &amp; Actual Money Movement</p>
            </div>
          </div>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all">
            <Printer size={14} /> Print Report
          </button>
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
            Apply Filter
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => shiftDay(-1)} className="p-2 rounded-xl bg-[#1e2637] text-slate-400 hover:text-white transition-all" title="Previous Day">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => shiftDay(1)} className="p-2 rounded-xl bg-[#1e2637] text-slate-400 hover:text-white transition-all" title="Next Day">
              <ChevronRight size={16} />
            </button>
            <button type="button" onClick={() => { setFrom(todayIST); setTo(todayIST); router.replace("/reports/daily-income"); }}
              className="px-4 py-2 bg-[#1e2637] text-slate-400 hover:text-white rounded-xl text-sm font-bold transition-all">
              Reset
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <Loader2 size={32} className="animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em]">Calculating...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <button onClick={() => setModal("payments")} className="text-left bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 shadow-xl hover:-translate-y-0.5 transition-all group">
              <div className="flex items-center gap-2 mb-4">
                <ArrowDownCircle size={18} className="text-white/80" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Total Cash In</span>
              </div>
              <h2 className="text-3xl font-black text-white">{inr(data.total_cash_in)}</h2>
              <p className="text-xs text-white/70 mt-1">Actual Money Collected</p>
            </button>

            <button onClick={() => setModal("advances")} className="text-left bg-gradient-to-br from-rose-500 to-red-600 rounded-3xl p-6 shadow-xl hover:-translate-y-0.5 transition-all group">
              <div className="flex items-center gap-2 mb-4">
                <ArrowUpCircle size={18} className="text-white/80" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Total Cash Out</span>
              </div>
              <h2 className="text-3xl font-black text-white">{inr(data.total_cash_out)}</h2>
              <p className="text-xs text-white/70 mt-1">Actual Money Spent</p>
            </button>

            <button onClick={() => setModal("expenses")} className={`text-left rounded-3xl p-6 shadow-xl hover:-translate-y-0.5 transition-all border ${
              data.net_cash_flow >= 0 ? "bg-gradient-to-br from-sky-500 to-blue-700 border-transparent" : "bg-gradient-to-br from-amber-500 to-orange-600 border-transparent"
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <Wallet size={18} className="text-white/80" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Net Cash Flow</span>
              </div>
              <h2 className="text-3xl font-black text-white">{inr(data.net_cash_flow)}</h2>
              <p className="text-xs text-white/70 mt-1">Cash in Hand Change</p>
            </button>

            <button onClick={() => setModal("expenses")} className="text-left bg-gradient-to-br from-violet-600 to-purple-800 rounded-3xl p-6 shadow-xl hover:-translate-y-0.5 transition-all group">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-white/80" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Net Profit (P&amp;L)</span>
              </div>
              <h2 className="text-3xl font-black text-white">{inr(data.net_profit)}</h2>
              <p className="text-xs text-white/70 mt-1">Revenue - All Expenses</p>
            </button>
          </div>

          {/* Detailed Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cash Flow */}
            <div className="bg-[#161b27] border border-[#21293d] rounded-3xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-[#21293d] bg-[#111520]/50 flex items-center gap-3">
                <Wallet size={18} className="text-emerald-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Cash Flow (Actual)</h3>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-[#21293d]">
                  <tr><td colSpan={2} className="px-6 py-2 bg-[#111520] text-[10px] font-black uppercase tracking-widest text-slate-600">Inflow (Paisa Aaya)</td></tr>
                  <tr className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setModal("payments")}>
                    <td className="px-6 py-3.5 text-slate-400 font-medium">Client Payments</td>
                    <td className="px-6 py-3.5 text-right font-black text-white">{inr(data.cash_payments)}</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setModal("spot")}>
                    <td className="px-6 py-3.5 text-slate-400 font-medium">Spot Sales (Cash)</td>
                    <td className="px-6 py-3.5 text-right font-black text-white">{inr(data.cash_spot_sales)}</td>
                  </tr>
                  <tr><td colSpan={2} className="px-6 py-2 bg-[#111520] text-[10px] font-black uppercase tracking-widest text-slate-600">Outflow (Paisa Gaya)</td></tr>
                  <tr className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setModal("advances")}>
                    <td className="px-6 py-3.5 text-slate-400 font-medium">Staff Advances Paid</td>
                    <td className="px-6 py-3.5 text-right font-black text-rose-400">{inr(data.staff_advances)}</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setModal("expenses")}>
                    <td className="px-6 py-3.5 text-slate-400 font-medium">Shop Expenses Paid</td>
                    <td className="px-6 py-3.5 text-right font-black text-rose-400">{inr(data.expenses)}</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setModal("loan")}>
                    <td className="px-6 py-3.5 text-slate-400 font-medium">Loan EMI Paid</td>
                    <td className="px-6 py-3.5 text-right font-black text-rose-400">{inr(data.loan_emi)}</td>
                  </tr>
                  <tr className="bg-emerald-500/5 border-t-2 border-emerald-500/20">
                    <td className="px-6 py-4 text-emerald-400 font-black uppercase text-xs">Net Cash Flow</td>
                    <td className="px-6 py-4 text-right font-black text-emerald-400 text-lg">{inr(data.net_cash_flow)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Business Expenses (P&L) */}
            <div className="bg-[#161b27] border border-[#21293d] rounded-3xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-[#21293d] bg-[#111520]/50 flex items-center gap-3">
                <TrendingDown size={18} className="text-rose-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Business Expenses (P&amp;L)</h3>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-[#21293d]">
                  <tr className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setModal("salary")}>
                    <td className="px-6 py-3.5 text-slate-400 font-medium">Staff Salary<br /><span className="text-[10px] text-slate-600">Attendance Based</span></td>
                    <td className="px-6 py-3.5 text-right font-black text-white">{inr(data.salary_earned)}</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setModal("commission")}>
                    <td className="px-6 py-3.5 text-slate-400 font-medium">Mechanic Commission</td>
                    <td className="px-6 py-3.5 text-right font-black text-white">{inr(data.commission)}</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setModal("discount")}>
                    <td className="px-6 py-3.5 text-slate-400 font-medium">Customer Discounts</td>
                    <td className="px-6 py-3.5 text-right font-black text-white">{inr(data.discounts)}</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setModal("expenses")}>
                    <td className="px-6 py-3.5 text-slate-400 font-medium">General Expenses</td>
                    <td className="px-6 py-3.5 text-right font-black text-white">{inr(data.expenses)}</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setModal("loan")}>
                    <td className="px-6 py-3.5 text-slate-400 font-medium">Loan EMI Payments</td>
                    <td className="px-6 py-3.5 text-right font-black text-white">{inr(data.loan_emi)}</td>
                  </tr>
                  <tr className="bg-rose-500/5 border-t-2 border-rose-500/20">
                    <td className="px-6 py-4 text-rose-400 font-black uppercase text-xs">Total Business Exp</td>
                    <td className="px-6 py-4 text-right font-black text-rose-400 text-lg">{inr(data.total_business_expense)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Sales & Revenue */}
            <div className="bg-[#161b27] border border-[#21293d] rounded-3xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-[#21293d] bg-[#111520]/50 flex items-center gap-3">
                <TrendingUp size={18} className="text-blue-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Sales &amp; Revenue</h3>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-[#21293d]">
                  <tr className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setModal("repairs")}>
                    <td className="px-6 py-3.5 text-slate-400 font-medium">Repair Jobs Billed</td>
                    <td className="px-6 py-3.5 text-right font-black text-white">{inr(data.revenue_repair)}</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setModal("sales")}>
                    <td className="px-6 py-3.5 text-slate-400 font-medium">Direct Sales Billed</td>
                    <td className="px-6 py-3.5 text-right font-black text-white">{inr(data.revenue_sales)}</td>
                  </tr>
                  <tr className="bg-blue-500/5 border-t-2 border-blue-500/20">
                    <td className="px-6 py-4 text-blue-400 font-black uppercase text-xs">Total Revenue</td>
                    <td className="px-6 py-4 text-right font-black text-blue-400 text-lg">{inr(data.total_revenue)}</td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="px-6 py-5 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Estimated Profit</p>
                      <p className={`text-2xl font-black ${data.net_profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{inr(data.net_profit)}</p>
                      <p className="text-[10px] text-slate-600 mt-1">(Revenue - Business Expenses)</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Drill-down Modal */}
          {modal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-[#161b27] border border-[#21293d] rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-[#21293d]">
                  <h2 className="text-lg font-black text-white">{modalTitle[modal]}</h2>
                  <button onClick={() => setModal(null)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-rose-500 transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto">
                  {details[modal]?.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 font-bold">No data found for this period.</div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[#21293d]">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-[#0d1117] text-slate-400 text-[10px] uppercase tracking-widest">
                          {modal === "payments" && <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Remarks</th><th className="px-4 py-3 text-right">Amount</th></tr>}
                          {modal === "spot" && <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Sale Code</th><th className="px-4 py-3">Pay Mode</th><th className="px-4 py-3">Remarks</th><th className="px-4 py-3 text-right">Total</th></tr>}
                          {modal === "advances" && <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3 text-right">Amount</th></tr>}
                          {modal === "expenses" && <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Remarks</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3 text-right">Amount</th></tr>}
                          {modal === "loan" && <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Lender</th><th className="px-4 py-3">Remarks</th><th className="px-4 py-3 text-right">Amount Paid</th></tr>}
                          {modal === "salary" && <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Daily Rate</th><th className="px-4 py-3 text-right">Earned</th></tr>}
                          {modal === "commission" && <tr><th className="px-4 py-3">Completed</th><th className="px-4 py-3">Job ID</th><th className="px-4 py-3">Mechanic</th><th className="px-4 py-3 text-right">Job Amount</th><th className="px-4 py-3 text-right">Commission</th></tr>}
                          {modal === "discount" && <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Client</th><th className="px-4 py-3 text-right">Total Bill</th><th className="px-4 py-3 text-right">Discount</th></tr>}
                          {modal === "repairs" && <tr><th className="px-4 py-3">Completed</th><th className="px-4 py-3">Job ID</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Mechanic</th><th className="px-4 py-3">Item</th><th className="px-4 py-3 text-right">Amount</th></tr>}
                          {modal === "sales" && <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Sale Code</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Pay Mode</th><th className="px-4 py-3 text-right">Amount</th></tr>}
                        </thead>
                        <tbody className="divide-y divide-[#21293d]">
                          {(details[modal] || []).map((row, i) => {
                            const d = (v: string) => v?.split("T")[0] || v?.split(" ")[0] || v || "";
                            if (modal === "payments") return <tr key={i} className="hover:bg-white/[0.02]"><td className="px-4 py-3 text-white">{d(row.payment_date)}</td><td className="px-4 py-3 text-indigo-300 font-bold">{row.client_name}</td><td className="px-4 py-3 text-slate-400">{row.payment_mode || "Cash"}</td><td className="px-4 py-3 text-slate-400">{row.remarks || "-"}</td><td className="px-4 py-3 text-right text-emerald-400 font-bold">{inr(row.amount)}</td></tr>;
                            if (modal === "spot") return <tr key={i} className="hover:bg-white/[0.02]"><td className="px-4 py-3 text-white">{d(row.date_created)}</td><td className="px-4 py-3 text-slate-300"><code>{row.sale_code}</code></td><td className="px-4 py-3 text-slate-400">{row.payment_mode || "Cash"}</td><td className="px-4 py-3 text-slate-400">{row.remarks || "-"}</td><td className="px-4 py-3 text-right text-emerald-400 font-bold">{inr(row.total_amount)}</td></tr>;
                            if (modal === "advances") return <tr key={i} className="hover:bg-white/[0.02]"><td className="px-4 py-3 text-white">{d(row.date_paid)}</td><td className="px-4 py-3 text-indigo-300 font-bold">{row.staff_name}</td><td className="px-4 py-3 text-slate-400">{row.reason || "-"}</td><td className="px-4 py-3 text-slate-400">Cash</td><td className="px-4 py-3 text-right text-rose-400 font-bold">{inr(row.amount)}</td></tr>;
                            if (modal === "expenses") return <tr key={i} className="hover:bg-white/[0.02]"><td className="px-4 py-3 text-white">{d(row.date_created)}</td><td className="px-4 py-3 text-slate-300"><span className="px-2 py-1 bg-slate-800 rounded-md text-xs">{row.category}</span></td><td className="px-4 py-3 text-slate-400">{row.remarks || "-"}</td><td className="px-4 py-3 text-slate-400">{row.payment_mode || "Cash"}</td><td className="px-4 py-3 text-right text-rose-400 font-bold">{inr(row.amount)}</td></tr>;
                            if (modal === "loan") return <tr key={i} className="hover:bg-white/[0.02]"><td className="px-4 py-3 text-white">{d(row.payment_date)}</td><td className="px-4 py-3 text-indigo-300 font-bold">{row.lender_name}</td><td className="px-4 py-3 text-slate-400">{row.remarks || "-"}</td><td className="px-4 py-3 text-right text-rose-400 font-bold">{inr(row.amount_paid)}</td></tr>;
                            if (modal === "salary") return <tr key={i} className="hover:bg-white/[0.02]"><td className="px-4 py-3 text-white">{d(row.curr_date)}</td><td className="px-4 py-3 text-indigo-300 font-bold">{row.name}</td><td className="px-4 py-3 text-slate-400">{row.status === 3 ? <span className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded-md text-xs font-bold">Half Day</span> : <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md text-xs font-bold">Full Day</span>}</td><td className="px-4 py-3 text-right text-slate-300">{inr(row.rate)}</td><td className="px-4 py-3 text-right text-emerald-400 font-bold">{inr(row.earned)}</td></tr>;
                            if (modal === "commission") return <tr key={i} className="hover:bg-white/[0.02]"><td className="px-4 py-3 text-white">{d(row.date_completed)}</td><td className="px-4 py-3 text-slate-300"><code>{row.job_id}</code></td><td className="px-4 py-3 text-indigo-300 font-bold">{row.mechanic_name}</td><td className="px-4 py-3 text-right text-slate-300">{inr(row.amount)}</td><td className="px-4 py-3 text-right text-amber-400 font-bold">{inr(row.mechanic_commission_amount)}</td></tr>;
                            if (modal === "discount") return <tr key={i} className="hover:bg-white/[0.02]"><td className="px-4 py-3 text-white">{d(row.payment_date)}</td><td className="px-4 py-3 text-indigo-300 font-bold">{row.client_name}</td><td className="px-4 py-3 text-right text-slate-300">{inr((row.amount || 0) + (row.discount || 0))}</td><td className="px-4 py-3 text-right text-rose-400 font-bold">{inr(row.discount)}</td></tr>;
                            if (modal === "repairs") return <tr key={i} className="hover:bg-white/[0.02]"><td className="px-4 py-3 text-white">{d(row.date_completed)}</td><td className="px-4 py-3 text-slate-300"><code>{row.job_id}</code></td><td className="px-4 py-3 text-indigo-300 font-bold">{row.client_name}</td><td className="px-4 py-3 text-slate-400">{row.mechanic_name}</td><td className="px-4 py-3 text-slate-400">{row.item}</td><td className="px-4 py-3 text-right text-emerald-400 font-bold">{inr(row.amount)}</td></tr>;
                            if (modal === "sales") return <tr key={i} className="hover:bg-white/[0.02]"><td className="px-4 py-3 text-white">{d(row.date_created)}</td><td className="px-4 py-3 text-slate-300"><code>{row.sale_code}</code></td><td className="px-4 py-3 text-indigo-300 font-bold">{row.client_name}</td><td className="px-4 py-3 text-slate-400">{row.payment_mode || "Cash"}</td><td className="px-4 py-3 text-right text-emerald-400 font-bold">{inr(row.total_amount)}</td></tr>;
                            return null;
                          })}
                        </tbody>
                        <tfoot className="bg-[#0d1117] border-t border-[#21293d]">
                          {modal === "commission" ? (
                            <tr>
                              <td colSpan={3} className="px-4 py-4 text-right text-[10px] uppercase tracking-widest text-slate-500 font-black">Totals</td>
                              <td className="px-4 py-4 text-right font-black text-slate-200">{inr((modalTotal("commission") as { job: number; comm: number }).job)}</td>
                              <td className="px-4 py-4 text-right font-black text-amber-400">{inr((modalTotal("commission") as { job: number; comm: number }).comm)}</td>
                            </tr>
                          ) : (
                            <tr>
                              <td colSpan={modal === "repairs" ? 5 : modal === "payments" || modal === "spot" || modal === "advances" || modal === "expenses" ? 4 : 3} className="px-4 py-4 text-right text-[10px] uppercase tracking-widest text-slate-500 font-black">Grand Total</td>
                              <td className="px-4 py-4 text-right font-black text-base text-white">{inr(modalTotal(modal) as number)}</td>
                            </tr>
                          )}
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info Alert */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-3 text-blue-400/80 text-xs font-bold leading-relaxed shadow-lg">
            <Info size={20} className="flex-shrink-0" />
            <p>
              Accounting Logic: This report differentiates between <b>Revenue</b> (work billed) and <b>Cash Flow</b> (actual money collected).
              Total Cash In only counts actual payments received and spot sales to walk-in customers. Click on any row to view full details.
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
