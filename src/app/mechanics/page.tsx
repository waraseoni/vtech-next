"use client";

import { useEffect, useState, useCallback } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { Search, Plus, Edit3, Trash2, ToggleLeft, ToggleRight, X, Loader2, Check, AlertCircle, User } from "lucide-react";

type Mechanic = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  contact: string;
  designation: string | null;
  daily_salary: number;
  commission_percent: number;
  status: number;
  delete_flag: number;
};

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function MechanicsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Mechanic[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Mechanic | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [userRole, setUserRole] = useState("staff");

  const [form, setForm] = useState({
    firstname: "",
    middlename: "",
    lastname: "",
    contact: "",
    designation: "",
    daily_salary: "",
    commission_percent: "",
  });
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
      .from("mechanic_list")
      .select("id, firstname, middlename, lastname, contact, designation, daily_salary, commission_percent, status, delete_flag")
      .eq("delete_flag", 0)
      .order("id", { ascending: false });
    if (error) setErr(error.message);
    setRows((data || []) as Mechanic[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = rows.filter(m => {
    const name = [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ").toLowerCase();
    return (
      name.includes(search.toLowerCase()) ||
      m.contact?.includes(search) ||
      m.designation?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ firstname: "", middlename: "", lastname: "", contact: "", designation: "", daily_salary: "", commission_percent: "" });
    setFormErr("");
    setShowModal(true);
  };

  const openEdit = (m: Mechanic) => {
    setEditing(m);
    setForm({
      firstname: m.firstname,
      middlename: m.middlename || "",
      lastname: m.lastname,
      contact: m.contact,
      designation: m.designation || "",
      daily_salary: String(m.daily_salary || ""),
      commission_percent: String(m.commission_percent || ""),
    });
    setFormErr("");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstname.trim()) { setFormErr("First name zaroori hai!"); return; }
    if (!form.lastname.trim()) { setFormErr("Last name zaroori hai!"); return; }
    if (!form.contact.trim()) { setFormErr("Contact zaroori hai!"); return; }
    const salary = parseFloat(form.daily_salary);
    if (isNaN(salary) || salary < 0) { setFormErr("Valid daily salary daalo!"); return; }
    const commission = parseFloat(form.commission_percent);
    if (isNaN(commission) || commission < 0) { setFormErr("Valid commission daalo!"); return; }

    setSaving(true);
    try {
      const payload = {
        firstname: form.firstname.trim(),
        middlename: form.middlename.trim() || null,
        lastname: form.lastname.trim(),
        contact: form.contact.trim(),
        designation: form.designation.trim() || "Mechanic",
        daily_salary: salary,
        commission_percent: commission,
        status: editing ? editing.status : 1,
      };
      if (editing) {
        const { error } = await supabase.from("mechanic_list").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mechanic_list").insert([{ ...payload, delete_flag: 0 }]);
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
    await supabase.from("mechanic_list").update({ delete_flag: 1 }).eq("id", id);
    fetchData();
  };

  const toggleStatus = async (m: Mechanic) => {
    if (userRole !== "admin") { alert("Sirf Admin status change kar sakta hai!"); return; }
    await supabase.from("mechanic_list").update({ status: m.status === 1 ? 0 : 1 }).eq("id", m.id);
    fetchData();
  };

  return (
    <AdminPage title="Mechanics" subtitle="Mechanic directory management">
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, contact..."
                className="pl-9 pr-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-700 outline-none focus:border-blue-500 w-64"
              />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              {filtered.length} of {rows.length}
            </span>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all">
            <Plus size={14} /> Add Mechanic
          </button>
        </div>

        {err && <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">{err}</div>}

        {loading ? (
          <div className="px-5 py-12 text-center">
            <Loader2 size={24} className="animate-spin text-slate-600 mx-auto mb-2" />
            <p className="text-slate-600 text-xs font-extrabold uppercase tracking-widest">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-600 text-sm">No mechanics found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Contact</th>
                  <th className="text-left px-4 py-3">Designation</th>
                  <th className="text-right px-4 py-3">Daily Salary</th>
                  <th className="text-right px-4 py-3">Commission</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {filtered.map(m => {
                  const name = [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ");
                  return (
                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1a2234] flex items-center justify-center">
                            <User size={14} className="text-slate-500" />
                          </div>
                          <span className="font-bold text-slate-200">{name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">{m.contact}</td>
                      <td className="px-4 py-3.5 text-slate-500">{m.designation || "Mechanic"}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-black text-emerald-400">{inr(m.daily_salary)}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-bold text-blue-400">{Number(m.commission_percent || 0).toFixed(1)}%</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button onClick={() => toggleStatus(m)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                            m.status === 1
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-slate-500/10 border-slate-500/20 text-slate-500 hover:bg-slate-500/20"
                          }`}>
                          {m.status === 1 ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          {m.status === 1 ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit(m)}
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition">
                            <Edit3 size={13} />
                          </button>
                          {userRole === "admin" && (
                            <button onClick={() => handleDelete(m.id, name)}
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
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
              <h3 className="font-bold text-white flex items-center gap-2">
                {editing ? <><Edit3 size={16} className="text-blue-400" /> Edit Mechanic</> : <><Plus size={16} className="text-blue-400" /> Add Mechanic</>}
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">First Name <span className="text-red-400">*</span></label>
                  <input value={form.firstname} onChange={e => setForm(p => ({ ...p, firstname: e.target.value }))}
                    placeholder="First name"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Middle Name</label>
                  <input value={form.middlename} onChange={e => setForm(p => ({ ...p, middlename: e.target.value }))}
                    placeholder="Optional"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Last Name <span className="text-red-400">*</span></label>
                  <input value={form.lastname} onChange={e => setForm(p => ({ ...p, lastname: e.target.value }))}
                    placeholder="Last name"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Contact <span className="text-red-400">*</span></label>
                  <input value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))}
                    placeholder="Phone number"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Designation</label>
                  <input value={form.designation} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))}
                    placeholder="e.g. Mechanic, Senior Mechanic"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Daily Salary (₹) <span className="text-red-400">*</span></label>
                  <input type="number" step="0.01" value={form.daily_salary} onChange={e => setForm(p => ({ ...p, daily_salary: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Commission (%)</label>
                  <input type="number" step="0.1" value={form.commission_percent} onChange={e => setForm(p => ({ ...p, commission_percent: e.target.value }))}
                    placeholder="0.0"
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
