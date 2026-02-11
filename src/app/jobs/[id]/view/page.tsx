"use client";
import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Edit3, Printer, Smartphone, User, 
  CheckCircle2, Clock, MapPin, Phone, IndianRupee, 
  Loader2 
} from 'lucide-react';

export default function ViewJobPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchJob = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, clients(*)')
        .eq('id', resolvedParams.id)
        .single();
      
      if (error) throw error;
      setJob(data);
    } catch (err) {
      console.error("Error fetching job:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [resolvedParams.id]);

  const handleStatusChange = async (newStatus: string) => {
    // Safety check: agar job null hai toh aage na badhein
    if (!job?.id) return;

    setUpdating(true);
    const { error } = await supabase
      .from('jobs')
      .update({ status: newStatus })
      .eq('id', job.id);

    if (error) {
      alert("Status update nahi ho paya!");
    } else {
      await fetchJob();
    }
    setUpdating(false);
  };

  // 1. Loading State Check
  if (loading) return (
    <div style={centerText}>
      <Loader2 className="animate-spin" size={32} />
      <p>Fetching Job Details...</p>
    </div>
  );

  // 2. Job Null Check (Safety)
  if (!job) return (
    <div style={centerText}>
      <h2>Job Not Found!</h2>
      <Link href="/jobs" style={{ color: '#007bff' }}>Back to List</Link>
    </div>
  );

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <Link href="/jobs" style={backLink}><ArrowLeft size={18} /> Back to List</Link>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => window.print()} style={btnSecondary}><Printer size={18} /> Print</button>
          <Link href={`/jobs/${job.id}/edit`} style={btnEdit}><Edit3 size={18} /> Edit Job</Link>
        </div>
      </div>

      <div style={mainGrid}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Status Card */}
          <div style={{ ...cardStyle, borderTop: `6px solid ${getStatusColor(job.status)}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <p style={labelStyle}>Update Status</p>
              {updating ? <Loader2 className="animate-spin" size={18} /> : (job.status === 'Repaired' ? <CheckCircle2 color="#28a745" /> : <Clock color="#ffc107" />)}
            </div>
            
            <select 
              value={job.status} 
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={updating}
              style={{ 
                ...statusDropdown, 
                borderColor: getStatusColor(job.status)
              }}
            >
              <option value="Pending">🟡 Pending</option>
              <option value="In-Progress">🔵 In-Progress</option>
              <option value="Repaired">🟢 Repaired</option>
              <option value="Delivered">⚪ Delivered</option>
              <option value="Cancelled">🔴 Cancelled</option>
            </select>
          </div>

          <div style={cardStyle}>
            <h3 style={sectionTitle}><Smartphone size={18} /> Device Information</h3>
            <div style={infoRow}><span>Item:</span> <b>{job.item_name}</b></div>
            <div style={infoRow}><span>Serial:</span> <b>{job.serial_no || 'N/A'}</b></div>
            <hr style={divider} />
            <p style={labelStyle}>Problem:</p>
            <p style={problemText}>{job.problem || 'No description.'}</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={cardStyle}>
            <h3 style={sectionTitle}><User size={18} /> Client Details</h3>
            <div style={clientInfoBox}>
              <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 10px 0' }}>{job.clients?.name}</p>
              <p style={infoRow}><Phone size={14} /> {job.clients?.mobile}</p>
              <p style={infoRow}><MapPin size={14} /> {job.clients?.address}</p>
            </div>
          </div>

          <div style={billingCard}>
            <p style={{ margin: 0, opacity: 0.9 }}>Total Amount</p>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '32px', fontWeight: 'bold' }}>
              <IndianRupee size={28} /> {job.final_bill}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Styles ---
const statusDropdown = {
  width: '100%',
  padding: '12px',
  borderRadius: '8px',
  border: '2px solid',
  fontSize: '16px',
  fontWeight: 'bold',
  outline: 'none',
  cursor: 'pointer'
};

const containerStyle = { padding: '30px', maxWidth: '1100px', margin: '0 auto', backgroundColor: '#f4f7f6', minHeight: '100vh' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const backLink = { textDecoration: 'none', color: '#555', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' };
const mainGrid = { display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '25px' };
const cardStyle = { backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' };
const billingCard = { backgroundColor: '#007bff', color: 'white', padding: '25px', borderRadius: '12px' };
const sectionTitle = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', margin: '0 0 20px 0', borderBottom: '1px solid #eee', paddingBottom: '10px' };
const infoRow = { display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '15px' };
const labelStyle = { fontSize: '12px', color: '#888', textTransform: 'uppercase' as 'uppercase', fontWeight: 'bold' };
const problemText = { backgroundColor: '#fff9e6', padding: '15px', borderRadius: '8px', color: '#856404', marginTop: '10px', fontSize: '14px' };
const clientInfoBox = { display: 'flex', flexDirection: 'column' as 'column', gap: '8px' };
const divider = { border: 'none', borderTop: '1px solid #eee', margin: '15px 0' };
const centerText: any = { textAlign: 'center', padding: '100px', fontSize: '18px', color: '#666', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' };
const btnEdit = { backgroundColor: '#28a745', color: 'white', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' };
const btnSecondary = { backgroundColor: 'white', border: '1px solid #ddd', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' };

const getStatusColor = (s: string) => {
  switch (s) {
    case 'Pending': return '#ffc107';
    case 'In-Progress': return '#17a2b8';
    case 'Repaired': return '#28a745';
    case 'Delivered': return '#6c757d';
    case 'Cancelled': return '#dc3545';
    default: return '#007bff';
  }
};