"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, X, Save, Loader2, Settings, Wrench, Trash2, Eye, User, Calendar, Smartphone, FileText, Printer, MapPin, Phone } from 'lucide-react';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // States for Manage/View
  const [editingJob, setEditingJob] = useState<any>(null);
  const [viewingJob, setViewingJob] = useState<any>(null); 
  const [selectedPart, setSelectedPart] = useState({ id: "", qty: 1 });

  const [newJob, setNewJob] = useState({
    client_id: "", item_name: "", serial_no: "", problem: "",
    status: "Pending", estimated_cost: "0", labour_charges: "0"
  });

  // --- DATA FETCH (Fixed to get all Client info) ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // Yahan clients(*) kiya hai taki phone aur city dono mil jayein
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('*, clients(*)') 
        .order('created_at', { ascending: false });
      
      const { data: clientsData } = await supabase.from('clients').select('*');
      const { data: invData } = await supabase.from('inventory').select('*');
      
      setJobs(jobsData || []);
      setClients(clientsData || []);
      setInventory(invData || []);
    } catch (err) {
      console.error("Fetch Error:", err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // --- NEW JOB SAVE ---
  const handleSave = async () => {
    if (!newJob.client_id || !newJob.item_name) {
      alert("Please select client and item name!");
      return;
    }
    const { error } = await supabase.from('jobs').insert([{
      client_id: parseInt(newJob.client_id),
      item_name: newJob.item_name,
      serial_no: newJob.serial_no,
      problem: newJob.problem,
      status: newJob.status,
      estimated_cost: parseInt(newJob.estimated_cost),
      labour_charges: parseInt(newJob.labour_charges),
      final_bill: parseInt(newJob.labour_charges)
    }]);
    if (error) alert(error.message);
    else {
      setShowForm(false);
      setNewJob({ client_id: "", item_name: "", serial_no: "", problem: "", status: "Pending", estimated_cost: "0", labour_charges: "0" });
      fetchData();
    }
  };

  // --- DELETE ---
  const handleDelete = async (id: number) => {
    if (confirm("Kya aap is Job Card ko delete karna chahte hain?")) {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) alert(error.message);
      else fetchData();
    }
  };

  // --- UPDATE STATUS ---
  const handleUpdateStatusAndLabour = async () => {
    if (!editingJob?.id) return;
    const { error } = await supabase.from('jobs')
      .update({ 
        status: editingJob.status,
        labour_charges: parseInt(editingJob.labour_charges || "0")
      })
      .eq('id', editingJob.id);
    if (error) alert("Update failed");
    else {
      alert("Updated!");
      setEditingJob(null);
      fetchData();
    }
  };

  // --- ADD PARTS ---
  const addPartToJob = async () => {
    if (!selectedPart.id || !editingJob?.id) return;
    const part = inventory.find(p => p.id === parseInt(selectedPart.id));
    if (!part || part.stock < selectedPart.qty) {
      alert("Stock kam hai!");
      return;
    }
    const { error: partErr } = await supabase.from('job_parts').insert([{
      job_id: editingJob.id,
      part_id: part.id,
      quantity: selectedPart.qty,
      unit_price: part.price
    }]);
    if (!partErr) {
      const additionalCost = part.price * selectedPart.qty;
      await supabase.from('jobs').update({ final_bill: (editingJob.final_bill || 0) + additionalCost }).eq('id', editingJob.id);
      setEditingJob(null);
      fetchData();
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
        <h2><Wrench size={24} style={{ marginRight: '10px', color: '#007bff' }} /> V-Tech Repairing</h2>
        <button onClick={() => setShowForm(true)} style={btnPrimary}><Plus size={18} /> New Job Entry</button>
      </div>

      <div style={cardStyle}>
        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center' }}><Loader2 className="animate-spin" /> Loading Jobs...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={thStyle}>
                <th style={tdStyle}>Job ID</th>
                <th style={tdStyle}>Client</th>
                <th style={tdStyle}>Device</th>
                <th style={tdStyle}>Status</th>
                <th style={tdStyle}>Bill</th>
                <th style={tdStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={tdStyle}><b>#VT-{job.id}</b></td>
                  <td style={tdStyle}>{job.clients?.name}</td>
                  <td style={tdStyle}>{job.item_name}</td>
                  <td style={tdStyle}>
                    <span style={{ ...statusBadge, backgroundColor: getStatusColor(job.status) }}>{job.status}</span>
                  </td>
                  <td style={tdStyle}>₹{job.final_bill}</td>
                  <td style={{...tdStyle, display: 'flex', gap: '8px'}}>
                    <button onClick={() => setViewingJob(job)} style={btnAction} title="View Detail"><Eye size={16} color="#007bff" /></button>
                    <button onClick={() => setEditingJob(job)} style={btnAction} title="Edit"><Settings size={16} /></button>
                    <button onClick={() => handleDelete(job.id)} style={{...btnAction, color: 'red'}} title="Delete"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- POPUP: DETAILED VIEW MODAL --- */}
      {viewingJob && (
        <div style={overlayStyle}>
          <div style={{...modalStyle, width: '550px', borderTop: '6px solid #007bff'}}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{margin:0, display:'flex', alignItems:'center', gap:'10px'}}><FileText color="#007bff" /> Job Details #VT-{viewingJob.id}</h3>
              <X onClick={() => setViewingJob(null)} style={{ cursor: 'pointer' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {/* Client Info Section */}
              <div style={infoCard}>
                <p style={infoLabel}><User size={14} /> Client Details</p>
                <p style={{marginBottom: '5px'}}><b>Name:</b> {viewingJob.clients?.name}</p>
                <p style={{marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px'}}>
                   <Phone size={14} color="#666" /> {viewingJob.clients?.mobile || 'Not Available'}
                </p>
                <p style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                   <MapPin size={14} color="#666" /> {viewingJob.clients?.address || 'Address Not Saved'}
                </p>
              </div>

              {/* Job Info Section */}
              <div style={infoCard}>
                <p style={infoLabel}><Calendar size={14} /> Job Status</p>
                <p><b>Received:</b> {new Date(viewingJob.created_at).toLocaleDateString()}</p>
                <p style={{marginTop:'5px'}}><b>Status:</b> <span style={{color: getStatusColor(viewingJob.status), fontWeight:'bold'}}>{viewingJob.status}</span></p>
              </div>

              {/* Item Info Section */}
              <div style={{...infoCard, gridColumn: 'span 2'}}>
                <p style={infoLabel}><Smartphone size={14} /> Device & Problem</p>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span><b>Item:</b> {viewingJob.item_name}</span>
                  <span><b>S/N:</b> {viewingJob.serial_no}</span>
                </div>
                <p style={{marginTop:'8px', color: '#555', borderTop: '1px solid #eee', paddingTop: '8px'}}>
                  <b>Problem Reported:</b><br/> {viewingJob.problem || 'No description provided'}
                </p>
              </div>

              {/* Billing Section */}
              <div style={{...infoCard, gridColumn: 'span 2', backgroundColor:'#f0f9ff', borderColor:'#b3d7ff'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <span style={{fontSize:'16px', fontWeight:'bold'}}>Final Amount:</span>
                  <span style={{fontSize:'22px', fontWeight:'bold', color:'#007bff'}}>₹{viewingJob.final_bill}</span>
                </div>
                <p style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>
                  Labour Charges: ₹{viewingJob.labour_charges} + Spare Parts
                </p>
              </div>
            </div>

            <button onClick={() => window.print()} style={{...btnPrimary, width:'100%', marginTop:'20px', justifyContent:'center'}}>
              <Printer size={18} /> Print Job Receipt
            </button>
          </div>
        </div>
      )}

      {/* --- POPUP: MANAGE JOB --- */}
      {editingJob && (
        <div style={overlayStyle}>
          <div style={{...modalStyle, width: '600px'}}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0 }}>Manage Job: #VT-{editingJob?.id}</h3>
              <X onClick={() => setEditingJob(null)} style={{ cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Update Status</label>
                <select style={inputStyle} value={editingJob?.status} onChange={(e) => setEditingJob({...editingJob, status: e.target.value})}>
                  <option>Pending</option><option>In-Progress</option><option>Repaired</option><option>Delivered</option>
                </select>
                <label style={{...labelStyle, marginTop: '15px'}}>Service Charge (₹)</label>
                <input type="number" style={inputStyle} value={editingJob?.labour_charges} onChange={(e) => setEditingJob({...editingJob, labour_charges: e.target.value})} />
                <button onClick={handleUpdateStatusAndLabour} style={{ ...btnSuccess, width: '100%', marginTop: '20px' }}>Save Changes</button>
              </div>
              <div>
                <label style={labelStyle}>Add Spare Part</label>
                <select style={inputStyle} onChange={(e) => setSelectedPart({...selectedPart, id: e.target.value})}>
                  <option value="">-- Choose Part --</option>
                  {inventory.map(p => <option key={p.id} value={p.id}>{p.partname} (₹{p.price})</option>)}
                </select>
                <input type="number" min="1" style={{...inputStyle, marginTop:'10px'}} value={selectedPart.qty} onChange={(e) => setSelectedPart({...selectedPart, qty: parseInt(e.target.value)})} />
                <button onClick={addPartToJob} style={{ ...btnPrimary, width: '100%', marginTop: '20px', backgroundColor: '#17a2b8' }}>Add & Update Bill</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- POPUP: NEW JOB FORM --- */}
      {showForm && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0 }}>Create Job Card</h3>
              <X onClick={() => setShowForm(false)} style={{ cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'grid', gap: '15px', marginTop: '20px' }}>
              <select style={inputStyle} value={newJob.client_id} onChange={(e) => setNewJob({...newJob, client_id: e.target.value})}>
                <option value="">-- Select Customer --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input placeholder="Item Name" style={inputStyle} value={newJob.item_name} onChange={(e) => setNewJob({...newJob, item_name: e.target.value})} />
                <input placeholder="Serial No" style={inputStyle} value={newJob.serial_no} onChange={(e) => setNewJob({...newJob, serial_no: e.target.value})} />
              </div>
              <textarea placeholder="Problem Reported" style={{...inputStyle, height: '60px'}} value={newJob.problem} onChange={(e) => setNewJob({...newJob, problem: e.target.value})} />
              <button onClick={handleSave} style={btnSuccess}>Create Job Entry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styling & Helpers
const infoCard = { padding: '12px', border: '1px solid #eee', borderRadius: '8px', fontSize: '13px', backgroundColor: 'white' };
const infoLabel = { fontWeight: 'bold', color: '#007bff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', textTransform: 'uppercase' as 'uppercase' };
const getStatusColor = (status: string) => {
  switch(status) {
    case 'Pending': return '#ffc107'; case 'In-Progress': return '#17a2b8'; case 'Repaired': return '#28a745'; default: return '#6c757d';
  }
}
const overlayStyle: any = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalStyle: any = { backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' };
const inputStyle: any = { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', marginTop: '5px', display: 'block' };
const labelStyle: any = { fontWeight: 'bold', fontSize: '13px', color: '#333', display: 'block' };
const btnPrimary: any = { backgroundColor: '#007bff', color: 'white', padding: '10px 20px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' };
const btnAction: any = { padding: '6px', borderRadius: '4px', border: '1px solid #ddd', backgroundColor: 'white', cursor: 'pointer' };
const btnSuccess: any = { backgroundColor: '#28a745', color: 'white', padding: '12px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontWeight: 'bold' };
const cardStyle: any = { backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' };
const thStyle: any = { textAlign: 'left', backgroundColor: '#f4f4f4', borderBottom: '2px solid #ddd' };
const tdStyle: any = { padding: '15px' };
const statusBadge: any = { padding: '4px 10px', borderRadius: '20px', color: 'white', fontSize: '11px', fontWeight: 'bold' };