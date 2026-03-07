'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  format,
  subMonths,
  addMonths,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { FaPrint, FaEye, FaChevronLeft, FaChevronRight, FaRedo, FaInfoCircle } from 'react-icons/fa';
import { Loader2 } from 'lucide-react';

// ---------- Types ----------
type Transaction = {
  id: number;
  job_id: string;
  date_completed: string;
  item: string;
  amount: number;
  mechanic_commission_amount: number;
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
  total_amount: number;
  date_created: string;
  client_id: number | null;
  client_firstname?: string;
  client_lastname?: string;
  product_name?: string;
  quantity?: number;
  unit_price?: number;
};

type ClientPayment = {
  id: number;
  client_id: number;
  amount: number;
  discount: number;
  payment_date: string;
  remarks: string | null;
  payment_method: string | null;
  client_firstname?: string;
  client_lastname?: string;
};

type Commission = {
  job_id: string;
  amount: number;
  mechanic_commission_amount: number;
  date_completed: string;
  mechanic_firstname?: string;
  mechanic_lastname?: string;
};

type SalaryDetail = {
  mechanic_name: string;
  full_days: number;
  half_days: number;
  total_days: number;
  daily_salary: number;
  salary_earned: number;
};

type AdvancePayment = {
  date_paid: string;
  mechanic_name: string;
  amount: number;
  reason: string | null;
  payment_mode: string | null;
};

type Expense = {
  date_created: string;
  category: string;
  remarks: string;
  amount: number;
  payment_mode: string | null;
  reference: string | null;
};

type LedgerEntry = {
  date: string;
  category: string;
  details: string;
  type: 'Cash In' | 'Cash Out';
  net_amount: number;
  discount_amount?: number;
  client_id?: number;
  client_fullname?: string;
};

type StockItem = {
  name: string;
  price: number;
  quantity: number;
};

type Props = {
  fromDate?: string;
  toDate?: string;
};

