"use client";
import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Package, Tag, Layers, DollarSign, 
  AlertTriangle, Smartphone, Calendar, Loader2, Eye
} from 'lucide-react';

type InventoryItem = {
  id: number;
  partname: string;
  category: string;
  stock: number;
  price: number;
  minstock: number;
  created_at?: string;
};

type Job = {
  id: number;
  item_name: string;
  status: string;
  final_bill: number;
  created_at: string;
  problem?: string;
  client_id: number;
  clients?: {
    name: string;
    mobile: string;
  };
};

export default function ViewInventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [part, setPart] = useState<InventoryItem | null>(null);
  const [usageJobs, setUsageJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // 1. Fetch part details
        const { data: partData, error: partError } = await supabase
          .from('inventory')
          .select('*')
          .eq('id', resolvedParams.id)
          .single();

        if (partError) throw partError;
        setPart(partData);

        // 2. Fetch all jobs that have used this part
        // used_parts is a comma-separated string; we need to find jobs where used_parts contains this partname
        if (partData?.partname) {
          const { data: jobsData, error: jobsError } = await supabase
            .from('jobs')
            .select('*, clients(name, mobile)')
            .ilike('used_parts', `%${partData.partname}%`)
            .order('created_at', { ascending: false });

          if (jobsError) throw jobsError;
          setUsageJobs(jobsData || []);
        }
      } catch (err) {
        console.error("Error fetching part details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [resolvedParams.id]);

  // Status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'In-Progress': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Repaired': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Cancelled': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 bg-white">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-gray-500 font-bold italic uppercase tracking-[0.25em] text-sm">
          Loading Part Details...
        </p>
      </div>
    );
  }

  // Not found
  if (!part) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 bg-white">
        <h2 className="text-2xl font-black text-gray-900">Part Not Found!</h2>
        <Link href="/inventory" className="text-blue-600 font-bold underline">
          ← Back to Inventory
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ===== HEADER CARD ===== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50 p-6 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-4">
            <Link 
              href="/inventory"
              className="p-2.5 bg-white border-2 border-gray-300 rounded-xl text-gray-600 hover:bg-gray-100 transition-all"
            >
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                <Package className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase leading-none">
                  Part Details
                </h2>
                <p className="text-[10px] text-gray-600 font-extrabold uppercase tracking-[0.2em] mt-1">
                  ID: #P-{part.id}
                </p>
              </div>
            </div>
          </div>
          <Link 
            href={`/inventory/${part.id}/edit`}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 rounded-xl font-extrabold text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all uppercase tracking-wide text-sm"
          >
            Edit Part
          </Link>
        </div>

        {/* ===== MAIN GRID ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* ----- LEFT COLUMN: PART DETAILS ----- */}
          <div className="lg:col-span-4">
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md h-fit">
              
              {/* Part Name & Stock Status */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-extrabold text-gray-900 uppercase tracking-tight">
                    {part.partname}
                  </h3>
                  <span className="inline-block mt-2 px-3 py-1.5 bg-gray-100 border-2 border-gray-200 rounded-full text-[10px] font-extrabold text-gray-700 uppercase">
                    {part.category}
                  </span>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border-2 ${
                  part.stock <= part.minstock
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {part.stock <= part.minstock ? (
                    <span className="flex items-center gap-1">
                      <AlertTriangle size={12} /> LOW
                    </span>
                  ) : 'OK'}
                </span>
              </div>

              <hr className="my-6 border-t-2 border-gray-200" />

              {/* Stock & Price Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                  <div className="p-2.5 bg-blue-100 rounded-lg text-blue-700">
                    <Package size={20} />
                  </div>
                  <div>
                    <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider">
                      Current Stock
                    </p>
                    <p className="font-extrabold text-gray-900 text-2xl">
                      {part.stock}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                  <div className="p-2.5 bg-emerald-100 rounded-lg text-emerald-700">
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider">
                      Unit Price
                    </p>
                    <p className="font-extrabold text-emerald-700 text-2xl">
                      ₹{part.price}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                  <div className="p-2.5 bg-amber-100 rounded-lg text-amber-700">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider">
                      Minimum Stock Alert
                    </p>
                    <p className="font-extrabold text-gray-900 text-xl">
                      {part.minstock}
                    </p>
                  </div>
                </div>
              </div>

              {/* Created At */}
              {part.created_at && (
                <div className="mt-6 pt-4 border-t-2 border-gray-200">
                  <p className="text-[9px] font-extrabold uppercase text-gray-500 tracking-wider">
                    Added on
                  </p>
                  <p className="font-bold text-gray-700">
                    {formatDate(part.created_at)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ----- RIGHT COLUMN: USAGE HISTORY ----- */}
          <div className="lg:col-span-8">
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
              <div className="flex items-center gap-2 mb-6">
                <Smartphone size={22} className="text-blue-600" />
                <h3 className="text-[13px] font-extrabold uppercase text-gray-700 tracking-[0.15em]">
                  Parts Used In Repair Jobs
                </h3>
                <span className="ml-auto px-3 py-1.5 bg-gray-100 border-2 border-gray-300 rounded-full text-[10px] font-extrabold text-gray-700">
                  Used in {usageJobs.length} job{usageJobs.length !== 1 ? 's' : ''}
                </span>
              </div>

              {usageJobs.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-400">
                  <Smartphone size={32} className="mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600 font-bold italic uppercase tracking-wider text-sm">
                    This part has not been used in any repair yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {usageJobs.map(job => (
                    <div 
                      key={job.id} 
                      className="group p-4 bg-gray-50 hover:bg-white border-2 border-gray-200 hover:border-blue-200 rounded-xl transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Left: Job Info */}
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 bg-blue-100 rounded-lg text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Smartphone size={20} />
                          </div>
                          <div>
                            <div className="font-extrabold text-gray-900 text-base uppercase tracking-tight">
                              {job.item_name || 'Unknown Device'}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600 font-bold mt-1">
                              <Calendar size={12} className="text-gray-500" />
                              <span>{formatDate(job.created_at)}</span>
                              <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                              <span className="font-mono">#VT-{job.id}</span>
                            </div>
                            {job.clients && (
                              <div className="text-xs text-gray-700 font-bold mt-1.5">
                                Client: {job.clients.name} | {job.clients.mobile}
                              </div>
                            )}
                            {job.problem && (
                              <p className="text-[10px] text-red-600 font-bold italic uppercase tracking-tight mt-1.5">
                                Fault: {job.problem}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right: Status & Amount */}
                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 sm:gap-1">
                          <span className={`px-3 py-1.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border-2 ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                          <div className="font-extrabold italic text-gray-900 text-lg">
                            ₹{job.final_bill || 0}
                          </div>
                        </div>
                      </div>

                      {/* Quick View Link */}
                      <div className="mt-3 pt-2 border-t border-gray-200 flex justify-end">
                        <Link 
                          href={`/jobs/${job.id}/view`}
                          className="text-[10px] font-extrabold uppercase text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                        >
                          View Job Details
                          <Eye size={12} className="ml-1" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}