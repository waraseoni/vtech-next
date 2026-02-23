"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, Edit3, Smartphone, History, 
  Phone, MapPin, Loader2, IndianRupee, User, Calendar,
  CreditCard, X, CheckCircle, ShoppingCart, Plus, Filter
} from 'lucide-react';

// ========== TYPES ==========
type Client = {
  id: number;
  name: string;
  contact: string;
  address: string;
  opening_balance?: number;
  image_path?: string;
  date_created: string;
};

type Job = {
  id: number;
  job_id: string | null;
  item: string;
  fault?: string;
  status: number;
  amount?: number;
  date_created: string;
};

type DirectSale = {
  id: number;
  sale_code: string;
  payment_mode: string;
  remarks?: string;
  total_amount: number;
  date_created: string;
};

type Payment = {
  id: number;
  payment_date: string;
  amount: number;
  discount: number;
  payment_mode: string;
  remarks?: string;
  job_id?: string | null;
  bill_no?: string | null;
};

// ========== HELPER FUNCTIONS ==========
const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};

const getStatusText = (status: number) => {
  switch (status) {
    case 0: return 'Pending';
    case 1: return 'In-Progress';
    case 2: return 'Repaired';
    case 3: return 'Paid';
    case 4: return 'Cancelled';
    case 5: return 'Delivered';
    default: return 'Unknown';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Pending': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'In-Progress': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Repaired': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Cancelled': return 'bg-red-50 text-red-700 border-red-200';
    case 'Paid': return 'bg-green-50 text-green-700 border-green-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-300';
  }
};

