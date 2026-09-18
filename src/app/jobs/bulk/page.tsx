"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, getCachedUser } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Plus,
  Wrench,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Hash,
  Trash2,
  ClipboardList,
} from "lucide-react";
import PageLoader from "@/components/PageLoader";
import SearchableSelect from "@/components/SearchableSelect";
import { getNextJobId, peekNextJobId, bumpJobCounter } from "@/lib/jobIdCounter";

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
async function genCode(offset = 0): Promise<string> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const p: Record<string, string> = {};
  parts.forEach((x) => {
    p[x.type] = x.value;
  });
  const prefix = `${p.year}${p.month}${p.day}`;
  const { data } = await supabase
    .from("transaction_list")
    .select("code")
    .like("code", `${prefix}%`)
    .order("code", { ascending: false })
    .limit(1);
  const lastSeq = data?.[0]?.code ? parseInt(data[0].code.slice(8)) || 0 : 0;
  return `${prefix}${String(lastSeq + 1 + offset).padStart(2, "0")}`;
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
interface BulkRow {
  id: number; // local key only
  estJobId: number; // estimated job id (display)
  item: string;
  fault: string;
  mechanic_id: string;
  uniq_id: string;
  remark: string;
}

const iCls =
  "w-full px-2.5 py-2 bg-[#0d1117] border border-[#21293d] rounded-lg text-xs text-white outline-none focus:border-blue-500/60 transition-all";
const iClsErr =
  "w-full px-2.5 py-2 bg-[#0d1117] border border-red-500/60 rounded-lg text-xs text-white outline-none focus:border-red-400 transition-all";
