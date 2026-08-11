"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Search, User, Wrench, Hash,
  Loader2, AlertTriangle, CheckCircle, RefreshCw, Users,
} from "lucide-react";

// ─── IST Helper ───────────────────────────────────────────────────────────────
function nowIST(): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => p.find(x => x.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}+05:30`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Client   { id: number; firstname: string; middlename: string; lastname: string; contact: string; }
interface Mechanic { id: number; firstname: string; middlename: string; lastname: string; }
interface TxnRow   {
  id: number;
  job_id: string | null;
  client_id: string;        // stored client_name as string id
  client_name: string;      // resolved display
  item: string;
  fault: string;
  mechanic_id: string;
  uniq_id: string;
  remark: string;
}

const iCls = "w-full px-2.5 py-2 bg-[#0d1117] border border-[#21293d] rounded-lg text-xs text-white outline-none focus:border-blue-500/60 transition-all";
const lCls = "block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BulkEditPage() {
  const router = useRouter();

  const [clients,   setClients]   = useState<Client[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [sourceClient, setSourceClient] = useState("");
  const [globalClient, setGlobalClient] = useState("");
  const [rows,      setRows]      = useState<TxnRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [rowLoading,setRowLoading]= useState(false);
  const [saving,    setSaving]    = useState(false);
  const [loaded,    setLoaded]    = useState(false);
  const [toast,     setToast]     = useState<{ type: "success"|"error"|"warn"; msg: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Fetch master data ──────────────────────────────────────────────────────
  const fetchMaster = useCallback(async () => {
    setLoading(true);
    const [cRes, mRes] = await Promise.all([
      supabase.from("client_list")
        .select("id, firstname, middlename, lastname, contact")
        .eq("delete_flag", 0).order("firstname"),
      supabase.from("mechanic_list")
        .select("id, firstname, middlename, lastname")
        .eq("delete_flag", 0).eq("status", 1).order("firstname"),
    ]);
    setClients(cRes.data || []);
    setMechanics(mRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMaster(); }, [fetchMaster]);

  const clientLabel = (c: Client) => {
    const name = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ");
    return `${name}${c.contact ? ` (${c.contact})` : ""}`;
  };

  // ── Load transactions for source client ────────────────────────────────────
  const loadTransactions = async () => {
    if (!sourceClient) { setToast({ type: "warn", msg: "Pehle Source Client select karo!" }); return; }
    setRowLoading(true);
    setRows([]);
    setLoaded(false);
    setGlobalClient("");
    try {
      const { data, error } = await supabase
        .from("transaction_list")
        .select("id, job_id, client_name, item, fault, mechanic_id, uniq_id, remark")
        .eq("client_name", sourceClient)
        .eq("del_status", 0)
        .order("id", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const tRows: TxnRow[] = (data || []).map(t => ({
        id: t.id,
        job_id: t.job_id,
        client_id: t.client_name ?? "",
        client_name: clientLabel(clients.find(c => c.id === Number(t.client_name)) || { id: 0, firstname: "Unknown", middlename: "", lastname: "", contact: "" }),
        item: t.item ?? "",
        fault: t.fault ?? "",
        mechanic_id: t.mechanic_id != null ? String(t.mechanic_id) : "",
        uniq_id: t.uniq_id ?? "",
        remark: t.remark ?? "",
      }));
      setRows(tRows);
      setLoaded(true);
      if (tRows.length === 0) setToast({ type: "warn", msg: "Is client ke koi transactions nahi mile." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Load failed!";
      setToast({ type: "error", msg });
    } finally {
      setRowLoading(false);
    }
  };

  // ── Update row field ───────────────────────────────────────────────────────
  const updateRow = (id: number, field: keyof TxnRow, val: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  // ── Apply global client to all rows ────────────────────────────────────────
  const applyGlobalClient = (cid: string) => {
    setGlobalClient(cid);
    if (!cid) return;
    const c = clients.find(x => x.id === Number(cid));
    const label = c ? clientLabel(c) : "Unknown";
    setRows(prev => prev.map(r => ({ ...r, client_id: cid, client_name: label })));
  };

  // ── Save all ───────────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    if (rows.length === 0) { setToast({ type: "warn", msg: "Pehle transactions load karo!" }); return; }

    const invalid = rows.filter(r => !r.client_id.trim() || !r.item.trim() || !r.fault.trim());
    if (invalid.length > 0) {
      setToast({ type: "error", msg: `${invalid.length} row(s) mein Client/Item/Fault khaali hai!` });
      return;
    }

    setSaving(true);
    try {
      let updated = 0;
      for (const r of rows) {
        const payload: Record<string, unknown> = {
          client_name: String(r.client_id),
          item: r.item.trim(),
          fault: r.fault.trim(),
          uniq_id: r.uniq_id.trim() || "",
          remark: r.remark.trim() || "",
          date_updated: nowIST(),
        };
        if (r.mechanic_id) payload.mechanic_id = parseInt(r.mechanic_id);
        else payload.mechanic_id = null;
        const { error } = await supabase.from("transaction_list").update(payload).eq("id", r.id);
        if (error) throw new Error(`Transaction #${r.id} update failed: ${error.message}`);
        updated++;
      }
      setToast({ type: "success", msg: `${updated} transactions update ho gaye! ✅` });
      setTimeout(() => router.push("/jobs"), 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed!";
      setToast({ type: "error", msg });
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 bg-[#0d1117]">
      <Loader2 className="animate-spin text-blue-500" size={38}/>
      <p className="text-slate-600 text-xs font-black uppercase tracking-widest">Loading...</p>
    </div>
  );

  const mechOptions = mechanics.map(m => ({
    id: m.id,
    name: [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" "),
  }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-16">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold ${
          toast.type === "success" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
          : toast.type === "warn"  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
          : "bg-red-500/15 border-red-500/30 text-red-400"
        }`}>
          {toast.type === "success" ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
          {toast.msg}
        </div>
      )}

      <div className="max-w-[1300px] mx-auto px-3 sm:px-5 pt-4 space-y-4">

        {/* ── Header ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
              <Wrench size={18} className="text-white"/>
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Bulk Edit Transactions</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                {loaded
                  ? <span className="text-blue-400 font-black">{rows.length} transactions loaded</span>
                  : "Client select karke transactions load karo"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/jobs" className="flex items-center gap-1.5 px-4 py-2 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-300 rounded-xl text-xs font-bold no-underline transition-all">
              <ArrowLeft size={13}/> Cancel
            </Link>
            <button onClick={handleSaveAll} disabled={saving || rows.length === 0}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50 shadow-lg shadow-blue-900/30">
              {saving ? <><Loader2 size={13} className="animate-spin"/>Saving...</> : <><Save size={13}/> Save All Changes</>}
            </button>
          </div>
        </div>

        {/* ── Source Client + Global Client ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                <span className="inline-flex items-center gap-1"><User size={11}/> Source Client <span className="text-red-400">*</span></span>
              </label>
              <select value={sourceClient} onChange={e => setSourceClient(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all" required>
                <option value="">Search Client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
              </select>
            </div>
            <button onClick={loadTransactions} disabled={rowLoading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50 h-[42px]">
              {rowLoading ? <><Loader2 size={13} className="animate-spin"/>Loading...</> : <><Search size={13}/> Load</>}
            </button>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                <span className="inline-flex items-center gap-1"><Users size={11}/> Apply New Client to All</span>
              </label>
              <select value={globalClient} onChange={e => applyGlobalClient(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all">
                <option value="">Select Target Client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
              </select>
              <p className="text-[10px] text-slate-600 mt-1">Saari rows ka client ek saath badlega.</p>
            </div>
          </div>
        </div>

        {rowLoading && (
          <div className="text-center py-10">
            <Loader2 size={28} className="animate-spin text-blue-400 mx-auto mb-2"/>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Loading transactions...</p>
          </div>
        )}

        {!rowLoading && loaded && rows.length === 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center text-amber-400 text-sm font-bold">
            Is client ke koi transactions nahi mile.
          </div>
        )}

        {/* ── Desktop Table View ── */}
        {!rowLoading && loaded && rows.length > 0 && (
          <div className="hidden md:block bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-blue-900/40 border-b border-[#21293d]">
                  <th className="px-3 py-3 text-center text-[9px] font-black text-blue-300 uppercase w-10">#</th>
                  <th className="px-3 py-3 text-center text-[9px] font-black text-blue-300 uppercase w-24">Job ID</th>
                  <th className="px-3 py-3 text-left text-[9px] font-black text-blue-300 uppercase w-52">Target Client <span className="text-red-400">*</span></th>
                  <th className="px-3 py-3 text-left text-[9px] font-black text-blue-300 uppercase">Item / Model <span className="text-red-400">*</span></th>
                  <th className="px-3 py-3 text-left text-[9px] font-black text-blue-300 uppercase">Fault Reported <span className="text-red-400">*</span></th>
                  <th className="px-3 py-3 text-left text-[9px] font-black text-blue-300 uppercase w-36">Assign To</th>
                  <th className="px-3 py-3 text-left text-[9px] font-black text-blue-300 uppercase w-28">Unique ID</th>
                  <th className="px-3 py-3 text-left text-[9px] font-black text-blue-300 uppercase w-32">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21293d]">
                {rows.map((row, i) => (
                  <tr key={row.id} className="hover:bg-white/[0.015] transition-colors">
                    <td className="px-3 py-2.5 text-center text-slate-600 font-bold">{i+1}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 bg-[#0d1117] border border-[#21293d] rounded-lg px-2.5 py-1.5 justify-center">
                        <Hash size={10} className="text-slate-600"/>
                        <span className="text-amber-400 font-black text-xs">{row.job_id}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <select value={row.client_id}
                        onChange={e => {
                          const c = clients.find(x => x.id === Number(e.target.value));
                          updateRow(row.id, "client_id", e.target.value);
                          updateRow(row.id, "client_name", c ? clientLabel(c) : "Unknown");
                        }}
                        className={iCls} required>
                        <option value="">Select Client</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <input type="text" value={row.item}
                        onChange={e => updateRow(row.id, "item", e.target.value)}
                        placeholder="Item / Model" className={iCls} required/>
                    </td>
                    <td className="px-3 py-2.5">
                      <input type="text" value={row.fault}
                        onChange={e => updateRow(row.id, "fault", e.target.value)}
                        placeholder="Fault" className={iCls} required/>
                    </td>
                    <td className="px-3 py-2.5">
                      <select value={row.mechanic_id}
                        onChange={e => updateRow(row.id, "mechanic_id", e.target.value)}
                        className={iCls}>
                        <option value="">Select</option>
                        {mechOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <input type="text" value={row.uniq_id}
                        onChange={e => updateRow(row.id, "uniq_id", e.target.value)}
                        placeholder="Location/ID" className={iCls}/>
                    </td>
                    <td className="px-3 py-2.5">
                      <input type="text" value={row.remark}
                        onChange={e => updateRow(row.id, "remark", e.target.value)}
                        placeholder="Notes" className={iCls}/>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Mobile Card View ── */}
        {!rowLoading && loaded && rows.length > 0 && (
          <div className="md:hidden space-y-3">
            {rows.map((row, i) => (
              <div key={row.id}
                className="bg-[#161b27] border border-[#21293d] border-l-4 border-l-blue-500 rounded-2xl p-4 relative">
                <span className="absolute top-3 right-4 text-slate-700 font-black text-lg">#{i+1}</span>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={lCls}>Job ID</label>
                    <div className="flex items-center gap-1 bg-[#0d1117] border border-[#21293d] rounded-lg px-2.5 py-2">
                      <Hash size={10} className="text-slate-600"/>
                      <span className="text-amber-400 font-black text-xs">{row.job_id}</span>
                    </div>
                  </div>
                  <div>
                    <label className={lCls}>Unique ID</label>
                    <input type="text" value={row.uniq_id}
                      onChange={e => updateRow(row.id, "uniq_id", e.target.value)}
                      placeholder="Location/ID" className={iCls}/>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <label className={lCls}>Target Client *</label>
                    <select value={row.client_id}
                      onChange={e => {
                        const c = clients.find(x => x.id === Number(e.target.value));
                        updateRow(row.id, "client_id", e.target.value);
                        updateRow(row.id, "client_name", c ? clientLabel(c) : "Unknown");
                      }}
                      className={iCls} required>
                      <option value="">Select Client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Item / Model *</label>
                    <input type="text" value={row.item}
                      onChange={e => updateRow(row.id, "item", e.target.value)}
                      placeholder="Item Name / Model" className={iCls}/>
                  </div>
                  <div>
                    <label className={lCls}>Fault Reported *</label>
                    <input type="text" value={row.fault}
                      onChange={e => updateRow(row.id, "fault", e.target.value)}
                      placeholder="Reported Fault" className={iCls}/>
                  </div>
                  <div>
                    <label className={lCls}>Assign To</label>
                    <select value={row.mechanic_id}
                      onChange={e => updateRow(row.id, "mechanic_id", e.target.value)}
                      className={iCls}>
                      <option value="">Select Mechanic</option>
                      {mechOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Remarks</label>
                    <input type="text" value={row.remark}
                      onChange={e => updateRow(row.id, "remark", e.target.value)}
                      placeholder="Additional notes" className={iCls}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Bottom Actions ── */}
        {loaded && rows.length > 0 && (
          <div className="flex items-center justify-end flex-wrap gap-3 py-2">
            <button onClick={loadTransactions} disabled={rowLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-300 rounded-xl text-sm font-bold transition-all">
              <RefreshCw size={15}/> Reload
            </button>
            <button onClick={handleSaveAll} disabled={saving}
              className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm transition-all disabled:opacity-50 shadow-lg shadow-blue-900/30">
              {saving ? <><Loader2 size={15} className="animate-spin"/>Saving...</> : <><Save size={15}/> Save All Changes</>}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
