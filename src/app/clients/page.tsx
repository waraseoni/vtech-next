"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
  Users, UserPlus, Search, Phone, MapPin, 
  Eye, Edit3, Trash2, Loader2, ShieldCheck 
} from 'lucide-react';

type Client = {
  id: number;
  name: string;
  mobile: string;
  address?: string;
  created_at?: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [deliveredTotals, setDeliveredTotals] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null); // Role state

  // Mobile detection aur User Role fetch
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Naya: User ka Role check karna
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        setUserRole(profile?.role || 'staff');
      }
    };
    checkUserRole();

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch clients + delivered totals
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Fetch all clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      // 2. Fetch only delivered jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('client_id, final_bill')
        .eq('status', 'Delivered');
      if (jobsError) throw jobsError;

      // 3. Aggregate total per client
      const totals: Record<number, number> = {};
      jobsData?.forEach((job) => {
        if (job.client_id) {
          totals[job.client_id] = (totals[job.client_id] || 0) + (job.final_bill || 0);
        }
      });
      setDeliveredTotals(totals);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Delete handler - Admin permission ke saath
  const handleDelete = async (id: number, name: string) => {
    if (userRole !== 'admin') {
      alert("Permission Denied: Sirf Admin hi client delete kar sakta hai!");
      return;
    }
    
    if (confirm(`Kya aap "${name}" ko delete karna chahte hain?`)) {
      try {
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) throw error;
        setClients(prev => prev.filter(client => client.id !== id));
      } catch (err) {
        console.error("Error deleting client:", err);
        alert("Client delete nahi ho paya! Shayad uske saath jobs linked hain.");
      }
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.mobile?.includes(searchTerm)
    );
  }, [clients, searchTerm]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 bg-white">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-gray-500 font-bold italic uppercase tracking-[0.25em] text-sm">
          Loading Customers...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER CARD */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50 p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <Users className="text-white" size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-black text-gray-900 tracking-tighter m-0 uppercase leading-none">
                  Customer Registry
                </h2>
                {userRole === 'admin' && <ShieldCheck className="text-emerald-600" size={24} title="Admin Access" />}
              </div>
              <p className="text-blue-600 text-[11px] font-extrabold uppercase tracking-[0.25em] mt-2">
                {userRole === 'admin' ? "Admin Mode" : "Staff View"} | Total Clients: {clients.length}
              </p>
            </div>
          </div>
          <Link 
            href="/clients/new" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-[2rem] font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 no-underline uppercase tracking-tight shadow-md shadow-blue-500/20 text-sm"
          >
            <UserPlus size={20} strokeWidth={2.5} /> Add New Client
          </Link>
        </div>

        {/* SEARCH BOX */}
        <div className="relative group">
          <Search size={22} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
          <input 
            placeholder="Search by name or mobile..." 
            value={searchTerm}
            className="w-full pl-16 pr-8 py-5 bg-white border-2 border-gray-300 rounded-[2rem] outline-none focus:border-blue-600 transition-all shadow-md text-gray-900 font-bold text-lg placeholder:text-gray-400 placeholder:font-medium"
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>

        {/* CLIENTS LIST */}
        {filteredClients.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-400 shadow-md">
            <p className="text-gray-600 font-bold italic uppercase tracking-wider text-sm">
              No clients found matching your search
            </p>
          </div>
        ) : isMobile ? (
          /* MOBILE CARDS */
          <div className="grid gap-4">
            {filteredClients.map(client => (
              <div key={client.id} className="bg-white p-6 rounded-[2rem] border-2 border-gray-300 shadow-md space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-gray-900 text-lg uppercase tracking-tight">{client.name}</span>
                  <span className="px-3 py-1.5 bg-emerald-50 border-2 border-emerald-200 rounded-full text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">
                    ₹{deliveredTotals[client.id] || 0}
                  </span>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-xl border-2 border-gray-200 space-y-2">
                  <div className="flex items-center gap-2 text-gray-700 font-bold text-sm">
                    <Phone size={14} className="text-blue-600" /> <span>{client.mobile || '—'}</span>
                  </div>
                  <div className="flex items-start gap-2 text-gray-700 font-bold text-sm">
                    <MapPin size={14} className="text-blue-600 mt-0.5" /> <span className="flex-1">{client.address || '—'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Link href={`/clients/${client.id}/view`} className="flex flex-col items-center gap-1 p-3 bg-white border-2 border-gray-300 rounded-xl no-underline text-gray-700 hover:bg-gray-100 transition-all">
                    <Eye size={18} /> <span className="text-[9px] font-extrabold uppercase">View</span>
                  </Link>
                  <Link href={`/clients/${client.id}/edit`} className="flex flex-col items-center gap-1 p-3 bg-blue-50 border-2 border-blue-200 rounded-xl no-underline text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all">
                    <Edit3 size={18} /> <span className="text-[9px] font-extrabold uppercase">Edit</span>
                  </Link>
                  
                  {/* ADMIN ONLY DELETE (MOBILE) */}
                  {userRole === 'admin' && (
                    <button onClick={() => handleDelete(client.id, client.name)} className="flex flex-col items-center gap-1 p-3 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all cursor-pointer">
                      <Trash2 size={18} /> <span className="text-[9px] font-extrabold uppercase">Del</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* DESKTOP TABLE */
          <div className="bg-white rounded-[2.5rem] shadow-md border-2 border-gray-300 overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 border-b-2 border-gray-300">
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase tracking-[0.15em]">Customer Details</th>
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase tracking-[0.15em]">Contact</th>
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase tracking-[0.15em]">Address</th>
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase tracking-[0.15em]">Delivered Total</th>
                  <th className="px-6 py-5 text-center text-[11px] font-extrabold uppercase tracking-[0.15em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredClients.map(client => (
                  <tr key={client.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="font-extrabold text-gray-900 text-base tracking-tight">{client.name}</div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-gray-700 font-bold text-sm">
                        <Phone size={14} className="text-blue-600" /> <span>{client.mobile || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-gray-700 font-bold text-sm max-w-xs truncate">
                      {client.address || '—'}
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1.5 bg-emerald-50 border-2 border-emerald-200 rounded-full text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">
                        ₹{deliveredTotals[client.id] || 0}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/clients/${client.id}/view`} className="p-2.5 bg-white border-2 border-gray-300 text-gray-600 rounded-xl hover:bg-gray-100 transition-all" title="View Profile"><Eye size={18} /></Link>
                        <Link href={`/clients/${client.id}/edit`} className="p-2.5 bg-white border-2 border-gray-300 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all" title="Edit Client"><Edit3 size={18} /></Link>
                        
                        {/* ADMIN ONLY DELETE (DESKTOP) */}
                        {userRole === 'admin' && (
                          <button onClick={() => handleDelete(client.id, client.name)} className="p-2.5 bg-white border-2 border-gray-300 text-red-600 rounded-xl hover:bg-red-600 hover:text-white hover:border-red-600 transition-all cursor-pointer" title="Delete Client"><Trash2 size={18} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}