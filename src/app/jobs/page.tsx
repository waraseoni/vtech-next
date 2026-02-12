"use client";
import { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Plus, Eye, Settings, Wrench, Search, 
  Loader2, Trash2, Smartphone, Phone 
} from 'lucide-react';

// --- Status Styling Helper (with Cancelled) ---
const getStatusClass = (status: string) => {
  const base = "px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border-2 whitespace-nowrap";
  if (status === 'Pending') return `${base} bg-amber-50 text-amber-700 border-amber-200`;
  if (status === 'Delivered') return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
  if (status === 'In-Progress') return `${base} bg-blue-50 text-blue-700 border-blue-200`;
  if (status === 'Repaired') return `${base} bg-purple-50 text-purple-700 border-purple-200`;
  if (status === 'Cancelled') return `${base} bg-red-50 text-red-700 border-red-200`;
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

  // Debounced search – 300ms
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(localSearch), 300);
    return () => clearTimeout(timer);
  }, [localSearch]);

  // Mobile detection
  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mediaQuery);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Fetch jobs
  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('jobs')
        .select('id, client_id, item_name, problem, status, final_bill, clients(name, mobile)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error("Error fetching jobs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Delete handler
  const handleDelete = useCallback(async (id: number) => {
    if (confirm("Kya aap pakka delete karna chahte hain?")) {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (!error) setJobs(prev => prev.filter(job => job.id !== id));
    }
  }, []);

  // 🔹 FILTERED JOBS – MEMOIZED, AB STATUS BHI SEARCH HOGA
  const filteredJobs = useMemo(() => {
    const s = (globalSearch || debouncedSearch).toLowerCase();
    return jobs.filter(j => 
      j.clients?.name?.toLowerCase().includes(s) || 
      j.clients?.mobile?.includes(s) ||
      j.id?.toString().includes(s) ||
      j.item_name?.toLowerCase().includes(s) ||
      // 🔥 NEW: Status bhi search criteria mein shamil
      j.status?.toLowerCase().includes(s)
    );
  }, [jobs, globalSearch, debouncedSearch]);

  // Hydration guard
  if (!mounted) return null;

  // Loader
  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4 bg-white">
      <Loader2 className="animate-spin text-blue-600" size={50} />
      <p className="text-gray-500 font-bold italic uppercase tracking-[0.3em] text-sm">
        V-TECH: Accessing Database...
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER CARD */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50 p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <Wrench className="text-white" size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tighter m-0 uppercase leading-none">
                Job Registry
              </h2>
              <p className="text-blue-600 text-[11px] font-extrabold uppercase tracking-[0.25em] mt-2">
                Active Repair Cards: {filteredJobs.length}
              </p>
            </div>
          </div>
          <Link 
            href="/jobs/new" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 rounded-[2rem] font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 no-underline uppercase tracking-tight shadow-md shadow-blue-500/20 text-sm"
          >
            <Plus size={20} strokeWidth={3} /> Create New Job
          </Link>
        </div>

        {/* SEARCH BOX */}
        <div className="relative group">
          <Search size={22} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
          <input 
            placeholder="Search by ID, Client, Device or Status..." 
            value={localSearch}
            className="w-full pl-16 pr-8 py-5 bg-white border-2 border-gray-300 rounded-[2rem] outline-none focus:border-blue-600 transition-all shadow-md text-gray-900 font-bold text-lg placeholder:text-gray-400 placeholder:font-medium"
            onChange={(e) => setLocalSearch(e.target.value)} 
          />
        </div>

        {/* LIST SECTION */}
        {filteredJobs.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-400 shadow-md">
            <p className="text-gray-600 font-bold italic uppercase tracking-wider text-sm">
              No Jobs Found Matching Your Search
            </p>
          </div>
        ) : isMobile ? (
          /* ----- MOBILE CARDS ----- */
          <div className="grid gap-4">
            {filteredJobs.map(job => (
              <div 
                key={job.id} 
                className="bg-white p-6 rounded-[2rem] border-2 border-gray-300 shadow-md space-y-4"
              >
                {/* Header: ID + Status */}
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-gray-500 text-sm tracking-tight">
                    #VT-{job.id}
                  </span>
                  <span className={getStatusClass(job.status)}>{job.status}</span>
                </div>
                
                {/* Client Info */}
                <div className="bg-gray-50 p-4 rounded-xl border-2 border-gray-200">
                  <Link 
                    href={`/clients/${job.client_id}`} 
                    className="text-lg font-extrabold text-gray-900 no-underline block mb-1 hover:text-blue-600 uppercase transition-colors tracking-tight"
                  >
                    {job.clients?.name || "Unknown Client"}
                  </Link>
                  <div className="text-gray-600 font-bold text-sm flex items-center gap-2 tracking-wide">
                    <Phone size={14} className="text-blue-600" /> {job.clients?.mobile}
                  </div>
                </div>

                {/* Device & Fault */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <div className="font-extrabold text-gray-800 uppercase text-sm tracking-tight">
                        {job.item_name}
                      </div>
                      <p className="text-[10px] text-red-600 font-bold mt-1 italic uppercase tracking-wide">
                        Fault: {job.problem}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-extrabold italic text-emerald-700 tracking-tight">
                      ₹{job.final_bill || 0}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <Link 
                    href={`/jobs/${job.id}/view`} 
                    className="flex flex-col items-center gap-1 p-3 bg-white border-2 border-gray-300 rounded-xl no-underline text-gray-700 hover:bg-gray-100 transition-all"
                  >
                    <Eye size={18} /> 
                    <span className="text-[10px] font-extrabold uppercase tracking-wide">View</span>
                  </Link>
                  <Link 
                    href={`/jobs/${job.id}`} 
                    className="flex flex-col items-center gap-1 p-3 bg-blue-50 border-2 border-blue-200 rounded-xl no-underline text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
                  >
                    <Settings size={18} /> 
                    <span className="text-[10px] font-extrabold uppercase tracking-wide">Edit</span>
                  </Link>
                  <button 
                    onClick={() => handleDelete(job.id)} 
                    className="flex flex-col items-center gap-1 p-3 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all cursor-pointer"
                  >
                    <Trash2 size={18} /> 
                    <span className="text-[10px] font-extrabold uppercase tracking-wide">Del</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ----- DESKTOP TABLE ----- */
          <div className="bg-white rounded-[2.5rem] shadow-md border-2 border-gray-300 overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 border-b-2 border-gray-300">
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase tracking-[0.15em]">Ticket</th>
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase tracking-[0.15em]">Customer</th>
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase tracking-[0.15em]">Device / Issue</th>
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase tracking-[0.15em]">Status</th>
                  <th className="px-6 py-5 text-left text-[11px] font-extrabold uppercase tracking-[0.15em]">Total</th>
                  <th className="px-6 py-5 text-center text-[11px] font-extrabold uppercase tracking-[0.15em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredJobs.map(job => (
                  <tr key={job.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-6 py-5">
                      <span className="font-mono font-bold text-gray-600 group-hover:text-blue-600 transition-colors text-sm">
                        #VT-{job.id}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <Link 
                        href={`/clients/${job.client_id}`} 
                        className="font-extrabold text-gray-900 no-underline hover:text-blue-600 text-base block transition-colors tracking-tight"
                      >
                        {job.clients?.name || "N/A"}
                      </Link>
                      <span className="text-xs font-bold text-gray-500 tracking-wider">
                        {job.clients?.mobile}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-extrabold text-gray-800 uppercase text-sm tracking-tight">
                        {job.item_name}
                      </div>
                      <div className="text-[10px] text-red-600 font-bold italic uppercase tracking-wide mt-1">
                        Fault: {job.problem}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={getStatusClass(job.status)}>{job.status}</span>
                    </td>
                    <td className="px-6 py-5 font-extrabold italic text-emerald-700 text-lg tracking-tight">
                      ₹{job.final_bill || 0}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <Link 
                          href={`/jobs/${job.id}/view`} 
                          className="p-2.5 bg-white border-2 border-gray-300 text-gray-600 rounded-xl hover:bg-gray-100 transition-all"
                          title="View"
                        >
                          <Eye size={18} />
                        </Link>
                        <Link 
                          href={`/jobs/${job.id}`} 
                          className="p-2.5 bg-white border-2 border-gray-300 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
                          title="Edit"
                        >
                          <Settings size={18} />
                        </Link>
                        <button 
                          onClick={() => handleDelete(job.id)} 
                          className="p-2.5 bg-white border-2 border-gray-300 text-red-600 rounded-xl hover:bg-red-600 hover:text-white hover:border-red-600 transition-all cursor-pointer"
                          title="Delete"
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
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-gray-500 font-bold italic uppercase tracking-[0.25em] text-sm">
          System Booting...
        </p>
      </div>
    }>
      <JobsListContent />
    </Suspense>
  );
}