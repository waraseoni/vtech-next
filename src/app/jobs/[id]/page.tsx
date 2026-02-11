"use client";
import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Printer, ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';

export default function ManageJob({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedPart, setSelectedPart] = useState({ id: "", qty: 1 });

  const fetchJobDetails = async () => {
    const { data } = await supabase.from('jobs').select('*, clients(*)').eq('id', resolvedParams.id).single();
    setJob(data);
    const { data: inv } = await supabase.from('inventory').select('*');
    setInventory(inv || []);
  };

  useEffect(() => { fetchJobDetails(); }, []);

  const addPart = async () => {
    const part = inventory.find(p => p.id === parseInt(selectedPart.id));
    if (!part || part.stock < selectedPart.qty) return alert("Low Stock!");

    // 1. Bill Update & 2. Stock Update
    await supabase.from('jobs').update({ final_bill: job.final_bill + (part.price * selectedPart.qty) }).eq('id', job.id);
    await supabase.from('inventory').update({ stock: part.stock - selectedPart.qty }).eq('id', part.id);
    
    alert("Part Added!");
    fetchJobDetails();
  };

  if (!job) return <p>Loading...</p>;

  return (
    <div style={{ maxWidth: '900px', margin: '20px auto', padding: '20px' }}>
      <Link href="/jobs" style={{ display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none', color: '#666' }}><ArrowLeft size={16}/> Back to List</Link>
      
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginTop: '20px' }}>
        {/* Left Side: Details */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3>Job #VT-{job.id} - {job.status}</h3>
          <hr />
          <p><b>Client:</b> {job.clients?.name} ({job.clients?.mobile})</p>
          <p><b>Address:</b> {job.clients?.address}</p>
          <p><b>Device:</b> {job.item_name}</p>
          <p><b>Problem:</b> {job.problem}</p>
          <div style={{ background: '#f0f9ff', padding: '15px', borderRadius: '8px', marginTop: '20px' }}>
             <h2 style={{ margin: 0 }}>Total Bill: ₹{job.final_bill}</h2>
          </div>
          <button onClick={() => window.print()} style={{ marginTop: '15px', padding: '10px 20px', cursor: 'pointer' }}><Printer size={16}/> Print Invoice</button>
        </div>

        {/* Right Side: Spare Parts */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h4>Add Spare Parts</h4>
          <select style={inputStyle} onChange={(e) => setSelectedPart({ ...selectedPart, id: e.target.value })}>
            <option value="">Select Part</option>
            {inventory.map(p => <option key={p.id} value={p.id}>{p.partname} (Stock: {p.stock})</option>)}
          </select>
          <input type="number" min="1" style={{ ...inputStyle, marginTop: '10px' }} value={selectedPart.qty} onChange={(e) => setSelectedPart({ ...selectedPart, qty: parseInt(e.target.value) })} />
          <button onClick={addPart} style={{ ...btnPrimary, width: '100%', marginTop: '10px' }}>Add & Update Bill</button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' };
const btnPrimary = { background: '#007bff', color: 'white', padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer' };

const handleStatusChange = async (newStatus: string) => {
  if (!job?.id || !job?.client_id) return;

  setUpdating(true);
  
  // 1. Pehle Job ka status update karein
  const { error: jobError } = await supabase
    .from('jobs')
    .update({ status: newStatus })
    .eq('id', job.id);

  if (jobError) {
    alert("Status update nahi ho paya!");
    setUpdating(false);
    return;
  }

  // 2. Agar status 'Delivered' hai, toh Client ka balance update karein
  if (newStatus === 'Delivered') {
    // Pehle client ka purana balance nikalein
    const { data: clientData } = await supabase
      .from('clients')
      .select('balance')
      .eq('id', job.client_id)
      .single();

    const currentBalance = clientData?.balance || 0;
    const newBalance = currentBalance + (job.final_bill || 0);

    // Client table mein naya balance save karein
    await supabase
      .from('clients')
      .update({ balance: newBalance })
      .eq('id', job.client_id);
      
    alert(`Job Delivered! ₹${job.final_bill} client ke balance mein jud gaye hain.`);
  }

  await fetchJob();
  setUpdating(false);
};