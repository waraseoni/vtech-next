"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
  Package, Plus, Search, AlertTriangle, X, Save, 
  Loader2, Edit3, Trash2, Box, Tag, DollarSign, Layers, Eye, ShieldCheck
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
  const [userRole, setUserRole] = useState<string | null>(null); // Naya: Role state

  const [formData, setFormData] = useState({
    partname: "",
    category: "Stage Light",
    stock: "",
    price: "",
    minstock: "5"
  });

  // Mobile detection aur User Role fetch
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        setUserRole(profile?.role || 'staff');
      }
    };
    checkUserRole();

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch inventory
  const fetchInventory = useCallback(async () => {
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
  }, []);

  useEffect(() => { 
    fetchInventory(); 
  }, [fetchInventory]);

  // Save handler - Permission check ke saath
  const handleSave = async () => {
    // Staff ko save/edit karne se rokna (Security layer)
    if (userRole !== 'admin') {
      alert("Permission Denied: Sirf Admin hi inventory badal sakta hai!");
      return;
    }

    if (!formData.partname.trim() || !formData.stock || !formData.price) {
      alert("Please fill all required fields!");
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
        const { error } = await supabase.from('inventory').update(payload).eq('id', editingItem.id);
        if (error) throw error;
        alert("Part updated successfully! ✅");
      } else {
        const { error } = await supabase.from('inventory').insert([payload]);
        if (error) throw error;
        alert("New part added successfully! ✅");
      }
      setShowModal(false);
      fetchInventory();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Delete handler - Admin permission
  const handleDelete = async (id: number, name: string) => {
    if (userRole !== 'admin') {
      alert("Permission Denied: Sirf Admin hi delete kar sakta hai!");
      return;
    }
    if (confirm(`Kya aap "${name}" ko delete karna chahte hain?`)) {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (!error) setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const filteredItems = items.filter(item =>
    item.partname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 bg-white">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-gray-500 font-bold italic uppercase tracking-[0.25em] text-sm">Loading Inventory...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER CARD */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50 p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <Package className="text-white" size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-black text-gray-900 tracking-tighter m-0 uppercase leading-none">Inventory</h2>
                {userRole === 'admin' && <ShieldCheck className="text-emerald-600" size={24} title="Admin Access" />}
              </div>
              <p className="text-blue-600 text-[11px] font-extrabold uppercase tracking-[0.25em] mt-2">
                {userRole === 'admin' ? "Full Control" : "Staff View"} | Total Parts: {items.length}
              </p>
            </div>
          </div>
          {/* Admin ko hi Add button dikhega */}
          {userRole === 'admin' && (
            <button 
              onClick={() => { setEditingItem(null); setFormData({partname: "", category: "Stage Light", stock: "", price: "", minstock: "5"}); setShowModal(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-[2rem] font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-tight shadow-md shadow-blue-500/20 text-sm"
            >
              <Plus size={20} strokeWidth={2.5} /> Add New Part
            </button>
          )}
        </div>

        {/* SEARCH BOX */}
        <div className="relative group">
          <Search size={22} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
          <input 
            placeholder="Search by part name or category..." 
            value={searchTerm}
            className="w-full pl-16 pr-8 py-5 bg-white border-2 border-gray-300 rounded-[2rem] outline-none focus:border-blue-600 transition-all shadow-md text-gray-900 font-bold text-lg placeholder:text-gray-400"
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>

        {/* INVENTORY LIST */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-400 shadow-md">
            <Package size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 font-bold italic uppercase tracking-wider text-sm">No parts found</p>
          </div>
        ) : isMobile ? (
          /* MOBILE CARDS */
          <div className="grid gap-4">
            {filteredItems.map(item => (
              <div key={item.id} className="bg-white p-6 rounded-[2rem] border-2 border-gray-300 shadow-md space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-extrabold text-gray-900 text-lg uppercase tracking-tight">{item.partname}</span>
                    <div className="text-xs text-gray-600 font-bold mt-1">{item.category}</div>
                  </div>
                  <span className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold border-2 ${item.stock <= item.minstock ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {item.stock <= item.minstock ? 'LOW' : 'OK'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border-2 border-gray-200">
                  <div><p className="text-[9px] font-extrabold uppercase text-gray-500">Stock</p><p className="font-extrabold text-gray-900 text-lg">{item.stock}</p></div>
                  <div><p className="text-[9px] font-extrabold uppercase text-gray-500">Price</p><p className="font-extrabold text-emerald-700 text-lg">₹{item.price}</p></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Link href={`/inventory/${item.id}/view`} className="flex flex-col items-center gap-1 p-3 bg-white border-2 border-gray-300 rounded-xl no-underline text-gray-700"><Eye size={18} /><span className="text-[9px] font-extrabold uppercase">View</span></Link>
                  {userRole === 'admin' && (
                    <>
                      <button onClick={() => { setEditingItem(item); setFormData({partname: item.partname, category: item.category, stock: item.stock.toString(), price: item.price.toString(), minstock: item.minstock.toString()}); setShowModal(true); }} className="flex flex-col items-center gap-1 p-3 bg-blue-50 border-2 border-blue-200 rounded-xl text-blue-700"><Edit3 size={18} /><span className="text-[9px] font-extrabold uppercase">Edit</span></button>
                      <button onClick={() => handleDelete(item.id, item.partname)} className="flex flex-col items-center gap-1 p-3 bg-red-50 border-2 border-red-200 rounded-xl text-red-700"><Trash2 size={18} /><span className="text-[9px] font-extrabold uppercase">Del</span></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* DESKTOP TABLE */
          <div className="bg-white rounded-[2.5rem] shadow-md border-2 border-gray-300 overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 border-b-2 border-gray-300">
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase">Part Name</th>
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase">Category</th>
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase">Stock</th>
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase">Price (₹)</th>
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase">Status</th>
                  <th className="px-6 py-5 text-center text-[11px] font-extrabold uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-5 font-extrabold text-gray-900">{item.partname}</td>
                    <td className="px-6 py-5"><span className="px-3 py-1.5 bg-gray-100 border-2 border-gray-200 rounded-full text-[10px] font-extrabold uppercase">{item.category}</span></td>
                    <td className="px-6 py-5 font-extrabold">{item.stock}</td>
                    <td className="px-6 py-5 font-extrabold text-emerald-700">₹{item.price}</td>
                    <td className="px-6 py-5"><span className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold border-2 ${item.stock <= item.minstock ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{item.stock <= item.minstock ? 'LOW' : 'OK'}</span></td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/inventory/${item.id}/view`} className="p-2.5 bg-white border-2 border-gray-300 text-gray-600 rounded-xl hover:bg-gray-100 transition-all"><Eye size={18} /></Link>
                        {userRole === 'admin' && (
                          <>
                            <button onClick={() => { setEditingItem(item); setFormData({partname: item.partname, category: item.category, stock: item.stock.toString(), price: item.price.toString(), minstock: item.minstock.toString()}); setShowModal(true); }} className="p-2.5 bg-white border-2 border-gray-300 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Edit3 size={18} /></button>
                            <button onClick={() => handleDelete(item.id, item.partname)} className="p-2.5 bg-white border-2 border-gray-300 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={18} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL (Admin Only) */}
      {showModal && userRole === 'admin' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 rounded-xl shadow-md"><Box className="text-white" size={22} /></div>
                <h3 className="text-xl font-black text-gray-900 uppercase">{editingItem ? 'Edit Part' : 'Add New Part'}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="space-y-5">
              <div className="space-y-2"><label className="text-[11px] font-extrabold uppercase text-gray-600">Part Name *</label><input type="text" value={formData.partname} onChange={(e) => setFormData({...formData, partname: e.target.value})} className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 font-bold" /></div>
              <div className="space-y-2"><label className="text-[11px] font-extrabold uppercase text-gray-600">Category</label><select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl font-bold"><option>Stage Light</option><option>Industrial PSU</option><option>ICs / Components</option><option>Sharpy Parts</option><option>Other</option></select></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-[11px] font-extrabold uppercase text-gray-600">Stock Qty *</label><input type="number" value={formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value})} className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl font-bold" /></div>
                <div className="space-y-2"><label className="text-[11px] font-extrabold uppercase text-gray-600">Min. Alert</label><input type="number" value={formData.minstock} onChange={(e) => setFormData({...formData, minstock: e.target.value})} className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl font-bold" /></div>
              </div>
              <div className="space-y-2"><label className="text-[11px] font-extrabold uppercase text-gray-600">Unit Price (₹) *</label><input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl font-bold" /></div>
              <div className="flex gap-3 pt-4">
                <button onClick={handleSave} className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-extrabold uppercase shadow-md"><Save size={20} /> {editingItem ? 'Update Part' : 'Save Part'}</button>
                <button onClick={() => setShowModal(false)} className="px-6 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-[2rem] font-extrabold uppercase">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}