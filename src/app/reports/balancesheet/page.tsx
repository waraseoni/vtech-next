"use client";
import { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2, ChevronLeft, ChevronRight, Users, Wrench, Package,
  TrendingUp, TrendingDown, BarChart2, Banknote, Printer,
  X, Eye, RefreshCw, TrendingUp as Up, TrendingDown as Down, Info
} from "lucide-react";
import { todayIST, startOfMonthIST, endOfMonthIST } from "@/lib/dateUtils";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

type CLRow = {
  client_id: number; customer_name: string; contact: string | null;
  opening_balance: number; total_repair_amount: number; total_payment: number;
  current_balance: number; previous_transactions: number; total_jobs: number;
};

type MLRow = {
  mechanic_id: number; mechanic_name: string; daily_salary: number;
  commission_percent: number; total_advance_amount: number; advance_in_period: number;
  total_days_worked: number; days_worked_in_period: number;
  total_salary_due: number; salary_due_in_period: number; balance_amount: number;
};

type StockRow = {
  product_id: number; product_name: string; description: string; sale_price: number;
  total_stock_in: number; sold_quantity: number; remaining_stock: number; stock_value: number;
};

type IncomeRow = { description: string; amount: number };
type ExpenseRow = { expense_category: string | null; amount: number };

type LoanRow = {
  lender_id: number; lender_name: string; loan_amount: number; interest_rate: number;
  emi_amount: number; start_date: string; previous_payments: number; paid_in_period: number;
  total_paid: number; balance_amount: number; remaining_emis: number; status: string;
};

type TopCustomer = {
  client_id: number; customer_name: string; contact: string | null;
  previous_jobs: number; total_jobs: number; total_amount: number;
  total_payment_amount: number; opening_balance: number; current_balance: number;
};

type Summary = {
  totalIncome: number; totalExpenses: number; netProfit: number;
  totalStockValue: number; totalMechBalance: number; totalLoanBalance: number;
};

