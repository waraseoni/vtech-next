"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Calculator,
  Printer,
  Loader2,
  RefreshCw,
  TrendingUp,
  Wallet,
  PiggyBank,
  TrendingDown,
  ArrowDownCircle,
  ArrowUpCircle,
  Scale,
  Package,
} from "lucide-react";
import Link from "next/link";
import {
  EMPTY_ACCOUNTING_DASHBOARD,
  fetchAccountingDashboardData,
  type AccountingDashboardData,
} from "@/lib/accounting-dashboard-data";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

type Tab = "summary" | "performance" | "cash" | "assets" | "inventory";

type AccountingDashboardBodyProps = {
  initialData: AccountingDashboardData | null;
  initialRange: { from: string; to: string };
};

function AccountingDashboardContent({ initialData, initialRange }: AccountingDashboardBodyProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [loading, setLoading] = useState(!initialData);
  const [tab, setTab] = useState<Tab>("summary");
  const fetchedRangeRef = useRef(initialData ? initialRange.from + "|" + initialRange.to : "");

  const [data, setData] = useState<AccountingDashboardData>(
    initialData ?? EMPTY_ACCOUNTING_DASHBOARD
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchAccountingDashboardData(supabase, { from, to });
      setData(payload);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const key = from + "|" + to;
    if (key === fetchedRangeRef.current) return;
    fetchedRangeRef.current = key;
    void fetchData();
  }, [from, to, fetchData]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(searchParams.toString());
    if (from) p.set("from", from);
    else p.delete("from");
    if (to) p.set("to", to);
    else p.delete("to");
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

  const pctBar = (v: number) => (
    <div className="h-2 bg-app rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, v))}%` }}
      />
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* Header */}
      <div className="bg-panel border border-app rounded-[2rem] p-6 shadow-2xl relative overflow-hidden no-print">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div className="flex items-center gap-5">
            <Link
              href="/reports"
              className="w-12 h-12 flex items-center justify-center bg-app border border-app rounded-2xl text-muted hover:text-white hover:bg-purple-600/10 hover:border-purple-500/40 transition-all group"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-800 rounded-3xl flex items-center justify-center shadow-xl shadow-purple-500/20 ring-4 ring-purple-500/10">
              <Calculator size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">
                Accounting Dashboard
              </h1>
              <p className="text-xs text-muted font-bold uppercase tracking-[0.3em]">
                Financial Analytics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/reports/balancesheet"
              className="flex items-center gap-2 px-5 py-3 bg-app border border-app rounded-2xl text-xs font-black uppercase tracking-widest text-muted hover:text-white hover:border-purple-500/40 transition-all"
            >
              <Scale size={14} /> Balance Sheet
            </Link>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-purple-600/20"
            >
              <Printer size={14} /> Print Report
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-panel border border-app rounded-[2rem] p-5 no-print">
        <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-2 tracking-[0.2em] ml-2">
              From Date
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-4 py-3 bg-app border border-app rounded-2xl text-sm text-app-2 outline-none focus:border-purple-500 transition-all [color-scheme:dark]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted-2 tracking-[0.2em] ml-2">
              To Date
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-4 py-3 bg-app border border-app rounded-2xl text-sm text-app-2 outline-none focus:border-purple-500 transition-all [color-scheme:dark]"
            />
          </div>
          <button
            type="submit"
            className="px-8 py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-purple-600/20"
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCw size={14} /> Update Analytics
            </span>
          </button>
          <div className="ml-auto px-5 py-3 bg-app border border-purple-500/20 rounded-2xl">
            <span className="text-xs font-black text-purple-400">
              Period:{" "}
              {new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(
                new Date(from + "T00:00:00")
              )}{" "}
              —{" "}
              {new Intl.DateTimeFormat("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }).format(new Date(to + "T00:00:00"))}
            </span>
          </div>
        </form>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-80">
            <span>Total Revenue</span>
            <TrendingUp size={16} />
          </div>
          <div className="text-3xl font-black mt-1">{inr(data.totalRevenue)}</div>
          <div className="text-xs font-bold opacity-80 mt-1">Service + Sales</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-80">
            <span>Revenue − Commission</span>
            <Wallet size={16} />
          </div>
          <div className="text-3xl font-black mt-1">{inr(data.grossProfit)}</div>
          <div className="text-xs font-bold opacity-80 mt-1">After Commission</div>
        </div>
        <div className="bg-gradient-to-br from-red-600 to-rose-900 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-80">
            <span>Total Expenses</span>
            <TrendingDown size={16} />
          </div>
          <div className="text-3xl font-black mt-1">{inr(data.totalExpenses)}</div>
          <div className="text-xs font-bold opacity-80 mt-1">Sal+Comm+Shop+EMI+Disc</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-700 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-80">
            <span>Net Profit</span>
            <PiggyBank size={16} />
          </div>
          <div className="text-3xl font-black mt-1">{inr(data.netProfit)}</div>
          <div className="text-xs font-bold opacity-80 mt-1">Period Earnings</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-panel border border-app rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="flex flex-wrap gap-2 p-4 border-b border-app no-print">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${tab === t.key ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20" : "bg-app text-muted hover:text-white border border-app"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-40">
              <Loader2 size={48} className="animate-spin text-purple-500" />
            </div>
          ) : (
            <>
              {/* EXECUTIVE SUMMARY */}
              {tab === "summary" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <h4 className="font-black text-white mb-4">Profit &amp; Loss Overview</h4>
                    <table className="w-full text-sm">
                      <thead className="bg-app text-[10px] font-black uppercase text-muted tracking-[0.2em]">
                        <tr>
                          <th className="px-4 py-3 text-left">Description</th>
                          <th className="px-4 py-3 text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#21293d] text-app-2">
                        <tr>
                          <td className="px-4 py-3">
                            Service/Repair Revenue{" "}
                            <span className="text-muted-2 text-xs">(Delivered jobs)</span>
                          </td>
                          <td className="px-4 py-3 text-right">{inr(data.serviceRevenue)}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3">
                            Direct Sales Revenue{" "}
                            <span className="text-muted-2 text-xs">(Walk-in + Client)</span>
                          </td>
                          <td className="px-4 py-3 text-right">{inr(data.salesRevenue)}</td>
                        </tr>
                        <tr className="bg-app">
                          <td className="px-4 py-3 font-black text-white">Total Gross Revenue</td>
                          <td className="px-4 py-3 text-right font-black text-white">
                            {inr(data.totalRevenue)}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-red-400">
                            − Staff Salary Earned{" "}
                            <span className="text-muted-2 text-xs">(Attendance)</span>
                          </td>
                          <td className="px-4 py-3 text-right text-red-400">
                            ({inr(data.salaryEarned)})
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-red-400">− Mechanic Commissions</td>
                          <td className="px-4 py-3 text-right text-red-400">
                            ({inr(data.commission)})
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-red-400">
                            − Shop &amp; Operational Expenses
                          </td>
                          <td className="px-4 py-3 text-right text-red-400">
                            ({inr(data.shopExpenses)})
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-red-400">− Loan EMI Payments</td>
                          <td className="px-4 py-3 text-right text-red-400">
                            ({inr(data.loanEmis)})
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-red-400">− Discounts Allowed</td>
                          <td className="px-4 py-3 text-right text-red-400">
                            ({inr(data.discounts)})
                          </td>
                        </tr>
                        <tr className="bg-purple-600">
                          <td className="px-4 py-3 font-black text-white">NET OPERATING PROFIT</td>
                          <td className="px-4 py-3 text-right font-black text-white">
                            {inr(data.netProfit)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <h4 className="font-black text-white mb-4">Efficiency Metrics</h4>
                    <div className="bg-app border border-app rounded-2xl p-5 space-y-6">
                      <div>
                        <div className="flex justify-between text-xs font-bold text-muted mb-1.5">
                          <span>Net Profit Margin</span>
                          <span>{margin.toFixed(1)}%</span>
                        </div>
                        {pctBar(margin)}
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold text-muted mb-1.5">
                          <span>Collection Efficiency</span>
                          <span>{collectionRate.toFixed(1)}%</span>
                        </div>
                        {pctBar(collectionRate)}
                      </div>
                      <div className="p-4 bg-panel-2 border border-app rounded-xl text-xs text-muted">
                        <p className="font-black text-app-2 mb-1">💡 Strategy Insight:</p>
                        <p>
                          Gross Profit <b className="text-white">{inr(data.grossProfit)}</b>. Net
                          profit badhane ke liye <b className="text-white">Shop Expenses</b> aur{" "}
                          <b className="text-white">Discount Policies</b> optimize karein.
                        </p>
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
                    <div className="bg-app border border-app rounded-2xl divide-y divide-[#21293d]">
                      {data.expenseCategories.length === 0 ? (
                        <div className="p-6 text-center text-muted-2 italic">
                          Is period me koi expense recorded nahi
                        </div>
                      ) : (
                        data.expenseCategories.map((ex, i) => (
                          <div key={i} className="flex items-center justify-between px-5 py-3.5">
                            <span className="text-sm text-app-2">{ex.category}</span>
                            <span className="font-black text-red-400">{inr(ex.total)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-black text-white mb-4">Top 5 Revenue Contributors</h4>
                    <div className="bg-app border border-app rounded-2xl divide-y divide-[#21293d]">
                      {data.topCustomers.length === 0 ? (
                        <div className="p-6 text-center text-muted-2 italic">
                          Koi revenue data nahi
                        </div>
                      ) : (
                        data.topCustomers.map((tc, i) => (
                          <div key={i} className="flex items-center justify-between px-5 py-3.5">
                            <span className="text-sm text-app-2">{tc.name}</span>
                            <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black">
                              {inr(tc.total)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* CASH FLOW */}
              {tab === "cash" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-black text-emerald-400 mb-4 flex items-center gap-2">
                      <ArrowDownCircle size={16} /> Cash Inflow (Receipts)
                    </h4>
                    <div className="bg-app border border-app rounded-2xl divide-y divide-[#21293d]">
                      <div className="flex justify-between px-5 py-3.5 text-sm text-app-2">
                        <span>Client Payments Collected</span>
                        <span className="font-bold text-emerald-400">{inr(data.collections)}</span>
                      </div>
                      <div className="flex justify-between px-5 py-3.5 text-sm text-app-2">
                        <span>Walk-in Direct Sales (Cash)</span>
                        <span className="font-bold text-emerald-400">{inr(data.walkinSales)}</span>
                      </div>
                      <div className="flex justify-between px-5 py-4 bg-panel-2 text-sm">
                        <span className="font-black text-white">Total Cash In</span>
                        <span className="font-black text-emerald-400">{inr(data.cashInflow)}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-black text-red-400 mb-4 flex items-center gap-2">
                      <ArrowUpCircle size={16} /> Cash Outflow (Payments)
                    </h4>
                    <div className="bg-app border border-app rounded-2xl divide-y divide-[#21293d]">
                      <div className="flex justify-between px-5 py-3.5 text-sm text-app-2">
                        <span>Shop &amp; Operational Expenses</span>
                        <span className="font-bold">{inr(data.shopExpenses)}</span>
                      </div>
                      <div className="flex justify-between px-5 py-3.5 text-sm text-app-2">
                        <span>Staff Advance / Salary Paid</span>
                        <span className="font-bold">{inr(data.staffAdvances)}</span>
                      </div>
                      <div className="flex justify-between px-5 py-3.5 text-sm text-app-2">
                        <span>Loan EMI / Debt Repayments</span>
                        <span className="font-bold">{inr(data.loanEmis)}</span>
                      </div>
                      <div className="flex justify-between px-5 py-4 bg-panel-2 text-sm">
                        <span className="font-black text-white">Total Cash Out</span>
                        <span className="font-black text-red-400">{inr(data.cashOutflow)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-2">
                    <div className="p-6 bg-gradient-to-r from-purple-700 to-indigo-800 rounded-2xl text-center text-white">
                      <h4 className="font-black mb-1">Net Cash Flow (Liquidity)</h4>
                      <div className="text-4xl font-black">
                        {inr(data.cashInflow - data.cashOutflow)}
                      </div>
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
                    <div className="bg-app border border-app rounded-2xl p-5 space-y-3 text-sm">
                      <div className="flex justify-between text-app-2">
                        <span>Cash &amp; Bank Balance (Est.)</span>
                        <span className="font-bold">{inr(data.cashOnHand)}</span>
                      </div>
                      <div className="flex justify-between text-app-2">
                        <span>Accounts Receivable (Customer Dues)</span>
                        <span className="font-bold">{inr(data.accountsReceivable)}</span>
                      </div>
                      <div className="flex justify-between text-app-2">
                        <span>Inventory / Stock Value</span>
                        <span className="font-bold">{inr(data.inventoryValue)}</span>
                      </div>
                      <hr className="border-app" />
                      <div className="flex justify-between font-black text-white text-base">
                        <span>TOTAL ASSETS</span>
                        <span>{inr(totalAssets)}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-black text-white mb-4">Current Liabilities</h4>
                    <div className="bg-app border border-app rounded-2xl p-5 space-y-3 text-sm">
                      <div className="flex justify-between text-app-2">
                        <span>Lender Loans Payable</span>
                        <span className="font-bold">{inr(data.loansPayable)}</span>
                      </div>
                      <hr className="border-app" />
                      <div className="flex justify-between font-black text-red-400 text-base">
                        <span>TOTAL LIABILITIES</span>
                        <span>{inr(data.loansPayable)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* INVENTORY HEALTH */}
              {tab === "inventory" && (
                <div>
                  <h4 className="font-black text-white mb-4">Top Inventory Assets</h4>
                  <div className="bg-app border border-app rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="text-[10px] font-black uppercase text-muted tracking-[0.2em] border-b border-app">
                        <tr>
                          <th className="px-5 py-3.5 text-left">Product Name</th>
                          <th className="px-5 py-3.5 text-center">Current Qty</th>
                          <th className="px-5 py-3.5 text-right">Unit Price</th>
                          <th className="px-5 py-3.5 text-right">Total Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#21293d] text-app-2">
                        {data.stockItems.map((row, i) => (
                          <tr key={i}>
                            <td className="px-5 py-3.5">{row.name}</td>
                            <td className="px-5 py-3.5 text-center">
                              <span
                                className={`px-3 py-1 rounded-lg text-xs font-black ${row.qty < 5 ? "bg-red-500/15 text-red-400 border border-red-500/30" : "bg-purple-500/10 text-purple-400 border border-purple-500/20"}`}
                              >
                                {row.qty}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">{inr(row.price)}</td>
                            <td className="px-5 py-3.5 text-right font-black">{inr(row.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-panel-2 border-t border-app">
                          <td colSpan={3} className="px-5 py-3.5 text-right font-black text-white">
                            Estimated Total Stock Value:
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-purple-400">
                            {inr(data.inventoryValue)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-xs text-muted">
                    <Package size={16} className="text-purple-400" /> Stock value end-date tak
                    calculate kiya gaya hai.
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

export default function AccountingDashboardBody(props: AccountingDashboardBodyProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-48">
          <Loader2 size={48} className="animate-spin text-purple-500" />
        </div>
      }
    >
      <AccountingDashboardContent {...props} />
    </Suspense>
  );
}
