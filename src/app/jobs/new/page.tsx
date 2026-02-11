"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, User, Smartphone, Hash, AlertCircle, IndianRupee, Search, Check } from 'lucide-react';
import Link from 'next/link';

export default function NewJob() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Searchable Dropdown States
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({ 
    client_id: "", 
    item_name: "", 
    serial_no: "", 
    problem: "", 
    labour_charges: "0" 
  });

  useEffect(() => {
    supabase.from('clients').select('*').then(({ data }) => setClients(data || []));

    // Bahar click karne par dropdown band karne ke liye
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter logic for search
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.mobile && c.mobile.includes(searchQuery))
  );

  const handleSelectClient = (client: any) => {
    setSelectedClient(client);
    setFormData({ ...formData, client_id: client.id.toString() });
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleSave = async () => {
    if (!formData.client_id || !formData.item_name) {
      alert("Please select a customer and enter item name.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('jobs').insert([{
      ...formData,
      client_id: parseInt(formData.client_id),
      final_bill: parseInt(formData.labour_charges)
    }]);

    if (!error) router.push('/jobs');
    else {
      alert("Error: " + error.message);
      setLoading(false);
    }
  };

  return (
    <div style={pageWrapper}>
      <div style={containerStyle}>
        <div style={headerNav}>
          <Link href="/jobs" style={backBtn}><ArrowLeft size={18} /> Back</Link>
        </div>

        <div style={cardHeader}>
          <h3 style={{ margin: 0 }}>Create New Job Card</h3>
        </div>

        <div style={formGrid}>
          {/* CUSTOM SEARCHABLE DROPDOWN */}
          <div style={inputGroupFull} ref={dropdownRef}>
            <label style={labelStyle}><User size={14} /> Search Customer</label>
            <div style={{ position: 'relative' }}>
              <div 
                style={customSelectTrigger} 
                onClick={() => setIsOpen(!isOpen)}
              >
                {selectedClient ? (
                  <span style={{color: '#333'}}><b>{selectedClient.name}</b> - {selectedClient.mobile}</span>
                ) : (
                  <span style={{color: '#888'}}>Type name or mobile...</span>
                )}
                <Search size={16} style={{color: '#888'}} />
              </div>

              {isOpen && (
                <div style={dropdownMenu}>
                  <input
                    autoFocus
                    placeholder="Type to search..."
                    style={searchInput}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div style={optionsContainer}>
                    {filteredClients.length > 0 ? (
                      filteredClients.map(c => (
                        <div 
                          key={c.id} 
                          style={optionItem} 
                          onClick={() => handleSelectClient(c)}
                        >
                          <div>
                            <div style={{fontWeight: '600'}}>{c.name}</div>
                            <div style={{fontSize: '12px', color: '#666'}}>{c.mobile}</div>
                          </div>
                          {selectedClient?.id === c.id && <Check size={16} color="#28a745" />}
                        </div>
                      ))
                    ) : (
                      <div style={{padding: '10px', color: '#888', textAlign: 'center'}}>No customer found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}><Smartphone size={14} /> Item Name</label>
            <input placeholder="Vivo Y20" style={inputStyle} onChange={(e) => setFormData({ ...formData, item_name: e.target.value })} />
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}><Hash size={14} /> Serial / IMEI</label>
            <input placeholder="IMEI No" style={inputStyle} onChange={(e) => setFormData({ ...formData, serial_no: e.target.value })} />
          </div>

          <div style={inputGroupFull}>
            <label style={labelStyle}><AlertCircle size={14} /> Problem (Fault)</label>
            <textarea placeholder="Explain fault..." style={{ ...inputStyle, height: '80px' }} onChange={(e) => setFormData({ ...formData, problem: e.target.value })} />
          </div>

          <div style={inputGroupFull}>
            <label style={labelStyle}><IndianRupee size={14} /> Labour Charges</label>
            <input type="number" style={inputStyle} onChange={(e) => setFormData({ ...formData, labour_charges: e.target.value })} />
          </div>
        </div>

        <button onClick={handleSave} disabled={loading} style={btnSuccess}>
          {loading ? "Saving..." : <><Save size={20} /> Save Job Card</>}
        </button>
      </div>
    </div>
  );
}

// --- Enhanced Styles ---
const customSelectTrigger: React.CSSProperties = {
  padding: '14px',
  background: '#fafafa',
  border: '1px solid #e0e0e0',
  borderRadius: '10px',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '15px'
};

const dropdownMenu: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  background: 'white',
  border: '1px solid #ddd',
  borderRadius: '10px',
  marginTop: '5px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
  zIndex: 1000,
  padding: '10px'
};

const searchInput: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  marginBottom: '10px',
  borderRadius: '6px',
  border: '1px solid #eee',
  outline: 'none',
  background: '#f9f9f9'
};

const optionsContainer: React.CSSProperties = {
  maxHeight: '200px',
  overflowY: 'auto'
};

const optionItem: React.CSSProperties = {
  padding: '10px',
  borderRadius: '6px',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid #f5f5f5'
};

// ... (Baaki styles pehle jaise hi hain)
const pageWrapper: React.CSSProperties = { background: '#f4f7f9', minHeight: '100vh', padding: '20px 15px' };
const containerStyle: React.CSSProperties = { maxWidth: '800px', margin: '0 auto', padding: '25px', background: 'white', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' };
const headerNav: React.CSSProperties = { marginBottom: '15px' };
const backBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#007bff', fontWeight: 'bold' };
const cardHeader: React.CSSProperties = { marginBottom: '20px' };
const formGrid: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '15px' };
const inputGroup: React.CSSProperties = { flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '5px' };
const inputGroupFull: React.CSSProperties = { flex: '1 1 100%', display: 'flex', flexDirection: 'column', gap: '5px' };
const labelStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 'bold', color: '#555', display: 'flex', alignItems: 'center', gap: '5px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #e0e0e0', fontSize: '15px', background: '#fafafa' };
const btnSuccess: React.CSSProperties = { background: '#28a745', color: 'white', width: '100%', padding: '16px', border: 'none', borderRadius: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', fontSize: '18px', fontWeight: 'bold', marginTop: '25px' };