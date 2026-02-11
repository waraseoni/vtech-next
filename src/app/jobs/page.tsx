"use client";
import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Eye, Settings, Wrench, Search, Loader2, Trash2, Smartphone, Phone, IndianRupee } from 'lucide-react';

// --- Main Content Component ---
function JobsListContent() {
  const searchParams = useSearchParams();
  const globalSearch = searchParams.get('search') || "";
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [localSearch, setLocalSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkSize = () => setIsMobile(window.innerWidth < 1024);
    checkSize();
    
    async function fetchJobs() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('jobs')
          .select('id, client_id, item_name, problem, status, final_bill, clients(name, mobile)') 
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setJobs(data || []);
      } catch (err) {
        console.error("Error fetching jobs:", err);
      } finally {
        setLoading(false);
      }
    }

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
      j.id?.toString().includes(s) ||
      j.item_name?.toLowerCase().includes(s)
    );
  });

  // Hydration error se bachne ke liye
  if (!mounted) return null;

  // Loader screen
  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4 bg-zinc-950">
      <Loader2 className="animate-spin text-blue-500" size={50} />
      <p className="text-zinc-500 font-black italic uppercase tracking-widest animate-pulse">
        V-TECH: Accessing Database...
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-800 shadow-2xl">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/20">
              <Wrench className="text-white" size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white tracking-tighter m-0 uppercase italic leading-none">Job Registry</h2>
              <p className="text-blue-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Active Repair Cards: {filteredJobs.length}</p>
            </div>
          </div>
          <Link href="/jobs/new" className="bg-white text-zinc-950 hover:bg-blue-500 hover:text-white px-10 py-5 rounded-[2rem] font-black flex items-center justify-center gap-2 transition-all active:scale-95 no-underline uppercase italic tracking-tighter shadow-xl">
            <Plus size={22} strokeWidth={4} /> Create New Job
          </Link>
        </div>

        {/* SEARCH BOX */}
        <div className="relative group">
          <Search size={24} className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-blue-500 transition-colors" />
          <input 
            placeholder="Search by ID, Client or Device..." 
            value={localSearch}
            className="w-full pl-16 pr-8 py-6 bg-zinc-900 border-2 border-zinc-800 rounded-[2rem] outline-none focus:border-blue-600 transition-all shadow-2xl text-white font-bold text-xl placeholder:text-zinc-700"
            onChange={(e) => setLocalSearch(e.target.value)} 
          />
        </div>

        {/* LIST SECTION */}
        {filteredJobs.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900/50 rounded-[3rem] border border-dashed border-zinc-800">
            <p className="text-zinc-600 font-black italic uppercase tracking-widest">No Jobs Found Matching Your Search</p>
          </div>
        ) : isMobile ? (
          <div className="grid gap-4">
            {filteredJobs.map(job => (
              <div key={job.id} className="bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-800 shadow-xl space-y-4">
                 <div className="flex justify-between items-center">
                  <span className="font-black text-zinc-700 tracking-tighter">#VT-{job.id}</span>
                  <span className={getStatusClass(job.status)}>{job.status}</span>
                </div>
                <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800">
                  <Link href={`/clients/${job.client_id}`} className="text-xl font-black text-white no-underline block mb-1 hover:text-blue-400 italic uppercase transition-colors">
                    {job.clients?.name || "Unknown Client"}
                  </Link>
                  <div className="text-zinc-500 font-bold text-sm flex items-center gap-2 italic tracking-widest">
                     <Phone size={14} className="text-blue-500" /> {job.clients?.mobile}
                  </div>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><Smartphone size={20}/></div>
                      <div>
                          <div className="font-black text-zinc-300 tracking-tight leading-none uppercase text-sm italic">{job.item_name}</div>
                          <p className="text-[10px] text-red-500 font-black mt-2 mb-0 italic uppercase tracking-tight">Fault: {job.problem}</p>
                      </div>
                  </div>
                  <div className="text-right shrink-0">
                      <div className="text-xl font-black text-emerald-500 flex items-center italic tracking-tighter">
                          ₹{job.final_bill || 0}
                      </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-4">
                  <Link href={`/jobs/${job.id}/view`} className="flex flex-col items-center gap-1 p-4 bg-zinc-800 rounded-2xl no-underline text-zinc-400 hover:bg-zinc-700 transition-all">
                    <Eye size={20} /> <span className="text-[9px] font-black uppercase">View</span>
                  </Link>
                  <Link href={`/jobs/${job.id}`} className="flex flex-col items-center gap-1 p-4 bg-blue-600/10 rounded-2xl no-underline text-blue-500 hover:bg-blue-600 hover:text-white transition-all">
                    <Settings size={20} /> <span className="text-[9px] font-black uppercase">Edit</span>
                  </Link>
                  <button onClick={() => handleDelete(job.id)} className="flex flex-col items-center gap-1 p-4 bg-red-950/30 rounded-2xl text-red-500 border-none cursor-pointer hover:bg-red-600 hover:text-white transition-all">
                    <Trash2 size={20} /> <span className="text-[9px] font-black uppercase">Del</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-[3rem] shadow-2xl border border-zinc-800 overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-zinc-950 text-zinc-500 border-b border-zinc-800">
                  <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] italic">Ticket</th>
                  <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] italic">Customer Details</th>
                  <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] italic">Device / Issue</th>
                  <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] italic">Status</th>
                  <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] italic">Total Bill</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-[0.2em] italic">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredJobs.map(job => (
                  <tr key={job.id} className="hover:bg-zinc-800/30 transition-colors group">
                    <td className="px-8 py-6 font-black text-zinc-700 group-hover:text-blue-500 transition-colors">#VT-{job.id}</td>
                    <td className="px-8 py-6">
                      <Link href={`/clients/${job.client_id}`} className="font-black text-white no-underline hover:text-blue-400 text-lg block italic uppercase transition-all">
                        {job.clients?.name || "N/A"}
                      </Link>
                      <span className="text-[11px] font-bold text-zinc-600 tracking-widest">{job.clients?.mobile}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-black text-zinc-300 uppercase text-xs italic">{job.item_name}</div>
                      <div className="text-[10px] text-red-500 font-bold italic uppercase tracking-tighter mt-1">Fault: {job.problem}</div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={getStatusClass(job.status)}>{job.status}</span>
                    </td>
                    <td className="px-8 py-6 font-black text-emerald-500 italic tracking-tighter text-lg">
                      ₹{job.final_bill || 0}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center gap-3">
                        <Link href={`/jobs/${job.id}/view`} className="p-3 bg-zinc-800 text-zinc-400 rounded-xl hover:bg-white hover:text-zinc-950 transition-all"><Eye size={18} /></Link>
                        <Link href={`/jobs/${job.id}`} className="p-3 bg-zinc-800 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Settings size={18} /></Link>
                        <button onClick={() => handleDelete(job.id)} className="p-3 bg-zinc-800 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all border-none cursor-pointer"><Trash2 size={18} /></button>
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

// --- Status Styling Helper ---
const getStatusClass = (status: string) => {
  const base = "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border whitespace-nowrap italic";
  if (status === 'Pending') return `${base} bg-amber-500/10 text-amber-500 border-amber-500/20`;
  if (status === 'Delivered') return `${base} bg-emerald-500/10 text-emerald-500 border-emerald-500/20`;
  if (status === 'In-Progress') return `${base} bg-blue-500/10 text-blue-500 border-blue-500/20`;
  if (status === 'Repaired') return `${base} bg-purple-500/10 text-purple-500 border-purple-500/20`;
  return `${base} bg-zinc-800 text-zinc-500 border-zinc-700`;
};

// --- Boundary Wrapper ---
export default function JobsPage() {
  return (
    <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 gap-4">
            <Loader2 className="animate-spin text-blue-600" size={50} />
            <p className="text-zinc-600 font-black italic uppercase tracking-[0.3em]">System Booting...</p>
        </div>
    }>
      <JobsListContent />
    </Suspense>
  );
}