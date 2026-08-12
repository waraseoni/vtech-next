"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UserPlus, Mail, Lock, User, Shield, ShieldCheck, Code2,
  Loader2, ArrowLeft, Eye, EyeOff, CheckCircle, AlertCircle,
} from "lucide-react";

const inputCls = "w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all";
const labelCls = "block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5";

export default function NewUserPage() {
  const router = useRouter();
  const [fullName,  setFullName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [role,      setRole]      = useState("staff");
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [checking,  setChecking]  = useState(true);
  const [myId,      setMyId]      = useState("");
  const [toast,     setToast]     = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Admin check ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setMyId(user.id);
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (p?.role !== "admin") { router.push("/"); return; }
      setChecking(false);
    })();
  }, [router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setToast({ type: "error", msg: "Password kam se kam 6 characters ka hona chahiye!" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, role, requesterId: myId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setToast({ type: "success", msg: "User successfully create ho gaya! ✅" });
      setTimeout(() => router.push("/users"), 1200);
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Create failed!" });
      setLoading(false);
    }
  };

  if (checking) return (
    <div className="min-h-[60vh] flex items-center justify-center bg-[#0d1117]">
      <Loader2 className="animate-spin text-blue-500" size={36}/>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-12">

      {/* Toast */}
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

      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">

        {/* Header */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center">
              <UserPlus size={18} className="text-white"/>
            </div>
            <div>
              <h1 className="text-base font-black text-white">Add New User</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Admin Panel</p>
            </div>
          </div>
          <Link href="/users"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 rounded-xl text-xs font-bold no-underline transition-all">
            <ArrowLeft size={13}/> Back
          </Link>
        </div>

        {/* Form card */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
          <form onSubmit={handleCreate} className="space-y-4">

            {/* Full Name */}
            <div>
              <label className={labelCls}>Full Name *</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Vikram Jain" required className={`${inputCls} pl-9`}/>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className={labelCls}>Email Address *</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="staff@vtech.com" required className={`${inputCls} pl-9`}/>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className={labelCls}>Password *</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
                <input type={showPass ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters" required className={`${inputCls} pl-9 pr-10`}/>
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                  {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
              {password && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className={`h-1 flex-1 rounded-full ${password.length >= 8 ? "bg-emerald-500" : password.length >= 6 ? "bg-amber-500" : "bg-red-500"}`}/>
                  <span className={`text-[10px] font-bold ${password.length >= 8 ? "text-emerald-400" : password.length >= 6 ? "text-amber-400" : "text-red-400"}`}>
                    {password.length >= 8 ? "Strong" : password.length >= 6 ? "OK" : "Too short"}
                  </span>
                </div>
              )}
            </div>

            {/* Role */}
            <div>
              <label className={labelCls}>Role *</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: "staff", icon: Shield, label: "Staff", sub: "Limited Access", color: "blue" },
                  { val: "admin", icon: ShieldCheck, label: "Admin", sub: "Full Access", color: "amber" },
                  { val: "developer", icon: Code2, label: "Developer", sub: "Dev + Licensing", color: "indigo" },
                ].map(({ val, icon: Icon, label, sub, color }) => (
                  <button key={val} type="button" onClick={() => setRole(val)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${
                      role === val
                        ? color === "blue"
                          ? "bg-blue-500/10 border-blue-500/50 text-blue-400"
                          : color === "amber"
                            ? "bg-amber-500/10 border-amber-500/50 text-amber-400"
                            : "bg-indigo-500/10 border-indigo-500/50 text-indigo-400"
                        : "bg-[#0d1117] border-[#21293d] text-slate-500 hover:border-slate-500"
                    }`}>
                    <Icon size={18} className="flex-shrink-0"/>
                    <div>
                      <div className="text-sm font-black">{label}</div>
                      <div className="text-[10px] font-medium opacity-70">{sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/30 mt-2">
              {loading
                ? <><Loader2 size={16} className="animate-spin"/>Creating User...</>
                : <><UserPlus size={16}/> Create User</>}
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3 text-xs text-slate-600 leading-relaxed">
          <span className="text-blue-400 font-bold">Note:</span> Naya user directly active ho jaayega — email verification ki zaroorat nahi। User apna password baad mein change kar sakta hai।
        </div>

      </div>
    </div>
  );
}