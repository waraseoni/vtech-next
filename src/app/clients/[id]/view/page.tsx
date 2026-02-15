"use client";
import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Edit3, Smartphone, History, Phone, MapPin, Loader2, 
  IndianRupee, User, Calendar, Plus, Printer, Filter, X, 
  ShoppingCart, Receipt, CreditCard, Wallet
} from 'lucide-react';

// ========== TYPES ==========
type Client = {
  id: number;
  name: string;
  mobile: string;
  address: string;
  gst?: string;
  opening_balance?: number;
  image_url?: string;
  created_at: string;
};

type Job = {
  id: number;
  client_id: number;
  item_name: string;
  problem?: string;
  status: string;
  final_bill?: number;
  created_at: string;
};

type DirectSale = {
  id: number;
  sale_code: string;
  payment_mode: string;
  remarks?: string;
  total_amount: number;
  created_at: string;
};

type Payment = {
  id: number;
  payment_date: string;
  amount: number;
  discount: number;
  payment_mode: string;
  remarks?: string;
  job_id?: string;
  bill_no?: string;
};

// ========== HELPER FUNCTIONS ==========
const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Pending': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'In-Progress': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Repaired': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Cancelled': return 'bg-red-50 text-red-700 border-red-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-300';
  }
};

// ========== MAIN COMPONENT ==========
export default function ViewClientProfile({ params }: { params: Promise<{ id: string }> }) {
  // ✅ params को unwrap करें
  const resolvedParams = use(params);
  const router = useRouter();
  const clientId = parseInt(resolvedParams.id);

  // State
  const [client, setClient] = useState<Client | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [directSales, setDirectSales] = useState<DirectSale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Financial totals
  const [openingBalance, setOpeningBalance] = useState(0);
  const [totalRepairBilled, setTotalRepairBilled] = useState(0);
  const [totalDirectBilled, setTotalDirectBilled] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [finalBalance, setFinalBalance] = useState(0);

  // Date filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState('repairs');

  // ===== PAYMENT EDIT/DELETE STATE =====
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editFormData, setEditFormData] = useState({
    amount: '',
    payment_date: '',
    discount: '',
    payment_mode: '',
    remarks: ''
  });

  // ===== FETCH ALL DATA =====
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Client details
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .single();

        if (clientError) {
          console.error("❌ Client fetch error:", clientError);
          throw new Error(`Client error: ${clientError.message || 'Unknown'}`);
        }
        if (!clientData) {
          throw new Error("Client not found");
        }
        setClient(clientData);
        setOpeningBalance(clientData.opening_balance || 0);

        // 2. Repair Jobs (transaction_list = jobs)
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false });

        if (jobsError) {
          console.error("❌ Jobs fetch error:", jobsError);
          setJobs([]); // अगर टेबल नहीं है तो खाली ऐरे
        } else {
          setJobs(jobsData || []);
        }

        // 3. Direct Sales
        const { data: salesData, error: salesError } = await supabase
          .from('direct_sales')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false });

        if (salesError) {
          console.error("❌ Direct sales fetch error:", salesError);
          setDirectSales([]);
        } else {
          setDirectSales(salesData || []);
        }

        // 4. Payments
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('client_payments')
          .select('*')
          .eq('client_id', clientId)
          .order('payment_date', { ascending: false });

        if (paymentsError) {
          console.error("❌ Payments fetch error:", paymentsError);
          setPayments([]);
        } else {
          setPayments(paymentsData || []);
        }

      } catch (err: any) {
        console.error("🔥 Error fetching client profile:", err);
        setError(err.message || "Failed to load client data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [clientId]);

  // ===== CALCULATE TOTALS =====
  useEffect(() => {
    const repairTotal = jobs
      .filter(job => job.status === 'Delivered')
      .reduce((sum, job) => sum + (job.final_bill || 0), 0);
    setTotalRepairBilled(repairTotal);

    const directTotal = directSales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    setTotalDirectBilled(directTotal);

    const paidTotal = payments.reduce((sum, p) => sum + (p.amount + (p.discount || 0)), 0);
    setTotalPaid(paidTotal);
  }, [jobs, directSales, payments]);

  useEffect(() => {
    const totalBilled = totalRepairBilled + totalDirectBilled;
    const balance = openingBalance + totalBilled - totalPaid;
    setFinalBalance(balance);
  }, [openingBalance, totalRepairBilled, totalDirectBilled, totalPaid]);

  // ===== FILTER FUNCTIONS =====
  const filterByDate = (item: any, dateField: string) => {
    if (!dateFrom && !dateTo) return true;
    const itemDate = new Date(item[dateField]).getTime();
    if (dateFrom && itemDate < new Date(dateFrom).getTime()) return false;
    if (dateTo && itemDate > new Date(dateTo).getTime() + 86400000) return false;
    return true;
  };

  const filteredJobs = jobs.filter(job => filterByDate(job, 'created_at'));
  const filteredSales = directSales.filter(sale => filterByDate(sale, 'created_at'));
  const filteredPayments = payments.filter(p => filterByDate(p, 'payment_date'));

  // ===== PAYMENT HANDLERS =====
  const handleDeletePayment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this payment?')) return;
    try {
      const { error } = await supabase.from('client_payments').delete().eq('id', id);
      if (error) throw error;
      const { data } = await supabase
        .from('client_payments')
        .select('*')
        .eq('client_id', clientId)
        .order('payment_date', { ascending: false });
      setPayments(data || []);
    } catch (err: any) {
      alert('Error deleting payment: ' + err.message);
    }
  };

  const openEditModal = (payment: Payment) => {
    setEditingPayment(payment);
    setEditFormData({
      amount: payment.amount.toString(),
      payment_date: payment.payment_date.split('T')[0],
      discount: payment.discount?.toString() || '0',
      payment_mode: payment.payment_mode,
      remarks: payment.remarks || ''
    });
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    try {
      const { error } = await supabase
        .from('client_payments')
        .update({
          amount: parseFloat(editFormData.amount),
          payment_date: editFormData.payment_date,
          discount: parseFloat(editFormData.discount),
          payment_mode: editFormData.payment_mode,
          remarks: editFormData.remarks || null
        })
        .eq('id', editingPayment.id);
      if (error) throw error;
      const { data } = await supabase
        .from('client_payments')
        .select('*')
        .eq('client_id', clientId)
        .order('payment_date', { ascending: false });
      setPayments(data || []);
      setEditingPayment(null);
    } catch (err: any) {
      alert('Error updating payment: ' + err.message);
    }
  };

  // ===== LOADING / ERROR STATE =====
  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 bg-white">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-gray-500 font-bold italic uppercase tracking-[0.25em] text-sm">
          Loading Customer Profile...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 bg-white">
        <h2 className="text-2xl font-black text-red-600">Error Loading Profile</h2>
        <p className="text-gray-600">{error}</p>
        <Link href="/clients" className="text-blue-600 font-bold underline">
          ← Back to Customers
        </Link>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 bg-white">
        <h2 className="text-2xl font-black text-gray-900">Customer Not Found!</h2>
        <Link href="/clients" className="text-blue-600 font-bold underline">
          ← Back to Customers
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ===== HEADER CARD (unchanged) ===== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50 p-6 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-4">
            <Link href="/clients" className="p-2.5 bg-white border-2 border-gray-300 rounded-xl text-gray-600 hover:bg-gray-100 transition-all">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                <User className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase leading-none">
                  Customer Profile
                </h2>
                <p className="text-[10px] text-gray-600 font-extrabold uppercase tracking-[0.2em] mt-1">
                  ID: #C-{client.id}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.open(`/clients/ledger-print/${client.id}?from=${dateFrom}&to=${dateTo}`, '_blank')}
              className="p-2.5 bg-white border-2 border-gray-300 rounded-xl text-amber-600 hover:bg-amber-50 hover:border-amber-300 transition-all"
              title="Print Photo Statement"
            >
              <Printer size={18} />
            </button>
            <Link 
              href={`/clients/${client.id}/edit`}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 rounded-xl font-extrabold text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all uppercase tracking-wide text-sm"
            >
              <Edit3 size={18} />
              Edit Profile
            </Link>
          </div>
        </div>

        {/* ===== FINANCIAL SUMMARY CARDS (unchanged) ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border-2 border-gray-300 shadow-sm">
            <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider">Opening Balance</p>
            <p className="text-xl font-black text-blue-600 mt-1">₹{openingBalance.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border-2 border-gray-300 shadow-sm">
            <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider">Total Billed</p>
            <p className="text-xl font-black text-gray-900 mt-1">₹{(totalRepairBilled + totalDirectBilled).toFixed(2)}</p>
            <p className="text-[8px] text-gray-400">(Repair + Direct)</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border-2 border-gray-300 shadow-sm">
            <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider">Total Received</p>
            <p className="text-xl font-black text-emerald-600 mt-1">₹{totalPaid.toFixed(2)}</p>
          </div>
          <div className={`bg-white p-4 rounded-2xl border-2 shadow-sm ${
            finalBalance >= 0 ? 'border-red-200' : 'border-green-200'
          }`}>
            <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider">
              {finalBalance >= 0 ? 'Due Balance' : 'Advance'}
            </p>
            <p className={`text-xl font-black mt-1 ${finalBalance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₹{Math.abs(finalBalance).toFixed(2)}
            </p>
          </div>
        </div>

        {/* ===== TABS SECTION (unchanged) ===== */}
        <div className="bg-white rounded-[2.5rem] border-2 border-gray-300 shadow-md overflow-hidden">
          {/* Tab Headers */}
          <div className="flex border-b-2 border-gray-200">
            <button
              onClick={() => setActiveTab('repairs')}
              className={`flex-1 py-4 px-2 text-[11px] font-extrabold uppercase tracking-wider transition-all ${
                activeTab === 'repairs' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Smartphone size={16} className="inline mr-2" /> Repair History
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`flex-1 py-4 px-2 text-[11px] font-extrabold uppercase tracking-wider transition-all ${
                activeTab === 'sales' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ShoppingCart size={16} className="inline mr-2" /> Direct Sales
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`flex-1 py-4 px-2 text-[11px] font-extrabold uppercase tracking-wider transition-all ${
                activeTab === 'payments' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Receipt size={16} className="inline mr-2" /> Payment Ledger
            </button>
          </div>

          {/* Date Filter Bar */}
          <div className="p-4 bg-gray-50 border-b-2 border-gray-200 flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[9px] font-extrabold uppercase text-gray-500 block mb-1">From Date</label>
              <input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)}
                className="border-2 border-gray-300 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[9px] font-extrabold uppercase text-gray-500 block mb-1">To Date</label>
              <input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)}
                className="border-2 border-gray-300 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <button 
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="px-4 py-2 bg-white border-2 border-gray-300 rounded-xl text-xs font-bold hover:bg-gray-100"
            >
              <X size={14} className="inline mr-1" /> Reset
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {/* REPAIR HISTORY TAB */}
            {activeTab === 'repairs' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b-2 border-gray-300">
                    <tr>
                      <th className="p-3 text-left text-[10px] font-extrabold uppercase">Date</th>
                      <th className="p-3 text-left text-[10px] font-extrabold uppercase">Job ID</th>
                      <th className="p-3 text-left text-[10px] font-extrabold uppercase">Item</th>
                      <th className="p-3 text-left text-[10px] font-extrabold uppercase">Status</th>
                      <th className="p-3 text-right text-[10px] font-extrabold uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map(job => (
                      <tr key={job.id} className="border-b border-gray-200 hover:bg-blue-50/30">
                        <td className="p-3 text-xs">{formatDate(job.created_at)}</td>
                        <td className="p-3">
                          <Link href={`/jobs/${job.id}/view`} className="text-blue-600 font-bold hover:underline">
                            #{job.id}
                          </Link>
                        </td>
                        <td className="p-3 font-medium">{job.item_name}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-[8px] font-extrabold border ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold">₹{job.final_bill?.toFixed(2) || '0.00'}</td>
                      </tr>
                    ))}
                    {filteredJobs.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-gray-400 italic">No repair jobs found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* DIRECT SALES TAB */}
            {activeTab === 'sales' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b-2 border-gray-300">
                    <tr>
                      <th className="p-3 text-left text-[10px] font-extrabold uppercase">Date</th>
                      <th className="p-3 text-left text-[10px] font-extrabold uppercase">Sale Code</th>
                      <th className="p-3 text-left text-[10px] font-extrabold uppercase">Payment Mode</th>
                      <th className="p-3 text-left text-[10px] font-extrabold uppercase">Remarks</th>
                      <th className="p-3 text-right text-[10px] font-extrabold uppercase">Total</th>
                      <th className="p-3 text-center text-[10px] font-extrabold uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map(sale => (
                      <tr key={sale.id} className="border-b border-gray-200 hover:bg-blue-50/30">
                        <td className="p-3 text-xs">{formatDate(sale.created_at)}</td>
                        <td className="p-3 font-mono font-bold">{sale.sale_code}</td>
                        <td className="p-3">{sale.payment_mode}</td>
                        <td className="p-3 text-xs text-gray-600">{sale.remarks || '—'}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">₹{sale.total_amount.toFixed(2)}</td>
                        <td className="p-3 text-center">
                          <Link href={`/direct-sales/${sale.id}`} className="text-blue-600 text-xs font-bold hover:underline">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {filteredSales.length === 0 && (
                      <tr><td colSpan={6} className="p-6 text-center text-gray-400 italic">No direct sales found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* PAYMENT LEDGER TAB */}
            {activeTab === 'payments' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b-2 border-gray-300">
                    <tr>
                      <th className="p-3 text-left text-[10px] font-extrabold uppercase">Date</th>
                      <th className="p-3 text-left text-[10px] font-extrabold uppercase">Ref. ID</th>
                      <th className="p-3 text-right text-[10px] font-extrabold uppercase">Amount</th>
                      <th className="p-3 text-right text-[10px] font-extrabold uppercase">Discount</th>
                      <th className="p-3 text-right text-[10px] font-extrabold uppercase">Net</th>
                      <th className="p-3 text-left text-[10px] font-extrabold uppercase">Mode</th>
                      <th className="p-3 text-center text-[10px] font-extrabold uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map(p => (
                      <tr key={p.id} className="border-b border-gray-200 hover:bg-blue-50/30">
                        <td className="p-3 text-xs">{formatDate(p.payment_date)}</td>
                        <td className="p-3">
                          {p.job_id && <div>Job: {p.job_id}</div>}
                          {p.bill_no && <div>Bill: {p.bill_no}</div>}
                          <div className="text-[9px] text-gray-500">PAY-{p.id}</div>
                        </td>
                        <td className="p-3 text-right">₹{p.amount.toFixed(2)}</td>
                        <td className="p-3 text-right">₹{p.discount?.toFixed(2) || '0.00'}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">₹{(p.amount + (p.discount||0)).toFixed(2)}</td>
                        <td className="p-3">{p.payment_mode}</td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => openEditModal(p)} 
                            className="text-blue-600 text-xs font-bold hover:underline mr-2"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeletePayment(p.id)} 
                            className="text-red-600 text-xs font-bold hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredPayments.length === 0 && (
                      <tr><td colSpan={7} className="p-6 text-center text-gray-400 italic">No payments found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ===== ACTION BUTTONS ===== */}
        <div className="flex justify-end gap-3">
          <button 
            onClick={() => router.push(`/clients/${client.id}/add-payment`)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-extrabold uppercase text-sm hover:bg-emerald-700 transition-all shadow-lg"
          >
            <Plus size={18} />
            Add Payment
          </button>
          <button 
            onClick={() => router.push(`/clients/${client.id}/add-direct-sale`)}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-extrabold uppercase text-sm hover:bg-purple-700 transition-all shadow-lg"
          >
            <ShoppingCart size={18} />
            New Direct Sale
          </button>
        </div>

      </div>

      {/* ===== EDIT PAYMENT MODAL ===== */}
      {editingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Edit Payment</h3>
            <form onSubmit={handleUpdatePayment} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold uppercase text-gray-500 block mb-1">Amount</label>
                <input
                  type="number" step="0.01" required
                  value={editFormData.amount}
                  onChange={(e) => setEditFormData({...editFormData, amount: e.target.value})}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-extrabold uppercase text-gray-500 block mb-1">Payment Date</label>
                <input
                  type="date" required
                  value={editFormData.payment_date}
                  onChange={(e) => setEditFormData({...editFormData, payment_date: e.target.value})}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-extrabold uppercase text-gray-500 block mb-1">Discount</label>
                <input
                  type="number" step="0.01"
                  value={editFormData.discount}
                  onChange={(e) => setEditFormData({...editFormData, discount: e.target.value})}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-extrabold uppercase text-gray-500 block mb-1">Payment Mode</label>
                <select
                  value={editFormData.payment_mode}
                  onChange={(e) => setEditFormData({...editFormData, payment_mode: e.target.value})}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
                >
                  <option>Cash</option>
                  <option>PhonePe/GPay</option>
                  <option>Bank Transfer</option>
                  <option>Credit Card</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-extrabold uppercase text-gray-500 block mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={editFormData.remarks}
                  onChange={(e) => setEditFormData({...editFormData, remarks: e.target.value})}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-extrabold uppercase text-sm hover:bg-blue-700 transition-all">
                  Update
                </button>
                <button type="button" onClick={() => setEditingPayment(null)} className="flex-1 bg-gray-200 py-3 rounded-xl font-extrabold uppercase text-sm hover:bg-gray-300 transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}