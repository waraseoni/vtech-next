"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2, RefreshCw, ShieldCheck, Store, Clock, Ban, AlertTriangle, Users,
  Package, Download, X, Eye, EyeOff, Rocket,
} from "lucide-react";
import PortalGate from "@/components/PortalGate";

type Row = {
  id: number;
  license_key: string;
  shop_name: string | null;
  owner_name: string | null;
  owner_email: string | null;
  plan: string;
  status: string;
  expires_at: string | null;
  days_left: number | null;
  active: boolean;
  expired: boolean;
  activated_instances: number;
};

type Stats = {
  total: number;
  active: number;
  expired: number;
  disabled: number;
  expiringSoon: number;
  licenses: Row[];
};

type KitPrefill = {
  shopName: string;
  licenseKey: string;
  creds: {
    app_url: string | null;
    supabase_url: string | null;
    supabase_anon_key: string | null;
    supabase_service_role_key: string | null;
    vercel_project_url: string | null;
    vercel_project_id: string | null;
    vercel_token: string | null;
    custom_domain: string | null;
  } | null;
  setupToken: string;
};

const inputCls =
  "w-full px-3.5 py-2.5 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#21293d] rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all font-mono [color-scheme:light] dark:[color-scheme:dark]";
const labelCls = "block text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-500 mb-1.5";

function SecretField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
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
          style={{ paddingRight: "44px" }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          title={show ? "Hide" : "Show"}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 dark:text-slate-600 hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
        >
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </div>
  );
}

