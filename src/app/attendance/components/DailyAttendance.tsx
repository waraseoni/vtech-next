"use client";
// ─────────────────────────────────────────────────────────────────
// PHP attendance parity port — check-in/check-out times, working
// hours, daily stats, and self check-in/out card.
//
// Status codes: 1 = Present, 2 = Absent, 3 = Half Day, 0 = unmarked.
// Time status auto-derivation (mirrors PHP save_attendance):
//   - check-in present + no check-out -> Present
//   - both times, under 6h            -> Half Day
//   - both times, 6h+                 -> Present
//   - no times                        -> keep manually chosen status
// ─────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import {
  Calendar,
  Save,
  Check,
  Clock,
  X,
  AlertCircle,
  RotateCcw,
  LogIn,
  LogOut,
  Fingerprint,
  ArrowRight,
  Users,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  todayIST,
  nowISTTime,
  hoursBetweenIST,
  fmtTimeIST,
  deriveStatusFromTimes,
} from "@/lib/dateUtils";
import { verifyAttendanceLocation, geoErrorMessage } from "@/lib/geofence";
import { format } from "date-fns/format";

interface Mechanic {
  id: number;
  name: string;
  designation: string;
  image: string | null;
}

const mechInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || name.charAt(0);

const MechAvatar = ({
  image,
  name,
  cls = "w-8 h-8 text-xs",
}: {
  image?: string | null;
  name: string;
  cls?: string;
}) =>
  image ? (
    <Image
      src={image}
      alt={name}
      width={32}
      height={32}
      className={`${cls} rounded-full object-cover flex-shrink-0 border border-white/10 ring-1 ring-blue-500/10`}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  ) : (
    <div
      className={`${cls} bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/30 rounded-full flex items-center justify-center font-black text-blue-400 flex-shrink-0`}
    >
      {mechInitials(name)}
    </div>
  );

// 0 = not yet marked, 1 = present, 2 = absent, 3 = half day
interface AttendanceStatus {
  [mechanicId: number]: 0 | 1 | 2 | 3;
}
interface DayTimes {
  timeIn: string;
  timeOut: string;
}
interface SelfAttn {
  status: number;
  time_in: string | null;
  time_out: string | null;
}

const STATUS_BTNS = [
  {
    value: 1 as const,
    label: "Present",
    short: "P",
    icon: Check,
    activeClass: "bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/20",
    hoverClass: "hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/40",
    textColor: "text-emerald-400",
  },
  {
    value: 3 as const,
    label: "Half Day",
    short: "H",
    icon: Clock,
    activeClass: "bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/20",
    hoverClass: "hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/40",
    textColor: "text-amber-400",
  },
  {
    value: 2 as const,
    label: "Absent",
    short: "A",
    icon: X,
    activeClass: "bg-red-500 text-white border-red-500 shadow-sm shadow-red-500/20",
    hoverClass: "hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40",
    textColor: "text-red-400",
  },
] as const;

