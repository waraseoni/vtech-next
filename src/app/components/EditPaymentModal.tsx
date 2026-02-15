"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X } from 'lucide-react';

export default function EditPaymentModal({ paymentId, onClose, onSaved }: any) {
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [discount, setDiscount] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    const fetchPayment = async () => {
      const { data } = await supabase
        .from('client_payments')
        .select('*')
        .eq('id', paymentId)
        .single();
      if (data) {
        setPayment(data);
        setAmount(data.amount.toString());
        setPaymentDate(data.payment_date.split('T')[0]);
        setDiscount(data.discount?.toString() || '0');
        setPaymentMode(data.payment_mode);
        setRemarks(data.remarks || '');
      }
      setLoading(false);
    };
    fetchPayment();
  }, [paymentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('client_payments')
        .update({
          amount: parseFloat(amount),
          payment_date: paymentDate,
          discount: parseFloat(discount),
          payment_mode: paymentMode,
          remarks: remarks || null
        })
        .eq('id', paymentId);

      if (error) throw error;
      onSaved();
      onClose();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this payment permanently?')) return;
    
    try {
      await supabase.from('client_payments').delete().eq('id', paymentId);
      onSaved();
      onClose();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Edit Payment</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Same fields as add payment */}
          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl">
            Update Payment
          </button>
          <button 
            type="button" 
            onClick={handleDelete}
            className="w-full bg-red-600 text-white py-3 rounded-xl"
          >
            Delete Payment
          </button>
        </form>
      </div>
    </div>
  );
}