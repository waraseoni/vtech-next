"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
  Wrench, 
  Clock, 
  CheckCircle, 
  IndianRupee, 
  TrendingUp, 
  Users, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalJobs: 0,
    pendingJobs: 0,
    completedJobs: 0,
    todayEarnings: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      // Aaj ki date filter ke liye
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: allJobs } = await supabase.from('jobs').select('*');
      
      if (allJobs) {
        const pending = allJobs.filter(j => j.status === 'Pending' || j.status === 'In-Progress').length;
        const completed = allJobs.filter(j => j.status === 'Repaired' || j.status === 'Delivered').length;
        
        // Aaj ki kamai (Sirf wahi jobs jo aaj create hui ya update hui)
        const earnings = allJobs
          .filter(j => new Date(j.created_at) >= today)
          .reduce((sum, j) => sum + (j.final_bill || 0), 0);

        setStats({
          totalJobs: allJobs.length,
          pendingJobs: pending,
          completedJobs: completed,
          todayEarnings: earnings
        });
      }
      setLoading(false);
    };

    fetchStats();
  }, []);

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>V-Tech Dashboard</h1>
          <p style={{ color: '#666', marginTop: '5px' }}>Welcome back, Vikram ji!</p>
        </div>
        <Link href="/jobs/new" style={btnQuickAction}>+ Quick Job Entry</Link>
      </header>

      {/* Stats Cards */}
      <div style={statsGrid}>
        <div style={{ ...statCard, borderLeft: '5px solid #007bff' }}>
          <div style={iconBox}><Wrench color="#007bff" /></div>
          <div>
            <p style={statLabel}>Total Jobs</p>
            <h2 style={statValue}>{stats.totalJobs}</h2>
          </div>
        </div>

        <div style={{ ...statCard, borderLeft: '5px solid #ffc107' }}>
          <div style={{ ...iconBox, background: '#fff9e6' }}><Clock color="#ffc107" /></div>
          <div>
            <p style={statLabel}>Pending Repairs</p>
            <h2 style={statValue}>{stats.pendingJobs}</h2>
          </div>
        </div>

        <div style={{ ...statCard, borderLeft: '5px solid #28a745' }}>
          <div style={{ ...iconBox, background: '#eafaf1' }}><CheckCircle color="#28a745" /></div>
          <div>
            <p style={statLabel}>Completed</p>
            <h2 style={statValue}>{stats.completedJobs}</h2>
          </div>
        </div>

        <div style={{ ...statCard, borderLeft: '5px solid #6f42c1' }}>
          <div style={{ ...iconBox, background: '#f3e8ff' }}><IndianRupee color="#6f42c1" /></div>
          <div>
            <p style={statLabel}>Today's Billing</p>
            <h2 style={statValue}>₹{stats.todayEarnings}</h2>
          </div>
        </div>
      </div>

      {/* Quick Links & Info */}
      <div style={infoGrid}>
        <div style={mainActionCard}>
          <h3>Quick Actions</h3>
          <div style={btnGrid}>
            <Link href="/jobs" style={actionLink}><TrendingUp size={20}/> View All Jobs <ArrowRight size={16}/></Link>
            <Link href="/clients" style={actionLink}><Users size={20}/> Manage Customers <ArrowRight size={16}/></Link>
            <Link href="/inventory" style={actionLink}><AlertCircle size={20}/> Check Stock <ArrowRight size={16}/></Link>
          </div>
        </div>

        <div style={statusUpdateCard}>
          <h4>Shop Tip</h4>
          <p style={{fontSize: '14px', color: '#555'}}>
            "Repaired" status set karne se pehle ensure karein ki saare parts list mein add ho gaye hain taaki bill sahi bane.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Styles ---
const containerStyle = { padding: '30px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f8f9fa', minHeight: '100vh' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' };
const statCard = { background: 'white', padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' };
const iconBox = { padding: '12px', background: '#eef6ff', borderRadius: '10px' };
const statLabel = { margin: 0, fontSize: '14px', color: '#888', fontWeight: 'bold' };
const statValue = { margin: '5px 0 0 0', fontSize: '24px', fontWeight: 'bold' };
const btnQuickAction = { background: '#007bff', color: 'white', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' };
const infoGrid = { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' };
const mainActionCard = { background: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' };
const btnGrid = { display: 'flex', flexDirection: 'column' as 'column', gap: '10px', marginTop: '15px' };
const actionLink = { display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: '#f8f9fa', borderRadius: '10px', textDecoration: 'none', color: '#333', fontWeight: 'bold', border: '1px solid #eee' };
const statusUpdateCard = { background: '#fff3cd', padding: '20px', borderRadius: '15px', border: '1px solid #ffeeba' };