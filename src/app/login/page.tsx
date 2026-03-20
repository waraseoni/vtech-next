"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { LogIn, Mail, Lock, Loader2, ShieldCheck, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const router = useRouter();

  // ── Load saved credentials ─────────────────────────────────────────────
  useEffect(() => {
    const savedEmail    = localStorage.getItem("vtech_email");
    const savedPassword = localStorage.getItem("vtech_password");
    const savedRemember = localStorage.getItem("vtech_remember") === "true";
    if (savedRemember && savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);

  // ── Login handler ──────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });

    if (authErr) {
      setError(
        authErr.message.includes("Invalid login")
          ? "Email ya password galat hai!"
          : authErr.message
      );
      setLoading(false);
      return;
    }

    // Remember Me
    if (rememberMe) {
      localStorage.setItem("vtech_email",    email);
      localStorage.setItem("vtech_password", password);
      localStorage.setItem("vtech_remember", "true");
    } else {
      localStorage.removeItem("vtech_email");
      localStorage.removeItem("vtech_password");
      localStorage.removeItem("vtech_remember");
    }

    // ── CRITICAL: Fetch role BEFORE navigating ─────────────────────────
    // Layout ka useEffect sirf mount pe chalta hai.
    // Agar seedha push() karein toh layout stale state mein ho sakta hai.
    // router.refresh() server ko signal karta hai ki session update hua hai
    // aur layout dobara profile fetch karega.
    if (data.user) {
      // Ensure profile exists in DB — insert if missing
      const { data: pd } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!pd) {
        // New user — create profile with staff role by default
        // Admin can change role later from /users page
        await supabase.from("profiles").insert({
          id:        data.user.id,
          full_name: data.user.user_metadata?.full_name || email.split("@")[0],
          role:      "staff",
        });
      }
    }

    // Full reload → fresh auth state → correct sidebar
    window.location.href = "/";
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
          <div className="mb-6">
            <h2 className="text-lg font-black text-white">Welcome Back</h2>
            <p className="text-slate-600 text-sm mt-0.5">Login to manage your shop</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-3 rounded-xl mb-5">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email */}
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

            {/* Password */}
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

            {/* Remember Me */}
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
                Remember My Credentials
              </label>
            </div>

            {/* Submit */}
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
        </div>

        {/* Footer */}
        <p className="text-center text-slate-700 text-[11px] mt-5 font-medium">
          V-Technologies · Jabalpur · 9179105875
        </p>
      </div>
    </div>
  );
}