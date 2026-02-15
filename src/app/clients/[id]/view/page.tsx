"use client";
import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Edit3, Smartphone, History, 
  Phone, MapPin, Loader2, IndianRupee, User, Calendar,
  CreditCard, X, CheckCircle
} from 'lucide-react';

export default function ViewClientProfile({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [paymentNote, setPaymentNote] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // 1. Fetch client details
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', resolvedParams.id)
          .single();

        if (clientError) throw clientError;
        setClient(clientData);

        // 2. Fetch all jobs for this client
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('*')
          .eq('client_id', resolvedParams.id)
          .order('created_at', { ascending: false });

        if (jobsError) throw jobsError;
        setJobs(jobsData || []);

        // 3. Fetch payment history (optional)
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments')
          .select('*')
          .eq('client_id', resolvedParams.id)
          .order('created_at', { ascending: false });

        if (paymentsError && paymentsError.code !== '42P01') { // Table not exists
          console.error("Error fetching payments:", paymentsError);
        }
        setPayments(paymentsData || []);

      } catch (err) {
        console.error("Error fetching client profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [resolvedParams.id]);

  // Calculate total delivered amount
  const totalDeliveredAmount = jobs
    .filter(job => job.status === 'Delivered')
    .reduce((sum, job) => sum + (job.final_bill || 0), 0);

  // Total paid amount (from client.total_paid)
  const totalPaid = client?.total_paid || 0;
  
  // Due balance
  const dueBalance = totalDeliveredAmount - totalPaid;

  // Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Get status badge color
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

  // Handle payment submission
  const handlePaymentSubmit = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      alert("Please enter a valid payment amount!");
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (amount > dueBalance) {
      alert(`Payment amount (₹${amount}) cannot exceed due balance (₹${dueBalance})!`);
      return;
    }

    setProcessingPayment(true);
    try {
      // 1. Update client's total_paid
      const newTotalPaid = totalPaid + amount;
      const { error: updateError } = await supabase
        .from('clients')
        .update({ total_paid: newTotalPaid })
        .eq('id', client.id);

      if (updateError) throw updateError;

      // 2. Record payment in payments table (if exists)
      try {
        await supabase
          .from('payments')
          .insert([{
            client_id: client.id,
            amount: amount,
            payment_date: paymentDate,
            note: paymentNote || null,
            created_at: new Date().toISOString()
          }]);
      } catch (err) {
        // If payments table doesn't exist, just log error but don't stop
        console.warn("Could not record payment history:", err);
      }

      // 3. Refresh client data
      const { data: updatedClient } = await supabase
        .from('clients')
        .select('*')
        .eq('id', client.id)
        .single();
      
      if (updatedClient) setClient(updatedClient);

      // 4. Close modal and reset form
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentNote('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      
      alert(`Payment of ₹${amount} recorded successfully! ✅`);

    } catch (err: any) {
      console.error("Payment error:", err);
      alert("Payment record karne mein error: " + err.message);
    } finally {
      setProcessingPayment(false);
    }
  };

  // Loading state
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

  // Not found
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
        
        {/* ===== HEADER CARD ===== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50 p-6 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-4">
            <Link 
              href="/clients"
              className="p-2.5 bg-white border-2 border-gray-300 rounded-xl text-gray-600 hover:bg-gray-100 transition-all"
            >
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
          <Link 
            href={`/clients/${client.id}/edit`}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 rounded-xl font-extrabold text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all uppercase tracking-wide text-sm"
          >
            <Edit3 size={18} />
            Edit Profile
          </Link>
        </div>

        {/* ===== MAIN GRID ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* ----- LEFT COLUMN: PROFILE CARD ----- */}
          <div className="lg:col-span-4">
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md h-fit">
              {/* Avatar */}
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-blue-100 border-4 border-blue-200 rounded-full flex items-center justify-center text-3xl font-black text-blue-700 mb-4">
                  {client.name ? client.name[0].toUpperCase() : 'C'}
                </div>
                <h3 className="text-2xl font-extrabold text-gray-900 uppercase tracking-tight">
                  {client.name}
                </h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.15em] mt-1">
                  Registered: {formatDate(client.created_at)}
                </p>
              </div>

              <hr className="my-6 border-t-2 border-gray-200" />

              {/* Contact Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
                    <Phone size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider">
                      Mobile Number
                    </p>
                    <p className="font-extrabold text-gray-900">
                      {client.mobile || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
                  <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider">
                      Address
                    </p>
                    <p className="font-bold text-gray-900 text-sm">
                      {client.address || 'No Address'}
                    </p>
                  </div>
                </div>

                {client.gst && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
                    <div className="p-2 bg-purple-100 rounded-lg text-purple-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider">
                        GST Number
                      </p>
                      <p className="font-bold text-gray-900 text-sm">
                        {client.gst}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Business Summary Card - Due Balance with Payment Button */}
              <div className="mt-6 p-5 bg-gradient-to-br from-amber-50 to-amber-100/50 border-2 border-amber-200 rounded-2xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-600 rounded-xl shadow-md shadow-amber-200">
                      <IndianRupee size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-[9px] font-extrabold uppercase text-amber-800 tracking-[0.15em]">
                        Total Due Balance
                      </p>
                      <div className="text-2xl font-black italic text-amber-700">
                        ₹{dueBalance}
                      </div>
                      <p className="text-[8px] font-bold text-amber-600 mt-1">
                        Total Delivered: ₹{totalDeliveredAmount} | Paid: ₹{totalPaid}
                      </p>
                    </div>
                  </div>
                  {dueBalance > 0 && (
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-white border-2 border-amber-300 rounded-xl font-extrabold text-amber-700 hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all text-xs uppercase tracking-wider"
                    >
                      <CreditCard size={16} />
                      Record Payment
                    </button>
                  )}
                </div>
              </div>

              {/* Payment History (Optional) */}
              {payments.length > 0 && (
                <div className="mt-6 pt-4 border-t-2 border-gray-200">
                  <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider mb-3">
                    Recent Payments
                  </p>
                  <div className="space-y-2">
                    {payments.slice(0, 3).map(payment => (
                      <div key={payment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-emerald-600" />
                          <span className="text-xs font-bold text-gray-700">
                            ₹{payment.amount}
                          </span>
                        </div>
                        <span className="text-[9px] text-gray-500">
                          {formatDate(payment.payment_date || payment.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ----- RIGHT COLUMN: REPAIR HISTORY ----- */}
          <div className="lg:col-span-8">
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
              <div className="flex items-center gap-2 mb-6">
                <History size={22} className="text-blue-600" />
                <h3 className="text-[13px] font-extrabold uppercase text-gray-700 tracking-[0.15em]">
                  Repair History
                </h3>
                <span className="ml-auto px-3 py-1.5 bg-gray-100 border-2 border-gray-300 rounded-full text-[10px] font-extrabold text-gray-700">
                  Total Jobs: {jobs.length}
                </span>
              </div>

              {jobs.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-400">
                  <Smartphone size={32} className="mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600 font-bold italic uppercase tracking-wider text-sm">
                    No repair history found for this customer
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {jobs.map(job => (
                    <div 
                      key={job.id} 
                      className="group p-4 bg-gray-50 hover:bg-white border-2 border-gray-200 hover:border-blue-200 rounded-xl transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Left: Device Info */}
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 bg-blue-100 rounded-lg text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Smartphone size={20} />
                          </div>
                          <div>
                            <div className="font-extrabold text-gray-900 text-base uppercase tracking-tight">
                              {job.item_name || 'Unknown Device'}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600 font-bold mt-1">
                              <Calendar size={12} className="text-gray-500" />
                              <span>{formatDate(job.created_at)}</span>
                              <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                              <span className="font-mono">#VT-{job.id}</span>
                            </div>
                            {job.problem && (
                              <p className="text-[10px] text-red-600 font-bold italic uppercase tracking-tight mt-1.5">
                                Fault: {job.problem}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right: Status & Amount */}
                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 sm:gap-1">
                          <span className={`px-3 py-1.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border-2 ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                          <div className="font-extrabold italic text-gray-900 text-lg">
                            ₹{job.final_bill || 0}
                          </div>
                        </div>
                      </div>

                      {/* Quick View Link */}
                      <div className="mt-3 pt-2 border-t border-gray-200 flex justify-end">
                        <Link 
                          href={`/jobs/${job.id}/view`}
                          className="text-[10px] font-extrabold uppercase text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                        >
                          View Job Details
                          <ArrowLeft size={12} className="rotate-180" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== PAYMENT MODAL – PREMIUM GLASS DESIGN ===== */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-2xl animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-600 rounded-xl shadow-md shadow-amber-500/30">
                  <CreditCard className="text-white" size={22} />
                </div>
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                  Record Payment
                </h3>
              </div>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Payment Form */}
            <div className="space-y-5">
              {/* Amount */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase text-gray-600 tracking-[0.1em]">
                  <IndianRupee size={16} className="text-amber-600" />
                  Payment Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={`Max: ₹${dueBalance}`}
                  max={dueBalance}
                  className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 transition-all text-gray-900 font-bold text-base placeholder:text-gray-400"
                  autoFocus
                />
                <p className="text-[9px] text-gray-500 font-bold">
                  Due Balance: ₹{dueBalance}
                </p>
              </div>

              {/* Payment Date */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase text-gray-600 tracking-[0.1em]">
                  <Calendar size={16} className="text-amber-600" />
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 transition-all text-gray-900 font-bold text-base"
                />
              </div>

              {/* Note (Optional) */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase text-gray-600 tracking-[0.1em]">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g. Cash, UPI, Cheque..."
                  className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 transition-all text-gray-900 font-bold text-base placeholder:text-gray-400"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handlePaymentSubmit}
                  disabled={processingPayment}
                  className="flex-1 px-6 py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-[2rem] font-extrabold flex items-center justify-center gap-3 transition-all active:scale-95 shadow-md shadow-amber-500/20 uppercase tracking-wide text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {processingPayment ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} />
                      Confirm Payment
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-6 py-4 bg-white border-2 border-gray-300 hover:bg-gray-100 text-gray-700 rounded-[2rem] font-extrabold transition-all uppercase tracking-wide text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}