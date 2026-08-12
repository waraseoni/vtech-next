"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Users, UserPlus, Shield, ShieldCheck, KeyRound, Code2,
  Loader2, X, Eye, EyeOff, CheckCircle, AlertCircle,
  RefreshCw, Wrench, Edit3, Trash2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Profile {
  id: string;
  full_name: string | null;
  role: string | null;
  mechanic_id?: number | null;
  mechanic_name?: string;
  email?: string;
  avatar_url?: string | null;
  updated_at?: string;           // actual column name in profiles table
}
type Toast = { type: "success" | "error"; msg: string };

const inputCls = "w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all";
const labelCls = "block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5";

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(d));
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const router = useRouter();
  const [users,    setUsers]    = useState<Profile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [myId,     setMyId]     = useState("");
  const [toast,    setToast]    = useState<Toast | null>(null);

  // Reset password modal
  const [resetUser,   setResetUser]   = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [resetting,   setResetting]   = useState(false);

  // Delete confirm
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);
  const [deleting,   setDeleting]   = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Fetch users ────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setMyId(user.id);

      const { data: myProfile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();

      if (myProfile?.role !== "admin") { router.push("/"); return; }

      // Fetch all profiles — PHP ki tarah: sab users current ko chhodke
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, mechanic_id, email, avatar_url, updated_at")
        .neq("id", user.id)                          // PHP: where id != current_user
        .order("full_name", { ascending: true });

      if (error) {
        console.error("profiles fetch error:", error.message);
        // Agar columns nahi hain to basic fetch try karo
        const { data: basic } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .neq("id", user.id)
          .order("full_name", { ascending: true });
        setUsers(basic || []);
        setLoading(false);
        return;
      }

      // Mechanic names fetch karo agar mechanic_id linked hai
      const mechIds = [...new Set(
        (profiles || []).map(p => p.mechanic_id).filter(Boolean)
      )];
      const mechMap = new Map<number, string>();
      if (mechIds.length > 0) {
        const { data: mechs } = await supabase
          .from("mechanic_list")
          .select("id, firstname, middlename, lastname")
          .in("id", mechIds);
        mechs?.forEach(m => {
          mechMap.set(m.id, [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" "));
        });
      }

      setUsers((profiles || []).map(p => ({
        ...p,
        mechanic_name: p.mechanic_id ? mechMap.get(p.mechanic_id) || "" : "",
      })));

    } catch (err) {
      console.error("fetchUsers:", err);
      setToast({ type: "error", msg: "Users load karne mein galti!" });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Reset Password ─────────────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!resetUser || !myId) return;
    if (!newPassword) { setToast({ type: "error", msg: "Naya password enter karo!" }); return; }
    if (newPassword.length < 6) { setToast({ type: "error", msg: "Password kam se kam 6 characters ka hona chahiye!" }); return; }
    if (newPassword !== confirmPass) { setToast({ type: "error", msg: "Dono passwords match nahi karte!" }); return; }

    setResetting(true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetUser.id, newPassword, requesterId: myId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setToast({ type: "success", msg: `${resetUser.full_name || "User"} ka password reset ho gaya!` });
      setResetUser(null);
      setNewPassword(""); setConfirmPass("");
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Reset failed!" });
    } finally { setResetting(false); }
  };

  // ── Delete user ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteUser || !myId) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: deleteUser.id, requesterId: myId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setToast({ type: "success", msg: `${deleteUser.full_name || "User"} delete ho gaya!` });
      setDeleteUser(null);
      fetchUsers();
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Delete failed!" });
    } finally { setDeleting(false); }
  };

  // ── Role badge ────────────────────────────────────────────────────────────
  const roleBadge = (role: string | null) => {
    if (role === "admin") return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/25">
        <ShieldCheck size={9}/> Admin
      </span>
    );
    if (role === "staff") return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Shield size={9}/> Staff
      </span>
    );
    if (role === "developer") return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
        <Code2 size={9}/> Developer
      </span>
    );
    return <span className="text-slate-600 text-xs">—</span>;
  };

  // ── Avatar initials ───────────────────────────────────────────────────────
  const avatar = (name: string | null, role: string | null, avatarUrl?: string | null) => (
    avatarUrl
      ? <Image src={avatarUrl} alt={name || "User"}
          width={36} height={36} unoptimized
          className="w-9 h-9 rounded-xl object-cover flex-shrink-0 border border-[#21293d]"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}/>
      : <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0 ${
          role === "admin" ? "bg-gradient-to-br from-amber-500 to-amber-700" : "bg-gradient-to-br from-blue-500 to-blue-700"
        }`}>
          {(name || "U").slice(0, 2).toUpperCase()}
        </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 bg-[#0d1117]">
      <Loader2 className="animate-spin text-blue-500" size={36}/>
      <p className="text-slate-600 text-xs font-black uppercase tracking-widest">Loading Users...</p>
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

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-4">

        {/* Header */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl flex items-center justify-center">
              <Users size={18} className="text-white"/>
            </div>
            <div>
              <h1 className="text-lg font-black text-white">List of Users</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                Admin Panel · {users.length} users
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchUsers}
              className="w-9 h-9 flex items-center justify-center bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 hover:text-white rounded-xl transition-all">
              <RefreshCw size={14}/>
            </button>
            <Link href="/users/new"
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black no-underline transition-all shadow-lg shadow-blue-900/30">
              <UserPlus size={14}/> Create New
            </Link>
          </div>
        </div>

        {/* Users table */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">

          {users.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Users size={36} className="mx-auto text-slate-700"/>
              <p className="text-slate-600 text-sm font-bold">Koi user nahi mila</p>
              <p className="text-slate-700 text-xs">
                &quot;Create New&quot; se pehla user banao, ya profiles table check karo
              </p>
              <Link href="/users/new"
                className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black no-underline transition-all">
                <UserPlus size={13}/> Create New User
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#111520] border-b border-[#21293d]">
                      {["#", "Date Updated", "Avatar", "Name", "Email", "Type", "Mechanic Link", "Action"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2030]">
                    {users.map((u, i) => (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-slate-600 text-xs">{i + 1}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {u.updated_at ? fmtDate(u.updated_at) : "—"}
                        </td>
                        <td className="px-4 py-3">{avatar(u.full_name, u.role, u.avatar_url)}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-200 text-sm">{u.full_name || "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{u.email || "—"}</td>
                        <td className="px-4 py-3">{roleBadge(u.role)}</td>
                        <td className="px-4 py-3">
                          {u.mechanic_name ? (
                            <span className="inline-flex items-center gap-1 text-xs text-teal-400">
                              <Wrench size={10}/> {u.mechanic_name}
                            </span>
                          ) : <span className="text-slate-700 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Link href={`/users/${u.id}/edit`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#1e2637] border border-[#2a3550] hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-400 text-slate-400 rounded-lg text-xs font-bold no-underline transition-all">
                              <Edit3 size={11}/> Edit
                            </Link>
                            <button
                              onClick={() => { setResetUser(u); setNewPassword(""); setConfirmPass(""); setShowPass(false); }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#1e2637] border border-[#2a3550] hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400 text-slate-400 rounded-lg text-xs font-bold transition-all">
                              <KeyRound size={11}/> Reset
                            </button>
                            <button onClick={() => setDeleteUser(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#1e2637] border border-[#2a3550] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 text-slate-400 rounded-lg text-xs font-bold transition-all">
                              <Trash2 size={11}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-[#1a2030]">
                {users.map((u, i) => (
                  <div key={u.id} className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      {avatar(u.full_name, u.role, u.avatar_url)}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-200 text-sm truncate">{u.full_name || "—"}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {roleBadge(u.role)}
                          {u.mechanic_name && (
                            <span className="text-[10px] text-teal-400 flex items-center gap-0.5">
                              <Wrench size={9}/> {u.mechanic_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-slate-700 text-xs">#{i+1}</span>
                    </div>
                    {u.email && <p className="text-slate-600 text-xs">{u.email}</p>}
                    <div className="flex gap-2">
                      <Link href={`/users/${u.id}/edit`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#1e2637] border border-[#2a3550] text-slate-300 rounded-xl text-xs font-bold no-underline transition-all hover:bg-[#252f45]">
                        <Edit3 size={12}/> Edit
                      </Link>
                      <button onClick={() => { setResetUser(u); setNewPassword(""); setConfirmPass(""); setShowPass(false); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#1e2637] border border-[#2a3550] text-amber-400 rounded-xl text-xs font-bold transition-all hover:bg-amber-500/10">
                        <KeyRound size={12}/> Reset
                      </button>
                      <button onClick={() => setDeleteUser(u)}
                        className="px-3 py-2 bg-[#1e2637] border border-[#2a3550] text-red-400 rounded-xl text-xs transition-all hover:bg-red-500/10">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Troubleshoot box — agar profiles empty hai */}
        <div className="bg-[#111520] border border-[#21293d] rounded-xl px-4 py-3">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-2">
            ⚠ Agar users nahi dikh rahe
          </p>
          <p className="text-xs text-slate-700 leading-relaxed">
            Supabase → Table Editor → <code className="text-slate-500">profiles</code> table mein check karo ki rows hain ya nahi।
            Agar nahi hain to pehle <strong className="text-slate-500">Create New</strong> se user banao।
            Ya <code className="text-slate-500">SUPABASE_SERVICE_ROLE_KEY</code> .env.local mein check karo।
          </p>
        </div>

      </div>

      {/* ═══ RESET PASSWORD MODAL ═══════════════════════════════════════════ */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setResetUser(null); }}>
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#21293d]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center">
                  <KeyRound size={15} className="text-amber-400"/>
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Reset Password</h3>
                  <p className="text-[10px] text-slate-500">{resetUser.full_name || "User"}</p>
                </div>
              </div>
              <button onClick={() => setResetUser(null)}
                className="p-1.5 hover:bg-white/10 text-slate-500 hover:text-white rounded-lg transition-all">
                <X size={16}/>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-[#0d1117] rounded-xl px-4 py-3 flex items-center gap-3 border border-[#21293d]">
                {avatar(resetUser.full_name, resetUser.role, resetUser.avatar_url)}
                <div>
                  <div className="text-sm font-bold text-white">{resetUser.full_name || "—"}</div>
                  {roleBadge(resetUser.role)}
                </div>
              </div>
              <div>
                <label className={labelCls}>Naya Password</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters" className={`${inputCls} pr-10`} autoFocus/>
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                    {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
                  </button>
                </div>
                {newPassword && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className={`h-1 flex-1 rounded-full ${newPassword.length >= 8 ? "bg-emerald-500" : newPassword.length >= 6 ? "bg-amber-500" : "bg-red-500"}`}/>
                    <span className={`text-[10px] font-bold ${newPassword.length >= 8 ? "text-emerald-400" : newPassword.length >= 6 ? "text-amber-400" : "text-red-400"}`}>
                      {newPassword.length >= 8 ? "Strong" : newPassword.length >= 6 ? "OK" : "Too short"}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls}>Confirm Password</label>
                <input type={showPass ? "text" : "password"} value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                  placeholder="Dobara enter karein"
                  className={`${inputCls} ${confirmPass && confirmPass !== newPassword ? "border-red-500/50" : confirmPass && confirmPass === newPassword ? "border-emerald-500/50" : ""}`}/>
                {confirmPass && (
                  <p className={`text-[10px] font-bold mt-1 ${confirmPass === newPassword ? "text-emerald-400" : "text-red-400"}`}>
                    {confirmPass === newPassword ? "✓ Match" : "✗ Match nahi"}
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setResetUser(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#21293d] text-slate-400 hover:bg-white/5 font-bold text-sm transition-all">
                  Cancel
                </button>
                <button onClick={handleResetPassword} disabled={resetting}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                  {resetting ? <><Loader2 size={14} className="animate-spin"/>Resetting...</> : <><KeyRound size={14}/> Reset</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE CONFIRM MODAL ════════════════════════════════════════════ */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setDeleteUser(null); }}>
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-red-500/15 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 size={20} className="text-red-400"/>
              </div>
              <h3 className="text-base font-black text-white">User Delete Karein?</h3>
              <p className="text-sm text-slate-500">
                <strong className="text-slate-300">{deleteUser.full_name}</strong> ko permanently delete karna chahte ho?
                Yeh action undo nahi ho sakta।
              </p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteUser(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#21293d] text-slate-400 hover:bg-white/5 font-bold text-sm transition-all">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                {deleting ? <><Loader2 size={14} className="animate-spin"/>Deleting...</> : <><Trash2 size={14}/> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}