const lCls = "block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1";
const fieldErr = (fields: string[] | undefined, key: string) => fields?.includes(key);

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BulkJobPage() {
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [clientId, setClientId] = useState("");
  const [globalMech, setGlobalMech] = useState("");
  // Global mechanic ka hamesha-fresh mirror — searchable dropdown se select ke
  // baad addRow ko latest value mile (stale closure se bachne ke liye).
  const globalMechRef = useRef("");
  const [baseJobId, setBaseJobId] = useState(0);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [rowKey, setRowKey] = useState(100); // unique key counter
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Re-entrancy guard — double click / slow network par bulk save do baar na
  // chale (har baar fresh getNextJobId aur duplicate rows ki possibility).
  const savingRef = useRef(false);
  // Row-wise validation errors (missing fields) — save-block warning ke liye
  const [rowErrs, setRowErrs] = useState<Record<number, string[]>>({});
  const [toast, setToast] = useState<{ type: "success" | "error" | "warn"; msg: string } | null>(
    null
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

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
        .eq("status", 1)
        .order("firstname"),
    ]);
    setClients(cRes.data || []);
    setMechanics(mRes.data || []);
    const nextId = await peekNextJobId(); // preview only — no claim
    setBaseJobId(nextId);
    // Start with 3 empty rows
    const initial: BulkRow[] = [0, 1, 2].map((i) => ({
      id: i,
      estJobId: nextId + i,
      item: "",
      fault: "",
      mechanic_id: "",
      uniq_id: "",
      remark: "",
    }));
    setRows(initial);
    setRowKey(3);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMaster();
  }, [fetchMaster]);

  // ── Add row ────────────────────────────────────────────────────────────────
  const addRow = () => {
    const newEstJobId = baseJobId + rows.length;
    setRows((prev) => [
      ...prev,
      {
        id: rowKey,
        estJobId: newEstJobId,
        item: "",
        fault: "",
        mechanic_id: globalMechRef.current,
        uniq_id: "",
        remark: "",
      },
    ]);
    setRowKey((k) => k + 1);
  };

  // ── Remove row ─────────────────────────────────────────────────────────────
  const removeRow = (id: number) => {
    if (rows.length <= 1) {
      setToast({ type: "warn", msg: "Kam se kam ek row zaroori hai!" });
      return;
    }
    setRows((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      // Re-calculate estimated job IDs
      return filtered.map((r, i) => ({ ...r, estJobId: baseJobId + i }));
    });
  };

  // ── Update row field ───────────────────────────────────────────────────────
  const updateRow = (id: number, field: keyof BulkRow, val: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
    // Live re-validate — field bharte hi us row ka error turant hat jaye
    setRowErrs((prevErrs) => {
      if (!prevErrs[id]) return prevErrs;
      const updatedRows = rows.map((r) => (r.id === id ? { ...r, [field]: val } : r));
      const single = buildRowValidation(updatedRows)[id];
      const next = { ...prevErrs };
      if (single) next[id] = single;
      else delete next[id];
      return next;
    });
  };

  // ── Apply global mechanic to all empty rows ────────────────────────────────
  const applyGlobalMech = (mechId: string) => {
    setGlobalMech(mechId);
    globalMechRef.current = mechId;
    setRows((prev) => prev.map((r) => (r.mechanic_id === "" ? { ...r, mechanic_id: mechId } : r)));
    // Live re-validate — mechanic milte hi mechanic-less errors turant hat jaye
    setRowErrs((prevErrs) => {
      if (!Object.keys(prevErrs).length) return prevErrs;
      const updatedRows = rows.map((r) =>
        r.mechanic_id === "" ? { ...r, mechanic_id: mechId } : r
      );
      return buildRowValidation(updatedRows);
    });
  };

  // ── Row validation — missing fields ka map banao (row id → field names) ──
  const buildRowValidation = (list: BulkRow[]): Record<number, string[]> => {
    const errs: Record<number, string[]> = {};
    list.forEach((r) => {
      const miss: string[] = [];
      if (!r.item.trim()) miss.push("Item / Model");
      if (!r.fault.trim()) miss.push("Fault Reported");
      // Mechanic sirf unhi rows me mandatory hai jo save hongi (item+fault filled)
      if (r.item.trim() && r.fault.trim() && !r.mechanic_id) miss.push("Mechanic");
      if (miss.length) errs[r.id] = miss;
    });
    return errs;
  };

  // ── Save all ───────────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    if (savingRef.current) return;
    if (!clientId) {
      setToast({ type: "error", msg: "Pehle client select karo!" });
      return;
    }

    // Pehle validation — koi bhi row adhuri/mechanic-less hai to save band, warning + highlight
    const errs = buildRowValidation(rows);
    const missingIds = Object.keys(errs).length > 0;
    if (missingIds) {
      setRowErrs(errs);
      const labels = rows.map((r, i) => ({ r, i }))
        .filter(({ r }) => errs[r.id])
        .map(({ r, i }) => `Row ${i + 1} (#${r.estJobId}): ${errs[r.id].join(", ")}`);
      const short = labels.slice(0, 2).join(" | ");
      const countSuffix = labels.length > 2 ? ` ... aur ${labels.length - 2} rows` : "";
      setToast({ type: "warn", msg: `${labels.length} rows adhuri hain — ${short}${countSuffix}` });
      // Pehli adhuri row par smooth scroll + focus
      requestAnimationFrame(() => scrollToRowError(errs));
      return;
    }
    setRowErrs({});

    // Filter valid rows
    const validRows = rows.filter((r) => r.item.trim() && r.fault.trim() && r.mechanic_id);
    if (validRows.length === 0) {
      setToast({ type: "error", msg: "Kam se kam ek row mein item, fault aur mechanic fill karo!" });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await getCachedUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("mechanic_id")
        .eq("id", user!.id)
        .single();
      const userId = profile?.mechanic_id || 0;

      // Get fresh job counter
      const nextJobId = await getNextJobId();

      let savedCount = 0;
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const code = await genCode(i);
        const jobIdStr = String(nextJobId + i);
        const ts = nowIST();

        const { error } = await supabase
          .from("transaction_list")
          .insert({
            client_name: String(clientId),
            job_id: jobIdStr,
            code,
            item: row.item.trim(),
            fault: row.fault.trim(),
            remark: row.remark.trim() || "",
            uniq_id: row.uniq_id.trim() || "",
            amount: 0,
            status: 0,
            del_status: 0,
            mechanic_id: row.mechanic_id ? parseInt(row.mechanic_id) : null,
            mechanic_amount: 0,
            mechanic_commission_amount: 0,
            user_id: userId,
            date_created: ts,
            date_updated: ts,
          })
          .select("id")
          .single();

        if (error) throw new Error(`Row ${i + 1} save failed: ${error.message}`);
        savedCount++;
      }

      // Update job_id_counter
      await bumpJobCounter(nextJobId + validRows.length - 1);

      setToast({ type: "success", msg: `${savedCount} jobs saved successfully!` });
      setTimeout(() => router.replace("/jobs"), 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed!";
      setToast({ type: "error", msg });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // ── Save-block par pehli adhuri row par scroll + focus karo ─────────────
  // Dhyan rahe: desktop table + mobile cards dono DOM me exist karte hain —
  // isliye sirf VISIBLE row/field select karna zaroori hai (offsetParent check).
  const visibleEls = (sel: string) =>
    Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((e) => e.offsetParent !== null);

  const scrollToRowError = (errs: Record<number, string[]>) => {
    const firstId = Number(Object.keys(errs)[0]);
    if (!firstId) return;
    const el = visibleEls(`[data-bulk-row="${firstId}"]`)[0];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Pehla missing field focus karo (item → fault → mechanic)
    const errFields = errs[firstId] || [];
    setTimeout(() => {
      const sel = errFields.includes("Item / Model")
        ? `[data-bulk-input-item="${firstId}"]`
        : errFields.includes("Fault Reported")
          ? `[data-bulk-input-fault="${firstId}"]`
          : errFields.includes("Mechanic")
            ? `[data-bulk-mech="${firstId}"]`
            : null;
      if (!sel) return;
      const host = visibleEls(sel)[0];
      if (!host) return;
      if (sel.includes("bulk-mech")) {
        const btn = host.querySelector<HTMLElement>("button");
        btn?.focus({ preventScroll: true });
        btn?.click(); // SearchableSelect dropdown open
      } else {
        host.focus({ preventScroll: true });
      }
    }, 350);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <PageLoader icon={ClipboardList} label="loading..." tone="blue" />;

  const mechOptions = mechanics.map((m) => ({
    id: m.id,
    name: [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" "),
  }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-16">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold ${
            toast.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : toast.type === "warn"
                ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                : "bg-red-500/15 border-red-500/30 text-red-400"
          }`}
        >
          {toast.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-[1200px] mx-auto px-3 sm:px-5 pt-4 space-y-4">
        {/* ── Header ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center">
              <Wrench size={18} className="text-white" />
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
            <Link
              href="/jobs"
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-300 rounded-xl text-xs font-bold no-underline transition-all"
            >
              <ArrowLeft size={13} /> Cancel
            </Link>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/30"
            >
              {saving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={13} /> Save All Items
                </>
              )}
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
              <SearchableSelect
                value={clientId || null}
                options={clients.map((c) => {
                  const name = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ");
                  return { id: c.id, label: name, sub: c.contact ? `(${c.contact})` : undefined };
                })}
                onSelect={(v) => setClientId(v)}
                placeholder="Search Client..."
                clearLabel="Search Client..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Default Mechanic (sabhi rows ke liye)
              </label>
              <SearchableSelect
                value={globalMech || null}
                options={mechOptions.map((m) => ({ id: m.id, label: m.name }))}
                onSelect={(v) => applyGlobalMech(v)}
                placeholder="Select Default Mechanic"
                clearLabel="Select Default Mechanic"
              />
              <p className="text-[9px] text-slate-600 mt-1.5">
                Select karne par sabhi rows (purani aur nayi dono) me apply hota hai
              </p>
            </div>
          </div>
        </div>

        {/* ── Validation Warning Banner ── */}
        {Object.keys(rowErrs).length > 0 && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3">
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-300 font-medium">
              Save nahi hoga — neeche red-marked fields check karo:
              <span className="block mt-0.5 text-red-400 font-bold">
                {rows
                  .map((r, i) => ({ r, i }))
                  .filter(({ r }) => rowErrs[r.id])
                  .map(({ r, i }) => `Row ${i + 1} (#${r.estJobId}): ${rowErrs[r.id].join(", ")} missing`)
                  .join("  |  ")}
              </span>
            </div>
          </div>
        )}

        {/* ── Desktop Table View ── */}
        <div className="hidden md:block bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-emerald-900/40 border-b border-[#21293d]">
                <th className="px-3 py-3 text-center text-[9px] font-black text-emerald-300 uppercase w-10">
                  #
                </th>
                <th className="px-3 py-3 text-center text-[9px] font-black text-emerald-300 uppercase w-24">
                  Job ID (Est.)
                </th>
                <th className="px-3 py-3 text-left text-[9px] font-black text-emerald-300 uppercase">
                  Item / Model <span className="text-red-400">*</span>
                </th>
                <th className="px-3 py-3 text-left text-[9px] font-black text-emerald-300 uppercase">
                  Fault Reported <span className="text-red-400">*</span>
                </th>
                <th className="px-3 py-3 text-left text-[9px] font-black text-emerald-300 uppercase w-40">
                  Assign To
                </th>
                <th className="px-3 py-3 text-left text-[9px] font-black text-emerald-300 uppercase w-28">
                  Unique ID
                </th>
                <th className="px-3 py-3 text-left text-[9px] font-black text-emerald-300 uppercase w-32">
                  Remarks
                </th>
                <th className="px-3 py-3 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21293d]">
              {rows.map((row, i) => {
                const rErrs = rowErrs[row.id];
                return (
                  <tr
                    key={row.id}
                    data-bulk-row={row.id}
                    className={`transition-colors ${
                      rErrs ? "bg-red-500/[0.05]" : "hover:bg-white/[0.015]"
                    }`}
                  >
                    <td className="px-3 py-2.5 text-center text-slate-600 font-bold">
                      {i + 1}
                      {rErrs && (
                        <span className="block text-[8px] text-red-400 font-black uppercase">
                          missing
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 bg-[#0d1117] border border-[#21293d] rounded-lg px-2.5 py-1.5 justify-center">
                        <Hash size={10} className="text-slate-600" />
                        <span className="text-amber-400 font-black text-xs">{row.estJobId}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        data-bulk-input-item={row.id}
                        value={row.item}
                        onChange={(e) => updateRow(row.id, "item", e.target.value)}
                        placeholder="Item / Model"
                        className={fieldErr(rErrs, "Item / Model") ? iClsErr : iCls}
                        required
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        data-bulk-input-fault={row.id}
                        value={row.fault}
                        onChange={(e) => updateRow(row.id, "fault", e.target.value)}
                        placeholder="Fault"
                        className={fieldErr(rErrs, "Fault Reported") ? iClsErr : iCls}
                        required
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div
                        data-bulk-mech={row.id}
                        className={fieldErr(rErrs, "Mechanic") ? "rounded-xl ring-2 ring-red-500/60" : ""}
                      >
                        <SearchableSelect
                          value={row.mechanic_id}
                          options={mechOptions.map((m) => ({ id: m.id, label: m.name }))}
                          onSelect={(v) => updateRow(row.id, "mechanic_id", v)}
                          placeholder="Select"
                          clearLabel="Select"
                        />
                      </div>
                      {fieldErr(rErrs, "Mechanic") && (
                        <span className="block text-[9px] text-red-400 font-bold mt-0.5">
                          Mechanic select karo
                        </span>
                      )}
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
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => removeRow(row.id)}
                      className="w-7 h-7 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Mobile Card View ── */}
        <div className="md:hidden space-y-3">
          {rows.map((row, i) => {
            const rErrs = rowErrs[row.id];
            return (
              <div
                key={row.id}
                data-bulk-row={row.id}
                className={`bg-[#161b27] border rounded-2xl p-4 relative ${
                  rErrs
                    ? "border-red-500/60 border-l-4 border-l-red-500"
                    : "border-[#21293d] border-l-4 border-l-emerald-500"
                }`}
              >
                <span className="absolute top-3 right-4 text-slate-700 font-black text-lg">
                  #{i + 1}
                </span>
                {rErrs && (
                  <span className="inline-block text-[9px] text-red-400 font-black uppercase bg-red-500/10 border border-red-500/30 rounded-md px-1.5 py-0.5 mb-2">
                    {rErrs.join(", ")} missing
                  </span>
                )}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={lCls}>Job ID (Est.)</label>
                    <div className="flex items-center gap-1 bg-[#0d1117] border border-[#21293d] rounded-lg px-2.5 py-2">
                      <Hash size={10} className="text-slate-600" />
                      <span className="text-amber-400 font-black text-xs">{row.estJobId}</span>
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
                    <label className={lCls}>Item / Model *</label>
                    <input
                      type="text"
                      data-bulk-input-item={row.id}
                      value={row.item}
                      onChange={(e) => updateRow(row.id, "item", e.target.value)}
                      placeholder="Item Name / Model"
                      className={fieldErr(rErrs, "Item / Model") ? iClsErr : iCls}
                    />
                  </div>
                  <div>
                    <label className={lCls}>Fault Reported *</label>
                    <input
                      type="text"
                      data-bulk-input-fault={row.id}
                      value={row.fault}
                      onChange={(e) => updateRow(row.id, "fault", e.target.value)}
                      placeholder="Reported Fault"
                      className={fieldErr(rErrs, "Fault Reported") ? iClsErr : iCls}
                    />
                  </div>
                  <div>
                    <label className={lCls}>Assign To</label>
                    <div
                      data-bulk-mech={row.id}
                      className={fieldErr(rErrs, "Mechanic") ? "rounded-xl ring-2 ring-red-500/60" : ""}
                    >
                      <SearchableSelect
                        value={row.mechanic_id}
                        options={mechOptions.map((m) => ({ id: m.id, label: m.name }))}
                        onSelect={(v) => updateRow(row.id, "mechanic_id", v)}
                        placeholder="Select Mechanic"
                        clearLabel="Select Mechanic"
                      />
                    </div>
                    {fieldErr(rErrs, "Mechanic") && (
                      <span className="block text-[9px] text-red-400 font-bold mt-0.5">
                        Mechanic select karo
                      </span>
                    )}
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
                <button
                  onClick={() => removeRow(row.id)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-bold transition-colors"
                >
                  <Trash2 size={12} /> Remove This Item
                </button>
              </div>
            );
          })}
        </div>

        {/* ── Bottom Actions ── */}
        <div className="flex items-center justify-between flex-wrap gap-3 py-2">
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-300 rounded-xl text-sm font-bold transition-all"
          >
            <Plus size={15} /> Add New Row
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600">
              {rows.filter((r) => r.item.trim() && r.fault.trim()).length} / {rows.length} rows
              filled
            </span>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/30"
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={15} /> Save All Items
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
