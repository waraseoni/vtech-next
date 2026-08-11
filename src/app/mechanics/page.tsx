"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import {
  Search, Plus, Edit3, Trash2, ToggleLeft, ToggleRight, X, Loader2,
  Check, AlertCircle, Users, DollarSign, TrendingUp,
  Eye, Wrench, FileText
} from "lucide-react";
import { logActivity } from "@/lib/activity";
import { todayIST } from "@/lib/dateUtils";

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
  date_added?: string;
  image_path?: string | null;
};

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: "blue" | "purple" | "emerald" | "teal" | "amber";
}) {
  const colors = {
    blue: "text-blue-400 bg-blue-500/8",
    purple: "text-purple-400 bg-purple-500/8",
    emerald: "text-emerald-400 bg-emerald-500/8",
    teal: "text-teal-400 bg-teal-500/8",
    amber: "text-amber-400 bg-amber-500/8",
  };
  return (
    <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
          <p className="text-lg font-black text-white">{value}</p>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

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
      .select("id, firstname, middlename, lastname, contact, designation, daily_salary, commission_percent, status, delete_flag, date_added, image_path")
      .eq("delete_flag", 0)
      .order("firstname", { ascending: true });
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

  const totalMechanics = rows.length;
  const activeMechanics = rows.filter(m => m.status === 1).length;
  const inactiveMechanics = rows.filter(m => m.status === 0).length;
  const totalDailySalary = rows.filter(m => m.status === 1).reduce((s, m) => s + (m.daily_salary || 0), 0);

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
      const today = todayIST();
      if (editing) {
        const { error } = await supabase.from("mechanic_list").update(payload).eq("id", editing.id);
        if (error) throw error;
        if (salary !== editing.daily_salary) {
          const { error: histErr } = await supabase.from("mechanic_salary_history").insert([{ mechanic_id: editing.id, salary, effective_date: today }]);
          if (histErr) throw histErr;
        }
        await logActivity('Updated Staff Member', 'Mechanics', editing.id, `Updated profile for: ${payload.firstname} ${payload.lastname}`);
      } else {
        const { data, error } = await supabase.from("mechanic_list").insert([{ ...payload, delete_flag: 0 }]).select("id").single();
        if (error) throw error;
        const { error: histErr } = await supabase.from("mechanic_salary_history").insert([{ mechanic_id: data.id, salary, effective_date: today }]);
        if (histErr) throw histErr;
        await logActivity('Added Staff Member', 'Mechanics', data.id, `Created profile for: ${payload.firstname} ${payload.lastname}`);
      }
      setShowModal(false);
      fetchData();
    } catch (e) {
      setFormErr((e instanceof Error && e.message ? e.message : "") || "Save mein galti!");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (userRole !== "admin") { alert("Sirf Admin delete kar sakta hai!"); return; }
    if (!confirm(`"${name}" ko delete karna hai?`)) return;
    const { error } = await supabase.from("mechanic_list").update({ delete_flag: 1 }).eq("id", id);
    if (!error) {
      await logActivity('Deleted Staff Member', 'Mechanics', id, `Deleted profile: ${name}`);
      fetchData();
    }
  };

  const toggleStatus = async (m: Mechanic) => {
    if (userRole !== "admin") { alert("Sirf Admin status change kar sakta hai!"); return; }
    const newStatus = m.status === 1 ? 0 : 1;
    const name = [m.firstname, m.lastname].join(" ");
    const { error } = await supabase.from("mechanic_list").update({ status: newStatus }).eq("id", m.id);
    if (!error) {
      await logActivity('Updated Staff Status', 'Mechanics', m.id, `${name} marked as ${newStatus === 1 ? 'Active' : 'Inactive'}`);
      fetchData();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
            <Users size={18} className="text-white"/>
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Mechanics Directory</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Manage workshop mechanics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/mechanics/commission"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 hover:text-white rounded-xl text-xs font-bold no-underline transition-all">
            <FileText size={13}/> Commission
          </Link>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all">
            <Plus size={14} /> Add Mechanic
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Users size={18}/>} label="Total Mechanics" value={String(totalMechanics)} color="blue" />
        <StatCard icon={<TrendingUp size={18}/>} label="Active" value={String(activeMechanics)} color="emerald" />
        <StatCard icon={<ToggleLeft size={18}/>} label="Inactive" value={String(inactiveMechanics)} color="amber" />
        <StatCard icon={<DollarSign size={18}/>} label="Daily Salary" value={inr(totalDailySalary)} sub="Active only" color="purple" />
      </div>

      {/* Table */}
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
        </div>

        {err && <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">{err}</div>}

        {loading ? (
          <div className="px-5 py-12 text-center">
            <Loader2 size={24} className="animate-spin text-slate-600 mx-auto mb-2" />
            <p className="text-slate-600 text-xs font-extrabold uppercase tracking-widest">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-600 text-sm">
            <Users size={36} className="mx-auto mb-2 text-slate-700"/>
            <p>No mechanics found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <th className="text-left px-4 py-3">Name / Contact</th>
                  <th className="text-left px-4 py-3">Designation</th>
                  <th className="text-right px-4 py-3">Daily Salary</th>
                  <th className="text-right px-4 py-3">Commission</th>
                  <th className="text-left px-4 py-3">Joined</th>
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
                          {m.image_path ? (
                            <Image src={m.image_path} alt={name}
                              width={36} height={36} unoptimized
                              className="w-9 h-9 rounded-xl object-cover flex-shrink-0 border border-[#21293d]"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-[#1a2234] flex items-center justify-center text-slate-400 font-black text-sm">
                              {name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-200">{name}</p>
                            <p className="text-xs text-slate-500">{m.contact}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Wrench size={9}/> {m.designation || "Mechanic"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-black text-emerald-400">{inr(m.daily_salary)}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-bold text-amber-400">{Number(m.commission_percent || 0).toFixed(1)}%</span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs">
                        {m.date_added ? new Date(m.date_added).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
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
                        <div className="flex items-center justify-center gap-1.5">
                          <Link href={`/mechanics/ledger/${m.id}`}
                            className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition no-underline"
                            title="View Daily Ledger">
                            <FileText size={13}/>
                          </Link>
                          <Link href={`/mechanics/${m.id}`}
                            className="p-2 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition no-underline"
                            title="View Profile">
                            <Eye size={13}/>
                          </Link>
                          <button onClick={() => openEdit(m)}
                            className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition">
                            <Edit3 size={13} />
                          </button>
                          {userRole === "admin" && (
                            <button onClick={() => handleDelete(m.id, name)}
                              className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
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
    </div>
  );
}
