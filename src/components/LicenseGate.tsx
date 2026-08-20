"use client";

import { useState } from "react";
import { KeyRound, LogOut, RefreshCw, ShieldAlert, ShieldCheck, Loader2, Phone, MessageCircle, MapPin, User, Mail } from "lucide-react";
import type { LicenseStatus } from "@/lib/license";
import { SELLER_INFO } from "@/lib/seller-info";

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
  const [fixing, setFixing] = useState(false);
  const [fixMsg, setFixMsg] = useState("");

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

  // Auto-fix: agar profile missing/galat role hai to fix karo
  const handleFixRole = async () => {
    setFixing(true);
    setFixMsg("");
    try {
      const res = await fetch("/api/debug/fix-role", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setFixMsg(data.error || "Fix nahi ho paya");
        return;
      }
      setFixMsg(data.action === "promoted_to_admin"
        ? "Role fixed! Admin banaya gaya hai. Page refresh ho raha hai..."
        : data.action === "created_as_admin"
        ? "Profile banayi gayi hai (admin). Page refresh ho raha hai..."
        : "Aap pehle se admin hain.");
      if (data.action !== "already_admin") {
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch {
      setFixMsg("Server se connect nahi ho paya.");
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-[#111520] border border-[#21293d] rounded-3xl p-8 shadow-2xl shadow-black/50 anim-fade">

          {/* ── Header: icon + title + badge + message — sab compact ── */}
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                expired ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"
              }`}
            >
              {expired ? <ShieldAlert size={22} /> : <KeyRound size={22} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-black text-white tracking-tight">
                  {expired ? "License Expired" : status.activated ? "License Invalid" : "Trial Mode"}
                </h1>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                  expired
                    ? "text-red-400 border-red-500/25 bg-red-500/10"
                    : "text-amber-400 border-amber-500/25 bg-amber-500/10"
                }`}>
                  {expired ? "Expired" : status.activated ? "Invalid" : "Trial"}
                </span>
              </div>
              <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
                {expired ? (
                  <>
                    Aapka license{" "}
                    <span className="text-red-400 font-bold">
                      {new Date(status.expiresAt!).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                    </span>{" "}
                    ko khatam ho gaya hai.
                  </>
                ) : status.activated ? (
                  reasonText || "License abhi active nahi hai. System ko chalaane ke liye naya key chahiye."
                ) : (
                  "System unlock karne ke liye license key daalein."
                )}
              </p>
            </div>
          </div>

          {/* ── Shop name ── */}
          {status.shopName && (
            <div className="mt-3.5 flex items-center justify-between bg-[#1a2234] rounded-xl px-4 py-2.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Shop</span>
              <span className="text-xs font-bold text-slate-200">{status.shopName}</span>
            </div>
          )}

          {/* ── Seller contact info ── */}
          <div className="mt-3.5 bg-[#0f1a2e] border border-blue-500/15 rounded-xl p-3.5 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400/70 mb-2">
              License ke liye sampark karein
            </p>
            <div className="flex items-center gap-2.5">
              <User size={12} className="text-slate-500 shrink-0" />
              <span className="text-[11px] text-slate-300">{SELLER_INFO.name}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <MapPin size={12} className="text-slate-500 shrink-0" />
              <span className="text-[11px] text-slate-300 leading-snug">{SELLER_INFO.address}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Phone size={12} className="text-slate-500 shrink-0" />
              <a href={`tel:${SELLER_INFO.phone}`} className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">{SELLER_INFO.phone}</a>
            </div>
            <div className="flex items-center gap-2.5">
              <MessageCircle size={12} className="text-emerald-500 shrink-0" />
              <a
                href={`https://wa.me/${SELLER_INFO.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                WhatsApp par message karein
              </a>
            </div>
            <div className="flex items-center gap-2.5">
              <Mail size={12} className="text-slate-500 shrink-0" />
              <a href={`mailto:${SELLER_INFO.email}`} className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">{SELLER_INFO.email}</a>
            </div>
          </div>

          {/* ── Key form ── */}
          <form onSubmit={handleActivate} className="mt-5 space-y-3">
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

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || key.trim().length < 5}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black tracking-wide transition-all"
              >
                {busy ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Activating...
                  </>
                ) : (
                  <>
                    <KeyRound size={13} /> Activate License
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setError(""); onActivated(); }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-[#21293d] text-xs font-bold text-slate-500 hover:text-slate-300 hover:border-slate-500/50 transition-colors"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </form>

          {/* ── Non-admin: auto-fix button ── */}
          {!isAdmin && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-bold text-amber-400/70 text-center">
                Agar aap admin hain par system nahi maan raha:
              </p>
              <button
                type="button"
                onClick={handleFixRole}
                disabled={fixing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-xs font-black tracking-wide transition-all disabled:opacity-50"
              >
                {fixing ? (
                  <><Loader2 size={14} className="animate-spin" /> Fixing...</>
                ) : (
                  <><ShieldCheck size={14} /> Fix Admin Role (Auto)</>
                )}
              </button>
              {fixMsg && (
                <p className={`text-[11px] font-semibold text-center ${fixMsg.includes("nahi") || fixMsg.includes("galat") ? "text-red-400" : "text-emerald-400"}`}>
                  {fixMsg}
                </p>
              )}
            </div>
          )}

          {/* ── Footer ── */}
          <div className="mt-5 pt-4 border-t border-[#1a2234] flex items-center justify-between">
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
