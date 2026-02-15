"use client";
import { useState, useEffect, use } from 'react'; // ✅ 'use' import करें
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, IndianRupee, Calendar, CreditCard, Receipt } from 'lucide-react';
import Link from 'next/link';

export default function AddPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  // ✅ params को unwrap करें
  const resolvedParams = use(params);
  const router = useRouter();
  const clientId = parseInt(resolvedParams.id);
  
  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState('');
  const [jobs, setJobs] = useState<any[]>([]);
  const [directSales, setDirectSales] = useState<any[]>([]);

  // Form state
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [discount, setDiscount] = useState('0');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  const [referenceType, setReferenceType] = useState('none');
  const [jobId, setJobId] = useState('');
  const [billNo, setBillNo] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const { data: client } = await supabase
        .from('clients')
        .select('name')
        .eq('id', clientId)
        .single();
      if (client) setClientName(client.name);

      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, item_name, final_bill')
        .eq('client_id', clientId)
        .not('status', 'in', '("Delivered","Cancelled")')
        .order('created_at', { ascending: false });
      setJobs(jobsData || []);

      const { data: salesData } = await supabase
        .from('direct_sales')
        .select('id, sale_code, total_amount')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      setDirectSales(salesData || []);
    };
    fetchData();
  }, [clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const paymentData: any = {
        client_id: clientId,
        amount: parseFloat(amount),
        payment_date: paymentDate,
        discount: parseFloat(discount) || 0,
        payment_mode: paymentMode,
        remarks: remarks || null,
      };
      if (referenceType === 'job' && jobId) {
        paymentData.job_id = parseInt(jobId);
      } else if (referenceType === 'sale' && billNo) {
        paymentData.bill_no = billNo;
      }
      const { error } = await supabase.from('client_payments').insert([paymentData]);
      if (error) throw error;
      router.push(`/clients/${clientId}/view`);
      router.refresh();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/clients/${clientId}/view`} className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Add New Payment</h1>
            <p className="text-sm text-gray-600 mt-1">Client: {clientName}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border-2 border-gray-300 p-6 space-y-6">
          {/* Amount & Date Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-extrabold uppercase text-gray-500 block mb-2">
                <IndianRupee size={14} className="inline mr-1" /> Amount Received *
              </label>
              <input
                type="number" step="0.01" required value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-xs font-extrabold uppercase text-gray-500 block mb-2">
                <Calendar size={14} className="inline mr-1" /> Payment Date *
              </label>
              <input
                type="date" required value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
              />
            </div>
          </div>
          {/* Discount & Mode Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-extrabold uppercase text-gray-500 block mb-2">Discount (if any)</label>
              <input
                type="number" step="0.01" value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-xs font-extrabold uppercase text-gray-500 block mb-2">
                <CreditCard size={14} className="inline mr-1" /> Payment Mode *
              </label>
              <select
                value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
              >
                <option>Cash</option>
                <option>PhonePe/GPay</option>
                <option>Bank Transfer</option>
                <option>Credit Card</option>
              </select>
            </div>
          </div>
          {/* Reference Type */}
          <div>
            <label className="text-xs font-extrabold uppercase text-gray-500 block mb-2">
              <Receipt size={14} className="inline mr-1" /> Reference (Optional)
            </label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2">
                <input type="radio" name="refType" value="none" checked={referenceType === 'none'} onChange={(e) => setReferenceType(e.target.value)} />
                <span className="text-sm">No Reference</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="refType" value="job" checked={referenceType === 'job'} onChange={(e) => setReferenceType(e.target.value)} />
                <span className="text-sm">Link to Job</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="refType" value="sale" checked={referenceType === 'sale'} onChange={(e) => setReferenceType(e.target.value)} />
                <span className="text-sm">Link to Bill</span>
              </label>
            </div>
            {referenceType === 'job' && (
              <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="w-full p-3 border-2 border-gray-300 rounded-xl">
                <option value="">Select a job</option>
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>{job.item_name} - ₹{job.final_bill}</option>
                ))}
              </select>
            )}
            {referenceType === 'sale' && (
              <select value={billNo} onChange={(e) => setBillNo(e.target.value)} className="w-full p-3 border-2 border-gray-300 rounded-xl">
                <option value="">Select a sale</option>
                {directSales.map(sale => (
                  <option key={sale.id} value={sale.sale_code}>{sale.sale_code} - ₹{sale.total_amount}</option>
                ))}
              </select>
            )}
          </div>
          {/* Remarks */}
          <div>
            <label className="text-xs font-extrabold uppercase text-gray-500 block mb-2">Remarks</label>
            <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none" placeholder="Any notes..." />
          </div>
          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4">
            <Link href={`/clients/${clientId}/view`} className="px-6 py-3 bg-gray-100 rounded-xl font-bold hover:bg-gray-200">Cancel</Link>
            <button type="submit" disabled={loading} className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-extrabold uppercase hover:bg-emerald-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}