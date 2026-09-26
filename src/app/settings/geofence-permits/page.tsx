// ─── Outside-Work Permit management (admin/developer) ─────────────────────
// docs/plans/staff_geofence_viewonly_plan.md §5.4. Grant/revoke/list +
// timer presets. Table migration: 20260926_staff_geofence_permit.sql
// (Dashboard SQL Editor me apply karo — usse pehle "missing" notice).
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Timer, Plus, Trash2, Loader2, ShieldAlert } from "lucide-react";
import { supabase, getCachedUser } from "@/lib/supabase";
import { toast } from "@/lib/toast";

interface Permit {
  id: number;
  user_id: string;
  mechanic_id: number | null;
  reason: string;
  granted_by: string | null;
  granted_at: string;
  expires_at: string;
}

interface StaffRow {
  id: string;
  full_name: string;
  mechanic_id: number | null;
}

const PRESETS = [
  { label: "30 min", mins: 30 },
  { label: "1 hr", mins: 60 },
  { label: "2 hr", mins: 120 },
  { label: "4 hr", mins: 240 },
  { label: "8 hr", mins: 480 },
  { label: "1 din", mins: 1440 },
];

export default function GeofencePermitsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffId, setStaffId] = useState("");
  const [mins, setMins] = useState(60);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await getCachedUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (myProfile?.role !== "admin" && myProfile?.role !== "developer") {
        router.push("/");
        return;
      }
      const [permRes, staffRes] = await Promise.all([
        fetch("/api/admin/geofence-permit", { cache: "no-store" }),
        supabase
          .from("profiles")
          .select("id, full_name, mechanic_id")
          .eq("role", "staff")
          .order("full_name"),
      ]);
      const permData = await permRes.json();
      if (!permRes.ok) throw new Error(permData.error || "Permits load fail");
      setPermits(permData.permits || []);
      setMissing(!!permData.missing);
      setStaff((staffRes.data || []) as StaffRow[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load fail hua");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(() => {
    const now = Date.now();
    return permits.filter((p) => new Date(p.expires_at).getTime() > now);
  }, [permits]);

  const grant = async () => {
    if (!staffId) {
      toast.error("Staff select karo");
      return;
    }
    setBusy(true);
    try {
      const st = staff.find((s) => s.id === staffId);
      const res = await fetch("/api/admin/geofence-permit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: staffId,
          mechanic_id: st?.mechanic_id ?? null,
          minutes: mins,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Grant fail");
      toast.success("Permit mil gaya ✅");
      setStaffId("");
      setReason("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Grant fail hua");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: number) => {
    if (!confirm("Ye permit turant revoke ho jayega. Pakka?")) return;
    try {
      const res = await fetch(`/api/admin/geofence-permit?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Revoke fail");
      toast.success("Permit revoke ho gaya");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Revoke fail hua");
    }
  };

  const left = (exp: string) => {
    const ms = new Date(exp).getTime() - Date.now();
    if (ms <= 0) return "expired";
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m baki` : `${m}m baki`;
  };

  const nameOf = (p: Permit) =>
    staff.find((s) => s.id === p.user_id)?.full_name || p.user_id.slice(0, 8);

  return (
    <div className="min-h-screen bg-app font-sans pb-16">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/settings"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-panel-2 border border-app hover:bg-panel-2 text-muted rounded-lg text-xs font-bold transition"
          >
            <ArrowLeft size={12} /> Settings
          </Link>
          <h1 className="text-lg font-black text-white flex items-center gap-2">
            <Timer size={18} className="text-emerald-400" /> Outside-Work Permits
          </h1>
        </div>

        {missing && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4 text-amber-300 text-sm mb-4 flex items-start gap-2">
            <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
            <span>
              Permit table abhi DB me nahi hai — pehle Dashboard SQL Editor me{" "}
              <span className="font-mono">20260926_staff_geofence_permit.sql</span> chalao.
            </span>
          </div>
        )}

        {/* Grant form */}
        <div className="bg-panel border border-app rounded-2xl px-5 py-4 mb-4">
          <h2 className="text-sm font-black text-white mb-1 flex items-center gap-2">
            <Plus size={14} className="text-emerald-400" /> Naya Permit
          </h2>
          <p className="text-[11px] text-muted mb-3">
            Staff ko batana na bhoolein: permit par bahar se hue kaam ki location audit me save
            hoti hai (Reports → Bahar Se Hua Kaam).
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
                Staff
              </span>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full px-3 py-2 bg-app border border-app rounded-lg text-sm text-white outline-none"
              >
                <option value="">— select —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
                Reason (optional)
              </span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="client visit, delivery…"
                maxLength={200}
                className="w-full px-3 py-2 bg-app border border-app rounded-lg text-sm text-white placeholder:text-app outline-none"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {PRESETS.map((p) => (
              <button
                key={p.mins}
                type="button"
                onClick={() => setMins(p.mins)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                  mins === p.mins
                    ? "bg-emerald-600 text-white"
                    : "bg-app border border-app text-muted hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={grant}
              disabled={busy || missing}
              className="ml-auto px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-black transition flex items-center gap-1.5"
            >
              {busy && <Loader2 size={12} className="animate-spin" />} Permit Do
            </button>
          </div>
        </div>

        {/* Active permits */}
        <div className="bg-panel border border-app rounded-2xl px-5 py-4">
          <h2 className="text-sm font-black text-white mb-3">
            Active Permits ({active.length})
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={22} className="animate-spin text-muted-2" />
            </div>
          ) : active.length === 0 ? (
            <p className="text-xs text-muted py-4 text-center">Koi active permit nahi.</p>
          ) : (
            <div className="space-y-2">
              {active.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3.5 py-2.5"
                >
                  <Timer size={14} className="text-emerald-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white truncate">{nameOf(p)}</p>
                    <p className="text-[11px] text-muted truncate">
                      {p.reason || "—"} · {left(p.expires_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revoke(p.id)}
                    className="ml-auto flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-300 rounded-lg text-[11px] font-black transition flex-shrink-0"
                  >
                    <Trash2 size={12} /> Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
