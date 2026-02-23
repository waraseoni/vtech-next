"use client";
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, UserPlus, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstname: "",
    middlename: "",
    lastname: "",
    contact: "",
    email: "",
    address: "",
    opening_balance: 0
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstname || !form.lastname || !form.contact || !form.email || !form.address) {
      return alert("Required fields: First Name, Last Name, Contact, Email, Address!");
    }
    setLoading(true);
    const { error } = await supabase.from('client_list').insert([form]);
    if (error) {
      console.error("Error inserting client:", error);
      alert(error.message);
    } else {
      router.push('/clients');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-md mx-auto space-y-6 animate-in fade-in duration-500">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <Link 
            href="/clients" 
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors no-underline"
          >
            <ArrowLeft size={24} /> Back to Clients
          </Link>
        </div>

        {/* FORM CARD */}
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <UserPlus className="text-white" size={28} />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tighter uppercase leading-none">
              New Client
            </h1>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-[11px] font-extrabold uppercase text-gray-500 tracking-[0.15em] mb-2">First Name *</label>
              <input 
                value={form.firstname} 
                onChange={e => setForm({...form, firstname: e.target.value})} 
                className="w-full px-5 py-3 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 transition-all text-gray-900 font-bold placeholder:text-gray-400"
                required 
              />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold uppercase text-gray-500 tracking-[0.15em] mb-2">Middle Name</label>
              <input 
                value={form.middlename} 
                onChange={e => setForm({...form, middlename: e.target.value})} 
                className="w-full px-5 py-3 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 transition-all text-gray-900 font-bold placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold uppercase text-gray-500 tracking-[0.15em] mb-2">Last Name *</label>
              <input 
                value={form.lastname} 
                onChange={e => setForm({...form, lastname: e.target.value})} 
                className="w-full px-5 py-3 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 transition-all text-gray-900 font-bold placeholder:text-gray-400"
                required 
              />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold uppercase text-gray-500 tracking-[0.15em] mb-2">Contact *</label>
              <input 
                value={form.contact} 
                onChange={e => setForm({...form, contact: e.target.value})} 
                className="w-full px-5 py-3 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 transition-all text-gray-900 font-bold placeholder:text-gray-400"
                required 
              />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold uppercase text-gray-500 tracking-[0.15em] mb-2">Email *</label>
              <input 
                type="email"
                value={form.email} 
                onChange={e => setForm({...form, email: e.target.value})} 
                className="w-full px-5 py-3 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 transition-all text-gray-900 font-bold placeholder:text-gray-400"
                required 
              />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold uppercase text-gray-500 tracking-[0.15em] mb-2">Address *</label>
              <textarea 
                value={form.address} 
                onChange={e => setForm({...form, address: e.target.value})} 
                className="w-full px-5 py-3 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 transition-all text-gray-900 font-bold placeholder:text-gray-400 min-h-[100px]"
                required 
              />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold uppercase text-gray-500 tracking-[0.15em] mb-2">Opening Balance</label>
              <input 
                type="number"
                value={form.opening_balance} 
                onChange={e => setForm({...form, opening_balance: parseFloat(e.target.value) || 0})} 
                className="w-full px-5 py-3 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 transition-all text-gray-900 font-bold placeholder:text-gray-400"
              />
            </div>
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-[2rem] font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-tight shadow-md shadow-blue-500/20 text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} strokeWidth={2.5} />}
              {loading ? "Saving..." : "Save Client"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}