"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Chart from 'chart.js/auto';
import { 
  Wrench, 
  Clock, 
  CheckCircle, 
  IndianRupee, 
  TrendingUp, 
  Users, 
  ArrowRight,
  AlertCircle,
  Zap,
  Sparkles,
  Loader2,
  DollarSign,
  PieChart,
  CreditCard
} from 'lucide-react';

type Profile = {
  full_name: string;
  role: string;
};

type Stat = {
  totalClients: number;
  pendingJobs: number;
  inProgressJobs: number;
  finishedJobs: number;
  deliveredJobs: number;
  totalMechanics: number;
  lowStock: number;
  todayRevenue: number;
};

type Financial = {
  totalSales: number;
  partsCost: number;
  grossProfit: number;
  discounts: number;
  salary: number;
  loanPaid: number;
  expenses: number;
  totalOutflow: number;
  netProfit: number;
};

type MonthlyRevenue = {
  labels: string[];
  data: number[];
};

type StatusCount = number[];

type RecentJob = {
  id: number;
  job_id: string | null;
  client_name: string;
  item: string;
  amount: number;
  status: number;
};

type RecentPayment = {
  id: number;
  amount: number;
  payment_mode: string;
  payment_date: string;
  client_list: { firstname: string; lastname: string } | null;
};