export default function DeveloperPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  // ── Setup kit generator state ──
  const [kitFor, setKitFor] = useState<Row | null>(null);
  const [prefill, setPrefill] = useState<KitPrefill | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [kitBusy, setKitBusy] = useState(false);
  const [kitMsg, setKitMsg] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [serviceRoleKey, setServiceRoleKey] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [saveCreds, setSaveCreds] = useState(true);
  const [vercelProjectUrl, setVercelProjectUrl] = useState("");
  const [vercelProjectId, setVercelProjectId] = useState("");
  const [vercelToken, setVercelToken] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/developer/stats", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Load failed"); return; }
      setStats(data);
    } catch {
      setErr("Server se connect nahi ho paya.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openKit = useCallback(async (row: Row) => {
    setKitFor(row);
    setPrefill(null);
    setKitMsg("");
    setPushMsg("");
    setPrefillLoading(true);
    setAppUrl(""); setSupabaseUrl(""); setAnonKey(""); setServiceRoleKey(""); setSetupToken(""); setSaveCreds(true);
    setVercelProjectUrl(""); setVercelProjectId(""); setVercelToken(""); setCustomDomain("");
    try {
      const res = await fetch(`/api/developer/setup-kit/${row.id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) { setKitMsg(data.error || "Prefill load fail"); return; }
      setPrefill(data);
      setAppUrl(data.creds?.app_url ?? "");
      setSupabaseUrl(data.creds?.supabase_url ?? "");
      setAnonKey(data.creds?.supabase_anon_key ?? "");
      setServiceRoleKey(data.creds?.supabase_service_role_key ?? "");
      setSetupToken(data.setupToken ?? "");
      setVercelProjectUrl(data.creds?.vercel_project_url ?? "");
      setVercelProjectId(data.creds?.vercel_project_id ?? "");
      setVercelToken(data.creds?.vercel_token ?? "");
      setCustomDomain(data.creds?.custom_domain ?? "");
    } catch {
      setKitMsg("Prefill load fail hua.");
    } finally {
      setPrefillLoading(false);
    }
  }, []);

  const generate = async () => {
    if (!kitFor) return;
    setKitMsg(""); setKitBusy(true);
    try {
      const res = await fetch(`/api/developer/setup-kit/${kitFor.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appUrl, supabaseUrl, supabaseAnonKey: anonKey, supabaseServiceRoleKey: serviceRoleKey, setupToken, saveCreds, vercelProjectUrl, vercelProjectId, vercelToken, customDomain }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setKitMsg(d.error || "Package ban nahi paya");
        return;
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") || "";
      const m = disp.match(/filename="?([^";]+)"?/);
      const fname = m?.[1] || `client-${kitFor.id}-setup-kit.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setKitMsg(`Package download ho gaya: ${fname}`);
      load();
    } catch {
      setKitMsg("Package download fail hua.");
    } finally {
      setKitBusy(false);
    }
  };

  const push = async () => {
    if (!kitFor) return;
    setPushMsg(""); setPushBusy(true);
    try {
      const res = await fetch(`/api/developer/setup-kit/${kitFor.id}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appUrl, supabaseUrl, supabaseAnonKey: anonKey, supabaseServiceRoleKey: serviceRoleKey, setupToken, vercelProjectUrl, vercelProjectId, vercelToken, customDomain }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setPushMsg(data.error || "Push fail hua"); return; }
      setPushMsg(data.message || "Vercel par env push + redeploy ho gaya.");
    } catch {
      setPushMsg("Push fail hua — Vercel se connect nahi ho paya.");
    } finally {
      setPushBusy(false);
    }
  };

  const rows = useMemo(() => (stats?.licenses || []).filter((r) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      (r.shop_name || "").toLowerCase().includes(s) ||
      (r.owner_name || "").toLowerCase().includes(s) ||
      (r.owner_email || "").toLowerCase().includes(s) ||
      r.license_key.toLowerCase().includes(s)
    );
  }), [stats, q]);

  const statColor = (k: string) =>
    k === "active" ? "text-emerald-400 bg-emerald-500/10"
      : k === "expired" ? "text-red-400 bg-red-500/10"
        : k === "expiringSoon" ? "text-amber-400 bg-amber-500/10"
          : k === "disabled" ? "text-slate-400 bg-slate-500/10"
            : "text-blue-400 bg-blue-500/10";

  return (
    <PortalGate
      authUrl="/api/developer/auth"
      badge="Developer Portal"
      title="Licensing + Setup Kit"
      description="Clients ke license dekho, aur ek click mein unka Setup Kit (client package) banao aur download karo."
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">Developer — Licensing & Setup Kit</h1>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Double-password protected · koi command line nahi — sab clicks se</p>
          </div>
          <button onClick={load} className="w-9 h-9 flex items-center justify-center bg-[#161b27] border border-[#21293d] hover:border-indigo-500/40 rounded-xl text-slate-400 hover:text-white transition-all" title="Refresh">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {err && <p className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{err}</p>}

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Total Clients", value: stats.total, icon: Store, k: "total" },
              { label: "Active", value: stats.active, icon: ShieldCheck, k: "active" },
              { label: "Expired", value: stats.expired, icon: Clock, k: "expired" },
              { label: "Expiring ≤30d", value: stats.expiringSoon, icon: AlertTriangle, k: "expiringSoon" },
              { label: "Disabled", value: stats.disabled, icon: Ban, k: "disabled" },
            ].map(({ label, value, icon: Icon, k }) => (
              <div key={k} className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statColor(k)}`}><Icon size={15} /></div>
                <p className="text-2xl font-black text-white mt-3">{value}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Setup Kit Generator */}
        <div className="bg-[#161b27] border border-indigo-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center"><Package size={15} /></span>
            <div>
              <h2 className="text-[13px] font-black text-white">Setup Kit Generator</h2>
              <p className="text-[11px] text-slate-500 font-semibold">Neeche kisi client par <span className="text-indigo-400">Create Package</span> dabao → Supabase keys bharo (pehle se save hain to khud aa jayenge) → <span className="text-indigo-400">Generate & Download</span> → client ko zip bhejo.</p>
            </div>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search shop, owner, email ya key..."
            className="w-full px-4 py-2.5 mt-4 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-all"
          />

          <div className="mt-3 bg-[#161b27] border border-[#21293d] rounded-xl overflow-hidden">
            {loading ? (
              <div className="h-40 flex items-center justify-center text-slate-500 gap-2 text-xs font-bold uppercase tracking-widest">
                <Loader2 size={16} className="animate-spin" /> Loading...
              </div>
            ) : rows.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center gap-2 text-slate-600">
                <Users size={22} />
                <p className="text-xs font-bold uppercase tracking-widest">{stats ? "Koi match nahi mila" : "Koi data nahi"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9px] font-black uppercase tracking-widest text-slate-600 border-b border-[#1a2234]">
                      <th className="px-4 py-3">Shop / Owner</th>
                      <th className="px-4 py-3">Key</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">PCs</th>
                      <th className="px-4 py-3">Expiry</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Setup Kit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2234]">
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold text-slate-200">{r.shop_name || "—"}</p>
                          <p className="text-[10px] text-slate-500">{r.owner_name || ""}{r.owner_email ? ` · ${r.owner_email}` : ""}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{r.license_key}</td>
                        <td className="px-4 py-3"><span className="text-[10px] font-black uppercase text-purple-400">{r.plan}</span></td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-300">{r.activated_instances}</td>
                        <td className="px-4 py-3">
                          {r.expires_at ? (
                            <div>
                              <span className={`text-[11px] font-bold ${r.expired ? "text-red-400" : r.days_left !== null && r.days_left <= 30 ? "text-amber-400" : "text-slate-300"}`}>
                                {new Date(r.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                              <span className="block text-[9px] text-slate-500">
                                {r.expired ? "EXPIRED" : r.days_left !== null ? `${r.days_left} days left` : ""}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-400">Lifetime</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                            r.active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                              : r.expired ? "bg-red-500/15 text-red-400 border-red-500/25"
                                : "bg-amber-500/15 text-amber-400 border-amber-500/25"
                          }`}>
                            {r.expired ? "expired" : r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openKit(r)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 rounded-xl text-[10px] font-black text-indigo-300 hover:text-indigo-200 transition-all"
                          >
                            <Package size={12} /> Create Package
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <p className="text-[10px] text-slate-600 font-semibold">
          Har package mein <span className="font-mono">.env.production</span>, <span className="font-mono">SETUP.md</span>, <span className="font-mono">DEPLOY.md</span>, <span className="font-mono">LICENSE_KEY.txt</span> aur <span className="font-mono">app-info.json</span> hota hai. License service URL/key seller ke deployment ke env se aati hai. Data central <span className="font-mono">vtech_licence</span> project se.
        </p>
      </div>

      {/* ── Setup Kit modal ── */}
      {kitFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-[#12161f] border border-slate-200 dark:border-[#21293d] rounded-2xl p-5 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Package size={15} className="text-indigo-500 dark:text-indigo-400" /> Setup Kit — {prefill?.shopName || kitFor.shop_name || "Client"}
                </h2>
                <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold mt-1">{prefill?.licenseKey || kitFor.license_key}</p>
              </div>
              <button onClick={() => setKitFor(null)} className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-[#161b27] border border-slate-200 dark:border-[#21293d] hover:border-red-500/40 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                <X size={14} />
              </button>
            </div>

            {kitMsg && (
              <p className={`mt-3 text-xs font-semibold rounded-xl px-4 py-3 border ${kitMsg.startsWith("Package") || kitMsg.startsWith("Prefill") ? "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20" : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"}`}>
                {kitMsg}
              </p>
            )}

            {prefillLoading ? (
              <div className="h-32 flex items-center justify-center text-slate-500 gap-2 text-xs font-bold uppercase tracking-widest">
                <Loader2 size={16} className="animate-spin" /> Loading...
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <label className={labelCls}>App URL (client ka hosted app)</label>
                  <input className={inputCls} value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://client-shop.vercel.app" />
                </div>
                <div>
                  <label className={labelCls}>Supabase Project URL</label>
                  <input className={inputCls} value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SecretField label="Anon (public) Key" value={anonKey} onChange={setAnonKey} placeholder="eyJ..." />
                  <SecretField label="Service Role Key ⚠️" value={serviceRoleKey} onChange={setServiceRoleKey} placeholder="eyJ..." />
                </div>
                <div>
                  <label className={labelCls}>Setup Token (khali chhoro to auto)</label>
                  <input className={inputCls} value={setupToken} onChange={(e) => setSetupToken(e.target.value)} placeholder="auto-derived" />
                  <p className="text-[10px] text-slate-500 dark:text-slate-600 mt-1">Pehli baar /setup par admin banana is token se lock rahega. Blank → seller secret se auto derive.</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={saveCreds} onChange={(e) => setSaveCreds(e.target.checked)} className="w-4 h-4 accent-indigo-500" />
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Credentials ko portal mein save karo (encrypted at rest) — dobara package banane ke liye ready</span>
                </label>

                <div className="pt-2 border-t border-slate-200 dark:border-[#1a2234]">
                  <div className="flex items-center gap-2 mb-3">
                    <Rocket size={13} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Push to Vercel (client ke apne account par)</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className={labelCls}>Vercel Project URL</label>
                      <input className={inputCls} value={vercelProjectUrl} onChange={(e) => setVercelProjectUrl(e.target.value)} placeholder="https://client-shop.vercel.app" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Vercel Project ID</label>
                        <input className={inputCls} value={vercelProjectId} onChange={(e) => setVercelProjectId(e.target.value)} placeholder="prj_xxx" />
                      </div>
                      <SecretField label="Vercel API Token" value={vercelToken} onChange={setVercelToken} placeholder="Client ke account ka token" />
                    </div>
                    <div>
                      <label className={labelCls}>Custom Domain (optional)</label>
                      <input className={inputCls} value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="shop1.vtechshop.com" />
                      <p className="text-[10px] text-slate-500 dark:text-slate-600 mt-1">
                        Bina URL scheme ke sirf domain (e.g. <span className="font-mono">kamal.vtechshop.com</span>). Wildcard ke andar ka subdomain auto-verified; naya domain ho to Vercel DNS/TXT verify karna hoga.
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-600">
                      Token client ke apne Vercel account (Account → Settings → Tokens) ka ho. Project ID: Project → Settings → General → Project ID.
                    </p>
                    <button onClick={push} disabled={pushBusy}
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/40 disabled:opacity-50 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 rounded-xl text-[11px] font-black tracking-wide transition-all">
                      {pushBusy ? <><Loader2 size={14} className="animate-spin" /> Pushing + Deploying...</> : <><Rocket size={14} /> Push Env & Redeploy Production</>}
                    </button>
                    {pushMsg && (
                      <p className={`text-[11px] font-semibold rounded-xl px-3 py-2.5 border ${pushMsg.startsWith("Push fail") ? "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20" : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"}`}>
                        {pushMsg}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button onClick={() => setKitFor(null)} className="px-4 py-2.5 bg-slate-100 dark:bg-[#1a2234] hover:bg-slate-200 dark:hover:bg-[#232c42] rounded-xl text-[11px] font-black text-slate-600 dark:text-slate-300 transition-all">
                    Cancel
                  </button>
                  <button onClick={generate} disabled={kitBusy}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-[11px] font-black tracking-wide transition-all">
                    {kitBusy ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Download size={14} /> Generate & Download</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PortalGate>
  );
}
