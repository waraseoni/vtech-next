"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, User, Smartphone, Hash, AlertCircle, IndianRupee, Search, Check, ChevronDown } from 'lucide-react';
import Link from 'next/link';

export default function NewJob() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({ 
    client_id: "", 
    item_name: "", 
    serial_no: "", 
    problem: "", 
    labour_charges: "0" 
  });

  useEffect(() => {
    supabase.from('clients').select('*').then(({ data }) => setClients(data || []));
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.mobile && c.mobile.includes(searchQuery))
  );

  const handleSelectClient = (client: any) => {
    setSelectedClient(client);
    setFormData({ ...formData, client_id: client.id.toString() });
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleSave = async () => {
    if (!formData.client_id || !formData.item_name) {
      alert("Please select a customer and enter item name.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('jobs').insert([{
      ...formData,
      client_id: parseInt(formData.client_id),
      final_bill: parseInt(formData.labour_charges)
    }]);
    if (!error) router.push('/jobs');
    else {
      alert("Error: " + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/jobs" className="p-2.5 bg-zinc-950 text-white rounded-xl hover:bg-blue-600 transition-all shadow-md">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-zinc-950 m-0 uppercase italic tracking-tighter">Create New Job</h1>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Job Entry Terminal</p>
          </div>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="bg-white rounded-[2rem] shadow-2xl border-2 border-zinc-200 overflow-hidden">
        <div className="p-6 md:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
            
            {/* Column 1: Customer & Device */}
            <div className="space-y-6">
              <div className="relative" ref={dropdownRef}>
                <label className="text-sm font-black text-zinc-950 uppercase mb-3 block tracking-tight">1. Customer Information</label>
                <button 
                  onClick={() => setIsOpen(!isOpen)}
                  className={`w-full flex items-center justify-between p-4 bg-white border-2 rounded-2xl transition-all text-left outline-none
                    ${isOpen ? 'border-blue-600 ring-4 ring-blue-50' : 'border-zinc-300 hover:border-zinc-400'}`}
                >
                  {selectedClient ? (
                    <div className="flex flex-col">
                      <span className="font-black text-zinc-950 text-base italic">{selectedClient.name}</span>
                      <span className="text-blue-600 font-bold text-sm">{selectedClient.mobile}</span>
                    </div>
                  ) : (
                    <span className="text-zinc-500 font-bold">Search Customer (Name/Mobile)...</span>
                  )}
                  <ChevronDown size={20} className="text-zinc-950" />
                </button>

                {isOpen && (
                  <div className="absolute top-full left-0 right-0 mt-3 bg-white border-2 border-zinc-900 rounded-2xl shadow-2xl z-50 p-4">
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                      <input
                        autoFocus
                        placeholder="Type to search..."
                        className="w-full pl-10 pr-4 py-3 bg-zinc-100 border-none rounded-xl text-zinc-950 font-black text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar">
                      {filteredClients.map(c => (
                        <div 
                          key={c.id} 
                          onClick={() => handleSelectClient(c)} 
                          className="flex items-center justify-between p-3.5 rounded-xl hover:bg-zinc-950 hover:text-white cursor-pointer transition-all group"
                        >
                          <div>
                            <div className="text-sm font-black italic">{c.name}</div>
                            <div className="text-[11px] font-bold opacity-70 tracking-tighter">{c.mobile}</div>
                          </div>
                          {selectedClient?.id === c.id && <Check size={16} className="text-emerald-500" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-black text-zinc-950 uppercase block tracking-tight">Device Model</label>
                  <input 
                    className="w-full p-4 bg-white border-2 border-zinc-300 rounded-2xl text-zinc-950 font-black outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-zinc-300"
                    placeholder="e.g. iPhone 15 Pro"
                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-zinc-950 uppercase block tracking-tight">Serial / IMEI</label>
                  <input 
                    className="w-full p-4 bg-white border-2 border-zinc-300 rounded-2xl text-zinc-950 font-black outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-zinc-300"
                    placeholder="Enter IMEI number"
                    onChange={(e) => setFormData({ ...formData, serial_no: e.target.value })} 
                  />
                </div>
              </div>
            </div>

            {/* Column 2: Problem & Bill */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-black text-zinc-950 uppercase block tracking-tight">Problem Details</label>
                <textarea 
                  className="w-full p-4 bg-white border-2 border-zinc-300 rounded-2xl text-zinc-950 font-black outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-50 transition-all h-[120px] resize-none placeholder:text-zinc-300"
                  placeholder="What is the issue with the device?"
                  onChange={(e) => setFormData({ ...formData, problem: e.target.value })} 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-zinc-950 uppercase block tracking-tight">Labour Charges (Estimate)</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-zinc-950 text-white rounded-lg flex items-center justify-center">
                    <IndianRupee size={16} />
                  </div>
                  <input 
                    type="number"
                    className="w-full p-4 pl-16 bg-white border-2 border-zinc-300 rounded-2xl text-2xl font-black text-emerald-700 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50 transition-all italic"
                    placeholder="0"
                    onChange={(e) => setFormData({ ...formData, labour_charges: e.target.value })} 
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Action Button */}
          <div className="mt-12 pt-8 border-t-2 border-zinc-100">
            <button 
              onClick={handleSave} 
              disabled={loading}
              className="w-full md:w-auto md:px-16 py-5 bg-zinc-950 hover:bg-blue-600 text-white rounded-2xl font-black text-lg uppercase tracking-widest transition-all shadow-xl shadow-zinc-200 active:scale-95 disabled:bg-zinc-400 flex items-center justify-center gap-4 italic"
            >
              {loading ? (
                "Processing..."
              ) : (
                <>
                  <Save size={24} strokeWidth={3} />
                  Confirm & Save Job
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}