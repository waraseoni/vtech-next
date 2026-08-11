"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { LogIn, Mail, Lock, Loader2, ShieldCheck, Eye, EyeOff, AlertCircle, Globe, Smartphone, KeyRound, ArrowLeft, UserRound } from "lucide-react";

type Tab = "staff" | "client";

function TabButton({ t, icon, label, active, onSelect }: { t: Tab; icon: React.ReactNode; label: string; active: boolean; onSelect: (t: Tab) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(t)}
      className={`flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
          : "bg-[#111520] text-slate-500 hover:text-slate-300"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export default function LoginPage() {
  useRouter();
  const [tab,          setTab]          = useState<Tab>("staff");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [rememberMe,   setRememberMe]   = useState(false);
  const [showPass,     setShowPass]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  // Client OTP state
  const [clientEmail,  setClientEmail]  = useState("");
  const [otpStep,      setOtpStep]      = useState<"request" | "verify">("request");
  const [otp,          setOtp]          = useState("");
  const [info,         setInfo]         = useState("");

  // ── Load saved email ───────────────────────────────────────────────────
  useEffect(() => {
    const savedEmail    = localStorage.getItem("vtech_email");
    const savedRemember = localStorage.getItem("vtech_remember") === "true";
    if (savedRemember && savedEmail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage SSR me exist nahi karta; mount-time init hi sahi hai
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // ── Auto-logoff reason (revoked access / idle timeout) ────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("reason");
    if (reason === "revoked") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL params sirf browser me hote hain; render me read nahi kar sakte
      setTab("client");
      setError("Aapki portal access band kar di gayi hai. Dobara access ke liye shop se sampark karein.");
    } else if (reason === "idle") {
      setTab("client");
      setError("Kuchh der inactivity ki wajah se aap automatically logout ho gaye hain. Dobara login karein.");
    }
  }, []);

  // ── Staff login handler ────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "password", email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Login fail hua. Dobara try karein.");
      setLoading(false);
      return;
    }

    if (rememberMe) {
      localStorage.setItem("vtech_email",    email);
      localStorage.setItem("vtech_remember", "true");
    } else {
      localStorage.removeItem("vtech_email");
      localStorage.removeItem("vtech_remember");
    }

    // Intentional full reload: login ke baad RootClient session state fresh initialize hota hai
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/dashboard";
  };

  // ── Client OTP: send code ──────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "otp", email: clientEmail.trim().toLowerCase() }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "OTP bhejna fail hua. Dobara try karein.");
      setLoading(false);
      return;
    }

    setInfo("OTP aapke email par bheja gaya hai. Jald hi aa jayega (spam folder bhi check karein).");
    setOtpStep("verify");
    setLoading(false);
  };

  // ── Client OTP: verify → onboard → redirect ───────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "verify-otp", email: clientEmail.trim().toLowerCase(), token: otp.trim() }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "OTP verify fail hua. Dobara try karein.");
      setLoading(false);
      return;
    }

    // Profile (role=client, client_id) service-role API se banao
    const onboardRes = await fetch("/api/client/onboard", { method: "POST" });
    const onboardData = await onboardRes.json();

    if (!onboardRes.ok) {
      setError(onboardData.error || "Account setup nahi hua.");
      await supabase.auth.signOut();
      setLoading(false);
      setOtpStep("request");
      return;
    }

    // Intentional full reload: onboarding ke baad RootClient session state fresh initialize hota hai
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/my-account";
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setError("");
    setInfo("");
    setOtpStep("request");
    setOtp("");
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">

        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-900/50">
            <ShieldCheck size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            V-TECH <span className="text-blue-400 font-light">PRO</span>
          </h1>
          <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.2em] mt-1">
            Management System
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-7 shadow-2xl">
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <TabButton t="staff"  icon={<UserRound size={13} />} label="Staff" active={tab === "staff"} onSelect={switchTab} />
            <TabButton t="client" icon={<Smartphone size={13} />} label="Client" active={tab === "client"} onSelect={switchTab} />
          </div>

          <div className="mb-5">
            <h2 className="text-lg font-black text-white">
              {tab === "staff" ? "Staff Login" : "Client Login"}
            </h2>
            <p className="text-slate-600 text-sm mt-0.5">
              {tab === "staff"
                ? "Login to manage your shop"
                : "Email OTP se apne repairs dekhein"}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-3 rounded-xl mb-5">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Info message */}
          {info && (
            <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold px-4 py-3 rounded-xl mb-5">
              <KeyRound size={15} className="flex-shrink-0 mt-0.5" />
              {info}
            </div>
          )}

          {tab === "staff" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="staff@vtech.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-[#111520] border border-[#21293d] rounded-xl text-sm text-white font-medium placeholder:text-slate-700 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-11 py-3 bg-[#111520] border border-[#21293d] rounded-xl text-sm text-white font-medium placeholder:text-slate-700 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setRememberMe(v => !v)}
                  className={`w-9 h-5 rounded-full transition-all duration-200 flex-shrink-0 relative ${
                    rememberMe ? "bg-blue-600" : "bg-[#21293d]"
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                    rememberMe ? "left-[18px]" : "left-0.5"
                  }`} />
                </button>
                <label
                  onClick={() => setRememberMe(v => !v)}
                  className="text-xs font-bold text-slate-500 cursor-pointer select-none hover:text-slate-400 transition-colors"
                >
                  Remember My Email
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/30 mt-2"
              >
                {loading
                  ? <><Loader2 size={17} className="animate-spin" /> Logging in...</>
                  : <><LogIn size={17} /> Login to Dashboard</>}
              </button>
            </form>
          )}

          {tab === "client" && (
            <div className="space-y-4">
              {otpStep === "request" ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                      Apna Register Email
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                      <input
                        type="email"
                        placeholder="aapka@email.com"
                        value={clientEmail}
                        onChange={e => setClientEmail(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-3 bg-[#111520] border border-[#21293d] rounded-xl text-sm text-white font-medium placeholder:text-slate-700 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-600 mt-2">
                      OTP usi email par jayega jo dukaan me register hai. Pehle shop se apna email confirm karwayein.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/30"
                  >
                    {loading
                      ? <><Loader2 size={17} className="animate-spin" /> Sending OTP...</>
                      : <><KeyRound size={17} /> Send OTP</>}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setOtpStep("request")}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <ArrowLeft size={13} /> {clientEmail} — change
                  </button>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                      OTP Code
                    </label>
                    <div className="relative">
                      <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="OTP code"
                        value={otp}
                        onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                        required
                        className="w-full pl-10 pr-4 py-3 bg-[#111520] border border-[#21293d] rounded-xl text-sm text-white font-medium placeholder:text-slate-700 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/30"
                  >
                    {loading
                      ? <><Loader2 size={17} className="animate-spin" /> Verifying...</>
                      : <><LogIn size={17} /> Verify & Login</>}
                  </button>

                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="w-full py-2.5 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1a2234] hover:text-white transition-all disabled:opacity-50"
                  >
                    Resend OTP
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Public Access Link */}
        <div className="mt-6">
          <a
            href="/job-status"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#111520] border border-[#21293d] rounded-xl text-slate-400 text-xs font-bold hover:bg-[#1a2234] hover:text-white transition-all"
          >
            <Globe size={14} />
            Track Job Status (No Login Required)
          </a>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-700 text-[11px] mt-5 font-medium">
          V-Technologies · Jabalpur · 9179105875
        </p>
      </div>
    </div>
  );
}
