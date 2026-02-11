"use client";
import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, UserCheck, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "", gst: "", address: "" });

  // --- 1. Purana Data Load Karna ---
  useEffect(() => {
    const fetchClient = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', resolvedParams.id)
        .single();

      if (error) {
        alert("Client details nahi mil payi!");
        router.push('/clients');
      } else {
        setForm({
          name: data.name,
          mobile: data.mobile,
          gst: data.gst || "",
          address: data.address || ""
        });
      }
      setLoading(false);
    };
    fetchClient();
  }, [resolvedParams.id, router]);

  // --- 2. Data Update Karna ---
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.mobile) return alert("Name aur Mobile zaroori hai!");
    
    setSaving(true);
    const { error } = await supabase
      .from('clients')
      .update({
        name: form.name,
        mobile: form.mobile,
        gst: form.gst,
        address: form.address
      })
      .eq('id', resolvedParams.id);

    if (error) {
      alert("Update karne mein galti hui: " + error.message);
    } else {
      alert("Client Details Update ho gayi!");
      router.push(`/clients/${resolvedParams.id}/view`); // Wapas view page par bhej dega
    }
    setSaving(false);
  };

  if (loading) return <div style={loaderContainer}><Loader2 className="animate-spin" /> Loading Client Details...</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '20px auto', padding: '10px' }}>
      <Link href={`/clients/${resolvedParams.id}/view`} style={backLink}>
        <ArrowLeft size={18} /> Profile par wapas jayein
      </Link>

      <div style={cardStyle}>
        <div style={headerStyle}>
          <UserCheck color="#007bff" size={24} />
          <h3 style={{ margin: 0 }}>Update Customer Profile</h3>
        </div>
        
        <form onSubmit={handleUpdate} style={formStyle}>
          <div style={inputGroup}>
            <label style={labelStyle}>Full Name *</label>
            <input 
              style={inputStyle} 
              value={form.name} 
              onChange={e => setForm({...form, name: e.target.value})} 
              placeholder="Ex: Vikram Singh"
            />
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}>Mobile Number *</label>
            <input 
              style={inputStyle} 
              value={form.mobile} 
              onChange={e => setForm({...form, mobile: e.target.value})} 
              placeholder="Ex: 9876543210"
            />
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}>GST Number (Optional)</label>
            <input 
              style={inputStyle} 
              value={form.gst} 
              onChange={e => setForm({...form, gst: e.target.value})} 
              placeholder="Ex: 22AAAAA0000A1Z5"
            />
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}>Full Address</label>
            <textarea 
              style={{...inputStyle, height: '100px', resize: 'none'}} 
              value={form.address} 
              onChange={e => setForm({...form, address: e.target.value})} 
              placeholder="Dukan ya Ghar ka pata..."
            />
          </div>

          <button type="submit" disabled={saving} style={btnUpdate}>
            {saving ? "Updating..." : <><Save size={18} /> Update Changes</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- Styles ---
const backLink = { display: 'flex', alignItems: 'center', gap: '5px', color: '#666', textDecoration: 'none', marginBottom: '15px', fontSize: '14px', fontWeight: 'bold' };
const cardStyle = { background: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' };
const headerStyle = { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px', borderBottom: '1px solid #eee', paddingBottom: '15px' };
const formStyle = { display: 'flex', flexDirection: 'column' as 'column', gap: '20px' };
const inputGroup = { display: 'flex', flexDirection: 'column' as 'column', gap: '8px' };
const labelStyle = { fontSize: '13px', fontWeight: 'bold', color: '#444', textTransform: 'uppercase' as 'uppercase' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px', outline: 'none', transition: '0.2s' };
const btnUpdate = { backgroundColor: '#007bff', color: 'white', padding: '15px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', fontSize: '16px' };
const loaderContainer: any = { padding: '100px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#666' };