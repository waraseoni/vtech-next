"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Save } from 'lucide-react';

interface StockModalProps {
  productId: number;
  stock?: {
    id: number;
    quantity: number;
    place: string | null;
    stock_date: string;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function StockModal({ productId, stock, onClose, onSaved }: StockModalProps) {
  const [quantity, setQuantity] = useState(stock?.quantity || 0);
  const [place, setPlace] = useState(stock?.place || '');
  const [stockDate, setStockDate] = useState(stock?.stock_date || new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }
    setSaving(true);
    try {
      // Ensure place is never null (use empty string if blank)
      const placeValue = place || '';

      if (stock) {
        // Update
        const { error } = await supabase
          .from('inventory_list')
          .update({ quantity, place: placeValue, stock_date: stockDate })
          .eq('id', stock.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('inventory_list')
          .insert([{
            product_id: productId,
            quantity,
            place: placeValue,
            stock_date: stockDate,
          }]);
        if (error) throw error;
      }
      onSaved();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-extrabold">{stock ? 'Edit Stock' : 'Add Stock'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold uppercase text-gray-600 mb-1">Quantity *</label>
            <input
              type="number"
              step="any"
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-extrabold uppercase text-gray-600 mb-1">Place/Location</label>
            <input
              type="text"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
              placeholder="e.g. Shelf A1"
            />
          </div>
          <div>
            <label className="block text-xs font-extrabold uppercase text-gray-600 mb-1">Stock Date *</label>
            <input
              type="date"
              required
              value={stockDate}
              onChange={(e) => setStockDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold flex items-center justify-center gap-2 disabled:bg-gray-300"
            >
              <Save size={18} /> {saving ? 'Saving...' : (stock ? 'Update' : 'Add')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-6 bg-white border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}