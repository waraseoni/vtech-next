"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Loader2, ChevronLeft, ChevronRight,
  Printer, TrendingUp, Eye, FileText, Calendar,
  Settings, History, Plus, Check, X, AlertCircle,
  Edit3
} from "lucide-react";

const inr = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
import { currentMonthIST, parseISTDate } from "@/lib/dateUtils";
import { logActivity } from "@/lib/activity";

type CommRow = {
  id: number;
  job_id: string;
  code: string | null;
  item: string;
  client_name: string;
  date_created: string;
  date_completed: string | null;
  mechanic_id: number;
  m_name: string;
  rate: number;
  service_amount: number;
  mechanic_commission_amount: number;
};

type MechanicRate = {
  id: number;
  name: string;
  current_rate: number;
  last_updated?: string;
};

type RateHistory = {
  id: number;
  mechanic_id: number;
  commission_percent: number;
  effective_date: string;
  date_created: string;
};

function CommissionContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const currentMonth = currentMonthIST();
  const [activeTab,  setActiveTab]  = useState<"statement" | "master">( (searchParams.get("tab") as "statement" | "master") || "statement");
  const [month,      setMonthState] = useState(searchParams.get("month")       || currentMonth);
  const [mechanicId, setMechState]  = useState(searchParams.get("mechanic_id") || "all");
  const [loading,    setLoading]    = useState(true);
  
  // Statement State
  const [rows,       setRows]       = useState<CommRow[]>([]);
  const [mechanics,  setMechanics]  = useState<{ id: number; name: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(25);

  // Master State
  const [mechRates,     setMechRates]     = useState<MechanicRate[]>([]);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedMech,   setSelectedMech]   = useState<MechanicRate | null>(null);
  const [rateHistory,    setRateHistory]    = useState<RateHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Update Form
  const [newRate, setNewRate] = useState("");
  const [effDate, setEffDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingRate, setSavingRate] = useState(false);
  const [rateErr, setRateErr] = useState("");

  // URL sync helpers
  const updateURL = (params: Record<string, string | null>) => {
    const p = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v === null || v === "all") p.delete(k);
      else p.set(k, v);
    });
    router.replace("?" + p.toString(), { scroll: false });
  };

  const setTab = (t: "statement" | "master") => {
    setActiveTab(t);
    updateURL({ tab: t });
  };

  const setMonth = (m: string) => {
    setMonthState(m);
    updateURL({ month: m });
  };

  const setMechanicId = (id: string) => {
    setMechState(id);
    updateURL({ mechanic_id: id });
  };

  // ── fetchData ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "statement") {
        const from = `${month}-01T00:00:00+05:30`;
        const [year, m] = month.split("-").map(Number);
        const lastDay = new Date(year, m, 0).getDate();
        const to = `${month}-${String(lastDay).padStart(2, "0")}T23:59:59+05:30`;

        const [mechRes, txnRes] = await Promise.all([
          supabase.from("mechanic_list").select("id, firstname, middlename, lastname, commission_percent, delete_flag").order("firstname"),
          (() => {
            // PHP commission_history: only DELIVERED jobs (status=5) by date_completed
            let q = supabase.from("transaction_list")
              .select("id, job_id, code, item, client_name, date_created, date_completed, mechanic_id, mechanic_commission_amount")
              .eq("status", 5)
              .gte("date_completed", from).lte("date_completed", to);
            if (mechanicId !== "all") q = q.eq("mechanic_id", parseInt(mechanicId));
            return q;
          })()
        ]);

        const mechData = mechRes.data || [];
        const txns = txnRes.data || [];

        // Dropdown me sirf active mechanics (PHP dropdown: delete_flag = 0), par
        // name/rate mapping me sab (PHP INNER JOIN mechanic_list — deleted wale bhi)
        setMechanics(mechData.filter((m) => m.delete_flag === 0).map((m) => ({ id: m.id, name: [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ") })));

        const mechMap = new Map(mechData.map((m) => [m.id, {
          name: [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" "),
          rate: m.commission_percent || 0,
        }]));

        const txnIds = txns.map(t => t.id);
        const svcMap: Record<number, number> = {};
        if (txnIds.length > 0) {
          const { data: svcs } = await supabase.from("transaction_services").select("transaction_id, price").in("transaction_id", txnIds);
          svcs?.forEach(s => { svcMap[s.transaction_id] = (svcMap[s.transaction_id] || 0) + (s.price || 0); });
        }

        // Client names (PHP: LEFT JOIN client_list on client_name)
        const clientIds = [...new Set(txns.map(t => Number(t.client_name)).filter(Boolean))];
        const clientMap = new Map<number, string>();
        if (clientIds.length > 0) {
          const { data: clRows } = await supabase.from("client_list").select("id, firstname, middlename, lastname").in("id", clientIds);
          (clRows || []).forEach(c => clientMap.set(c.id, [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ")));
        }

        // Effective rate per job (PHP: latest history row with effective_date <= job's
        // date_created, order effective_date DESC, id DESC; fallback = mechanic_list rate)
        const mechIds = [...new Set(txns.map(t => t.mechanic_id))];
        const histByMech: Record<number, { effective_date: string; id: number; commission_percent: number }[]> = {};
        if (mechIds.length > 0) {
          const { data: histRows } = await supabase.from("mechanic_commission_history")
            .select("id, mechanic_id, commission_percent, effective_date").in("mechanic_id", mechIds);
          (histRows || []).forEach(h => {
            if (!histByMech[h.mechanic_id]) histByMech[h.mechanic_id] = [];
            histByMech[h.mechanic_id].push({ effective_date: h.effective_date, id: h.id, commission_percent: h.commission_percent });
          });
          Object.values(histByMech).forEach(arr =>
            arr.sort((a, b) => (a.effective_date < b.effective_date ? 1 : a.effective_date > b.effective_date ? -1 : b.id - a.id))
          );
        }
        const effRateFor = (mechId: number, onDate: string, fallback: number): number => {
          const on = (onDate || "").slice(0, 10);
          const hist = histByMech[mechId] || [];
          for (const h of hist) {
            if (h.effective_date <= on) return h.commission_percent;
          }
          return fallback;
        };

        const enriched: CommRow[] = txns.map((t) => {
          const mech = mechMap.get(t.mechanic_id);
          return {
            id: t.id,
            job_id: t.job_id || String(t.id),
            code: t.code || null,
            item: t.item || "",
            client_name: clientMap.get(Number(t.client_name)) || "",
            date_created: t.date_created,
            date_completed: t.date_completed,
            mechanic_id: t.mechanic_id,
            m_name: mech?.name || "Unknown",
            rate: effRateFor(t.mechanic_id, t.date_created, mech?.rate || 0),
            service_amount: svcMap[t.id] || 0,
            mechanic_commission_amount: t.mechanic_commission_amount || 0,
          };
        });

        // PHP sorts by date_completed DESC
        enriched.sort((a, b) =>
          new Date(b.date_completed || b.date_created).getTime() - new Date(a.date_completed || a.date_created).getTime()
        );
        setRows(enriched);
        setCurrentPage(1);
      } else {
        // Master Tab: Fetch current rates + last update (PHP: latest history date_created)
        const { data } = await supabase
          .from("mechanic_list")
          .select("id, firstname, middlename, lastname, commission_percent")
          .eq("delete_flag", 0)
          .order("firstname");
        
        const mechs = data || [];
        let lastUpd: Record<number, string> = {};
        if (mechs.length > 0) {
          const { data: hist } = await supabase
            .from("mechanic_commission_history")
            .select("id, mechanic_id, effective_date, date_created")
            .in("mechanic_id", mechs.map(m => m.id));
          const map = new Map<number, { eff: string; id: number; created: string }>();
          (hist || []).forEach(h => {
            const cur = map.get(h.mechanic_id);
            if (!cur || h.effective_date > cur.eff || (h.effective_date === cur.eff && h.id > cur.id))
              map.set(h.mechanic_id, { eff: h.effective_date, id: h.id, created: h.date_created });
          });
          lastUpd = Object.fromEntries([...map.entries()].map(([k, v]) => [k, v.created]));
        }

        setMechRates(mechs.map(m => ({
          id: m.id,
          name: [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" "),
          current_rate: m.commission_percent || 0,
          last_updated: lastUpd[m.id] || undefined,
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [month, mechanicId, activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Rate Management ───────────────────────────────────────────────────
  const openUpdate = (m: MechanicRate) => {
    setSelectedMech(m);
    setNewRate(String(m.current_rate));
    setEffDate(new Date().toISOString().split('T')[0]);
    setRateErr("");
    setShowUpdateModal(true);
  };

  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMech) return;
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0) { setRateErr("Valid percentage daalo!"); return; }
    if (!effDate) { setRateErr("Effective date zaroori hai!"); return; }

    setSavingRate(true);
    try {
      // 1. Add to history
      const { error: histErr } = await supabase.from("mechanic_commission_history").insert({
        mechanic_id: selectedMech.id,
        commission_percent: rate,
        effective_date: effDate
      });
      // Note: If table doesn't exist, this will fail. We handle it gracefully.
      if (histErr) console.warn("History table error (possibly missing):", histErr.message);

      // 2. Update mechanic_list
      const { error: listErr } = await supabase.from("mechanic_list").update({
        commission_percent: rate
      }).eq("id", selectedMech.id);

      if (listErr) throw listErr;

      await logActivity('Updated Commission Rate', 'Mechanics', selectedMech.id, `Rate changed to ${rate}% (Effective: ${effDate}) for ${selectedMech.name}`);
      
      setShowUpdateModal(false);
      fetchData();
    } catch (e) {
      setRateErr((e instanceof Error && e.message ? e.message : "") || "Update failed!");
    } finally {
      setSavingRate(false);
    }
  };

  const openHistory = async (m: MechanicRate) => {
    setSelectedMech(m);
    setRateHistory([]);
    setHistoryLoading(true);
    setShowHistoryModal(true);
    try {
      const { data } = await supabase
        .from("mechanic_commission_history")
        .select("*")
        .eq("mechanic_id", m.id)
        .order("effective_date", { ascending: false });
      if (data) setRateHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── UI Helpers ────────────────────────────────────────────────────────
  const navigate = (dir: "prev" | "next") => {
    const d = parseISTDate(month + "-01");
    d.setMonth(d.getMonth() + (dir === "prev" ? -1 : 1));
    setMonth(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(d));
  };

  const totalComm  = rows.reduce((s, r) => s + r.mechanic_commission_amount, 0);
  const monthLabel = parseISTDate(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const byMechanic = rows.reduce<Record<number, { name: string; total: number; jobs: number }>>(
    (acc, r) => {
      if (!acc[r.mechanic_id]) acc[r.mechanic_id] = { name: r.m_name, total: 0, jobs: 0 };
      acc[r.mechanic_id].total += r.mechanic_commission_amount;
      acc[r.mechanic_id].jobs  += 1;
      return acc;
    }, {}
  );
  const summary = Object.values(byMechanic).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
            <TrendingUp size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Commission Management</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Staff commission and rates</p>
          </div>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex bg-[#0d1117] border border-[#21293d] rounded-xl p-1">
          <button onClick={() => setTab("statement")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "statement" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"
            }`}>
            <FileText size={14} /> Statement
          </button>
          <button onClick={() => setTab("master")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "master" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"
            }`}>
            <Settings size={14} /> Rate Master
          </button>
        </div>
      </div>

      {activeTab === "statement" ? (
        <>
          {/* Filters */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Month:</span>
              <button onClick={() => navigate("prev")}
                className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 hover:text-white transition-all">
                <ChevronLeft size={14} />
              </button>
              <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21293d] rounded-xl px-4 py-2">
                <Calendar size={14} className="text-slate-600" />
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-200 outline-none" />
              </div>
              <button onClick={() => navigate("next")}
                className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 hover:text-white transition-all">
                <ChevronRight size={14} />
              </button>

              <div className="h-6 w-px bg-[#21293d] mx-1" />

              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Staff:</span>
              <select value={mechanicId} onChange={(e) => setMechanicId(e.target.value)}
                className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500 transition-all">
                <option value="all">All Staff</option>
                {mechanics.map((m) => (
                  <option key={m.id} value={String(m.id)}>{m.name}</option>
                ))}
              </select>

              <button onClick={() => window.open(`/api/print-mechanics-commission?month=${month}&mechanic_id=${mechanicId}`, "_blank")}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all">
                <Printer size={14} /> Print
              </button>
            </div>
          </div>

          {/* Summary cards */}
          {!loading && mechanicId === "all" && summary.length > 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {summary.map((e) => (
                <div key={e.name} className="bg-[#161b27] border border-[#21293d] rounded-xl px-4 py-3">
                  <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{e.name}</p>
                  <p className="text-base font-black text-emerald-400 mt-1">{inr(e.total)}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{e.jobs} jobs</p>
                </div>
              ))}
            </div>
          )}

          {/* Table */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#21293d] flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-bold text-slate-300">Commission Statement — {monthLabel}</h2>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase text-slate-500">Total Commission</p>
                <p className="text-lg font-black text-emerald-400">{inr(totalComm)}</p>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 size={24} className="animate-spin text-blue-400" />
                <p className="text-slate-600 text-xs font-black uppercase tracking-wider">Loading...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
                <FileText size={36} className="text-slate-700" />
                <p className="text-sm font-bold">No commission records for this period</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#111520]">
                        {["#", "Date", "Job ID", "Item", "Client", "Staff", "Rate", "Service Amt", "Commission", ""].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left last:text-center">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((r, i) => (
                        <tr key={r.id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                          <td className="px-3 py-2.5 text-xs text-slate-500">{(currentPage - 1) * rowsPerPage + i + 1}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                            {new Date(r.date_completed || r.date_created).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-xs font-bold text-blue-400">#{r.job_id}</div>
                            {r.code && <div className="text-[10px] text-slate-600">{r.code}</div>}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-400">{r.item || "—"}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-400">{r.client_name || "—"}</td>
                          <td className="px-3 py-2.5 text-xs font-bold text-slate-200">{r.m_name}</td>
                          <td className="px-3 py-2.5 text-xs text-center">
                            <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold">{r.rate.toFixed(0)}%</span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-right text-slate-300">{inr(r.service_amount)}</td>
                          <td className="px-3 py-2.5 text-xs text-right font-black text-emerald-400">{inr(r.mechanic_commission_amount)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <a href={`/jobs/${r.id}/view`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-lg text-xs font-bold transition-all">
                              <Eye size={11} /> View
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination Footer */}
                {rows.length > rowsPerPage && (
                  <div className="bg-[#111520] px-5 py-3 flex items-center justify-between border-t border-[#21293d] flex-wrap gap-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, rows.length)} of {rows.length} records
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}
                        className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                        <ChevronLeft size={16} />
                      </button>
                      <div className="text-xs font-black text-slate-400 uppercase tracking-widest px-3 border-x border-[#21293d] min-w-[120px] text-center">
                        Page {currentPage} of {Math.ceil(rows.length / rowsPerPage)}
                      </div>
                      <button onClick={() => setCurrentPage(prev => Math.min(Math.ceil(rows.length / rowsPerPage), prev + 1))} disabled={currentPage === Math.ceil(rows.length / rowsPerPage)}
                        className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        /* RATE MASTER TAB */
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#21293d] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Commission Rate Master</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Set percentage rates for each mechanic</p>
            </div>
          </div>
          
          {loading ? (
            <div className="py-20 text-center"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#111520]">
                    {["Mechanic Name", "Current Rate (%)", "Last Updated", "Actions"].map(h => (
                      <th key={h} className="px-5 py-3 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left first:pl-6">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]">
                  {mechRates.map(m => (
                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-5 py-4 first:pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 font-black text-xs uppercase">
                            {m.name.slice(0, 2)}
                          </div>
                          <span className="font-bold text-slate-200">{m.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-sm">
                          {m.current_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {m.last_updated
                          ? new Date(m.last_updated).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openUpdate(m)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase transition-all shadow-lg shadow-blue-900/20">
                            <Plus size={12} /> New Rate
                          </button>
                          <button onClick={() => openHistory(m)}
                            className="p-1.5 bg-[#1e2637] border border-[#2a3550] hover:border-blue-500/40 text-slate-400 hover:text-white rounded-lg transition-all" title="View History">
                            <History size={14} />
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
      )}

      {/* UPDATE MODAL */}
      {showUpdateModal && selectedMech && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-[#21293d] flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="font-black text-white">Update Commission</h3>
                  <p className="text-[10px] text-blue-400 uppercase font-bold tracking-widest">{selectedMech.name}</p>
                </div>
              </div>
              <button onClick={() => setShowUpdateModal(false)} className="text-slate-500 hover:text-white p-1.5 hover:bg-white/5 rounded-lg transition-all">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateRate} className="p-5 space-y-4">
              {rateErr && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2"><AlertCircle size={14}/> {rateErr}</div>}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">New Rate (%)</label>
                  <div className="relative">
                    <input type="number" step="0.1" value={newRate} onChange={e => setNewRate(e.target.value)} autoFocus
                      className="w-full pl-4 pr-10 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-white font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 font-bold">%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Effective Date</label>
                  <input type="date" value={effDate} onChange={e => setEffDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-white font-bold focus:border-blue-500 outline-none transition-all [color-scheme:dark]" />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="submit" disabled={savingRate}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20">
                  {savingRate ? <><Loader2 size={16} className="animate-spin" /> Updating...</> : <><Check size={16} /> Save New Rate</>}
                </button>
                <button type="button" onClick={() => setShowUpdateModal(false)}
                  className="px-6 py-3 bg-[#111520] border border-[#21293d] text-slate-500 hover:text-white rounded-xl font-bold text-sm transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {showHistoryModal && selectedMech && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-5 border-b border-[#21293d] flex items-center justify-between bg-[#111520]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
                  <History size={18} />
                </div>
                <div>
                  <h3 className="font-black text-white">Rate History</h3>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{selectedMech.name}</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-500 hover:text-white p-1.5 hover:bg-white/5 rounded-lg transition-all">
                <X size={18} />
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto">
              {historyLoading ? (
                <div className="py-20 text-center"><Loader2 size={24} className="animate-spin text-blue-500 mx-auto" /></div>
              ) : rateHistory.length === 0 ? (
                <div className="py-20 text-center text-slate-600 space-y-2">
                  <AlertCircle size={32} className="mx-auto opacity-20" />
                  <p className="text-sm font-bold">No history records found.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#0d1117] text-[9px] font-black uppercase text-slate-600 tracking-widest">
                      <th className="px-5 py-3 text-left">Effective Date</th>
                      <th className="px-5 py-3 text-right">Rate (%)</th>
                      <th className="px-5 py-3 text-right">Date Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21293d]">
                    {rateHistory.map(h => (
                      <tr key={h.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-5 py-3.5 text-sm font-bold text-slate-300">
                          {new Date(h.effective_date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="font-black text-emerald-400">{h.commission_percent.toFixed(1)}%</span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-[10px] text-slate-600 uppercase">
                          {new Date(h.date_created).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-4 bg-[#111520] border-t border-[#21293d] text-center">
              <button onClick={() => setShowHistoryModal(false)}
                className="px-8 py-2 bg-[#1e2637] text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-[#2a3550]">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CommissionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin text-blue-400" /></div>}>
      <CommissionContent />
    </Suspense>
  );
}