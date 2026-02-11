"use client";
import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Save, ArrowLeft, Loader2, IndianRupee, 
  Cpu, PackagePlus, X, Search, User, ChevronDown, Check, Smartphone, AlertCircle, MessageSquare, Phone
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

  const [form, setForm] = useState({ 
    item_name: "", 
    problem: "", 
    status: "Pending", 
    final_bill: 0,
    remarks: "", // Naya Remark field
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
        setSelectedClient(jobRes.data.clients);
        const existingParts = jobRes.data.used_parts 
          ? jobRes.data.used_parts.split(', ').map((p: string) => ({ name: p, price: 0 })) 
          : [];
        setForm({
          item_name: jobRes.data.item_name || "",
          problem: jobRes.data.problem || "",
          status: jobRes.data.status || "Pending",
          final_bill: jobRes.data.final_bill || 0,
          remarks: jobRes.data.remarks || "", // Database se remarks load karna
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
      used_parts: partsString,
      remarks: form.remarks // Database mein remarks save karna
    }).eq('id', jobId);

    if (!error) {
      alert("Repair Card Updated! ✅");
      router.push('/jobs');
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen bg-black">
      <Loader2 className="animate-spin text-blue-500" size={40} />
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-3 md:p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* TOP BAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-zinc-900/50 p-4 rounded-3xl border border-zinc-800 shadow-2xl">
          <div className="flex items-center gap-3">
            <Link href="/jobs" className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 border border-zinc-700 transition-all">
              <ArrowLeft size={18}/>
            </Link>
            <div>
              <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest leading-none mb-1">Editing Ticket #VT-{jobId}</p>
              <h1 className="text-lg font-black uppercase italic text-white m-0 leading-none">{form.item_name || "Device"}</h1>
            </div>
          </div>

          {/* CUSTOMER SELECTOR (WITH MOBILE) */}
          <div className="relative">
            <button onClick={() => setIsClientModalOpen(!isClientModalOpen)} 
              className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 p-2 px-4 rounded-2xl hover:border-blue-600 transition-all group min-w-[200px]">
              <div className="p-2 bg-blue-600/10 rounded-lg text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <User size={16} />
              </div>
              <div className="text-left flex-1">
                <p className="text-[8px] font-black text-zinc-500 uppercase m-0">Customer Info</p>
                <p className="text-xs font-black m-0 italic text-white group-hover:text-blue-400 transition-colors uppercase">{selectedClient?.name}</p>
                <p className="text-[10px] font-bold text-zinc-400 m-0 tracking-tighter flex items-center gap-1">
                  <Phone size={10} className="text-blue-500"/> {selectedClient?.mobile}
                </p>
              </div>
              <ChevronDown size={14} className="text-zinc-700" />
            </button>
            {isClientModalOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl z-50 p-3 animate-in fade-in zoom-in-95">
                <input placeholder="Search Name or Mobile..." className="w-full p-2.5 bg-black rounded-xl border border-zinc-800 mb-2 font-bold text-xs text-white outline-none focus:border-blue-500"
                  onChange={e => setClientSearch(e.target.value)} />
                <div className="max-h-52 overflow-y-auto space-y-1 custom-scrollbar">
                  {allClients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.mobile.includes(clientSearch)).map(c => (
                    <div key={c.id} onClick={() => { setSelectedClient(c); setIsClientModalOpen(false); }}
                      className="p-3 rounded-xl hover:bg-blue-600 hover:text-white cursor-pointer transition-all flex justify-between items-center text-[11px] font-black italic">
                      <div>
                        <span className="block uppercase">{c.name}</span>
                        <span className="text-[9px] opacity-70 tracking-tighter font-bold">{c.mobile}</span>
                      </div>
                      {selectedClient?.id === c.id && <Check size={14} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleUpdate} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* LEFT: DEVICE & REMARKS */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Smartphone size={16} className="text-blue-500" />
                <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest italic">Technical Specs</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-zinc-500 ml-1">Device Model</label>
                  <input className="w-full p-3 bg-black border border-zinc-800 rounded-xl font-bold text-white focus:border-blue-500 outline-none transition-all text-sm uppercase"
                    value={form.item_name} onChange={e => setForm({...form, item_name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-zinc-500 ml-1">Job Status</label>
                  <select className="w-full p-3 bg-black border border-zinc-800 rounded-xl font-black text-white outline-none italic text-sm appearance-none cursor-pointer"
                    value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                    <option value="Pending">⚠️ Pending</option>
                    <option value="In-Progress">⚙️ In-Progress</option>
                    <option value="Repaired">🛠️ Repaired</option>
                    <option value="Delivered">✅ Delivered</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-red-500 ml-1 flex items-center gap-2">
                    <AlertCircle size={10}/> Detected Fault
                  </label>
                  <textarea className="w-full p-3 bg-black border border-zinc-800 rounded-xl font-bold text-white h-16 resize-none outline-none focus:border-red-500 text-sm italic"
                    value={form.problem} onChange={e => setForm({...form, problem: e.target.value})} />
                </div>
              </div>
            </div>

            {/* REMARKS SECTION (NEW) */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare size={16} className="text-amber-500" />
                <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest italic">Internal Remarks / Notes</h3>
              </div>
              <textarea 
                placeholder="Write any extra notes here (e.g. Password, Screen condition, urgent)..."
                className="w-full p-4 bg-black border border-zinc-800 rounded-2xl font-bold text-white h-24 resize-none outline-none focus:border-amber-500 text-sm italic placeholder:text-zinc-700"
                value={form.remarks} 
                onChange={e => setForm({...form, remarks: e.target.value})} 
              />
            </div>
          </div>

          {/* RIGHT: INVENTORY & BILLING */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] shadow-xl flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest italic flex items-center gap-2">
                  <PackagePlus size={16} className="text-blue-500" /> Stock Picker
                </h3>
                <input placeholder="Search Parts..." className="pl-3 pr-3 py-1.5 bg-black border border-zinc-800 rounded-lg text-[10px] font-bold text-white outline-none w-32 focus:w-40 transition-all focus:border-blue-500"
                    onChange={e => setInvSearch(e.target.value)} />
              </div>
              
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto mb-6 custom-scrollbar pr-1">
                {inventory.filter(i => i.partname?.toLowerCase().includes(invSearch.toLowerCase())).map(item => (
                  <button key={item.id} type="button" onClick={() => handleAddPart(item)}
                    className="flex flex-col p-2 bg-zinc-950 border border-zinc-800 hover:border-blue-500 rounded-xl transition-all text-left group">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase truncate group-hover:text-white">{item.partname}</span>
                    <span className="text-[10px] font-black text-blue-500">₹{item.price}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-3 border-t border-zinc-800 pt-4">
                <Cpu size={14} className="text-zinc-500" />
                <span className="text-[9px] font-black text-zinc-500 uppercase italic">Used Components</span>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[60px] p-3 bg-black rounded-2xl border border-dashed border-zinc-800 mb-6">
                {form.used_parts_list.length === 0 && <p className="text-[9px] font-bold text-zinc-800 m-auto italic uppercase">No parts added</p>}
                {form.used_parts_list.map((part, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-blue-600/10 text-blue-400 border border-blue-600/20 px-2 py-1 rounded-lg">
                    <span className="text-[9px] font-black italic uppercase">{part.name}</span>
                    <button type="button" onClick={() => handleRemovePart(idx)} className="hover:text-white transition-colors"><X size={12} /></button>
                  </div>
                ))}
              </div>

              <div className="mt-auto space-y-2">
                <label className="text-[10px] font-black uppercase text-emerald-500 ml-1 italic tracking-[0.2em]">Grand Total</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500">
                    <IndianRupee size={22} strokeWidth={3} />
                  </div>
                  <input type="number" className="w-full p-4 pl-12 bg-black border border-emerald-900/30 rounded-2xl text-3xl font-black text-emerald-500 outline-none italic focus:border-emerald-500 transition-all"
                    value={form.final_bill} onChange={e => setForm({...form, final_bill: Number(e.target.value)})} />
                </div>
              </div>

              <button type="submit" disabled={saving} className="w-full mt-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase italic tracking-widest transition-all shadow-lg shadow-blue-900/20 active:scale-95 disabled:bg-zinc-800 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {saving ? "SAVING..." : "UPDATE REPAIR CARD"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}