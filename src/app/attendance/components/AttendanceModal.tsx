"use client";
// ─────────────────────────────────────────────────────────────────
// PHP attendance modal parity — status quick-buttons PLUS editable
// check-in/out times with live working-hours preview.
//
//  - Status buttons: only update status (existing times preserved)
//  - Save In/Out Times: writes times + auto-derives status
//    (< 6h = Half Day, else Present; check-in only = Present)
//  - Clear Times: clears both times, keeps current status
// ─────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import {
  X,
  Check,
  Clock,
  UserX,
  Save,
  Eraser,
  LogIn,
  LogOut,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { deriveStatusFromTimes, hoursBetweenIST } from "@/lib/dateUtils";

interface Props {
  mechanicId: number;
  mechanicName: string;
  mechanicImage?: string | null;
  date: string;
  initialTimeIn?: string;
  initialTimeOut?: string;
  onClose: () => void;
  onUpdate: (newStatus: 0 | 1 | 2 | 3) => void;
}

const mechInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || name.charAt(0);

const STATUS_OPTIONS = [
  {
    value: 1 as const,
    label: "Mark Present",
    icon: Check,
    cls: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-900/30",
    activeCls: "ring-2 ring-emerald-400/50",
  },
  {
    value: 3 as const,
    label: "Mark Half Day",
    icon: Clock,
    cls: "bg-amber-500 hover:bg-amber-400 text-white shadow-sm shadow-amber-900/30",
    activeCls: "ring-2 ring-amber-400/50",
  },
  {
    value: 2 as const,
    label: "Mark Absent",
    icon: UserX,
    cls: "bg-red-600 hover:bg-red-500 text-white shadow-sm shadow-red-900/30",
    activeCls: "ring-2 ring-red-400/50",
  },
];

