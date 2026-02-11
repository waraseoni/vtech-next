"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Plus, Eye, Settings, Wrench, Search, Loader2 } from 'lucide-react';

export default function JobsList() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 1. Screen size check karne ka logic
    const checkSize = () => setIsMobile(window.innerWidth < 991);
    
    // 2. Initial check aur mounting confirm karna
    checkSize();
    setMounted(true);

    // 3. Database se data lana
    const fetchJobs = async () => {
      const { data } = await supabase.from('jobs').select('*, clients(name)').order('created_at', { ascending: false });
      setJobs(data || []);
      setLoading(false);
    };

    fetchJobs();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const filteredJobs = jobs.filter(j => 
    j.clients?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    j.id.toString().includes(searchTerm)
  );

  // Jab tak component mount na ho (Hydration), kuch mat dikhao taaki error na aaye
  if (!mounted) return null;

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '50px', gap: '10px' }}>
      <Loader2 className="animate-spin" /> Loading Jobs...
    </div>
  );

  return (
    <div style={containerStyle}>
      {/* Header Section */}
      <div style={headerSection}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Wrench color="#007bff" /> Job List
        </h2>
        <Link href="/jobs/new" style={btnPrimary}><Plus size={18} /> New Entry</Link>
      </div>

      {/* Search Section */}
      <div style={searchContainer}>
        <Search size={18} style={searchIcon} />
        <input 
          placeholder="Search Client or Job ID..." 
          style={inputStyle} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
      </div>

      {/* --- CONDITIONAL RENDERING (Yahan logic decide karega kya dikhana hai) --- */}
      {isMobile ? (
        // --- MOBILE ONLY VIEW ---
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {filteredJobs.map(job => (
            <div key={job.id} style={mobileCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>#VT-{job.id}</span>
                <span style={getStatusBadge(job.status)}>{job.status}</span>
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{job.clients?.name}</div>
              <div style={{ color: '#555', margin: '5px 0' }}>{job.item_name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                <div style={{ fontWeight: 'bold', color: '#007bff' }}>₹{job.final_bill}</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Link href={`/jobs/${job.id}/view`} style={btnViewMobile}>View</Link>
                  <Link href={`/jobs/${job.id}`} style={btnManageMobile}>Manage</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // --- PC ONLY VIEW ---
        <div style={cardStyle}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8f9fa' }}>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Device</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map(job => (
                  <tr key={job.id} style={trStyle}>
                    <td style={tdStyle}>#VT-{job.id}</td>
                    <td style={tdStyle}><b>{job.clients?.name}</b></td>
                    <td style={tdStyle}>{job.item_name}</td>
                    <td style={tdStyle}><span style={getStatusBadge(job.status)}>{job.status}</span></td>
                    <td style={tdStyle}>₹{job.final_bill}</td>
                    <td style={{ ...tdStyle, display: 'flex', gap: '8px' }}>
                      <Link href={`/jobs/${job.id}/view`} style={btnView}><Eye size={14} /></Link>
                      <Link href={`/jobs/${job.id}`} style={btnManage}><Settings size={14} /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Styles (Wahi purane wale, bas fix kiye gaye hain) ---
const containerStyle: React.CSSProperties = { padding: '15px', maxWidth: '1200px', margin: '0 auto' };
const headerSection: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const searchContainer: React.CSSProperties = { position: 'relative', marginBottom: '20px' };
const searchIcon: React.CSSProperties = { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 12px 12px 40px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '15px' };
const cardStyle: React.CSSProperties = { background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' };
const thStyle: React.CSSProperties = { padding: '15px', textAlign: 'left', borderBottom: '1px solid #eee', color: '#666', fontSize: '14px' };
const tdStyle: React.CSSProperties = { padding: '15px', fontSize: '14px' };
const trStyle: React.CSSProperties = { borderBottom: '1px solid #f9f9f9' };
const mobileCard: React.CSSProperties = { background: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', border: '1px solid #eee' };
const btnPrimary = { background: '#007bff', color: 'white', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' as 'bold' };
const btnView = { background: '#eef6ff', color: '#007bff', padding: '8px', borderRadius: '6px', border: '1px solid #d0e3ff', textDecoration: 'none', display: 'flex', alignItems: 'center' };
const btnManage = { background: '#f8f9fa', color: '#333', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', textDecoration: 'none', display: 'flex', alignItems: 'center' };
const btnViewMobile = { ...btnView, fontSize: '12px', padding: '6px 12px' };
const btnManageMobile = { ...btnManage, fontSize: '12px', padding: '6px 12px' };

const getStatusBadge = (status: string): React.CSSProperties => {
  let color = '#666'; let bg = '#f0f0f0';
  if (status === 'Pending') { color = '#856404'; bg = '#fff3cd'; }
  if (status === 'Delivered') { color = '#155724'; bg = '#d4edda'; }
  if (status === 'In-Progress') { color = '#004085'; bg = '#cce5ff'; }
  return { padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', backgroundColor: bg, color: color };
};