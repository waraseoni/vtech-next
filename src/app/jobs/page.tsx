"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Plus, Eye, Settings, Wrench, Search } from 'lucide-react';

export default function JobsList() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchJobs = async () => {
      const { data } = await supabase.from('jobs').select('*, clients(name)').order('created_at', { ascending: false });
      setJobs(data || []);
    };
    fetchJobs();
  }, []);

  const filteredJobs = jobs.filter(j => j.clients?.name.toLowerCase().includes(searchTerm.toLowerCase()) || j.id.toString().includes(searchTerm));

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2><Wrench /> Job Management</h2>
        <Link href="/jobs/new" style={btnPrimary}><Plus size={18} /> New Entry</Link>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <input 
          placeholder="Search by Client or Job ID..." 
          style={inputStyle} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
      </div>

      <div style={cardStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f4f4f4' }}>
            <tr>
              <th style={tdStyle}>ID</th>
              <th style={tdStyle}>Client</th>
              <th style={tdStyle}>Device</th>
              <th style={tdStyle}>Status</th>
              <th style={tdStyle}>Total</th>
              <th style={tdStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.map(job => (
              <tr key={job.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={tdStyle}>#VT-{job.id}</td>
                <td style={tdStyle}>{job.clients?.name}</td>
                <td style={tdStyle}>{job.item_name}</td>
                <td style={tdStyle}>{job.status}</td>
                <td style={tdStyle}>₹{job.final_bill}</td>
                <td style={{ ...tdStyle, display: 'flex', gap: '8px' }}>
  {/* View Button - Naya Link */}
  <Link 
    href={`/jobs/${job.id}/view`} 
    style={btnView} 
    title="View Details"
  >
    <Eye size={16} /> View
  </Link>

  {/* Manage Button */}
  <Link 
    href={`/jobs/${job.id}`} 
    style={btnManage} 
    title="Manage & Edit"
  >
    <Settings size={16} /> Manage
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

const btnView = { 
  background: '#e3f2fd', 
  color: '#1976d2', 
  padding: '6px 12px', 
  borderRadius: '4px', 
  textDecoration: 'none', 
  fontSize: '13px', 
  display: 'flex', 
  alignItems: 'center', 
  gap: '5px',
  border: '1px solid #bbdefb',
  fontWeight: 'bold'
};

const btnManage = { 
  background: '#f5f5f5', 
  color: '#333', 
  padding: '6px 12px', 
  borderRadius: '4px', 
  textDecoration: 'none', 
  fontSize: '13px', 
  display: 'flex', 
  alignItems: 'center', 
  gap: '5px',
  border: '1px solid #ddd'
};
const cardStyle = { background: 'white', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' };
const tdStyle = { padding: '12px' };
const btnPrimary = { background: '#007bff', color: 'white', padding: '10px 20px', borderRadius: '6px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' };
const btnAction = { background: '#f8f9fa', padding: '5px 10px', borderRadius: '4px', border: '1px solid #ddd', textDecoration: 'none', color: '#333', display: 'flex', alignItems: 'center', gap: '5px' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' };