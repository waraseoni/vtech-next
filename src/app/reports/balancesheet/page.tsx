"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { todayIST, formatIST, parseISTDate, startOfMonthIST, endOfMonthIST } from "@/lib/dateUtils";
import {
  Loader2, ChevronLeft, ChevronRight, Users, Wrench, Package,
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, BarChart2,
  Banknote, CreditCard, Printer, Download, X, Eye, Calendar
} from "lucide-react";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

type FilterType = "monthly" | "yearly" | "custom";

// ─── Customer Ledger Row ─────────────────────────────────────────────────────
type CLRow = {
  client_id: number;
  customer_name: string;
  contact: string | null;
  opening_balance: number;
  total_repair_amount: number;
  total_payment: number;
  current_balance: number;
  previous_transactions: number;
  total_jobs: number;
};

// ─── Mechanic Ledger Row ────────────────────────────────────────────────────
type MLRow = {
  mechanic_id: number;
  mechanic_name: string;
  daily_salary: number;
  commission_percent: number;
  total_advance_amount: number;
  advance_in_period: number;
  total_days_worked: number;
  days_worked_in_period: number;
  total_salary_due: number;
  salary_due_in_period: number;
  balance_amount: number;
};

// ─── Stock Row ──────────────────────────────────────────────────────────────
type StockRow = {
  product_id: number;
  product_name: string;
  description: string;
  sale_price: number;
  total_stock_in: number;
  sold_quantity: number;
  remaining_stock: number;
  stock_value: number;
};

// ─── Income Summary ─────────────────────────────────────────────────────────
type IncomeRow = { description: string; amount: number };

// ─── Expense Summary ────────────────────────────────────────────────────────
type ExpenseRow = { expense_category: string | null; amount: number };

// ─── Loan Ledger ────────────────────────────────────────────────────────────
type LoanRow = {
  lender_id: number;
  lender_name: string;
  loan_amount: number;
  interest_rate: number;
  emi_amount: number;
  start_date: string;
  previous_payments: number;
  paid_in_period: number;
  total_paid: number;
  balance_amount: number;
  remaining_emis: number;
  status: string;
};

// ─── Top Customer ───────────────────────────────────────────────────────────
type TopCustomer = {
  client_id: number;
  customer_name: string;
  contact: string | null;
  previous_jobs: number;
  total_jobs: number;
  total_amount: number;
  total_payment_amount: number;
  opening_balance: number;
  current_balance: number;
};