const STATUS_BADGE: Record<number, { label: string; cls: string }> = {
  0: { label: "Not Marked", cls: "bg-slate-700/60 text-slate-400 border border-slate-600/40" },
  1: { label: "Present", cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" },
  2: { label: "Absent", cls: "bg-red-500/10 text-red-400 border border-red-500/30" },
  3: { label: "Half Day", cls: "bg-amber-500/10 text-amber-400 border border-amber-500/30" },
};

const inputCls =
  "w-full px-2.5 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-white text-sm font-bold text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all [color-scheme:dark]";

export default function AttendanceModal({
  mechanicId,
  mechanicName,
  mechanicImage,
  date,
  initialTimeIn,
  initialTimeOut,
  onClose,
  onUpdate,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeIn, setTimeIn] = useState(initialTimeIn ?? "");
  const [timeOut, setTimeOut] = useState(initialTimeOut ?? "");
  const [currentStatus, setCurrentStatus] = useState<0 | 1 | 2 | 3>(0);

  // Load existing record
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("attendance_list")
        .select("status, time_in, time_out")
        .eq("mechanic_id", mechanicId)
        .eq("curr_date", date)
        .maybeSingle();
      if (data) {
        setCurrentStatus(data.status as 0 | 1 | 2 | 3);
        setTimeIn((data.time_in as string)?.slice(0, 5) ?? timeIn);
        setTimeOut((data.time_out as string)?.slice(0, 5) ?? timeOut);
      }
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mechanicId, date]);

  const upsert = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("attendance_list")
      .upsert(
        { mechanic_id: mechanicId, curr_date: date, ...payload },
        { onConflict: "mechanic_id,curr_date" }
      );
    if (err) {
      setError(err.message);
      setSaving(false);
      return false;
    }
    setSaving(false);
    return true;
  };

  const handleSetStatus = async (status: 1 | 2 | 3) => {
    const ok = await upsert({ status });
    if (ok) {
      setCurrentStatus(status);
      onUpdate(status);
    }
  };

  const handleSaveTimes = async () => {
    const derived = deriveStatusFromTimes(timeIn || null, timeOut || null);
    const status: 0 | 1 | 2 | 3 =
      derived ?? (currentStatus !== 0 ? (currentStatus as 1 | 2 | 3) : 0);
    const ok = await upsert({
      time_in: timeIn || null,
      time_out: timeOut || null,
      status,
    });
    if (ok) {
      setCurrentStatus(status);
      onUpdate(status);
    }
  };

  const handleClearTimes = async () => {
    const status: 0 | 1 | 2 | 3 = currentStatus !== 0 ? (currentStatus as 1 | 2 | 3) : 0;
    setTimeIn("");
    setTimeOut("");
    const ok = await upsert({ time_in: null, time_out: null, status });
    if (ok) {
      setCurrentStatus(status);
      onUpdate(status);
    }
  };

  const hoursPreview = hoursBetweenIST(timeIn || null, timeOut || null);
  const badge = STATUS_BADGE[currentStatus] ?? STATUS_BADGE[0];

  const fmtDate = new Date(date + "T00:00:00+05:30").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-[#0d1117] border-b border-[#21293d]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <h3 className="font-black text-white text-sm">Update Attendance</h3>
              <p className="text-[10px] text-slate-400">{fmtDate}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#161b27] border border-[#21293d] text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Modal Body ── */}
        <div className="p-4 space-y-4">
          {/* Mechanic Info Card */}
          <div className="bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              {mechanicImage ? (
                <Image
                  src={mechanicImage}
                  alt={mechanicName}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-white/10"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/30 rounded-full flex items-center justify-center font-black text-blue-400 text-[10px] flex-shrink-0">
                  {mechInitials(mechanicName)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-white font-black text-xs truncate">{mechanicName}</p>
              </div>
            </div>
            <span className={`flex-shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${badge.cls}`}>
              {badge.label}
            </span>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-slate-500 text-xs font-bold">
              <Loader2 size={18} className="animate-spin text-blue-500" />
              Loading...
            </div>
          ) : (
            <>
              {/* Time Inputs */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-slate-500 font-black flex items-center gap-0.5">
                    <LogIn size={9} className="text-emerald-400" />
                    Check In
                  </label>
                  <input
                    type="time"
                    value={timeIn}
                    onChange={(e) => setTimeIn(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-slate-500 font-black flex items-center gap-0.5">
                    <LogOut size={9} className="text-red-400" />
                    Check Out
                  </label>
                  <input
                    type="time"
                    value={timeOut}
                    onChange={(e) => setTimeOut(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Working Hours Preview */}
              <div className={`text-center ${hoursPreview !== "—" ? "" : "opacity-40"}`}>
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-black">
                  <Clock size={12} />
                  Working Hours: {hoursPreview}
                </span>
              </div>

              {/* Save Times Button */}
              <button
                onClick={handleSaveTimes}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save In / Out Times
              </button>
              <p className="text-center text-[9px] text-slate-500 font-bold -mt-2">
                Auto-status: &lt;6h = Half Day · Check-in only = Present
              </p>

              {/* Divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-[#21293d]" />
                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">or mark directly</span>
                <div className="flex-1 h-px bg-[#21293d]" />
              </div>

              {/* Status Quick Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSetStatus(opt.value)}
                    disabled={saving}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 ${opt.cls} ${currentStatus === opt.value ? opt.activeCls : ""}`}
                  >
                    <opt.icon size={14} />
                    {opt.label.replace("Mark ", "")}
                  </button>
                ))}
              </div>

              {/* Clear Times */}
              <button
                onClick={handleClearTimes}
                disabled={saving}
                className="w-full py-2 bg-[#21293d] hover:bg-[#2a3550] text-slate-400 hover:text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Eraser size={12} />
                Clear In / Out Times
              </button>

              <button
                onClick={onClose}
                className="w-full py-2 bg-transparent hover:bg-white/[0.03] text-slate-500 hover:text-slate-300 font-bold rounded-xl text-xs transition-all"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
