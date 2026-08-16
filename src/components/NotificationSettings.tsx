"use client";
import { useState, useEffect } from "react";
import { Bell, BellOff, Loader2, CheckCircle2, AlertCircle, Smartphone } from "lucide-react";
import { pushStatus, subscribeToPush, disablePush } from "@/lib/push";

/**
 * Web Push notification toggle (PWA).
 * - "Enable": browser permission + PushManager subscribe → push_subscriptions table
 * - "Disable": unsubscribe + table entry delete
 * VAPID key configured nahi ho to informative message dikhata hai.
 */
export default function NotificationSettings() {
  const [status, setStatus] = useState<{ supported: boolean; enabled: boolean; permission: string; vapidConfigured: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const load = async () => setStatus(await pushStatus());

  useEffect(() => { load(); }, []);

  const handleEnable = async () => {
    setBusy(true);
    setMsg(null);
    const res = await subscribeToPush();
    setBusy(false);
    if (res.ok) {
      setMsg({ type: res.mode === "denied" ? "error" : "success", text: res.mode === "denied" ? "Notifications browser me block hain — settings se allow karein." : res.mode === "unsupported" ? "Ye browser Push notifications support nahi karta." : "Push notifications enabled!" });
    } else {
      setMsg({ type: "error", text: res.error });
    }
    load();
  };

  const handleDisable = async () => {
    setBusy(true);
    setMsg(null);
    const res = await disablePush();
    setBusy(false);
    if (res.ok) setMsg({ type: "success", text: "Push notifications disabled." });
    else setMsg({ type: "error", text: res.error });
    load();
  };

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-slate-600 text-xs">
        <Loader2 size={14} className="animate-spin" /> Checking push support...
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {!status.supported ? (
        <div className="flex items-start gap-3 bg-slate-500/5 border border-slate-500/20 rounded-xl px-4 py-3">
          <BellOff size={15} className="text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500">
            Ye browser Push notifications support nahi karta. Chrome / Edge / Android me use karein.
          </p>
        </div>
      ) : (
        <>
          {!status.vapidConfigured && (
            <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400/90 leading-relaxed">
                <strong>VAPID public key</strong> configured nahi hai. Push enable karne ke liye production me{" "}
                <code className="font-mono bg-black/30 px-1 rounded">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> env var set karna hoga.
              </p>
            </div>
          )}

          {msg && (
            <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 ${
              msg.type === "success"
                ? "bg-emerald-500/8 border border-emerald-500/20"
                : msg.type === "error"
                  ? "bg-red-500/8 border border-red-500/20"
                  : "bg-blue-500/8 border border-blue-500/20"
            }`}>
              {msg.type === "success"
                ? <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                : msg.type === "error"
                  ? <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                  : <Bell size={14} className="text-blue-400 flex-shrink-0" />}
              <p className={`text-xs font-bold ${
                msg.type === "success" ? "text-emerald-400" : msg.type === "error" ? "text-red-400" : "text-blue-400"
              }`}>{msg.text}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {status.enabled ? (
              <button onClick={handleDisable} disabled={busy}
                className="flex items-center gap-2 text-xs bg-red-600/15 text-red-400 border border-red-600/30 px-4 py-2 rounded-xl hover:bg-red-600/25 transition-all font-bold">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <BellOff size={14} />}
                Disable Push Notifications
              </button>
            ) : (
              <button onClick={handleEnable} disabled={busy || !status.vapidConfigured}
                className="flex items-center gap-2 text-xs bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-500 transition-all font-bold disabled:opacity-40">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                Enable Push Notifications
              </button>
            )}
            <span className="flex items-center gap-1.5 text-[10px] text-slate-600 font-bold uppercase tracking-wider">
              <Smartphone size={11} /> {status.permission === "granted" ? "Permission granted" : `Permission: ${status.permission}`}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
