"use client";
import { useState, useEffect } from "react";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { Fingerprint, Loader2, Plus, Trash2, Pen, Check, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { isNativeApp } from "@/lib/nativeApp";

// Devices (Passkey / Fingerprint Login) — docs/plans/passkey_biometric_login_plan.md §5.2
// /profile page me mount hota hai (sab staff khud enroll kar sakte hain; /settings admin-only hai).
// Enrollment = password re-auth + WebAuthn create.
type Device = {
  id: number;
  device_name: string;
  last_used_at: string | null;
  date_created: string;
};

const inputCls =
  "w-full px-3 py-2.5 bg-app border border-app rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-app";
const btnPrimary =
  "bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-95";
const btnGhost =
  "bg-panel-2 border border-app hover:border-blue-500/40 text-muted hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition-all";

function fmt(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function PasskeyDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(false);
  // Capacitor app me enroll nahi ho sakta (WebView me platform authenticator
  // wired hi nahi) — isliye alag message dikhana hai.
  const [inNativeApp, setInNativeApp] = useState(false);

  const [showEnroll, setShowEnroll] = useState(false);
  const [password, setPassword] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/passkey/devices");
      const data = await res.json();
      if (res.ok) setDevices(data.devices ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // WebAuthn support secure-context me sync check hota hai. Platform biometric
    // (fingerprint/Hello) alag device-specific baat hai — isliye button gate nahi
    // karte; browser available authenticator (fingerprint / Hello / security key)
    // khud offer karta hai.
    //
    // Android WebView me `PublicKeyCredential` DEFINED hota hai (check true
    // deta hai) par platform authenticator wired hi nahi — enrollment bhi wahi
    // par atak jayegi. Isliye app me enroll button hi mat dikhao.
    const native = isNativeApp();
    setInNativeApp(native);
    setSupported(!native && browserSupportsWebAuthn());
  }, []);

  const enroll = async () => {
    if (!password.trim()) {
      toast.error("Password daalein (confirm karne ke liye)");
      return;
    }
    setBusy(true);
    try {
      const begin = await fetch("/api/passkey/register-begin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, deviceName }),
      });
      const beginData = await begin.json();
      if (!begin.ok) {
        toast.error(beginData.error || "Enroll shuru nahi ho paaya");
        return;
      }

      const attestation = await startRegistration({ optionsJSON: beginData.options });

      const finish = await fetch("/api/passkey/register-finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: attestation, deviceName }),
      });
      const finishData = await finish.json();
      if (!finish.ok) {
        toast.error(finishData.error || "Device add nahi ho paaya");
        return;
      }

      toast.success("Device add ho gaya! Ab fingerprint se login kar sakte hain.");
      setShowEnroll(false);
      setPassword("");
      setDeviceName("");
      await load();
    } catch (e) {
      const cancelled = e instanceof Error && e.name === "NotAllowedError";
      toast.error(cancelled ? "Cancel ho gaya" : "Device add nahi ho paaya");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Ye device hata dein? Is device se fingerprint login band ho jayega.")) {
      return;
    }
    const res = await fetch(`/api/passkey/devices?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Device hataya nahi gaya");
      return;
    }
    toast.success("Device hata diya");
    load();
  };

  const rename = async (id: number) => {
    const name = editName.trim();
    if (!name) return;
    const res = await fetch("/api/passkey/devices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, device_name: name }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Naam nahi badla");
      return;
    }
    setEditing(null);
    load();
  };

  return (
    <div className="p-5 space-y-4">
      <p className="text-[11px] text-muted-2">
        Fingerprint / Windows Hello / Face ID se bina password login. Password hamesha fallback
        rahega — device kho jaye to password se login karke yahan se hata dein.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-2">
          <Loader2 size={14} className="animate-spin" /> Load ho raha hai...
        </div>
      ) : devices.length === 0 ? (
        <p className="text-xs text-muted-2">Abhi koi device registered nahi hai.</p>
      ) : (
        <div className="space-y-2">
          {devices.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 bg-panel-2 border border-app rounded-xl px-3.5 py-3"
            >
              <Fingerprint size={18} className="text-blue-400 shrink-0" />
              <div className="min-w-0 flex-1">
                {editing === d.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={60}
                      className={`${inputCls} py-1.5`}
                      autoFocus
                    />
                    <button type="button" onClick={() => rename(d.id)} className={btnGhost}>
                      <Check size={13} />
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className={btnGhost}>
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-bold text-white truncate">{d.device_name}</p>
                    <p className="text-[10px] text-muted-2">
                      Last used: {fmt(d.last_used_at)} · Added: {fmt(d.date_created)}
                    </p>
                  </>
                )}
              </div>
              {editing !== d.id && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    title="Naam badlein"
                    onClick={() => {
                      setEditing(d.id);
                      setEditName(d.device_name);
                    }}
                    className={btnGhost}
                  >
                    <Pen size={13} />
                  </button>
                  <button
                    type="button"
                    title="Hata dein"
                    onClick={() => remove(d.id)}
                    className="bg-panel-2 border border-red-500/30 hover:border-red-500/60 text-red-400 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!supported ? (
        <p className="text-[11px] text-muted-2">
          {inNativeApp
            ? "App me fingerprint setup available nahi hai — Chrome browser me yahi site khol kar profile me aayein, wahan device add kar sakte hain. Yahan se naam badal / device hata sakte hain."
            : "Is browser par passkey support nahi hai. HTTPS (ya localhost) par kholein aur latest Chrome/Edge/Safari use karein."}
        </p>
      ) : showEnroll ? (
        <div className="space-y-3 bg-panel-2 border border-app rounded-xl p-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
              Password (confirm karne ke liye)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
              Device ka naam (optional)
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              maxLength={60}
              placeholder="Office PC / Galaxy A32"
              className={inputCls}
            />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={enroll} disabled={busy} className={btnPrimary}>
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Scanning...
                </>
              ) : (
                <>
                  <Fingerprint size={14} /> Add karein
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEnroll(false);
                setPassword("");
                setDeviceName("");
              }}
              disabled={busy}
              className={btnGhost}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowEnroll(true)} className={btnPrimary}>
          <Plus size={14} /> Naya device add karein
        </button>
      )}
    </div>
  );
}
