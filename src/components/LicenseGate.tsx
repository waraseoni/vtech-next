"use client";

import { useState } from "react";
import { KeyRound, LogOut, RefreshCw, ShieldAlert, Loader2 } from "lucide-react";
import type { LicenseStatus } from "@/lib/license";

// License expiry / trial mode ke time par full-screen gate.
// Login hamesha allowed hai — login ke BAAD ye gate dikhta hai taaki admin naya
// key daal sake (Settings tak jaane ki zaroorat nahi). Staff/client ko sirf
// message dikhta hai (unke paas key nahi hoti).
export default function LicenseGate({
  status,
  isAdmin,
  onActivated,
  onLogout,
}: {
  status: LicenseStatus;
  isAdmin: boolean;
  onActivated: () => void;
  onLogout: () => void;
}) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const expired = !!status.expiresAt && new Date(status.expiresAt).getTime() < Date.now();

  // Central check ka specific reason (agar ho) — deleted/revoked license par
  // user ko sahi message dikhe, generic "invalid" nahi.
  const reasonText = (() => {
    const e = status.error ?? "";
    if (e.includes("NOT_ACTIVATED") || e.includes("LICENSE_NOT_ACTIVE")) {
      return "Ye license seller ne abhi active nahi rakha (shayad delete/revoke kar diya hai). Seller se naya key ya renewal request karein.";
    }
    if (e.includes("LICENSE_DISABLED")) {
      return "Ye license seller ne disable kar diya hai. Seller se contact karein.";
    }
    if (e.includes("LICENSE_EXPIRED")) {
      return "Ye license expire ho chuka hai. Renewal ke liye seller se baat karein.";
    }
    if (e.includes("UNREACHABLE")) {
      return "License service tak nahi pahunch pa rahe hain. Internet/network check karke dobara try karein.";
    }
    return "";
  })();

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Activation failed");
        return;
      }
      onActivated();
    } catch {
      setError("Server se connect nahi ho paya. Dobara try karein.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-[#111520] border border-[#21293d] rounded-3xl p-8 shadow-2xl shadow-black/50 anim-fade">
          {/* Icon */}
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${
              expired ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"
            }`}
          >
            {expired ? <ShieldAlert size={26} /> : <KeyRound size={26} />}
          </div>

          {/* Title */}
          <h1 className="text-xl font-black text-white tracking-tight">
            {expired ? "License Expired" : status.activated ? "License Invalid" : "Trial Mode"}
          </h1>
          <p className="text-[13px] text-slate-400 mt-1.5 leading-relaxed">
            {expired ? (
              <>
                Aapka license{" "}
                <span className="text-red-400 font-bold">
                  {new Date(status.expiresAt!).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </span>{" "}
                ko khatam ho gaya hai.
              </>
            ) : status.activated ? (
              reasonText ? (
                <>{reasonText}</>
              ) : (
                "License abhi active nahi hai. System ko chalaane ke liye naya key chahiye."
              )
            ) : (
              "Ye system bina license (trial mode) mein hai. System unlock karne ke liye license key daalein."
            )}
          </p>

          {status.shopName && (
            <div className="mt-4 flex items-center justify-between bg-[#1a2234] rounded-xl px-4 py-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Shop</span>
              <span className="text-xs font-bold text-slate-200">{status.shopName}</span>
            </div>
          )}

          {/* ── Key form (sirf admin) ── */}
          {isAdmin ? (
            <form onSubmit={handleActivate} className="mt-6 space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  License Key (VTC-XXXX-XXXX-XXXX-XXXX)
                </label>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  placeholder="VTC-XXXX-XXXX-XXXX-XXXX"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm font-mono font-bold tracking-wider text-slate-100 placeholder:text-slate-600 placeholder:font-sans outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>

              {error && (
                <p className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || key.trim().length < 5}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black tracking-wide transition-all"
              >
                {busy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Activating...
                  </>
                ) : (
                  <>
                    <KeyRound size={15} /> Activate License
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setError(""); onActivated(); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors"
              >
                <RefreshCw size={13} /> Status refresh karein
              </button>
            </form>
          ) : (
            <div className="mt-6 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-200/90 font-semibold leading-relaxed">
              Is shop ka license active nahi hai. Kripya shop ke admin / seller se
              renew karwane ki request karein.
            </div>
          )}

          {/* ── Logout — kabhi bhi available, taaki koi atka na rahe ── */}
          <div className="mt-6 pt-5 border-t border-[#1a2234] flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-700">
              V-TECH PRO · Licensing
            </span>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-400 transition-colors"
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
