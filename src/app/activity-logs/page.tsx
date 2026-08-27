"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import {
  History, Search, Loader2, User, Info,
  ChevronLeft, ChevronRight, X,
  UserCog, Package, ShoppingCart, ExternalLink
} from "lucide-react";
import { formatIST } from "@/lib/dateUtils";
import Link from "next/link";

interface LogEntry {
  id: number;
  user_id: number;
  action: string;
  module: string;
  meta_id: string | null;
  details: string | null;
  date_created: string;
  username?: string;
  user_image?: string | null;
}

const PAGE_SIZES = [10, 25, 50, 100];

// Legacy PHP/MariaDB activity logs predate the Next.js handover (Aug 15, 2026)
// and use `user_id` = id from the PHP `users` table. The new system uses
// 0 = Admin or mechanic_list.id. Id spaces collide, so resolve by date.
const LEGACY_CUTOFF_MS = new Date("2026-08-15T00:00:00.000Z").getTime();

// User avatar — photo ho to photo, warna 1-letter initials (admin amber, staff blue).
const UserAvatar = ({ image, name, user_id, cls = "w-8 h-8 text-[10px]" }: { image?: string | null; name?: string; user_id: number; cls?: string }) =>
  image ? (
    <Image src={image} alt={name || "User"} width={32} height={32} unoptimized
      className={`${cls} rounded-full object-cover flex-shrink-0 border border-white/10`}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
  ) : (
    <div className={`${cls} rounded-full flex items-center justify-center font-black flex-shrink-0 ${user_id === 0 ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"}`}>
      {name?.slice(0, 1).toUpperCase()}
    </div>
  );

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let countQuery = supabase
        .from("activity_logs")
        .select("*", { count: "exact", head: true });

      let dataQuery = supabase
        .from("activity_logs")
        .select("*")
        .order("date_created", { ascending: false })
        .range(from, to);

      if (moduleFilter !== "all") {
        countQuery = countQuery.eq("module", moduleFilter);
        dataQuery = dataQuery.eq("module", moduleFilter);
      }
      if (dateFrom) {
        countQuery = countQuery.gte("date_created", `${dateFrom}T00:00:00+05:30`);
        dataQuery = dataQuery.gte("date_created", `${dateFrom}T00:00:00+05:30`);
      }
      if (dateTo) {
        countQuery = countQuery.lte("date_created", `${dateTo}T23:59:59+05:30`);
        dataQuery = dataQuery.lte("date_created", `${dateTo}T23:59:59+05:30`);
      }
      if (debouncedSearch) {
        countQuery = countQuery.or(`action.ilike.%${debouncedSearch}%,details.ilike.%${debouncedSearch}%`);
        dataQuery = dataQuery.or(`action.ilike.%${debouncedSearch}%,details.ilike.%${debouncedSearch}%`);
      }

      const [{ count }, { data, error }] = await Promise.all([countQuery, dataQuery]);
      if (error) throw error;

      const mechIds = [...new Set((data || []).map(l => l.user_id).filter(id => id > 0))];
      const mechsMap = new Map<number, { name: string; image: string | null }>();

      // `users` table (legacy PHP ids) is RLS-blocked for anon → resolve via server route.
      let usersMap: Record<string, string> = {};
      let mechanicsMap: Record<string, string> = {};
      if (mechIds.length > 0) {
        try {
          const res = await fetch(`/api/activity-users?ids=${mechIds.join(",")}`);
          const json = await res.json();
          usersMap = json.users || {};
          mechanicsMap = json.mechanics || {};
        } catch {}
        const { data: mechs } = await supabase
          .from("mechanic_list")
          .select("id, firstname, lastname, image_path")
          .in("id", mechIds);
        mechs?.forEach(m => mechsMap.set(m.id, { name: `${m.firstname} ${m.lastname}`, image: m.image_path || null }));
      }

      const formatted = (data || []).map(l => {
        const id = String(l.user_id);
        const isLegacy = new Date(l.date_created).getTime() < LEGACY_CUTOFF_MS;
        let name: string;
        if (l.user_id === 0) name = "Admin";
        else if (isLegacy) name = usersMap[id] || `User ${id}`;
        else name = mechanicsMap[id] || `User ${id}`;
        // Legacy PHP `users` rows have no mechanic photo — only show images for
        // real mechanic_list entries from the new system.
        const image = !isLegacy && l.user_id !== 0 ? mechsMap.get(l.user_id)?.image || null : null;
        return {
          ...l,
          username: name,
          user_image: image
        };
      });

      setLogs(formatted);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setHasLoaded(true);
      setLoading(false);
    }
  }, [moduleFilter, dateFrom, dateTo, debouncedSearch, page, pageSize]);

  // Debounce search so typing doesn't refetch+blank the table on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const getModuleIcon = (mod: string) => {
    switch (mod) {
      case 'Clients': return <User size={12} className="text-blue-400" />;
      case 'Jobs':    return <UserCog size={12} className="text-amber-400" />;
      case 'Inventory': return <Package size={12} className="text-purple-400" />;
      case 'Sales':   return <ShoppingCart size={12} className="text-emerald-400" />;
      default:        return <Info size={12} className="text-slate-500" />;
    }
  };

  const getRelatedLink = (module: string, metaId: string | null) => {
    if (!metaId || metaId === '0') return null;
    const m = module.toLowerCase();
    if (m.includes('transaction') || m.includes('job')) return { href: `/jobs/${metaId}/view`, label: 'View Job' };
    if (m.includes('client')) return { href: `/clients/${metaId}/view`, label: 'View Client' };
    if (m.includes('mechanic')) return { href: `/mechanics/${metaId}`, label: 'View Mechanic' };
    if (m.includes('sale')) return { href: `/sales/view/${metaId}`, label: 'View Sale' };
    if (m.includes('inventory') || m.includes('product')) return { href: '/inventory', label: 'Inventory' };
    return null;
  };

  const formatDetails = (details: string | null, module: string) => {
    if (!details) return <span className="italic text-slate-700">—</span>;
    // Highlight job IDs, amounts, status changes
    const m = module.toLowerCase();
    let text = details;
    if (m.includes('job') || m.includes('transaction')) {
      text = text.replace(/Job #(\d+)/g, 'Job #$1');
      text = text.replace(/Amount:\s*([\d,.]+)/g, 'Amount: ₹$1');
    }
    return <span>{text}</span>;
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
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Search by action or details..."
                  className="w-full bg-[#0d1117] border border-[#21293d] rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-blue-500/50 transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="w-full sm:w-48">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5 ml-1">Module</label>
              <select
                value={moduleFilter}
                onChange={e => { setModuleFilter(e.target.value); setPage(0); }}
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
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }}
                  className="bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2 text-sm [color-scheme:dark]" />
              </div>
              <div className="pt-6 text-slate-700">—</div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5 ml-1">To</label>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }}
                  className="bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2 text-sm [color-scheme:dark]" />
              </div>
            </div>

            <button onClick={() => { setSearch(""); setModuleFilter("all"); setDateFrom(""); setDateTo(""); setPage(0); }}
              className="p-2.5 bg-[#0d1117] border border-[#21293d] text-slate-500 hover:text-red-400 rounded-xl transition-all">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stats + Page Size */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-bold">
              {totalCount.toLocaleString()} total entries
            </span>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-600 font-black uppercase">Show</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
                className="bg-[#0d1117] border border-[#21293d] rounded-lg px-2 py-1 text-xs outline-none [color-scheme:dark]"
              >
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden shadow-2xl">
          {loading && !hasLoaded ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
              <Loader2 size={32} className="animate-spin text-blue-500" />
              <p className="text-slate-600 text-xs font-black uppercase tracking-widest">Fetching Audit Logs...</p>
            </div>
          ) : (
            <>
            {loading && hasLoaded && (
              <div className="flex items-center gap-2 text-[11px] font-bold text-blue-400 px-5 py-2.5 bg-[#0d1117]/50 border-b border-[#21293d]">
                <Loader2 size={12} className="animate-spin" /> Searching...
              </div>
            )}
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#0d1117]/50 border-b border-[#21293d]">
                    <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600">Time</th>
                    <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600">User</th>
                    <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600">Action</th>
                    <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600">Module</th>
                    <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600">Details</th>
                    <th className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-white font-bold">{formatIST(log.date_created, { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                          <span className="text-[10px] text-slate-600 font-bold">{formatIST(log.date_created, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <UserAvatar image={log.user_image} name={log.username} user_id={log.user_id} />
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
                        <p className="text-slate-500 text-xs leading-relaxed max-w-md">
                          {formatDetails(log.details, log.module)}
                        </p>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {(() => {
                          const link = getRelatedLink(log.module, log.meta_id);
                          if (!link) return <span className="text-slate-700 text-[10px] font-bold tracking-widest uppercase">—</span>;
                          const isDelete = log.action.toLowerCase().includes('delete');
                          return (
                            <Link
                              href={link.href}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all no-underline ${
                                isDelete
                                  ? 'bg-red-500/5 border-red-500/20 text-red-400/50 cursor-not-allowed opacity-60'
                                  : 'bg-blue-500/5 border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white'
                              }`}
                              onClick={(e) => isDelete && e.preventDefault()}
                            >
                              <ExternalLink size={11} />
                              {isDelete ? 'Deleted' : link.label}
                            </Link>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-20 text-center">
                        <History size={40} className="text-slate-800 mx-auto mb-4 opacity-20" />
                        <p className="text-slate-600 font-black uppercase tracking-widest text-xs">No activity logs found</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-[#21293d]">
              {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-white/[0.02] transition-colors group">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <UserAvatar image={log.user_image} name={log.username} user_id={log.user_id} />
                      <div>
                        <span className="text-white font-bold block leading-tight">{log.username}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-500 font-bold">{formatIST(log.date_created, { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                          <span className="text-[10px] text-slate-600 font-bold">•</span>
                          <span className="text-[10px] text-slate-500 font-bold">{formatIST(log.date_created, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#0d1117] border border-[#21293d] rounded-lg px-2.5 py-1 w-fit flex-shrink-0">
                      {getModuleIcon(log.module)}
                      <span className="text-[9px] font-black uppercase tracking-tight text-slate-400">{log.module}</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="text-slate-300 font-bold text-sm block mb-1">{log.action}</span>
                    <p className="text-slate-500 text-xs leading-relaxed mb-2">
                      {formatDetails(log.details, log.module)}
                    </p>
                    {(() => {
                      const link = getRelatedLink(log.module, log.meta_id);
                      if (!link) return null;
                      const isDelete = log.action.toLowerCase().includes('delete');
                      return (
                        <Link
                          href={link.href}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all no-underline ${
                            isDelete
                              ? 'bg-red-500/5 border-red-500/20 text-red-400/50'
                              : 'bg-blue-500/5 border-blue-500/20 text-blue-400'
                          }`}
                          onClick={(e) => isDelete && e.preventDefault()}
                        >
                          <ExternalLink size={11} />
                          {isDelete ? 'Deleted' : link.label}
                        </Link>
                      );
                    })()}
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="p-10 text-center">
                  <History size={32} className="text-slate-800 mx-auto mb-3 opacity-20" />
                  <p className="text-slate-600 font-black uppercase tracking-widest text-[10px]">No activity logs found</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-4 border-t border-[#21293d] bg-[#0d1117]/30">
                <span className="text-[11px] text-slate-500 font-bold">
                  Page {page + 1} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-2 bg-[#0d1117] border border-[#21293d] rounded-lg text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 7) {
                        pageNum = i;
                      } else if (page < 3) {
                        pageNum = i;
                      } else if (page > totalPages - 4) {
                        pageNum = totalPages - 7 + i;
                      } else {
                        pageNum = page - 3 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`min-w-[32px] h-8 rounded-lg text-xs font-bold transition-all ${
                            page === pageNum
                              ? "bg-blue-600 text-white"
                              : "bg-[#0d1117] border border-[#21293d] text-slate-500 hover:text-white"
                          }`}
                        >
                          {pageNum + 1}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1}
                    className="p-2 bg-[#0d1117] border border-[#21293d] rounded-lg text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