type LedgerEntry = {
  event_date: string; description: string; debit: number; credit: number; balance: number;
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
  const [activeTab, setActiveTab] = useState("customer");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");

  const [customerLedger, setCustomerLedger] = useState<CLRow[]>([]);
  const [mechanicLedger, setMechanicLedger] = useState<MLRow[]>([]);
  const [stockInventory, setStockInventory] = useState<StockRow[]>([]);
  const [incomeSummary, setIncomeSummary] = useState<IncomeRow[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseRow[]>([]);
  const [loanLedger, setLoanLedger] = useState<LoanRow[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const [selectedClient] = useState<{ id: number; name: string; opening_balance: number } | null>(null);
  const [detailedLedger] = useState<LedgerEntry[]>([]);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerLoading] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams({ from: startDate, to: endDate });
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
      setTopCustomers(data.topCustomers || []);
      setSummary(data.summary || null);
    } catch (e) {
      setErr(e instanceof Error ? (e.message || "Failed to load data") : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
        setSelYear(y); setSelMonth(m);
        const d = new Date(y, m - 1, 1);
        setStartDate(startOfMonthIST(d)); setEndDate(endOfMonthIST(d));
      } else if (filterType === "yearly") {
        y = nav === "prev" ? y - 1 : y + 1;
        setSelYear(y); setStartDate(`${y}-01-01`); setEndDate(`${y}-12-31`);
      }
    }
  }, [searchParams, filterType, selYear, selMonth]);

  const applyFilter = () => {
    if (filterType === "monthly") {
      const d = new Date(selYear, selMonth - 1, 1);
      setStartDate(startOfMonthIST(d)); setEndDate(endOfMonthIST(d));
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
      setStartDate(startOfMonthIST(d)); setEndDate(endOfMonthIST(d));
    } else if (filterType === "yearly") {
      y = dir === "prev" ? y - 1 : y + 1;
      setSelYear(y); setStartDate(`${y}-01-01`); setEndDate(`${y}-12-31`);
    }
  };

  const totals = useMemo(() => ({
    totOB: customerLedger.reduce((s, r) => s + r.opening_balance, 0),
    totRep: customerLedger.reduce((s, r) => s + r.total_repair_amount, 0),
    totPay: customerLedger.reduce((s, r) => s + r.total_payment, 0),
    totBal: customerLedger.reduce((s, r) => s + r.current_balance, 0),
  }), [customerLedger]);

  const monthName = new Date(selYear, selMonth - 1, 1).toLocaleString("en", { month: "long" });
  const filterLabel = filterType === "monthly" ? `${monthName} ${selYear}` : filterType === "yearly" ? `${selYear}` : `${startDate} से ${endDate}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white">व्यापार बैलेंस शीट</h1>
          <p className="text-xs text-slate-500 mt-0.5">{filterLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData(true)} disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-[#161b27] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:border-blue-500/40 transition-all">
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={() => window.open(`/api/print-balancesheet?from=${startDate}&to=${endDate}`, "_blank")}
            className="flex items-center gap-2 px-4 py-2 bg-[#161b27] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:border-blue-500/40 transition-all">
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard label="कुल आय" value={summary?.totalIncome || 0} color="emerald" icon={<TrendingUp size={14} />} />
        <MetricCard label="कुल व्यय" value={summary?.totalExpenses || 0} color="red" icon={<TrendingDown size={14} />} />
        <MetricCard label="शुद्ध लाभ" value={summary?.netProfit ?? 0} color={(summary?.netProfit ?? 0) >= 0 ? "emerald" : "red"} icon={(summary?.netProfit ?? 0) >= 0 ? <Up size={14} /> : <Down size={14} />} />
        <MetricCard label="स्टॉक वैल्यू" value={summary?.totalStockValue || 0} color="blue" icon={<Package size={14} />} />
        <MetricCard label="मैकेनिक बकाया" value={summary?.totalMechBalance || 0} color="amber" icon={<Wrench size={14} />} />
        <MetricCard label="लोन बकाया" value={summary?.totalLoanBalance || 0} color="purple" icon={<Banknote size={14} />} />
      </div>

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

      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="flex flex-wrap gap-1 p-2 border-b border-[#21293d]">
          {[
            { id: "customer", label: "ग्राहक लेजर", icon: <Users size={13} /> },
            { id: "mechanic", label: "मैकेनिक लेजर", icon: <Wrench size={13} /> },
            { id: "inventory", label: "स्टॉक", icon: <Package size={13} /> },
            { id: "income", label: "आय", icon: <TrendingUp size={13} /> },
            { id: "expense", label: "व्यय", icon: <TrendingDown size={13} /> },
            { id: "top_customers", label: "शीर्ष ग्राहक", icon: <BarChart2 size={13} /> },
            { id: "loan", label: "लोन लेजर", icon: <Banknote size={13} /> },
          ].map((t) => (
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
              {activeTab === "customer" && <CustomerTab data={customerLedger} totals={totals} />}
              {activeTab === "mechanic" && <MechanicTab data={mechanicLedger} />}
              {activeTab === "inventory" && <InventoryTab data={stockInventory} />}
              {activeTab === "income" && <IncomeTab data={incomeSummary} summary={summary} />}
              {activeTab === "expense" && <ExpenseTab data={expenseSummary} />}
              {activeTab === "top_customers" && <TopCustomersTab data={topCustomers} />}
              {activeTab === "loan" && <LoanTab data={loanLedger} />}
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════ CALCULATION SUMMARY */}
        <div className="bg-[#161b27] border border-blue-500/15 rounded-2xl p-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Info size={12} className="text-blue-400" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-400">Calculation Summary</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] font-mono">
            <div className="bg-slate-900/50 rounded-lg p-2">
              <p className="text-blue-400 font-bold mb-1">Income</p>
              <div className="text-slate-500 space-y-0.5">
                <div><span className="text-emerald-400">Total Income</span> = Repair Income + Walk-in Sales + Client Sales</div>
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2">
              <p className="text-blue-400 font-bold mb-1">Expenses</p>
              <div className="text-slate-500 space-y-0.5">
                <div><span className="text-red-400">Total Expenses</span> = Salary + Commission + Shop + EMI + Discount</div>
                <div><span className="text-cyan-400">Net Profit</span> = Total Income − Total Expenses</div>
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2">
              <p className="text-blue-400 font-bold mb-1">Balance Sheet</p>
              <div className="text-slate-500 space-y-0.5">
                <div><span className="text-blue-400">Total Assets</span> = Stock Value + Cash Balance</div>
                <div><span className="text-red-400">Total Liabilities</span> = Staff Payable + Loan Outstanding</div>
                <div><span className="text-purple-400">Capital</span> = Total Assets − Total Liabilities</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showLedgerModal && selectedClient && (
        <ClientLedgerModal
          client={selectedClient}
          entries={detailedLedger}
          loading={ledgerLoading}
          onClose={() => setShowLedgerModal(false)}
        />
      )}
    </div>
  );
}

function MetricCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400", red: "text-red-400", blue: "text-blue-400",
    amber: "text-amber-400", purple: "text-purple-400"
  };
  return (
    <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">{label}</span>
        <div className="w-7 h-7 rounded-lg bg-[#111520] flex items-center justify-center text-slate-500">
          {icon}
        </div>
      </div>
      <p className={`text-lg font-black ${colorMap[color]}`}>{inr(value ?? 0)}</p>
    </div>
  );
}

function CustomerTab({ data, totals }: { data: CLRow[]; totals: { totOB: number; totRep: number; totPay: number; totBal: number } }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-[#111520]">
            {["ग्राहक नाम", "संपर्क", "पिछला बैलेंस", "मरम्मत राशि", "भुगतान", "वर्तमान बैलेंस", "क्रिया"].map((c) => (
              <th key={c} className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={7} className="text-center py-12 text-slate-600 text-xs font-bold">कोई ग्राहक लेनदेन नहीं</td></tr>
          ) : (
            <>
              {data.map((c) => (
                <tr key={c.client_id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-2.5">
                    <a href={`/clients/${c.client_id}/view`} target="_blank" className="text-sm font-bold text-blue-400 hover:text-blue-300 hover:underline">
                      {c.customer_name}
                    </a>
                    <div className="text-[10px] text-slate-600 mt-0.5">{c.total_jobs} job(s)</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">{c.contact || "—"}</td>
                  <td className={`px-3 py-2.5 text-xs text-right font-bold ${c.opening_balance >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(c.opening_balance)}</td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-emerald-400">{inr(c.total_repair_amount)}</td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-teal-400">{inr(c.total_payment)}</td>
                  <td className={`px-3 py-2.5 text-xs text-right font-bold ${c.current_balance >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(c.current_balance)}</td>
                  <td className="px-3 py-2.5">
                    <a href={`/clients/${c.client_id}/view`} target="_blank" className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-[10px] font-bold hover:bg-blue-500/30 transition-all">
                      <Eye size={10} className="inline mr-1" /> विवरण
                    </a>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-blue-500/30 bg-blue-500/5">
                <td className="px-3 py-2.5 text-xs font-black text-blue-400">कुल ({data.length})</td>
                <td /><td className={`px-3 py-2.5 text-xs text-right font-black ${totals.totOB >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(totals.totOB)}</td>
                <td className="px-3 py-2.5 text-xs text-right font-black text-emerald-400">{inr(totals.totRep)}</td>
                <td className="px-3 py-2.5 text-xs text-right font-black text-teal-400">{inr(totals.totPay)}</td>
                <td className={`px-3 py-2.5 text-xs text-right font-black ${totals.totBal >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(totals.totBal)}</td>
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
      <table className="w-full">
        <thead>
          <tr className="bg-[#111520]">
            {["मैकेनिक नाम", "दिन काम", "कुल वेतन", "कुल अग्रिम", "बैलेंस"].map((c) => (
              <th key={c} className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-12 text-slate-600 text-xs font-bold">कोई डेटा नहीं</td></tr>
          ) : (
            data.map((m) => (
              <tr key={m.mechanic_id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                <td className="px-3 py-2.5 text-sm font-bold text-slate-200">{m.mechanic_name}</td>
                <td className="px-3 py-2.5 text-xs text-slate-400 text-center"><span className="text-emerald-400">{m.days_worked_in_period}</span> दिन</td>
                <td className="px-3 py-2.5 text-xs text-right font-bold text-emerald-400">{inr(m.salary_due_in_period)}</td>
                <td className="px-3 py-2.5 text-xs text-right font-bold text-red-400">{inr(m.advance_in_period)}</td>
                <td className={`px-3 py-2.5 text-xs text-right font-bold ${m.balance_amount >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(m.balance_amount)}</td>
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
      <table className="w-full">
        <thead>
          <tr className="bg-[#111520]">
            {["प्रोडक्ट", "स्टॉक इन", "बिका", "शेष", "वैल्यू"].map((c) => (
              <th key={c} className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-12 text-slate-600 text-xs font-bold">कोई स्टॉक डेटा नहीं</td></tr>
          ) : (
            <>
              {data.map((s) => (
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
              <tr className="border-t-2 border-blue-500/30 bg-blue-500/5">
                <td className="px-3 py-2.5 text-xs font-black text-blue-400">कुल ({data.length})</td>
                <td /><td /><td />
                <td className="px-3 py-2.5 text-xs text-right font-black text-blue-400">{inr(totalValue)}</td>
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
      <table className="w-full">
        <thead>
          <tr className="bg-[#111520]">
            {["विवरण", "राशि"].map((c) => (
              <th key={c} className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((i) => (
            <tr key={i.description} className="border-t border-[#21293d]/50">
              <td className="px-3 py-3 text-sm font-bold text-slate-200">{i.description}</td>
              <td className="px-3 py-3 text-sm text-right font-black text-emerald-400">{inr(i.amount)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-[#21293d]">
            <td className="px-3 py-3 text-sm font-black text-white">कुल आय</td>
            <td className="px-3 py-3 text-sm text-right font-black text-emerald-400">{inr(summary?.totalIncome || 0)}</td>
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
      <table className="w-full">
        <thead>
          <tr className="bg-[#111520]">
            {["श्रेणी", "राशि"].map((c) => (
              <th key={c} className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={2} className="text-center py-12 text-slate-600 text-xs font-bold">कोई खर्च नहीं</td></tr>
          ) : (
            <>
              {data.map((e) => (
                <tr key={e.expense_category} className="border-t border-[#21293d]/50">
                  <td className="px-3 py-3 text-sm font-bold text-slate-200">{e.expense_category}</td>
                  <td className="px-3 py-3 text-sm text-right font-black text-red-400">{inr(e.amount)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#21293d]">
                <td className="px-3 py-3 text-sm font-black text-white">कुल व्यय</td>
                <td className="px-3 py-3 text-sm text-right font-black text-red-400">{inr(total)}</td>
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
      <table className="w-full">
        <thead>
          <tr className="bg-[#111520]">
            {["ग्राहक", "संपर्क", "जॉब्स", "कुल राशि", "भुगतान", "बैलेंस"].map((c) => (
              <th key={c} className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={6} className="text-center py-12 text-slate-600 text-xs font-bold">कोई डेटा नहीं</td></tr>
          ) : (
            data.map((c) => (
              <tr key={c.client_id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                <td className="px-3 py-2.5 text-sm font-bold text-slate-200">{c.customer_name}</td>
                <td className="px-3 py-2.5 text-xs text-slate-400">{c.contact || "—"}</td>
                <td className="px-3 py-2.5 text-xs text-center text-slate-400">{c.total_jobs}</td>
                <td className="px-3 py-2.5 text-xs text-right font-bold text-emerald-400">{inr(c.total_amount)}</td>
                <td className="px-3 py-2.5 text-xs text-right font-bold text-teal-400">{inr(c.total_payment_amount)}</td>
                <td className={`px-3 py-2.5 text-xs text-right font-bold ${c.current_balance >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(c.current_balance)}</td>
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
      <table className="w-full">
        <thead>
          <tr className="bg-[#111520]">
            {["लेंडर", "कुल लोन", "इस अवधि में भुगतान", "बकाया", "स्थिति"].map((c) => (
              <th key={c} className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-12 text-slate-600 text-xs font-bold">कोई लोन डेटा नहीं</td></tr>
          ) : (
            data.map((l) => (
              <tr key={l.lender_id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                <td className="px-3 py-2.5 text-sm font-bold text-slate-200">{l.lender_name}</td>
                <td className="px-3 py-2.5 text-xs text-right text-slate-400">{inr(l.loan_amount)}</td>
                <td className="px-3 py-2.5 text-xs text-right font-bold text-emerald-400">{inr(l.paid_in_period)}</td>
                <td className={`px-3 py-2.5 text-xs text-right font-bold ${l.balance_amount > 0 ? "text-red-400" : "text-emerald-400"}`}>{inr(l.balance_amount)}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${l.status === "सक्रिय" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"}`}>{l.status}</span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ClientLedgerModal({ client, entries, loading, onClose }: {
  client: { id: number; name: string; opening_balance: number };
  entries: LedgerEntry[]; loading: boolean; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#21293d]">
          <div>
            <h3 className="font-black text-white text-sm">{client.name} — Ledger</h3>
            <p className="text-[10px] text-slate-500">Opening: {inr(client.opening_balance)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-[#111520] hover:bg-[#21293d] rounded-lg text-slate-500 hover:text-white transition-all">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full">
            <thead>
              <tr className="bg-[#111520]">
                {["तारीख", "विवरण", "डेबिट", "क्रेडिट", "बैलेंस"].map((c) => (
                  <th key={c} className="px-3 py-2 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8"><Loader2 size={20} className="animate-spin text-blue-400 inline" /></td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-600 text-xs font-bold">कोई एंट्री नहीं</td></tr>
              ) : (
                entries.map((e, i) => (
                  <tr key={i} className="border-t border-[#21293d]/50">
                    <td className="px-3 py-2 text-xs text-slate-400">{e.event_date}</td>
                    <td className="px-3 py-2 text-xs text-slate-200">{e.description}</td>
                    <td className="px-3 py-2 text-xs text-right text-emerald-400">{e.debit > 0 ? inr(e.debit) : ""}</td>
                    <td className="px-3 py-2 text-xs text-right text-teal-400">{e.credit > 0 ? inr(e.credit) : ""}</td>
                    <td className={`px-3 py-2 text-xs text-right font-bold ${e.balance >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(e.balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function BalanceSheetPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin text-blue-400" /></div>}>
      <BalanceSheetContent />
    </Suspense>
  );
}
