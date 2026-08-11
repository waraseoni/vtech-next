"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ShieldAlert, Loader2, RefreshCw, Unlock, Search,
  CheckCircle, AlertCircle, Timer,
} from "lucide-react";

interface ThrottleRow {
  id: number;
  email: string;
  ip_address: string;
  attempt_count: number;
  first_attempt_at: string | null;
  lockout_until: string | null;
  last_attempt_at: string | null;
}

type Toast = { type: "success" | "error"; msg: string };

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(d));
}

function remaining(lockout_until: string | null): string {
  if (!lockout_until) return "";
  const ms = new Date(lockout_until).getTime() - Date.now();
  if (ms <= 0) return "";
  const min = Math.ceil(ms / 60000);
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min} min`;
}

export default function ThrottlePage() {
  const router = useRouter();
  const [rows,    setRows]    = useState<ThrottleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q,       setQ]       = useState("");
  const [unlock,  setUnlock]  = useState<ThrottleRow | null>(null);
  const [busy,    setBusy]    = useState(false);
  const [toast,   setToast]   = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (myProfile?.role !== "admin") { router.push("/"); return; }

      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const res = await fetch(`/api/admin/throttle?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Load fail");
      setRows(data.rows || []);
    } catch (err) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Load fail hua" });
    } finally {
      setLoading(false);
    }
  }, [q, router]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleUnlock = async () => {
    if (!unlock) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/throttle", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unlock.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast({ type: "success", msg: `${unlock.email} unlock ho gaya.` });
      setUnlock(null);
      fetchRows();
    } catch (err) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Unlock fail hua" });
    } finally {
      setBusy(false);
    }
  };

  const stats = {
    locked: rows.filter(r => r.lockout_until && new Date(r.lockout_until) > new Date()).length,
  };

  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-12">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold ${
          toast.type === "success"
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            : "bg-red-500/15 border-red-500/30 text-red-400"
        }`}>
          {toast.type === "success" ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
          {toast.msg}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-4">

        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center">
              <ShieldAlert size={18} className="text-white"/>
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Login Throttle</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                Admin Panel · {stats.locked} locked
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchRows}
              className="w-9 h-9 flex items-center justify-center bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 hover:text-white rounded-xl transition-all">
              <RefreshCw size={14}/>
            </button>
          </div>
        </div>

        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"/>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") fetchRows(); }}
              placeholder="Email se search karein..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white font-medium placeholder:text-slate-700 outline-none focus:border-blue-500/60 transition-all"
            />
          </div>
        </div>

        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-blue-500" size={32}/>
              <p className="text-slate-600 text-xs font-black uppercase tracking-widest">Loading...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <ShieldAlert size={36} className="mx-auto text-slate-700"/>
              <p className="text-slate-500 text-sm font-bold">Koi locked account nahi</p>
              <p className="text-slate-700 text-xs">Login attempts ka throttle yahan dikhega jab koi account lock hoga.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#111520] border-b border-[#21293d]">
                    {["Email", "IP", "Attempts", "Locked Till", "Last Attempt", "Action"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2030]">
                  {rows.map(r => {
                    const active = r.lockout_until && new Date(r.lockout_until) > new Date();
                    return (
                      <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-200 text-sm">{r.email}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{r.ip_address}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black ${
                            r.attempt_count >= 5 ? "bg-red-500/15 text-red-400 border border-red-500/25"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}>
                            {r.attempt_count} fail
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {active ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400">
                              <Timer size={11}/> {fmtDate(r.lockout_until)} ({remaining(r.lockout_until)} baaki)
                            </span>
                          ) : (
                            <span className="text-slate-700 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(r.last_attempt_at)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setUnlock(r)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#1e2637] border border-[#2a3550] hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 text-slate-400 rounded-lg text-xs font-bold transition-all">
                            <Unlock size={11}/> Unlock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-[#111520] border border-[#21293d] rounded-xl px-4 py-3">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-2">ℹ Ye kya hai</p>
          <p className="text-xs text-slate-700 leading-relaxed">
            5 galat attempts → 15 min lock. Baar-baar fail karne par lock time badhta hai (15m → 30m → 1h ... max 24h).
            Ek IP se 30+ alag emails par fail → IP 15 min ke liye block. Ye table browser client se closed hai — sirf server-side API ise use karti hai.
          </p>
        </div>

      </div>

      {unlock && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setUnlock(null); }}>
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-500/15 rounded-2xl flex items-center justify-center mx-auto">
                <Unlock size={20} className="text-emerald-400"/>
              </div>
              <h3 className="text-base font-black text-white">Unlock Karein?</h3>
              <p className="text-sm text-slate-500">
                <strong className="text-slate-300">{unlock.email}</strong> ka login lock hata dein? Fail counter bhi clear ho jayega.
              </p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setUnlock(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#21293d] text-slate-400 hover:bg-white/5 font-bold text-sm transition-all">
                Cancel
              </button>
              <button onClick={handleUnlock} disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                {busy ? <><Loader2 size={14} className="animate-spin"/>Unlocking...</> : <><Unlock size={14}/> Unlock</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
