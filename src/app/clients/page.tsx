"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, UserPlus, Search, Phone, MapPin, Wallet, Eye, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase.from('clients').select('*').order('name');
      setClients(data || []);
      setLoading(false);
    };
    fetchClients();
  }, []);

  const filtered = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.mobile.includes(searchTerm)
  );

  if (loading) return (
    <div style={loaderContainer}>
      <Loader2 className="animate-spin" size={32} />
      <p>Loading Customers...</p>
    </div>
  );

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users color="#007bff" /> Customers
          </h2>
          <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '14px' }}>Total: {clients.length} Clients</p>
        </div>
        <Link href="/clients/new" style={btnAdd}>
          <UserPlus size={18} /> Add New Client
        </Link>
      </div>

      <div style={toolbarSection}>
        <div style={searchWrapper}>
          <Search size={18} style={searchIcon} />
          <input 
            placeholder="Search name or mobile..." 
            style={searchInput} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      <div style={tableCard}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Client Details</th>
              <th style={thStyle}>Address</th>
              <th style={thStyle}>Business / Balance</th>
              <th style={{...thStyle, textAlign: 'center'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} style={trStyle}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                  <div style={{ color: '#666', fontSize: '13px' }}>{c.mobile}</div>
                </td>
                <td style={tdStyle}>{c.address || 'N/A'}</td>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 'bold' }}>₹{c.balance || 0}</div>
                </td>
                <td style={{...tdStyle, textAlign: 'center'}}>
                  <Link href={`/clients/${c.id}/view`} style={btnAction}>
                    <Eye size={16} /> View Profile
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Fixed Styles for Vercel Build ---
const containerStyle: React.CSSProperties = { padding: '20px', maxWidth: '1200px', margin: '0 auto' };
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const btnAdd: React.CSSProperties = { backgroundColor: '#007bff', color: 'white', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' };
const toolbarSection: React.CSSProperties = { display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'center' };
const searchWrapper: React.CSSProperties = { position: 'relative', flex: 1 };
const searchIcon: React.CSSProperties = { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' };
const searchInput: React.CSSProperties = { width: '100%', padding: '12px 12px 12px 40px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '15px', outline: 'none' };
const tableCard: React.CSSProperties = { background: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const thStyle: React.CSSProperties = { backgroundColor: '#f8f9fa', padding: '15px', textAlign: 'left', borderBottom: '2px solid #eee', color: '#666', fontSize: '14px' };
const trStyle: React.CSSProperties = { borderBottom: '1px solid #eee' };
const tdStyle: React.CSSProperties = { padding: '15px', fontSize: '15px' };
const btnAction: React.CSSProperties = { color: '#007bff', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' };
const loaderContainer: React.CSSProperties = { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '300px', gap: '10px', color: '#666' };