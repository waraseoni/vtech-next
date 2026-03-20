"use client";

import { useEffect, useState, useCallback } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { Search, Plus, Edit3, Trash2, ToggleLeft, ToggleRight, X, Loader2, Check, AlertCircle, Package } from "lucide-react";

type Product = {
  id: number;
  name: string;
  description: string;
  cost_price: number;
  price: number;
  status: number;
  delete_flag: number;
};

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function ProductsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [userRole, setUserRole] = useState("staff");

  const [form, setForm] = useState({ name: "", description: "", cost_price: "", price: "" });
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
      .from("product_list")
      .select("id, name, description, cost_price, price, status, delete_flag")
      .eq("delete_flag", 0)
      .order("name");
    if (error) setErr(error.message);
    setRows((data || []) as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = rows.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditing(null); setForm({ name: "", description: "", cost_price: "", price: "" }); setFormErr(""); setShowModal(true); };
  const openEdit = (p: Product) => { setEditing(p); setForm({ name: p.name, description: p.description || "", cost_price: String(p.cost_price || ""), price: String(p.price || "") }); setFormErr(""); setShowModal(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormErr("Product name zaroori hai!"); return; }
    if (!form.price || parseFloat(form.price) < 0) { setFormErr("Valid selling price daalo!"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        cost_price: parseFloat(form.cost_price) || 0,
        price: parseFloat(form.price),
        status: 1,
      };
      if (editing) {
        const { error } = await supabase.from("product_list").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_list").insert([{ ...payload, delete_flag: 0 }]);
        if (error) throw error;
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      setFormErr(err.message || "Save mein galti!");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (userRole !== "admin") { alert("Sirf Admin delete kar sakta hai!"); return; }
    if (!confirm(`"${name}" ko delete karna hai?`)) return;
    await supabase.from("product_list").update({ delete_flag: 1 }).eq("id", id);
    fetchData();
  };

  const toggleStatus = async (p: Product) => {
    if (userRole !== "admin") { alert("Sirf Admin status change kar sakta hai!"); return; }
    await supabase.from("product_list").update({ status: p.status === 1 ? 0 : 1 }).eq("id", p.id);
    fetchData();
  };

  const totalValue = filtered.reduce((s, p) => s + (p.price || 0), 0);

  return (
    <AdminPage title="Products" subtitle="Product catalog management">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                className="pl-9 pr-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-700 outline-none focus:border-blue-500 w-64"
              />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              {filtered.length} of {rows.length}
            </span>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all">
            <Plus size={14} /> Add Product
          </button>
        </div>

        {err && <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">{err}</div>}

        {loading ? (
          <div className="px-5 py-12 text-center">
            <Loader2 size={24} className="animate-spin text-slate-600 mx-auto mb-2" />
            <p className="text-slate-600 text-xs font-extrabold uppercase tracking-widest">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-600 text-sm">No products found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <th className="text-left px-4 py-3">Product Name</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-right px-4 py-3">Cost Price</th>
                  <th className="text-right px-4 py-3">Selling Price</th>
                  <th className="text-right px-4 py-3">Margin</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {filtered.map(p => {
                  const margin = p.price > 0 && p.cost_price > 0 ? ((p.price - p.cost_price) / p.price * 100) : null;
                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Package size={14} className="text-amber-500 flex-shrink-0" />
                          <span className="font-bold text-slate-200">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs max-w-[180px] truncate" title={p.description || ""}>
                        {p.description || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-400">
                        {inr(p.cost_price)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-black text-emerald-400">{inr(p.price)}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {margin !== null ? (
                          <span className={`font-bold text-xs ${margin >= 20 ? "text-emerald-400" : margin >= 10 ? "text-amber-400" : "text-red-400"}`}>
                            {margin.toFixed(1)}%
                          </span>
                        ) : <span className="text-slate-700 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button onClick={() => toggleStatus(p)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                            p.status === 1
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-slate-500/10 border-slate-500/20 text-slate-500 hover:bg-slate-500/20"
                          }`}>
                          {p.status === 1 ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          {p.status === 1 ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition">
                            <Edit3 size={13} />
                          </button>
                          {userRole === "admin" && (
                            <button onClick={() => handleDelete(p.id, p.name)}
                              className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#111520] border-t border-[#21293d]">
                  <td colSpan={3} className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-600">Total Value:</td>
                  <td className="px-4 py-3 text-right font-black text-emerald-400">{inr(totalValue)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
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
                {editing ? <><Edit3 size={16} className="text-blue-400" /> Edit Product</> : <><Plus size={16} className="text-blue-400" /> Add Product</>}
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
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Product Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. SMPS Board, LED Strip"
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Cost Price (₹)</label>
                  <input type="number" step="0.01" value={form.cost_price} onChange={e => setForm(p => ({ ...p, cost_price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Selling Price (₹) <span className="text-red-400">*</span></label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
                </div>
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
