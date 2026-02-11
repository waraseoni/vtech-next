"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Plus, Eye, Settings, Wrench, Search, Loader2, Trash2 } from 'lucide-react';

export default function JobsList() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    // Yahan 'client_id' ko query mein add kiya gaya hai taaki Link kaam kare
    const { data } = await supabase
      .from('jobs')
      .select('id, client_id, item_name, problem, status, final_bill, clients(name, mobile)') 
      .order('created_at', { ascending: false });
    setJobs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 991);
    checkSize();
    setMounted(true);
    fetchJobs();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm("Kya aap pakka delete karna chahte hain?")) {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (!error) setJobs(jobs.filter(job => job.id !== id));
    }
  };

  const filteredJobs = jobs.filter(j => 
    j.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    j.clients?.mobile?.includes(searchTerm) ||
    j.id.toString().includes(searchTerm)
  );

  if (!mounted) return null;
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '50px', gap: '10px' }}>
      <Loader2 className="animate-spin" /> Data Load ho raha hai...
    </div>
  );

  return (
    <div style={containerStyle}>
      {/* Header Section */}
      <div style={headerSection}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: isMobile ? '20px' : '24px' }}>
          <Wrench color="#007bff" /> Job List
        </h2>
        <Link href="/jobs/new" style={btnPrimary}><Plus size={18} /> New Entry</Link>
      </div>

      {/* Search Box Wrapper - Fixed for responsiveness */}
      <div style={searchWrapper}>
        <Search size={18} style={searchIcon} />
        <input 
          placeholder="Search Name, Mobile or ID..." 
          style={inputStyle} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
      </div>

      {isMobile ? (
        /* --- MOBILE VIEW --- */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {filteredJobs.map(job => (
            <div key={job.id} style={mobileCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>#VT-{job.id}</span>
                <span style={getStatusBadge(job.status)}>{job.status}</span>
              </div>
              
              {/* Clickable Client Name (Mobile) */}
              <div style={{ fontWeight: 'bold', fontSize: '16px', marginTop: '5px' }}>
                <Link href={`/clients/${job.client_id}`} style={{ textDecoration: 'none', color: '#007bff' }}>
                  {job.clients?.name}
                </Link>
              </div>
              
              <div style={{ fontSize: '13px', color: '#666' }}>{job.clients?.mobile}</div>
              <div style={{ fontSize: '14px', marginTop: '5px' }}><b>Device:</b> {job.item_name}</div>
              
              <div style={{ fontSize: '13px', color: '#d9534f', background: '#fff5f5', padding: '8px', borderRadius: '6px', marginTop: '8px' }}>
                <b>Fault:</b> {job.problem || 'No description'}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                <div style={{ fontWeight: 'bold', color: '#28a745', fontSize: '16px' }}>₹{job.final_bill || 0}</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleDelete(job.id)} style={btnDeleteMobile}><Trash2 size={16}/></button>
                  <Link href={`/jobs/${job.id}/view`} style={btnViewMobile}>View</Link>
                  <Link href={`/jobs/${job.id}`} style={btnManageMobile}>Manage</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* --- PC VIEW (Table) --- */
        <div style={cardStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8f9fa' }}>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Client & Mobile</th>
                <th style={thStyle}>Device & Fault</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map(job => (
                <tr key={job.id} style={trStyle}>
                  <td style={tdStyle}>#VT-{job.id}</td>
                  <td style={tdStyle}>
                    {/* Clickable Client Name (PC) */}
                    <Link href={`/clients/${job.client_id}`} style={{ textDecoration: 'none' }}>
                      <b style={{ color: '#007bff', cursor: 'pointer' }}>{job.clients?.name}</b>
                    </Link>
                    <div style={{ fontSize: '12px', color: '#666' }}>{job.clients?.mobile}</div>
                  </td>
                  <td style={tdStyle}>
                    <div>{job.item_name}</div>
                    <div style={{ fontSize: '12px', color: '#d9534f' }}>{job.problem}</div>
                  </td>
                  <td style={tdStyle}><span style={getStatusBadge(job.status)}>{job.status}</span></td>
                  <td style={tdStyle}><b style={{color: '#28a745'}}>₹{job.final_bill || 0}</b></td>
                  <td style={{ ...tdStyle, display: 'flex', gap: '8px' }}>
                    <Link href={`/jobs/${job.id}/view`} style={btnView}><Eye size={14} /></Link>
                    <Link href={`/jobs/${job.id}`} style={btnManage}><Settings size={14} /></Link>
                    <button onClick={() => handleDelete(job.id)} style={btnDelete}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Responsive Styles ---
const containerStyle: React.CSSProperties = { padding: '15px', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' };
const headerSection: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '10px' };
const searchWrapper: React.CSSProperties = { position: 'relative', marginBottom: '20px', width: '100%', boxSizing: 'border-box' };
const searchIcon: React.CSSProperties = { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888', zIndex: 1 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 12px 12px 40px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '15px', boxSizing: 'border-box', display: 'block' };
const cardStyle: React.CSSProperties = { background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto' };
const thStyle: React.CSSProperties = { padding: '15px', textAlign: 'left', borderBottom: '1px solid #eee', color: '#666', fontSize: '14px', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '15px', fontSize: '14px', whiteSpace: 'nowrap' };
const trStyle: React.CSSProperties = { borderBottom: '1px solid #f9f9f9' };
const mobileCard: React.CSSProperties = { background: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', border: '1px solid #eee' };

const btnPrimary: React.CSSProperties = { background: '#007bff', color: 'white', padding: '10px 15px', borderRadius: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '14px' };
const btnView: React.CSSProperties = { background: '#eef6ff', color: '#007bff', padding: '8px', borderRadius: '6px', border: '1px solid #d0e3ff', cursor: 'pointer', display: 'flex', alignItems: 'center' };
const btnManage: React.CSSProperties = { background: '#f8f9fa', color: '#333', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', cursor: 'pointer', display: 'flex', alignItems: 'center' };
const btnDelete: React.CSSProperties = { background: '#fff5f5', color: '#dc3545', padding: '8px', borderRadius: '6px', border: '1px solid #feb2b2', cursor: 'pointer', display: 'flex', alignItems: 'center' };

const btnViewMobile: React.CSSProperties = { ...btnView, fontSize: '12px', padding: '6px 12px', textDecoration: 'none' };
const btnManageMobile: React.CSSProperties = { ...btnManage, fontSize: '12px', padding: '6px 12px', textDecoration: 'none' };
const btnDeleteMobile: React.CSSProperties = { ...btnDelete, padding: '6px 10px' };

const getStatusBadge = (status: string): React.CSSProperties => {
  let color = '#666'; let bg = '#f0f0f0';
  if (status === 'Pending') { color = '#856404'; bg = '#fff3cd'; }
  if (status === 'Delivered') { color = '#155724'; bg = '#d4edda'; }
  if (status === 'In-Progress') { color = '#004085'; bg = '#cce5ff'; }
  return { padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', backgroundColor: bg, color: color, whiteSpace: 'nowrap' };
};