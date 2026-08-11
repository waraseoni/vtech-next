"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Plus, Wrench,
  Loader2, AlertTriangle, CheckCircle, Hash, Trash2,
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
function todayISTStr(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const p: Record<string, string> = {};
  parts.forEach(x => { p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}`;
}
async function genCode(offset = 0): Promise<string> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const p: Record<string, string> = {};
  parts.forEach(x => { p[x.type] = x.value; });
  const prefix = `${p.year}${p.month}${p.day}`;
  const { data } = await supabase.from("transaction_list")
    .select("code").like("code", `${prefix}%`).order("code", { ascending: false }).limit(1);
  const lastSeq = data?.[0]?.code ? parseInt(data[0].code.slice(8)) || 0 : 0;
  return `${prefix}${String(lastSeq + 1 + offset).padStart(2, "0")}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Client   { id: number; firstname: string; middlename: string; lastname: string; contact: string; }
interface Mechanic { id: number; firstname: string; middlename: string; lastname: string; }
interface BulkRow  {
  id: number;           // local key only
  estJobId: number;     // estimated job id (display)
  item: string;
  fault: string;
  mechanic_id: string;
  uniq_id: string;
  remark: string;
}

const iCls = "w-full px-2.5 py-2 bg-[#0d1117] border border-[#21293d] rounded-lg text-xs text-white outline-none focus:border-blue-500/60 transition-all";
const lCls = "block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BulkJobPage() {
  const router = useRouter();

  const [clients,   setClients]   = useState<Client[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [clientId,  setClientId]  = useState("");
  const [globalMech,setGlobalMech]= useState("");
  const [baseJobId, setBaseJobId] = useState(0);
  const [rows,      setRows]      = useState<BulkRow[]>([]);
  const [rowKey,    setRowKey]    = useState(100); // unique key counter
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState<{ type: "success"|"error"|"warn"; msg: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Fetch master data ──────────────────────────────────────────────────────
  const fetchMaster = useCallback(async () => {
    setLoading(true);
    const [cRes, mRes, ctrRes] = await Promise.all([
      supabase.from("client_list")
        .select("id, firstname, middlename, lastname, contact")
        .eq("delete_flag", 0).order("firstname"),
      supabase.from("mechanic_list")
        .select("id, firstname, middlename, lastname")
        .eq("status", 1).order("firstname"),
      supabase.from("job_id_counter").select("last_job_id").single(),
    ]);
    setClients(cRes.data || []);
    setMechanics(mRes.data || []);
    const nextId = (ctrRes.data?.last_job_id || 27650) + 1;
    setBaseJobId(nextId);
    // Start with 3 empty rows
    const initial: BulkRow[] = [0,1,2].map(i => ({
      id: i, estJobId: nextId + i, item: "", fault: "", mechanic_id: "", uniq_id: "", remark: "",
    }));
    setRows(initial);
    setRowKey(3);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMaster(); }, [fetchMaster]);

  // ── Add row ────────────────────────────────────────────────────────────────
  const addRow = () => {
    const newEstJobId = baseJobId + rows.length;
    setRows(prev => [...prev, {
      id: rowKey, estJobId: newEstJobId,
      item: "", fault: "", mechanic_id: globalMech, uniq_id: "", remark: "",
    }]);
    setRowKey(k => k + 1);
  };

  // ── Remove row ─────────────────────────────────────────────────────────────
  const removeRow = (id: number) => {
    if (rows.length <= 1) { setToast({ type: "warn", msg: "Kam se kam ek row zaroori hai!" }); return; }
    setRows(prev => {
      const filtered = prev.filter(r => r.id !== id);
      // Re-calculate estimated job IDs
      return filtered.map((r, i) => ({ ...r, estJobId: baseJobId + i }));
    });
  };

  // ── Update row field ───────────────────────────────────────────────────────
  const updateRow = (id: number, field: keyof BulkRow, val: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  // ── Apply global mechanic to all empty rows ────────────────────────────────
  const applyGlobalMech = (mechId: string) => {
    setGlobalMech(mechId);
    setRows(prev => prev.map(r => r.mechanic_id === "" ? { ...r, mechanic_id: mechId } : r));
  };

  // ── Save all ───────────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    if (!clientId) { setToast({ type: "error", msg: "Pehle client select karo!" }); return; }

    // Filter non-empty rows
    const validRows = rows.filter(r => r.item.trim() && r.fault.trim());
    if (validRows.length === 0) {
      setToast({ type: "error", msg: "Kam se kam ek row mein item aur fault fill karo!" }); return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles")
        .select("mechanic_id").eq("id", user!.id).single();
      const userId = profile?.mechanic_id || 0;

      // Get fresh job counter
      const { data: ctr } = await supabase.from("job_id_counter").select("last_job_id").single();
      const nextJobId = (ctr?.last_job_id || 0) + 1;
      const today = todayISTStr();

      let savedCount = 0;
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const code = await genCode(i);
        const jobIdStr = String(nextJobId + i);

        const { error } = await supabase.from("transaction_list").insert({
          client_name:               String(clientId),
          job_id:                    jobIdStr,
          code,
          item:                      row.item.trim(),
          fault:                     row.fault.trim(),
          remark:                    row.remark.trim() || "",
          uniq_id:                   row.uniq_id.trim() || "",
          amount:                    0,
          status:                    0,
          del_status:                0,
          mechanic_id:               row.mechanic_id ? parseInt(row.mechanic_id) : null,
          mechanic_amount:           0,
          mechanic_commission_amount:0,
          user_id:                   userId,
          date_created:              `${today}T00:00:00+05:30`,
          date_updated:              nowIST(),
        }).select("id").single();

        if (error) throw new Error(`Row ${i+1} save failed: ${error.message}`);
        savedCount++;
      }

      // Update job_id_counter
      await supabase.from("job_id_counter")
        .update({ last_job_id: nextJobId + validRows.length - 1 }).eq("id", 1);

      setToast({ type: "success", msg: `${savedCount} jobs saved successfully!` });
      setTimeout(() => router.push("/jobs"), 1000);

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

      <div className="max-w-[1200px] mx-auto px-3 sm:px-5 pt-4 space-y-4">

        {/* ── Header ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center">
              <Wrench size={18} className="text-white"/>
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Bulk Job Sheet Entry</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                Multi-item entry · Start Job ID:
                <span className="ml-1 text-amber-400 font-black">#{baseJobId}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/jobs" className="flex items-center gap-1.5 px-4 py-2 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-300 rounded-xl text-xs font-bold no-underline transition-all">
              <ArrowLeft size={13}/> Cancel
            </Link>
            <button onClick={handleSaveAll} disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/30">
              {saving ? <><Loader2 size={13} className="animate-spin"/>Saving...</> : <><Save size={13}/> Save All Items</>}
            </button>
          </div>
        </div>

        {/* ── Client + Global Mechanic ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Client Name <span className="text-red-400">*</span>
              </label>
              <select value={clientId} onChange={e => setClientId(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all" required>
                <option value="">Search Client...</option>
                {clients.map(c => {
                  const name = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ");
                  return <option key={c.id} value={c.id}>{name}{c.contact ? ` (${c.contact})` : ""}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Default Mechanic (sabhi rows ke liye)
              </label>
              <select value={globalMech} onChange={e => applyGlobalMech(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all">
                <option value="">Select Default Mechanic</option>
                {mechOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Desktop Table View ── */}
        <div className="hidden md:block bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-emerald-900/40 border-b border-[#21293d]">
                <th className="px-3 py-3 text-center text-[9px] font-black text-emerald-300 uppercase w-10">#</th>
                <th className="px-3 py-3 text-center text-[9px] font-black text-emerald-300 uppercase w-24">Job ID (Est.)</th>
                <th className="px-3 py-3 text-left text-[9px] font-black text-emerald-300 uppercase">Item / Model <span className="text-red-400">*</span></th>
                <th className="px-3 py-3 text-left text-[9px] font-black text-emerald-300 uppercase">Fault Reported <span className="text-red-400">*</span></th>
                <th className="px-3 py-3 text-left text-[9px] font-black text-emerald-300 uppercase w-36">Assign To</th>
                <th className="px-3 py-3 text-left text-[9px] font-black text-emerald-300 uppercase w-28">Unique ID</th>
                <th className="px-3 py-3 text-left text-[9px] font-black text-emerald-300 uppercase w-32">Remarks</th>
                <th className="px-3 py-3 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21293d]">
              {rows.map((row, i) => (
                <tr key={row.id} className="hover:bg-white/[0.015] transition-colors">
                  <td className="px-3 py-2.5 text-center text-slate-600 font-bold">{i+1}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 bg-[#0d1117] border border-[#21293d] rounded-lg px-2.5 py-1.5 justify-center">
                      <Hash size={10} className="text-slate-600"/>
                      <span className="text-amber-400 font-black text-xs">{row.estJobId}</span>
                    </div>
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
                  <td className="px-3 py-2.5 text-center">
                    <button onClick={() => removeRow(row.id)}
                      className="w-7 h-7 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                      <Trash2 size={11}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Mobile Card View ── */}
        <div className="md:hidden space-y-3">
          {rows.map((row, i) => (
            <div key={row.id}
              className="bg-[#161b27] border border-[#21293d] border-l-4 border-l-emerald-500 rounded-2xl p-4 relative">
              <span className="absolute top-3 right-4 text-slate-700 font-black text-lg">#{i+1}</span>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={lCls}>Job ID (Est.)</label>
                  <div className="flex items-center gap-1 bg-[#0d1117] border border-[#21293d] rounded-lg px-2.5 py-2">
                    <Hash size={10} className="text-slate-600"/>
                    <span className="text-amber-400 font-black text-xs">{row.estJobId}</span>
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
              <button onClick={() => removeRow(row.id)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-bold transition-colors">
                <Trash2 size={12}/> Remove This Item
              </button>
            </div>
          ))}
        </div>

        {/* ── Bottom Actions ── */}
        <div className="flex items-center justify-between flex-wrap gap-3 py-2">
          <button onClick={addRow}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-300 rounded-xl text-sm font-bold transition-all">
            <Plus size={15}/> Add New Row
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600">
              {rows.filter(r => r.item.trim() && r.fault.trim()).length} / {rows.length} rows filled
            </span>
            <button onClick={handleSaveAll} disabled={saving}
              className="flex items-center gap-2 px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/30">
              {saving ? <><Loader2 size={15} className="animate-spin"/>Saving...</> : <><Save size={15}/> Save All Items</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}