"use client";
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, UserPlus } from 'lucide-react';
import Link from 'next/link';

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", gst: "", address: "" });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.mobile) return alert("Pehle Name aur Mobile bharein!");
    setLoading(true);
    const { error } = await supabase.from('clients').insert([{ ...form, balance: 0 }]);
    if (error) alert(error.message);
    else router.push('/clients');
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '20px auto' }}>
      <Link href="/clients" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#666', textDecoration: 'none', marginBottom: '15px' }}>
        <ArrowLeft size={18} /> Back to List
      </Link>
      <div style={{ background: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
        <h3 style={{ marginTop: 0 }}><UserPlus color="#007bff" /> Register New Customer</h3>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div><label style={labelStyle}>Full Name *</label><input style={inputStyle} value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div><label style={labelStyle}>Mobile Number *</label><input style={inputStyle} value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} /></div>
          <div><label style={labelStyle}>GST Number</label><input style={inputStyle} value={form.gst} onChange={e => setForm({...form, gst: e.target.value})} /></div>
          <div><label style={labelStyle}>Address</label><textarea style={{...inputStyle, height: '80px'}} value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
          <button type="submit" disabled={loading} style={btnSave}>{loading ? "Saving..." : "Save Customer Details"}</button>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: '13px', fontWeight: 'bold', color: '#444' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginTop: '5px' };
const btnSave = { backgroundColor: '#28a745', color: 'white', padding: '15px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' };