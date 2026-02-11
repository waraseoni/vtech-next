"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
  Wrench, 
  Clock, 
  CheckCircle, 
  IndianRupee, 
  TrendingUp, 
  Users, 
  ArrowRight,
  AlertCircle,
  Zap,
  Sparkles
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalJobs: 0,
    pendingJobs: 0,
    completedJobs: 0,
    todayEarnings: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: allJobs } = await supabase.from('jobs').select('*');
      
      if (allJobs) {
        const pending = allJobs.filter(j => j.status === 'Pending' || j.status === 'In-Progress').length;
        const completed = allJobs.filter(j => j.status === 'Repaired' || j.status === 'Delivered').length;
        
        const earnings = allJobs
          .filter(j => new Date(j.created_at) >= today)
          .reduce((sum, j) => sum + (j.final_bill || 0), 0);

        setStats({
          totalJobs: allJobs.length,
          pendingJobs: pending,
          completedJobs: completed,
          todayEarnings: earnings
        });
      }
      setLoading(false);
    };

    fetchStats();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      
      {/* --- HEADER SECTION --- */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 flex items-center gap-2 italic">
            V-TECH <span className="text-blue-600 not-italic">COMMAND</span>
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Swaagat hai, Vikram ji! Aaj ka kaam shuru karein.</p>
        </div>
        <Link 
          href="/jobs/new" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Zap size={18} fill="currentColor" /> Quick Job Entry
        </Link>
      </header>

      {/* --- STATS GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Total Jobs" 
          value={stats.totalJobs} 
          icon={<Wrench className="text-blue-600" />} 
          color="blue" 
        />
        <StatCard 
          label="Pending Repairs" 
          value={stats.pendingJobs} 
          icon={<Clock className="text-amber-500" />} 
          color="amber" 
        />
        <StatCard 
          label="Completed" 
          value={stats.completedJobs} 
          icon={<CheckCircle className="text-emerald-500" />} 
          color="emerald" 
        />
        <StatCard 
          label="Today's Billing" 
          value={`₹${stats.todayEarnings}`} 
          icon={<IndianRupee className="text-violet-600" />} 
          color="violet" 
        />
      </div>

      {/* --- QUICK ACTIONS & TIPS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Quick Links Card */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-xl shadow-zinc-200/50 border border-zinc-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black tracking-tight flex items-center gap-2 uppercase text-sm">
              <TrendingUp className="text-blue-600" size={20} /> Essential Operations
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ActionLink href="/jobs" icon={<Wrench size={24}/>} label="View Jobs" sub="Manage all repairs" color="zinc" />
            <ActionLink href="/clients" icon={<Users size={24}/>} label="Customers" sub="List of all clients" color="zinc" />
            <ActionLink href="/inventory" icon={<AlertCircle size={24}/>} label="Inventory" sub="Check spare parts" color="zinc" />
          </div>
        </div>

        {/* Pro Tip Card */}
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-8 rounded-[2.5rem] text-white shadow-xl shadow-orange-200 relative overflow-hidden group">
          <Sparkles className="absolute -right-4 -top-4 text-white/20 rotate-12 group-hover:scale-150 transition-transform duration-700" size={120} />
          <div className="relative z-10">
            <h4 className="text-lg font-black uppercase tracking-widest mb-4 flex items-center gap-2">
               Shop Secret
            </h4>
            <p className="text-amber-50 font-medium leading-relaxed italic">
              "Repaired" status set karne se pehle ensure karein ki saare parts list mein add ho gaye hain taaki bill sahi bane.
            </p>
            <div className="mt-8 pt-6 border-t border-white/20 flex items-center justify-between">
              <span className="text-xs font-bold uppercase">Pro Tip v2</span>
              <div className="h-2 w-2 bg-white rounded-full animate-ping"></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// --- Internal Helper Components ---

function StatCard({ label, value, icon, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 border-blue-100 shadow-blue-100/50",
    amber: "bg-amber-50 border-amber-100 shadow-amber-100/50",
    emerald: "bg-emerald-50 border-emerald-100 shadow-emerald-100/50",
    violet: "bg-violet-50 border-violet-100 shadow-violet-100/50",
  };

  return (
    <div className={`p-6 bg-white rounded-3xl border border-zinc-100 shadow-xl shadow-zinc-200/30 flex items-center gap-5 transition-transform hover:-translate-y-1 duration-300`}>
      <div className={`p-4 rounded-2xl ${colors[color]} border shadow-inner`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">{label}</p>
        <h2 className="text-3xl font-black text-zinc-900 tracking-tight">{value}</h2>
      </div>
    </div>
  );
}

function ActionLink({ href, icon, label, sub, color }: any) {
  return (
    <Link href={href} className="group p-6 bg-zinc-50 border border-transparent hover:border-blue-200 hover:bg-blue-50/50 rounded-3xl transition-all duration-300 no-underline">
      <div className="text-zinc-400 group-hover:text-blue-600 transition-colors mb-4">{icon}</div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-black text-zinc-800 uppercase text-xs tracking-wider">{label}</span>
        <ArrowRight size={14} className="text-zinc-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
      </div>
      <p className="text-[10px] text-zinc-400 mt-1 font-bold">{sub}</p>
    </Link>
  );
}