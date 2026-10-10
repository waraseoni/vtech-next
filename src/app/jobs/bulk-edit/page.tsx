"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Search,
  User,
  Wrench,
  Hash,
  Loader2,
  RefreshCw,
  Users,
  ClipboardList,
} from "lucide-react";
import PageLoader from "@/components/PageLoader";
import SearchableSelect from "@/components/SearchableSelect";
import { toast } from "@/lib/toast";

// ─── IST Helper ───────────────────────────────────────────────────────────────
function nowIST(): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}+05:30`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Client {
  id: number;
  firstname: string;
  middlename: string;
  lastname: string;
  contact: string;
}
interface Mechanic {
  id: number;
  firstname: string;
  middlename: string;
  lastname: string;
}
interface TxnRow {
  id: number;
  job_id: string | null;
  client_id: string; // stored client_name as string id
  client_name: string; // resolved display
  item: string;
  fault: string;
  mechanic_id: string;
  uniq_id: string;
  remark: string;
}

const iCls =
  "w-full px-2.5 py-2 bg-app border border-app rounded-lg text-xs text-white outline-none focus:border-blue-500/60 transition-all";
const lCls = "block text-[9px] font-bold uppercase tracking-wider text-muted mb-1";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BulkEditPage() {
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [sourceClient, setSourceClient] = useState("");
  const [globalClient, setGlobalClient] = useState("");
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowLoading, setRowLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loadedFrom, setLoadedFrom] = useState("");

  // ── Fetch master data ──────────────────────────────────────────────────────
  const fetchMaster = useCallback(async () => {
    setLoading(true);
    const [cRes, mRes] = await Promise.all([
      supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname, contact")
        .eq("delete_flag", 0)
        .order("firstname"),
      supabase
        .from("mechanic_list")
        .select("id, firstname, middlename, lastname")
        .eq("delete_flag", 0)
        .eq("status", 1)
        .order("firstname"),
    ]);
    setClients(cRes.data || []);
    setMechanics(mRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMaster();
  }, [fetchMaster]);

  const clientLabel = (c: Client) => {
    const name = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ");
    return `${name}${c.contact ? ` (${c.contact})` : ""}`;
  };

  // ── Load transactions for source client ────────────────────────────────────
  const loadTransactions = async () => {
    if (!sourceClient) {
      toast.warning("Pehle Source Client select karo!");
      return;
    }
    setRowLoading(true);
    setRows([]);
    setLoaded(false);
    setGlobalClient("");
    setSelected(new Set());
    setLoadedFrom(sourceClient);
    try {
      const { data, error } = await supabase
        .from("transaction_list")
        .select("id, job_id, client_name, item, fault, mechanic_id, uniq_id, remark")
        .eq("client_name", sourceClient)
        .eq("del_status", 0)
        .order("id", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const tRows: TxnRow[] = (data || []).map((t) => ({
        id: t.id,
        job_id: t.job_id,
        client_id: t.client_name ?? "",
        client_name: clientLabel(
          clients.find((c) => c.id === Number(t.client_name)) || {
            id: 0,
            firstname: "Unknown",
            middlename: "",
            lastname: "",
            contact: "",
          }
        ),
        item: t.item ?? "",
        fault: t.fault ?? "",
        mechanic_id: t.mechanic_id != null ? String(t.mechanic_id) : "",
        uniq_id: t.uniq_id ?? "",
        remark: t.remark ?? "",
      }));
      setRows(tRows);
      setLoaded(true);
      if (tRows.length === 0) toast.warning("Is client ke koi transactions nahi mile.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Load failed!";
      toast.error(msg);
    } finally {
      setRowLoading(false);
    }
  };

  // ── Update row field ───────────────────────────────────────────────────────
  const updateRow = (id: number, field: keyof TxnRow, val: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  };

  const labelOf = (cid: string) => {
    const c = clients.find((x) => x.id === Number(cid));
    return c ? clientLabel(c) : "Unknown";
  };

  // ── Selection: tick wali rows = Target Client follow karte hain ────────────
  const masterRef = useRef<HTMLInputElement>(null);
  const masterRef2 = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const ind = selected.size > 0 && selected.size < rows.length;
    for (const el of [masterRef.current, masterRef2.current]) {
      if (el) el.indeterminate = ind;
    }
  }, [selected, rows.length]);

  const toggleRow = (row: TxnRow, checked: boolean) => {
    if (checked) {
      if (!globalClient) {
        toast.warning("Pehle Target Client select karo!");
        return;
      }
      const label = labelOf(globalClient);
      setSelected((prev) => new Set(prev).add(row.id));
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, client_id: globalClient, client_name: label } : r
        )
      );
    } else {
      // Untick = transfer nahi — row wapas Source Client par
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete(row.id);
        return n;
      });
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, client_id: loadedFrom, client_name: labelOf(loadedFrom) } : r
        )
      );
    }
  };

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      // Sirf tick wali rows wapas Source par — manual custom targets safe
      const sel = selected;
      setRows((prev) =>
        prev.map((r) =>
          sel.has(r.id) ? { ...r, client_id: loadedFrom, client_name: labelOf(loadedFrom) } : r
        )
      );
      setSelected(new Set());
      return;
    }
    if (!globalClient) {
      toast.warning("Pehle Target Client select karo!");
      return;
    }
    const label = labelOf(globalClient);
    setRows((prev) => prev.map((r) => ({ ...r, client_id: globalClient, client_name: label })));
    setSelected(new Set(rows.map((r) => r.id)));
  };

  // ── Apply target client → sirf tick wali rows ──────────────────────────────
  const applyGlobalClient = (cid: string) => {
    setGlobalClient(cid);
    if (!cid) return;
    if (cid === loadedFrom) toast.warning("Target Client = Source Client hai!");
    const label = labelOf(cid);
    const sel = selected;
    setRows((prev) =>
      prev.map((r) => (sel.has(r.id) ? { ...r, client_id: cid, client_name: label } : r))
    );
  };

  // ── Save all ───────────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    if (rows.length === 0) {
      toast.warning("Pehle transactions load karo!");
      return;
    }

    const invalid = rows.filter((r) => !r.client_id.trim() || !r.item.trim() || !r.fault.trim());
    if (invalid.length > 0) {
      toast.error(`${invalid.length} row(s) mein Client/Item/Fault khaali hai!`);
      return;
    }

    const clientChanges = rows.filter((r) => r.client_id !== loadedFrom).length;
    if (
      clientChanges > 0 &&
      !confirm(
        `${rows.length} row(s) update honge — unme se ${clientChanges} ka client ${labelOf(loadedFrom)} se badal raha hai. Save karein?`
      )
    ) {
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
      toast.success(`${updated} transactions update ho gaye! ✅`);
      setTimeout(() => router.replace("/jobs"), 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed!";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <PageLoader icon={ClipboardList} label="loading..." tone="blue" />;

  const mechOptions = mechanics.map((m) => ({
    id: m.id,
    name: [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" "),
  }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-app font-sans pb-16">
      <div className="max-w-[1300px] mx-auto px-3 sm:px-5 pt-4 space-y-4">
        {/* ── Header ── */}
        <div className="bg-panel border border-app rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
              <Wrench size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Bulk Edit Transactions</h1>
              <p className="text-[10px] text-muted uppercase tracking-wider">
                {loaded ? (
                  <span className="text-blue-400 font-black">
                    {rows.length} transactions loaded
                  </span>
                ) : (
                  "Client select karke transactions load karo"
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/jobs"
              className="flex items-center gap-1.5 px-4 py-2 bg-panel-2 border border-app-2 hover:bg-panel-2 text-app-2 rounded-xl text-xs font-bold no-underline transition-all"
            >
              <ArrowLeft size={13} /> Cancel
            </Link>
            <button
              onClick={handleSaveAll}
              disabled={saving || rows.length === 0}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50 shadow-lg shadow-blue-900/30"
            >
              {saving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={13} /> Save All Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Source Client + Global Client ── */}
        <div className="bg-panel border border-app rounded-2xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                <span className="inline-flex items-center gap-1">
                  <User size={11} /> Source Client <span className="text-red-400">*</span>
                </span>
              </label>
              <SearchableSelect
                value={sourceClient || null}
                options={clients.map((c) => ({ id: c.id, label: clientLabel(c) }))}
                onSelect={(v) => setSourceClient(v)}
                placeholder="Search Client..."
                clearLabel="Search Client..."
              />
            </div>
            <button
              onClick={loadTransactions}
              disabled={rowLoading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50 h-[42px]"
            >
              {rowLoading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Search size={13} /> Load
                </>
              )}
            </button>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                <span className="inline-flex items-center gap-1">
                  <Users size={11} /> Target Client <span className="text-red-400">*</span>
                </span>
              </label>
              <SearchableSelect
                value={globalClient || null}
                options={clients.map((c) => ({ id: c.id, label: clientLabel(c) }))}
                onSelect={(v) => applyGlobalClient(v)}
                placeholder="Select Target Client"
                clearLabel="Select Target Client"
              />
              <p className="text-[10px] text-muted-2 mt-1">
                Sirf tick (✓) wali rows ka client isse badlega.
              </p>
            </div>
          </div>

          {/* ── Selection bar (master checkbox + counter) ── */}
          {loaded && rows.length > 0 && (
            <div className="mt-4 pt-4 border-t border-app flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  ref={masterRef}
                  type="checkbox"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="w-4 h-4 accent-blue-500"
                  aria-label="Select all jobs"
                />
                <span className="text-xs font-bold text-app-2">Select all</span>
              </label>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-blue-500/15 text-blue-300 tabular-nums">
                {selected.size} / {rows.length} selected
              </span>
              {selected.size > 0 && globalClient && (
                <span className="text-[10px] font-bold text-emerald-300">
                  → {labelOf(globalClient)} par transfer honge
                </span>
              )}
              <span className="text-[10px] text-muted-2 sm:ml-auto">
                Tick = Target Client follow; untick = Source par wapas.
              </span>
            </div>
          )}
        </div>

        {rowLoading && (
          <div className="text-center py-10">
            <Loader2 size={28} className="animate-spin text-blue-400 mx-auto mb-2" />
            <p className="text-muted text-xs font-bold uppercase tracking-widest">
              Loading transactions...
            </p>
          </div>
        )}

        {!rowLoading && loaded && rows.length === 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center text-amber-400 text-sm font-bold">
            Is client ke koi transactions nahi mile.
          </div>
        )}

        {/* ── Desktop Table View ── */}
        {!rowLoading && loaded && rows.length > 0 && (
          <div className="hidden md:block bg-panel border border-app rounded-2xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-blue-900/40 border-b border-app">
                  <th className="px-2 py-3 text-center w-10">
                    <input
                      ref={masterRef2}
                      type="checkbox"
                      checked={rows.length > 0 && selected.size === rows.length}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="w-4 h-4 accent-blue-500"
                      aria-label="Select all jobs"
                    />
                  </th>
                  <th className="px-3 py-3 text-center text-[9px] font-black text-blue-300 uppercase w-10">
                    #
                  </th>
                  <th className="px-3 py-3 text-center text-[9px] font-black text-blue-300 uppercase w-24">
                    Job ID
                  </th>
                  <th className="px-3 py-3 text-left text-[9px] font-black text-blue-300 uppercase w-52">
                    Target Client <span className="text-red-400">*</span>
                  </th>
                  <th className="px-3 py-3 text-left text-[9px] font-black text-blue-300 uppercase">
                    Item / Model <span className="text-red-400">*</span>
                  </th>
                  <th className="px-3 py-3 text-left text-[9px] font-black text-blue-300 uppercase">
                    Fault Reported <span className="text-red-400">*</span>
                  </th>
                  <th className="px-3 py-3 text-left text-[9px] font-black text-blue-300 uppercase w-36">
                    Assign To
                  </th>
                  <th className="px-3 py-3 text-left text-[9px] font-black text-blue-300 uppercase w-28">
                    Unique ID
                  </th>
                  <th className="px-3 py-3 text-left text-[9px] font-black text-blue-300 uppercase w-32">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21293d]">
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      selected.has(row.id) ? "bg-emerald-500/[0.06]" : "hover:bg-white/[0.015]"
                    }`}
                  >
                    <td className="px-2 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={(e) => toggleRow(row, e.target.checked)}
                        className="w-4 h-4 accent-emerald-500 cursor-pointer"
                        aria-label={`Job ${row.job_id} select karo`}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center text-muted-2 font-bold">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 bg-app border border-app rounded-lg px-2.5 py-1.5 justify-center">
                        <Hash size={10} className="text-muted-2" />
                        <span className="text-amber-400 font-black text-xs">{row.job_id}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <SearchableSelect
                        value={row.client_id}
                        options={clients.map((c) => ({ id: c.id, label: clientLabel(c) }))}
                        onSelect={(v) => {
                          const c = clients.find((x) => x.id === Number(v));
                          updateRow(row.id, "client_id", v);
                          updateRow(row.id, "client_name", c ? clientLabel(c) : "Unknown");
                        }}
                        placeholder="Select Client"
                        clearLabel="Select Client"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        value={row.item}
                        onChange={(e) => updateRow(row.id, "item", e.target.value)}
                        placeholder="Item / Model"
                        className={iCls}
                        required
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        value={row.fault}
                        onChange={(e) => updateRow(row.id, "fault", e.target.value)}
                        placeholder="Fault"
                        className={iCls}
                        required
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <SearchableSelect
                        value={row.mechanic_id}
                        options={mechOptions.map((m) => ({ id: m.id, label: m.name }))}
                        onSelect={(v) => updateRow(row.id, "mechanic_id", v)}
                        placeholder="Select"
                        clearLabel="Select"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        value={row.uniq_id}
                        onChange={(e) => updateRow(row.id, "uniq_id", e.target.value)}
                        placeholder="Location/ID"
                        className={iCls}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        value={row.remark}
                        onChange={(e) => updateRow(row.id, "remark", e.target.value)}
                        placeholder="Notes"
                        className={iCls}
                      />
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
              <div
                key={row.id}
                className={`rounded-2xl p-4 relative border border-app border-l-4 ${
                  selected.has(row.id)
                    ? "bg-panel border-l-emerald-400"
                    : "bg-panel border-l-blue-500"
                }`}
              >
                <span className="absolute top-3 right-4 text-app font-black text-lg">#{i + 1}</span>
                <label className="flex items-center gap-2 mb-3 cursor-pointer select-none w-fit">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={(e) => toggleRow(row, e.target.checked)}
                    className="w-4 h-4 accent-emerald-500"
                    aria-label={`Job ${row.job_id} select karo`}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Transfer to Target Client
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={lCls}>Job ID</label>
                    <div className="flex items-center gap-1 bg-app border border-app rounded-lg px-2.5 py-2">
                      <Hash size={10} className="text-muted-2" />
                      <span className="text-amber-400 font-black text-xs">{row.job_id}</span>
                    </div>
                  </div>
                  <div>
                    <label className={lCls}>Unique ID</label>
                    <input
                      type="text"
                      value={row.uniq_id}
                      onChange={(e) => updateRow(row.id, "uniq_id", e.target.value)}
                      placeholder="Location/ID"
                      className={iCls}
                    />
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <label className={lCls}>Target Client *</label>
                    <SearchableSelect
                      value={row.client_id}
                      options={clients.map((c) => ({ id: c.id, label: clientLabel(c) }))}
                      onSelect={(v) => {
                        const c = clients.find((x) => x.id === Number(v));
                        updateRow(row.id, "client_id", v);
                        updateRow(row.id, "client_name", c ? clientLabel(c) : "Unknown");
                      }}
                      placeholder="Select Client"
                      clearLabel="Select Client"
                    />
                  </div>
                  <div>
                    <label className={lCls}>Item / Model *</label>
                    <input
                      type="text"
                      value={row.item}
                      onChange={(e) => updateRow(row.id, "item", e.target.value)}
                      placeholder="Item Name / Model"
                      className={iCls}
                    />
                  </div>
                  <div>
                    <label className={lCls}>Fault Reported *</label>
                    <input
                      type="text"
                      value={row.fault}
                      onChange={(e) => updateRow(row.id, "fault", e.target.value)}
                      placeholder="Reported Fault"
                      className={iCls}
                    />
                  </div>
                  <div>
                    <label className={lCls}>Assign To</label>
                    <SearchableSelect
                      value={row.mechanic_id}
                      options={mechOptions.map((m) => ({ id: m.id, label: m.name }))}
                      onSelect={(v) => updateRow(row.id, "mechanic_id", v)}
                      placeholder="Select Mechanic"
                      clearLabel="Select Mechanic"
                    />
                  </div>
                  <div>
                    <label className={lCls}>Remarks</label>
                    <input
                      type="text"
                      value={row.remark}
                      onChange={(e) => updateRow(row.id, "remark", e.target.value)}
                      placeholder="Additional notes"
                      className={iCls}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Bottom Actions ── */}
        {loaded && rows.length > 0 && (
          <div className="flex items-center justify-end flex-wrap gap-3 py-2">
            <button
              onClick={loadTransactions}
              disabled={rowLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-panel-2 border border-app-2 hover:bg-panel-2 text-app-2 rounded-xl text-sm font-bold transition-all"
            >
              <RefreshCw size={15} /> Reload
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm transition-all disabled:opacity-50 shadow-lg shadow-blue-900/30"
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={15} /> Save All Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
