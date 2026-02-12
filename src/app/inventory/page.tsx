"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
  Package, Plus, Search, AlertTriangle, X, Save, 
  Loader2, Edit3, Trash2, Box, Tag, DollarSign, Layers, Eye
} from 'lucide-react';

type InventoryItem = {
  id: number;
  partname: string;
  category: string;
  stock: number;
  price: number;
  minstock: number;
  created_at?: string;
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  const [formData, setFormData] = useState({
    partname: "",
    category: "Stage Light",
    stock: "",
    price: "",
    minstock: "5"
  });

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch inventory
  const fetchInventory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('partname');
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error("Error fetching inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchInventory(); 
  }, []);

  // Open modal for add
  const handleAddNew = () => {
    setEditingItem(null);
    setFormData({
      partname: "",
      category: "Stage Light",
      stock: "",
      price: "",
      minstock: "5"
    });
    setShowModal(true);
  };

  // Open modal for edit
  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      partname: item.partname,
      category: item.category,
      stock: item.stock.toString(),
      price: item.price.toString(),
      minstock: item.minstock.toString()
    });
    setShowModal(true);
  };

  // Save item (insert or update)
  const handleSave = async () => {
    if (!formData.partname.trim()) {
      alert("Part name is required!");
      return;
    }
    if (!formData.stock) {
      alert("Stock quantity is required!");
      return;
    }
    if (!formData.price) {
      alert("Price is required!");
      return;
    }

    const payload = {
      partname: formData.partname.trim(),
      category: formData.category,
      stock: parseInt(formData.stock) || 0,
      price: parseInt(formData.price) || 0,
      minstock: parseInt(formData.minstock) || 5
    };

    try {
      if (editingItem) {
        // Update
        const { error } = await supabase
          .from('inventory')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        alert("Part updated successfully! ✅");
      } else {
        // Insert
        const { error } = await supabase
          .from('inventory')
          .insert([payload]);
        if (error) throw error;
        alert("New part added successfully! ✅");
      }
      setShowModal(false);
      fetchInventory();
    } catch (err: any) {
      console.error("Error saving part:", err);
      alert("Error: " + err.message);
    }
  };

  // Delete item
  const handleDelete = async (id: number, name: string) => {
    if (confirm(`Kya aap "${name}" ko delete karna chahte hain?`)) {
      try {
        const { error } = await supabase
          .from('inventory')
          .delete()
          .eq('id', id);
        if (error) throw error;
        setItems(prev => prev.filter(item => item.id !== id));
      } catch (err: any) {
        console.error("Error deleting part:", err);
        alert("Delete failed: " + err.message);
      }
    }
  };

  // Filter items
  const filteredItems = items.filter(item =>
    item.partname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 bg-white">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-gray-500 font-bold italic uppercase tracking-[0.25em] text-sm">
          Loading Inventory...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ===== HEADER CARD ===== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50 p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <Package className="text-white" size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tighter m-0 uppercase leading-none">
                Inventory
              </h2>
              <p className="text-blue-600 text-[11px] font-extrabold uppercase tracking-[0.25em] mt-2">
                Total Parts: {items.length}
              </p>
            </div>
          </div>
          <button 
            onClick={handleAddNew}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-[2rem] font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 no-underline uppercase tracking-tight shadow-md shadow-blue-500/20 text-sm"
          >
            <Plus size={20} strokeWidth={2.5} /> Add New Part
          </button>
        </div>

        {/* ===== SEARCH BOX ===== */}
        <div className="relative group">
          <Search size={22} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
          <input 
            placeholder="Search by part name or category..." 
            value={searchTerm}
            className="w-full pl-16 pr-8 py-5 bg-white border-2 border-gray-300 rounded-[2rem] outline-none focus:border-blue-600 transition-all shadow-md text-gray-900 font-bold text-lg placeholder:text-gray-400 placeholder:font-medium"
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>

        {/* ===== INVENTORY LIST ===== */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-400 shadow-md">
            <Package size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 font-bold italic uppercase tracking-wider text-sm">
              No parts found matching your search
            </p>
          </div>
        ) : isMobile ? (
          /* ----- MOBILE CARDS ----- */
          <div className="grid gap-4">
            {filteredItems.map(item => (
              <div 
                key={item.id} 
                className="bg-white p-6 rounded-[2rem] border-2 border-gray-300 shadow-md space-y-4"
              >
                {/* Header: Part Name + Stock Status */}
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-extrabold text-gray-900 text-lg uppercase tracking-tight">
                      {item.partname}
                    </span>
                    <div className="text-xs text-gray-600 font-bold mt-1">
                      {item.category}
                    </div>
                  </div>
                  <span className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border-2 ${
                    item.stock <= item.minstock
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {item.stock <= item.minstock ? (
                      <span className="flex items-center gap-1">
                        <AlertTriangle size={12} /> LOW
                      </span>
                    ) : 'OK'}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border-2 border-gray-200">
                  <div>
                    <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider">
                      Stock
                    </p>
                    <p className="font-extrabold text-gray-900 text-lg">
                      {item.stock}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider">
                      Price
                    </p>
                    <p className="font-extrabold text-emerald-700 text-lg">
                      ₹{item.price}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider">
                      Min. Stock Alert
                    </p>
                    <p className="font-bold text-gray-700">
                      {item.minstock}
                    </p>
                  </div>
                </div>

                {/* Action Buttons – View, Edit, Delete */}
                <div className="grid grid-cols-3 gap-3">
                  <Link
                    href={`/inventory/${item.id}/view`}
                    className="flex flex-col items-center gap-1 p-3 bg-white border-2 border-gray-300 rounded-xl no-underline text-gray-700 hover:bg-gray-100 transition-all"
                  >
                    <Eye size={18} /> 
                    <span className="text-[9px] font-extrabold uppercase">View</span>
                  </Link>
                  <button
                    onClick={() => handleEdit(item)}
                    className="flex flex-col items-center gap-1 p-3 bg-blue-50 border-2 border-blue-200 rounded-xl font-extrabold text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
                  >
                    <Edit3 size={18} /> 
                    <span className="text-[9px] font-extrabold uppercase">Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(item.id, item.partname)}
                    className="flex flex-col items-center gap-1 p-3 bg-red-50 border-2 border-red-200 rounded-xl font-extrabold text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
                  >
                    <Trash2 size={18} /> 
                    <span className="text-[9px] font-extrabold uppercase">Del</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ----- DESKTOP TABLE ----- */
          <div className="bg-white rounded-[2.5rem] shadow-md border-2 border-gray-300 overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 border-b-2 border-gray-300">
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase tracking-[0.15em]">Part Name</th>
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase tracking-[0.15em]">Category</th>
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase tracking-[0.15em]">Stock</th>
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase tracking-[0.15em]">Price (₹)</th>
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase tracking-[0.15em]">Status</th>
                  <th className="px-6 py-5 text-center text-[11px] font-extrabold uppercase tracking-[0.15em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="font-extrabold text-gray-900 text-base tracking-tight">
                        {item.partname}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1.5 bg-gray-100 border-2 border-gray-200 rounded-full text-[10px] font-extrabold text-gray-700 uppercase">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-5 font-extrabold text-gray-900">
                      {item.stock}
                    </td>
                    <td className="px-6 py-5 font-extrabold text-emerald-700">
                      ₹{item.price}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border-2 ${
                        item.stock <= item.minstock
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {item.stock <= item.minstock ? (
                          <span className="flex items-center gap-1">
                            <AlertTriangle size={12} /> LOW
                          </span>
                        ) : 'OK'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        {/* View Button */}
                        <Link
                          href={`/inventory/${item.id}/view`}
                          className="p-2.5 bg-white border-2 border-gray-300 text-gray-600 rounded-xl hover:bg-gray-100 transition-all"
                          title="View Usage"
                        >
                          <Eye size={18} />
                        </Link>
                        {/* Edit Button */}
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2.5 bg-white border-2 border-gray-300 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
                          title="Edit Part"
                        >
                          <Edit3 size={18} />
                        </button>
                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(item.id, item.partname)}
                          className="p-2.5 bg-white border-2 border-gray-300 text-red-600 rounded-xl hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
                          title="Delete Part"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== ADD/EDIT MODAL – PREMIUM GLASS DESIGN ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-2xl animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 rounded-xl shadow-md shadow-blue-500/30">
                  <Box className="text-white" size={22} />
                </div>
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                  {editingItem ? 'Edit Part' : 'Add New Part'}
                </h3>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-5">
              {/* Part Name */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase text-gray-600 tracking-[0.1em]">
                  <Tag size={16} className="text-blue-600" />
                  Part Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.partname}
                  onChange={(e) => setFormData({...formData, partname: e.target.value})}
                  placeholder="e.g. Sharpy 7R Lamp"
                  className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 font-bold text-base placeholder:text-gray-400"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase text-gray-600 tracking-[0.1em]">
                  <Layers size={16} className="text-blue-600" />
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 font-bold text-base appearance-none cursor-pointer"
                >
                  <option>Stage Light</option>
                  <option>Industrial PSU</option>
                  <option>ICs / Components</option>
                  <option>Sharpy Parts</option>
                  <option>Other</option>
                </select>
              </div>

              {/* Stock & Min Stock */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase text-gray-600 tracking-[0.1em]">
                    Stock Qty <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({...formData, stock: e.target.value})}
                    placeholder="0"
                    className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 font-bold text-base placeholder:text-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase text-gray-600 tracking-[0.1em]">
                    Min. Alert
                  </label>
                  <input
                    type="number"
                    value={formData.minstock}
                    onChange={(e) => setFormData({...formData, minstock: e.target.value})}
                    placeholder="5"
                    className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 font-bold text-base placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Price */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase text-gray-600 tracking-[0.1em]">
                  <DollarSign size={16} className="text-blue-600" />
                  Unit Price (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  placeholder="0"
                  className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 font-bold text-base placeholder:text-gray-400"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSave}
                  className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-extrabold flex items-center justify-center gap-3 transition-all active:scale-95 shadow-md shadow-blue-500/20 uppercase tracking-wide text-sm"
                >
                  <Save size={20} strokeWidth={2.5} />
                  {editingItem ? 'Update Part' : 'Save Part'}
                </button>
                <button
                  onClick={() => setShowModal(false)}
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