export default function LedgerReportClient({ fromDate, toDate }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(fromDate || format(new Date(), 'yyyy-MM-01'));
  const [to, setTo] = useState(toDate || format(new Date(), 'yyyy-MM-dd'));
  const [showStockDetail, setShowStockDetail] = useState(false);

  // Data states
  const [repairJobs, setRepairJobs] = useState<Transaction[]>([]);
  const [walkinSales, setWalkinSales] = useState<DirectSale[]>([]);
  const [clientSales, setClientSales] = useState<DirectSale[]>([]);
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([]);
  const [commissionData, setCommissionData] = useState<Commission[]>([]);
  const [salaryDetails, setSalaryDetails] = useState<SalaryDetail[]>([]);
  const [advancePayments, setAdvancePayments] = useState<AdvancePayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loanOutstanding, setLoanOutstanding] = useState(0);
  const [staffLiability, setStaffLiability] = useState(0);

  // Summary totals
  const [jobIncome, setJobIncome] = useState(0);
  const [walkinIncome, setWalkinIncome] = useState(0);
  const [clientSalesIncome, setClientSalesIncome] = useState(0);
  const [clientPaymentsReceived, setClientPaymentsReceived] = useState(0);
  const [totalDiscountGiven, setTotalDiscountGiven] = useState(0);
  const [totalSalary, setTotalSalary] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  const [totalAdvanceGiven, setTotalAdvanceGiven] = useState(0);
  const [totalOtherExpenses, setTotalOtherExpenses] = useState(0);
  const [totalEmiPaid, setTotalEmiPaid] = useState(0);
  const [stockValue, setStockValue] = useState(0);

  const totalIncome = jobIncome + walkinIncome + clientSalesIncome;
  const totalBusinessExpense = totalSalary + totalCommission + totalOtherExpenses + totalEmiPaid + totalDiscountGiven;
  const netProfit = totalIncome - totalBusinessExpense;
  const totalCashInflow = clientPaymentsReceived + walkinIncome;
  const totalCashOutflow = totalAdvanceGiven + totalOtherExpenses + totalEmiPaid;

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

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const fromDate = parseISO(from);
        const toDate = parseISO(to);
        const start = startOfDay(fromDate).toISOString();
        const end = endOfDay(toDate).toISOString();

        // Parallel fetch
        const [
          repairRes,
          walkinRes,
          clientSalesRes,
          paymentsRes,
          commissionRes,
          salaryRes,
          advanceRes,
          expenseRes,
          loanRes,
          liabilityRes,
          stockRes,
        ] = await Promise.all([
          // Repair jobs (status=5, completed in range)
          supabase
            .from('transaction_list')
            .select(`
              id, job_id, date_completed, item, amount, mechanic_commission_amount, client_name, mechanic_id,
              client:client_name (firstname, middlename, lastname),
              mechanic:mechanic_id (firstname, lastname)
            `)
            .eq('status', 5)
            .eq('del_status', 0)
            .gte('date_completed', start)
            .lte('date_completed', end),

          // Walk-in direct sales (no client)
          supabase
            .from('direct_sales')
            .select(`
              id, sale_code, total_amount, date_created,
              items:direct_sale_items (product_id, qty, price, product:product_id (name))
            `)
            .is('client_id', null)
            .gte('date_created', start)
            .lte('date_created', end),

          // Client direct sales
          supabase
            .from('direct_sales')
            .select(`
              id, sale_code, total_amount, date_created, client_id,
              client:client_id (firstname, middlename, lastname),
              items:direct_sale_items (product_id, qty, price, product:product_id (name))
            `)
            .not('client_id', 'is', null)
            .gte('date_created', start)
            .lte('date_created', end),

          // Client payments
          supabase
            .from('client_payments')
            .select(`
              id, client_id, amount, discount, payment_date, remarks, payment_method,
              client:client_id (firstname, lastname)
            `)
            .gte('payment_date', from)
            .lte('payment_date', to),

          // Commission (jobs completed in range)
          supabase
            .from('transaction_list')
            .select(`
              job_id, amount, mechanic_commission_amount, date_completed,
              mechanic:mechanic_id (firstname, lastname)
            `)
            .eq('status', 5)
            .gte('date_completed', start)
            .lte('date_completed', end),

          // Salary (attendance)
          supabase
            .from('attendance_list')
            .select(`
              mechanic_id, curr_date, status,
              mechanic:mechanic_id (firstname, lastname, daily_salary)
            `)
            .in('status', [1, 3])
            .gte('curr_date', from)
            .lte('curr_date', to),

          // Advance payments
          supabase
            .from('advance_payments')
            .select(`
              date_paid, amount, reason, payment_mode,
              mechanic:mechanic_id (firstname, lastname)
            `)
            .gte('date_paid', from)
            .lte('date_paid', to),

          // Expenses
          supabase
            .from('expense_list')
            .select('*')
            .gte('date_created', start)
            .lte('date_created', end),

          // Loan payments (for EMI total)
          supabase
            .from('loan_payments')
            .select('amount_paid')
            .gte('payment_date', from)
            .lte('payment_date', to),

          // Staff liability (all-time)
          supabase
            .from('mechanic_list')
            .select('id, firstname, lastname, daily_salary'),

          // Stock value
          supabase
            .from('inventory_list')
            .select('quantity, product:product_id (id, name, price)')
            .gt('quantity', 0),
        ]);

        // Process repair jobs
        if (!repairRes.error && repairRes.data) {
          const jobs = repairRes.data.map((t: any) => ({
            id: t.id,
            job_id: t.job_id,
            date_completed: t.date_completed,
            item: t.item,
            amount: t.amount || 0,
            mechanic_commission_amount: t.mechanic_commission_amount || 0,
            client_id: t.client_name,
            mechanic_id: t.mechanic_id,
            client_firstname: t.client?.firstname,
            client_middlename: t.client?.middlename,
            client_lastname: t.client?.lastname,
            mechanic_firstname: t.mechanic?.firstname,
            mechanic_lastname: t.mechanic?.lastname,
          }));
          setRepairJobs(jobs);
          setJobIncome(jobs.reduce((sum, j) => sum + j.amount, 0));
          setTotalCommission(jobs.reduce((sum, j) => sum + j.mechanic_commission_amount, 0));
        }

        // Process walk-in sales
        if (!walkinRes.error && walkinRes.data) {
          const sales = walkinRes.data.map((s: any) => ({
            id: s.id,
            sale_code: s.sale_code,
            total_amount: s.total_amount || 0,
            date_created: s.date_created,
            client_id: null,
            product_name: s.items?.[0]?.product?.name,
            quantity: s.items?.[0]?.qty,
            unit_price: s.items?.[0]?.price,
          }));
          setWalkinSales(sales);
          setWalkinIncome(sales.reduce((sum, s) => sum + s.total_amount, 0));
        }

        // Process client sales
        if (!clientSalesRes.error && clientSalesRes.data) {
          const sales = clientSalesRes.data.map((s: any) => ({
            id: s.id,
            sale_code: s.sale_code,
            total_amount: s.total_amount || 0,
            date_created: s.date_created,
            client_id: s.client_id,
            client_firstname: s.client?.firstname,
            client_lastname: s.client?.lastname,
            product_name: s.items?.[0]?.product?.name,
            quantity: s.items?.[0]?.qty,
            unit_price: s.items?.[0]?.price,
          }));
          setClientSales(sales);
          setClientSalesIncome(sales.reduce((sum, s) => sum + s.total_amount, 0));
        }

        // Process client payments
        if (!paymentsRes.error && paymentsRes.data) {
          const payments = paymentsRes.data.map((p: any) => ({
            id: p.id,
            client_id: p.client_id,
            amount: p.amount || 0,
            discount: p.discount || 0,
            payment_date: p.payment_date,
            remarks: p.remarks,
            payment_method: p.payment_method,
            client_firstname: p.client?.firstname,
            client_lastname: p.client?.lastname,
          }));
          setClientPayments(payments);
          setClientPaymentsReceived(payments.reduce((sum, p) => sum + p.amount, 0));
          setTotalDiscountGiven(payments.reduce((sum, p) => sum + p.discount, 0));
        }

        // Process commission (already from repair jobs, but we need for modal)
        if (!commissionRes.error && commissionRes.data) {
          const commissions = commissionRes.data.map((c: any) => ({
            job_id: c.job_id,
            amount: c.amount || 0,
            mechanic_commission_amount: c.mechanic_commission_amount || 0,
            date_completed: c.date_completed,
            mechanic_firstname: c.mechanic?.firstname,
            mechanic_lastname: c.mechanic?.lastname,
          }));
          setCommissionData(commissions);
        }

        // Process salary
        if (!salaryRes.error && salaryRes.data) {
          const attendance = salaryRes.data;
          const mechanicMap: Record<number, { name: string; daily: number; full: number; half: number }> = {};
          attendance.forEach((a: any) => {
            const mid = a.mechanic_id;
            if (!mechanicMap[mid]) {
              mechanicMap[mid] = {
                name: `${a.mechanic?.firstname || ''} ${a.mechanic?.lastname || ''}`.trim(),
                daily: a.mechanic?.daily_salary || 0,
                full: 0,
                half: 0,
              };
            }
            if (a.status === 1) mechanicMap[mid].full++;
            else if (a.status === 3) mechanicMap[mid].half++;
          });
          const salaries: SalaryDetail[] = Object.values(mechanicMap).map((m) => {
            const totalDays = m.full + m.half * 0.5;
            const earned = totalDays * m.daily;
            return {
              mechanic_name: m.name,
              full_days: m.full,
              half_days: m.half,
              total_days: totalDays,
              daily_salary: m.daily,
              salary_earned: earned,
            };
          });
          setSalaryDetails(salaries);
          setTotalSalary(salaries.reduce((sum, s) => sum + s.salary_earned, 0));
        }

        // Process advance payments
        if (!advanceRes.error && advanceRes.data) {
          const advances = advanceRes.data.map((a: any) => ({
            date_paid: a.date_paid,
            mechanic_name: a.mechanic ? `${a.mechanic.firstname || ''} ${a.mechanic.lastname || ''}`.trim() : 'Unknown',
            amount: a.amount || 0,
            reason: a.reason,
            payment_mode: a.payment_mode,
          }));
          setAdvancePayments(advances);
          setTotalAdvanceGiven(advances.reduce((sum, a) => sum + a.amount, 0));
        }

        // Process expenses
        if (!expenseRes.error && expenseRes.data) {
          const exps = expenseRes.data.map((e: any) => ({
            date_created: e.date_created,
            category: e.category,
            remarks: e.remarks,
            amount: e.amount || 0,
            payment_mode: e.payment_mode,
            reference: e.reference,
          }));
          setExpenses(exps);
          setTotalOtherExpenses(exps.reduce((sum, e) => sum + e.amount, 0));
        }

        // Loan EMI total
        if (!loanRes.error && loanRes.data) {
          const emiTotal = loanRes.data.reduce((sum: number, l: any) => sum + (l.amount_paid || 0), 0);
          setTotalEmiPaid(emiTotal);
        }

        // Staff liability (all-time)
        if (!liabilityRes.error && liabilityRes.data) {
          let liability = 0;
          const mechanics = liabilityRes.data;
          for (const m of mechanics) {
            const mid = m.id;
            // Earned commission
            const { data: commData } = await supabase
              .from('transaction_list')
              .select('mechanic_commission_amount')
              .eq('mechanic_id', mid)
              .eq('status', 5);
            const earnedComm = commData?.reduce((sum, c) => sum + (c.mechanic_commission_amount || 0), 0) || 0;

            // Earned salary
            const { data: attData } = await supabase
              .from('attendance_list')
              .select('status, curr_date')
              .eq('mechanic_id', mid)
              .in('status', [1, 3]);
            let earnedSal = 0;
            if (attData) {
              for (const a of attData) {
                // Get salary rate at that date
                const { data: rateData } = await supabase
                  .from('mechanic_salary_history')
                  .select('salary')
                  .eq('mechanic_id', mid)
                  .lte('effective_date', a.curr_date)
                  .order('effective_date', { ascending: false })
                  .limit(1);
                const daily = rateData?.[0]?.salary || m.daily_salary || 0;
                earnedSal += a.status === 3 ? daily / 2 : daily;
              }
            }

            // Paid advances
            const { data: advData } = await supabase
              .from('advance_payments')
              .select('amount')
              .eq('mechanic_id', mid);
            const paid = advData?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;

            liability += earnedComm + earnedSal - paid;
          }
          setStaffLiability(liability);
        }

        // Stock value
        if (!stockRes.error && stockRes.data) {
          const items = stockRes.data.map((i: any) => ({
            name: i.product?.name || 'Unknown',
            price: i.product?.price || 0,
            quantity: i.quantity || 0,
          }));
          setStockItems(items);
          setStockValue(items.reduce((sum, i) => sum + i.price * i.quantity, 0));
        }

        // Build ledger entries
        const ledger: LedgerEntry[] = [];

        // Client payments (cash in)
        clientPayments.forEach((p) => {
          ledger.push({
            date: p.payment_date,
            category: 'Client Payment',
            details: `${p.client_firstname || ''} ${p.client_lastname || ''}`.trim() + (p.discount > 0 ? ` (Discount: ₹${p.discount})` : ''),
            type: 'Cash In',
            net_amount: p.amount,
            discount_amount: p.discount,
            client_id: p.client_id,
            client_fullname: `${p.client_firstname || ''} ${p.client_lastname || ''}`.trim(),
          });
        });

        // Walk-in sales (cash in)
        walkinSales.forEach((s) => {
          ledger.push({
            date: s.date_created,
            category: 'Direct Sale (Walk-in)',
            details: `Invoice: ${s.sale_code}`,
            type: 'Cash In',
            net_amount: s.total_amount,
          });
        });

        // Expenses (cash out)
        expenses.forEach((e) => {
          ledger.push({
            date: e.date_created,
            category: 'Shop Expense',
            details: `${e.category} - ${e.remarks}`,
            type: 'Cash Out',
            net_amount: e.amount,
          });
        });

        // Loan payments (cash out)
        const { data: loanPayments } = await supabase
          .from('loan_payments')
          .select('payment_date, amount_paid, remarks')
          .gte('payment_date', from)
          .lte('payment_date', to);
        loanPayments?.forEach((lp) => {
          ledger.push({
            date: lp.payment_date,
            category: 'Loan EMI',
            details: lp.remarks || 'EMI Payment',
            type: 'Cash Out',
            net_amount: lp.amount_paid || 0,
          });
        });

        // Advance payments (cash out)
        advancePayments.forEach((a) => {
          ledger.push({
            date: a.date_paid,
            category: 'Staff Advance',
            details: `${a.mechanic_name} - ${a.reason || ''}`,
            type: 'Cash Out',
            net_amount: a.amount,
          });
        });

        // Sort by date
        ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setLedgerEntries(ledger);

      } catch (err) {
        console.error('Error fetching ledger data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [from, to]);

  // Handle filter submit
  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set('from', from);
    params.set('to', to);
    router.push(`/reports/ledger?${params.toString()}`);
  };

  // Navigate to previous/next month
  const goToMonth = (direction: 'prev' | 'next') => {
    const currentFrom = parseISO(from);
    const newFrom = direction === 'prev' ? subMonths(currentFrom, 1) : addMonths(currentFrom, 1);
    const newTo = direction === 'prev' ? subMonths(parseISO(to), 1) : addMonths(parseISO(to), 1);
    setFrom(format(newFrom, 'yyyy-MM-dd'));
    setTo(format(newTo, 'yyyy-MM-dd'));
    // Trigger re-fetch via useEffect
  };

  // Reset to current month
  const resetToCurrentMonth = () => {
    const today = new Date();
    setFrom(format(startOfMonth(today), 'yyyy-MM-dd'));
    setTo(format(endOfMonth(today), 'yyyy-MM-dd'));
  };

  // Helper: format date
  const formatDate = (dateStr: string) => format(parseISO(dateStr), 'dd MMM yyyy');

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-white rounded-lg shadow">
      {/* Header with print button */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Business Ledger & Cash Flow</h2>
        <button
          onClick={() => window.print()}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
        >
          <FaPrint /> Print
        </button>
      </div>

      {/* Filter Form */}
      <form onSubmit={handleFilter} className="bg-gray-50 p-4 rounded mb-6 no-print">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700">From Date</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">To Date</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
            >
              Filter
            </button>
            <button
              type="button"
              onClick={() => goToMonth('prev')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded text-sm"
              title="Previous Month"
            >
              <FaChevronLeft />
            </button>
            <button
              type="button"
              onClick={resetToCurrentMonth}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded text-sm"
              title="Reset to Current Month"
            >
              <FaRedo />
            </button>
            <button
              type="button"
              onClick={() => goToMonth('next')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded text-sm"
              title="Next Month"
            >
              <FaChevronRight />
            </button>
          </div>
        </div>
      </form>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Net Revenue</p>
          <p className="text-2xl font-bold text-green-700">₹ {totalIncome.toFixed(2)}</p>
          <p className="text-xs text-gray-500">Repair + all direct sales</p>
        </div>
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Total Expenses</p>
          <p className="text-2xl font-bold text-red-700">₹ {totalBusinessExpense.toFixed(2)}</p>
          <p className="text-xs text-gray-500">Salaries + Comm + Exp + EMI + Discount</p>
        </div>
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded shadow">
          <p className="text-sm text-gray-600">Cash Received</p>
          <p className="text-2xl font-bold text-blue-700">₹ {totalCashInflow.toFixed(2)}</p>
          <p className="text-xs text-gray-500">Client payments + walk-in sales</p>
        </div>
        <div className={`${netProfit >= 0 ? 'bg-indigo-50 border-indigo-500' : 'bg-yellow-50 border-yellow-500'} border-l-4 p-4 rounded shadow`}>
          <p className="text-sm text-gray-600">Net Profit/Loss</p>
          <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-indigo-700' : 'text-yellow-700'}`}>
            ₹ {netProfit.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Business Performance (P&L) */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Business Performance (P&L)</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr className="bg-gray-100"><th colSpan={2} className="p-2 text-left">Revenue (कमाई)</th></tr>
              <tr>
                <td className="p-2">
                  <button onClick={() => setShowRepairModal(true)} className="text-blue-600 hover:underline flex items-center gap-1">
                    <FaEye size={14} /> Repair Jobs Income
                  </button>
                </td>
                <td className="p-2 text-right">₹ {jobIncome.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-2">
                  <button onClick={() => setShowWalkinModal(true)} className="text-blue-600 hover:underline flex items-center gap-1">
                    <FaEye size={14} /> Walk-in Direct Sales
                  </button>
                </td>
                <td className="p-2 text-right">₹ {walkinIncome.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-2">
                  <button onClick={() => setShowClientSalesModal(true)} className="text-blue-600 hover:underline flex items-center gap-1">
                    <FaEye size={14} /> Client Direct Sales
                  </button>
                </td>
                <td className="p-2 text-right">₹ {clientSalesIncome.toFixed(2)}</td>
              </tr>
              <tr className="bg-gray-100"><th className="p-2 text-left">Net Revenue</th><th className="p-2 text-right">₹ {totalIncome.toFixed(2)}</th></tr>

              <tr className="bg-gray-100"><th colSpan={2} className="p-2 text-left">Expenses (खर्च)</th></tr>
              <tr>
                <td className="p-2">
                  <button onClick={() => setShowStaffSalariesModal(true)} className="text-blue-600 hover:underline flex items-center gap-1">
                    <FaEye size={14} /> Staff Salaries
                  </button>
                </td>
                <td className="p-2 text-right text-red-600">₹ {totalSalary.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-2">
                  <button onClick={() => setShowCommissionModal(true)} className="text-blue-600 hover:underline flex items-center gap-1">
                    <FaEye size={14} /> Mechanic Commission
                  </button>
                </td>
                <td className="p-2 text-right text-red-600">₹ {totalCommission.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-2">
                  <button onClick={() => setShowShopExpensesModal(true)} className="text-blue-600 hover:underline flex items-center gap-1">
                    <FaEye size={14} /> Shop Expenses
                  </button>
                </td>
                <td className="p-2 text-right text-red-600">₹ {totalOtherExpenses.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-2">Loan EMI Payments</td>
                <td className="p-2 text-right text-red-600">₹ {totalEmiPaid.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-2">
                  <button onClick={() => setShowDiscountModal(true)} className="text-blue-600 hover:underline flex items-center gap-1">
                    <FaEye size={14} /> Customer Discount Given
                  </button>
                </td>
                <td className="p-2 text-right text-red-600">₹ {totalDiscountGiven.toFixed(2)}</td>
              </tr>
              <tr className="bg-gray-100"><th className="p-2 text-left">Total Expenses</th><th className="p-2 text-right text-red-600">₹ {totalBusinessExpense.toFixed(2)}</th></tr>

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
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Cash Flow (नकदी प्रवाह)</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr className="bg-gray-100"><th colSpan={2} className="p-2 text-left">Cash Inflow (नकद आय)</th></tr>
              <tr>
                <td className="p-2">
                  <button onClick={() => setShowClientPaymentsModal(true)} className="text-blue-600 hover:underline flex items-center gap-1">
                    <FaEye size={14} /> Client Payments Received
                  </button>
                </td>
                <td className="p-2 text-right text-green-600">₹ {clientPaymentsReceived.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-2">
                  <button onClick={() => setShowWalkinModal(true)} className="text-blue-600 hover:underline flex items-center gap-1">
                    <FaEye size={14} /> Walk-in Direct Sales
                  </button>
                </td>
                <td className="p-2 text-right text-green-600">₹ {walkinIncome.toFixed(2)}</td>
              </tr>
              <tr className="bg-gray-100"><th className="p-2 text-left">Total Cash In</th><th className="p-2 text-right text-green-600">₹ {totalCashInflow.toFixed(2)}</th></tr>

              <tr className="bg-gray-100"><th colSpan={2} className="p-2 text-left">Cash Outflow (नकद भुगतान)</th></tr>
              <tr>
                <td className="p-2">
                  <button onClick={() => setShowStaffAdvanceModal(true)} className="text-blue-600 hover:underline flex items-center gap-1">
                    <FaEye size={14} /> Staff Advance/Salary Paid
                  </button>
                </td>
                <td className="p-2 text-right text-red-600">₹ {totalAdvanceGiven.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-2">
                  <button onClick={() => setShowShopExpensesModal(true)} className="text-blue-600 hover:underline flex items-center gap-1">
                    <FaEye size={14} /> Shop Expenses Paid
                  </button>
                </td>
                <td className="p-2 text-right text-red-600">₹ {totalOtherExpenses.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="p-2">Loan EMI Paid</td>
                <td className="p-2 text-right text-red-600">₹ {totalEmiPaid.toFixed(2)}</td>
              </tr>
              <tr className="bg-gray-100"><th className="p-2 text-left">Total Cash Out</th><th className="p-2 text-right text-red-600">₹ {totalCashOutflow.toFixed(2)}</th></tr>

              <tr className="bg-blue-500 text-white">
                <th className="p-2 text-left">Net Cash Flow</th>
                <th className="p-2 text-right">₹ {(totalCashInflow - totalCashOutflow).toFixed(2)}</th>
              </tr>
            </tbody>
          </table>
          <div className="mt-4 p-3 bg-yellow-50 rounded text-sm">
            <FaInfoCircle className="inline mr-1 text-yellow-600" />
            <strong>Important:</strong>
            <ul className="list-disc list-inside text-gray-700">
              <li>Repair Job Revenue is recognized when job is completed.</li>
              <li>Client Payments are collections against invoices (not new revenue).</li>
              <li>Direct Sales to clients are revenue but cash is received later via client payments.</li>
              <li>Discount given to customers is treated as business expense.</li>
              <li>Click on <FaEye className="inline text-blue-600" /> icons to view details.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Transaction Ledger */}
      <div className="mt-8 bg-white border rounded-lg overflow-hidden">
        <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center">
          <h3 className="font-semibold">Transaction Ledger (Cash Flow)</h3>
          <div className="space-x-2">
            <span className="badge bg-green-600 text-white px-2 py-1 rounded text-xs">Cash In</span>
            <span className="badge bg-red-600 text-white px-2 py-1 rounded text-xs">Cash Out</span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Details</th>
                <th className="px-3 py-2 text-right">Cash In</th>
                <th className="px-3 py-2 text-right">Cash Out</th>
                <th className="px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4 text-gray-500">No transactions found.</td></tr>
              ) : (
                (() => {
                  let runningBalance = 0;
                  return ledgerEntries.map((entry, idx) => {
                    if (entry.type === 'Cash In') runningBalance += entry.net_amount;
                    else runningBalance -= entry.net_amount;
                    return (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2">{formatDate(entry.date)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${entry.type === 'Cash In' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {entry.category}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {entry.client_fullname ? (
                            <Link href={`/clients/${entry.client_id}/view`} className="text-blue-600 hover:underline">
                              {entry.client_fullname}
                            </Link>
                          ) : (
                            entry.details
                          )}
                          {entry.discount_amount ? <span className="text-red-500 ml-1">(-₹{entry.discount_amount})</span> : ''}
                        </td>
                        <td className="px-3 py-2 text-right text-green-600 font-medium">
                          {entry.type === 'Cash In' ? `₹${entry.net_amount.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-right text-red-600 font-medium">
                          {entry.type === 'Cash Out' ? `₹${entry.net_amount.toFixed(2)}` : '-'}
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${runningBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
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
        <div className="p-3 bg-gray-100 flex justify-between items-center">
          <span className="text-sm">Total Cash In: <span className="text-green-600 font-bold">₹{totalCashInflow.toFixed(2)}</span></span>
          <span className="text-sm">Total Cash Out: <span className="text-red-600 font-bold">₹{totalCashOutflow.toFixed(2)}</span></span>
          <span className="text-sm">Closing Balance: <span className="text-blue-600 font-bold">₹{(totalCashInflow - totalCashOutflow).toFixed(2)}</span></span>
        </div>
      </div>

      {/* Expense and Advance Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Shop Expenses */}
        <div className="bg-white border rounded-lg p-4">
          <h4 className="font-semibold mb-3">Shop Expense Details</h4>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Expense Name</th><th className="p-2 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-4 text-gray-500">No expenses found.</td></tr>
                ) : (
                  expenses.map((e, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{formatDate(e.date_created)}</td>
                      <td className="p-2">{e.remarks}</td>
                      <td className="p-2 text-right text-red-600">₹{e.amount.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Staff Advance */}
        <div className="bg-white border rounded-lg p-4">
          <h4 className="font-semibold mb-3">Staff Advance List</h4>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Staff</th><th className="p-2 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {advancePayments.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-4 text-gray-500">No advances found.</td></tr>
                ) : (
                  advancePayments.map((a, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{formatDate(a.date_paid)}</td>
                      <td className="p-2">{a.mechanic_name}</td>
                      <td className="p-2 text-right text-orange-600">₹{a.amount.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Trading Account & Balance Sheet */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Trading Account */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">व्यापारिक खाता (Trading/P&L Account)</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr className="bg-gray-100"><th colSpan={2} className="p-2 text-left">आय (Income)</th></tr>
              <tr><td className="p-2">सर्विस राजस्व (Service Revenue)</td><td className="p-2 text-right">₹ {jobIncome.toFixed(2)}</td></tr>
              <tr><td className="p-2">वॉक-इन बिक्री (Walk-in Sales)</td><td className="p-2 text-right">₹ {walkinIncome.toFixed(2)}</td></tr>
              <tr><td className="p-2">ग्राहक बिक्री (Client Sales)</td><td className="p-2 text-right">₹ {clientSalesIncome.toFixed(2)}</td></tr>
              <tr className="bg-gray-100"><th className="p-2 text-left">शुद्ध आय (Net Revenue)</th><th className="p-2 text-right">₹ {totalIncome.toFixed(2)}</th></tr>

              <tr className="bg-gray-100"><th colSpan={2} className="p-2 text-left">व्यय (Expenses)</th></tr>
              <tr><td className="p-2">वेतन (Salaries)</td><td className="p-2 text-right text-red-600">₹ {totalSalary.toFixed(2)}</td></tr>
              <tr><td className="p-2">कमीशन (Commission)</td><td className="p-2 text-right text-red-600">₹ {totalCommission.toFixed(2)}</td></tr>
              <tr><td className="p-2">दुकान खर्च (Shop Expenses)</td><td className="p-2 text-right text-red-600">₹ {totalOtherExpenses.toFixed(2)}</td></tr>
              <tr><td className="p-2">लोन किस्त (Loan EMI)</td><td className="p-2 text-right text-red-600">₹ {totalEmiPaid.toFixed(2)}</td></tr>
              <tr><td className="p-2">ग्राहक छूट (Customer Discount)</td><td className="p-2 text-right text-red-600">₹ {totalDiscountGiven.toFixed(2)}</td></tr>
              <tr className="bg-gray-100"><th className="p-2 text-left">कुल व्यय (Total Expenses)</th><th className="p-2 text-right text-red-600">₹ {totalBusinessExpense.toFixed(2)}</th></tr>

              <tr className="bg-gray-800 text-white"><th className="p-2 text-left">शुद्ध लाभ/हानि (Net Profit/Loss)</th><th className={`p-2 text-right ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>₹ {netProfit.toFixed(2)}</th></tr>
            </tbody>
          </table>
        </div>

        {/* Balance Sheet */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">चिट्ठा (Balance Sheet)</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr className="bg-gray-100"><th colSpan={2} className="p-2 text-left">संपत्ति (Assets)</th></tr>
              <tr><td className="p-2">स्टॉक मूल्य (Inventory Value)</td><td className="p-2 text-right">₹ {stockValue.toFixed(2)}</td></tr>
              <tr><td className="p-2">नकद शेष (Cash Balance)</td><td className="p-2 text-right">₹ {(totalCashInflow - totalCashOutflow).toFixed(2)}</td></tr>
              <tr className="bg-gray-100"><th className="p-2 text-left">कुल संपत्ति (Total Assets)</th><th className="p-2 text-right">₹ {(stockValue + (totalCashInflow - totalCashOutflow)).toFixed(2)}</th></tr>

              <tr className="bg-gray-100"><th colSpan={2} className="p-2 text-left">दायित्व (Liabilities)</th></tr>
              <tr><td className="p-2">स्टाफ बकाया (Staff Payable)</td><td className="p-2 text-right text-red-600">₹ {staffLiability.toFixed(2)}</td></tr>
              <tr><td className="p-2">लोन बकाया (Loan Outstanding)</td><td className="p-2 text-right text-red-600">₹ {loanOutstanding.toFixed(2)}</td></tr>
              <tr className="bg-gray-100"><th className="p-2 text-left">कुल दायित्व (Total Liabilities)</th><th className="p-2 text-right text-red-600">₹ {(staffLiability + loanOutstanding).toFixed(2)}</th></tr>

              <tr className="bg-gray-800 text-white"><th className="p-2 text-left">पूंजी (Capital)</th><th className="p-2 text-right">₹ {(stockValue + (totalCashInflow - totalCashOutflow) - (staffLiability + loanOutstanding)).toFixed(2)}</th></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Toggle */}
      <div className="mt-6 no-print">
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="form-checkbox h-5 w-5 text-blue-600"
            checked={showStockDetail}
            onChange={() => setShowStockDetail(!showStockDetail)}
          />
          <span className="ml-2 text-gray-700 font-medium">विस्तृत स्टॉक विवरण देखें (Show Detailed Stock Table)</span>
        </label>
      </div>

      {showStockDetail && (
        <div className="mt-4 bg-white border rounded-lg p-4">
          <h4 className="font-semibold mb-3">विस्तृत स्टॉक विवरण (Detailed Stock Report)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-white">
                <tr><th className="p-2 text-center">#</th><th className="p-2 text-left">Product Name</th><th className="p-2 text-center">Available Qty</th><th className="p-2 text-right">Unit Price</th><th className="p-2 text-right">Total Value</th></tr>
              </thead>
              <tbody>
                {stockItems.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-4 text-gray-500">No stock available.</td></tr>
                ) : (
                  stockItems.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2 text-center">{idx + 1}</td>
                      <td className="p-2">{item.name}</td>
                      <td className="p-2 text-center">{item.quantity}</td>
                      <td className="p-2 text-right">₹{item.price.toFixed(2)}</td>
                      <td className="p-2 text-right font-semibold">₹{(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-100">
                <tr><th colSpan={4} className="p-2 text-right">Grand Total Stock Value:</th><th className="p-2 text-right text-blue-600">₹{stockValue.toFixed(2)}</th></tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Modals – similar to PHP popups */}
      {/* Repair Jobs Modal */}
      {showRepairModal && (
        <Modal title="Repair Jobs Details" onClose={() => setShowRepairModal(false)}>
          <table className="w-full text-sm">
            <thead><tr><th>Job Code</th><th>Client</th><th>Items</th><th>Mechanic</th><th className="text-right">Amount</th><th className="text-right">Commission</th><th>Completed</th></tr></thead>
            <tbody>
              {repairJobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.job_id}</td>
                  <td>{j.client_firstname} {j.client_lastname}</td>
                  <td>{j.item}</td>
                  <td>{j.mechanic_firstname} {j.mechanic_lastname}</td>
                  <td className="text-right text-green-600">₹{j.amount.toFixed(2)}</td>
                  <td className="text-right text-yellow-600">₹{j.mechanic_commission_amount.toFixed(2)}</td>
                  <td>{formatDate(j.date_completed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}

      {/* Walk-in Sales Modal */}
      {showWalkinModal && (
        <Modal title="Walk-in Direct Sales Details" onClose={() => setShowWalkinModal(false)}>
          <table className="w-full text-sm">
            <thead><tr><th>Invoice</th><th>Product</th><th>Qty</th><th className="text-right">Unit Price</th><th className="text-right">Total</th><th>Date</th></tr></thead>
            <tbody>
              {walkinSales.map((s) => (
                <tr key={s.id}>
                  <td>{s.sale_code}</td>
                  <td>{s.product_name || 'Multiple Items'}</td>
                  <td>{s.quantity || '-'}</td>
                  <td className="text-right">{s.unit_price ? `₹${s.unit_price.toFixed(2)}` : '-'}</td>
                  <td className="text-right text-green-600">₹{s.total_amount.toFixed(2)}</td>
                  <td>{formatDate(s.date_created)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}

      {/* Client Sales Modal */}
      {showClientSalesModal && (
        <Modal title="Client Direct Sales Details" onClose={() => setShowClientSalesModal(false)}>
          <table className="w-full text-sm">
            <thead><tr><th>Invoice</th><th>Client</th><th>Product</th><th>Qty</th><th className="text-right">Unit Price</th><th className="text-right">Total</th><th>Date</th></tr></thead>
            <tbody>
              {clientSales.map((s) => (
                <tr key={s.id}>
                  <td>{s.sale_code}</td>
                  <td>{s.client_firstname} {s.client_lastname}</td>
                  <td>{s.product_name || 'Multiple Items'}</td>
                  <td>{s.quantity || '-'}</td>
                  <td className="text-right">{s.unit_price ? `₹${s.unit_price.toFixed(2)}` : '-'}</td>
                  <td className="text-right text-green-600">₹{s.total_amount.toFixed(2)}</td>
                  <td>{formatDate(s.date_created)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}

      {/* Client Payments Modal */}
      {showClientPaymentsModal && (
        <Modal title="Client Payments Details" onClose={() => setShowClientPaymentsModal(false)}>
          <table className="w-full text-sm">
            <thead><tr><th>Client</th><th>Date</th><th className="text-right">Net Received</th><th className="text-right">Discount</th><th className="text-right">Total Bill</th><th>Remarks</th><th>Method</th></tr></thead>
            <tbody>
              {clientPayments.map((p) => (
                <tr key={p.id}>
                  <td>{p.client_firstname} {p.client_lastname}</td>
                  <td>{formatDate(p.payment_date)}</td>
                  <td className="text-right">₹{p.amount.toFixed(2)}</td>
                  <td className="text-right text-red-600">₹{p.discount.toFixed(2)}</td>
                  <td className="text-right text-green-600">₹{(p.amount + p.discount).toFixed(2)}</td>
                  <td>{p.remarks || ''}</td>
                  <td>{p.payment_method || 'Cash'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}

      {/* Commission Modal */}
      {showCommissionModal && (
        <Modal title="Mechanic Commission Details" onClose={() => setShowCommissionModal(false)}>
          <table className="w-full text-sm">
            <thead><tr><th>Job Code</th><th>Mechanic</th><th className="text-right">Job Amount</th><th className="text-right">Commission</th><th className="text-right">Commission %</th><th>Completed</th></tr></thead>
            <tbody>
              {commissionData.map((c, idx) => (
                <tr key={idx}>
                  <td>{c.job_id}</td>
                  <td>{c.mechanic_firstname} {c.mechanic_lastname}</td>
                  <td className="text-right">₹{c.amount.toFixed(2)}</td>
                  <td className="text-right text-yellow-600">₹{c.mechanic_commission_amount.toFixed(2)}</td>
                  <td className="text-right">{c.amount > 0 ? ((c.mechanic_commission_amount / c.amount) * 100).toFixed(1) : 0}%</td>
                  <td>{formatDate(c.date_completed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}

      {/* Discount Modal */}
      {showDiscountModal && (
        <Modal title="Customer Discount Details" onClose={() => setShowDiscountModal(false)}>
          <table className="w-full text-sm">
            <thead><tr><th>Client</th><th>Date</th><th className="text-right">Original Amt</th><th className="text-right">Discount</th><th className="text-right">Discount %</th><th>Remarks</th></tr></thead>
            <tbody>
              {clientPayments.filter(p => p.discount > 0).map((p) => (
                <tr key={p.id}>
                  <td>{p.client_firstname} {p.client_lastname}</td>
                  <td>{formatDate(p.payment_date)}</td>
                  <td className="text-right">₹{p.amount.toFixed(2)}</td>
                  <td className="text-right text-red-600">₹{p.discount.toFixed(2)}</td>
                  <td className="text-right">{p.amount > 0 ? ((p.discount / p.amount) * 100).toFixed(1) : 0}%</td>
                  <td>{p.remarks || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}

      {/* Staff Salaries Modal */}
      {showStaffSalariesModal && (
        <Modal title="Staff Salaries Details" onClose={() => setShowStaffSalariesModal(false)}>
          <table className="w-full text-sm">
            <thead><tr><th>Mechanic</th><th className="text-center">Full Days</th><th className="text-center">Half Days</th><th className="text-center">Total Days</th><th className="text-right">Daily Rate</th><th className="text-right">Salary Earned</th></tr></thead>
            <tbody>
              {salaryDetails.map((s, idx) => (
                <tr key={idx}>
                  <td>{s.mechanic_name}</td>
                  <td className="text-center">{s.full_days}</td>
                  <td className="text-center">{s.half_days}</td>
                  <td className="text-center">{s.total_days.toFixed(1)}</td>
                  <td className="text-right">₹{s.daily_salary.toFixed(2)}</td>
                  <td className="text-right text-yellow-600">₹{s.salary_earned.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}

      {/* Staff Advance Modal */}
      {showStaffAdvanceModal && (
        <Modal title="Staff Advance Payments" onClose={() => setShowStaffAdvanceModal(false)}>
          <table className="w-full text-sm">
            <thead><tr><th>Date</th><th>Staff</th><th className="text-right">Amount</th><th>Reason</th><th>Mode</th></tr></thead>
            <tbody>
              {advancePayments.map((a, idx) => (
                <tr key={idx}>
                  <td>{formatDate(a.date_paid)}</td>
                  <td>{a.mechanic_name}</td>
                  <td className="text-right text-red-600">₹{a.amount.toFixed(2)}</td>
                  <td>{a.reason || ''}</td>
                  <td>{a.payment_mode || 'Cash'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}

      {/* Shop Expenses Modal */}
      {showShopExpensesModal && (
        <Modal title="Shop Expenses Details" onClose={() => setShowShopExpensesModal(false)}>
          <table className="w-full text-sm">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="text-right">Amount</th><th>Mode</th><th>Reference</th></tr></thead>
            <tbody>
              {expenses.map((e, idx) => (
                <tr key={idx}>
                  <td>{formatDate(e.date_created)}</td>
                  <td>{e.category}</td>
                  <td>{e.remarks}</td>
                  <td className="text-right text-red-600">₹{e.amount.toFixed(2)}</td>
                  <td>{e.payment_mode || 'Cash'}</td>
                  <td>{e.reference || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}

// Simple Modal Component
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-auto">
        <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center sticky top-0">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300">✕</button>
        </div>
        <div className="p-4 overflow-x-auto">{children}</div>
      </div>
    </div>
  );
}