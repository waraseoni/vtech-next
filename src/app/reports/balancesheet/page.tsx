"use client";
import { useState, useEffect, useCallback, Suspense, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Users,
  Wrench,
  Package,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Banknote,
  Printer,
  Eye,
  RefreshCw,
  TrendingUp as Up,
  TrendingDown as Down,
  Scale,
  Download,
  Wallet,
  CreditCard,
} from "lucide-react";
import { todayIST, startOfMonthIST, endOfMonthIST, formatIST } from "@/lib/dateUtils";
import {
  buildBalanceSheet,
  type CashFlow,
  type DetailTab,
  type StatementRow,
} from "@/lib/balance-sheet";

const inr = (n: number) => {
  const v = n || 0;
  const digits = Math.abs(v).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${v < 0 ? "-₹" : "₹"}${digits}`;
};

const fmtAmount = (n: number) => (n === 0 ? "—" : inr(n));

type CLRow = {
  client_id: number;
  customer_name: string;
  contact: string | null;
  opening_balance: number;
  total_repair_amount: number;
  total_sales: number;
  total_payment: number;
  total_discount: number;
  current_balance: number;
  previous_transactions: number;
  total_jobs: number;
};

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
  total_commission: number;
  period_commission: number;
  balance_amount: number;
};

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

type IncomeRow = { description: string; amount: number };
type ExpenseRow = { expense_category: string | null; amount: number };

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

type ClientLoanRow = {
  loan_id: number;
  client_id: number;
  client_name: string;
  loan_date: string;
  principal_amount: number;
  total_payable: number;
  emi_amount: number;
  paid: number;
  paid_in_period: number;
  outstanding: number;
  status: number;
};

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

type PeriodSummary = {
  from: string;
  to: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
};

type Summary = {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  totalStockValue: number;
  totalMechBalance: number;
  totalLoanBalance: number;
  salaryEarned: number;
  commissionExpense: number;
  shopExpense: number;
  emiExpense: number;
  discountGiven: number;
  repairIncome: number;
  directSalesIncome: number;
  cashReceived: number;
  clientLoansGiven: number;
  clientLoanPrincipalGiven: number;
  purchasePayments: number;
  cashBalance: number;
  previous: PeriodSummary | null;
};

type FilterType = "monthly" | "yearly" | "custom";

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
  const [asOnDate, setAsOnDate] = useState("");
  const [activeTab, setActiveTab] = useState("customer");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [mobileOpen, setMobileOpen] = useState({ assets: true, liabilities: true });

  const [customerLedger, setCustomerLedger] = useState<CLRow[]>([]);
  const [mechanicLedger, setMechanicLedger] = useState<MLRow[]>([]);
  const [stockInventory, setStockInventory] = useState<StockRow[]>([]);
  const [incomeSummary, setIncomeSummary] = useState<IncomeRow[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseRow[]>([]);
  const [loanLedger, setLoanLedger] = useState<LoanRow[]>([]);
  const [clientLoanLedger, setClientLoanLedger] = useState<ClientLoanRow[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlow | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setErr("");
      try {
        const params = new URLSearchParams({ from: startDate, to: endDate });
        if (asOnDate) params.set("asOn", asOnDate);
        const res = await fetch(`/api/reports/balancesheet?${params}`);
        if (!res.ok) throw new Error("Failed to fetch data");
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setCustomerLedger(data.customerLedger || []);
        setMechanicLedger(data.mechanicLedger || []);
        setStockInventory(data.stockInventory || []);
        setIncomeSummary(data.incomeSummary || []);
        setExpenseSummary(data.expenseSummary || []);
        setLoanLedger(data.loanLedger || []);
        setClientLoanLedger(data.clientLoanLedger || []);
        setTopCustomers(data.topCustomers || []);
        setCashFlow(data.cashFlow || null);
        setSummary(data.summary || null);
      } catch (e) {
        setErr(e instanceof Error ? e.message || "Failed to load data" : String(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [startDate, endDate, asOnDate]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      setAsOnDate("");
      let y = yr || selYear;
      let m = mo || selMonth;
      if (filterType === "monthly") {
        if (nav === "prev") {
          m--;
          if (m < 1) {
            m = 12;
            y--;
          }
        } else {
          m++;
          if (m > 12) {
            m = 1;
            y++;
          }
        }
        setSelYear(y);
        setSelMonth(m);
        const d = new Date(y, m - 1, 1);
        setStartDate(startOfMonthIST(d));
        setEndDate(endOfMonthIST(d));
      } else if (filterType === "yearly") {
        y = nav === "prev" ? y - 1 : y + 1;
        setSelYear(y);
        setStartDate(`${y}-01-01`);
        setEndDate(`${y}-12-31`);
      }
    }
  }, [searchParams, filterType, selYear, selMonth]);

  const applyFilter = () => {
    setAsOnDate("");
    if (filterType === "monthly") {
      const d = new Date(selYear, selMonth - 1, 1);
      setStartDate(startOfMonthIST(d));
      setEndDate(endOfMonthIST(d));
    } else if (filterType === "yearly") {
      setStartDate(`${selYear}-01-01`);
      setEndDate(`${selYear}-12-31`);
    }
  };

  const navigate = (dir: "prev" | "next") => {
    setAsOnDate("");
    let y = selYear,
      m = selMonth;
    if (filterType === "monthly") {
      if (dir === "prev") {
        m--;
        if (m < 1) {
          m = 12;
          y--;
        }
      } else {
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
      setSelYear(y);
      setSelMonth(m);
      const d = new Date(y, m - 1, 1);
      setStartDate(startOfMonthIST(d));
      setEndDate(endOfMonthIST(d));
    } else if (filterType === "yearly") {
      y = dir === "prev" ? y - 1 : y + 1;
      setSelYear(y);
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-12-31`);
    }
  };

  const totals = useMemo(
    () => ({
      totOB: customerLedger.reduce((s, r) => s + r.opening_balance, 0),
      totRep: customerLedger.reduce((s, r) => s + r.total_repair_amount, 0),
      totPay: customerLedger.reduce((s, r) => s + r.total_payment, 0),
      totBal: customerLedger.reduce((s, r) => s + r.current_balance, 0),
    }),
    [customerLedger]
  );

  const statement = useMemo(
    () =>
      buildBalanceSheet({
        customers: customerLedger,
        mechanics: mechanicLedger,
        loans: loanLedger,
        stock: stockInventory,
        cash: cashFlow?.balance ?? 0,
        clientLoans: clientLoanLedger,
      }),
    [customerLedger, mechanicLedger, loanLedger, stockInventory, cashFlow, clientLoanLedger]
  );

  const detailRef = useRef<HTMLDivElement>(null);
  const drillDown = (tab: DetailTab) => {
    setActiveTab(tab);
    requestAnimationFrame(() =>
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  const dayLabel = (day: string) => {
    if (!day) return "—";
    const d = new Date(`${day}T00:00:00+05:30`);
    return Number.isNaN(d.getTime())
      ? "—"
      : formatIST(d, { day: "2-digit", month: "short", year: "numeric" });
  };
  const effectiveAsOn = asOnDate || endDate;
  const asOnLabel = dayLabel(effectiveAsOn);

  const prevDelta =
    summary?.previous != null ? summary.netProfit - summary.previous.netProfit : null;

  const monthName = new Date(selYear, selMonth - 1, 1).toLocaleString("en", { month: "long" });
  const filterLabel =
    filterType === "monthly"
      ? `${monthName} ${selYear}`
      : filterType === "yearly"
        ? `${selYear}`
        : `${startDate} से ${endDate}`;

  const exportCsv = () => {
    const lines: (string | number)[][] = [];
    lines.push(["व्यापार चिट्ठा", `स्थिति ${asOnLabel}`, `अवधि ${filterLabel}`], []);
    lines.push(["संपत्ति", "राशि"]);
    statement.assets.forEach((r) => lines.push([r.label, r.amount]));
    lines.push(["कुल संपत्ति", statement.totalAssets], []);
    lines.push(["देनदारी", "राशि"]);
    statement.liabilities.forEach((r) => lines.push([r.label, r.amount]));
    lines.push(
      ["कुल देनदारी", statement.totalLiabilities],
      ["पूंजी (शुद्ध मूल्य)", statement.capital],
      ["कुल (देनदारी + पूंजी)", statement.totalLiabilities + statement.capital],
      []
    );
    lines.push(
      ["लाभ-हानि (अवधि)", ""],
      ["आय", summary?.totalIncome ?? 0],
      ["व्यय", summary?.totalExpenses ?? 0],
      ["शुद्ध लाभ", summary?.netProfit ?? 0]
    );
    if (summary?.previous) {
      const p = summary.previous;
      lines.push(
        [`पिछली अवधि (${dayLabel(p.from)} – ${dayLabel(p.to)})`, ""],
        ["आय", p.totalIncome],
        ["व्यय", p.totalExpenses],
        ["शुद्ध लाभ", p.netProfit]
      );
    }
    lines.push([], ["नकद/बैंक (अनुमानित)", ""]);
    cashFlow?.inflow.forEach((r) => lines.push([`जमा — ${r.label}`, r.amount]));
    lines.push(["कुल जमा", cashFlow?.totalInflow ?? 0]);
    cashFlow?.outflow.forEach((r) => lines.push([`खर्च — ${r.label}`, r.amount]));
    lines.push(["कुल खर्च", cashFlow?.totalOutflow ?? 0], ["शेष", cashFlow?.balance ?? 0], []);
    lines.push(["ग्राहक लेजर"], ["ग्राहक", "पिछला", "मरम्मत", "बिक्री", "भुगतान", "बैलेंस"]);
    customerLedger.forEach((c) =>
      lines.push([
        c.customer_name,
        c.opening_balance,
        c.total_repair_amount,
        c.total_sales,
        c.total_payment,
        c.current_balance,
      ])
    );
    lines.push([], ["मैकेनिक लेजर"], ["मैकेनिक", "वेतन", "कमीशन", "अग्रिम", "बकाया"]);
    mechanicLedger.forEach((m) =>
      lines.push([
        m.mechanic_name,
        m.salary_due_in_period,
        m.period_commission,
        m.advance_in_period,
        m.balance_amount,
      ])
    );
    lines.push([], ["क्लाइंट लोन (दिए गए)"], ["ग्राहक", "तारीख", "कुल देय", "जमा", "बकाया"]);
    clientLoanLedger.forEach((l) =>
      lines.push([l.client_name, l.loan_date, l.total_payable, l.paid, l.outstanding])
    );
    lines.push([], ["स्टॉक"], ["प्रोडक्ट", "स्टॉक इन", "बिका", "शेष", "मूल्य"]);
    stockInventory.forEach((s) =>
      lines.push([
        s.product_name,
        s.total_stock_in,
        s.sold_quantity,
        s.remaining_stock,
        s.stock_value,
      ])
    );
    lines.push([], ["आय"], ["विवरण", "राशि"]);
    incomeSummary.forEach((i) => lines.push([i.description, i.amount]));
    lines.push([], ["व्यय"], ["श्रेणी", "राशि"]);
    expenseSummary.forEach((e) => lines.push([e.expense_category || "अन्य", e.amount]));
    lines.push([], ["लेंडर लोन"], ["लेंडर", "लोन", "चुकाया", "बकाया"]);
    loanLedger.forEach((l) =>
      lines.push([l.lender_name, l.loan_amount, l.total_paid, l.balance_amount])
    );

    const csvCell = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = "\uFEFF" + lines.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chittha-${effectiveAsOn}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-white">व्यापार चिट्ठा</h1>
          <p className="text-xs text-muted mt-0.5">
            चिट्ठा स्थिति: <span className="font-bold text-app-2">{asOnLabel}</span>
            <span className="mx-1.5 text-muted-2">·</span>
            अवधि: {filterLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-panel border border-app rounded-xl text-xs font-bold text-muted hover:text-white hover:border-blue-500/40 transition-all"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-3 py-2 bg-panel border border-app rounded-xl text-xs font-bold text-muted hover:text-white hover:border-blue-500/40 transition-all"
          >
            <Download size={13} /> CSV
          </button>
          <button
            onClick={() =>
              window.open(
                `/api/print-balancesheet?from=${startDate}&to=${endDate}&asOn=${effectiveAsOn}`,
                "_blank"
              )
            }
            className="flex items-center gap-2 px-4 py-2 bg-panel border border-app rounded-xl text-xs font-bold text-muted hover:text-white hover:border-blue-500/40 transition-all"
          >
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard
          label="कुल संपत्ति"
          value={statement.totalAssets}
          color="emerald"
          icon={<Package size={14} />}
        />
        <MetricCard
          label="कुल देनदारी"
          value={statement.totalLiabilities}
          color="amber"
          icon={<Banknote size={14} />}
        />
        <MetricCard
          label="पूंजी (शुद्ध मूल्य)"
          value={statement.capital}
          color={statement.capital >= 0 ? "blue" : "red"}
          icon={<TrendingUp size={14} />}
        />
        <MetricCard
          label="शुद्ध लाभ (अवधि)"
          value={summary?.netProfit ?? 0}
          color={(summary?.netProfit ?? 0) >= 0 ? "emerald" : "red"}
          icon={(summary?.netProfit ?? 0) >= 0 ? <Up size={14} /> : <Down size={14} />}
        />
      </div>

      <div className="bg-panel border border-app rounded-2xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] font-black uppercase text-muted-2 tracking-widest block mb-1">
              अवधि
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="px-3 py-2 bg-panel-2 border border-app rounded-xl text-xs font-bold text-app-2 outline-none focus:border-blue-500/50"
            >
              <option value="monthly">मासिक</option>
              <option value="yearly">वार्षिक</option>
              <option value="custom">कस्टम</option>
            </select>
          </div>

          {filterType !== "custom" && (
            <>
              <div>
                <label className="text-[10px] font-black uppercase text-muted-2 tracking-widest block mb-1">
                  वर्ष
                </label>
                <input
                  type="number"
                  value={selYear}
                  onChange={(e) => setSelYear(parseInt(e.target.value))}
                  min={2020}
                  max={currentYear + 1}
                  className="w-24 px-3 py-2 bg-panel-2 border border-app rounded-xl text-xs font-bold text-app-2 outline-none focus:border-blue-500/50"
                />
              </div>
              {filterType === "monthly" && (
                <div>
                  <label className="text-[10px] font-black uppercase text-muted-2 tracking-widest block mb-1">
                    महीना
                  </label>
                  <select
                    value={selMonth}
                    onChange={(e) => setSelMonth(parseInt(e.target.value))}
                    className="px-3 py-2 bg-panel-2 border border-app rounded-xl text-xs font-bold text-app-2 outline-none focus:border-blue-500/50"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {new Date(2000, m - 1, 1).toLocaleString("en", { month: "long" })}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {filterType === "custom" && (
            <>
              <div>
                <label className="text-[10px] font-black uppercase text-muted-2 tracking-widest block mb-1">
                  शुरू
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 bg-panel-2 border border-app rounded-xl text-xs font-bold text-app-2 outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-muted-2 tracking-widest block mb-1">
                  अंत
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 bg-panel-2 border border-app rounded-xl text-xs font-bold text-app-2 outline-none focus:border-blue-500/50"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-[10px] font-black uppercase text-muted-2 tracking-widest block mb-1">
              स्थिति तिथि (as on)
            </label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={asOnDate || endDate}
                onChange={(e) => setAsOnDate(e.target.value)}
                className="px-3 py-2 bg-panel-2 border border-app rounded-xl text-xs font-bold text-app-2 outline-none focus:border-blue-500/50"
              />
              {asOnDate && (
                <button
                  onClick={() => setAsOnDate("")}
                  className="px-2 py-2 text-[10px] font-bold text-muted hover:text-app-2"
                  title="अवधि के अंतिम दिन पर वापस"
                >
                  रीसेट
                </button>
              )}
            </div>
          </div>

          <button
            onClick={applyFilter}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition-all"
          >
            लागू करें
          </button>

          <button
            onClick={() => navigate("prev")}
            className="px-3 py-2 bg-panel-2 border border-app rounded-xl text-muted hover:text-white hover:border-blue-500/40 transition-all"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => navigate("next")}
            className="px-3 py-2 bg-panel-2 border border-app rounded-xl text-muted hover:text-white hover:border-blue-500/40 transition-all"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <p className="mt-2 text-[10px] text-muted-2 leading-relaxed">
          अवधि आय-व्यय (P&amp;L) के लिए है; चिट्ठा{" "}
          <span className="font-bold text-muted">{asOnLabel}</span> तक की स्थिति दिखाता है। स्थिति
          तिथि बदलने पर चिट्ठा उसी तारीख तक बनेगा।
        </p>
      </div>

      <div className="bg-panel border border-app rounded-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-app">
          <div className="flex items-center gap-2">
            <Scale size={14} className="text-blue-400" />
            <h2 className="text-sm font-black text-white">चिट्ठा — {asOnLabel} तक</h2>
          </div>
          <span className="text-[10px] font-bold text-muted-2">
            किसी पंक्ति पर क्लिक करें → नीचे विवरण
          </span>
        </div>
        <div className="grid lg:grid-cols-2">
          <div className="p-4 lg:border-r border-app">
            <button
              type="button"
              onClick={() => setMobileOpen((s) => ({ ...s, assets: !s.assets }))}
              className="mb-1 flex w-full items-center justify-between gap-2 text-left lg:pointer-events-none"
            >
              <span className="flex items-center gap-1.5">
                <ChevronDown
                  size={13}
                  className={`text-muted-2 transition-transform lg:hidden ${mobileOpen.assets ? "" : "-rotate-90"}`}
                />
                <h3 className="text-xs font-black text-emerald-400">संपत्ति</h3>
                <span className="hidden text-[10px] font-bold uppercase tracking-widest text-muted-2 lg:inline">
                  Assets
                </span>
              </span>
              <span className="text-xs font-black tabular-nums text-emerald-400 lg:hidden">
                {inr(statement.totalAssets)}
              </span>
            </button>
            <div className={mobileOpen.assets ? "" : "hidden lg:block"}>
              {statement.assets.map((row) => (
                <StatementRowButton
                  key={row.key}
                  row={row}
                  tone="emerald"
                  onClick={() => drillDown(row.tab)}
                />
              ))}
              <div className="mt-2 flex items-center justify-between border-t-[3px] border-double border-app pt-2 text-xs font-black text-white">
                <span>कुल संपत्ति</span>
                <span className="tabular-nums text-emerald-400">{inr(statement.totalAssets)}</span>
              </div>
            </div>
          </div>
          <div className="p-4 border-t lg:border-t-0 border-app">
            <button
              type="button"
              onClick={() => setMobileOpen((s) => ({ ...s, liabilities: !s.liabilities }))}
              className="mb-1 flex w-full items-center justify-between gap-2 text-left lg:pointer-events-none"
            >
              <span className="flex items-center gap-1.5">
                <ChevronDown
                  size={13}
                  className={`text-muted-2 transition-transform lg:hidden ${mobileOpen.liabilities ? "" : "-rotate-90"}`}
                />
                <h3 className="text-xs font-black text-app-2">देनदारी</h3>
                <span className="hidden text-[10px] font-bold uppercase tracking-widest text-muted-2 lg:inline">
                  Liabilities
                </span>
              </span>
              <span className="text-xs font-black tabular-nums text-white lg:hidden">
                {inr(statement.totalLiabilities + statement.capital)}
              </span>
            </button>
            <div className={mobileOpen.liabilities ? "" : "hidden lg:block"}>
              {statement.liabilities.map((row) => (
                <StatementRowButton
                  key={row.key}
                  row={row}
                  tone="neutral"
                  onClick={() => drillDown(row.tab)}
                />
              ))}
              <div className="mt-2 flex items-center justify-between text-xs font-bold text-app-2">
                <span>कुल देनदारी</span>
                <span className="tabular-nums">{inr(statement.totalLiabilities)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs font-bold text-blue-400">
                <span>पूंजी (शुद्ध मूल्य)</span>
                <span className="tabular-nums">{inr(statement.capital)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t-[3px] border-double border-app pt-2 text-xs font-black text-white">
                <span>कुल (देनदारी + पूंजी)</span>
                <span className="tabular-nums">
                  {inr(statement.totalLiabilities + statement.capital)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <p className="px-4 pb-3 text-[10px] leading-relaxed text-muted-2">
          संपत्ति = देनदारी + पूंजी · नकद/बैंक शेष अनुमानित है (owner capital/drawings और
          paid-purchase records इस अनुमान से बाहर हैं)।
        </p>
      </div>

      <div className="bg-panel border border-app rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={13} className="text-blue-400" />
            <span className="text-xs font-black text-white">इस अवधि का लाभ-हानि</span>
            <span className="text-[10px] text-muted-2">({filterLabel})</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
            <span className="text-muted">
              आय{" "}
              <span className="ml-1 tabular-nums text-emerald-400">
                {inr(summary?.totalIncome ?? 0)}
              </span>
            </span>
            <span className="text-muted">
              व्यय{" "}
              <span className="ml-1 tabular-nums text-app-2">
                {inr(summary?.totalExpenses ?? 0)}
              </span>
            </span>
            <span className="text-muted">
              शुद्ध लाभ{" "}
              <span
                className={`ml-1 tabular-nums ${
                  (summary?.netProfit ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {inr(summary?.netProfit ?? 0)}
              </span>
            </span>
          </div>
        </div>
        {summary?.previous && (
          <p className="mt-2 border-t border-app/50 pt-2 text-[10px] leading-relaxed text-muted-2">
            पिछली अवधि ({dayLabel(summary.previous.from)} – {dayLabel(summary.previous.to)}): आय{" "}
            <span className="tabular-nums text-muted">{inr(summary.previous.totalIncome)}</span> ·
            व्यय{" "}
            <span className="tabular-nums text-muted">{inr(summary.previous.totalExpenses)}</span> ·
            शुद्ध लाभ{" "}
            <span
              className={`tabular-nums ${
                summary.previous.netProfit >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {inr(summary.previous.netProfit)}
            </span>
            {prevDelta !== null && (
              <span
                className={`ml-1 font-bold ${prevDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                ({prevDelta >= 0 ? "सुधार" : "गिरावट"} {inr(Math.abs(prevDelta))})
              </span>
            )}
          </p>
        )}
      </div>

      <div
        ref={detailRef}
        className="bg-panel border border-app rounded-2xl overflow-hidden scroll-mt-20"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-app">
          <h2 className="text-sm font-black text-white">विवरण</h2>
          <span className="text-[10px] font-bold text-muted-2">
            चिट्ठे की पंक्ति चुनने पर यहीं विवरण खुलेगा
          </span>
        </div>
        <div className="flex flex-wrap gap-1 p-2 border-b border-app">
          {[
            { id: "customer", label: "ग्राहक लेजर", icon: <Users size={13} /> },
            { id: "mechanic", label: "मैकेनिक लेजर", icon: <Wrench size={13} /> },
            { id: "inventory", label: "स्टॉक", icon: <Package size={13} /> },
            { id: "client_loan", label: "क्लाइंट लोन", icon: <CreditCard size={13} /> },
            { id: "cash", label: "नकद/बैंक", icon: <Wallet size={13} /> },
            { id: "income", label: "आय", icon: <TrendingUp size={13} /> },
            { id: "expense", label: "व्यय", icon: <TrendingDown size={13} /> },
            { id: "top_customers", label: "शीर्ष ग्राहक", icon: <BarChart2 size={13} /> },
            { id: "loan", label: "लोन लेजर", icon: <Banknote size={13} /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === t.id
                  ? "bg-blue-600 text-white"
                  : "text-muted hover:text-app-2 hover:bg-white/[0.04]"
              }`}
            >
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
              {activeTab === "customer" && <CustomerTab data={customerLedger} totals={totals} />}
              {activeTab === "mechanic" && <MechanicTab data={mechanicLedger} />}
              {activeTab === "inventory" && <InventoryTab data={stockInventory} />}
              {activeTab === "client_loan" && <ClientLoanTab data={clientLoanLedger} />}
              {activeTab === "cash" && <CashTab data={cashFlow} />}
              {activeTab === "income" && <IncomeTab data={incomeSummary} summary={summary} />}
              {activeTab === "expense" && <ExpenseTab data={expenseSummary} />}
              {activeTab === "top_customers" && <TopCustomersTab data={topCustomers} />}
              {activeTab === "loan" && <LoanTab data={loanLedger} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatementRowButton({
  row,
  tone,
  onClick,
}: {
  row: StatementRow;
  tone: "emerald" | "neutral";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-md border-b border-app/40 px-1 py-2 -mx-1 text-left transition-colors last:border-b-0 hover:bg-white/[0.03]"
    >
      <span className="flex items-center gap-1.5 text-xs font-bold text-app-2">
        {row.label}
        {row.count > 0 && (
          <span className="text-[10px] font-medium text-muted-2">({row.count})</span>
        )}
      </span>
      <span
        className={`text-xs font-bold tabular-nums ${
          row.amount === 0 ? "text-muted-2" : tone === "emerald" ? "text-emerald-400" : "text-app-2"
        }`}
      >
        {fmtAmount(row.amount)}
      </span>
    </button>
  );
}

function MetricCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400",
    red: "text-red-400",
    blue: "text-blue-400",
    amber: "text-amber-400",
    purple: "text-purple-400",
  };
  return (
    <div className="bg-panel border border-app rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase text-muted-2 tracking-widest">
          {label}
        </span>
        <div className="w-7 h-7 rounded-lg bg-panel-2 flex items-center justify-center text-muted">
          {icon}
        </div>
      </div>
      <p className={`text-lg font-black tabular-nums ${colorMap[color]}`}>{inr(value ?? 0)}</p>
    </div>
  );
}

function CustomerTab({
  data,
  totals,
}: {
  data: CLRow[];
  totals: { totOB: number; totRep: number; totPay: number; totBal: number };
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full tabular-nums">
        <thead>
          <tr className="bg-panel-2">
            {[
              "ग्राहक नाम",
              "संपर्क",
              "पिछला बैलेंस",
              "मरम्मत राशि",
              "भुगतान",
              "वर्तमान बैलेंस",
              "क्रिया",
            ].map((c) => (
              <th
                key={c}
                className="px-3 py-2.5 text-[10px] font-black uppercase text-muted-2 tracking-widest text-left whitespace-nowrap"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center py-12 text-muted-2 text-xs font-bold">
                कोई ग्राहक लेनदेन नहीं
              </td>
            </tr>
          ) : (
            <>
              {data.map((c) => (
                <tr
                  key={c.client_id}
                  className="border-t border-app/50 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <a
                      href={`/clients/${c.client_id}/view`}
                      target="_blank"
                      className="text-sm font-bold text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      {c.customer_name}
                    </a>
                    <div className="text-[10px] text-muted-2 mt-0.5">{c.total_jobs} job(s)</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted">{c.contact || "—"}</td>
                  <td
                    className={`px-3 py-2.5 text-xs text-right font-bold ${c.opening_balance >= 0 ? "text-blue-400" : "text-red-400"}`}
                  >
                    {inr(c.opening_balance)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-emerald-400">
                    {inr(c.total_repair_amount)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-teal-400">
                    {inr(c.total_payment)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-xs text-right font-bold ${c.current_balance >= 0 ? "text-blue-400" : "text-red-400"}`}
                  >
                    {inr(c.current_balance)}
                  </td>
                  <td className="px-3 py-2.5">
                    <a
                      href={`/clients/${c.client_id}/view`}
                      target="_blank"
                      className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-[10px] font-bold hover:bg-blue-500/30 transition-all"
                    >
                      <Eye size={10} className="inline mr-1" /> विवरण
                    </a>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-blue-500/30 bg-blue-500/5">
                <td className="px-3 py-2.5 text-xs font-black text-blue-400">
                  कुल ({data.length})
                </td>
                <td />
                <td
                  className={`px-3 py-2.5 text-xs text-right font-black ${totals.totOB >= 0 ? "text-blue-400" : "text-red-400"}`}
                >
                  {inr(totals.totOB)}
                </td>
                <td className="px-3 py-2.5 text-xs text-right font-black text-emerald-400">
                  {inr(totals.totRep)}
                </td>
                <td className="px-3 py-2.5 text-xs text-right font-black text-teal-400">
                  {inr(totals.totPay)}
                </td>
                <td
                  className={`px-3 py-2.5 text-xs text-right font-black ${totals.totBal >= 0 ? "text-blue-400" : "text-red-400"}`}
                >
                  {inr(totals.totBal)}
                </td>
                <td />
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MechanicTab({ data }: { data: MLRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full tabular-nums">
        <thead>
          <tr className="bg-panel-2">
            {["मैकेनिक नाम", "दिन काम", "कुल वेतन", "कुल अग्रिम", "बैलेंस"].map((c) => (
              <th
                key={c}
                className="px-3 py-2.5 text-[10px] font-black uppercase text-muted-2 tracking-widest text-left whitespace-nowrap"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-12 text-muted-2 text-xs font-bold">
                कोई डेटा नहीं
              </td>
            </tr>
          ) : (
            data.map((m) => (
              <tr
                key={m.mechanic_id}
                className="border-t border-app/50 hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-3 py-2.5 text-sm font-bold text-app-2">{m.mechanic_name}</td>
                <td className="px-3 py-2.5 text-xs text-muted text-center">
                  <span className="text-emerald-400">{m.days_worked_in_period}</span> दिन
                </td>
                <td className="px-3 py-2.5 text-xs text-right font-bold text-emerald-400">
                  {inr(m.salary_due_in_period)}
                </td>
                <td className="px-3 py-2.5 text-xs text-right font-bold text-app-2">
                  {inr(m.advance_in_period)}
                </td>
                <td
                  className={`px-3 py-2.5 text-xs text-right font-bold ${m.balance_amount >= 0 ? "text-blue-400" : "text-red-400"}`}
                >
                  {inr(m.balance_amount)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function InventoryTab({ data }: { data: StockRow[] }) {
  const totalValue = data.reduce((s, r) => s + r.stock_value, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full tabular-nums">
        <thead>
          <tr className="bg-panel-2">
            {["प्रोडक्ट", "स्टॉक इन", "बिका", "शेष", "वैल्यू"].map((c) => (
              <th
                key={c}
                className="px-3 py-2.5 text-[10px] font-black uppercase text-muted-2 tracking-widest text-left whitespace-nowrap"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-12 text-muted-2 text-xs font-bold">
                कोई स्टॉक डेटा नहीं
              </td>
            </tr>
          ) : (
            <>
              {data.map((s) => (
                <tr
                  key={s.product_id}
                  className="border-t border-app/50 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <span className="text-sm font-bold text-app-2">{s.product_name}</span>
                    <div className="text-[10px] text-muted-2">{s.description}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right text-muted">{s.total_stock_in}</td>
                  <td className="px-3 py-2.5 text-xs text-right text-muted">{s.sold_quantity}</td>
                  <td
                    className={`px-3 py-2.5 text-xs text-right font-bold ${s.remaining_stock <= 0 ? "text-red-400" : s.remaining_stock <= 5 ? "text-amber-400" : "text-emerald-400"}`}
                  >
                    {s.remaining_stock}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-blue-400">
                    {inr(s.stock_value)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-blue-500/30 bg-blue-500/5">
                <td className="px-3 py-2.5 text-xs font-black text-blue-400">
                  कुल ({data.length})
                </td>
                <td />
                <td />
                <td />
                <td className="px-3 py-2.5 text-xs text-right font-black text-blue-400">
                  {inr(totalValue)}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function IncomeTab({ data, summary }: { data: IncomeRow[]; summary: Summary | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full tabular-nums">
        <thead>
          <tr className="bg-panel-2">
            {["विवरण", "राशि"].map((c) => (
              <th
                key={c}
                className="px-3 py-2.5 text-[10px] font-black uppercase text-muted-2 tracking-widest text-left whitespace-nowrap"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((i) => (
            <tr key={i.description} className="border-t border-app/50">
              <td className="px-3 py-3 text-sm font-bold text-app-2">{i.description}</td>
              <td className="px-3 py-3 text-sm text-right font-black text-emerald-400">
                {inr(i.amount)}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-app">
            <td className="px-3 py-3 text-sm font-black text-white">कुल आय</td>
            <td className="px-3 py-3 text-sm text-right font-black text-emerald-400">
              {inr(summary?.totalIncome || 0)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ExpenseTab({ data }: { data: ExpenseRow[] }) {
  const total = data.reduce((s, e) => s + e.amount, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full tabular-nums">
        <thead>
          <tr className="bg-panel-2">
            {["श्रेणी", "राशि"].map((c) => (
              <th
                key={c}
                className="px-3 py-2.5 text-[10px] font-black uppercase text-muted-2 tracking-widest text-left whitespace-nowrap"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={2} className="text-center py-12 text-muted-2 text-xs font-bold">
                कोई खर्च नहीं
              </td>
            </tr>
          ) : (
            <>
              {data.map((e) => (
                <tr key={e.expense_category} className="border-t border-app/50">
                  <td className="px-3 py-3 text-sm font-bold text-app-2">{e.expense_category}</td>
                  <td className="px-3 py-3 text-sm text-right font-black text-app-2">
                    {inr(e.amount)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-app">
                <td className="px-3 py-3 text-sm font-black text-white">कुल व्यय</td>
                <td className="px-3 py-3 text-sm text-right font-black text-app-2">{inr(total)}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TopCustomersTab({ data }: { data: TopCustomer[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full tabular-nums">
        <thead>
          <tr className="bg-panel-2">
            {["ग्राहक", "संपर्क", "जॉब्स", "कुल राशि", "भुगतान", "बैलेंस"].map((c) => (
              <th
                key={c}
                className="px-3 py-2.5 text-[10px] font-black uppercase text-muted-2 tracking-widest text-left whitespace-nowrap"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-12 text-muted-2 text-xs font-bold">
                कोई डेटा नहीं
              </td>
            </tr>
          ) : (
            data.map((c) => (
              <tr
                key={c.client_id}
                className="border-t border-app/50 hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-3 py-2.5 text-sm font-bold text-app-2">{c.customer_name}</td>
                <td className="px-3 py-2.5 text-xs text-muted">{c.contact || "—"}</td>
                <td className="px-3 py-2.5 text-xs text-center text-muted">{c.total_jobs}</td>
                <td className="px-3 py-2.5 text-xs text-right font-bold text-emerald-400">
                  {inr(c.total_amount)}
                </td>
                <td className="px-3 py-2.5 text-xs text-right font-bold text-teal-400">
                  {inr(c.total_payment_amount)}
                </td>
                <td
                  className={`px-3 py-2.5 text-xs text-right font-bold ${c.current_balance >= 0 ? "text-blue-400" : "text-red-400"}`}
                >
                  {inr(c.current_balance)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function LoanTab({ data }: { data: LoanRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full tabular-nums">
        <thead>
          <tr className="bg-panel-2">
            {["लेंडर", "कुल लोन", "इस अवधि में भुगतान", "बकाया", "स्थिति"].map((c) => (
              <th
                key={c}
                className="px-3 py-2.5 text-[10px] font-black uppercase text-muted-2 tracking-widest text-left whitespace-nowrap"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-12 text-muted-2 text-xs font-bold">
                कोई लोन डेटा नहीं
              </td>
            </tr>
          ) : (
            data.map((l) => (
              <tr
                key={l.lender_id}
                className="border-t border-app/50 hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-3 py-2.5 text-sm font-bold text-app-2">{l.lender_name}</td>
                <td className="px-3 py-2.5 text-xs text-right text-muted">{inr(l.loan_amount)}</td>
                <td className="px-3 py-2.5 text-xs text-right font-bold text-emerald-400">
                  {inr(l.paid_in_period)}
                </td>
                <td
                  className={`px-3 py-2.5 text-xs text-right font-bold ${l.balance_amount > 0 ? "text-app-2" : "text-emerald-400"}`}
                >
                  {inr(l.balance_amount)}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg ${l.status === "सक्रिय" ? "bg-emerald-500/20 text-emerald-400" : "bg-muted/20 text-muted"}`}
                  >
                    {l.status}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ClientLoanTab({ data }: { data: ClientLoanRow[] }) {
  const totals = data.reduce(
    (s, l) => ({
      payable: s.payable + l.total_payable,
      paid: s.paid + l.paid,
      outstanding: s.outstanding + l.outstanding,
    }),
    { payable: 0, paid: 0, outstanding: 0 }
  );
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full tabular-nums">
          <thead>
            <tr className="bg-panel-2">
              {["ग्राहक", "तारीख", "मूलधन", "कुल देय", "जमा", "बकाया"].map((c) => (
                <th
                  key={c}
                  className="px-3 py-2.5 text-[10px] font-black uppercase text-muted-2 tracking-widest text-left whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-2 text-xs font-bold">
                  कोई बकाया क्लाइंट लोन नहीं
                </td>
              </tr>
            ) : (
              <>
                {data.map((l) => (
                  <tr
                    key={l.loan_id}
                    className="border-t border-app/50 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <a
                        href={`/clients/${l.client_id}/view`}
                        target="_blank"
                        className="text-sm font-bold text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        {l.client_name}
                      </a>
                      <div className="text-[10px] text-muted-2 mt-0.5">
                        {l.emi_amount > 0 ? `EMI ${inr(l.emi_amount)}` : "लोन"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted whitespace-nowrap">
                      {l.loan_date || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right text-muted">
                      {inr(l.principal_amount)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right font-bold text-app-2">
                      {inr(l.total_payable)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right font-bold text-emerald-400">
                      {inr(l.paid)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right font-bold text-amber-400">
                      {inr(l.outstanding)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-blue-500/30 bg-blue-500/5">
                  <td className="px-3 py-2.5 text-xs font-black text-blue-400">
                    कुल ({data.length})
                  </td>
                  <td />
                  <td />
                  <td className="px-3 py-2.5 text-xs text-right font-black text-app-2">
                    {inr(totals.payable)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right font-black text-emerald-400">
                    {inr(totals.paid)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right font-black text-amber-400">
                    {inr(totals.outstanding)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] leading-relaxed text-muted-2">
        सिर्फ सक्रिय लोन जिनकी तारीख स्थिति तिथि तक है। बकाया = कुल देय − (जमा + छूट)।
      </p>
    </div>
  );
}

function CashTab({ data }: { data: CashFlow | null }) {
  if (!data) {
    return (
      <div className="text-center py-12 text-muted-2 text-xs font-bold">नकद डेटा नहीं मिला</div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="overflow-x-auto">
          <table className="w-full tabular-nums">
            <thead>
              <tr className="bg-panel-2">
                <th className="px-3 py-2.5 text-[10px] font-black uppercase text-emerald-400 tracking-widest text-left">
                  जमा (Inflow)
                </th>
                <th className="px-3 py-2.5 text-[10px] font-black uppercase text-muted-2 tracking-widest text-right">
                  राशि
                </th>
              </tr>
            </thead>
            <tbody>
              {data.inflow.map((r) => (
                <tr key={r.key} className="border-t border-app/50">
                  <td className="px-3 py-2 text-xs font-bold text-app-2">{r.label}</td>
                  <td className="px-3 py-2 text-xs text-right font-bold text-emerald-400">
                    {inr(r.amount)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-app">
                <td className="px-3 py-2 text-xs font-black text-white">कुल जमा</td>
                <td className="px-3 py-2 text-xs text-right font-black text-emerald-400">
                  {inr(data.totalInflow)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full tabular-nums">
            <thead>
              <tr className="bg-panel-2">
                <th className="px-3 py-2.5 text-[10px] font-black uppercase text-red-400 tracking-widest text-left">
                  खर्च (Outflow)
                </th>
                <th className="px-3 py-2.5 text-[10px] font-black uppercase text-muted-2 tracking-widest text-right">
                  राशि
                </th>
              </tr>
            </thead>
            <tbody>
              {data.outflow.map((r) => (
                <tr key={r.key} className="border-t border-app/50">
                  <td className="px-3 py-2 text-xs font-bold text-app-2">{r.label}</td>
                  <td className="px-3 py-2 text-xs text-right font-bold text-red-400">
                    {inr(r.amount)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-app">
                <td className="px-3 py-2 text-xs font-black text-white">कुल खर्च</td>
                <td className="px-3 py-2 text-xs text-right font-black text-red-400">
                  {inr(data.totalOutflow)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-app bg-panel-2 px-3 py-2.5">
        <span className="text-xs font-black text-white">
          {data.balance >= 0 ? "नकद/बैंक शेष (अनुमानित)" : "ओवरड्राफ्ट (अनुमानित)"}
        </span>
        <span
          className={`text-sm font-black tabular-nums ${data.balance >= 0 ? "text-blue-400" : "text-red-400"}`}
        >
          {inr(data.balance)}
        </span>
      </div>
      <p className="text-[10px] leading-relaxed text-muted-2">
        अनुमान: सभी जमा − सभी खर्च, स्थिति तिथि तक। Owner capital/drawings और paid-purchase records
        शामिल नहीं हैं, इसलिए इसे बैंक स्टेटमेंट से मिलाकर देखें — यह अंतिम शेष नहीं है।
      </p>
    </div>
  );
}

export default function BalanceSheetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-blue-400" />
        </div>
      }
    >
      <BalanceSheetContent />
    </Suspense>
  );
}
