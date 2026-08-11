"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  User, Mail, Shield, ShieldCheck, Save, KeyRound,
  Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Wrench,
  Camera, Trash2,
} from "lucide-react";
import { compressImage } from "@/lib/imageCompression";

const inputCls = "w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-slate-700";
const labelCls = "block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5";

export default function ProfilePage() {
  const router = useRouter();

  const [loading,     setLoading]     = useState(true);
  const [savingInfo,  setSavingInfo]  = useState(false);
  const [savingPass,  setSavingPass]  = useState(false);
  const [toast,       setToast]       = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Profile data
  const [userId,      setUserId]      = useState("");
  const [fullName,    setFullName]    = useState("");
  const [email,       setEmail]       = useState("");
  const [role,        setRole]        = useState("");
  const [mechanicName,setMechanicName]= useState("");
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null);

  // Avatar photo
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoErr,    setPhotoErr]    = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoSaving(true);
    setPhotoErr("");
    try {
      const compressed = await compressImage(file);
      if (compressed.bytes > 100 * 1024) {
        setPhotoErr("Image abhi bhi 100KB se bada hai — kam resolution ki photo try karein");
        setPhotoSaving(false);
        return;
      }
      const fd = new FormData();
      fd.append("file", compressed.file);
      fd.append("userId", userId);
      const res = await fetch("/api/user-avatar", { method: "POST", body: fd });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.msg || "Upload failed");
      setAvatarUrl(json.url);
      setPhotoSaving(false);
    } catch (err: unknown) {
      setPhotoErr(err instanceof Error ? err.message : "Upload failed");
      setPhotoSaving(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!confirm("Kya aap apni avatar photo delete karna chahte hain?")) return;
    setPhotoSaving(true);
    setPhotoErr("");
    try {
      const fd = new FormData();
      fd.append("userId", userId);
      fd.append("delete", "1");
      const res = await fetch("/api/user-avatar", { method: "POST", body: fd });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.msg || "Delete failed");
      setAvatarUrl(null);
      setPhotoSaving(false);
    } catch (err: unknown) {
      setPhotoErr(err instanceof Error ? err.message : "Delete failed");
      setPhotoSaving(false);
    }
  };

  // Password change
  const [currentPass, setCurrentPass] = useState("");
  const [newPass,     setNewPass]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      setUserId(user.id);
      setEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role, mechanic_id, email, avatar_url")
        .eq("id", user.id)
        .single();

      setFullName(profile?.full_name || user.email?.split("@")[0] || "");
      setRole(profile?.role || "staff");
      setAvatarUrl(profile?.avatar_url || null);
      if (profile?.email) setEmail(profile.email);

      // Mechanic name fetch karo agar linked hai
      if (profile?.mechanic_id) {
        const { data: mech } = await supabase
          .from("mechanic_list")
          .select("firstname, middlename, lastname")
          .eq("id", profile.mechanic_id)
          .single();
        if (mech) {
          setMechanicName(
            [mech.firstname, mech.middlename, mech.lastname].filter(Boolean).join(" ")
          );
        }
      }

      setLoading(false);
    })();
  }, [router]);

  // ── Save Profile Info ─────────────────────────────────────────────────────
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { setToast({ type: "error", msg: "Naam zaroori hai!" }); return; }
    setSavingInfo(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", userId);
      if (error) throw error;
      setToast({ type: "success", msg: "Profile update ho gayi!" });
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Update failed!" });
    } finally {
      setSavingInfo(false);
    }
  };

  // ── Change Password ───────────────────────────────────────────────────────
  const handleChangePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPass) { setToast({ type: "error", msg: "Pehle current password enter karo!" }); return; }
    if (newPass.length < 6) { setToast({ type: "error", msg: "Naya password kam se kam 6 characters ka hona chahiye!" }); return; }
    if (newPass !== confirmPass) { setToast({ type: "error", msg: "Dono passwords match nahi karte!" }); return; }

    setSavingPass(true);
    try {
      // Step 1: Verify current password by re-signing in
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email, password: currentPass,
      });
      if (signInErr) {
        setToast({ type: "error", msg: "Current password galat hai!" });
        setSavingPass(false);
        return;
      }

      // Step 2: Update password
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPass });
      if (updateErr) throw updateErr;

      setToast({ type: "success", msg: "Password change ho gaya!" });
      setCurrentPass(""); setNewPass(""); setConfirmPass("");
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Password change failed!" });
    } finally {
      setSavingPass(false);
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 bg-[#0d1117]">
      <Loader2 className="animate-spin text-blue-500" size={36}/>
      <p className="text-slate-600 text-xs font-black uppercase tracking-widest">Loading Profile...</p>
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

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">

        {/* Profile header card */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-6 flex items-center gap-5">
          {/* Avatar circle */}
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={fullName || "User"}
                width={64} height={64} unoptimized
                className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 shadow-lg border border-white/10"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0 shadow-lg ${
                role === "admin"
                  ? "bg-gradient-to-br from-amber-500 to-amber-700 shadow-amber-900/40"
                  : "bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-900/40"
              }`}>
                {(fullName || "U").slice(0, 2).toUpperCase()}
              </div>
            )}
            <button onClick={() => photoRef.current?.click()} disabled={photoSaving}
              className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg border-2 border-[#161b27] transition-colors disabled:opacity-60"
              title="Photo upload">
              {photoSaving ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-white truncate">{fullName || "—"}</h1>
            <p className="text-slate-500 text-sm mt-0.5 truncate">{email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {role === "admin" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  <ShieldCheck size={10}/> Administrator
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Shield size={10}/> Staff
                </span>
              )}
              {mechanicName && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  <Wrench size={10}/> {mechanicName}
                </span>
              )}
              {avatarUrl && (
                <button onClick={handlePhotoDelete} disabled={photoSaving}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-60"
                  title="Delete photo">
                  <Trash2 size={10}/> Photo Delete
                </button>
              )}
            </div>
            {photoErr && <p className="text-[11px] text-red-400 font-semibold mt-1.5">{photoErr}</p>}
          </div>
        </div>

        {/* ── Profile Info Form ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-blue-600/20 to-transparent border-b border-[#21293d]">
            <User size={14} className="text-blue-400"/>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Profile Information</h3>
          </div>
          <form onSubmit={handleSaveInfo} className="p-5 space-y-4">
            <div>
              <label className={labelCls}>Full Name *</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Apna naam enter karo" required
                  className={`${inputCls} pl-9`}/>
              </div>
            </div>
            <div>
              <label className={labelCls}>Email Address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
                <input type="email" value={email} disabled
                  className={`${inputCls} pl-9 opacity-50 cursor-not-allowed`}/>
              </div>
              <p className="text-[10px] text-slate-700 mt-1">Email change nahi ho sakta</p>
            </div>
            <button type="submit" disabled={savingInfo}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/30">
              {savingInfo
                ? <><Loader2 size={15} className="animate-spin"/>Saving...</>
                : <><Save size={15}/> Save Profile</>}
            </button>
          </form>
        </div>

        {/* ── Change Password Form ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-amber-600/20 to-transparent border-b border-[#21293d]">
            <KeyRound size={14} className="text-amber-400"/>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Change Password</h3>
          </div>
          <form onSubmit={handleChangePass} className="p-5 space-y-4">

            {/* Current Password */}
            <div>
              <label className={labelCls}>Current Password *</label>
              <div className="relative">
                <input type={showCurrent ? "text" : "password"}
                  value={currentPass} onChange={e => setCurrentPass(e.target.value)}
                  placeholder="Apna purana password" className={`${inputCls} pr-10`}/>
                <button type="button" onClick={() => setShowCurrent(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                  {showCurrent ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className={labelCls}>New Password *</label>
              <div className="relative">
                <input type={showNew ? "text" : "password"}
                  value={newPass} onChange={e => setNewPass(e.target.value)}
                  placeholder="Min 6 characters" className={`${inputCls} pr-10`}/>
                <button type="button" onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                  {showNew ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
              {newPass && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className={`h-1 flex-1 rounded-full transition-all ${
                    newPass.length >= 8 ? "bg-emerald-500" : newPass.length >= 6 ? "bg-amber-500" : "bg-red-500"
                  }`}/>
                  <span className={`text-[10px] font-bold ${
                    newPass.length >= 8 ? "text-emerald-400" : newPass.length >= 6 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {newPass.length >= 8 ? "Strong" : newPass.length >= 6 ? "OK" : "Too short"}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className={labelCls}>Confirm New Password *</label>
              <input type={showNew ? "text" : "password"}
                value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                placeholder="Dobara enter karo"
                className={`${inputCls} ${
                  confirmPass && confirmPass !== newPass
                    ? "border-red-500/50"
                    : confirmPass && confirmPass === newPass
                    ? "border-emerald-500/50"
                    : ""
                }`}/>
              {confirmPass && (
                <p className={`text-[10px] font-bold mt-1 ${confirmPass === newPass ? "text-emerald-400" : "text-red-400"}`}>
                  {confirmPass === newPass ? "✓ Passwords match" : "✗ Match nahi karte"}
                </p>
              )}
            </div>

            <button type="submit" disabled={savingPass}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-900/30">
              {savingPass
                ? <><Loader2 size={15} className="animate-spin"/>Changing...</>
                : <><KeyRound size={15}/> Change Password</>}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}