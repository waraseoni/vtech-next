'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, subMonths, addMonths, parseISO, startOfMonth, endOfMonth, isValid } from 'date-fns';
import { FaPrint, FaEye, FaChevronLeft, FaChevronRight, FaRedo, FaInfoCircle, FaFilter } from 'react-icons/fa';
import { Loader2 } from 'lucide-react';

// ---------- Helper: safe number parse (API se string bhi aa sakti hai) ----------
const toNum = (val: unknown): number => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// ---------- Helper: safe date format ----------
const safeFormatDate = (dateStr: string): string => {
  try {
    const d = parseISO(dateStr);
    return isValid(d) ? format(d, 'dd MMM yyyy') : dateStr;
  } catch {
    return dateStr;
  }
};

// ---------- Helper: current month start / end ----------
const getMonthStart = (date: Date): string => format(startOfMonth(date), 'yyyy-MM-dd');
const getMonthEnd = (date: Date): string => format(endOfMonth(date), 'yyyy-MM-dd');

// ---------- Types ----------
type Transaction = {
  id: number;
  job_id: string;
  date_completed: string;
  item: string;
  amount: number | string;
  mechanic_commission_amount: number | string;
  client_id: number;
  mechanic_id: number;
  client_firstname?: string;
  client_middlename?: string;
  client_lastname?: string;
  mechanic_firstname?: string;
  mechanic_lastname?: string;
};

type DirectSale = {
  id: number;
  sale_code: string;
  total_amount: number | string;
  date_created: string;
  client_id: number | null;
  client_firstname?: string;
  client_lastname?: string;
  product_name?: string;
  quantity?: number;
  unit_price?: number | string;
};

type ClientPayment = {
  id: number;
  client_id: number;
  amount: number | string;
  discount: number | string;
  payment_date: string;
  remarks: string | null;
  payment_method: string | null;
  client_firstname?: string;
  client_lastname?: string;
};

type Commission = {
  job_id: string;
  amount: number | string;
  mechanic_commission_amount: number | string;
  date_completed: string;
  mechanic_firstname?: string;
  mechanic_lastname?: string;
};

type SalaryDetail = {
  mechanic_name: string;
  full_days: number | string;
  half_days: number | string;
  total_days: number | string;
  daily_salary: number | string;
  salary_earned: number | string;
};

type AdvancePayment = {
  date_paid: string;
  mechanic_name: string;
  amount: number | string;
  reason: string | null;
  payment_mode: string | null;
};

type Expense = {
  date_created: string;
  category: string;
  remarks: string;
  amount: number | string;
  payment_mode: string | null;
  reference: string | null;
};

type LedgerEntry = {
  date: string;
  category: string;
  details: string;
  type: 'Cash In' | 'Cash Out';
  net_amount: number | string;
  discount_amount?: number | string;
  client_id?: number;
  client_fullname?: string;
};

type StockItem = {
  name: string;
  price: number | string;
  quantity: number | string;
};

type ApiResponse = {
  repairJobs: Transaction[];
  walkinSales: DirectSale[];
  clientSales: DirectSale[];
  clientPayments: ClientPayment[];
  commissionData: Commission[];
  salaryDetails: SalaryDetail[];
  advancePayments: AdvancePayment[];
  expenses: Expense[];
  ledgerEntries: LedgerEntry[];
  stockItems: StockItem[];
  jobIncome: number | string;
  walkinIncome: number | string;
  clientSalesIncome: number | string;
  clientPaymentsReceived: number | string;
  totalDiscountGiven: number | string;
  totalCommission: number | string;
  totalAdvanceGiven: number | string;
  totalOtherExpenses: number | string;
  totalEmiPaid: number | string;
  totalSalary: number | string;
  stockValue: number | string;
  staffLiability: number | string;
  loanOutstanding: number | string;
};

type Props = {
  fromDate?: string;
  toDate?: string;
};

// ---------- Simple Modal Component ----------
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  // ESC key se modal band karo
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
        <div className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center rounded-t-lg flex-shrink-0">
          <h3 className="font-semibold text-sm md:text-base">{title}</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 text-xl leading-none">✕</button>
        </div>
        <div className="p-4 overflow-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ---------- Main Component ----------
