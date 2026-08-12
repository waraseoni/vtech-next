"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Copy, Check, Pencil, Trash2, X, Loader2, RefreshCw, KeyRound,
  Store, Package, Ban, Clock, ShieldCheck, Eye,
} from "lucide-react";
import PortalGate from "@/components/PortalGate";

type License = {
  id: number;
  license_key: string;
  shop_name: string | null;
  owner_name: string | null;
  owner_email: string | null;
  plan: string;
  max_activations: number;
  expires_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  activation_count?: number;
  last_seen_at?: string | null;
};

const PLANS = ["standard", "premium", "lifetime"] as const;
const STATUSES = ["active", "disabled", "revoked"] as const;

function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

const statusBadge = (s: string) =>
  s === "active"
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
    : s === "disabled"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
      : "bg-red-500/15 text-red-400 border-red-500/25";

const inputCls =
  "w-full px-3.5 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all";
const labelCls = "block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5";

export default function SellerPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<License | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/seller/licenses", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Load failed"); return; }
      setLicenses(data);
    } catch {
      setErr("Server se connect nahi ho paya.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const copyKey = async (l: License) => {
    try {
      await navigator.clipboard.writeText(l.license_key);
      setCopied(l.id);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };

  const remove = async (l: License) => {
    if (!confirm(`License delete karein? (${l.shop_name || l.license_key})\nActivations bhi hat jayenge.`)) return;
    const res = await fetch(`/api/seller/licenses/${l.id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || "Delete failed"); return; }
    await load();
  };

  const total = licenses.length;
  const activeCount = licenses.filter((l) => l.status === "active" && (daysLeft(l.expires_at) === null || daysLeft(l.expires_at)! >= 0)).length;
  const expiredCount = licenses.filter((l) => l.status === "active" && daysLeft(l.expires_at) !== null && daysLeft(l.expires_at)! < 0).length;
  const disabledCount = licenses.filter((l) => l.status !== "active").length;

  return (
    <PortalGate
      authUrl="/api/seller/auth"
      badge="Seller Portal"
      title="License Manager"
      description="Naye client ke liye key banao, avdhi set karo, renew/revoke karo. Ye portal sirf seller ke deployment par enabled hai."
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">Seller — License Manager</h1>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
              Central licensing project (vtech_licence) ke licenses ka CRUD.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 flex items-center justify-center bg-[#161b27] border border-[#21293d] hover:border-blue-500/40 rounded-xl text-slate-400 hover:text-white transition-all" title="Refresh">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black tracking-wide transition-all shadow-lg shadow-blue-900/30">
              <Plus size={15} /> New License
            </button>
          </div>
        </div>

        {err && <p className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{err}</p>}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Licenses", value: total, icon: Package, color: "text-blue-400 bg-blue-500/10" },
            { label: "Active", value: activeCount, icon: ShieldCheck, color: "text-emerald-400 bg-emerald-500/10" },
            { label: "Expired", value: expiredCount, icon: Clock, color: "text-red-400 bg-red-500/10" },
            { label: "Disabled/Revoked", value: disabledCount, icon: Ban, color: "text-amber-400 bg-amber-500/10" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                <Icon size={15} />
              </div>
              <p className="text-2xl font-black text-white mt-3">{value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-slate-500 gap-2 text-xs font-bold uppercase tracking-widest">
              <Loader2 size={16} className="animate-spin" /> Loading...
            </div>
          ) : licenses.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-slate-600">
              <Store size={22} />
              <p className="text-xs font-bold uppercase tracking-widest">Abhi koi license nahi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[9px] font-black uppercase tracking-widest text-slate-600 border-b border-[#1a2234]">
                    <th className="px-4 py-3">Key</th>
                    <th className="px-4 py-3">Shop / Owner</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Instances</th>
                    <th className="px-4 py-3">Expiry</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2234]">
                  {licenses.map((l) => {
                    const dl = daysLeft(l.expires_at);
                    const expired = l.status === "active" && dl !== null && dl < 0;
                    return (
                      <tr key={l.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-200">{l.license_key}</span>
                            <button onClick={() => copyKey(l)} title="Copy key"
                              className="p-1 text-slate-600 hover:text-emerald-400 transition-colors">
                              {copied === l.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                            </button>
                          </div>
                          {l.last_seen_at && (
                            <p className="text-[9px] text-slate-600 mt-0.5">last seen {new Date(l.last_seen_at).toLocaleDateString()}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold text-slate-200">{l.shop_name || "—"}</p>
                          <p className="text-[10px] text-slate-500">{l.owner_name || ""}{l.owner_email ? ` · ${l.owner_email}` : ""}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-black uppercase text-purple-400">{l.plan}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold text-slate-300">
                            {l.activation_count ?? 0}/{l.max_activations}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {l.expires_at ? (
                            <span className={`text-[11px] font-bold ${expired ? "text-red-400" : dl !== null && dl <= 30 ? "text-amber-400" : "text-slate-300"}`}>
                              {new Date(l.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              <span className="block text-[9px] text-slate-500">
                                {expired ? "expired" : dl !== null ? `${dl} days left` : "lifetime"}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-400">Lifetime</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${statusBadge(l.status)}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/seller/client/${l.id}`} title="Client Details"
                              className="w-8 h-8 flex items-center justify-center bg-[#1a2234] hover:bg-blue-500/15 rounded-lg text-slate-400 hover:text-blue-400 transition-all">
                              <Eye size={13} />
                            </Link>
                            <button onClick={() => setEditing(l)} title="Edit / Renew"
                              className="w-8 h-8 flex items-center justify-center bg-[#1a2234] hover:bg-blue-500/15 rounded-lg text-slate-400 hover:text-blue-400 transition-all">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => remove(l)} title="Delete"
                              className="w-8 h-8 flex items-center justify-center bg-[#1a2234] hover:bg-red-500/15 rounded-lg text-slate-400 hover:text-red-400 transition-all">
                              <Trash2 size={13} />
                            </button>
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
      </div>

      <NewLicenseModal open={showNew} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />
      <EditLicenseModal license={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
    </PortalGate>
  );
}

// ─── New License modal ───────────────────────────────────────────────────────
function NewLicenseModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ shop_name: "", owner_name: "", owner_email: "", plan: "standard", max_activations: "1", expires_at: "", status: "active", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true); setCreatedKey(null);
    try {
      const res = await fetch("/api/seller/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_name: form.shop_name,
          owner_name: form.owner_name,
          owner_email: form.owner_email,
          plan: form.plan,
          max_activations: Number(form.max_activations),
          expires_at: form.expires_at || null,
          status: form.status,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Create failed"); return; }
      setCreatedKey(data.license_key);
    } catch {
      setErr("Server error");
    } finally {
      setBusy(false);
    }
  };

  const copyNew = async () => {
    if (!createdKey) return;
    try { await navigator.clipboard.writeText(createdKey); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#111520] border border-[#21293d] rounded-3xl p-6 shadow-2xl shadow-black/50 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500/15 text-blue-400 rounded-xl flex items-center justify-center"><KeyRound size={16} /></div>
            <h2 className="text-base font-black text-white">New License</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-[#1a2234] rounded-lg text-slate-500 hover:text-white transition-all"><X size={15} /></button>
        </div>

        {createdKey ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto bg-emerald-500/15 text-emerald-400 rounded-2xl flex items-center justify-center mb-4"><Check size={22} /></div>
            <p className="text-xs font-bold text-slate-300">License ban gaya. Client ko ye key do:</p>
            <div className="mt-4 flex items-center justify-center gap-2 bg-[#0d1117] border border-emerald-500/25 rounded-xl px-4 py-3">
              <span className="font-mono text-sm font-black text-emerald-300 tracking-wider">{createdKey}</span>
              <button onClick={copyNew} className="p-1 text-slate-500 hover:text-emerald-400 transition-colors" title="Copy">
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-3 font-semibold">
              Client app ke Settings → License Activation (ya login ke baad License Gate) mein ye key daalega.
            </p>
            <button onClick={onCreated} className="mt-5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className={labelCls}>Shop Name</label>
              <input className={inputCls} value={form.shop_name} onChange={set("shop_name")} placeholder="e.g. Sharma Mobile Repair" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Owner Name</label>
                <input className={inputCls} value={form.owner_name} onChange={set("owner_name")} placeholder="Owner" />
              </div>
              <div>
                <label className={labelCls}>Owner Email</label>
                <input className={inputCls} value={form.owner_email} onChange={set("owner_email")} placeholder="owner@shop.com" type="email" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Plan</label>
                <select className={inputCls} value={form.plan} onChange={set("plan")}>
                  {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Max Instances</label>
                <input className={inputCls} value={form.max_activations} onChange={set("max_activations")} type="number" min={1} required />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select className={inputCls} value={form.status} onChange={set("status")}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>License Duration (khali = lifetime)</label>
              <input className={inputCls} value={form.expires_at} onChange={set("expires_at")} type="date" />
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input className={inputCls} value={form.notes} onChange={set("notes")} placeholder="Optional" />
            </div>
            {err && <p className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
            <button type="submit" disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-black tracking-wide transition-all">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : <><KeyRound size={15} /> Create License + Generate Key</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Edit / Renew modal ──────────────────────────────────────────────────────
function EditLicenseModal({ license, onClose, onSaved }: { license: License | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ shop_name: "", owner_name: "", owner_email: "", plan: "standard", max_activations: "1", expires_at: "", status: "active", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!license) return;
    setForm({
      shop_name: license.shop_name || "",
      owner_name: license.owner_name || "",
      owner_email: license.owner_email || "",
      plan: license.plan,
      max_activations: String(license.max_activations),
      expires_at: license.expires_at ? license.expires_at.slice(0, 10) : "",
      status: license.status,
      notes: license.notes || "",
    });
    setErr("");
  }, [license]);

  if (!license) return null;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await fetch(`/api/seller/licenses/${license.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_name: form.shop_name,
          owner_name: form.owner_name,
          owner_email: form.owner_email,
          plan: form.plan,
          max_activations: Number(form.max_activations),
          expires_at: form.expires_at || null,
          status: form.status,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Save failed"); return; }
      onSaved();
    } catch {
      setErr("Server error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#111520] border border-[#21293d] rounded-3xl p-6 shadow-2xl shadow-black/50 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/15 text-amber-400 rounded-xl flex items-center justify-center"><Pencil size={16} /></div>
            <div>
              <h2 className="text-base font-black text-white">Edit / Renew</h2>
              <p className="font-mono text-[10px] text-slate-500">{license.license_key}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-[#1a2234] rounded-lg text-slate-500 hover:text-white transition-all"><X size={15} /></button>
        </div>
        <p className="text-[11px] text-slate-500 font-semibold mb-4">
          Renewal: nayi expiry date daalo — key same rahegi, client gate par re-activate karega.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={labelCls}>Shop Name</label>
            <input className={inputCls} value={form.shop_name} onChange={set("shop_name")} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Owner Name</label>
              <input className={inputCls} value={form.owner_name} onChange={set("owner_name")} />
            </div>
            <div>
              <label className={labelCls}>Owner Email</label>
              <input className={inputCls} value={form.owner_email} onChange={set("owner_email")} type="email" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Plan</label>
              <select className={inputCls} value={form.plan} onChange={set("plan")}>
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Max Instances</label>
              <input className={inputCls} value={form.max_activations} onChange={set("max_activations")} type="number" min={1} required />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={set("status")}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>License Duration (khali = lifetime)</label>
            <input className={inputCls} value={form.expires_at} onChange={set("expires_at")} type="date" />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <input className={inputCls} value={form.notes} onChange={set("notes")} />
          </div>
          {err && <p className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
          <button type="submit" disabled={busy}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-sm font-black tracking-wide transition-all">
            {busy ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Check size={15} /> Save Changes</>}
          </button>
        </form>
      </div>
    </div>
  );
}
