"use client";
import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Edit3, Smartphone, History, Wallet, Phone, MapPin, Loader2, IndianRupee } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ViewClientProfile({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: c, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', resolvedParams.id)
        .single();
      
      if (c) {
        setClient(c);
        const { data: j } = await supabase
          .from('jobs')
          .select('*')
          .eq('client_id', resolvedParams.id)
          .order('created_at', { ascending: false });
        setJobs(j || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [resolvedParams.id]);

  // Delivered jobs ka total calculation
  const totalDeliveredAmount = jobs
    .filter(j => j.status === 'Delivered')
    .reduce((sum, j) => sum + (j.final_bill || 0), 0);

  if (loading) return (
    <div style={loaderContainer}>
      <Loader2 className="animate-spin" size={32} />
      <p>Loading Profile...</p>
    </div>
  );

  if (!client) return <div style={{ padding: '50px', textAlign: 'center' }}>Customer nahi mila.</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <Link href="/clients" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#666', textDecoration: 'none' }}>
          <ArrowLeft size={18}/> Back to List
        </Link>
        <Link href={`/clients/${client.id}/edit`} style={btnEdit}>
          <Edit3 size={16}/> Edit Profile
        </Link>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '25px' }}>
        {/* --- Left Column: Profile Card --- */}
        <div style={profileCard}>
          <div style={avatarStyle}>{client.name ? client.name[0].toUpperCase() : 'C'}</div>
          <h2 style={{ margin: '0 0 5px 0' }}>{client.name}</h2>
          <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>ID: #C-{client.id}</p>
          
          <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '20px 0' }} />
          
          <div style={infoBox}><Phone size={16} color="#007bff"/> {client.mobile}</div>
          <div style={infoBox}><MapPin size={16} color="#dc3545"/> {client.address || 'No Address'}</div>
          
          {/* Business Summary Card */}
          <div style={{ ...infoBox, background: '#f0f7ff', padding: '15px', borderRadius: '10px', marginTop: '20px' }}>
            <IndianRupee size={18} color="#007bff"/> 
            <div>
              <small style={{ color: '#666', display: 'block' }}>Total Paid Business</small>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#007bff' }}>
                ₹{totalDeliveredAmount}
              </div>
            </div>
          </div>
        </div>

        {/* --- Right Column: Repair History --- */}
        <div style={historyCard}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0 }}>
            <History size={20} color="#666"/> Repair History
          </h3>
          
          {jobs.length === 0 ? (
            <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>Is customer ka koi purana record nahi hai.</p>
          ) : (
            jobs.map(job => (
              <div key={job.id} style={jobRow}>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={jobIconBox}><Smartphone size={20} color="#007bff"/></div>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{job.item_name}</div>
                    <small style={{ color: '#888' }}>{new Date(job.created_at).toLocaleDateString()} | Job #VT-{job.id}</small>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                   <div style={{ 
                    fontWeight: 'bold', 
                    fontSize: '16px', 
                    color: job.status === 'Delivered' ? '#28a745' : '#333' 
                  }}>
                    ₹{job.final_bill || 0}
                  </div>
                  <small style={{
                    fontWeight: 'bold',
                    fontSize: '12px',
                    color: job.status === 'Delivered' ? '#28a745' : 
                           job.status === 'Pending' ? '#ffc107' : '#007bff'
                  }}>
                    {job.status}
                  </small>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// --- Styles ---
const profileCard = { background: 'white', padding: '25px', borderRadius: '15px', height: 'fit-content', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' };
const historyCard = { background: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' };
const avatarStyle = { width: '60px', height: '60px', background: '#eef6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', color: '#007bff', marginBottom: '15px' };
const infoBox = { display: 'flex', alignItems: 'center', gap: '10px', margin: '12px 0', color: '#555', fontSize: '15px' };
const btnEdit = { backgroundColor: '#f8f9fa', color: '#333', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' as 'bold', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #ddd', fontSize: '14px' };
const jobRow = { display: 'flex', justifyContent: 'space-between', padding: '15px', borderBottom: '1px solid #f8f9fa' };
const jobIconBox = { background: '#f8f9fa', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center' };
const loaderContainer: any = { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '300px', gap: '10px', color: '#666' };