const STATUS_BADGE: Record<number, { label: string; cls: string; dot: string }> = {
  0: {
    label: "Absent",
    cls: "bg-red-500/10 text-red-400 border border-red-500/30",
    dot: "bg-red-500",
  },
  1: {
    label: "Present",
    cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  2: {
    label: "Absent",
    cls: "bg-red-500/10 text-red-400 border border-red-500/30",
    dot: "bg-red-500",
  },
  3: {
    label: "Half Day",
    cls: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
    dot: "bg-amber-500",
  },
};

export default function DailyAttendance({
  userRole,
  mechanicId,
}: {
  userRole: "admin" | "staff" | "developer";
  mechanicId: number | null;
}) {
  const searchParams = useSearchParams();
  const today = todayIST();

  const [selectedDate, setSelectedDate] = useState(
    userRole === "admin" ? searchParams.get("date") || today : today
  );
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [attendance, setAttendance] = useState<AttendanceStatus>({});
  const [times, setTimes] = useState<Record<number, DayTimes>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Self check-in / check-out
  const [selfAttn, setSelfAttn] = useState<SelfAttn | null>(null);
  const [selfBusy, setSelfBusy] = useState<"in" | "out" | null>(null);
  const [selfMsg, setSelfMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const selfName = mechanicId ? mechanics.find((m) => m.id === mechanicId)?.name || "" : "";
  const selfImage = mechanicId ? mechanics.find((m) => m.id === mechanicId)?.image || null : null;

  // Fetch mechanics
  useEffect(() => {
    const fetchMechanics = async () => {
      let query = supabase
        .from("mechanic_list")
        .select("id, firstname, lastname, designation, image_path")
        .eq("status", 1);
      if (userRole === "staff" && mechanicId) query = query.eq("id", mechanicId);
      const { data, error } = await query.order("firstname");
      if (!error && data) {
        setMechanics(
          data.map((m) => ({
            id: m.id,
            name: `${m.firstname} ${m.lastname}`.trim(),
            designation: m.designation || "",
            image: (m.image_path as string) || null,
          }))
        );
      }
    };
    fetchMechanics();
  }, [userRole, mechanicId]);

  // Fetch attendance for selected date
  const fetchAttendance = useCallback(async () => {
    if (!mechanics.length) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("attendance_list")
      .select("mechanic_id, status, time_in, time_out")
      .eq("curr_date", selectedDate);
    const attMap: AttendanceStatus = {};
    const timesMap: Record<number, DayTimes> = {};
    if (!error && data) {
      data.forEach((a) => {
        attMap[a.mechanic_id] = a.status as 1 | 2 | 3;
        timesMap[a.mechanic_id] = {
          timeIn: (a.time_in as string)?.slice(0, 5) || "",
          timeOut: (a.time_out as string)?.slice(0, 5) || "",
        };
      });
    }
    mechanics.forEach((m) => {
      if (attMap[m.id] == null) attMap[m.id] = 2;
    });
    setAttendance(attMap);
    setTimes(timesMap);
    setLoading(false);
  }, [mechanics, selectedDate]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Self record for today
  const fetchSelf = useCallback(async () => {
    if (!mechanicId) {
      setSelfAttn(null);
      return;
    }
    const { data } = await supabase
      .from("attendance_list")
      .select("status, time_in, time_out")
      .eq("mechanic_id", mechanicId)
      .eq("curr_date", today)
      .maybeSingle();
    setSelfAttn(data || { status: 0, time_in: null, time_out: null });
  }, [mechanicId, today]);

  useEffect(() => {
    fetchSelf();
  }, [fetchSelf]);

  const handleStatusChange = (mId: number, status: 1 | 2 | 3) =>
    setAttendance((prev) => ({ ...prev, [mId]: status }));

  const handleTimeChange = (mId: number, field: "timeIn" | "timeOut", value: string) =>
    setTimes((prev) => ({
      ...prev,
      [mId]: { timeIn: prev[mId]?.timeIn ?? "", timeOut: prev[mId]?.timeOut ?? "", [field]: value },
    }));

  // Mark all present quickly
  const handleMarkAllPresent = () => {
    const newMap: AttendanceStatus = {};
    mechanics.forEach((m) => {
      newMap[m.id] = 1;
    });
    setAttendance(newMap);
  };

  // Change selected date by delta days (admin only)
  const changeDay = (delta: number) => {
    const d = new Date(selectedDate + "T00:00:00+05:30");
    d.setDate(d.getDate() + delta);
    const newDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    if (newDate <= today) setSelectedDate(newDate);
  };

  // Self check-in / check-out
  const handleSelfAction = async (action: "in" | "out") => {
    if (!mechanicId) return;
    setSelfBusy(action);
    setSelfMsg(null);
    try {
      const now = nowISTTime();
      const { data: existing } = await supabase
        .from("attendance_list")
        .select("id, time_in, time_out")
        .eq("mechanic_id", mechanicId)
        .eq("curr_date", today)
        .maybeSingle();

      if (action === "in") {
        if (existing?.time_in) {
          setSelfMsg({
            type: "ok",
            text: `Already checked in at ${fmtTimeIST(existing.time_in)}.`,
          });
          return;
        }
      } else {
        if (!existing?.time_in) {
          setSelfMsg({ type: "err", text: "Pehle check-in karein, tabhi check-out hoga." });
          return;
        }
        if (existing?.time_out) {
          setSelfMsg({
            type: "ok",
            text: `Already checked out at ${fmtTimeIST(existing.time_out)}.`,
          });
          return;
        }
      }

      const geo =
        userRole === "admin" || userRole === "developer"
          ? { ok: true, reason: "ok" as const, distanceM: null, coords: null }
          : await verifyAttendanceLocation();
      if (!geo.ok) {
        setSelfMsg({ type: "err", text: geoErrorMessage(geo) });
        return;
      }
      const coords = geo.coords;

      if (action === "in") {
        const { error } = await supabase.from("attendance_list").upsert(
          {
            mechanic_id: mechanicId,
            curr_date: today,
            time_in: now,
            status: 1,
            ...(coords ? { lat_in: coords.lat, lng_in: coords.lng } : {}),
          },
          { onConflict: "mechanic_id,curr_date" }
        );
        if (error) throw error;
        setSelfMsg({ type: "ok", text: `Checked in at ${fmtTimeIST(now)}. Have a nice day!` });
      } else {
        const derived = deriveStatusFromTimes(existing?.time_in ?? null, now) ?? 1;
        const { error } = await supabase.from("attendance_list").upsert(
          {
            mechanic_id: mechanicId,
            curr_date: today,
            time_out: now,
            status: derived,
            ...(coords ? { lat_out: coords.lat, lng_out: coords.lng } : {}),
          },
          { onConflict: "mechanic_id,curr_date" }
        );
        if (error) throw error;
        const hours = hoursBetweenIST(existing?.time_in ?? null, now);
        setSelfMsg({
          type: "ok",
          text: `Checked out at ${fmtTimeIST(now)}. Working hours: ${hours}${derived === 3 ? " (Half Day - under 6 hours)" : ""}`,
        });
      }
      await fetchSelf();
      await fetchAttendance();
    } catch (err) {
      setSelfMsg({
        type: "err",
        text: (err instanceof Error ? err.message : String(err)) || "Error performing check-in/out.",
      });
    } finally {
      setSelfBusy(null);
    }
  };

  // Submit all attendance (admin)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMsg(null);

    if (selectedDate > today) {
      setSaveMsg({ type: "err", text: "Cannot save attendance for a future date." });
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        mechanics.map(async (mech) => {
          const s = attendance[mech.id] ?? 2;
          let status: number = s === 1 || s === 2 || s === 3 ? s : 2;
          const t = times[mech.id];
          let timeIn: string | null = null;
          let timeOut: string | null = null;

          if (userRole === "admin" && t) {
            timeIn = t.timeIn || null;
            timeOut = t.timeOut || null;
            if (timeIn) status = deriveStatusFromTimes(timeIn, timeOut) ?? status;
          }

          const payload: Record<string, unknown> = {
            mechanic_id: mech.id,
            curr_date: selectedDate,
            status,
          };
          if (userRole === "admin") {
            payload.time_in = timeIn;
            payload.time_out = timeOut;
          }

          const { data: existing, error: checkErr } = await supabase
            .from("attendance_list")
            .select("id")
            .eq("mechanic_id", mech.id)
            .eq("curr_date", selectedDate)
            .maybeSingle();
          if (checkErr) throw new Error(`Check failed for ${mech.name}: ${checkErr.message}`);

          if (existing) {
            const { error: updErr } = await supabase
              .from("attendance_list")
              .update(payload)
              .eq("id", existing.id);
            if (updErr) throw new Error(`Update failed for ${mech.name}: ${updErr.message}`);
          } else {
            const { error: insErr } = await supabase.from("attendance_list").insert(payload);
            if (insErr) throw new Error(`Insert failed for ${mech.name}: ${insErr.message}`);
          }
        })
      );
      setSaveMsg({ type: "ok", text: "Attendance saved successfully!" });
      await fetchAttendance();
      await fetchSelf();
      setTimeout(() => setSaveMsg(null), 4000);
    } catch (err) {
      setSaveMsg({
        type: "err",
        text: (err instanceof Error ? err.message : String(err)) || "Error saving attendance.",
      });
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(attendance).filter((s) => s === 1).length;
  const halfdayCount = Object.values(attendance).filter((s) => s === 3).length;
  const absentCount = Object.values(attendance).filter((s) => s === 2).length;
  const totalStaff = mechanics.length;

  const selfStatus = selfAttn || { status: 0, time_in: null, time_out: null };
  const selfBadge = STATUS_BADGE[selfStatus.status] ?? STATUS_BADGE[0];

  const timeInputCls =
    "w-full px-2 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-lg text-white text-xs font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-center [color-scheme:dark]";

  const displayDate = new Date(selectedDate + "T00:00:00+05:30").toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">

      {/* ── Self Check-In / Check-Out Hero Card (Staff only when self-data exists) ── */}
      {selfName && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-950/70 dark:via-indigo-950/60 dark:to-blue-950/70 border border-blue-200 dark:border-blue-500/25 rounded-2xl overflow-hidden shadow-lg shadow-blue-100 dark:shadow-blue-900/20">
          <div className="px-4 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Staff Identity */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                <MechAvatar image={selfImage} name={selfName} cls="w-11 h-11 text-base" />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#0d1117] ${selfBadge.dot}`}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Fingerprint size={12} className="text-blue-400/70 flex-shrink-0" />
                  <span className="text-slate-900 dark:text-white font-black text-sm truncate">{selfName}</span>
                </div>
                <p className="text-blue-600/70 dark:text-blue-200/60 text-[11px] mb-1.5">{displayDate}</p>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${selfBadge.cls}`}
                >
                  <span className={`w-1 h-1 rounded-full ${selfBadge.dot}`} />
                  {selfBadge.label}
                </span>
              </div>
            </div>

            {/* Time Tiles: In / Out / Hours */}
            <div className="grid grid-cols-3 gap-2 lg:flex lg:items-center lg:gap-2">
              <div className="bg-white/70 dark:bg-white/[0.06] border border-blue-100 dark:border-white/10 rounded-xl px-3 py-2 text-center min-w-[80px]">
                <span className="block text-[8px] uppercase tracking-wider text-blue-600/70 dark:text-blue-200/60 font-bold mb-0.5">
                  <LogIn size={8} className="inline mr-0.5" />
                  Check In
                </span>
                <span className="block text-slate-900 dark:text-white font-black text-sm">
                  {fmtTimeIST(selfStatus.time_in)}
                </span>
              </div>
              <ArrowRight size={13} className="hidden lg:block text-slate-400 dark:text-white/30 mx-1 flex-shrink-0" />
              <div className="bg-white/70 dark:bg-white/[0.06] border border-blue-100 dark:border-white/10 rounded-xl px-3 py-2 text-center min-w-[80px]">
                <span className="block text-[8px] uppercase tracking-wider text-blue-600/70 dark:text-blue-200/60 font-bold mb-0.5">
                  <LogOut size={8} className="inline mr-0.5" />
                  Check Out
                </span>
                <span className="block text-slate-900 dark:text-white font-black text-sm">
                  {fmtTimeIST(selfStatus.time_out)}
                </span>
              </div>
              <div
                className={`rounded-xl px-3 py-2 text-center min-w-[70px] ${
                  selfStatus.time_in && selfStatus.time_out
                    ? "bg-emerald-600/80 border border-emerald-500/30"
                    : "bg-white/70 dark:bg-white/[0.06] border border-blue-100 dark:border-white/10"
                }`}
              >
                <span className="block text-slate-900 dark:text-white font-black text-sm">
                  {hoursBetweenIST(selfStatus.time_in, selfStatus.time_out)}
                </span>
                <span className="block text-[8px] uppercase tracking-wider text-slate-500 dark:text-white/70 font-bold">
                  Hours
                </span>
              </div>
            </div>

            {/* Check-In / Check-Out Buttons */}
            <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-col lg:w-40 lg:gap-2">
              <button
                type="button"
                onClick={() => handleSelfAction("in")}
                disabled={!!selfStatus.time_in || selfBusy !== null}
                className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  selfStatus.time_in
                    ? "dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 cursor-default"
                    : "bg-white dark:bg-white text-blue-950 hover:bg-blue-50 dark:hover:bg-blue-50 shadow-sm"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {selfBusy === "in" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : selfStatus.time_in ? (
                  <Check size={12} />
                ) : (
                  <LogIn size={12} />
                )}
                {selfStatus.time_in ? "Checked In" : "Check In"}
              </button>
              <button
                type="button"
                onClick={() => handleSelfAction("out")}
                disabled={!selfStatus.time_in || !!selfStatus.time_out || selfBusy !== null}
                className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  !selfStatus.time_in || selfStatus.time_out
                    ? "dark:bg-white/10 dark:text-white/50 dark:border-white/10 bg-slate-100 text-slate-400 border border-slate-200 cursor-default"
                    : "bg-red-500 hover:bg-red-400 text-white shadow-sm"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {selfBusy === "out" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : selfStatus.time_out ? (
                  <Check size={12} />
                ) : (
                  <LogOut size={12} />
                )}
                {selfStatus.time_out ? "Checked Out" : "Check Out"}
              </button>
            </div>
          </div>

          {/* Self Message / Geofence Alert */}
          {(selfMsg || selfBusy) && (
            <div
              className={`mx-4 mb-3 flex items-start gap-2 px-3 py-2 rounded-xl text-xs font-bold border ${
                selfBusy
                  ? "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-300"
                  : selfMsg?.type === "ok"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                  : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-300"
              }`}
            >
              {selfBusy ? (
                <>
                  <Loader2 size={12} className="animate-spin flex-shrink-0 mt-0.5" />
                  <span>Processing {selfBusy === "in" ? "check-in" : "check-out"}...</span>
                </>
              ) : selfMsg?.type === "err" ? (
                <>
                  <MapPin size={12} className="flex-shrink-0 mt-0.5" />
                  <span>{selfMsg.text}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={12} className="flex-shrink-0 mt-0.5" />
                  <span>{selfMsg?.text}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── KPI Summary Stats + Date Navigator + Toolbar ── */}
      {userRole === "admin" && (
        <>
          {/* 4 KPI Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
            <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Staff</span>
                <Users size={13} className="text-blue-400" />
              </div>
              <p className="text-lg font-black text-white">{totalStaff}</p>
              <p className="text-[9px] text-slate-500">{displayDate.split(",")[0]}</p>
            </div>
            <div className="bg-[#161b27] border border-emerald-500/20 rounded-xl p-2.5 sm:p-3">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">Present</span>
                <Check size={13} className="text-emerald-400" />
              </div>
              <p className="text-lg font-black text-emerald-400">{presentCount}</p>
              <p className="text-[9px] text-emerald-400/50">
                {totalStaff > 0 ? Math.round((presentCount / totalStaff) * 100) : 0}% of team
              </p>
            </div>
            <div className="bg-[#161b27] border border-amber-500/20 rounded-xl p-2.5 sm:p-3">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-400/80">Half Day</span>
                <Clock size={13} className="text-amber-400" />
              </div>
              <p className="text-lg font-black text-amber-400">{halfdayCount}</p>
              <p className="text-[9px] text-amber-400/50">0.5x wage</p>
            </div>
            <div className="bg-[#161b27] border border-red-500/20 rounded-xl p-2.5 sm:p-3">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-red-400/80">Absent</span>
                <X size={13} className="text-red-400" />
              </div>
              <p className="text-lg font-black text-red-400">{absentCount}</p>
              <p className="text-[9px] text-red-400/50">no wage</p>
            </div>
          </div>

          {/* Date Navigator + Actions Toolbar */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Date Navigator */}
            <div className="flex items-center gap-1 bg-[#0d1117] p-1 rounded-xl border border-[#21293d]">
              <button
                type="button"
                onClick={() => changeDay(-1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <ChevronLeft size={15} />
              </button>
              <div className="relative flex items-center gap-1.5 px-2 py-0.5">
                <Calendar size={13} className="text-blue-400 flex-shrink-0" />
                <span className="text-xs font-bold text-white min-w-[160px] text-center">
                  {displayDate}
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  max={today}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full h-full opacity-0 absolute inset-0 cursor-pointer [color-scheme:dark]"
                  title="Pick Date"
                />
              </div>
              <button
                type="button"
                onClick={() => changeDay(1)}
                disabled={selectedDate >= today}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={15} />
              </button>
              {selectedDate !== today && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(today)}
                  className="ml-1 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold hover:bg-blue-500 hover:text-white transition-all"
                >
                  Today
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-all"
              >
                <CheckCircle2 size={13} />
                Mark All Present
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm shadow-blue-600/25 active:scale-95"
              >
                {saving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Save size={13} />
                )}
                {saving ? "Saving..." : "Save Attendance"}
              </button>
            </div>
          </div>

          {/* Save Message */}
          {saveMsg && (
            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border ${
                saveMsg.type === "ok"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              {saveMsg.type === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {saveMsg.text}
            </div>
          )}
        </>
      )}

      {/* ── Staff View: Date info ── */}
      {userRole === "staff" && (
        <div className="bg-[#161b27] border border-[#21293d] rounded-xl px-4 py-2.5 text-center text-xs font-bold text-slate-400">
          {displayDate}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-blue-500" />
            <p className="text-slate-500 text-xs font-bold">Loading attendance...</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── DESKTOP TABLE (md+) ── */}
          <div className="hidden md:block bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden shadow-md w-full">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: "4%" }} />
                  <col style={{ width: userRole === "admin" ? "25%" : "36%" }} />
                  <col style={{ width: userRole === "admin" ? "34%" : "28%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: userRole === "admin" ? "11%" : "19%" }} />
                </colgroup>
                <thead>
                  <tr className="bg-[#0d1117] border-b border-[#21293d] text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    <th className="py-2.5 px-2 text-center">#</th>
                    <th className="py-2.5 px-3">Staff Member</th>
                    <th className="py-2.5 px-3 text-center">
                      {userRole === "admin" ? "Mark Status" : "Attendance Status"}
                    </th>
                    <th className="py-2.5 px-2 text-center">
                      <LogIn size={10} className="inline mr-0.5 text-emerald-400" />
                      In
                    </th>
                    <th className="py-2.5 px-2 text-center">
                      <LogOut size={10} className="inline mr-0.5 text-red-400" />
                      Out
                    </th>
                    <th className="py-2.5 px-2 text-center">
                      <Clock size={10} className="inline mr-0.5 text-blue-400" />
                      Hours
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]/50">
                  {mechanics.map((mech, idx) => {
                    const st = attendance[mech.id];
                    const t = times[mech.id];
                    const tIn = t?.timeIn ?? "";
                    const tOut = t?.timeOut ?? "";
                    const badge = STATUS_BADGE[st] ?? STATUS_BADGE[0];
                    return (
                      <tr
                        key={mech.id}
                        className="hover:bg-blue-500/[0.02] transition-colors"
                      >
                        <td className="py-2 px-2 text-center text-[10px] text-slate-500 font-bold">{idx + 1}</td>
                        <td className="py-2 px-3 overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0">
                            <MechAvatar image={mech.image} name={mech.name} cls="w-7 h-7 text-[10px]" />
                            <div className="min-w-0 truncate">
                              <p className="text-white font-bold text-xs truncate">{mech.name}</p>
                              <p className="text-[10px] text-slate-500 font-medium">{mech.designation}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center overflow-hidden">
                          {userRole === "admin" ? (
                            <div className="flex justify-center gap-1">
                              {STATUS_BTNS.map((btn) => (
                                <button
                                  key={btn.value}
                                  type="button"
                                  onClick={() => handleStatusChange(mech.id, btn.value)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                                    st === btn.value
                                      ? btn.activeClass
                                      : `bg-transparent text-slate-500 border-[#21293d] ${btn.hoverClass}`
                                  }`}
                                >
                                  {btn.short === "P" && <Check size={9} className="inline mr-0.5" />}
                                  {btn.short === "H" && <Clock size={9} className="inline mr-0.5" />}
                                  {btn.short === "A" && <X size={9} className="inline mr-0.5" />}
                                  {btn.label}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${badge.cls}`}
                            >
                              <span className={`w-1 h-1 rounded-full ${badge.dot}`} />
                              {badge.label}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center overflow-hidden">
                          {userRole === "admin" ? (
                            <input
                              type="time"
                              value={tIn}
                              onChange={(e) => handleTimeChange(mech.id, "timeIn", e.target.value)}
                              className={timeInputCls}
                            />
                          ) : (
                            <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400">
                              {fmtTimeIST(tIn) || "—"}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center overflow-hidden">
                          {userRole === "admin" ? (
                            <input
                              type="time"
                              value={tOut}
                              onChange={(e) => handleTimeChange(mech.id, "timeOut", e.target.value)}
                              className={timeInputCls}
                            />
                          ) : (
                            <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-500/10 text-red-400">
                              {fmtTimeIST(tOut) || "—"}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center overflow-hidden">
                          <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400">
                            {hoursBetweenIST(tIn, tOut)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── MOBILE CARDS (< md) ── */}
          <div className="md:hidden space-y-3 pb-24">
            {mechanics.map((mech) => {
              const st = attendance[mech.id];
              const t = times[mech.id];
              const tIn = t?.timeIn ?? "";
              const tOut = t?.timeOut ?? "";
              const badge = STATUS_BADGE[st] ?? STATUS_BADGE[0];
              return (
                <div
                  key={mech.id}
                  className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3.5 shadow-sm space-y-3"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MechAvatar image={mech.image} name={mech.name} cls="w-9 h-9 text-xs" />
                      <div className="min-w-0">
                        <p className="text-white font-black text-sm truncate">{mech.name}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{mech.designation}</p>
                      </div>
                    </div>
                    <span
                      className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${badge.cls}`}
                    >
                      <span className={`w-1 h-1 rounded-full ${badge.dot}`} />
                      {badge.label}
                    </span>
                  </div>

                  {/* Time row */}
                  <div className="grid grid-cols-3 gap-2 bg-[#0d1117] p-2 rounded-xl border border-[#21293d]">
                    <div className="text-center">
                      <p className="text-[8px] uppercase font-bold text-slate-500 mb-0.5">
                        <LogIn size={8} className="inline mr-0.5 text-emerald-400" />In
                      </p>
                      {userRole === "admin" ? (
                        <input
                          type="time"
                          value={tIn}
                          onChange={(e) => handleTimeChange(mech.id, "timeIn", e.target.value)}
                          className="w-full px-1 py-1 bg-transparent text-emerald-400 text-xs font-bold text-center outline-none [color-scheme:dark]"
                        />
                      ) : (
                        <span className="text-xs font-bold text-emerald-400">{fmtTimeIST(tIn) || "—"}</span>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] uppercase font-bold text-slate-500 mb-0.5">
                        <LogOut size={8} className="inline mr-0.5 text-red-400" />Out
                      </p>
                      {userRole === "admin" ? (
                        <input
                          type="time"
                          value={tOut}
                          onChange={(e) => handleTimeChange(mech.id, "timeOut", e.target.value)}
                          className="w-full px-1 py-1 bg-transparent text-red-400 text-xs font-bold text-center outline-none [color-scheme:dark]"
                        />
                      ) : (
                        <span className="text-xs font-bold text-red-400">{fmtTimeIST(tOut) || "—"}</span>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] uppercase font-bold text-slate-500 mb-0.5">
                        <Clock size={8} className="inline mr-0.5 text-blue-400" />Hours
                      </p>
                      <span className="text-xs font-bold text-blue-400">{hoursBetweenIST(tIn, tOut)}</span>
                    </div>
                  </div>

                  {/* P / H / A buttons (Admin only) */}
                  {userRole === "admin" && (
                    <div className="grid grid-cols-3 gap-1.5">
                      {STATUS_BTNS.map((btn) => (
                        <button
                          key={btn.value}
                          type="button"
                          onClick={() => handleStatusChange(mech.id, btn.value)}
                          className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all active:scale-95 ${
                            st === btn.value
                              ? btn.activeClass
                              : `bg-transparent text-slate-500 border-[#21293d] ${btn.hoverClass}`
                          }`}
                        >
                          {btn.short === "P" && <Check size={10} className="inline mr-0.5" />}
                          {btn.short === "H" && <Clock size={10} className="inline mr-0.5" />}
                          {btn.short === "A" && <X size={10} className="inline mr-0.5" />}
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Mobile Floating Save FAB ── */}
      {userRole === "admin" && !loading && (
        <button
          type="submit"
          disabled={saving}
          className="md:hidden fixed bottom-24 right-5 w-14 h-14 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-full shadow-2xl shadow-blue-500/30 flex items-center justify-center text-white border-2 border-[#0d1117] z-50 transition-all active:scale-95"
        >
          {saving ? (
            <Loader2 className="animate-spin" size={22} />
          ) : (
            <Save size={22} />
          )}
        </button>
      )}
    </form>
  );
}