// ─── Detailed Ledger Entry ───────────────────────────────────────────────────
type LedgerEntry = {
  event_date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

function BalanceSheetContent() {
  const searchParams = useSearchParams();

  const today = todayIST();
  const currentYear = parseInt(today.slice(0, 4));
  const currentMonth = parseInt(today.slice(5, 7));

  const [filterType, setFilterType] = useState<FilterType>("monthly");
  const [selYear, setSelYear] = useState(currentYear);
  const [selMonth, setSelMonth] = useState(currentMonth);
  const [startDate, setStartDate] = useState(() => startOfMonthIST());
  const [endDate, setEndDate] = useState(() => endOfMonthIST());
  const [activeTab, setActiveTab] = useState("customer");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [customerLedger, setCustomerLedger] = useState<CLRow[]>([]);
  const [mechanicLedger, setMechanicLedger] = useState<MLRow[]>([]);
  const [stockInventory, setStockInventory] = useState<StockRow[]>([]);
  const [incomeSummary, setIncomeSummary] = useState<IncomeRow[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseRow[]>([]);
  const [loanLedger, setLoanLedger] = useState<LoanRow[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);

  const [selectedClient, setSelectedClient] = useState<{
    id: number; name: string; opening_balance: number;
  } | null>(null);
  const [detailedLedger, setDetailedLedger] = useState<LedgerEntry[]>([]);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Read filter from URL
  useEffect(() => {
    const ft = searchParams.get("filter_type") as FilterType | null;
    const yr = parseInt(searchParams.get("year") || "");
    const mo = parseInt(searchParams.get("month") || "");
    const sd = searchParams.get("start_date") || "";
    const ed = searchParams.get("end_date") || "";
    const nav = searchParams.get("nav");

    if (ft) setFilterType(ft);
    if (yr) setSelYear(yr);
    if (mo) setSelMonth(mo);
    if (sd) setStartDate(sd);
    if (ed) setEndDate(ed);

    if (nav === "prev" || nav === "next") {
      let y = yr || selYear;
      let m = mo || selMonth;

      if (filterType === "monthly") {
        if (nav === "prev") { m--; if (m < 1) { m = 12; y--; } }
        else { m++; if (m > 12) { m = 1; y++; } }
        setSelYear(y);
        setSelMonth(m);
        const d = new Date(y, m - 1, 1);
        const s = startOfMonthIST(d);
        const e = endOfMonthIST(d);
        setStartDate(s);
        setEndDate(e);
      } else if (filterType === "yearly") {
        y = nav === "prev" ? y - 1 : y + 1;
        setSelYear(y);
        setStartDate(`${y}-01-01`);
        setEndDate(`${y}-12-31`);
      }
    }
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const from = `${startDate}T00:00:00`;
      const to = `${endDate}T23:59:59`;
      const prevEnd = new Date(parseISTDate(startDate).getTime() - 86400000).toISOString().split("T")[0];

      // ── 1. Customer Ledger ───────────────────────────────────────────────
      const { data: clients } = await supabase
        .from("client_list").select("id, firstname, middlename, lastname, contact, opening_balance")
        .eq("delete_flag", 0);

      const clRows: CLRow[] = [];
      for (const c of clients || []) {
        const name = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ");

        // Opening balance = previous transactions - previous payments
        const { data: prevTxns } = await supabase
          .from("transaction_list").select("amount")
          .eq("client_name", c.id).in("status", [3, 5])
          .lt("date_created", from);
        const { data: prevPmts } = await supabase
          .from("client_payments").select("amount, discount")
          .eq("client_id", c.id).lt("payment_date", startDate);

        const openingBal =
          (c.opening_balance || 0) +
          (prevTxns?.reduce((s, r) => s + (r.amount || 0), 0) || 0) -
          (prevPmts?.reduce((s, r) => s + (r.amount || 0) + (r.discount || 0), 0) || 0);

        // Period transactions
        const { data: periodTxns } = await supabase
          .from("transaction_list").select("amount")
          .eq("client_name", c.id).in("status", [3, 5])
          .gte("date_created", from).lte("date_created", to);
        const { data: periodPmts } = await supabase
          .from("client_payments").select("amount, discount")
          .eq("client_id", c.id)
          .gte("payment_date", startDate).lte("payment_date", endDate);

        const repairAmt = periodTxns?.reduce((s, r) => s + (r.amount || 0), 0) || 0;
        const paymentAmt = periodPmts?.reduce((s, r) => s + (r.amount || 0) + (r.discount || 0), 0) || 0;
        const currentBal = openingBal + repairAmt - paymentAmt;
        const prevCount = (prevTxns?.length || 0);
        const periodCount = (periodTxns?.length || 0);

        if (repairAmt > 0 || paymentAmt > 0 || Math.abs(currentBal) > 0.01) {
          clRows.push({
            client_id: c.id, customer_name: name, contact: c.contact,
            opening_balance: openingBal, total_repair_amount: repairAmt,
            total_payment: paymentAmt, current_balance: currentBal,
            previous_transactions: prevCount, total_jobs: periodCount,
          });
        }
      }
      clRows.sort((a, b) => b.total_repair_amount - a.total_repair_amount);
      setCustomerLedger(clRows);

      // ── 2. Mechanic Ledger ────────────────────────────────────────────────
      const { data: mechanics } = await supabase
        .from("mechanic_list").select("id, firstname, middlename, lastname, salary_per_day, commission_percent")
        .eq("delete_flag", 0);

      const mlRows: MLRow[] = [];
      for (const m of mechanics || []) {
        const name = [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ");
        const salary = m.salary_per_day || 0;

        const { data: attAll } = await supabase
          .from("attendance_list").select("curr_date, status")
          .eq("mechanic_id", m.id).in("status", [1, 3]).lte("curr_date", endDate);
        const { data: attPeriod } = await supabase
          .from("attendance_list").select("curr_date, status")
          .eq("mechanic_id", m.id).in("status", [1, 3])
          .gte("curr_date", startDate).lte("curr_date", endDate);
        const { data: advAll } = await supabase
          .from("advance_payments").select("amount")
          .eq("mechanic_id", m.id).lte("date_paid", endDate);
        const { data: advPeriod } = await supabase
          .from("advance_payments").select("amount")
          .eq("mechanic_id", m.id)
          .gte("date_paid", startDate).lte("date_paid", endDate);

        const daysAll = attAll?.reduce((s, r) => s + (r.status === 3 ? 0.5 : 1), 0) || 0;
        const daysPeriod = attPeriod?.reduce((s, r) => s + (r.status === 3 ? 0.5 : 1), 0) || 0;
        const totalAdv = advAll?.reduce((s, r) => s + (r.amount || 0), 0) || 0;
        const advPeriodAmt = advPeriod?.reduce((s, r) => s + (r.amount || 0), 0) || 0;
        const totalSalary = daysAll * salary;
        const salaryPeriod = daysPeriod * salary;
        const balance = totalSalary - totalAdv;

        if (daysPeriod > 0 || balance !== 0) {
          mlRows.push({
            mechanic_id: m.id, mechanic_name: name,
            daily_salary: salary, commission_percent: m.commission_percent || 0,
            total_advance_amount: totalAdv, advance_in_period: advPeriodAmt,
            total_days_worked: daysAll, days_worked_in_period: daysPeriod,
            total_salary_due: totalSalary, salary_due_in_period: salaryPeriod,
            balance_amount: balance,
          });
        }
      }
      setMechanicLedger(mlRows);

      // ── 3. Stock Inventory ────────────────────────────────────────────────
      const { data: products } = await supabase
        .from("product_list").select("id, name, description, price").eq("delete_flag", 0);
      const { data: inventory } = await supabase.from("inventory_list").select("product_id, quantity");

      const { data: directSaleItems } = await supabase
        .from("direct_sale_items").select("product_id, qty, sale_id")
        .gte("sale_id", 0);

      const { data: txnProducts } = await supabase
        .from("transaction_products").select("product_id, qty, transaction_id");

      const { data: txns } = await supabase
        .from("transaction_list").select("id, date_created")
        .in("status", [3, 5]).gte("date_created", from).lte("date_created", to);

      const txnIds = new Set(txns?.map((t) => t.id) || []);
      const stockRows: StockRow[] = [];
      for (const p of products || []) {
        const stockIn = inventory?.filter((i) => i.product_id === p.id).reduce((s, i) => s + (i.quantity || 0), 0) || 0;
        const soldDs = directSaleItems?.reduce((s, i) => s + (i.qty || 0), 0) || 0;
        const soldTp = txnProducts?.filter((i) => i.product_id === p.id && txnIds.has(i.transaction_id)).reduce((s, i) => s + (i.qty || 0), 0) || 0;
        const remaining = stockIn - soldDs - soldTp;
        stockRows.push({
          product_id: p.id, product_name: p.name, description: p.description || "",
          sale_price: p.price || 0, total_stock_in: stockIn,
          sold_quantity: soldDs + soldTp, remaining_stock: remaining,
          stock_value: remaining * (p.price || 0),
        });
      }
      setStockInventory(stockRows);

      // ── 4. Income Summary ────────────────────────────────────────────────
      const { data: repairIncome } = await supabase
        .from("transaction_list").select("amount")
        .in("status", [3, 5]).gte("date_created", from).lte("date_created", to);
      const { data: directSales } = await supabase
        .from("direct_sales").select("total_amount")
        .gte("date_created", from).lte("date_created", to);
      setIncomeSummary([
        { description: "रिपेयर आय (Repair Income)", amount: repairIncome?.reduce((s, r) => s + (r.amount || 0), 0) || 0 },
        { description: "सीधी बिक्री (Direct Sales)", amount: directSales?.reduce((s, r) => s + (r.total_amount || 0), 0) || 0 },
      ]);

      // ── 5. Expense Summary ────────────────────────────────────────────────
      const { data: expenses } = await supabase
        .from("expense_list").select("category, amount")
        .gte("date_created", from).lte("date_created", to);
      const expMap: Record<string, number> = {};
      for (const e of expenses || []) {
        expMap[e.category || "Uncategorized"] = (expMap[e.category || "Uncategorized"] || 0) + (e.amount || 0);
      }
      setExpenseSummary(Object.entries(expMap).map(([k, v]) => ({ expense_category: k, amount: v })));

      // ── 6. Loan Ledger ───────────────────────────────────────────────────
      const { data: lenders } = await supabase.from("lender_list").select("*").eq("delete_flag", 0);
      const { data: loanPayments } = await supabase
        .from("loan_payments").select("lender_id, amount_paid, payment_date");

      const loanRows: LoanRow[] = [];
      for (const l of lenders || []) {
        const prevPmts = loanPayments?.filter((p) => p.lender_id === l.id && p.payment_date < startDate).reduce((s, p) => s + (p.amount_paid || 0), 0) || 0;
        const periodPmts = loanPayments?.filter((p) => p.lender_id === l.id && p.payment_date >= startDate && p.payment_date <= endDate).reduce((s, p) => s + (p.amount_paid || 0), 0) || 0;
        const totalPmts = loanPayments?.filter((p) => p.lender_id === l.id).reduce((s, p) => s + (p.amount_paid || 0), 0) || 0;
        const bal = (l.loan_amount || 0) - totalPmts;
        const emi = l.emi_amount || 0;
        const remainingEmis = emi > 0 ? Math.ceil(bal / emi) : 0;
        if (periodPmts > 0 || bal > 0) {
          loanRows.push({
            lender_id: l.id, lender_name: l.fullname || l.name || "Lender",
            loan_amount: l.loan_amount || 0, interest_rate: l.interest_rate || 0,
            emi_amount: emi, start_date: l.start_date || "",
            previous_payments: prevPmts, paid_in_period: periodPmts,
            total_paid: totalPmts, balance_amount: bal,
            remaining_emis: remainingEmis, status: bal > 0 ? "सक्रिय" : "समाप्त",
          });
        }
      }
      setLoanLedger(loanRows);

      // ── 7. Top Customers ─────────────────────────────────────────────────
      const topRows: TopCustomer[] = clRows
        .filter((c) => c.total_repair_amount > 0 || Math.abs(c.current_balance) > 0)
        .sort((a, b) => b.total_repair_amount - a.total_repair_amount)
        .slice(0, 10)
        .map((c) => ({
          client_id: c.client_id, customer_name: c.customer_name, contact: c.contact,
          previous_jobs: c.previous_transactions, total_jobs: c.total_jobs,
          total_amount: c.total_repair_amount,
          total_payment_amount: c.total_payment,
          opening_balance: c.opening_balance, current_balance: c.current_balance,
        }));
      setTopCustomers(topRows);
    } catch (e: any) {
      setErr(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const applyFilter = () => {
    if (filterType === "monthly") {
      const d = new Date(selYear, selMonth - 1, 1);
      const s = startOfMonthIST(d);
      const e = endOfMonthIST(d);
      setStartDate(s); setEndDate(e);
    } else if (filterType === "yearly") {
      setStartDate(`${selYear}-01-01`); setEndDate(`${selYear}-12-31`);
    }
  };

  const navigate = (dir: "prev" | "next") => {
    let y = selYear, m = selMonth;
    if (filterType === "monthly") {
      if (dir === "prev") { m--; if (m < 1) { m = 12; y--; } }
      else { m++; if (m > 12) { m = 1; y++; } }
      setSelYear(y); setSelMonth(m);
      const d = new Date(y, m - 1, 1);
      setStartDate(startOfMonthIST(d));
      setEndDate(endOfMonthIST(d));
    } else if (filterType === "yearly") {
      y = dir === "prev" ? y - 1 : y + 1;
      setSelYear(y);
      setStartDate(`${y}-01-01`); setEndDate(`${y}-12-31`);
    }
  };

  const openClientLedger = async (client: CLRow) => {
    setLedgerLoading(true);
    setSelectedClient({ id: client.client_id, name: client.customer_name, opening_balance: client.opening_balance });
    setShowLedgerModal(true);
    setDetailedLedger([]);

    try {
      const from = `${startDate}T00:00:00`;
      const entries: LedgerEntry[] = [];
      let running = client.opening_balance;

      const { data: txns } = await supabase
        .from("transaction_list").select("id, job_id, code, amount, date_created, status")
        .eq("client_name", client.client_id).in("status", [3, 5]).order("date_created", { ascending: true });

      const { data: pmts } = await supabase
        .from("client_payments").select("id, amount, discount, payment_date, payment_method")
        .eq("client_id", client.client_id).order("payment_date", { ascending: true });

      if (client.opening_balance !== 0) {
        entries.push({
          event_date: "Opening", description: "Opening Balance",
          debit: client.opening_balance > 0 ? client.opening_balance : 0,
          credit: client.opening_balance < 0 ? Math.abs(client.opening_balance) : 0,
          balance: client.opening_balance,
        });
        running = client.opening_balance;
      }

      for (const t of txns || []) {
        if (t.date_created >= from) {
          running += t.amount || 0;
          entries.push({
            event_date: new Date(t.date_created).toLocaleDateString("en-IN"),
            description: `Job #${t.job_id} — ${t.code || ""}`,
            debit: t.amount || 0, credit: 0, balance: running,
          });
        }
      }

      for (const p of pmts || []) {
        if (p.payment_date >= startDate && p.payment_date <= endDate) {
          const amt = (p.amount || 0) + (p.discount || 0);
          running -= amt;
          entries.push({
            event_date: new Date(p.payment_date).toLocaleDateString("en-IN"),
            description: `Payment — ${p.payment_method || "N/A"}`,
            debit: 0, credit: amt, balance: running,
          });
        }
      }

      setDetailedLedger(entries);
    } catch (e) { console.error(e); }
    finally { setLedgerLoading(false); }
  };

  const totalRepairIncome = incomeSummary.find((i) => i.description.includes("रिपेयर"))?.amount || 0;
  const totalDirectSales = incomeSummary.find((i) => i.description.includes("सीधी"))?.amount || 0;
  const totalIncome = totalRepairIncome + totalDirectSales;
  const totalExpenses = expenseSummary.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  const totalStockValue = stockInventory.reduce((s, r) => s + r.stock_value, 0);
  const totalMechBalance = mechanicLedger.reduce((s, m) => s + m.balance_amount, 0);
  const totalLoanBalance = loanLedger.reduce((s, l) => s + l.balance_amount, 0);

  const TABS = [
    { id: "customer", label: "ग्राहक लेजर", icon: <Users size={13} /> },
    { id: "mechanic", label: "मैकेनिक लेजर", icon: <Wrench size={13} /> },
    { id: "inventory", label: "स्टॉक", icon: <Package size={13} /> },
    { id: "income", label: "आय", icon: <TrendingUp size={13} /> },
    { id: "expense", label: "व्यय", icon: <TrendingDown size={13} /> },
    { id: "top_customers", label: "शीर्ष ग्राहक", icon: <BarChart2 size={13} /> },
    { id: "loan", label: "लोन लेजर", icon: <Banknote size={13} /> },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white">व्यापार बैलेंस शीट</h1>
          <p className="text-xs text-slate-500 mt-0.5">Business Balance Sheet — {startDate} से {endDate}</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-[#161b27] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:border-blue-500/40 transition-all">
          <Printer size={13} /> Print
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest mb-1">कुल आय</p>
          <p className="text-lg font-black text-emerald-400">{inr(totalIncome)}</p>
          <p className="text-[9px] text-slate-600 mt-1">रिपेयर + सीधी बिक्री</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest mb-1">कुल व्यय</p>
          <p className="text-lg font-black text-red-400">{inr(totalExpenses)}</p>
          <p className="text-[9px] text-slate-600 mt-1">सभी खर्च</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest mb-1">शुद्ध लाभ</p>
          <p className={`text-lg font-black ${netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{inr(netProfit)}</p>
          <p className="text-[9px] text-slate-600 mt-1">आय - व्यय</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest mb-1">स्टॉक मूल्य</p>
          <p className="text-lg font-black text-blue-400">{inr(totalStockValue)}</p>
          <p className="text-[9px] text-slate-600 mt-1">कुल स्टॉक वैल्यू</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">फिल्टर</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50">
              <option value="monthly">मासिक</option>
              <option value="yearly">वार्षिक</option>
              <option value="custom">कस्टम</option>
            </select>
          </div>

          {filterType !== "custom" && (
            <>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">वर्ष</label>
                <input type="number" value={selYear} onChange={(e) => setSelYear(parseInt(e.target.value))} min={2020} max={currentYear + 1}
                  className="w-24 px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50" />
              </div>
              {filterType === "monthly" && (
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">महीना</label>
                  <select value={selMonth} onChange={(e) => setSelMonth(parseInt(e.target.value))}
                    className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString("en", { month: "long" })}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {filterType === "custom" && (
            <>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">शुरू</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">अंत</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50" />
              </div>
            </>
          )}

          <button onClick={applyFilter}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition-all">
            लागू करें
          </button>

          <button onClick={() => navigate("prev")}
            className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-slate-400 hover:text-white hover:border-blue-500/40 transition-all">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => navigate("next")}
            className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-slate-400 hover:text-white hover:border-blue-500/40 transition-all">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="flex flex-wrap gap-1 p-2 border-b border-[#21293d]">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === t.id ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]"
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-blue-400" />
            </div>
          ) : err ? (
            <div className="text-center py-12 text-red-400 font-bold">{err}</div>
          ) : (
            <>
              {/* ── Customer Ledger ── */}
              {activeTab === "customer" && (
                <div>
                  <TableHeader cols={["ग्राहक नाम", "संपर्क", "पिछला बैलेंस", "मरम्मत राशि", "भुगतान", "वर्तमान बैलेंस", "क्रिया"]} />
                  {customerLedger.length === 0 ? (
                    <EmptyState msg="कोई ग्राहक लेनदेन नहीं" />
                  ) : (
                    <>
                      {customerLedger.map((c) => (
                        <tr key={c.client_id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                          <td className="px-3 py-2.5">
                            <span className="text-sm font-bold text-slate-200">{c.customer_name}</span>
                            <div className="text-[10px] text-slate-600 mt-0.5">{c.total_jobs} job(s)</div>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-400">{c.contact || "—"}</td>
                          <td className={`px-3 py-2.5 text-xs text-right font-bold ${c.opening_balance >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(c.opening_balance)}</td>
                          <td className="px-3 py-2.5 text-xs text-right font-bold text-emerald-400">{inr(c.total_repair_amount)}</td>
                          <td className="px-3 py-2.5 text-xs text-right font-bold text-teal-400">{inr(c.total_payment)}</td>
                          <td className={`px-3 py-2.5 text-xs text-right font-bold ${c.current_balance >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(c.current_balance)}</td>
                          <td className="px-3 py-2.5">
                            <button onClick={() => openClientLedger(c)}
                              className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-[10px] font-bold hover:bg-blue-500/30 transition-all">
                              <Eye size={10} className="inline mr-1" /> विवरण
                            </button>
                          </td>
                        </tr>
                      ))}
                      <CustomerLedgerFooter rows={customerLedger} />
                    </>
                  )}
                </div>
              )}

              {/* ── Mechanic Ledger ── */}
              {activeTab === "mechanic" && (
                <div>
                  <TableHeader cols={["मैकेनिक नाम", "दिन काम", "कुल वेतन", "कुल अग्रिम", "बैलेंस"]} />
                  {mechanicLedger.length === 0 ? (
                    <EmptyState msg="कोई डेटा नहीं" />
                  ) : (
                    <>
                      {mechanicLedger.map((m) => (
                        <tr key={m.mechanic_id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                          <td className="px-3 py-2.5 text-sm font-bold text-slate-200">{m.mechanic_name}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-400 text-center">
                            <span className="text-emerald-400">{m.days_worked_in_period}</span> दिन
                          </td>
                          <td className="px-3 py-2.5 text-xs text-right font-bold text-emerald-400">{inr(m.salary_due_in_period)}</td>
                          <td className="px-3 py-2.5 text-xs text-right font-bold text-red-400">{inr(m.advance_in_period)}</td>
                          <td className={`px-3 py-2.5 text-xs text-right font-bold ${m.balance_amount >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(m.balance_amount)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* ── Stock Inventory ── */}
              {activeTab === "inventory" && (
                <div>
                  <TableHeader cols={["प्रोडक्ट", "स्टॉक इन", "बिका", "शेष", "वैल्यू"]} />
                  {stockInventory.length === 0 ? (
                    <EmptyState msg="कोई स्टॉक डेटा नहीं" />
                  ) : (
                    <>
                      {stockInventory.map((s) => (
                        <tr key={s.product_id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                          <td className="px-3 py-2.5">
                            <span className="text-sm font-bold text-slate-200">{s.product_name}</span>
                            <div className="text-[10px] text-slate-600">{s.description}</div>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-right text-slate-400">{s.total_stock_in}</td>
                          <td className="px-3 py-2.5 text-xs text-right text-slate-400">{s.sold_quantity}</td>
                          <td className={`px-3 py-2.5 text-xs text-right font-bold ${s.remaining_stock <= 0 ? "text-red-400" : s.remaining_stock <= 5 ? "text-amber-400" : "text-emerald-400"}`}>{s.remaining_stock}</td>
                          <td className="px-3 py-2.5 text-xs text-right font-bold text-blue-400">{inr(s.stock_value)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* ── Income Summary ── */}
              {activeTab === "income" && (
                <div>
                  <TableHeader cols={["विवरण", "राशि"]} />
                  {incomeSummary.map((i) => (
                    <tr key={i.description} className="border-t border-[#21293d]/50">
                      <td className="px-3 py-3 text-sm font-bold text-slate-200">{i.description}</td>
                      <td className="px-3 py-3 text-sm text-right font-black text-emerald-400">{inr(i.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#21293d]">
                    <td className="px-3 py-3 text-sm font-black text-white">कुल आय</td>
                    <td className="px-3 py-3 text-sm text-right font-black text-emerald-400">{inr(totalIncome)}</td>
                  </tr>
                </div>
              )}

              {/* ── Expense Summary ── */}
              {activeTab === "expense" && (
                <div>
                  <TableHeader cols={["श्रेणी", "राशि"]} />
                  {expenseSummary.length === 0 ? (
                    <EmptyState msg="कोई खर्च नहीं" />
                  ) : (
                    <>
                      {expenseSummary.map((e) => (
                        <tr key={e.expense_category} className="border-t border-[#21293d]/50">
                          <td className="px-3 py-3 text-sm font-bold text-slate-200">{e.expense_category}</td>
                          <td className="px-3 py-3 text-sm text-right font-black text-red-400">{inr(e.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-[#21293d]">
                        <td className="px-3 py-3 text-sm font-black text-white">कुल व्यय</td>
                        <td className="px-3 py-3 text-sm text-right font-black text-red-400">{inr(totalExpenses)}</td>
                      </tr>
                    </>
                  )}
                </div>
              )}

              {/* ── Top Customers ── */}
              {activeTab === "top_customers" && (
                <div>
                  <TableHeader cols={["ग्राहक", "संपर्क", "जॉब्स", "कुल राशि", "भुगतान", "बैलेंस"]} />
                  {topCustomers.length === 0 ? (
                    <EmptyState msg="कोई डेटा नहीं" />
                  ) : (
                    <>
                      {topCustomers.map((c) => (
                        <tr key={c.client_id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                          <td className="px-3 py-2.5 text-sm font-bold text-slate-200">{c.customer_name}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-400">{c.contact || "—"}</td>
                          <td className="px-3 py-2.5 text-xs text-center text-slate-400">{c.total_jobs}</td>
                          <td className="px-3 py-2.5 text-xs text-right font-bold text-emerald-400">{inr(c.total_amount)}</td>
                          <td className="px-3 py-2.5 text-xs text-right font-bold text-teal-400">{inr(c.total_payment_amount)}</td>
                          <td className={`px-3 py-2.5 text-xs text-right font-bold ${c.current_balance >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(c.current_balance)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* ── Loan Ledger ── */}
              {activeTab === "loan" && (
                <div>
                  <TableHeader cols={["लेंडर", "कुल लोन", "इस अवधि में भुगतान", "बैलेंस", "स्थिति"]} />
                  {loanLedger.length === 0 ? (
                    <EmptyState msg="कोई लोन डेटा नहीं" />
                  ) : (
                    <>
                      {loanLedger.map((l) => (
                        <tr key={l.lender_id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                          <td className="px-3 py-2.5 text-sm font-bold text-slate-200">{l.lender_name}</td>
                          <td className="px-3 py-2.5 text-xs text-right text-slate-400">{inr(l.loan_amount)}</td>
                          <td className="px-3 py-2.5 text-xs text-right font-bold text-emerald-400">{inr(l.paid_in_period)}</td>
                          <td className={`px-3 py-2.5 text-xs text-right font-bold ${l.balance_amount > 0 ? "text-red-400" : "text-emerald-400"}`}>{inr(l.balance_amount)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${l.status === "सक्रिय" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"}`}>{l.status}</span>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detailed Client Ledger Modal */}
      {showLedgerModal && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#21293d]">
              <div>
                <h3 className="font-black text-white text-sm">{selectedClient.name} — Ledger</h3>
                <p className="text-[10px] text-slate-500">Opening: {inr(selectedClient.opening_balance)}</p>
              </div>
              <button onClick={() => setShowLedgerModal(false)} className="w-8 h-8 flex items-center justify-center bg-[#111520] hover:bg-[#21293d] rounded-lg text-slate-500 hover:text-white transition-all">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <TableHeader cols={["तारीख", "विवरण", "डेबिट", "क्रेडिट", "बैलेंस"]} />
              {ledgerLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-blue-400" /></div>
              ) : detailedLedger.length === 0 ? (
                <EmptyState msg="कोई एंट्री नहीं" />
              ) : (
                detailedLedger.map((e, i) => (
                  <tr key={i} className="border-t border-[#21293d]/50">
                    <td className="px-3 py-2 text-xs text-slate-400">{e.event_date}</td>
                    <td className="px-3 py-2 text-xs text-slate-200">{e.description}</td>
                    <td className="px-3 py-2 text-xs text-right text-emerald-400">{e.debit > 0 ? inr(e.debit) : ""}</td>
                    <td className="px-3 py-2 text-xs text-right text-teal-400">{e.credit > 0 ? inr(e.credit) : ""}</td>
                    <td className={`px-3 py-2 text-xs text-right font-bold ${e.balance >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(e.balance)}</td>
                  </tr>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function TableHeader({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="bg-[#111520]">
        {cols.map((c) => (
          <th key={c} className="px-3 py-2 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left">{c}</th>
        ))}
      </tr>
    </thead>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <tbody>
      <tr>
        <td colSpan={10} className="px-3 py-12 text-center text-slate-600 text-xs font-bold">{msg}</td>
      </tr>
    </tbody>
  );
}

function CustomerLedgerFooter({ rows }: { rows: CLRow[] }) {
  const totOB = rows.reduce((s, r) => s + r.opening_balance, 0);
  const totRep = rows.reduce((s, r) => s + r.total_repair_amount, 0);
  const totPay = rows.reduce((s, r) => s + r.total_payment, 0);
  const totBal = rows.reduce((s, r) => s + r.current_balance, 0);
  return (
    <tfoot>
      <tr className="border-t-2 border-blue-500/30 bg-blue-500/5">
        <td className="px-3 py-2.5 text-xs font-black text-blue-400">कुल ({rows.length})</td>
        <td className="px-3 py-2.5" />
        <td className={`px-3 py-2.5 text-xs text-right font-black ${totOB >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(totOB)}</td>
        <td className="px-3 py-2.5 text-xs text-right font-black text-emerald-400">{inr(totRep)}</td>
        <td className="px-3 py-2.5 text-xs text-right font-black text-teal-400">{inr(totPay)}</td>
        <td className={`px-3 py-2.5 text-xs text-right font-black ${totBal >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(totBal)}</td>
        <td />
      </tr>
    </tfoot>
  );
}

export default function BalanceSheetPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin text-blue-400" /></div>}>
      <BalanceSheetContent />
    </Suspense>
  );
}
