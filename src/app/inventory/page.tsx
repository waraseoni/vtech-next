"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Package, Plus, Search, AlertTriangle, X, Save, Loader2 } from 'lucide-react';

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [newItem, setNewItem] = useState({
    partname: "", // Small letters
    category: "Stage Light",
    stock: "",
    price: "",
    minstock: "5" // Small letters
  });

  // --- Data Load karna (Fetch) ---
  const fetchInventory = async () => {
    setLoading(true);
    // order mein bhi small letters
    const { data, error } = await supabase.from('inventory').select('*').order('partname');
    
    if (error) {
      console.error("Fetch Error:", error.message);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { 
    fetchInventory(); 
  }, []);

  // --- Data Save karna (Insert) ---
  const handleSave = async () => {
    if (!newItem.partname || !newItem.stock || !newItem.price) {
      alert("Please fill all required fields!");
      return;
    }

    const { error } = await supabase.from('inventory').insert([{
      partname: newItem.partname,    // Small letters
      category: newItem.category,
      stock: parseInt(newItem.stock),
      price: parseInt(newItem.price),
      minstock: parseInt(newItem.minstock) // Small letters
    }]);

    if (error) {
      alert("Error: " + error.message);
    } else {
      setShowForm(false);
      setNewItem({ partname: "", category: "Stage Light", stock: "", price: "", minstock: "5" });
      fetchInventory(); // Data refresh karein
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Inventory / Spare Parts (V-Tech)</h2>
        <button 
          onClick={() => setShowForm(true)} 
          style={{ backgroundColor: '#17a2b8', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} /> Add New Part
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '20px', position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#888' }} />
        <input 
          type="text" 
          placeholder="Search items..." 
          style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '5px', border: '1px solid #ddd' }}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table Area */}
      <div style={{ backgroundColor: 'white', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="animate-spin" /> Loading Inventory...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={tdStyle}>Part Name</th>
                <th style={tdStyle}>Category</th>
                <th style={tdStyle}>Stock</th>
                <th style={tdStyle}>Price</th>
                <th style={tdStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.filter(i => i.partname?.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={tdStyle}><b>{item.partname}</b></td>
                  <td style={tdStyle}>{item.category}</td>
                  <td style={tdStyle}>{item.stock}</td>
                  <td style={tdStyle}>₹{item.price}</td>
                  <td style={tdStyle}>
                    {item.stock <= item.minstock ? (
                      <span style={{ color: 'red', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={14}/> LOW
                      </span>
                    ) : (
                      <span style={{ color: 'green', fontWeight: 'bold' }}>OK</span>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center' }}>No items in inventory.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* --- ADD PART MODAL FORM --- */}
      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', width: '400px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Register Spare Part</h3>
              <X size={24} onClick={() => setShowForm(false)} style={{ cursor: 'pointer', color: '#888' }} />
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Part Name *</label>
                <input style={inputStyle} placeholder="Ex: Sharpy 7R Lamp" value={newItem.partname} onChange={(e) => setNewItem({...newItem, partname: e.target.value})} />
              </div>

              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={newItem.category} onChange={(e) => setNewItem({...newItem, category: e.target.value})}>
                   <option>Stage Light</option>
                   <option>Industrial PSU</option>
                   <option>ICs / Components</option>
                   <option>Sharpy Parts</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Stock Qty *</label>
                  <input type="number" style={inputStyle} placeholder="0" value={newItem.stock} onChange={(e) => setNewItem({...newItem, stock: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Min. Stock Alert</label>
                  <input type="number" style={inputStyle} placeholder="5" value={newItem.minstock} onChange={(e) => setNewItem({...newItem, minstock: e.target.value})} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Unit Price (₹) *</label>
                <input type="number" style={inputStyle} placeholder="0" value={newItem.price} onChange={(e) => setNewItem({...newItem, price: e.target.value})} />
              </div>

              <button 
                onClick={handleSave} 
                style={{ width: '100%', padding: '12px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
              >
                Save to Database
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = { fontSize: '13px', fontWeight: 'bold' as 'bold', color: '#555', marginBottom: '4px', display: 'block' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' as 'border-box' };
const tdStyle = { padding: '15px' };