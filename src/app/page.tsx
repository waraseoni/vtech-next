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
  Sparkles,
  Loader2
} from 'lucide-react';

type Job = {
  id: number;
  status: string;
  final_bill: number | null;
  created_at: string;
};

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalJobs: 0,
    pendingJobs: 0,
    completedJobs: 0,
    todayEarnings: 0
  });
  const [loading, setLoading] = useState(true);
  // Profile state add kiya gaya hai
  const [profile, setProfile] = useState<{full_name: string} | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // 1. User Profile Fetch Karein
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle();
          
          if (profileData) {
            setProfile(profileData);
          } else {
            const metaName = user.user_metadata?.full_name;
            setProfile({ full_name: metaName || user.email?.split('@')[0] || 'User' });
          }
        }

        // 2. Stats Fetch Karein
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: allJobs } = await supabase
          .from('jobs')
          .select('id, status, final_bill, created_at');

        if (allJobs) {
          const pending = allJobs.filter(
            (j: Job) => j.status === 'Pending' || j.status === 'In-Progress'
          ).length;
          
          const completed = allJobs.filter(
            (j: Job) => j.status === 'Repaired' || j.status === 'Delivered'
          ).length;
          
          const earnings = allJobs
            .filter((j: Job) => new Date(j.created_at) >= today)
            .reduce((sum: number, j: Job) => sum + (j.final_bill || 0), 0);

          setStats({
            totalJobs: allJobs.length,
            pendingJobs: pending,
            completedJobs: completed,
            todayEarnings: earnings
          });
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 bg-white">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-gray-500 font-bold italic uppercase tracking-[0.25em] text-sm">
          V-TECH: Loading Dashboard...
        </p>
      </div>
    );
  }

  // Login user ka naam display karne ke liye
  const displayName = profile?.full_name || "User";

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* ===== HEADER SECTION ===== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50 p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <Wrench className="text-white" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tighter m-0 uppercase leading-none">
                V-TECH <span className="text-blue-600 not-italic">COMMAND</span>
              </h1>
              {/* AB YAHAN DYNAMIC NAAM AAYEGA */}
              <p className="text-gray-600 text-[11px] font-extrabold uppercase tracking-[0.25em] mt-2">
                Swaagat hai, {displayName} ji! Aaj ka kaam shuru karein.
              </p>
            </div>
          </div>
          <Link 
            href="/jobs/new" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-[2rem] font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 no-underline uppercase tracking-tight shadow-md shadow-blue-500/20 text-sm"
          >
            <Zap size={18} strokeWidth={2.5} /> Quick Job Entry
          </Link>
        </div>

        {/* ... baaki ka code waisa hi rahega ... */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Total Jobs" value={stats.totalJobs} icon={<Wrench size={24} />} color="blue" />
          <StatCard label="Pending Repairs" value={stats.pendingJobs} icon={<Clock size={24} />} color="amber" />
          <StatCard label="Completed" value={stats.completedJobs} icon={<CheckCircle size={24} />} color="emerald" />
          <StatCard label="Today's Billing" value={`₹${stats.todayEarnings}`} icon={<IndianRupee size={24} strokeWidth={2.5} />} color="violet" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp size={20} className="text-blue-600" />
              <h3 className="text-[11px] font-extrabold uppercase text-gray-500 tracking-[0.15em]">Essential Operations</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ActionLink href="/jobs" icon={<Wrench size={22} />} label="View Jobs" sub="Manage all repairs" />
              <ActionLink href="/clients" icon={<Users size={22} />} label="Customers" sub="List of all clients" />
              <ActionLink href="/inventory" icon={<AlertCircle size={22} />} label="Inventory" sub="Check spare parts" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md text-white relative overflow-hidden group">
            <Sparkles className="absolute -right-4 -top-4 text-white/10 rotate-12 group-hover:scale-150 transition-transform duration-700" size={120} strokeWidth={1} />
            <div className="relative z-10 h-full flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={18} className="text-white/90" />
                <h4 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/90">Shop Secret</h4>
              </div>
              <p className="text-white/90 font-bold leading-relaxed text-sm italic">
                "Repaired" status set karne se pehle ensure karein ki saare parts list mein add ho gaye hain taaki bill sahi bane.
              </p>
              <div className="mt-6 pt-4 border-t border-white/20 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-wider text-white/80">Pro Tip v2</span>
                <div className="h-2 w-2 bg-white rounded-full animate-ping opacity-75"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// StatsCard aur ActionLink components aapke purane code se same rahenge...
function StatCard({ label, value, icon, color }: any) {
  const colorStyles: any = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600' },
    violet: { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'text-violet-600' }
  };
  const style = colorStyles[color];
  return (
    <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-300 shadow-md flex items-center gap-5 transition-transform hover:-translate-y-1 duration-300">
      <div className={`p-4 rounded-2xl ${style.bg} border-2 ${style.border} shadow-inner`}>
        <div className={style.icon}>{icon}</div>
      </div>
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-gray-500 leading-none mb-1">{label}</p>
        <div className="text-3xl font-extrabold italic text-gray-900 tracking-tight">{value}</div>
      </div>
    </div>
  );
}

function ActionLink({ href, icon, label, sub }: any) {
  return (
    <Link href={href} className="group flex flex-col p-5 bg-white border-2 border-gray-300 hover:border-blue-400 rounded-2xl transition-all no-underline hover:shadow-md hover:-translate-y-0.5">
      <div className="text-gray-500 group-hover:text-blue-600 transition-colors mb-3">{icon}</div>
      <div className="flex items-center justify-between">
        <span className="font-extrabold text-gray-800 uppercase text-xs tracking-wider group-hover:text-blue-700 transition-colors">{label}</span>
        <ArrowRight size={14} className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
      </div>
      <p className="text-[9px] font-bold text-gray-500 mt-1.5 uppercase tracking-wide">{sub}</p>
    </Link>
  );
}