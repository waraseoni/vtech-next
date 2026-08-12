"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  UserRound, Mail, Lock, ShieldCheck, Loader2, ArrowRight, KeyRound, CheckCircle2, AlertCircle,
} from "lucide-react";

// One-time first-run setup page (client package ka hissa).
// Jab tak profiles mein admin nahi hai, pehla aadmi admin bana sakta hai.
// Setup complete hone ke baad ye page /login par redirect kar deta hai.
export default function SetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d1117]" />}>
      <SetupPageInner />
    </Suspense>
  );
}

function SetupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qToken = searchParams.get("setup_token") ?? "";

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [tokenRequired, setTokenRequired] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [token, setToken] = useState(qToken);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/setup/status", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Status check fail"); setLoading(false); return; }
        setNeedsSetup(data.needsSetup);
        setTokenRequired(data.tokenRequired);
        if (data.loggedIn) { router.replace("/dashboard"); return; }
      } catch {
        setError("Server se connect nahi ho paya.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Dono password match nahi kar rahe"); return; }
    if (password.length < 6) { setError("Password kam se kam 6 characters ka hona chahiye"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, password, token: token || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Setup fail hua"); return; }
      setDone(true);
      setTimeout(() => router.replace("/login"), 1800);
    } catch {
      setError("Server error — dobara try karein.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full pl-11 pr-4 py-3 bg-[#111520] border border-[#21293d] rounded-xl text-sm text-white font-medium placeholder:text-slate-700 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all";

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-900/50">
            <ShieldCheck size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            V-TECH <span className="text-blue-400 font-light">PRO</span>
          </h1>
          <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.2em] mt-1">
            Initial Setup
          </p>
        </div>

        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-7 shadow-2xl">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-slate-500 gap-2 text-xs font-bold uppercase tracking-widest">
              <Loader2 size={16} className="animate-spin" /> Checking...
            </div>
          ) : done ? (
            <div className="text-center py-6">
              <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-black text-white">Setup complete!</p>
              <p className="text-xs text-slate-500 mt-1 font-semibold">Login page par le ja rahe hain...</p>
            </div>
          ) : !needsSetup ? (
            <div className="text-center py-6">
              <AlertCircle size={40} className="text-amber-400 mx-auto mb-3" />
              <p className="text-sm font-black text-white">Setup already complete</p>
              <p className="text-xs text-slate-500 mt-1 font-semibold">Is system ka admin pehle se bana hua hai.</p>
              <button onClick={() => router.replace("/login")}
                className="mt-5 w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2">
                Login karein <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="text-center mb-1">
                <h2 className="text-lg font-black text-white">Admin Account Banao</h2>
                <p className="text-slate-600 text-sm mt-0.5">Pehla user is system ka admin banega.</p>
              </div>

              {error && (
                <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-3 rounded-xl">
                  <AlertCircle size={15} className="flex-shrink-0" /> {error}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Full Name</label>
                <div className="relative">
                  <UserRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                  <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Shop owner ka naam" required />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                  <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@shop.com" required />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                  <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kam se kam 6 characters" required />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                  <input type="password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Dobara password" required />
                </div>
              </div>

              {tokenRequired && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Setup Token</label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                    <input className={inputCls} value={token} onChange={(e) => setToken(e.target.value)} placeholder="Seller se mila setup token" required />
                  </div>
                </div>
              )}

              <button type="submit" disabled={busy}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/30 mt-2">
                {busy ? <><Loader2 size={17} className="animate-spin" /> Setting up...</> : <><ShieldCheck size={17} /> Create Admin & Continue</>}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-slate-700 text-[11px] mt-5 font-medium">
          V-Technologies · Jabalpur · 9179105875
        </p>
      </div>
    </div>
  );
}
