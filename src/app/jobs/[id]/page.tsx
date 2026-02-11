"use client";
import React, { useState, useEffect, use, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Save, ArrowLeft, Loader2, IndianRupee, 
  Cpu, CheckCircle2, PackagePlus, X, Search, User, Phone, ChevronDown, Check, Smartphone
} from 'lucide-react';
import Link from 'next/link';

export default function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const jobId = resolvedParams.id;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [invSearch, setInvSearch] = useState("");
  
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [jobData, setJobData] = useState<any>(null);

  const [form, setForm] = useState({ 
    item_name: "", 
    problem: "", 
    status: "Pending", 
    final_bill: 0,
    used_parts_list: [] as {name: string, price: number}[]
  });

  useEffect(() => {
    async function getData() {
      if (!jobId) return;
      setLoading(true);
      const [jobRes, invRes, clientRes] = await Promise.all([
        supabase.from('jobs').select('*, clients(*)').eq('id', jobId).single(),
        supabase.from('inventory').select('id, partname, price, stock').order('partname'),
        supabase.from('clients').select('*').order('name')
      ]);

      if (jobRes.data) {
        setJobData(jobRes.data);
        setSelectedClient(jobRes.data.clients);
        const existingParts = jobRes.data.used_parts 
          ? jobRes.data.used_parts.split(', ').map((p: string) => ({ name: p, price: 0 })) 
          : [];
        setForm({
          item_name: jobRes.data.item_name || "",
          problem: jobRes.data.problem || "",
          status: jobRes.data.status || "Pending",
          final_bill: jobRes.data.final_bill || 0,
          used_parts_list: existingParts
        });
      }
      if (invRes.data) setInventory(invRes.data);
      if (clientRes.data) setAllClients(clientRes.data);
      setLoading(false);
    }
    getData();
  }, [jobId]);

  const handleAddPart = (part: any) => {
    setForm(prev => ({
      ...prev,
      used_parts_list: [...prev.used_parts_list, { name: part.partname, price: Number(part.price) }],
      final_bill: prev.final_bill + (Number(part.price) || 0)
    }));
  };

  const handleRemovePart = (index: number) => {
    const partToRemove = form.used_parts_list[index];
    setForm(prev => ({
      ...prev,
      used_parts_list: prev.used_parts_list.filter((_, i) => i !== index),
      final_bill: Math.max(0, prev.final_bill - (partToRemove.price || 0))
    }));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const partsString = form.used_parts_list.map(p => p.name).join(', ');
    const { error } = await supabase.from('jobs').update({
      client_id: selectedClient?.id,
      item_name: form.item_name,
      problem: form.problem,
      status: form.status,
      final_bill: Number(form.final_bill),
      used_parts: partsString
    }).eq('id', jobId);

    if (!error) {
      alert("Job Record Updated! ✅");
      router.push('/jobs');
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 className="animate-spin text-blue-600" size={40} />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 md:py-8 font-sans">
      
      {/* 1. Header & Client Info - Compact Style */}
      <div className="bg-zinc-950 rounded-3xl p-6 mb-6 text-white shadow-xl border-b-4 border-blue-600">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div className="flex items-center gap-4">
            <Link href="/jobs" className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-white transition-all">
              <ArrowLeft size={20}/>
            </Link>
            <div>
              <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-1 italic">Ticket #VT-{jobId}</p>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight italic m-0">{form.item_name || "Device Detail"}</h1>
            </div>
          </div>

          <div className="relative">
            <button 
              onClick={() => setIsClientModalOpen(!isClientModalOpen)}
              className="flex items-center gap-3 bg-zinc-900 border border-zinc-700 p-3 rounded-2xl hover:border-blue-500 transition-all text-left group"
            >
              <div className="p-2 bg-blue-600/10 rounded-lg text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <User size={18} />
              </div>
              <div className="mr-4">
                <p className="text-[10px] font-bold text-zinc-500 uppercase m-0">Client Name</p>
                <p className="text-sm font-black m-0 italic">{selectedClient?.name || "Select Client"}</p>
              </div>
              <ChevronDown size={16} className="text-zinc-500" />
            </button>

            {isClientModalOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white text-zinc-950 rounded-2xl shadow-2xl z-50 p-3 border-2 border-zinc-900 animate-in fade-in zoom-in-95">
                <input placeholder="Search Client..." className="w-full p-3 bg-zinc-100 rounded-xl border-none mb-2 font-bold text-xs"
                  onChange={e => setClientSearch(e.target.value)} />
                <div className="max-h-48 overflow-y-auto">
                  {allClients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                    <div key={c.id} onClick={() => { setSelectedClient(c); setIsClientModalOpen(false); }}
                      className="p-3 rounded-xl hover:bg-zinc-950 hover:text-white cursor-pointer transition-all flex justify-between items-center text-xs font-black italic">
                      {c.name} {selectedClient?.id === c.id && <Check size={14} className="text-blue-500"/>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleUpdate} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Device Info & Inventory */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-200">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2 italic">
              <Smartphone size={16}/> Device Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Device Model</label>
                <input className="w-full p-3 bg-zinc-50 border-2 border-zinc-100 rounded-xl font-bold text-zinc-900 focus:border-blue-600 outline-none transition-all"
                  value={form.item_name} onChange={e => setForm({...form, item_name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-zinc-500 ml-1">Status</label>
                <select className="w-full p-3 bg-zinc-50 border-2 border-zinc-900 rounded-xl font-black text-zinc-900 outline-none italic"
                  value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="Pending">⚠️ Pending</option>
                  <option value="In-Progress">⚙️ In-Progress</option>
                  <option value="Repaired">🛠️ Repaired</option>
                  <option value="Delivered">✅ Delivered</option>
                </select>
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-black uppercase text-red-500 ml-1">Issue / Problem</label>
                <textarea className="w-full p-3 bg-zinc-50 border-2 border-zinc-100 rounded-xl font-bold text-zinc-900 h-20 resize-none outline-none focus:border-red-400"
                  value={form.problem} onChange={e => setForm({...form, problem: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="bg-blue-50/50 rounded-3xl p-6 border-2 border-blue-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-blue-700 italic flex items-center gap-2">
                <PackagePlus size={18}/> Inventory Selection
              </h2>
              <div className="relative w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={14} />
                <input placeholder="Search Part..." className="w-full pl-9 pr-4 py-2 bg-white border-none rounded-xl text-[11px] font-bold outline-none ring-1 ring-blue-100 focus:ring-blue-400 shadow-sm"
                  onChange={e => setInvSearch(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {inventory.filter(i => i.partname?.toLowerCase().includes(invSearch.toLowerCase())).map(item => (
                <button key={item.id} type="button" onClick={() => handleAddPart(item)}
                  className="flex justify-between items-center p-3 bg-white border border-blue-100 hover:border-zinc-950 rounded-xl transition-all group">
                  <span className="text-[11px] font-bold text-zinc-700 uppercase group-hover:text-zinc-950">{item.partname}</span>
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md">₹{item.price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Parts Used & Billing */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-zinc-50 rounded-3xl p-6 border-2 border-zinc-100 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2 italic">
              <Cpu size={18} className="text-blue-600"/> Selected Parts
            </h2>
            <div className="flex flex-wrap gap-2 min-h-[120px] p-4 bg-white border-2 border-dashed border-zinc-200 rounded-2xl content-start">
              {form.used_parts_list.length === 0 && (
                <div className="flex flex-col items-center justify-center w-full h-full text-zinc-300 gap-2 opacity-50">
                  <PackagePlus size={24}/>
                  <span className="text-[10px] font-bold italic">No items from stock added</span>
                </div>
              )}
              {form.used_parts_list.map((part, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-zinc-900 text-white pl-3 pr-1 py-1.5 rounded-xl animate-in fade-in zoom-in-95">
                  <span className="text-[10px] font-black italic uppercase">{part.name}</span>
                  <button type="button" onClick={() => handleRemovePart(idx)} className="p-1 hover:text-red-400 transition-colors">
                    <X size={14} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-emerald-600 rounded-3xl p-6 text-white shadow-xl shadow-emerald-900/10">
            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-100 mb-3 block italic ml-1">Total Repair Bill</label>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-700/50 rounded-2xl">
                <IndianRupee size={28} className="text-white"/>
              </div>
              <input type="number" className="bg-transparent border-none text-4xl font-black text-white outline-none w-full italic"
                value={form.final_bill} onChange={e => setForm({...form, final_bill: Number(e.target.value)})} />
            </div>
          </div>

          <button type="submit" disabled={saving} className="w-full py-5 bg-zinc-950 hover:bg-blue-600 text-white rounded-[2rem] font-black text-lg uppercase italic tracking-tighter transition-all shadow-xl active:scale-95 disabled:bg-zinc-400 flex items-center justify-center gap-3">
            {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
            {saving ? "UPDATING..." : "SAVE & CONFIRM"}
          </button>
        </div>
      </form>
    </div>
  );
}