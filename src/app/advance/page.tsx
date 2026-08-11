"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, Printer, Plus, Edit2, Trash2, DollarSign, X } from "lucide-react";

import { todayIST, startOfMonthIST } from "@/lib/dateUtils";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type AdvanceRow = {
  id: number;
  mechanic_id: number;
  name: string;
  amount: number;
  date_paid: string;
  reason: string | null;
};

type Mechanic = { id: number; firstname: string; middlename: string | null; lastname: string };

function AdvanceLedgerContent() {
  const searchParams = useSearchParams();

  const [from, setFrom] = useState(searchParams.get("from") || startOfMonthIST());
  const [to, setTo] = useState(searchParams.get("to") || todayIST());
  const [mechanicId, setMechanicId] = useState(searchParams.get("mechanic_id") || "all");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AdvanceRow[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editRow, setEditRow] = useState<AdvanceRow | null>(null);
  const [formData, setFormData] = useState({ mechanic_id: "", amount: "", date_paid: todayIST(), reason: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: mechData } = await supabase.from("mechanic_list").select("id, firstname, middlename, lastname").eq("status", 1).eq("delete_flag", 0);
      setMechanics(mechData || []);

      let q = supabase.from("advance_payments").select("id, mechanic_id, amount, date_paid, reason").gte("date_paid", from).lte("date_paid", to).order("date_paid", { ascending: false });
      if (mechanicId !== "all") q = q.eq("mechanic_id", parseInt(mechanicId));
      const { data } = await q;

      setRows((data || []).map((r) => {
        const mech = (mechData || []).find((m) => m.id === r.mechanic_id);
        return {
          ...r, name: mech ? [mech.firstname, mech.middlename, mech.lastname].filter(Boolean).join(" ") : "Unknown",
        };
      }));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [from, to, mechanicId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!formData.mechanic_id || !formData.amount || !formData.date_paid) return;
    setSaving(true);
    try {
      const payload = {
        mechanic_id: parseInt(formData.mechanic_id),
        amount: parseFloat(formData.amount),
        date_paid: formData.date_paid,
        reason: formData.reason || null,
      };
      if (editRow) {
        await supabase.from("advance_payments").update(payload).eq("id", editRow.id);
      } else {
        await supabase.from("advance_payments").insert(payload);
      }
      setShowModal(false); setEditRow(null);
      setFormData({ mechanic_id: "", amount: "", date_paid: todayIST(), reason: "" });
      fetchData();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this advance entry?")) return;
    setDeleting(id);
    await supabase.from("advance_payments").delete().eq("id", id);
    setDeleting(null);
    fetchData();
  };

  const openEdit = (r: AdvanceRow) => {
    setEditRow(r);
    setFormData({ mechanic_id: String(r.mechanic_id), amount: String(r.amount), date_paid: r.date_paid, reason: r.reason || "" });
    setShowModal(true);
  };

  const totalAdvance = rows.reduce((s, r) => s + (r.amount || 0), 0);

  const printReport = () => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (mechanicId !== "all") p.set("mechanic_id", mechanicId);
    window.open(`/api/print-advance?${p}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-lg font-black text-white flex items-center gap-2">
            <DollarSign size={18} className="text-amber-400" /> Advance & Part Payment Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Mechanic advance payments</p>
        </div>
        <button onClick={printReport}
          className="flex items-center gap-2 px-4 py-2 bg-[#161b27] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:border-blue-500/40 transition-all print-btn">
          <Printer size={13} /> Print
        </button>
      </div>

      {/* Filter - hidden on print */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">Staff</label>
            <select value={mechanicId} onChange={(e) => setMechanicId(e.target.value)}
              className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50">
              <option value="all">All Staff</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>{[m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ")}</option>
              ))}
            </select>
          </div>
          <button onClick={() => { setFormData({ mechanic_id: "", amount: "", date_paid: todayIST(), reason: "" }); setEditRow(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white transition-all">
            <Plus size={13} /> Add Entry
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#111520]">
                {["#", "Date", "Staff Name", "Amount", "Reason / Note", "Action"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 size={20} className="animate-spin text-blue-400 mx-auto" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-600 text-xs font-bold">No advance entries found</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2.5 text-xs text-slate-500 text-center">{i + 1}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">
                      {new Date(r.date_paid).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold text-slate-200">{r.name}</td>
                    <td className="px-3 py-2.5 text-xs text-right font-bold text-red-400">{inr(r.amount)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{r.reason || "—"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(r)}
                          className="w-7 h-7 flex items-center justify-center bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all">
                          <Edit2 size={11} />
                        </button>
                        <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                          className="w-7 h-7 flex items-center justify-center bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50">
                          {deleting === r.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-red-500/30 bg-red-500/5">
                <td colSpan={3} className="px-3 py-3 text-xs font-black text-slate-400 text-right">Total Advance Paid:</td>
                <td className="px-3 py-3 text-sm text-right font-black text-red-400">{inr(totalAdvance)}</td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-sm shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-white">{editRow ? "Edit Advance Entry" : "New Advance Entry"}</h3>
              <button onClick={() => { setShowModal(false); setEditRow(null); }}
                className="w-8 h-8 flex items-center justify-center bg-[#111520] hover:bg-[#21293d] rounded-lg text-slate-500 hover:text-white transition-all">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">Staff *</label>
                <select value={formData.mechanic_id} onChange={(e) => setFormData({ ...formData, mechanic_id: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50">
                  <option value="">Select Staff</option>
                  {mechanics.map((m) => (
                    <option key={m.id} value={m.id}>{[m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">Amount *</label>
                <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} step="any"
                  className="w-full px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">Date *</label>
                <input type="date" value={formData.date_paid} onChange={(e) => setFormData({ ...formData, date_paid: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">Reason</label>
                <input type="text" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="e.g., Emergency"
                  className="w-full px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all">
                  {saving ? <><Loader2 size={13} className="animate-spin" />Saving…</> : "Save Entry"}
                </button>
                <button onClick={() => { setShowModal(false); setEditRow(null); }}
                  className="px-6 py-2.5 bg-[#111520] border border-[#21293d] text-slate-400 rounded-xl text-xs font-bold hover:text-white">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdvanceLedgerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin text-blue-400" /></div>}>
      <AdvanceLedgerContent />
    </Suspense>
  );
}
