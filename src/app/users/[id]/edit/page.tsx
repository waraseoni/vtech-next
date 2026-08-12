"use client";
import { useState, useEffect, use, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Save, ArrowLeft, User, Mail, Shield, ShieldCheck, Code2,
  Loader2, CheckCircle, AlertCircle, Wrench, Eye, EyeOff, KeyRound,
  Camera, Trash2,
} from "lucide-react";
import { compressImage } from "@/lib/imageCompression";

const inputCls = "w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all";
const labelCls = "block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5";

interface Mechanic { id: number; name: string; }

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const userId = resolvedParams.id;
  const router = useRouter();

  const [myId,       setMyId]       = useState("");
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [mechanics,  setMechanics]  = useState<Mechanic[]>([]);
  const [toast,      setToast]      = useState<{ type: "success"|"error"; msg: string } | null>(null);

  // Form fields — matching PHP manage_user.php
  const [fullName,    setFullName]    = useState("");
  const [email,       setEmail]       = useState("");
  const [role,        setRole]        = useState("staff");
  const [mechanicId,  setMechanicId]  = useState("");
  const [newPassword, setNewPassword] = useState("");  // blank = no change
  const [showPass,    setShowPass]    = useState(false);

  // Avatar photo
  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null);
  const [photoSaving,  setPhotoSaving]  = useState(false);
  const [photoErr,     setPhotoErr]     = useState("");
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
    if (!confirm("Kya aap user ki avatar photo delete karna chahte hain?")) return;
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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Fetch user data + master ───────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Admin check
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setMyId(user.id);

      const { data: myProfile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      if (myProfile?.role !== "admin") { router.push("/"); return; }

      // Fetch the user being edited
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, mechanic_id, email, avatar_url")
        .eq("id", userId).single();

      if (error || !profile) {
        setToast({ type: "error", msg: "User nahi mila!" });
        router.push("/users");
        return;
      }

      setFullName(profile.full_name   ?? "");
      setEmail(profile.email          ?? "");
      setRole(profile.role            ?? "staff");
      setMechanicId(profile.mechanic_id ? String(profile.mechanic_id) : "");
      setAvatarUrl(profile.avatar_url ?? null);

      // Fetch mechanics list (PHP: mechanic_list WHERE status=1)
      const { data: mechs } = await supabase
        .from("mechanic_list")
        .select("id, firstname, middlename, lastname")
        .eq("status", 1)
        .order("firstname");

      setMechanics((mechs || []).map(m => ({
        id: m.id,
        name: [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" "),
      })));

      setLoading(false);
    })();
  }, [userId, router]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { setToast({ type: "error", msg: "Full name zaroori hai!" }); return; }
    if (newPassword && newPassword.length < 6) {
      setToast({ type: "error", msg: "Password kam se kam 6 characters ka hona chahiye!" });
      return;
    }

    setSaving(true);
    try {
      // 1. Update profiles table (role ke alawa — role service-role API se hota hai)
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          full_name:   fullName.trim(),
          email:       email.trim() || null,
          mechanic_id: mechanicId ? parseInt(mechanicId) : null,
        })
        .eq("id", userId);

      if (profileErr) throw new Error("Profile update failed: " + profileErr.message);

      // 1b. Role update — service-role API (DB trigger browser ko role change se rokta hai)
      const roleRes = await fetch("/api/admin/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!roleRes.ok) {
        const errData = await roleRes.json().catch(() => ({}));
        throw new Error("Role update failed: " + (errData.error || roleRes.status));
      }

      // 2. Password change karna ho to — server API use karo (service_role needed)
      if (newPassword) {
        const res = await fetch("/api/admin/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, newPassword, requesterId: myId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }

      setToast({ type: "success", msg: "User update ho gaya! ✅" });
      setTimeout(() => router.push("/users"), 1000);
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Save failed!" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 bg-[#0d1117]">
      <Loader2 className="animate-spin text-blue-500" size={36}/>
      <p className="text-slate-600 text-xs font-black uppercase tracking-widest">Loading...</p>
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
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={fullName || "User"}
                width={40} height={40} unoptimized
                className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-white/10"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm ${
                role === "admin"
                  ? "bg-gradient-to-br from-amber-500 to-amber-700"
                  : "bg-gradient-to-br from-blue-500 to-blue-700"
              }`}>
                {(fullName || "U").slice(0, 2).toUpperCase()}
              </div>
            )}
            <button onClick={() => photoRef.current?.click()} disabled={photoSaving}
              className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg border-2 border-[#161b27] transition-colors disabled:opacity-60"
              title="Photo upload">
              {photoSaving ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            </button>
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
          <div>
            <h1 className="text-base font-black text-white">Edit User</h1>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider truncate max-w-[160px]">
                {fullName || "Loading..."}
              </p>
              {avatarUrl && (
                <button onClick={handlePhotoDelete} disabled={photoSaving}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-60"
                  title="Delete photo">
                  <Trash2 size={10}/>
                </button>
              )}
            </div>
            {photoErr && <p className="text-[10px] text-red-400 font-semibold mt-0.5">{photoErr}</p>}
          </div>
          </div>
          <Link href="/users"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 rounded-xl text-xs font-bold no-underline transition-all">
            <ArrowLeft size={13}/> Back
          </Link>
        </div>

        {/* Form */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
          <form onSubmit={handleSave} className="space-y-4">

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
              <label className={labelCls}>Email Address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="staff@vtech.com" className={`${inputCls} pl-9`}/>
              </div>
            </div>

            {/* Role */}
            <div>
              <label className={labelCls}>User Type *</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: "staff", icon: Shield,      label: "Staff",  sub: "Limited Access", color: "blue"  },
                  { val: "admin", icon: ShieldCheck,  label: "Admin",  sub: "Full Access",    color: "amber" },
                  { val: "developer", icon: Code2,    label: "Developer", sub: "Dev + Licensing", color: "indigo" },
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

            {/* Mechanic Link (PHP: staff type ke liye) */}
            {role === "staff" && (
              <div>
                <label className={labelCls}>
                  <Wrench size={10} className="inline mr-1"/> Link to Mechanic Profile
                </label>
                <select value={mechanicId} onChange={e => setMechanicId(e.target.value)}
                  className={inputCls}>
                  <option value="">— Select Mechanic —</option>
                  {mechanics.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-700 mt-1">
                  Attendance lagane ke liye staff ko uski profile se link karna zaroori hai।
                </p>
              </div>
            )}

            {/* New Password (blank = no change — PHP ki tarah) */}
            <div>
              <label className={labelCls}>
                <KeyRound size={10} className="inline mr-1"/> New Password
              </label>
              <div className="relative">
                <input type={showPass ? "text" : "password"}
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Blank chhodo agar change nahi karna"
                  className={`${inputCls} pr-10`}/>
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                  {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
              {newPassword && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className={`h-1 flex-1 rounded-full transition-all ${
                    newPassword.length >= 8 ? "bg-emerald-500" : newPassword.length >= 6 ? "bg-amber-500" : "bg-red-500"
                  }`}/>
                  <span className={`text-[10px] font-bold ${
                    newPassword.length >= 8 ? "text-emerald-400" : newPassword.length >= 6 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {newPassword.length >= 8 ? "Strong" : newPassword.length >= 6 ? "OK" : "Too short"}
                  </span>
                </div>
              )}
              <p className="text-[10px] text-slate-700 mt-1 italic">
                PHP ki tarah: blank chhodo toh password nahi badlega।
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Link href="/users"
                className="flex-1 py-3 rounded-xl border border-[#21293d] text-slate-400 hover:bg-white/5 font-bold text-sm text-center no-underline transition-all">
                Cancel
              </Link>
              <button type="submit" disabled={saving}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/30">
                {saving
                  ? <><Loader2 size={15} className="animate-spin"/>Saving...</>
                  : <><Save size={15}/> Update Account</>}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}