"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  History, Search, Loader2, Calendar, User, Info,
  ChevronLeft, ChevronRight, Filter, X, Smartphone,
  UserCog, Package, LayoutDashboard, ShoppingCart, Banknote
} from "lucide-react";
import { formatIST } from "@/lib/dateUtils";

interface LogEntry {
  id: number;
  user_id: number;
  action: string;
  module: string;
  meta_id: string | null;
  details: string | null;
  date_created: string;
  username?: string;
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    fetchLogs();
  }, [moduleFilter, dateFrom, dateTo]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("activity_logs")
        .select("*")
        .order("date_created", { ascending: false })
        .limit(200);

      if (moduleFilter !== "all") query = query.eq("module", moduleFilter);
      if (dateFrom) query = query.gte("date_created", `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte("date_created", `${dateTo}T23:59:59`);

      const { data, error } = await query;
      if (error) throw error;

      // Fetch user/mechanic names for display
      const mechIds = [...new Set((data || []).map(l => l.user_id).filter(id => id > 0))];
      const mechsMap = new Map();
      
      if (mechIds.length > 0) {
        const { data: mechs } = await supabase
          .from("mechanic_list")
          .select("id, firstname, lastname")
          .in("id", mechIds);
        mechs?.forEach(m => mechsMap.set(m.id, `${m.firstname} ${m.lastname}`));
      }

      const formatted = (data || []).map(l => ({
        ...l,
        username: l.user_id === 0 ? "Administrator" : mechsMap.get(l.user_id) || `Staff #${l.user_id}`
      }));

      setLogs(formatted);
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(l => 
    l.details?.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.username?.toLowerCase().includes(search.toLowerCase())
  );

  const getModuleIcon = (mod: string) => {
    switch (mod) {
      case 'Clients': return <User size={12} className="text-blue-400" />;
      case 'Jobs':    return <UserCog size={12} className="text-amber-400" />;
      case 'Inventory': return <Package size={12} className="text-purple-400" />;
      case 'Sales':   return <ShoppingCart size={12} className="text-emerald-400" />;
      default:        return <Info size={12} className="text-slate-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600/10 border border-blue-600/20 rounded-2xl flex items-center justify-center">
              <History size={24} className="text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">System Activity Logs</h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Audit trail of all system changes</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5 ml-1">Search Logs</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1-2 text-slate-600" />
                <input 
                  type="text" 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by action, user or details..."
                  className="w-full bg-[#0d1117] border border-[#21293d] rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-blue-500/50 transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="w-full sm:w-48">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5 ml-1">Module</label>
              <select 
                value={moduleFilter}
                onChange={e => setModuleFilter(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#21293d] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500/50 [color-scheme:dark]"
              >
                <option value="all">All Modules</option>
                <option value="Clients">Clients</option>
                <option value="Jobs">Jobs</option>
                <option value="Inventory">Inventory</option>
                <option value="Sales">Sales</option>
                <option value="Mechanics">Mechanics</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5 ml-1">From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2 text-sm [color-scheme:dark]" />
              </div>
              <div className="pt-6 text-slate-700">—</div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5 ml-1">To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2 text-sm [color-scheme:dark]" />
              </div>
            </div>

            <button onClick={() => { setSearch(""); setModuleFilter("all"); setDateFrom(""); setDateTo(""); }}
              className="p-2.5 bg-[#0d1117] border border-[#21293d] text-slate-500 hover:text-red-400 rounded-xl transition-all">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden shadow-2xl">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
              <Loader2 size={32} className="animate-spin text-blue-500" />
              <p className="text-slate-600 text-xs font-black uppercase tracking-widest">Fetching Audit Logs...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#0d1117]/50 border-b border-[#21293d]">
                    <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600">Time</th>
                    <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600">User</th>
                    <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600">Action</th>
                    <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600">Module</th>
                    <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-white font-bold">{formatIST(log.date_created, { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                          <span className="text-[10px] text-slate-600 font-bold">{formatIST(log.date_created, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${
                            log.user_id === 0 ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"
                          }`}>
                            {log.username?.slice(0, 1).toUpperCase()}
                          </div>
                          <span className="text-slate-300 font-semibold">{log.username}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-white font-bold block">{log.action}</span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21293d] rounded-lg px-2.5 py-1 w-fit">
                          {getModuleIcon(log.module)}
                          <span className="text-[10px] font-black uppercase tracking-tight text-slate-400">{log.module}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-slate-500 text-xs leading-relaxed max-w-md italic">
                          {log.details || "—"}
                        </p>
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-20 text-center">
                        <History size={40} className="text-slate-800 mx-auto mb-4 opacity-20" />
                        <p className="text-slate-600 font-black uppercase tracking-widest text-xs">No activity logs found</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
