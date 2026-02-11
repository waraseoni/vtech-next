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
const pageContainer = { padding: '10px' };
const headerSection = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const btnPrimary = { backgroundColor: '#007bff', color: 'white', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' };
const toolbarSection = { display: 'flex', gap: '20px', marginBottom: '20px' };
const searchWrapper = { position: 'relative', flex: 1 };
const searchIcon = { position: 'absolute', left: '12px', top: '12px', color: '#888' };
const searchInput = { width: '100%', padding: '12px 40px', borderRadius: '8px', border: '1px solid #ddd' };
const statsBadge = { padding: '10px 15px', background: '#eef2f7', borderRadius: '8px' };
const tableWrapper = { background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', overflow: 'hidden' };
const mainTable = { width: '100%', borderCollapse: 'collapse' as 'collapse' };
const tableHeader = { backgroundColor: '#f8f9fa' };
const thStyle = { padding: '15px', textAlign: 'left' as 'left', fontSize: '12px', color: '#666' };
const tdStyle = { padding: '15px', borderBottom: '1px solid #f1f1f1' };
const trStyle = { transition: '0.2s' };
const btnAction = { color: '#007bff', textDecoration: 'none', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' };
const loaderContainer: any = { padding: '60px', textAlign: 'center' };