// ========== MAIN COMPONENT ==========
export default function ViewClientProfile() {
  const router = useRouter();
  const params = useParams();
  const clientId = parseInt(params.id as string);

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
          .from('client_list')
          .select('id, firstname, middlename, lastname, contact, address, opening_balance, image_path, date_created')
          .eq('id', clientId)
          .eq('delete_flag', 0)
          .single();

        if (clientError) throw clientError;
        if (!clientData) throw new Error("Client not found");

        const fullName = [clientData.firstname, clientData.middlename, clientData.lastname].filter(Boolean).join(' ').trim();

        setClient({
          id: clientData.id,
          name: fullName,
          contact: clientData.contact,
          address: clientData.address,
          opening_balance: clientData.opening_balance,
          image_path: clientData.image_path,
          date_created: clientData.date_created
        });
        setOpeningBalance(clientData.opening_balance || 0);

        // 2. Repair Jobs (transaction_list)
        const { data: jobsData, error: jobsError } = await supabase
          .from('transaction_list')
          .select('id, job_id, item, fault, status, amount, date_created')
          .eq('client_name', fullName)
          .eq('del_status', 0)
          .order('date_created', { ascending: false });

        if (jobsError) throw jobsError;
        setJobs(jobsData || []);

        // 3. Direct Sales
        const { data: salesData, error: salesError } = await supabase
          .from('direct_sales')
          .select('id, sale_code, payment_mode, remarks, total_amount, date_created')
          .eq('client_id', clientId)
          .order('date_created', { ascending: false });

        if (salesError) throw salesError;
        setDirectSales(salesData || []);

        // 4. Payments
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('client_payments')
          .select('id, payment_date, amount, discount, payment_mode, remarks, job_id, bill_no')
          .eq('client_id', clientId)
          .order('payment_date', { ascending: false });

        if (paymentsError) throw paymentsError;
        setPayments(paymentsData || []);

      } catch (err: any) {
        console.error("Error fetching client profile:", err);
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
      .filter(job => job.status === 5)
      .reduce((sum, job) => sum + (job.amount || 0), 0);
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
  const filterByDate = (item: { date_created?: string; payment_date?: string }, dateField: 'date_created' | 'payment_date') => {
    if (!dateFrom && !dateTo) return true;
    const itemDateStr = item[dateField];
    if (!itemDateStr) return false;
    const itemDate = new Date(itemDateStr).getTime();
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
    const toTime = dateTo ? new Date(dateTo).getTime() + 86400000 : Infinity;
    return itemDate >= fromTime && itemDate < toTime;
  };

  const filteredJobs = jobs.filter(job => filterByDate(job, 'date_created'));
  const filteredSales = directSales.filter(sale => filterByDate(sale, 'date_created'));
  const filteredPayments = payments.filter(p => filterByDate(p, 'payment_date'));

  // ===== PAYMENT HANDLERS =====
  const handleDeletePayment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this payment?')) return;
    try {
      const { error } = await supabase.from('client_payments').delete().eq('id', id);
      if (error) throw error;
      setPayments(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      alert('Error deleting payment: ' + err.message);
    }
  };

  const openEditModal = (payment: Payment) => {
    setEditingPayment(payment);
    setEditFormData({
      amount: payment.amount.toString(),
      payment_date: payment.payment_date.split('T')[0] || payment.payment_date,
      discount: payment.discount.toString(),
      payment_mode: payment.payment_mode,
      remarks: payment.remarks || ''
    });
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    try {
      const updates = {
        amount: parseFloat(editFormData.amount),
        payment_date: editFormData.payment_date,
        discount: parseFloat(editFormData.discount),
        payment_mode: editFormData.payment_mode,
        remarks: editFormData.remarks
      };
      const { error } = await supabase
        .from('client_payments')
        .update(updates)
        .eq('id', editingPayment.id);
      if (error) throw error;
      setPayments(prev => prev.map(p => p.id === editingPayment.id ? { ...p, ...updates } : p));
      setEditingPayment(null);
    } catch (err: any) {
      alert('Error updating payment: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 bg-white">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-gray-500 font-bold italic uppercase tracking-[0.25em] text-sm">
          Loading Client Profile...
        </p>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 bg-white text-red-600">
        <p>{error || "Client not found"}</p>
        <button onClick={() => router.back()} className="text-blue-600">Go Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* ===== HEADER ===== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50 p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <User className="text-white" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tighter m-0 uppercase leading-none">
                {client.name}
              </h1>
              <p className="text-gray-600 text-[11px] font-extrabold uppercase tracking-[0.25em] mt-2">
                Client ID: {client.id} | Since {formatDate(client.date_created)}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <Link 
              href={`/clients/${client.id}/edit`} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-[2rem] font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 no-underline uppercase tracking-tight shadow-md shadow-blue-500/20 text-sm"
            >
              <Edit3 size={18} strokeWidth={2.5} /> Edit Profile
            </Link>
            <button onClick={() => router.back()} className="bg-gray-300 hover:bg-gray-400 text-gray-900 px-8 py-4 rounded-[2rem] font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-tight shadow-md text-sm">
              <ArrowLeft size={18} strokeWidth={2.5} /> Back
            </button>
          </div>
        </div>

        {/* ===== CLIENT INFO ===== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
            <h3 className="text-[11px] font-extrabold uppercase text-gray-500 tracking-[0.15em] mb-4">Contact Info</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone size={20} className="text-blue-600" />
                <span className="font-bold">{client.contact}</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={20} className="text-blue-600 mt-1" />
                <span className="font-bold">{client.address || 'N/A'}</span>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
            <h3 className="text-[11px] font-extrabold uppercase text-gray-500 tracking-[0.15em] mb-4">Financial Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="font-bold text-gray-700">Opening Balance</span>
                <span className="font-extrabold">₹{openingBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-gray-700">Repair Billed</span>
                <span className="font-extrabold">₹{totalRepairBilled.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-gray-700">Direct Billed</span>
                <span className="font-extrabold">₹{totalDirectBilled.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-bold text-gray-700">Total Paid (Eff.)</span>
                <span className="font-extrabold text-emerald-600">₹{totalPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-bold text-gray-700">Final Balance</span>
                <span className="font-extrabold text-red-600">₹{finalBalance.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
            <h3 className="text-[11px] font-extrabold uppercase text-gray-500 tracking-[0.15em] mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <Link href="/jobs/new" className="flex items-center gap-2 p-4 bg-blue-50 rounded-xl border-2 border-blue-200 text-blue-700 font-bold text-sm hover:bg-blue-100 transition-all">
                <Plus size={18} /> New Job
              </Link>
              <button className="flex items-center gap-2 p-4 bg-emerald-50 rounded-xl border-2 border-emerald-200 text-emerald-700 font-bold text-sm hover:bg-emerald-100 transition-all">
                <CreditCard size={18} /> Add Payment
              </button>
              <button className="flex items-center gap-2 p-4 bg-purple-50 rounded-xl border-2 border-purple-200 text-purple-700 font-bold text-sm hover:bg-purple-100 transition-all">
                <ShoppingCart size={18} /> New Sale
              </button>
              <button className="flex items-center gap-2 p-4 bg-gray-50 rounded-xl border-2 border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-100 transition-all">
                <History size={18} /> Ledger
              </button>
            </div>
          </div>
        </div>

        {/* ===== DATE FILTER ===== */}
        <div className="bg-gray-50 p-6 rounded-[2.5rem] border-2 border-gray-300 shadow-md flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-blue-600" />
            <h3 className="text-[11px] font-extrabold uppercase text-gray-500 tracking-[0.15em]">Filter by Date</h3>
          </div>
          <div className="flex flex-wrap gap-4">
            <input 
              type="date" 
              value={dateFrom} 
              onChange={(e) => setDateFrom(e.target.value)} 
              className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
            />
            <input 
              type="date" 
              value={dateTo} 
              onChange={(e) => setDateTo(e.target.value)} 
              className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
            />
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="px-4 py-2 bg-gray-200 rounded-xl font-bold text-sm hover:bg-gray-300 transition-all">
              Clear
            </button>
          </div>
        </div>

        {/* ===== TABS ===== */}
        <div className="flex border-b-2 border-gray-300">
          <button 
            onClick={() => setActiveTab('repairs')} 
            className={`px-6 py-3 font-extrabold uppercase text-sm ${activeTab === 'repairs' ? 'border-b-4 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          >
            Repairs ({filteredJobs.length})
          </button>
          <button 
            onClick={() => setActiveTab('direct')} 
            className={`px-6 py-3 font-extrabold uppercase text-sm ${activeTab === 'direct' ? 'border-b-4 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          >
            Direct Sales ({filteredSales.length})
          </button>
          <button 
            onClick={() => setActiveTab('payments')} 
            className={`px-6 py-3 font-extrabold uppercase text-sm ${activeTab === 'payments' ? 'border-b-4 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          >
            Payments ({filteredPayments.length})
          </button>
        </div>

        {/* ===== CONTENT ===== */}
        <div className="bg-white rounded-[2.5rem] border-2 border-gray-300 shadow-md overflow-hidden">
          {activeTab === 'repairs' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="p-3 text-left text-[10px] font-extrabold uppercase">Job ID</th>
                    <th className="p-3 text-left text-[10px] font-extrabold uppercase">Item</th>
                    <th className="p-3 text-left text-[10px] font-extrabold uppercase">Fault</th>
                    <th className="p-3 text-left text-[10px] font-extrabold uppercase">Status</th>
                    <th className="p-3 text-right text-[10px] font-extrabold uppercase">Amount</th>
                    <th className="p-3 text-left text-[10px] font-extrabold uppercase">Date</th>
                    <th className="p-3 text-center text-[10px] font-extrabold uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map(job => {
                    const statusText = getStatusText(job.status);
                    return (
                      <tr key={job.id} className="border-b border-gray-200 hover:bg-blue-50/30">
                        <td className="p-3">{job.job_id || job.id}</td>
                        <td className="p-3">{job.item}</td>
                        <td className="p-3">{job.fault || 'N/A'}</td>
                        <td className="p-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(statusText)}`}>
                            {statusText}
                          </span>
                        </td>
                        <td className="p-3 text-right">₹{job.amount?.toFixed(2) || '0.00'}</td>
                        <td className="p-3">{formatDate(job.date_created)}</td>
                        <td className="p-3 text-center">
                          <Link href={`/jobs/view?id=${job.id}`} className="text-blue-600 text-xs font-bold hover:underline">
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredJobs.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-gray-400 italic">No repairs found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'direct' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="p-3 text-left text-[10px] font-extrabold uppercase">Sale Code</th>
                    <th className="p-3 text-left text-[10px] font-extrabold uppercase">Mode</th>
                    <th className="p-3 text-left text-[10px] font-extrabold uppercase">Remarks</th>
                    <th className="p-3 text-right text-[10px] font-extrabold uppercase">Amount</th>
                    <th className="p-3 text-left text-[10px] font-extrabold uppercase">Date</th>
                    <th className="p-3 text-center text-[10px] font-extrabold uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map(sale => (
                    <tr key={sale.id} className="border-b border-gray-200 hover:bg-blue-50/30">
                      <td className="p-3">{sale.sale_code}</td>
                      <td className="p-3">{sale.payment_mode}</td>
                      <td className="p-3">{sale.remarks || 'N/A'}</td>
                      <td className="p-3 text-right">₹{sale.total_amount.toFixed(2)}</td>
                      <td className="p-3">{formatDate(sale.date_created)}</td>
                      <td className="p-3 text-center">
                        <Link href={`/sales/view?id=${sale.id}`} className="text-blue-600 text-xs font-bold hover:underline">
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
                      <td className="p-3 text-right">₹{p.discount.toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">₹{(p.amount + p.discount).toFixed(2)}</td>
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

        {/* ===== ACTION BUTTONS ===== */}
        <div className="flex justify-end gap-3">
          <Link 
            href={`/clients/${client.id}/add-payment`} 
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-extrabold uppercase text-sm hover:bg-emerald-700 transition-all shadow-lg"
          >
            <Plus size={18} /> Add Payment
          </Link>
          <Link 
            href={`/clients/${client.id}/add-direct-sale`} 
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-extrabold uppercase text-sm hover:bg-purple-700 transition-all shadow-lg"
          >
            <ShoppingCart size={18} /> New Direct Sale
          </Link>
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