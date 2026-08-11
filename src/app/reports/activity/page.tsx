"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  History, Search, Filter, RefreshCw, 
  User as UserIcon, Info, 
  ChevronLeft, ChevronRight, Activity
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { ExternalLink, Trash2, PlusCircle, Edit3, Eraser } from "lucide-react";


type LogEntry = {
  id: number;
  user_id: number | string;
  action: string;
  module: string;
  meta_id: string;
  details: string;
  date_created: string;
  profiles?: {
    full_name: string;
  };
};

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [modules, setModules] = useState<string[]>([]);
  const [retention, setRetention] = useState(90);
  const [cleaning, setCleaning] = useState(false);
  const [cleanMsg, setCleanMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("system_info").select("meta_value").eq("meta_field", "log_retention").maybeSingle();
        setRetention(parseInt(data?.meta_value || "90") || 90);
      } catch {}
    })();
  }, []);

  const cleanOldLogs = async () => {
    if (!confirm(`Are you sure to clean up old activity logs? This will delete logs older than ${retention} days.`)) return;
    setCleaning(true);
    setCleanMsg("");
    try {
      const res = await fetch("/api/admin/clean-logs", { method: "POST" });
      const json = await res.json();
      if (json.status === "success") {
        setCleanMsg(json.msg);
        fetchLogs();
      } else {
        alert(json.msg || "Cleanup failed");
      }
    } catch {
      alert("Cleanup failed");
    } finally {
      setCleaning(false);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // 1. Fetch Logs (Simplified query first to ensure it works even if join fails)
      let query = supabase
        .from("activity_logs")
        .select(`*`)
        .order("date_created", { ascending: false });

      if (moduleFilter !== "all") {
        query = query.eq("module", moduleFilter);
      }

      if (searchTerm) {
        query = query.or(`action.ilike.%${searchTerm}%,details.ilike.%${searchTerm}%,module.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(100);

      if (error) {
        console.error("Supabase Error Details:", error.message, error.details, error.hint);
        throw new Error(error.message);
      }

      // 2. Fetch User Profiles to map names (Manually mapping to avoid SQL Join complexity/errors)
      const userIds = Array.from(new Set(data?.map(l => l.user_id).filter(Boolean)));
      
      const profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        
        if (profData) {
          profData.forEach(p => profilesMap[p.id] = p.full_name);
        }
      }

      const formattedLogs = (data || []).map(log => ({
        ...log,
        profiles: { full_name: profilesMap[log.user_id] || `User ${log.user_id}` }
      }));

      setLogs(formattedLogs);

      // 3. Extract unique modules
      const { data: modData } = await supabase.from("activity_logs").select("module");
      if (modData) {
        const uniqueMods = Array.from(new Set(modData.map(m => m.module))).filter(Boolean).sort() as string[];
        setModules(uniqueMods);
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Error fetching logs:", msg || err);
      // Extra check: If error contains 'relation "activity_logs" does not exist'
      if (msg.includes('activity_logs')) {
         alert("Error: 'activity_logs' table is missing in Supabase. Please run the SQL command provided in the previous step.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchLogs also called by manual search (handleSearch); useCallback would refetch on every searchTerm keystroke
  }, [moduleFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const getModuleColor = (mod: string) => {
    const m = mod.toLowerCase();
    if (m.includes('client')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (m.includes('job') || m.includes('transaction')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (m.includes('product') || m.includes('inventory')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    if (m.includes('sale')) return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
    if (m.includes('mechanic')) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  };

  const getActionStyles = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes('delete') || a.includes('removed')) return { color: 'text-red-400 bg-red-400/10 border-red-400/20', icon: <Trash2 size={12} /> };
    if (a.includes('add') || a.includes('create') || a.includes('new')) return { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: <PlusCircle size={12} /> };
    if (a.includes('status') || a.includes('update')) return { color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20', icon: <Edit3 size={12} /> };
    return { color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', icon: <History size={12} /> };
  };

  const getRelatedLink = (module: string, id: string) => {
    if (!id || id === '0') return null;
    const m = module.toLowerCase();
    if (m.includes('transaction') || m.includes('job')) return `/jobs/${id}`;
    if (m.includes('client')) return `/clients/${id}`;
    if (m.includes('mechanic')) return `/mechanics/${id}`;
    if (m.includes('sale')) return `/sales/view/${id}`;
    if (m.includes('inventory') || m.includes('product')) return `/inventory`;
    return null;
  };


  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161b27] border border-[#21293d] p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
            <Activity className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">System Activity Log</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">Track all changes and actions</p>
          </div>
        </div>
        <button 
          onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2 bg-[#0d1117] border border-[#21293d] hover:border-blue-500/50 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all shadow-sm"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
        <button 
          onClick={cleanOldLogs} disabled={cleaning}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 rounded-xl text-xs font-bold text-red-400 transition-all shadow-sm disabled:opacity-50"
        >
          <Eraser size={14} className={cleaning ? "animate-spin" : ""} />
          {cleaning ? "Cleaning..." : "Clean Old Logs"}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 p-4 bg-blue-500/5 border border-blue-500/15 rounded-2xl">
        <p className="text-xs text-slate-400">
          <Info size={13} className="inline mr-1 text-blue-400" />
          Retention: <strong className="text-blue-400">{retention} days</strong>. Cleaning logs will remove entries older than this from the database.
        </p>
        {cleanMsg && <span className="text-xs font-bold text-emerald-400 whitespace-nowrap">{cleanMsg}</span>}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <form onSubmit={handleSearch} className="lg:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
          <input 
            type="text" 
            placeholder="Search action or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#161b27] border border-[#21293d] rounded-xl text-sm text-slate-300 outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all"
          />
        </form>

        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
          <select 
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#161b27] border border-[#21293d] rounded-xl text-sm text-slate-300 outline-none appearance-none focus:border-blue-500/50 transition-all cursor-pointer"
          >
            <option value="all">All Modules</option>
            {modules.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-center p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
           <span className="text-xs font-black text-blue-400 uppercase tracking-widest">
             {logs.length} Recent Logs
           </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0d1117]/50 border-b border-[#21293d]">
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Time & User</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Module</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Action</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Details</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Navigation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21293d]">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-6 py-8">
                      <div className="h-4 bg-slate-800/50 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-300">
                          {format(new Date(log.date_created), "hh:mm a")}
                        </span>
                        <span className="text-[10px] text-slate-600 font-medium">
                          {format(new Date(log.date_created), "dd MMM, yyyy")}
                        </span>
                        <div className="flex items-center gap-1.5 mt-2 text-blue-400/80">
                          <UserIcon size={10} />
                          <span className="text-[10px] font-black uppercase">{log.profiles?.full_name || "Unknown"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getModuleColor(log.module)}`}>
                        {log.module}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const style = getActionStyles(log.action);
                        return (
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${style.color}`}>
                            {style.icon}
                            {log.action}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs sm:max-w-sm">
                        <p className="text-xs text-slate-400 leading-relaxed font-medium">
                          {log.details || "No additional details"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const link = getRelatedLink(log.module, log.meta_id);
                        if (!link) return <span className="text-slate-700 text-[10px] font-bold tracking-widest uppercase">N/A</span>;
                        const isDelete = log.action.toLowerCase().includes('delete');
                        
                        return (
                          <Link 
                            href={link}
                            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all shadow-sm no-underline ${
                              isDelete 
                              ? 'bg-red-500/5 border-red-500/20 text-red-400/50 hover:text-red-400 cursor-not-allowed opacity-60' 
                              : 'bg-blue-500/5 border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white'
                            }`}
                            onClick={(e) => isDelete && e.preventDefault()}
                          >
                            <ExternalLink size={12} />
                            {isDelete ? 'Deleted' : 'View Record'}
                          </Link>
                        );
                      })()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <History size={40} className="text-slate-800" />
                      <p className="text-sm font-bold text-slate-600">No activity logs found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer info */}
        <div className="px-6 py-4 bg-[#0d1117]/30 border-t border-[#21293d] flex items-center justify-between">
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
            Showing last 100 system events
          </p>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-700 hover:text-slate-400 transition-colors disabled:opacity-30" disabled>
              <ChevronLeft size={16} />
            </button>
            <button className="p-2 text-slate-700 hover:text-slate-400 transition-colors disabled:opacity-30" disabled>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