export default function LedgerReportClient({ fromDate, toDate }: Props) {
  const router = useRouter();
  const today = new Date();

  // BUG FIX #1: 'yyyy-MM-01' galat format tha — date-fns mein literal '01' nahi hota
  // Sahi tarika: startOfMonth / endOfMonth use karo
  const [from, setFrom] = useState(fromDate || getMonthStart(today));
  const [to, setTo] = useState(toDate || getMonthEnd(today));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [showStockDetail, setShowStockDetail] = useState(false);

  // Modal states
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [showClientSalesModal, setShowClientSalesModal] = useState(false);
  const [showClientPaymentsModal, setShowClientPaymentsModal] = useState(false);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showStaffSalariesModal, setShowStaffSalariesModal] = useState(false);
  const [showStaffAdvanceModal, setShowStaffAdvanceModal] = useState(false);
  const [showShopExpensesModal, setShowShopExpensesModal] = useState(false);

  // BUG FIX #2: fetchData ko useCallback mein wrap karo taaki useEffect sahi kaam kare
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/ledger?from=${from}&to=${to}`);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server error ${res.status}: ${errText}`);
      }
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setData(result);
    } catch (err) {
      console.error('Ledger fetch error:', err);
      setError(err instanceof Error ? err.message : 'Report load karne mein error aayi');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/reports/ledger?from=${from}&to=${to}`);
    // Note: fetchData useEffect mein automatically trigger hoga kyunki from/to state pehle se set hai
  };

  // BUG FIX #3: goToMonth — pehle month ka pehla aur aakhri din theek se calculate karo
  const goToMonth = (direction: 'prev' | 'next') => {
    try {
      const currentFrom = parseISO(from);
      if (!isValid(currentFrom)) return;
      const newBase = direction === 'prev' ? subMonths(currentFrom, 1) : addMonths(currentFrom, 1);
      setFrom(getMonthStart(newBase));
      setTo(getMonthEnd(newBase));
    } catch (err) {
      console.error('Month navigation error:', err);
    }
  };

  const resetToCurrentMonth = () => {
    setFrom(getMonthStart(today));
    setTo(getMonthEnd(today));
  };

  // ---------- Loading State ----------
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] gap-3">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-gray-500 text-sm">Report load ho rahi hai...</p>
      </div>
    );
  }

  // ---------- Error State ----------
  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <p className="text-red-600 font-semibold mb-2">Report load nahi ho saki</p>
          <p className="text-red-500 text-sm mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
          >
            Dobara Koshish Karo
          </button>
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-8 text-center text-red-600">Koi data nahi mila</div>;

  // BUG FIX #4: toNum() se saare values safely parse karo — API se strings bhi aa sakti hain
  const {
    repairJobs = [],
    walkinSales = [],
    clientSales = [],
    clientPayments = [],
    commissionData = [],
    salaryDetails = [],
    advancePayments = [],
    expenses = [],
    ledgerEntries = [],
    stockItems = [],
  } = data;

  const jobIncome = toNum(data.jobIncome);
  const walkinIncome = toNum(data.walkinIncome);
  const clientSalesIncome = toNum(data.clientSalesIncome);
  const clientPaymentsReceived = toNum(data.clientPaymentsReceived);
  const totalDiscountGiven = toNum(data.totalDiscountGiven);
  const totalCommission = toNum(data.totalCommission);
  const totalAdvanceGiven = toNum(data.totalAdvanceGiven);
  const totalOtherExpenses = toNum(data.totalOtherExpenses);
  const totalEmiPaid = toNum(data.totalEmiPaid);
  const totalSalary = toNum(data.totalSalary);
  const stockValue = toNum(data.stockValue);
  const staffLiability = toNum(data.staffLiability);
  const loanOutstanding = Math.max(0, toNum(data.loanOutstanding));

  const totalIncome = jobIncome + walkinIncome + clientSalesIncome;
  const totalBusinessExpense = totalSalary + totalCommission + totalOtherExpenses + totalEmiPaid + totalDiscountGiven;
  const netProfit = totalIncome - totalBusinessExpense;
  const totalCashInflow = clientPaymentsReceived + walkinIncome;
  const totalCashOutflow = totalAdvanceGiven + totalOtherExpenses + totalEmiPaid;
  const netCash = totalCashInflow - totalCashOutflow;

  // Format ki display dates
  const displayFrom = safeFormatDate(from);
  const displayTo = safeFormatDate(to);

  return (
    <div className="p-4 md:p-6 bg-white rounded-lg shadow">

      {/* ===== HEADER ===== */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Business Ledger & Cash Flow</h2>
          <p className="text-xs text-gray-500 mt-0.5">{displayFrom} — {displayTo}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-2"
        >
          <FaPrint /> Print
        </button>
      </div>

      {/* ===== FILTER FORM ===== */}
      <form onSubmit={handleFilter} className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-6 no-print">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-gray-300 rounded-md shadow-sm p-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-gray-300 rounded-md shadow-sm p-2 text-sm"
              required
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm flex items-center gap-1">
              <FaFilter size={12} /> Filter
            </button>
            <button type="button" onClick={() => goToMonth('prev')} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded text-sm" title="Pichhla Mahina">
              <FaChevronLeft />
            </button>
            <button type="button" onClick={resetToCurrentMonth} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded text-sm" title="Is Mahine Par Wapis Aao">
              <FaRedo />
            </button>
            <button type="button" onClick={() => goToMonth('next')} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded text-sm" title="Agla Mahina">
              <FaChevronRight />
            </button>
          </div>
        </div>
      </form>

      {/* ===== SUMMARY CARDS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 border-l-4 border-green-500 p-3 md:p-4 rounded shadow-sm">
          <p className="text-xs text-gray-600">Net Revenue</p>
          <p className="text-xl md:text-2xl font-bold text-green-700">₹ {totalIncome.toFixed(2)}</p>
          <p className="text-xs text-gray-500">Repair + sab direct sales</p>
        </div>
        <div className="bg-red-50 border-l-4 border-red-500 p-3 md:p-4 rounded shadow-sm">
          <p className="text-xs text-gray-600">Total Expenses</p>
          <p className="text-xl md:text-2xl font-bold text-red-700">₹ {totalBusinessExpense.toFixed(2)}</p>
          <p className="text-xs text-gray-500">Salary+Comm+Exp+EMI+Disc</p>
        </div>
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 md:p-4 rounded shadow-sm">
          <p className="text-xs text-gray-600">Cash Received</p>
          <p className="text-xl md:text-2xl font-bold text-blue-700">₹ {totalCashInflow.toFixed(2)}</p>
          <p className="text-xs text-gray-500">Client payments + walk-in</p>
        </div>
        <div className={`${netProfit >= 0 ? 'bg-indigo-50 border-indigo-500' : 'bg-yellow-50 border-yellow-500'} border-l-4 p-3 md:p-4 rounded shadow-sm`}>
          <p className="text-xs text-gray-600">Net Profit/Loss</p>
          <p className={`text-xl md:text-2xl font-bold ${netProfit >= 0 ? 'text-indigo-700' : 'text-yellow-700'}`}>
            ₹ {netProfit.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500">{netProfit >= 0 ? 'Faayda' : 'Nuksan'}</p>
        </div>
      </div>

      {/* ===== P&L + CASH FLOW ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Business Performance (P&L) */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-base font-semibold text-gray-800 mb-3 border-b pb-2">Business Performance (P&L)</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr className="bg-gray-100"><th colSpan={2} className="p-2 text-left text-xs uppercase tracking-wide">Revenue (कमाई)</th></tr>
              <tr className="hover:bg-gray-50">
                <td className="p-2">
                  <button onClick={() => setShowRepairModal(true)} className="text-blue-600 hover:underline flex items-center gap-1 text-left">
                    <FaEye size={12} /> Repair Jobs Income
                  </button>
                </td>
                <td className="p-2 text-right font-medium">₹ {jobIncome.toFixed(2)}</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="p-2">
                  <button onClick={() => setShowWalkinModal(true)} className="text-blue-600 hover:underline flex items-center gap-1 text-left">
                    <FaEye size={12} /> Walk-in Direct Sales
                  </button>
                </td>
                <td className="p-2 text-right font-medium">₹ {walkinIncome.toFixed(2)}</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="p-2">
                  <button onClick={() => setShowClientSalesModal(true)} className="text-blue-600 hover:underline flex items-center gap-1 text-left">
                    <FaEye size={12} /> Client Direct Sales
                  </button>
                </td>
                <td className="p-2 text-right font-medium">₹ {clientSalesIncome.toFixed(2)}</td>
              </tr>
              <tr className="bg-gray-100 font-semibold"><td className="p-2">Net Revenue</td><td className="p-2 text-right text-green-700">₹ {totalIncome.toFixed(2)}</td></tr>

              <tr className="bg-gray-100"><th colSpan={2} className="p-2 text-left text-xs uppercase tracking-wide">Expenses (खर्च)</th></tr>
              <tr className="hover:bg-gray-50">
                <td className="p-2">
                  <button onClick={() => setShowStaffSalariesModal(true)} className="text-blue-600 hover:underline flex items-center gap-1 text-left">
                    <FaEye size={12} /> Staff Salaries
                  </button>
                </td>
                <td className="p-2 text-right text-red-600">(-) ₹ {totalSalary.toFixed(2)}</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="p-2">
                  <button onClick={() => setShowCommissionModal(true)} className="text-blue-600 hover:underline flex items-center gap-1 text-left">
                    <FaEye size={12} /> Mechanic Commission
                  </button>
                </td>
                <td className="p-2 text-right text-red-600">(-) ₹ {totalCommission.toFixed(2)}</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="p-2">
                  <button onClick={() => setShowShopExpensesModal(true)} className="text-blue-600 hover:underline flex items-center gap-1 text-left">
                    <FaEye size={12} /> Shop Expenses
                  </button>
                </td>
                <td className="p-2 text-right text-red-600">(-) ₹ {totalOtherExpenses.toFixed(2)}</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="p-2">Loan EMI Payments</td>
                <td className="p-2 text-right text-red-600">(-) ₹ {totalEmiPaid.toFixed(2)}</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="p-2">
                  <button onClick={() => setShowDiscountModal(true)} className="text-blue-600 hover:underline flex items-center gap-1 text-left">
                    <FaEye size={12} /> Customer Discount Given
                  </button>
                </td>
                <td className="p-2 text-right text-red-600">(-) ₹ {totalDiscountGiven.toFixed(2)}</td>
              </tr>
              <tr className="bg-gray-100 font-semibold"><td className="p-2">Total Expenses</td><td className="p-2 text-right text-red-600">₹ {totalBusinessExpense.toFixed(2)}</td></tr>

              <tr className="bg-gray-800 text-white">
                <th className="p-2 text-left">Net Profit/Loss</th>
                <th className={`p-2 text-right ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ₹ {netProfit.toFixed(2)}
                </th>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Cash Flow */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-base font-semibold text-gray-800 mb-3 border-b pb-2">Cash Flow (नकदी प्रवाह)</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr className="bg-gray-100"><th colSpan={2} className="p-2 text-left text-xs uppercase tracking-wide">Cash Inflow (नकद आय)</th></tr>
              <tr className="hover:bg-gray-50">
                <td className="p-2">
                  <button onClick={() => setShowClientPaymentsModal(true)} className="text-blue-600 hover:underline flex items-center gap-1 text-left">
                    <FaEye size={12} /> Client Payments Received
                  </button>
                </td>
                <td className="p-2 text-right text-green-600">₹ {clientPaymentsReceived.toFixed(2)}</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="p-2">
                  <button onClick={() => setShowWalkinModal(true)} className="text-blue-600 hover:underline flex items-center gap-1 text-left">
                    <FaEye size={12} /> Walk-in Direct Sales (Cash)
                  </button>
                </td>
                <td className="p-2 text-right text-green-600">₹ {walkinIncome.toFixed(2)}</td>
              </tr>
              <tr className="bg-gray-100 font-semibold"><td className="p-2">Total Cash In</td><td className="p-2 text-right text-green-600">₹ {totalCashInflow.toFixed(2)}</td></tr>

              <tr className="bg-gray-100"><th colSpan={2} className="p-2 text-left text-xs uppercase tracking-wide">Cash Outflow (नकद भुगतान)</th></tr>
              <tr className="hover:bg-gray-50">
                <td className="p-2">
                  <button onClick={() => setShowStaffAdvanceModal(true)} className="text-blue-600 hover:underline flex items-center gap-1 text-left">
                    <FaEye size={12} /> Staff Advance/Salary Paid
                  </button>
                </td>
                <td className="p-2 text-right text-red-600">(-) ₹ {totalAdvanceGiven.toFixed(2)}</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="p-2">
                  <button onClick={() => setShowShopExpensesModal(true)} className="text-blue-600 hover:underline flex items-center gap-1 text-left">
                    <FaEye size={12} /> Shop Expenses Paid
                  </button>
                </td>
                <td className="p-2 text-right text-red-600">(-) ₹ {totalOtherExpenses.toFixed(2)}</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="p-2">Loan EMI Paid</td>
                <td className="p-2 text-right text-red-600">(-) ₹ {totalEmiPaid.toFixed(2)}</td>
              </tr>
              <tr className="bg-gray-100 font-semibold"><td className="p-2">Total Cash Out</td><td className="p-2 text-right text-red-600">₹ {totalCashOutflow.toFixed(2)}</td></tr>

              <tr className="bg-blue-600 text-white">
                <th className="p-2 text-left">Net Cash Flow</th>
                <th className="p-2 text-right">₹ {netCash.toFixed(2)}</th>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-gray-700">
            <p className="font-semibold flex items-center gap-1 mb-1"><FaInfoCircle className="text-yellow-600" /> Important Notes:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Repair Job Revenue tab mani jaati hai jab job complete/deliver ho.</li>
              <li>Client Payments pehle ki invoices ki recovery hai, naya revenue nahi.</li>
              <li>Client Direct Sales revenue hai, cash baad mein client payment se aata hai.</li>
              <li>Customer ko di gayi discount business expense mein count hoti hai.</li>
              <li><FaEye className="inline text-blue-600" size={10} /> icon click karke detail dekho.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ===== TRANSACTION LEDGER ===== */}
      <div className="mt-8 bg-white border rounded-lg overflow-hidden">
        <div className="bg-gray-800 text-white px-4 py-2.5 flex justify-between items-center">
          <h3 className="font-semibold text-sm md:text-base">Transaction Ledger (Cash Flow)</h3>
          <div className="flex gap-2">
            <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs">Cash In</span>
            <span className="bg-red-600 text-white px-2 py-0.5 rounded text-xs">Cash Out</span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left whitespace-nowrap">Date</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">Category</th>
                <th className="px-3 py-2 text-left">Details</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Cash In</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Cash Out</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6 text-gray-500">Is period mein koi transaction nahi mila.</td></tr>
              ) : (
                (() => {
                  let runningBalance = 0;
                  return ledgerEntries.map((entry, idx) => {
                    const amt = toNum(entry.net_amount);
                    if (entry.type === 'Cash In') runningBalance += amt;
                    else runningBalance -= amt;
                    return (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap">{safeFormatDate(entry.date)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${entry.type === 'Cash In' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {entry.category}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {entry.client_fullname ? (
                            <Link href={`/clients/${entry.client_id}/view`} className="text-blue-600 hover:underline">
                              {entry.client_fullname}
                            </Link>
                          ) : (
                            <span>{entry.details}</span>
                          )}
                          {toNum(entry.discount_amount) > 0 && (
                            <span className="text-red-500 text-xs ml-1">(-₹{toNum(entry.discount_amount).toFixed(2)})</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-green-600 font-medium whitespace-nowrap">
                          {entry.type === 'Cash In' ? `₹${amt.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-red-600 font-medium whitespace-nowrap">
                          {entry.type === 'Cash Out' ? `₹${amt.toFixed(2)}` : '—'}
                        </td>
                        <td className={`px-3 py-2 text-right font-bold whitespace-nowrap ${runningBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          ₹{runningBalance.toFixed(2)}
                        </td>
                      </tr>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 bg-gray-100 flex flex-wrap justify-between items-center gap-2 text-sm border-t">
          <span>Total Cash In: <span className="text-green-600 font-bold">₹{totalCashInflow.toFixed(2)}</span></span>
          <span>Total Cash Out: <span className="text-red-600 font-bold">₹{totalCashOutflow.toFixed(2)}</span></span>
          <span>Closing Balance: <span className={`font-bold ${netCash >= 0 ? 'text-blue-600' : 'text-red-600'}`}>₹{netCash.toFixed(2)}</span></span>
        </div>
      </div>

      {/* ===== EXPENSE + ADVANCE TABLES ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Shop Expenses */}
        <div className="bg-white border rounded-lg p-4">
          <h4 className="font-semibold mb-3 text-sm border-b pb-2">Shop Expense Details</h4>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Expense Name</th>
                  <th className="p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-4 text-gray-500">Koi expense nahi mila.</td></tr>
                ) : (
                  expenses.map((e, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="p-2 whitespace-nowrap">{safeFormatDate(e.date_created)}</td>
                      <td className="p-2">{e.remarks || e.category}</td>
                      <td className="p-2 text-right text-red-600">₹{toNum(e.amount).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {expenses.length > 0 && (
                <tfoot className="bg-gray-100">
                  <tr><th colSpan={2} className="p-2 text-right">Total:</th><th className="p-2 text-right text-red-600">₹{totalOtherExpenses.toFixed(2)}</th></tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Staff Advance */}
        <div className="bg-white border rounded-lg p-4">
          <h4 className="font-semibold mb-3 text-sm border-b pb-2">Staff Advance List</h4>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Staff</th>
                  <th className="p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {advancePayments.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-4 text-gray-500">Koi advance nahi mila.</td></tr>
                ) : (
                  advancePayments.map((a, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="p-2 whitespace-nowrap">{safeFormatDate(a.date_paid)}</td>
                      <td className="p-2">{a.mechanic_name}</td>
                      <td className="p-2 text-right text-orange-600">₹{toNum(a.amount).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {advancePayments.length > 0 && (
                <tfoot className="bg-gray-100">
                  <tr><th colSpan={2} className="p-2 text-right">Total:</th><th className="p-2 text-right text-orange-600">₹{totalAdvanceGiven.toFixed(2)}</th></tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* ===== TRADING ACCOUNT + BALANCE SHEET ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Trading / P&L Account */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-base font-semibold text-gray-800 mb-3 border-b pb-2">व्यापारिक खाता (Trading/P&L Account)</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr className="bg-gray-100"><th colSpan={2} className="p-2 text-left text-xs">आय (Income)</th></tr>
              <tr><td className="p-2">सर्विस राजस्व (Service Revenue)</td><td className="p-2 text-right">₹ {jobIncome.toFixed(2)}</td></tr>
              <tr><td className="p-2">वॉक-इन बिक्री (Walk-in Sales)</td><td className="p-2 text-right">₹ {walkinIncome.toFixed(2)}</td></tr>
              <tr><td className="p-2">ग्राहक बिक्री (Client Sales)</td><td className="p-2 text-right">₹ {clientSalesIncome.toFixed(2)}</td></tr>
              <tr className="bg-gray-100 font-semibold"><td className="p-2">शुद्ध आय (Net Revenue)</td><td className="p-2 text-right text-green-700">₹ {totalIncome.toFixed(2)}</td></tr>

              <tr className="bg-gray-100"><th colSpan={2} className="p-2 text-left text-xs">व्यय (Expenses)</th></tr>
              <tr><td className="p-2">वेतन (Salaries)</td><td className="p-2 text-right text-red-600">₹ {totalSalary.toFixed(2)}</td></tr>
              <tr><td className="p-2">कमीशन (Commission)</td><td className="p-2 text-right text-red-600">₹ {totalCommission.toFixed(2)}</td></tr>
              <tr><td className="p-2">दुकान खर्च (Shop Expenses)</td><td className="p-2 text-right text-red-600">₹ {totalOtherExpenses.toFixed(2)}</td></tr>
              <tr><td className="p-2">लोन किस्त (Loan EMI)</td><td className="p-2 text-right text-red-600">₹ {totalEmiPaid.toFixed(2)}</td></tr>
              <tr><td className="p-2">ग्राहक छूट (Customer Discount)</td><td className="p-2 text-right text-red-600">₹ {totalDiscountGiven.toFixed(2)}</td></tr>
              <tr className="bg-gray-100 font-semibold"><td className="p-2">कुल व्यय (Total Expenses)</td><td className="p-2 text-right text-red-600">₹ {totalBusinessExpense.toFixed(2)}</td></tr>

              <tr className="bg-gray-800 text-white">
                <th className="p-2 text-left">शुद्ध लाभ/हानि (Net Profit/Loss)</th>
                <th className={`p-2 text-right ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>₹ {netProfit.toFixed(2)}</th>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Balance Sheet */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-base font-semibold text-gray-800 mb-3 border-b pb-2">चिट्ठा (Balance Sheet)</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr className="bg-gray-100"><th colSpan={2} className="p-2 text-left text-xs">संपत्ति (Assets)</th></tr>
              <tr><td className="p-2">स्टॉक मूल्य (Inventory Value)</td><td className="p-2 text-right">₹ {stockValue.toFixed(2)}</td></tr>
              <tr><td className="p-2">नकद शेष (Cash Balance)</td><td className="p-2 text-right">₹ {netCash.toFixed(2)}</td></tr>
              <tr className="bg-gray-100 font-semibold"><td className="p-2">कुल संपत्ति (Total Assets)</td><td className="p-2 text-right">₹ {(stockValue + netCash).toFixed(2)}</td></tr>

              <tr className="bg-gray-100"><th colSpan={2} className="p-2 text-left text-xs">दायित्व (Liabilities)</th></tr>
              <tr><td className="p-2">स्टाफ बकाया (Staff Payable)</td><td className="p-2 text-right text-red-600">₹ {staffLiability.toFixed(2)}</td></tr>
              <tr><td className="p-2">लोन बकाया (Loan Outstanding)</td><td className="p-2 text-right text-red-600">₹ {loanOutstanding.toFixed(2)}</td></tr>
              <tr className="bg-gray-100 font-semibold"><td className="p-2">कुल दायित्व (Total Liabilities)</td><td className="p-2 text-right text-red-600">₹ {(staffLiability + loanOutstanding).toFixed(2)}</td></tr>

              <tr className="bg-gray-800 text-white">
                <th className="p-2 text-left">पूंजी (Capital)</th>
                <th className="p-2 text-right">₹ {(stockValue + netCash - staffLiability - loanOutstanding).toFixed(2)}</th>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== INFO BOX ===== */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm no-print">
        <p className="font-semibold text-blue-800 flex items-center gap-1 mb-2"><FaInfoCircle /> सुझाव (Note):</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1 text-xs">
          <li>Balance Sheet अनुमानित है, सटीक चिट्ठा के लिए सभी लेनदेन रिकॉर्ड करें</li>
          <li>Revenue जॉब डिलीवर होने पर माना जाता है (भुगतान मिलने पर नहीं)</li>
          <li>Client Payments नकद आवक है, नई आय नहीं</li>
          <li>ग्राहक को दी गई छूट व्यवसायिक खर्च में जोड़ी गई है</li>
        </ul>
      </div>

      {/* ===== STOCK TOGGLE ===== */}
      <div className="mt-6 no-print">
        <label className="inline-flex items-center cursor-pointer gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 text-blue-600 rounded"
            checked={showStockDetail}
            onChange={() => setShowStockDetail(!showStockDetail)}
          />
          <span className="text-gray-700 font-medium text-sm">विस्तृत स्टॉक विवरण देखें (Show Detailed Stock Table)</span>
        </label>
      </div>

      {showStockDetail && (
        <div className="mt-4 bg-white border rounded-lg p-4">
          <h4 className="font-semibold mb-3 text-sm border-b pb-2">विस्तृत स्टॉक विवरण (Detailed Stock Report)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-white">
                <tr>
                  <th className="p-2 text-center">#</th>
                  <th className="p-2 text-left">Product Name</th>
                  <th className="p-2 text-center">Available Qty</th>
                  <th className="p-2 text-right">Unit Price</th>
                  <th className="p-2 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody>
                {stockItems.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-4 text-gray-500">Koi stock nahi mila.</td></tr>
                ) : (
                  stockItems.map((item, idx) => (
                    <tr key={idx} className="border-t hover:bg-gray-50">
                      <td className="p-2 text-center">{idx + 1}</td>
                      <td className="p-2">{item.name}</td>
                      <td className="p-2 text-center">{toNum(item.quantity).toLocaleString()}</td>
                      <td className="p-2 text-right">₹{toNum(item.price).toFixed(2)}</td>
                      <td className="p-2 text-right font-semibold">₹{(toNum(item.price) * toNum(item.quantity)).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-100">
                <tr>
                  <th colSpan={4} className="p-2 text-right text-sm">Grand Total Stock Value:</th>
                  <th className="p-2 text-right text-blue-600 text-sm">₹{stockValue.toFixed(2)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ========== MODALS ========== */}

      {/* Repair Jobs Modal */}
      {showRepairModal && (
        <Modal title={`Repair Jobs Details (${displayFrom} – ${displayTo})`} onClose={() => setShowRepairModal(false)}>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="p-2 text-left">Job Code</th>
                <th className="p-2 text-left">Client</th>
                <th className="p-2 text-left">Items</th>
                <th className="p-2 text-left">Mechanic</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-right">Commission</th>
                <th className="p-2 text-left">Completed</th>
              </tr>
            </thead>
            <tbody>
              {repairJobs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-4 text-gray-500">Koi repair job nahi mili.</td></tr>
              ) : repairJobs.map((j) => (
                <tr key={j.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">{j.job_id}</td>
                  <td className="p-2">{[j.client_firstname, j.client_middlename, j.client_lastname].filter(Boolean).join(' ')}</td>
                  <td className="p-2">{j.item}</td>
                  <td className="p-2">{j.mechanic_firstname} {j.mechanic_lastname}</td>
                  <td className="p-2 text-right text-green-600">₹{toNum(j.amount).toFixed(2)}</td>
                  <td className="p-2 text-right text-yellow-600">₹{toNum(j.mechanic_commission_amount).toFixed(2)}</td>
                  <td className="p-2 whitespace-nowrap">{safeFormatDate(j.date_completed)}</td>
                </tr>
              ))}
            </tbody>
            {repairJobs.length > 0 && (
              <tfoot className="bg-gray-100 font-semibold">
                <tr>
                  <td colSpan={4} className="p-2 text-right">Total:</td>
                  <td className="p-2 text-right text-green-600">₹{jobIncome.toFixed(2)}</td>
                  <td className="p-2 text-right text-yellow-600">₹{totalCommission.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </Modal>
      )}

      {/* Walk-in Sales Modal */}
      {showWalkinModal && (
        <Modal title={`Walk-in Direct Sales Details (${displayFrom} – ${displayTo})`} onClose={() => setShowWalkinModal(false)}>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="p-2 text-left">Invoice</th>
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-center">Qty</th>
                <th className="p-2 text-right">Unit Price</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {walkinSales.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4 text-gray-500">Koi walk-in sale nahi mili.</td></tr>
              ) : walkinSales.map((s) => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">{s.sale_code}</td>
                  <td className="p-2">{s.product_name || 'Multiple Items'}</td>
                  <td className="p-2 text-center">{s.quantity || '—'}</td>
                  <td className="p-2 text-right">{s.unit_price ? `₹${toNum(s.unit_price).toFixed(2)}` : '—'}</td>
                  <td className="p-2 text-right text-green-600">₹{toNum(s.total_amount).toFixed(2)}</td>
                  <td className="p-2 whitespace-nowrap">{safeFormatDate(s.date_created)}</td>
                </tr>
              ))}
            </tbody>
            {walkinSales.length > 0 && (
              <tfoot className="bg-gray-100 font-semibold">
                <tr><td colSpan={4} className="p-2 text-right">Total:</td><td className="p-2 text-right text-green-600">₹{walkinIncome.toFixed(2)}</td><td></td></tr>
              </tfoot>
            )}
          </table>
        </Modal>
      )}

      {/* Client Sales Modal */}
      {showClientSalesModal && (
        <Modal title={`Client Direct Sales Details (${displayFrom} – ${displayTo})`} onClose={() => setShowClientSalesModal(false)}>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="p-2 text-left">Invoice</th>
                <th className="p-2 text-left">Client</th>
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-center">Qty</th>
                <th className="p-2 text-right">Unit Price</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {clientSales.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-4 text-gray-500">Koi client sale nahi mili.</td></tr>
              ) : clientSales.map((s) => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">{s.sale_code}</td>
                  <td className="p-2">{s.client_firstname} {s.client_lastname}</td>
                  <td className="p-2">{s.product_name || 'Multiple Items'}</td>
                  <td className="p-2 text-center">{s.quantity || '—'}</td>
                  <td className="p-2 text-right">{s.unit_price ? `₹${toNum(s.unit_price).toFixed(2)}` : '—'}</td>
                  <td className="p-2 text-right text-green-600">₹{toNum(s.total_amount).toFixed(2)}</td>
                  <td className="p-2 whitespace-nowrap">{safeFormatDate(s.date_created)}</td>
                </tr>
              ))}
            </tbody>
            {clientSales.length > 0 && (
              <tfoot className="bg-gray-100 font-semibold">
                <tr><td colSpan={5} className="p-2 text-right">Total:</td><td className="p-2 text-right text-green-600">₹{clientSalesIncome.toFixed(2)}</td><td></td></tr>
              </tfoot>
            )}
          </table>
        </Modal>
      )}

      {/* Client Payments Modal */}
      {showClientPaymentsModal && (
        <Modal title={`Client Payments Details (${displayFrom} – ${displayTo})`} onClose={() => setShowClientPaymentsModal(false)}>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="p-2 text-left">Client</th>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-right">Net Received</th>
                <th className="p-2 text-right">Discount</th>
                <th className="p-2 text-right">Total Bill</th>
                <th className="p-2 text-left">Remarks</th>
                <th className="p-2 text-left">Method</th>
              </tr>
            </thead>
            <tbody>
              {clientPayments.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-4 text-gray-500">Koi client payment nahi mili.</td></tr>
              ) : clientPayments.map((p) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">{p.client_firstname} {p.client_lastname}</td>
                  <td className="p-2 whitespace-nowrap">{safeFormatDate(p.payment_date)}</td>
                  <td className="p-2 text-right">₹{toNum(p.amount).toFixed(2)}</td>
                  <td className="p-2 text-right text-red-600">₹{toNum(p.discount).toFixed(2)}</td>
                  <td className="p-2 text-right text-green-600">₹{(toNum(p.amount) + toNum(p.discount)).toFixed(2)}</td>
                  <td className="p-2">{p.remarks || '—'}</td>
                  <td className="p-2">{p.payment_method || 'Cash'}</td>
                </tr>
              ))}
            </tbody>
            {clientPayments.length > 0 && (
              <tfoot className="bg-gray-100 font-semibold">
                <tr>
                  <td colSpan={2} className="p-2 text-right">Total:</td>
                  <td className="p-2 text-right text-green-600">₹{clientPaymentsReceived.toFixed(2)}</td>
                  <td className="p-2 text-right text-red-600">₹{totalDiscountGiven.toFixed(2)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </Modal>
      )}

      {/* Commission Modal */}
      {showCommissionModal && (
        <Modal title={`Mechanic Commission Details (${displayFrom} – ${displayTo})`} onClose={() => setShowCommissionModal(false)}>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="p-2 text-left">Job Code</th>
                <th className="p-2 text-left">Mechanic</th>
                <th className="p-2 text-right">Job Amount</th>
                <th className="p-2 text-right">Commission</th>
                <th className="p-2 text-right">Commission %</th>
                <th className="p-2 text-left">Completed</th>
              </tr>
            </thead>
            <tbody>
              {commissionData.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4 text-gray-500">Koi commission nahi mila.</td></tr>
              ) : commissionData.map((c, idx) => {
                const amt = toNum(c.amount);
                const comm = toNum(c.mechanic_commission_amount);
                return (
                  <tr key={idx} className="border-t hover:bg-gray-50">
                    <td className="p-2">{c.job_id}</td>
                    <td className="p-2">{c.mechanic_firstname} {c.mechanic_lastname}</td>
                    <td className="p-2 text-right">₹{amt.toFixed(2)}</td>
                    <td className="p-2 text-right text-yellow-600">₹{comm.toFixed(2)}</td>
                    <td className="p-2 text-right">{amt > 0 ? ((comm / amt) * 100).toFixed(1) : 0}%</td>
                    <td className="p-2 whitespace-nowrap">{safeFormatDate(c.date_completed)}</td>
                  </tr>
                );
              })}
            </tbody>
            {commissionData.length > 0 && (
              <tfoot className="bg-gray-100 font-semibold">
                <tr><td colSpan={3} className="p-2 text-right">Total:</td><td className="p-2 text-right text-yellow-600">₹{totalCommission.toFixed(2)}</td><td colSpan={2}></td></tr>
              </tfoot>
            )}
          </table>
        </Modal>
      )}

      {/* Discount Modal */}
      {showDiscountModal && (
        <Modal title={`Customer Discount Details (${displayFrom} – ${displayTo})`} onClose={() => setShowDiscountModal(false)}>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="p-2 text-left">Client</th>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-right">Amount Paid</th>
                <th className="p-2 text-right">Discount</th>
                <th className="p-2 text-right">Discount %</th>
                <th className="p-2 text-left">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {clientPayments.filter(p => toNum(p.discount) > 0).length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4 text-gray-500">Koi discount nahi mila.</td></tr>
              ) : clientPayments.filter(p => toNum(p.discount) > 0).map((p) => {
                const amt = toNum(p.amount);
                const disc = toNum(p.discount);
                return (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="p-2">{p.client_firstname} {p.client_lastname}</td>
                    <td className="p-2 whitespace-nowrap">{safeFormatDate(p.payment_date)}</td>
                    <td className="p-2 text-right">₹{amt.toFixed(2)}</td>
                    <td className="p-2 text-right text-red-600">₹{disc.toFixed(2)}</td>
                    <td className="p-2 text-right">{(amt + disc) > 0 ? ((disc / (amt + disc)) * 100).toFixed(1) : 0}%</td>
                    <td className="p-2">{p.remarks || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Modal>
      )}

      {/* Staff Salaries Modal */}
      {showStaffSalariesModal && (
        <Modal title={`Staff Salaries Details (${displayFrom} – ${displayTo})`} onClose={() => setShowStaffSalariesModal(false)}>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="p-2 text-left">Mechanic</th>
                <th className="p-2 text-center">Full Days</th>
                <th className="p-2 text-center">Half Days</th>
                <th className="p-2 text-center">Total Days</th>
                <th className="p-2 text-right">Daily Rate</th>
                <th className="p-2 text-right">Salary Earned</th>
              </tr>
            </thead>
            <tbody>
              {salaryDetails.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4 text-gray-500">Koi salary detail nahi mili.</td></tr>
              ) : salaryDetails.map((s, idx) => (
                <tr key={idx} className="border-t hover:bg-gray-50">
                  <td className="p-2">{s.mechanic_name}</td>
                  <td className="p-2 text-center">{toNum(s.full_days)}</td>
                  <td className="p-2 text-center">{toNum(s.half_days)}</td>
                  <td className="p-2 text-center">{toNum(s.total_days).toFixed(1)}</td>
                  <td className="p-2 text-right">₹{toNum(s.daily_salary).toFixed(2)}</td>
                  <td className="p-2 text-right text-yellow-600">₹{toNum(s.salary_earned).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            {salaryDetails.length > 0 && (
              <tfoot className="bg-gray-100 font-semibold">
                <tr><td colSpan={5} className="p-2 text-right">Total:</td><td className="p-2 text-right text-yellow-600">₹{totalSalary.toFixed(2)}</td></tr>
              </tfoot>
            )}
          </table>
        </Modal>
      )}

      {/* Staff Advance Modal */}
      {showStaffAdvanceModal && (
        <Modal title={`Staff Advance Payments (${displayFrom} – ${displayTo})`} onClose={() => setShowStaffAdvanceModal(false)}>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Staff</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-left">Reason</th>
                <th className="p-2 text-left">Mode</th>
              </tr>
            </thead>
            <tbody>
              {advancePayments.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-4 text-gray-500">Koi advance payment nahi mili.</td></tr>
              ) : advancePayments.map((a, idx) => (
                <tr key={idx} className="border-t hover:bg-gray-50">
                  <td className="p-2 whitespace-nowrap">{safeFormatDate(a.date_paid)}</td>
                  <td className="p-2">{a.mechanic_name}</td>
                  <td className="p-2 text-right text-red-600">₹{toNum(a.amount).toFixed(2)}</td>
                  <td className="p-2">{a.reason || '—'}</td>
                  <td className="p-2">{a.payment_mode || 'Cash'}</td>
                </tr>
              ))}
            </tbody>
            {advancePayments.length > 0 && (
              <tfoot className="bg-gray-100 font-semibold">
                <tr><td colSpan={2} className="p-2 text-right">Total:</td><td className="p-2 text-right text-red-600">₹{totalAdvanceGiven.toFixed(2)}</td><td colSpan={2}></td></tr>
              </tfoot>
            )}
          </table>
        </Modal>
      )}

      {/* Shop Expenses Modal */}
      {showShopExpensesModal && (
        <Modal title={`Shop Expenses Details (${displayFrom} – ${displayTo})`} onClose={() => setShowShopExpensesModal(false)}>
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Category</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-left">Mode</th>
                <th className="p-2 text-left">Reference</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4 text-gray-500">Koi expense nahi mila.</td></tr>
              ) : expenses.map((e, idx) => (
                <tr key={idx} className="border-t hover:bg-gray-50">
                  <td className="p-2 whitespace-nowrap">{safeFormatDate(e.date_created)}</td>
                  <td className="p-2">{e.category}</td>
                  <td className="p-2">{e.remarks}</td>
                  <td className="p-2 text-right text-red-600">₹{toNum(e.amount).toFixed(2)}</td>
                  <td className="p-2">{e.payment_mode || 'Cash'}</td>
                  <td className="p-2">{e.reference || '—'}</td>
                </tr>
              ))}
            </tbody>
            {expenses.length > 0 && (
              <tfoot className="bg-gray-100 font-semibold">
                <tr><td colSpan={3} className="p-2 text-right">Total:</td><td className="p-2 text-right text-red-600">₹{totalOtherExpenses.toFixed(2)}</td><td colSpan={2}></td></tr>
              </tfoot>
            )}
          </table>
        </Modal>
      )}

      {/* Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}