"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewJob() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [formData, setFormData] = useState({ client_id: "", item_name: "", serial_no: "", problem: "", labour_charges: "0" });

  useEffect(() => {
    supabase.from('clients').select('*').then(({ data }) => setClients(data || []));
  }, []);

  const handleSave = async () => {
    const { error } = await supabase.from('jobs').insert([{
      ...formData,
      client_id: parseInt(formData.client_id),
      final_bill: parseInt(formData.labour_charges)
    }]);
    if (!error) router.push('/jobs');
    else alert(error.message);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
      <Link href="/jobs" style={{ display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none', color: '#666', marginBottom: '20px' }}><ArrowLeft size={16}/> Back</Link>
      <h3>Create New Job Card</h3>
      <div style={{ display: 'grid', gap: '15px', marginTop: '20px' }}>
        <label>Select Customer</label>
        <select style={inputStyle} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}>
          <option value="">-- Choose --</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input placeholder="Item Name (e.g. Vivo Y20)" style={inputStyle} onChange={(e) => setFormData({ ...formData, item_name: e.target.value })} />
        <input placeholder="Serial/IMEI No" style={inputStyle} onChange={(e) => setFormData({ ...formData, serial_no: e.target.value })} />
        <textarea placeholder="Problem Reported" style={{ ...inputStyle, height: '100px' }} onChange={(e) => setFormData({ ...formData, problem: e.target.value })} />
        <input type="number" placeholder="Initial Labour Charges" style={inputStyle} onChange={(e) => setFormData({ ...formData, labour_charges: e.target.value })} />
        <button onClick={handleSave} style={btnSuccess}><Save size={18} /> Save Job Card</button>
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ddd' };
const btnSuccess = { background: '#28a745', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', fontSize: '16px' };