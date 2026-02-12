"use client";
import React, { useState, useEffect, use, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Edit3, Printer, Smartphone, User, 
  CheckCircle2, Clock, MapPin, Phone, IndianRupee, 
  Loader2, Wrench, Cpu, MessageSquare, Calendar, Hash
} from 'lucide-react';

// --- Type Definitions ---
type Client = {
  id: number;
  name: string;
  mobile: string;
  address?: string;
};

type Job = {
  id: number;
  client_id: number;
  item_name: string;
  serial_no?: string;
  problem?: string;
  status: string;
  final_bill?: number;
  remarks?: string;
  used_parts?: string;
  created_at?: string;
  updated_at?: string;
  clients?: Client;
};

type InventoryItem = {
  id: number;
  partname: string;
  price: number;
};

type UsedPart = {
  name: string;
  price: number | null;
};

export default function ViewJobPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const fetchJob = async () => {
    try {
      setLoading(true);
      const [jobRes, invRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('*, clients(*)')
          .eq('id', resolvedParams.id)
          .single(),
        supabase.from('inventory').select('id, partname, price')
      ]);

      if (jobRes.error) throw jobRes.error;
      setJob(jobRes.data as Job);
      
      if (invRes.data) {
        setInventory(invRes.data as InventoryItem[]);
      }
    } catch (err) {
      console.error("Error fetching job:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [resolvedParams.id]);

  const usedPartsWithPrices = useMemo((): UsedPart[] => {
    if (!job?.used_parts) return [];
    const partNames = job.used_parts.split(', ').filter((p: string) => p.trim() !== '');
    return partNames.map((name: string) => {
      const found = inventory.find(item => item.partname === name);
      return {
        name,
        price: found ? found.price : null
      };
    });
  }, [job?.used_parts, inventory]);

  const handleStatusChange = async (newStatus: string) => {
    if (!job?.id) return;
    setUpdating(true);
    const { error } = await supabase
      .from('jobs')
      .update({ status: newStatus })
      .eq('id', job.id);

    if (error) {
      alert("Status update nahi ho paya!");
    } else {
      await fetchJob();
    }
    setUpdating(false);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-600" size={48} />
      <p className="text-gray-500 font-black italic uppercase tracking-widest animate-pulse">
        Loading Job Details...
      </p>
    </div>
  );

  if (!job) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-black text-gray-900">Job Not Found!</h2>
      <Link href="/jobs" className="text-blue-600 font-bold underline">
        ← Back to Jobs
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-gray-900 p-3 md:p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-gray-50 p-4 rounded-3xl border-2 border-gray-300 shadow-sm">
          <div className="flex items-center gap-3">
            <Link 
              href="/jobs" 
              className="p-2 bg-white hover:bg-gray-100 rounded-xl text-gray-600 border-2 border-gray-300 transition-all"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">
                Job Ticket
              </p>
              <h1 className="text-lg font-black uppercase italic text-gray-900 m-0 leading-none">
                #VT-{job.id}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-gray-300 hover:bg-gray-100 rounded-xl font-black text-sm uppercase italic tracking-wider transition-all"
            >
              <Printer size={16} /> Print
            </button>
            <Link 
              href={`/jobs/${job.id}/edit`}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm uppercase italic tracking-wider transition-all shadow-md shadow-blue-500/20"
            >
              <Edit3 size={16} /> Edit
            </Link>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Device Card */}
            <div className="bg-white border-2 border-gray-300 p-6 rounded-[2rem] shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Smartphone size={18} className="text-blue-600" />
                <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest italic">
                  Device Specifications
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-1">Device Model</label>
                  <div className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-bold text-gray-900 text-sm uppercase">
                    {job.item_name || '—'}
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-1">Serial Number</label>
                  <div className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-mono text-gray-900 text-sm">
                    {job.serial_no || '—'}
                  </div>
                </div>
                
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-red-600 ml-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full" /> Detected Fault
                  </label>
                  <div className="w-full p-3 bg-red-50 border-2 border-red-200 rounded-xl font-bold text-red-800 text-sm italic">
                    {job.problem || 'No description provided.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Remarks Card */}
            <div className="bg-white border-2 border-gray-300 p-6 rounded-[2rem] shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare size={18} className="text-amber-600" />
                <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest italic">
                  Internal Remarks / Notes
                </h3>
              </div>
              <div className="w-full p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl font-bold text-amber-800 text-sm italic min-h-[80px]">
                {job.remarks || 'No remarks added.'}
              </div>
            </div>

            {/* Created/Updated Info */}
            <div className="bg-white border-2 border-gray-300 p-4 rounded-2xl shadow-sm flex flex-wrap gap-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400" />
                <span>Created: {formatDate(job.created_at)}</span>
              </div>
              {job.updated_at && job.updated_at !== job.created_at && (
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-gray-400" />
                  <span>Updated: {formatDate(job.updated_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* Client Card */}
            <div className="bg-white border-2 border-gray-300 p-6 rounded-[2rem] shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <User size={18} className="text-blue-600" />
                <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest italic">
                  Customer Information
                </h3>
              </div>
              
              <div className="bg-gray-50 p-5 rounded-2xl border-2 border-gray-200 space-y-3">
                <p className="text-xl font-black text-gray-900 uppercase italic">
                  {job.clients?.name || 'Unknown Client'}
                </p>
                <div className="flex items-center gap-2 text-gray-700 font-bold text-sm">
                  <Phone size={14} className="text-blue-600" />
                  <span>{job.clients?.mobile || '—'}</span>
                </div>
                <div className="flex items-start gap-2 text-gray-700 font-bold text-sm">
                  <MapPin size={14} className="text-blue-600 mt-0.5" />
                  <span className="flex-1">{job.clients?.address || '—'}</span>
                </div>
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-white border-2 border-gray-300 p-6 rounded-[2rem] shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-gray-500" />
                  <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest italic">
                    Current Status
                  </h3>
                </div>
                {updating ? (
                  <Loader2 className="animate-spin text-blue-600" size={18} />
                ) : (
                  <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 ${getStatusClass(job.status)}`}>
                    {job.status}
                  </span>
                )}
              </div>
              
              <label className="text-[9px] font-black uppercase text-gray-500 ml-1 mb-1 block">
                Update Status
              </label>
              <select
                value={job.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updating}
                className="w-full p-3 bg-white border-2 border-gray-300 rounded-xl font-black text-gray-900 outline-none italic text-sm appearance-none cursor-pointer focus:border-blue-500 disabled:bg-gray-100"
              >
                <option value="Pending">⚠️ Pending</option>
                <option value="In-Progress">⚙️ In-Progress</option>
                <option value="Repaired">🛠️ Repaired</option>
                <option value="Delivered">✅ Delivered</option>
                <option value="Cancelled">❌ Cancelled</option>
              </select>
            </div>

            {/* Used Parts Card */}
            <div className="bg-white border-2 border-gray-300 p-6 rounded-[2rem] shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Cpu size={18} className="text-purple-600" />
                <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest italic">
                  Used Components
                </h3>
              </div>
              
              <div className="flex flex-wrap gap-2 min-h-[70px] p-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-400">
                {usedPartsWithPrices.length === 0 ? (
                  <p className="text-[9px] font-bold text-gray-400 m-auto italic uppercase">
                    No parts used
                  </p>
                ) : (
                  usedPartsWithPrices.map((part: UsedPart, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 bg-purple-50 text-purple-800 border-2 border-purple-200 px-3 py-1.5 rounded-lg"
                    >
                      <span className="text-[10px] font-black italic uppercase">{part.name}</span>
                      {part.price !== null && (
                        <span className="text-[9px] font-bold text-purple-700 ml-1">
                          ₹{part.price}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Total Bill Card */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-6 rounded-[2rem] shadow-xl border-2 border-emerald-500">
              <div className="flex items-center gap-2 mb-2">
                <IndianRupee size={22} strokeWidth={3} />
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] opacity-90">
                  Grand Total
                </h3>
              </div>
              <div className="text-4xl font-black italic tracking-tighter">
                ₹{job.final_bill || 0}
              </div>
              <p className="text-[9px] font-bold uppercase tracking-wider mt-2 opacity-75">
                Inclusive of all parts & service
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Status Badge Styles
const getStatusClass = (status: string): string => {
  switch (status) {
    case 'Pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'In-Progress':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Repaired':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Delivered':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Cancelled':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-300';
  }
};