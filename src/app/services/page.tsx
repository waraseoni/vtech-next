"use client";

import { useEffect, useState, useCallback } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { Search, Plus, Edit3, Trash2, ToggleLeft, ToggleRight, X, Loader2, Check, AlertCircle } from "lucide-react";

type Service = {
  id: number;
  name: string;
  description: string;
  price: number;
  hsn: string;
  status: number;
  delete_flag: number;
};

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function ServicesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [userRole, setUserRole] = useState("staff");

  const [form, setForm] = useState({ name: "", description: "", price: "", hsn: "" });
  const [formErr, setFormErr] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("role").eq("id", user.id).single()
        .then(({ data }) => setUserRole(data?.role ?? "staff"));
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("service_list")
      .select("id, name, description, price, hsn, status, delete_flag")
      .eq("delete_flag", 0)
      .order("name");
    if (error) setErr(error.message);
    setRows((data || []) as Service[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = rows.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description?.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditing(null); setForm({ name: "", description: "", price: "", hsn: "" }); setFormErr(""); setShowModal(true); };
  const openEdit = (s: Service) => { setEditing(s); setForm({ name: s.name, description: s.description || "", price: String(s.price || ""), hsn: s.hsn || "" }); setFormErr(""); setShowModal(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormErr("Service name zaroori hai!"); return; }
    if (!form.price || parseFloat(form.price) < 0) { setFormErr("Valid price daalo!"); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), description: form.description.trim(), price: parseFloat(form.price), hsn: form.hsn.trim().toUpperCase(), status: 1 };
      if (editing) {
        const { error } = await supabase.from("service_list").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("service_list").insert([{ ...payload, delete_flag: 0 }]);
        if (error) throw error;
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (userRole !== "admin") { alert("Sirf Admin delete kar sakta hai!"); return; }
    if (!confirm(`"${name}" ko delete karna hai?`)) return;
    await supabase.from("service_list").update({ delete_flag: 1 }).eq("id", id);
    fetchData();
  };

  const toggleStatus = async (s: Service) => {
    if (userRole !== "admin") { alert("Sirf Admin status change kar sakta hai!"); return; }
    await supabase.from("service_list").update({ status: s.status === 1 ? 0 : 1 }).eq("id", s.id);
    fetchData();
  };

  return (
    <AdminPage title="Services" subtitle="Service catalog management">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search services..."
                className="pl-9 pr-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-700 outline-none focus:border-blue-500 w-64"
              />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              {filtered.length} of {rows.length}
            </span>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all">
            <Plus size={14} /> Add Service
          </button>
        </div>

        {err && <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">{err}</div>}

        {loading ? (
          <div className="px-5 py-12 text-center">
            <Loader2 size={24} className="animate-spin text-slate-600 mx-auto mb-2" />
            <p className="text-slate-600 text-xs font-extrabold uppercase tracking-widest">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-600 text-sm">No services found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-center px-4 py-3">HSN/SAC</th>
                  <th className="text-right px-4 py-3">Price</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-slate-200">{s.name}</span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs max-w-[200px] truncate" title={s.description || ""}>
                      {s.description || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {s.hsn ? <span className="inline-block px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-[10px] font-bold">{s.hsn}</span> : <span className="text-slate-700 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-black text-emerald-400">{inr(s.price)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button onClick={() => toggleStatus(s)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                          s.status === 1
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-slate-500/10 border-slate-500/20 text-slate-500 hover:bg-slate-500/20"
                        }`}>
                        {s.status === 1 ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {s.status === 1 ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(s)}
                          className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition">
                          <Edit3 size={13} />
                        </button>
                        {userRole === "admin" && (
                          <button onClick={() => handleDelete(s.id, s.name)}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
              <h3 className="font-bold text-white flex items-center gap-2">
                {editing ? <><Edit3 size={16} className="text-blue-400" /> Edit Service</> : <><Plus size={16} className="text-blue-400" /> Add Service</>}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 transition">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {formErr && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                  <AlertCircle size={14} /> {formErr}
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Service Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. SMPS Repair, Screen Replacement"
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Price (₹) <span className="text-red-400">*</span></label>
                <input type="number" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">HSN/SAC Code</label>
                <input value={form.hsn} onChange={e => setForm(p => ({ ...p, hsn: e.target.value }))}
                  placeholder="e.g. 998714"
                  maxLength={20}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Check size={14} /> {editing ? "Update" : "Save"}</>}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 bg-[#111520] border border-[#21293d] text-slate-400 rounded-xl font-bold text-sm hover:bg-[#1a2234] transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
