"use client";
import { useState, useEffect, Suspense } from 'react'; // 1. Suspense import kiya
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Eye, Settings, Wrench, Search, Loader2, Trash2, Smartphone, Phone, IndianRupee } from 'lucide-react';

// --- Asli Logic Wala Component ---
function JobsListContent() {
  const searchParams = useSearchParams();
  const globalSearch = searchParams.get('search') || "";
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [localSearch, setLocalSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('jobs')
      .select('id, client_id, item_name, problem, status, final_bill, clients(name, mobile)') 
      .order('created_at', { ascending: false });
    setJobs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 1024);
    checkSize();
    setMounted(true);
    fetchJobs();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm("Kya aap pakka delete karna chahte hain?")) {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (!error) setJobs(jobs.filter(job => job.id !== id));
    }
  };

  const filteredJobs = jobs.filter(j => {
    const s = (globalSearch || localSearch).toLowerCase();
    return (
      j.clients?.name?.toLowerCase().includes(s) || 
      j.clients?.mobile?.includes(s) ||
      j.id.toString().includes(s) ||
      j.item_name?.toLowerCase().includes(s)
    );
  });

  if (!mounted) return null;

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-zinc-500 font-bold italic uppercase">V-TECH: Refreshing Job Database...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-zinc-900 rounded-2xl shadow-lg">
            <Wrench className="text-blue-400" size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight m-0 uppercase italic">Job Registry</h2>
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mt-1">Total Active Jobs: {filteredJobs.length}</p>
          </div>
        </div>
        <Link href="/jobs/new" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-blue-100 no-underline uppercase tracking-tighter">
          <Plus size={20} strokeWidth={3} /> New Entry
        </Link>
      </div>

      {/* SEARCH BOX */}
      <div className="relative">
        <Search size={22} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input 
          placeholder="Search within this list..." 
          value={localSearch}
          className="w-full pl-14 pr-6 py-5 bg-white border-2 border-zinc-100 rounded-[1.5rem] outline-none focus:border-blue-500 transition-all shadow-sm text-zinc-800 font-bold text-lg"
          onChange={(e) => setLocalSearch(e.target.value)} 
        />
      </div>

      {/* MOBILE LIST */}
      {isMobile ? (
        <div className="space-y-4">
          {filteredJobs.map(job => (
            <div key={job.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-zinc-50 shadow-lg space-y-4">
               <div className="flex justify-between items-center">
                <span className="font-black text-zinc-300">#VT-{job.id}</span>
                <span className={getStatusClass(job.status)}>{job.status}</span>
              </div>
              <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                <Link href={`/clients/${job.client_id}`} className="text-xl font-black text-blue-600 no-underline block mb-1 hover:underline italic uppercase">
                  {job.clients?.name}
                </Link>
                <div className="text-zinc-500 font-bold text-sm flex items-center gap-2 italic">
                   <Phone size={14} /> {job.clients?.mobile}
                </div>
              </div>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Smartphone size={20}/></div>
                    <div>
                        <div className="font-black text-zinc-800 tracking-tight leading-none uppercase text-sm italic">{job.item_name}</div>
                        <p className="text-xs text-red-500 font-bold mt-1 mb-0 italic uppercase">"{job.problem}"</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-lg font-black text-emerald-600 flex items-center italic">
                        <IndianRupee size={16} strokeWidth={3} /> {job.final_bill || 0}
                    </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-zinc-100">
                <Link href={`/jobs/${job.id}/view`} className="flex flex-col items-center gap-1 p-3 bg-zinc-50 rounded-2xl no-underline text-zinc-600">
                  <Eye size={20} /> <span className="text-[10px] font-black uppercase tracking-tighter">View</span>
                </Link>
                <Link href={`/jobs/${job.id}`} className="flex flex-col items-center gap-1 p-3 bg-blue-50 rounded-2xl no-underline text-blue-600">
                  <Settings size={20} /> <span className="text-[10px] font-black uppercase tracking-tighter">Edit</span>
                </Link>
                <button onClick={() => handleDelete(job.id)} className="flex flex-col items-center gap-1 p-3 bg-red-50 rounded-2xl text-red-500 border-none cursor-pointer">
                  <Trash2 size={20} /> <span className="text-[10px] font-black uppercase tracking-tighter">Del</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* PC TABLE */
        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-zinc-100 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-zinc-900 text-white">
                <th className="px-6 py-6 text-left text-xs font-black uppercase tracking-widest text-zinc-400 italic">ID</th>
                <th className="px-6 py-6 text-left text-xs font-black uppercase tracking-widest text-zinc-400 italic">Client Name</th>
                <th className="px-6 py-6 text-left text-xs font-black uppercase tracking-widest text-zinc-400 italic">Device / Problem</th>
                <th className="px-6 py-6 text-left text-xs font-black uppercase tracking-widest text-zinc-400 italic">Status</th>
                <th className="px-6 py-6 text-left text-xs font-black uppercase tracking-widest text-zinc-400 italic">Bill</th>
                <th className="px-6 py-6 text-center text-xs font-black uppercase tracking-widest text-zinc-400 italic">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredJobs.map(job => (
                <tr key={job.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-6 font-black text-zinc-300">#VT-{job.id}</td>
                  <td className="px-6 py-6">
                    <Link href={`/clients/${job.client_id}`} className="font-black text-zinc-900 no-underline hover:text-blue-600 text-md block italic uppercase">
                      {job.clients?.name}
                    </Link>
                    <span className="text-xs font-bold text-zinc-400 tracking-tighter">{job.clients?.mobile}</span>
                  </td>
                  <td className="px-6 py-6">
                    <div className="font-black text-zinc-700 uppercase text-xs truncate max-w-[150px] italic">{job.item_name}</div>
                    <div className="text-[10px] text-red-500 font-bold italic truncate max-w-[150px] uppercase">"{job.problem}"</div>
                  </td>
                  <td className="px-6 py-6">
                    <span className={getStatusClass(job.status)}>{job.status}</span>
                  </td>
                  <td className="px-6 py-6 font-black text-emerald-600 italic tracking-tighter">
                    ₹{job.final_bill || 0}
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center justify-center gap-2">
                      <Link href={`/jobs/${job.id}/view`} className="p-2.5 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm"><Eye size={18} /></Link>
                      <Link href={`/jobs/${job.id}`} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"><Settings size={18} /></Link>
                      <button onClick={() => handleDelete(job.id)} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border-none cursor-pointer shadow-sm"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Status Helper ---
const getStatusClass = (status: string) => {
  const base = "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border-2 whitespace-nowrap italic";
  if (status === 'Pending') return `${base} bg-amber-50 text-amber-600 border-amber-200`;
  if (status === 'Delivered') return `${base} bg-emerald-50 text-emerald-600 border-emerald-200`;
  if (status === 'In-Progress') return `${base} bg-blue-50 text-blue-600 border-blue-200`;
  return `${base} bg-zinc-50 text-zinc-500 border-zinc-200`;
};

// --- Default Export with Suspense ---
export default function JobsPage() {
  return (
    <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="animate-spin text-blue-600" size={40} />
            <p className="text-zinc-500 font-black italic uppercase">Loading Registry...</p>
        </div>
    }>
      <JobsListContent />
    </Suspense>
  );
}