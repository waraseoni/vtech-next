"use client";
import { useState, useEffect, use } from 'react'; // ✅ 'use' import करें
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, ShoppingCart, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function AddDirectSalePage({ params }: { params: Promise<{ id: string }> }) {
  // ✅ params को unwrap करें
  const resolvedParams = use(params);
  const router = useRouter();
  const clientId = parseInt(resolvedParams.id);
  
  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState('');
  const [saleCode, setSaleCode] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState([{ description: '', quantity: 1, price: 0 }]);

  useEffect(() => {
    const fetchClient = async () => {
      const { data } = await supabase
        .from('clients')
        .select('name')
        .eq('id', clientId)
        .single();
      if (data) setClientName(data.name);
    };
    fetchClient();
    setSaleCode(`SALE-${Date.now()}`);
  }, [clientId]);

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const totalAmount = calculateTotal();
      const { data: sale, error: saleError } = await supabase
        .from('direct_sales')
        .insert([{
          client_id: clientId,
          sale_code: saleCode,
          payment_mode: paymentMode,
          remarks: remarks || null,
          total_amount: totalAmount,
          items: items
        }])
        .select()
        .single();
      if (saleError) throw saleError;
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
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/clients/${clientId}/view`} className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">New Direct Sale</h1>
            <p className="text-sm text-gray-600 mt-1">Client: {clientName}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border-2 border-gray-300 p-6 space-y-6">
          {/* Sale Code & Payment Mode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-extrabold uppercase text-gray-500 block mb-2">Sale Code</label>
              <input type="text" value={saleCode} readOnly className="w-full p-3 border-2 border-gray-300 rounded-xl bg-gray-50" />
            </div>
            <div>
              <label className="text-xs font-extrabold uppercase text-gray-500 block mb-2">Payment Mode</label>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full p-3 border-2 border-gray-300 rounded-xl">
                <option>Cash</option>
                <option>PhonePe/GPay</option>
                <option>Bank Transfer</option>
                <option>Credit Card</option>
              </select>
            </div>
          </div>
          {/* Items Table */}
          <div>
            <label className="text-xs font-extrabold uppercase text-gray-500 block mb-3">Items</label>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <input type="text" placeholder="Description" value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} className="flex-1 p-3 border-2 border-gray-300 rounded-xl" required />
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)} className="w-20 p-3 border-2 border-gray-300 rounded-xl" min="1" required />
                  <input type="number" step="0.01" placeholder="Price" value={item.price} onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)} className="w-28 p-3 border-2 border-gray-300 rounded-xl" required />
                  <button type="button" onClick={() => removeItem(index)} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItem} className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100"><Plus size={16} /> Add Item</button>
          </div>
          {/* Total */}
          <div className="flex justify-end">
            <div className="bg-gray-100 p-4 rounded-xl">
              <span className="text-xs font-extrabold uppercase text-gray-500 block">Total Amount</span>
              <span className="text-2xl font-black text-emerald-600">₹{calculateTotal().toFixed(2)}</span>
            </div>
          </div>
          {/* Remarks */}
          <div>
            <label className="text-xs font-extrabold uppercase text-gray-500 block mb-2">Remarks</label>
            <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full p-3 border-2 border-gray-300 rounded-xl" placeholder="Any notes..." />
          </div>
          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4">
            <Link href={`/clients/${clientId}/view`} className="px-6 py-3 bg-gray-100 rounded-xl font-bold hover:bg-gray-200">Cancel</Link>
            <button type="submit" disabled={loading} className="px-8 py-3 bg-purple-600 text-white rounded-xl font-extrabold uppercase hover:bg-purple-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}