type LowStockItem = {
  name: string;
  quantity: number;
  place: string;
};

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stat>({
    totalClients: 0,
    pendingJobs: 0,
    inProgressJobs: 0,
    finishedJobs: 0,
    deliveredJobs: 0,
    totalMechanics: 0,
    lowStock: 0,
    todayRevenue: 0,
  });
  const [financial, setFinancial] = useState<Financial>({
    totalSales: 0,
    partsCost: 0,
    grossProfit: 0,
    discounts: 0,
    salary: 0,
    loanPaid: 0,
    expenses: 0,
    totalOutflow: 0,
    netProfit: 0,
  });
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue>({ labels: [], data: [] });
  const [statusCounts, setStatusCounts] = useState<StatusCount>([0, 0, 0, 0, 0, 0]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [to, setTo] = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  const revenueChartRef = useRef<HTMLCanvasElement>(null);
  const statusChartRef = useRef<HTMLCanvasElement>(null);
  const [revenueChartInstance, setRevenueChartInstance] = useState<Chart | null>(null);
  const [statusChartInstance, setStatusChartInstance] = useState<Chart | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // User Profile
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, role')
            .eq('id', user.id)
            .single();

          if (profileData) {
            setProfile(profileData);
          } else {
            const metaName = user.user_metadata?.full_name;
            setProfile({ full_name: metaName || user.email?.split('@')[0] || 'User', role: 'staff' });
          }
        }

        // Stats
        const today = new Date().toISOString().split('T')[0];

        const { count: clientCount } = await supabase.from('client_list').select('count').eq('delete_flag', 0);
        const totalClients = clientCount || 0;

        const { data: allTransactions } = await supabase.from('transaction_list').select('*');
        const activeTransactions = allTransactions?.filter((t: any) => t.del_status === 0) || [];

        const pendingJobs = activeTransactions.filter((t: any) => t.status === 0).length;
        const inProgressJobs = activeTransactions.filter((t: any) => t.status === 1).length;
        const finishedJobs = activeTransactions.filter((t: any) => t.status === 2).length;
        const deliveredJobs = activeTransactions.filter((t: any) => t.status === 5).length;

        const { count: mechanicCount } = await supabase.from('mechanic_list').select('count').eq('delete_flag', 0);
        const totalMechanics = mechanicCount || 0;

        const { data: lowInventory } = await supabase.from('inventory_list').select('product_id').lte('quantity', 5);
        const lowStock = [...new Set(lowInventory?.map((i: any) => i.product_id))].length;

        const repairRev = activeTransactions
          .filter((t: any) => t.status === 5 && t.date_completed?.split('T')[0] === today)
          .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

        const { data: directSalesData } = await supabase.from('direct_sales').select('total_amount, date_created');
        const directRev = directSalesData
          ?.filter((d: any) => d.date_created.split('T')[0] === today)
          .reduce((sum: number, d: any) => sum + (d.total_amount || 0), 0) || 0;

        const todayRevenue = repairRev + directRev;

        setStats({
          totalClients,
          pendingJobs,
          inProgressJobs,
          finishedJobs,
          deliveredJobs,
          totalMechanics,
          lowStock,
          todayRevenue,
        });

        // Status Counts
        const counts = [0, 1, 2, 3, 4, 5].map(s => activeTransactions.filter((t: any) => t.status === s).length);
        setStatusCounts(counts);

        // Monthly Revenue
        const labels: string[] = [];
        const data: number[] = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
          const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          labels.push(monthDate.toLocaleString('default', { month: 'short', year: 'numeric' }));

          const start = monthDate.toISOString().split('T')[0];
          const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
          const end = endDate.toISOString().split('T')[0];

          const rep = activeTransactions
            .filter((t: any) => t.status === 5 && t.date_completed && t.date_completed.split('T')[0] >= start && t.date_completed.split('T')[0] <= end)
            .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

          const dir = directSalesData
            ?.filter((d: any) => d.date_created.split('T')[0] >= start && d.date_created.split('T')[0] <= end)
            .reduce((sum: number, d: any) => sum + (d.total_amount || 0), 0) || 0;

          data.push(rep + dir);
        }
        setMonthlyRevenue({ labels, data });

        // Recent Jobs
        const { data: recentTrans } = await supabase
          .from('transaction_list')
          .select('id, job_id, client_name, item, amount, status')
          .order('id', { ascending: false })
          .limit(5);
        setRecentJobs(recentTrans || []);

        // Recent Payments
        const { data: paymentsData } = await supabase
          .from('client_payments')
          .select('id, amount, payment_mode, payment_date, client_list(firstname, lastname)')
          .order('payment_date', { ascending: false })
          .order('id', { ascending: false })
          .limit(10);
        setRecentPayments(paymentsData || []);

        // Low Stock Items
        const { data: lowInvData } = await supabase
          .from('inventory_list')
          .select('quantity, place, product_list(name)')
          .lte('quantity', 5)
          .order('quantity', { ascending: true })
          .limit(10);
        setLowStockItems(lowInvData?.map((i: any) => ({
          name: i.product_list.name,
          quantity: i.quantity,
          place: i.place
        })) || []);

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    const fetchFinancialData = async () => {
      if (!profile || profile.role !== 'admin') return;

      try {
        const { data: transData } = await supabase
          .from('transaction_list')
          .select('amount, status, date_completed')
          .gte('date_completed', from)
          .lte('date_completed', to);

        const repairInc = transData
          ?.filter((t: any) => t.status === 5)
          .reduce((sum: number, t: any) => sum + (t.amount || 0), 0) || 0;

        const { data: directData } = await supabase
          .from('direct_sales')
          .select('total_amount, date_created')
          .gte('date_created', from)
          .lte('date_created', to);

        const directInc = directData
          ?.reduce((sum: number, d: any) => sum + (d.total_amount || 0), 0) || 0;

        const totalSales = repairInc + directInc;

        const { data: transProdData } = await supabase
          .from('transaction_products')
          .select('qty, price, transaction_list(status, date_completed)')
          .gte('transaction_list.date_completed', from)
          .lte('transaction_list.date_completed', to)
          .eq('transaction_list.status', 5);

        const partsTrans = transProdData
          ?.reduce((sum: number, tp: any) => sum + (tp.qty * tp.price), 0) || 0;

        const { data: directItemsData } = await supabase
          .from('direct_sale_items')
          .select('qty, price, direct_sales(date_created)')
          .gte('direct_sales.date_created', from)
          .lte('direct_sales.date_created', to);

        const partsDirect = directItemsData
          ?.reduce((sum: number, ds: any) => sum + (ds.qty * ds.price), 0) || 0;

        const totalPartsSold = partsTrans + partsDirect;
        const partsCost = totalPartsSold * 0.9;
        const grossProfit = totalSales - partsCost;

        const { data: paymentsData } = await supabase
          .from('client_payments')
          .select('discount')
          .gte('created_at', from)
          .lte('created_at', to);

        const discounts = paymentsData
          ?.reduce((sum: number, p: any) => sum + (p.discount || 0), 0) || 0;

        const { data: attendanceData } = await supabase
          .from('attendance_list')
          .select('status, mechanic_list(salary_per_day)')
          .gte('curr_date', from)
          .lte('curr_date', to);

        const salary = attendanceData
          ?.reduce((sum: number, a: any) => {
            const dailySalary = a.mechanic_list?.salary_per_day || 0;
            return sum + (a.status === 1 ? dailySalary : a.status === 3 ? dailySalary / 2 : 0);
          }, 0) || 0;

        const { data: loanPayData } = await supabase
          .from('loan_payments')
          .select('amount_paid')
          .gte('payment_date', from)
          .lte('payment_date', to);

        const loanPaid = loanPayData
          ?.reduce((sum: number, lp: any) => sum + (lp.amount_paid || 0), 0) || 0;

        const { data: expenseData } = await supabase
          .from('expense_list')
          .select('amount')
          .gte('date_created', from)
          .lte('date_created', to);

        const expenses = expenseData
          ?.reduce((sum: number, e: any) => sum + (e.amount || 0), 0) || 0;

        const totalOutflow = discounts + salary + loanPaid + expenses;
        const netProfit = grossProfit - totalOutflow;

        setFinancial({
          totalSales,
          partsCost,
          grossProfit,
          discounts,
          salary,
          loanPaid,
          expenses,
          totalOutflow,
          netProfit,
        });
      } catch (err) {
        console.error("Error fetching financial data:", err);
      }
    };

    fetchFinancialData();
  }, [from, to, profile]);

  useEffect(() => {
    if (revenueChartRef.current && monthlyRevenue.labels.length) {
      if (revenueChartInstance) revenueChartInstance.destroy();

      const ctx = revenueChartRef.current.getContext('2d');
      if (ctx) {
        const newChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: monthlyRevenue.labels,
            datasets: [{
              label: 'Revenue (₹)',
              data: monthlyRevenue.data,
              backgroundColor: 'rgba(54, 162, 235, 0.7)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.2,
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: function(value) { return '₹' + value; },
                },
              },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function(context) { return '₹' + context.raw.toFixed(2); },
                },
              },
            },
          },
        });
        setRevenueChartInstance(newChart);
      }
    }
  }, [monthlyRevenue]);

  useEffect(() => {
    if (statusChartRef.current && statusCounts.length) {
      if (statusChartInstance) statusChartInstance.destroy();

      const ctx = statusChartRef.current.getContext('2d');
      if (ctx) {
        const newChart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Pending', 'In Progress', 'Finished', 'Paid', 'Cancelled', 'Delivered'],
            datasets: [{
              data: statusCounts,
              backgroundColor: ['#6c757d', '#ffc107', '#17a2b8', '#28a745', '#dc3545', '#007bff'],
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { position: 'bottom' },
            },
          },
        });
        setStatusChartInstance(newChart);
      }
    }
  }, [statusCounts]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 bg-white">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-gray-500 font-bold italic uppercase tracking-[0.25em] text-sm">
          V-TECH: Loading Dashboard...
        </p>
      </div>
    );
  }

  const displayName = profile?.full_name || 'User';
  const isAdmin = profile?.role === 'admin';

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // The useEffect will handle refetching on from/to change
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* ===== HEADER SECTION ===== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50 p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <Wrench className="text-white" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tighter m-0 uppercase leading-none">
                V-TECH <span className="text-blue-600 not-italic">COMMAND</span>
              </h1>
              <p className="text-gray-600 text-[11px] font-extrabold uppercase tracking-[0.25em] mt-2">
                Swaagat hai, {displayName} ji! Aaj ka kaam shuru karein.
              </p>
            </div>
          </div>
          <Link 
            href="/jobs/new" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-[2rem] font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 no-underline uppercase tracking-tight shadow-md shadow-blue-500/20 text-sm"
          >
            <Zap size={18} strokeWidth={2.5} /> Quick Job Entry
          </Link>
        </div>

        {/* ===== FILTER FORM ===== */}
        <div className="bg-white p-6 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-center justify-end gap-4">
            <label className="font-bold text-gray-700">From:</label>
            <input 
              type="date" 
              value={from} 
              onChange={(e) => setFrom(e.target.value)} 
              className="border border-gray-300 rounded p-2 focus:outline-none focus:border-blue-600" 
              required 
            />
            <label className="font-bold text-gray-700">To:</label>
            <input 
              type="date" 
              value={to} 
              onChange={(e) => setTo(e.target.value)} 
              className="border border-gray-300 rounded p-2 focus:outline-none focus:border-blue-600" 
              required 
            />
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition">
              Apply
            </button>
            <button 
              type="button" 
              onClick={() => {
                const now = new Date();
                setFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
                setTo(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);
              }} 
              className="bg-gray-300 text-gray-700 px-6 py-2 rounded font-bold hover:bg-gray-400 transition"
            >
              Reset
            </button>
          </form>
        </div>

        {/* ===== MAIN STATISTICS CARDS ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Total Clients" value={stats.totalClients} icon={<Users size={24} />} color="blue" href="/clients" />
          <StatCard label="Pending" value={stats.pendingJobs} icon={<Clock size={24} />} color="amber" href="/jobs?status=0" />
          <StatCard label="In Progress" value={stats.inProgressJobs} icon={<Loader2 size={24} className="animate-spin" />} color="blue" href="/jobs?status=1" />
          <StatCard label="Finished" value={stats.finishedJobs} icon={<CheckCircle size={24} />} color="emerald" href="/jobs?status=2" />
          <StatCard label="Delivered" value={stats.deliveredJobs} icon={<ArrowRight size={24} />} color="violet" href="/jobs?status=5" />
          <StatCard label="Mechanics" value={stats.totalMechanics} icon={<Users size={24} />} color="pink" href="/mechanics" />
          <StatCard label="Low Stock" value={stats.lowStock} icon={<AlertCircle size={24} />} color="red" href="/inventory" />
          <StatCard label="Today's Revenue" value={`₹${stats.todayRevenue.toFixed(2)}`} icon={<IndianRupee size={24} strokeWidth={2.5} />} color="indigo" />
        </div>

        {/* ===== FINANCIAL OVERVIEW (Admin only) ===== */}
        {isAdmin && (
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
            <h3 className="text-xl font-bold text-blue-600 mb-6">Financial Summary ({new Date(from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} - {new Date(to).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <InfoBox icon={<DollarSign size={32} />} label="Total Sales" value={`₹${financial.totalSales.toFixed(2)}`} color="bg-info" />
              <InfoBox icon={<Wrench size={32} />} label="Est. Parts Cost (90%)" value={`₹${financial.partsCost.toFixed(2)}`} color="bg-warning" />
              <InfoBox icon={<PieChart size={32} />} label="Gross Profit" value={`₹${financial.grossProfit.toFixed(2)}`} color="bg-primary" />
              <InfoBox icon={<AlertCircle size={32} />} label="Discounts" value={`₹${financial.discounts.toFixed(2)}`} color="bg-danger" />
              <InfoBox icon={<Users size={32} />} label="Staff Salary" value={`₹${financial.salary.toFixed(2)}`} color="bg-secondary" />
              <InfoBox icon={<CreditCard size={32} />} label="Loan Repaid" value={`₹${financial.loanPaid.toFixed(2)}`} color="bg-navy" />
              <InfoBox icon={<IndianRupee size={32} />} label="Other Expenses" value={`₹${financial.expenses.toFixed(2)}`} color="bg-maroon" />
              <InfoBox icon={<TrendingUp size={32} />} label="Net Profit" value={`₹${financial.netProfit.toFixed(2)}`} color="bg-success" textColor={financial.netProfit >= 0 ? 'text-success' : 'text-danger'} />
            </div>
          </div>
        )}

        {/* ===== CHARTS ROW ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
            <h3 className="text-xl font-bold text-blue-600 mb-6">Monthly Revenue (Last 12 Months)</h3>
            <div className="chart-container relative h-[320px] w-full">
              <canvas ref={revenueChartRef}></canvas>
            </div>
          </div>
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
            <h3 className="text-xl font-bold text-blue-600 mb-6">Job Status</h3>
            <div className="chart-container relative h-[320px] w-full">
              <canvas ref={statusChartRef}></canvas>
            </div>
          </div>
        </div>

        {/* ===== RECENT ACTIVITY TABLES ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Jobs */}
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-blue-600">Recent Jobs</h3>
              <Link href="/jobs" className="text-blue-600 hover:underline font-bold">View All</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">Job ID</th>
                    <th className="p-3 text-left">Client</th>
                    <th className="p-3 text-left">Item</th>
                    <th className="p-3 text-left">Amount</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job) => {
                    const statusBadge = ['bg-gray-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500', 'bg-red-500', 'bg-indigo-500'][job.status];
                    const statusText = ['Pending', 'In Progress', 'Finished', 'Paid', 'Cancelled', 'Delivered'][job.status];
                    return (
                      <tr key={job.id} className="border-b">
                        <td className="p-3"><Link href={`/jobs/view?id=${job.id}`} className="text-blue-600 hover:underline">{job.job_id || 'N/A'}</Link></td>
                        <td className="p-3">{job.client_name || 'Walk-in'}</td>
                        <td className="p-3">{job.item.substring(0, 20)}..</td>
                        <td className="p-3">₹{job.amount.toFixed(2)}</td>
                        <td className="p-3"><span className={`${statusBadge} text-white px-2 py-1 rounded text-sm`}>{statusText}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Payments */}
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-blue-600">Recent Payments</h3>
              <Link href="/payments" className="text-blue-600 hover:underline font-bold">View All</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">Client</th>
                    <th className="p-3 text-left">Amount</th>
                    <th className="p-3 text-left">Mode</th>
                    <th className="p-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((pay) => (
                    <tr key={pay.id} className="border-b">
                      <td className="p-3">{pay.client_list ? `${pay.client_list.firstname} ${pay.client_list.lastname}` : 'Unknown'}</td>
                      <td className="p-3">₹{pay.amount.toFixed(2)}</td>
                      <td className="p-3">{pay.payment_mode}</td>
                      <td className="p-3">{new Date(pay.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ===== LOW STOCK ITEMS TABLE ===== */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-blue-600">Low Stock Items (≤5)</h3>
            <Link href="/inventory" className="text-blue-600 hover:underline font-bold">Manage Stock</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Product</th>
                  <th className="p-3 text-left">Quantity</th>
                  <th className="p-3 text-left">Location</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-3">{item.name}</td>
                    <td className="p-3"><span className="bg-red-500 text-white px-2 py-1 rounded text-sm">{item.quantity}</span></td>
                    <td className="p-3">{item.place || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, href }: { label: string; value: string | number; icon: React.ReactNode; color: string; href?: string }) {
  const colorStyles: Record<string, { bg: string; border: string; icon: string }> = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600' },
    violet: { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'text-violet-600' },
    pink: { bg: 'bg-pink-50', border: 'border-pink-200', icon: 'text-pink-600' },
    red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-600' },
  };
  const style = colorStyles[color] || colorStyles.blue;

  const content = (
    <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-300 shadow-md flex items-center gap-5 transition-transform hover:-translate-y-1 duration-300">
      <div className={`p-4 rounded-2xl ${style.bg} border-2 ${style.border} shadow-inner`}>
        <div className={style.icon}>{icon}</div>
      </div>
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-gray-500 leading-none mb-1">{label}</p>
        <div className="text-3xl font-extrabold italic text-gray-900 tracking-tight">{value}</div>
      </div>
    </div>
  );

  return href ? <Link href={href} className="no-underline">{content}</Link> : content;
}

function InfoBox({ icon, label, value, color, textColor = 'text-gray-900' }: { icon: React.ReactNode; label: string; value: string; color: string; textColor?: string }) {
  return (
    <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border-2 border-gray-200 shadow-inner">
      <div className={`${color} text-white p-4 rounded-xl flex items-center justify-center`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-extrabold uppercase text-gray-500 tracking-wide">{label}</p>
        <p className={`text-2xl font-black ${textColor}`}>{value}</p>
      </div>
    </div>
  );
}