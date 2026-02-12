"use client";
import React, { useState, useEffect, use, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Save, ArrowLeft, Loader2, IndianRupee, 
  Cpu, PackagePlus, X, User, ChevronDown, Check, Smartphone, AlertCircle, MessageSquare, Phone
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
  const [mounted, setMounted] = useState(false);
  
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);

  const [form, setForm] = useState({ 
    item_name: "", 
    problem: "", 
    status: "Pending", 
    final_bill: 0,
    remarks: "",
    used_parts_list: [] as {name: string, price: number}[]
  });

  // Hydration fix
  useEffect(() => { setMounted(true); }, []);

  // Debounced inventory search
  const [debouncedInvSearch, setDebouncedInvSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedInvSearch(invSearch), 300);
    return () => clearTimeout(timer);
  }, [invSearch]);

  // --- FETCH DATA WITH FIXED PART PRICES ---
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
        
        // 🔥 FIX: used_parts ko price ke saath map karo
        const existingParts = jobRes.data.used_parts 
          ? jobRes.data.used_parts.split(', ').map((p: string) => {
              const found = invRes.data?.find((item: any) => item.partname === p);
              return { 
                name: p, 
                price: found ? Number(found.price) : 0 
              };
            })
          : [];

        setForm({
          item_name: jobRes.data.item_name || "",
          problem: jobRes.data.problem || "",
          status: jobRes.data.status || "Pending",
          final_bill: jobRes.data.final_bill || 0,
          remarks: jobRes.data.remarks || "",
          used_parts_list: existingParts
        });
      }
      
      if (invRes.data) setInventory(invRes.data);
      if (clientRes.data) setAllClients(clientRes.data);
      setLoading(false);
    }
    getData();
  }, [jobId]);

  // Memoized filtered clients
  const filteredClients = useMemo(() => {
    const s = clientSearch.toLowerCase();
    return allClients.filter(c => 
      c.name?.toLowerCase().includes(s) || c.mobile?.includes(s)
    );
  }, [allClients, clientSearch]);

  // Memoized filtered inventory
  const filteredInventory = useMemo(() => {
    const s = debouncedInvSearch.toLowerCase();
    return inventory.filter(i => i.partname?.toLowerCase().includes(s));
  }, [inventory, debouncedInvSearch]);

  // Callbacks
  const handleAddPart = useCallback((part: any) => {
    setForm(prev => ({
      ...prev,
      used_parts_list: [...prev.used_parts_list, { name: part.partname, price: Number(part.price) }],
      final_bill: prev.final_bill + (Number(part.price) || 0)
    }));
  }, []);

  const handleRemovePart = useCallback((index: number) => {
    setForm(prev => {
      const partToRemove = prev.used_parts_list[index];
      return {
        ...prev,
        used_parts_list: prev.used_parts_list.filter((_, i) => i !== index),
        final_bill: Math.max(0, prev.final_bill - (partToRemove.price || 0))
      };
    });
  }, []);

  const handleUpdate = useCallback(async (e: React.FormEvent) => {
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
      remarks: form.remarks
    }).eq('id', jobId);

    if (!error) {
      alert("Repair Card Updated! ✅");
      router.push('/jobs');
    }
    setSaving(false);
  }, [form, selectedClient, jobId, router]);

  const selectClient = useCallback((client: any) => {
    setSelectedClient(client);
    setIsClientModalOpen(false);
  }, []);

  if (!mounted) return null;
  if (loading) return (
    <div className="flex justify-center items-center min-h-screen bg-white">
      <Loader2 className="animate-spin text-blue-600" size={40} />
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-gray-900 p-3 md:p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* TOP BAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-gray-50 p-4 rounded-3xl border-2 border-gray-300 shadow-sm">
          <div className="flex items-center gap-3">
            <Link href="/jobs" className="p-2 bg-white hover:bg-gray-100 rounded-xl text-gray-600 border-2 border-gray-300 transition-all">
              <ArrowLeft size={18}/>
            </Link>
            <div>
              <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Editing Ticket #VT-{jobId}</p>
              <h1 className="text-lg font-black uppercase italic text-gray-900 m-0 leading-none">{form.item_name || "Device"}</h1>
            </div>
          </div>

          {/* CUSTOMER SELECTOR */}
          <div className="relative">
            <button 
              onClick={() => setIsClientModalOpen(!isClientModalOpen)} 
              className="flex items-center gap-3 bg-white border-2 border-gray-300 p-2 px-4 rounded-2xl hover:border-blue-500 transition-all group min-w-[200px] shadow-sm"
            >
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <User size={16} />
              </div>
              <div className="text-left flex-1">
                <p className="text-[8px] font-black text-gray-500 uppercase m-0">Customer Info</p>
                <p className="text-xs font-black m-0 italic text-gray-800 group-hover:text-blue-600 transition-colors uppercase">
                  {selectedClient?.name}
                </p>
                <p className="text-[10px] font-bold text-gray-600 m-0 tracking-tighter flex items-center gap-1">
                  <Phone size={10} className="text-blue-600"/> {selectedClient?.mobile}
                </p>
              </div>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
            
            {isClientModalOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border-2 border-gray-300 rounded-2xl shadow-xl z-50 p-3">
                <input 
                  placeholder="Search Name or Mobile..." 
                  className="w-full p-2.5 bg-gray-50 rounded-xl border-2 border-gray-200 mb-2 font-bold text-xs text-gray-900 outline-none focus:border-blue-500"
                  onChange={e => setClientSearch(e.target.value)} 
                />
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {filteredClients.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => selectClient(c)}
                      className="p-3 rounded-xl hover:bg-blue-600 hover:text-white cursor-pointer transition-all flex justify-between items-center text-[11px] font-black italic text-gray-700 hover:text-white border-2 border-transparent hover:border-blue-700"
                    >
                      <div>
                        <span className="block uppercase">{c.name}</span>
                        <span className="text-[9px] opacity-70 tracking-tighter font-bold">{c.mobile}</span>
                      </div>
                      {selectedClient?.id === c.id && <Check size={14} className="text-blue-600" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleUpdate} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* LEFT COLUMN */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* DEVICE CARD */}
            <div className="bg-white border-2 border-gray-300 p-6 rounded-[2rem] shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Smartphone size={16} className="text-blue-600" />
                <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest italic">Technical Specs</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-1">Device Model</label>
                  <input 
                    className="w-full p-3 bg-white border-2 border-gray-300 rounded-xl font-bold text-gray-900 focus:border-blue-500 outline-none transition-all text-sm uppercase"
                    value={form.item_name} 
                    onChange={e => setForm({...form, item_name: e.target.value})} 
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-1">Job Status</label>
                  <select 
                    className="w-full p-3 bg-white border-2 border-gray-300 rounded-xl font-black text-gray-900 outline-none italic text-sm appearance-none cursor-pointer"
                    value={form.status} 
                    onChange={e => setForm({...form, status: e.target.value})}
                  >
                    <option value="Pending">⚠️ Pending</option>
                    <option value="In-Progress">⚙️ In-Progress</option>
                    <option value="Repaired">🛠️ Repaired</option>
                    <option value="Delivered">✅ Delivered</option>
                    {/* 🔥 NEW: Cancelled Status */}
                    <option value="Cancelled">❌ Cancelled</option>
                  </select>
                </div>
                
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-red-600 ml-1 flex items-center gap-2">
                    <AlertCircle size={10}/> Detected Fault
                  </label>
                  <textarea 
                    className="w-full p-3 bg-white border-2 border-gray-300 rounded-xl font-bold text-gray-900 h-16 resize-none outline-none focus:border-red-500 text-sm italic"
                    value={form.problem} 
                    onChange={e => setForm({...form, problem: e.target.value})} 
                  />
                </div>
              </div>
            </div>

            {/* REMARKS CARD */}
            <div className="bg-white border-2 border-gray-300 p-6 rounded-[2rem] shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare size={16} className="text-amber-600" />
                <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest italic">Internal Remarks / Notes</h3>
              </div>
              <textarea 
                placeholder="Write any extra notes here (e.g. Password, Screen condition, urgent)..."
                className="w-full p-4 bg-white border-2 border-gray-300 rounded-2xl font-bold text-gray-900 h-24 resize-none outline-none focus:border-amber-500 text-sm italic placeholder:text-gray-400"
                value={form.remarks} 
                onChange={e => setForm({...form, remarks: e.target.value})} 
              />
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* INVENTORY CARD */}
            <div className="bg-white border-2 border-gray-300 p-6 rounded-[2rem] shadow-md flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest italic flex items-center gap-2">
                  <PackagePlus size={16} className="text-blue-600" /> Stock Picker
                </h3>
                <input 
                  placeholder="Search Parts..." 
                  className="pl-3 pr-3 py-1.5 bg-gray-50 border-2 border-gray-300 rounded-lg text-[10px] font-bold text-gray-900 outline-none w-32 focus:w-40 transition-all focus:border-blue-500"
                  onChange={e => setInvSearch(e.target.value)} 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto mb-6 pr-1">
                {filteredInventory.map(item => (
                  <button 
                    key={item.id} 
                    type="button" 
                    onClick={() => handleAddPart(item)}
                    className="flex flex-col p-2 bg-gray-50 border-2 border-gray-300 hover:border-blue-500 rounded-xl transition-all text-left group"
                  >
                    <span className="text-[9px] font-bold text-gray-600 uppercase truncate group-hover:text-gray-900">
                      {item.partname}
                    </span>
                    <span className="text-[10px] font-black text-blue-600">₹{item.price}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-3 border-t-2 border-gray-200 pt-4">
                <Cpu size={14} className="text-gray-500" />
                <span className="text-[9px] font-black text-gray-500 uppercase italic">Used Components</span>
              </div>
              
              {/* Used Parts Area */}
              <div className="flex flex-wrap gap-1.5 min-h-[60px] p-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-500 mb-6">
                {form.used_parts_list.length === 0 && (
                  <p className="text-[9px] font-bold text-gray-400 m-auto italic uppercase">No parts added</p>
                )}
                {form.used_parts_list.map((part, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border-2 border-blue-200 px-2 py-1 rounded-lg"
                  >
                    <span className="text-[9px] font-black italic uppercase">{part.name}</span>
                    <span className="text-[8px] font-bold text-blue-600">₹{part.price}</span>
                    <button 
                      type="button" 
                      onClick={() => handleRemovePart(idx)} 
                      className="hover:text-red-600 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-auto space-y-2">
                <label className="text-[10px] font-black uppercase text-emerald-700 ml-1 italic tracking-[0.2em]">Grand Total</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-700">
                    <IndianRupee size={22} strokeWidth={3} />
                  </div>
                  <input 
                    type="number" 
                    className="w-full p-4 pl-12 bg-white border-2 border-emerald-300 rounded-2xl text-3xl font-black text-emerald-700 outline-none italic focus:border-emerald-600 transition-all"
                    value={form.final_bill} 
                    onChange={e => setForm({...form, final_bill: Number(e.target.value)})} 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={saving} 
                className="w-full mt-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase italic tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:bg-gray-300 disabled:text-gray-600 disabled:border-2 disabled:border-gray-400 flex items-center justify-center gap-2"
              >
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