"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, LogOut, ShieldCheck } from "lucide-react";

// 15 minute inactivity ke baad portal auto-lock (cookie clear). Timer har
// activity (mouse/key/touch/scroll) par reset hota hai.
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const IDLE_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "touchmove", "scroll", "wheel"] as const;

// Portal gate: "double password" ka UI hissa.
// 1) App login pehle (RootClient ise gate karta hai — non-logged-in user yahan nahi pahunchta)
// 2) Is component se portal-specific password poochta hai (server-side env se verify)
// Password sahi → signed cookie (HttpOnly) → children render hota hai.
export default function PortalGate({
  authUrl,
  title,
  description,
  badge,
  children,
  onOpen,
}: {
  authUrl: string;
  title: string;
  description: string;
  badge: string;
  children: React.ReactNode;
  onOpen?: () => void;
}) {
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // onOpen ko ref me rakho taaki auth check effect stable rahe (deps change na ho).
  const onOpenRef = useRef(onOpen);
  useEffect(() => { onOpenRef.current = onOpen; });

  // Gate open hone par data-load trigger karo. (load() page-mount par nahi chalna
  // chahiye — portal cookie set hone se pehle 401 aata hai. Refresh se pehle
  // data na dikhne ka yahi root cause tha.)
  const open = useCallback(() => {
    setState("open");
    onOpenRef.current?.();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(authUrl, { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) open();
        else setState("locked");
      } catch {
        if (!cancelled) setState("locked");
      }
    })();
    return () => { cancelled = true; };
  }, [authUrl, open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch(authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Wrong password");
        return;
      }
      open();
    } catch {
      setError("Server se connect nahi ho paya.");
    } finally {
      setBusy(false);
    }
  };

  // Logout: portal cookie server-side clear + gate lock (app login intact rahta hai).
  const logout = useCallback(async () => {
    try {
      await fetch(authUrl, { method: "DELETE", cache: "no-store" });
    } catch {
      // Cookie server-side clear ho jaye (network fail ho to bhi)
    }
    setState("locked");
    setPassword("");
    setError("");
  }, [authUrl]);

  // Inactivity auto-logoff — sirf jab gate open ho.
  useEffect(() => {
    if (state !== "open") return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { void logout(); }, IDLE_TIMEOUT_MS);
    };
    IDLE_EVENTS.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      IDLE_EVENTS.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [state, logout]);

  if (state === "checking") {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-slate-500 gap-2 text-xs font-bold uppercase tracking-widest">
        <Loader2 size={16} className="animate-spin" /> Checking...
      </div>
    );
  }

  if (state === "locked") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#111520] border border-[#21293d] rounded-3xl p-8 shadow-2xl shadow-black/50">
          <div className="w-14 h-14 bg-indigo-500/15 text-indigo-400 rounded-2xl flex items-center justify-center mb-5">
            <ShieldCheck size={26} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">{badge}</span>
          <h1 className="text-xl font-black text-white tracking-tight mt-1">{title}</h1>
          <p className="text-[13px] text-slate-400 mt-1.5 leading-relaxed">{description}</p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Portal password"
              autoFocus
              className="w-full px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
            {error && (
              <p className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !password}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black tracking-wide transition-all"
            >
              {busy ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : <><KeyRound size={15} /> Unlock Portal</>}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#1a2234]">
            <Link href="/" className="text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors">
              Dashboard par wapas
            </Link>
            <span className="text-[9px] block mt-2 text-slate-700 font-black uppercase tracking-widest">
              Double password: login + portal password
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <button
        type="button"
        onClick={() => { void logout(); }}
        title="Portal se log out (15 min inactivity par auto-lock)"
        className="fixed bottom-5 right-5 z-[100] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#161b27] border border-[#21293d] hover:border-red-500/40 text-slate-400 hover:text-red-400 text-xs font-black tracking-wide shadow-lg shadow-black/40 transition-all"
      >
        <LogOut size={14} /> Logout
      </button>
    </>
  );
}
