"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Search, UserPlus, Phone, MapPin, Wallet, Eye, Users, Loader2 } from 'lucide-react';

export default function ClientsListPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
      setClients(data || []);
      setLoading(false);
    };
    fetchClients();
  }, []);

  const filtered = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.mobile.includes(searchTerm)
  );

  return (
    <div style={pageContainer}>
      <div style={headerSection}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><Users color="#007bff" /> Customers</h2>
          <p style={{ color: '#666', fontSize: '14px' }}>Manage customer profiles and repair history.</p>
        </div>
        <Link href="/clients/new" style={btnPrimary}><UserPlus size={18} /> Add Customer</Link>
      </div>

      <div style={toolbarSection}>
        <div style={searchWrapper}>
          <Search size={18} style={searchIcon} />
          <input placeholder="Search name or mobile..." style={searchInput} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div style={statsBadge}><b>Total:</b> {clients.length}</div>
      </div>

      <div style={tableWrapper}>
        {loading ? <div style={loaderContainer}><Loader2 className="animate-spin" /> Loading...</div> : (
          <table style={mainTable}>
            <thead>
              <tr style={tableHeader}>
                <th style={thStyle}>Customer Name</th>
                <th style={thStyle}>Location</th>
                <th style={thStyle}>Balance</th>
                <th style={{...thStyle, textAlign: 'center'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
  <tr key={c.id} style={trStyle}>
    <td style={tdStyle}>
      <div style={{ fontWeight: 'bold' }}>{c.name}</div>
      <div style={{ color: '#666', fontSize: '13px' }}><Phone size={12} /> {c.mobile}</div>
    </td>
    <td style={tdStyle}><MapPin size={14} color="#dc3545" /> {c.address || 'N/A'}</td>
    <td style={tdStyle}>
      <div style={{ fontWeight: 'bold', color: c.balance > 0 ? '#d9534f' : '#28a745' }}>
        <Wallet size={14} /> ₹{c.balance || 0}
      </div>
      {/* Niche Delivered Amount ki choti detail */}
      <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
        Paid: ₹{c.total_paid || 0}
      </div>
    </td>
    <td style={{...tdStyle, textAlign: 'center'}}>
      <Link href={`/clients/${c.id}/view`} style={btnAction}><Eye size={16} /> View Profile</Link>
    </td>
  </tr>
))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Reuse your existing styles...
// ... (Upar ka code wahi rahega)

// --- Styles with Type Safety ---
const containerStyle = { padding: '20px', maxWidth: '1200px', margin: '0 auto' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const btnAdd = { backgroundColor: '#007bff', color: 'white', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' as 'bold' };
const toolbarSection = { display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'center' };

// IN DONO MEIN React.CSSProperties LAGANA ZAROORI THA
const searchWrapper: React.CSSProperties = { position: 'relative', flex: 1 };
const searchIcon: React.CSSProperties = { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' };

const searchInput = { width: '100%', padding: '12px 12px 12px 40px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '15px', outline: 'none' };
const tableCard = { background: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' as 'collapse' };
const thStyle = { backgroundColor: '#f8f9fa', padding: '15px', textAlign: 'left' as 'left', borderBottom: '2px solid #eee', color: '#666', fontSize: '14px' };
const trStyle = { borderBottom: '1px solid #eee' };
const tdStyle = { padding: '15px', fontSize: '15px', verticalAlign: 'middle' as 'middle' };
const btnAction = { color: '#007bff', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' as 'bold', display: 'flex', alignItems: 'center', gap: '5px' };