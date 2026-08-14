"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Copy, Check, Eye, EyeOff, Loader2, Save, Trash2,
  Store, KeyRound, CalendarDays, Server, FolderGit2, Triangle, ExternalLink, RefreshCw, Download,
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
  activations?: { activation_id: string; shop_url: string | null; shop_name: string | null; activated_at: string; last_seen_at: string }[];
};

type Creds = {
  license_id: number;
  app_url: string | null;
  supabase_url: string | null;
  supabase_anon_key: string | null;
  supabase_service_role_key: string | null;
  supabase_email: string | null;
  supabase_password: string | null;
  github_repo: string | null;
  github_token: string | null;
  github_username: string | null;
  github_password: string | null;
  vercel_project_url: string | null;
  vercel_project_id: string | null;
  vercel_token: string | null;
  vercel_email: string | null;
  vercel_password: string | null;
  custom_domain: string | null;
  notes: string | null;
  updated_at?: string | null;
};

const inputCls =
  "w-full px-3.5 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-mono";
const labelCls = "block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5";

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

// Secret field — masked by default, eye se reveal, copy button.
function SecretField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* ignore */ }
  };

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative">
        <input
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          style={{ paddingRight: "88px" }}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button type="button" onClick={copy} title="Copy" className="p-1.5 text-slate-600 hover:text-emerald-400 transition-colors">
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          )}
          <button type="button" onClick={() => setShow((s) => !s)} title={show ? "Hide" : "Show"} className="p-1.5 text-slate-600 hover:text-slate-300 transition-colors">
            {show ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  const [license, setLicense] = useState<License | null>(null);
  const [creds, setCreds] = useState<Creds>({
    license_id: id, app_url: "", supabase_url: "", supabase_anon_key: "",
    supabase_service_role_key: "", supabase_email: "", supabase_password: "",
    github_repo: "", github_token: "", github_username: "", github_password: "",
    vercel_project_url: "", vercel_project_id: "", vercel_token: "",
    vercel_email: "", vercel_password: "", custom_domain: "", notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kitLoading, setKitLoading] = useState(false);
  const [err, setErr] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [licRes, credsRes] = await Promise.all([
        fetch(`/api/seller/licenses/${id}`, { cache: "no-store" }),
        fetch(`/api/seller/creds/${id}`, { cache: "no-store" }),
      ]);
      const lic = await licRes.json().catch(() => ({}));
      const cr = await credsRes.json().catch(() => ({}));
      if (!licRes.ok) { setErr(lic.error || "License load failed"); setLoading(false); return; }
      setLicense(lic);
      setCreds({
        license_id: id,
        app_url: cr?.app_url ?? "",
        supabase_url: cr?.supabase_url ?? "",
        supabase_anon_key: cr?.supabase_anon_key ?? "",
        supabase_service_role_key: cr?.supabase_service_role_key ?? "",
        supabase_email: cr?.supabase_email ?? "",
        supabase_password: cr?.supabase_password ?? "",
        github_repo: cr?.github_repo ?? "",
        github_token: cr?.github_token ?? "",
        github_username: cr?.github_username ?? "",
        github_password: cr?.github_password ?? "",
        vercel_project_url: cr?.vercel_project_url ?? "",
        vercel_project_id: cr?.vercel_project_id ?? "",
        vercel_token: cr?.vercel_token ?? "",
        vercel_email: cr?.vercel_email ?? "",
        vercel_password: cr?.vercel_password ?? "",
        custom_domain: cr?.custom_domain ?? "",
        notes: cr?.notes ?? "",
      });
    } catch {
      setErr("Server se connect nahi ho paya.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) load(); }, [id, load]);

  const set = (k: keyof Creds) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setCreds((c) => ({ ...c, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setSaving(true); setSavedAt(null);
    try {
      const res = await fetch(`/api/seller/creds/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Save failed"); return; }
      setCreds({
        license_id: data.license_id ?? id,
        app_url: data.app_url ?? "",
        supabase_url: data.supabase_url ?? "",
        supabase_anon_key: data.supabase_anon_key ?? "",
        supabase_service_role_key: data.supabase_service_role_key ?? "",
        supabase_email: data.supabase_email ?? "",
        supabase_password: data.supabase_password ?? "",
        github_repo: data.github_repo ?? "",
        github_token: data.github_token ?? "",
        github_username: data.github_username ?? "",
        github_password: data.github_password ?? "",
        vercel_project_url: data.vercel_project_url ?? "",
        vercel_project_id: data.vercel_project_id ?? "",
        vercel_token: data.vercel_token ?? "",
        vercel_email: data.vercel_email ?? "",
        vercel_password: data.vercel_password ?? "",
        custom_domain: data.custom_domain ?? "",
        notes: data.notes ?? "",
      });
      setSavedAt(new Date().toLocaleTimeString());
    } catch {
      setErr("Server error");
    } finally {
      setSaving(false);
    }
  };

  const clearAll = async () => {
    if (!confirm("Client ke saare credentials delete karein? (License delete nahi hoga)")) return;
    const res = await fetch(`/api/seller/creds/${id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || "Delete failed"); return; }
    setCreds({ license_id: id, app_url: "", supabase_url: "", supabase_anon_key: "", supabase_service_role_key: "", supabase_email: "", supabase_password: "", github_repo: "", github_token: "", github_username: "", github_password: "", vercel_project_url: "", vercel_project_id: "", vercel_token: "", vercel_email: "", vercel_password: "", custom_domain: "", notes: "" });
  };

  const supabaseDash = useMemo(() => {
    const m = (creds.supabase_url || "").match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
    return m ? `https://supabase.com/dashboard/project/${m[1]}` : null;
  }, [creds.supabase_url]);

  const copyKit = async () => {
    const dl = daysLeft(license?.expires_at ?? null);
    const text = [
      `# Client Setup Kit — ${license?.shop_name || "—"}`,
      ``,
      `License Key: \`${license?.license_key || ""}\``,
      `Plan: ${license?.plan} | Expiry: ${license?.expires_at ? new Date(license.expires_at).toLocaleDateString("en-IN") : "Lifetime"}${dl !== null ? ` (${dl} days)` : ""}`,
      ``,
      `App URL: ${creds.app_url || "—"}`,
      ``,
      `## Supabase`,
      `URL: ${creds.supabase_url || "—"}`,
      `Anon Key: ${creds.supabase_anon_key || "—"}`,
      `Service Role Key: ${creds.supabase_service_role_key || "—"}`,
      `Email: ${creds.supabase_email || "—"}`,
      `Password: ${creds.supabase_password || "—"}`,
      ``,
      `## GitHub`,
      `Repo: ${creds.github_repo || "—"}`,
      `Username: ${creds.github_username || "—"}`,
      `Password: ${creds.github_password || "—"}`,
      `Token: ${creds.github_token || "—"}`,
      ``,
      `## Vercel`,
      `Project URL: ${creds.vercel_project_url || "—"}`,
      `Project ID: ${creds.vercel_project_id || "—"}`,
      `Custom Domain: ${creds.custom_domain || "—"}`,
      `Email: ${creds.vercel_email || "—"}`,
      `Password: ${creds.vercel_password || "—"}`,
      `Token: ${creds.vercel_token || "—"}`,
      ``,
      `Notes: ${creds.notes || "—"}`,
    ].join("\n");
    try { await navigator.clipboard.writeText(text); setSavedAt("Setup kit copied!"); } catch { /* ignore */ }
  };

  const downloadKit = async () => {
    setErr(""); setKitLoading(true);
    try {
      const res = await fetch(`/api/seller/setup-kit/${id}`, { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || "Setup kit ban nahi paya");
        return;
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") || "";
      const m = disp.match(/filename="?([^";]+)"?/);
      const fname = m?.[1] || `client-${id}-setup-kit.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSavedAt("Setup kit download ho gaya!");
    } catch {
      setErr("Setup kit download fail hua.");
    } finally {
      setKitLoading(false);
    }
  };

  return (
    <PortalGate
      authUrl="/api/seller/auth"
      badge="Seller Portal"
      title="Client Details"
      description="Har client ka license, activations aur Supabase/GitHub/Vercel credentials — ek jagah."
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/seller" className="w-9 h-9 flex items-center justify-center bg-[#161b27] border border-[#21293d] hover:border-blue-500/40 rounded-xl text-slate-400 hover:text-white transition-all">
              <ArrowLeft size={15} />
            </Link>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <Store size={17} className="text-blue-400" /> {license?.shop_name || "Client Details"}
              </h1>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5 font-mono">{license?.license_key || "…"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 flex items-center justify-center bg-[#161b27] border border-[#21293d] hover:border-blue-500/40 rounded-xl text-slate-400 hover:text-white transition-all" title="Refresh">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {err && <p className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{err}</p>}

        {loading ? (
          <div className="h-40 flex items-center justify-center text-slate-500 gap-2 text-xs font-bold uppercase tracking-widest">
            <Loader2 size={16} className="animate-spin" /> Loading...
          </div>
        ) : license ? (
          <>
            {/* ── License info ── */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5"><KeyRound size={13} className="text-blue-400" /> License</h2>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-black text-emerald-300 tracking-wider">{license.license_key}</span>
                  <span className={`inline-flex px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${statusBadge(license.status)}`}>{license.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Plan</p><p className="font-bold text-purple-400 mt-0.5">{license.plan}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Instances</p><p className="font-bold text-slate-200 mt-0.5">{license.activation_count ?? 0}/{license.max_activations}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Owner</p><p className="font-bold text-slate-200 mt-0.5">{license.owner_name || "—"}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Email</p><p className="font-bold text-slate-200 mt-0.5 break-all">{license.owner_email || "—"}</p></div>
                </div>
              </div>
              <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5"><CalendarDays size={13} className="text-blue-400" /> Expiry & Activity</h2>
                {(() => {
                  const dl = daysLeft(license.expires_at);
                  const expired = license.status === "active" && dl !== null && dl < 0;
                  return (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Expiry</p>
                        <p className={`font-bold mt-0.5 ${expired ? "text-red-400" : dl !== null && dl! <= 30 ? "text-amber-400" : license.expires_at ? "text-slate-200" : "text-emerald-400"}`}>
                          {license.expires_at ? new Date(license.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Lifetime"}
                          {dl !== null && <span className="block text-[9px] text-slate-500">{expired ? "expired" : `${dl} days left`}</span>}
                        </p></div>
                      <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Created</p><p className="font-bold text-slate-200 mt-0.5">{new Date(license.created_at).toLocaleDateString("en-IN")}</p></div>
                      <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Last seen</p><p className="font-bold text-slate-200 mt-0.5">{license.last_seen_at ? new Date(license.last_seen_at).toLocaleString("en-IN") : "—"}</p></div>
                      <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-600">Notes</p><p className="font-bold text-slate-200 mt-0.5 break-words">{creds.notes || "—"}</p>{license.notes && <p className="text-[10px] text-slate-500 mt-1 break-words">License: {license.notes}</p>}</div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ── Activations ── */}
            <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5"><Server size={13} className="text-blue-400" /> Activations ({license.activations?.length ?? 0})</h2>
              {!license.activations || license.activations.length === 0 ? (
                <p className="text-xs text-slate-600 font-semibold">Koi activation nahi — client ne abhi tak app activate nahi kiya.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[9px] font-black uppercase tracking-widest text-slate-600 border-b border-[#1a2234]">
                        <th className="py-2 pr-3">Instance ID</th>
                        <th className="py-2 pr-3">Shop URL</th>
                        <th className="py-2 pr-3">Activated</th>
                        <th className="py-2">Last Seen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a2234]">
                      {license.activations.map((a) => (
                        <tr key={a.activation_id}>
                          <td className="py-2 pr-3 font-mono text-[10px] text-slate-400">{a.activation_id.slice(0, 16)}…</td>
                          <td className="py-2 pr-3 text-xs text-slate-300">{a.shop_url || "—"}</td>
                          <td className="py-2 pr-3 text-xs text-slate-300">{new Date(a.activated_at).toLocaleString("en-IN")}</td>
                          <td className="py-2 text-xs text-slate-300">{new Date(a.last_seen_at).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Credentials ── */}
            <form onSubmit={save} className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Server size={13} className="text-blue-400" /> Client Credentials (encrypted at rest)
                </h2>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={downloadKit} disabled={kitLoading}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded-xl text-[10px] font-black text-blue-300 hover:text-blue-200 transition-all disabled:opacity-50">
                    {kitLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Download Setup Kit
                  </button>
                  <button type="button" onClick={copyKit}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#1a2234] hover:bg-blue-500/15 rounded-xl text-[10px] font-black text-slate-300 hover:text-blue-400 transition-all">
                    <Copy size={12} /> Copy Setup Kit
                  </button>
                  <button type="button" onClick={clearAll}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#1a2234] hover:bg-red-500/15 rounded-xl text-[10px] font-black text-slate-400 hover:text-red-400 transition-all">
                    <Trash2 size={12} /> Clear
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>App URL (client ka hosted app)</label>
                <input className={inputCls} value={creds.app_url ?? ""} onChange={set("app_url")} placeholder="https://client-shop.vercel.app" />
              </div>

              {/* Supabase */}
              <div className="rounded-xl bg-[#1a2234]/50 border border-[#21293d] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Server size={12} /> Supabase (client ka data project)</h3>
                  {supabaseDash && (
                    <a href={supabaseDash} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-[10px] font-black text-emerald-400 hover:text-emerald-300 transition-colors">
                      <ExternalLink size={11} /> Open Dashboard
                    </a>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Project URL</label>
                  <input className={inputCls} value={creds.supabase_url ?? ""} onChange={set("supabase_url")} placeholder="https://xxxx.supabase.co" />
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Login Email</label>
                    <input className={inputCls} value={creds.supabase_email ?? ""} onChange={set("supabase_email")} placeholder="client@shop.com" />
                  </div>
                  <SecretField label="Login Password" value={creds.supabase_password ?? ""} onChange={(v) => setCreds((c) => ({ ...c, supabase_password: v }))} />
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <SecretField label="Anon (public) Key" value={creds.supabase_anon_key ?? ""} onChange={(v) => setCreds((c) => ({ ...c, supabase_anon_key: v }))} />
                  <SecretField label="Service Role Key ⚠️" value={creds.supabase_service_role_key ?? ""} onChange={(v) => setCreds((c) => ({ ...c, supabase_service_role_key: v }))} />
                </div>
              </div>

              {/* GitHub */}
              <div className="rounded-xl bg-[#1a2234]/50 border border-[#21293d] p-4 space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><FolderGit2 size={12} /> GitHub</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Repo (owner/repo)</label>
                    <input className={inputCls} value={creds.github_repo ?? ""} onChange={set("github_repo")} placeholder="vtech/vtech-frontend" />
                  </div>
                  <div>
                    <label className={labelCls}>Username</label>
                    <input className={inputCls} value={creds.github_username ?? ""} onChange={set("github_username")} placeholder="github_username" />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <SecretField label="Login Password" value={creds.github_password ?? ""} onChange={(v) => setCreds((c) => ({ ...c, github_password: v }))} />
                  <SecretField label="Personal Access Token" value={creds.github_token ?? ""} onChange={(v) => setCreds((c) => ({ ...c, github_token: v }))} />
                </div>
              </div>

              {/* Vercel */}
              <div className="rounded-xl bg-[#1a2234]/50 border border-[#21293d] p-4 space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Triangle size={12} /> Vercel</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Project URL</label>
                    <input className={inputCls} value={creds.vercel_project_url ?? ""} onChange={set("vercel_project_url")} placeholder="https://client-shop.vercel.app" />
                  </div>
                  <div>
                    <label className={labelCls}>Project ID</label>
                    <input className={inputCls} value={creds.vercel_project_id ?? ""} onChange={set("vercel_project_id")} placeholder="prj_xxx" />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Login Email</label>
                    <input className={inputCls} value={creds.vercel_email ?? ""} onChange={set("vercel_email")} placeholder="client@shop.com" />
                  </div>
                  <SecretField label="Login Password" value={creds.vercel_password ?? ""} onChange={(v) => setCreds((c) => ({ ...c, vercel_password: v }))} />
                </div>
                <SecretField label="Access Token" value={creds.vercel_token ?? ""} onChange={(v) => setCreds((c) => ({ ...c, vercel_token: v }))} />
                <div>
                  <label className={labelCls}>Custom Domain (optional)</label>
                  <input className={inputCls} value={creds.custom_domain ?? ""} onChange={set("custom_domain")} placeholder="shop1.vtechshop.com" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Notes</label>
                <textarea className={`${inputCls} font-sans`} rows={3} value={creds.notes ?? ""} onChange={set("notes")} placeholder="Koi bhi extra detail — bil, renewal reminders, server creds, etc." />
              </div>

              {savedAt && (
                <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Check size={13} /> Saved at {savedAt}
                </p>
              )}

              <div className="flex items-center justify-end">
                <button type="submit" disabled={saving}
                  className="flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-black tracking-wide transition-all">
                  {saving ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : <><Save size={15} /> Save Credentials</>}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center gap-2 text-slate-600">
            <Store size={22} />
            <p className="text-xs font-bold uppercase tracking-widest">License nahi mila</p>
          </div>
        )}
      </div>
    </PortalGate>
  );
}
