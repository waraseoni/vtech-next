"use client";
import { useState, useEffect, Suspense, useMemo, useCallback, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Plus, Eye, Settings, Wrench, Search, 
  Loader2, Trash2, Smartphone, Phone 
} from 'lucide-react';

// --- Status Styling Helper (Memoized function se koi fark nahi, static hai) ---
const getStatusClass = (status: string) => {
  const base = "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border whitespace-nowrap italic";
  if (status === 'Pending') return `${base} bg-amber-50 text-amber-700 border-amber-200`;
  if (status === 'Delivered') return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
  if (status === 'In-Progress') return `${base} bg-blue-50 text-blue-700 border-blue-200`;
  if (status === 'Repaired') return `${base} bg-purple-50 text-purple-700 border-purple-200`;
  return `${base} bg-gray-100 text-gray-600 border-gray-300`;
};

// --- Main Content Component ---
function JobsListContent() {
  const searchParams = useSearchParams();
  const globalSearch = searchParams.get('search') || "";
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [localSearch, setLocalSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 🔹 Debounced search value – 300ms ke bad update hota hai
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(localSearch), 300);
    return () => clearTimeout(timer);
  }, [localSearch]);

  // 🔹 Mobile detection – matchMedia se efficient event listener
  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    
    handler(mediaQuery); // initial check
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // 🔹 fetchJobs memoized – sirf tab change hoga jab koi dependency change ho
  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('jobs')
        .select('id, client_id, item_name, problem, status, final_bill, clients(name, mobile)')
        .order('created_at', { ascending: false })
        .limit(50); // ⚡ Performance boost: sirf 50 latest records

      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error("Error fetching jobs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // 🔹 Delete handler memoized
  const handleDelete = useCallback(async (id: number) => {
    if (confirm("Kya aap pakka delete karna chahte hain?")) {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (!error) setJobs(prev => prev.filter(job => job.id !== id));
    }
  }, []);

  // 🔹 Filtered jobs – memoized, tabhi re-calculate hoga jab jobs ya search value change ho
  const filteredJobs = useMemo(() => {
    const s = (globalSearch || debouncedSearch).toLowerCase();
    return jobs.filter(j => 
      j.clients?.name?.toLowerCase().includes(s) || 
      j.clients?.mobile?.includes(s) ||
      j.id?.toString().includes(s) ||
      j.item_name?.toLowerCase().includes(s)
    );
  }, [jobs, globalSearch, debouncedSearch]);

  // Hydration error se bachne ke liye
  if (!mounted) return null;

  // Loader screen
  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4 bg-white">
      <Loader2 className="animate-spin text-blue-600" size={50} />
      <p className="text-gray-500 font-black italic uppercase tracking-widest animate-pulse">
        V-TECH: Accessing Database...
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER (unchanged) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50 p-8 rounded-[2.5rem] border border-gray-200 shadow-xl">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <Wrench className="text-white" size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tighter m-0 uppercase italic leading-none">Job Registry</h2>
              <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
                Active Repair Cards: {filteredJobs.length}
              </p>
            </div>
          </div>
          <Link 
            href="/jobs/new" 
            className="bg-gray-900 text-white hover:bg-blue-600 hover:text-white px-10 py-5 rounded-[2rem] font-black flex items-center justify-center gap-2 transition-all active:scale-95 no-underline uppercase italic tracking-tighter shadow-md"
          >
            <Plus size={22} strokeWidth={4} /> Create New Job
          </Link>
        </div>

        {/* SEARCH BOX – ab value localSearch se bind hai, debounce background me */}
        <div className="relative group">
          <Search size={24} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
          <input 
            placeholder="Search by ID, Client or Device..." 
            value={localSearch}
            className="w-full pl-16 pr-8 py-6 bg-gray-50 border-2 border-gray-200 rounded-[2rem] outline-none focus:border-blue-600 transition-all shadow-md text-gray-900 font-bold text-xl placeholder:text-gray-400"
            onChange={(e) => setLocalSearch(e.target.value)} 
          />
        </div>

        {/* LIST SECTION – same structure, but filteredJobs memoized */}
        {filteredJobs.length === 0 ? (
          <div className="text-center py-20 bg-gray-50/80 rounded-[3rem] border border-dashed border-gray-300">
            <p className="text-gray-500 font-black italic uppercase tracking-widest">No Jobs Found Matching Your Search</p>
          </div>
        ) : isMobile ? (
          <div className="grid gap-4">
            {filteredJobs.map(job => (
              <div key={job.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-200 shadow-lg space-y-4">
                {/* Mobile card content - unchanged */}
                <div className="flex justify-between items-center">
                  <span className="font-black text-gray-500 tracking-tighter">#VT-{job.id}</span>
                  <span className={getStatusClass(job.status)}>{job.status}</span>
                </div>
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                  <Link href={`/clients/${job.client_id}`} className="text-xl font-black text-gray-900 no-underline block mb-1 hover:text-blue-600 italic uppercase transition-colors">
                    {job.clients?.name || "Unknown Client"}
                  </Link>
                  <div className="text-gray-600 font-bold text-sm flex items-center gap-2 italic tracking-widest">
                     <Phone size={14} className="text-blue-600" /> {job.clients?.mobile}
                  </div>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg text-blue-700"><Smartphone size={20}/></div>
                      <div>
                          <div className="font-black text-gray-800 tracking-tight leading-none uppercase text-sm italic">{job.item_name}</div>
                          <p className="text-[10px] text-red-600 font-black mt-2 mb-0 italic uppercase tracking-tight">Fault: {job.problem}</p>
                      </div>
                  </div>
                  <div className="text-right shrink-0">
                      <div className="text-xl font-black text-emerald-700 flex items-center italic tracking-tighter">
                          ₹{job.final_bill || 0}
                      </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-4">
                  <Link href={`/jobs/${job.id}/view`} className="flex flex-col items-center gap-1 p-4 bg-gray-100 rounded-2xl no-underline text-gray-700 hover:bg-gray-200 transition-all">
                    <Eye size={20} /> <span className="text-[9px] font-black uppercase">View</span>
                  </Link>
                  <Link href={`/jobs/${job.id}`} className="flex flex-col items-center gap-1 p-4 bg-blue-50 rounded-2xl no-underline text-blue-700 hover:bg-blue-600 hover:text-white transition-all">
                    <Settings size={20} /> <span className="text-[9px] font-black uppercase">Edit</span>
                  </Link>
                  <button 
                    onClick={() => handleDelete(job.id)} 
                    className="flex flex-col items-center gap-1 p-4 bg-red-50 rounded-2xl text-red-700 border-none cursor-pointer hover:bg-red-600 hover:text-white transition-all"
                  >
                    <Trash2 size={20} /> <span className="text-[9px] font-black uppercase">Del</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop table - unchanged */
          <div className="bg-white rounded-[3rem] shadow-lg border border-gray-200 overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 border-b border-gray-200">
                  <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] italic">Ticket</th>
                  <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] italic">Customer Details</th>
                  <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] italic">Device / Issue</th>
                  <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] italic">Status</th>
                  <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] italic">Total Bill</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-[0.2em] italic">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredJobs.map(job => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-8 py-6 font-black text-gray-500 group-hover:text-blue-600 transition-colors">#VT-{job.id}</td>
                    <td className="px-8 py-6">
                      <Link href={`/clients/${job.client_id}`} className="font-black text-gray-900 no-underline hover:text-blue-600 text-lg block italic uppercase transition-all">
                        {job.clients?.name || "N/A"}
                      </Link>
                      <span className="text-[11px] font-bold text-gray-500 tracking-widest">{job.clients?.mobile}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-black text-gray-800 uppercase text-xs italic">{job.item_name}</div>
                      <div className="text-[10px] text-red-600 font-bold italic uppercase tracking-tighter mt-1">Fault: {job.problem}</div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={getStatusClass(job.status)}>{job.status}</span>
                    </td>
                    <td className="px-8 py-6 font-black text-emerald-700 italic tracking-tighter text-lg">
                      ₹{job.final_bill || 0}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center gap-3">
                        <Link href={`/jobs/${job.id}/view`} className="p-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all"><Eye size={18} /></Link>
                        <Link href={`/jobs/${job.id}`} className="p-3 bg-gray-100 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Settings size={18} /></Link>
                        <button 
                          onClick={() => handleDelete(job.id)} 
                          className="p-3 bg-gray-100 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all border-none cursor-pointer"
                        >
                          <Trash2 size={18} />
                        </button>
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

// --- Boundary Wrapper ---
export default function JobsPage() {
  return (
    <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-4">
            <Loader2 className="animate-spin text-blue-600" size={50} />
            <p className="text-gray-500 font-black italic uppercase tracking-[0.3em]">System Booting...</p>
        </div>
    }>
      <JobsListContent />
    </Suspense>
  );
}