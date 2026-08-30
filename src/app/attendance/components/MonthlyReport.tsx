"use client";
// ─────────────────────────────────────────────────────────────────
// BUG FIX 1: `firstDay` and `daysInMonth` were declared twice —
//   once inside useEffect (unused) and once outside for rendering.
//   Removed the redundant declarations inside useEffect.
//
// BUG FIX 2: `window.history.pushState` was used directly instead
//   of Next.js router — bypasses React's routing, can cause
//   state/URL mismatch. Replaced with router.push().
//
// BUG FIX 3: `window.location.reload()` in onUpdate was a full
//   hard reload — replaced with a state-based refetch trigger.
// ─────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  RotateCcw,
  Loader2,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  X,
  Edit3,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import AttendanceModal from "./AttendanceModal";
import { currentMonthIST, parseISTDate, hoursBetweenIST, fmtTimeIST } from "@/lib/dateUtils";

interface Mechanic {
  id: number;
  name: string;
  image: string | null;
}
interface DayData {
  day: number;
  status: 0 | 1 | 2 | 3;
  isSunday: boolean;
  timeIn: string;
  timeOut: string;
  hours: string;
}
interface MechanicMonthData {
  mechanic: Mechanic;
  days: DayData[];
  fullDays: number;
  halfDays: number;
  absentDays: number;
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
  cls = "w-7 h-7 text-[10px]",
}: {
  image?: string | null;
  name: string;
  cls?: string;
}) =>
  image ? (
    <Image
      src={image}
      alt={name}
      width={28}
      height={28}
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

// Day status → pill classes for the calendar heatmap
const dayPillCls = (status: 0 | 1 | 2 | 3, isSunday: boolean): string => {
  if (status === 0) return "bg-[#0d1117] text-slate-600 border border-[#21293d]"; // future / no data
  if (status === 1) return "bg-emerald-500 text-white shadow-sm shadow-emerald-900/40";
  if (status === 3) return "bg-amber-500 text-white shadow-sm shadow-amber-900/30";
  if (isSunday) return "bg-[#1a0505] text-red-500 border border-red-900/30"; // Sunday absent
  return "bg-red-600/70 text-white shadow-sm shadow-red-900/30"; // Weekday absent
};

export default function MonthlyReport({
  userRole,
  mechanicId,
}: {
  userRole: "admin" | "staff" | "developer";
  mechanicId: number | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const monthParam = searchParams.get("month");
  const [month, setMonth] = useState(monthParam || currentMonthIST());

  useEffect(() => {
    if (monthParam && monthParam !== month) {
      setMonth(monthParam);
    }
  }, [monthParam, month]);

  const [mechanicsData, setMechanicsData] = useState<MechanicMonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<{
    mechanicId: number;
    mechanicName: string;
    mechanicImage: string | null;
    date: string;
    timeIn?: string;
    timeOut?: string;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let mechQuery = supabase
      .from("mechanic_list")
      .select("id, firstname, lastname, image_path")
      .eq("status", 1);
    if (userRole === "staff") {
      mechQuery = mechanicId ? mechQuery.eq("id", mechanicId) : mechQuery.eq("id", 0);
    }
    const { data: mechs, error: mechErr } = await mechQuery.order("firstname");
    if (mechErr || !mechs || mechs.length === 0) {
      setMechanicsData([]);
      setLoading(false);
      return;
    }

    const d = parseISTDate(month + "-01");
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const daysInMonth = new Date(y, m, 0).getDate();
    const startDate = `${month}-01`;
    const endDate = `${month}-${daysInMonth.toString().padStart(2, "0")}`;

    const { data: attData } = await supabase
      .from("attendance_list")
      .select("mechanic_id, curr_date, status, time_in, time_out")
      .gte("curr_date", startDate)
      .lte("curr_date", endDate);

    const now = new Date();
    const todayIST = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const result: MechanicMonthData[] = mechs.map((mech) => {
      const days: DayData[] = [];
      let fullDays = 0,
        halfDays = 0,
        absentDays = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${month}-${day.toString().padStart(2, "0")}`;
        const att = attData?.find((a) => a.mechanic_id === mech.id && a.curr_date === dateStr);
        const isFuture = dateStr >= todayIST;
        let status: 0 | 1 | 2 | 3;
        if (att) {
          status = att.status as 1 | 2 | 3;
        } else if (isFuture) {
          status = 0;
        } else {
          status = 2;
        }
        if (status === 1) fullDays++;
        else if (status === 3) halfDays++;
        else if (status === 2) absentDays++;
        const timeIn = (att?.time_in as string)?.slice(0, 5) || "";
        const timeOut = (att?.time_out as string)?.slice(0, 5) || "";
        days.push({
          day,
          status,
          isSunday: parseISTDate(dateStr).getDay() === 0,
          timeIn,
          timeOut,
          hours: hoursBetweenIST(timeIn || null, timeOut || null),
        });
      }
      return {
        mechanic: {
          id: mech.id,
          name: `${mech.firstname} ${mech.lastname}`.trim(),
          image: (mech.image_path as string) || null,
        },
        days,
        fullDays,
        halfDays,
        absentDays,
      };
    });
    setMechanicsData(result);
    setLoading(false);
  }, [month, userRole, mechanicId]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const changeMonth = (delta: -1 | 1) => {
    const d = parseISTDate(month + "-01");
    d.setMonth(d.getMonth() + delta);
    const newMonth = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
    }).format(d);
    setMonth(newMonth);
    router.push(`/attendance?view=report&month=${newMonth}`);
  };

  const handleDayClick = (mId: number, mName: string, dateStr: string) => {
    if (userRole !== "admin") return;
    const md = mechanicsData.find((x) => x.mechanic.id === mId);
    const day = md?.days.find((d) => `${month}-${d.day.toString().padStart(2, "0")}` === dateStr);
    setSelected({
      mechanicId: mId,
      mechanicName: mName,
      mechanicImage: md?.mechanic.image ?? null,
      date: dateStr,
      timeIn: day?.timeIn,
      timeOut: day?.timeOut,
    });
    setModalOpen(true);
  };

  const updateAttendanceInUI = (mechId: number, dateStr: string, newStatus: 0 | 1 | 2 | 3) => {
    setMechanicsData((prev) =>
      prev.map((md) => {
        if (md.mechanic.id !== mechId) return md;
        const updatedDays = md.days.map((day) => {
          const dayDateStr = `${month}-${day.day.toString().padStart(2, "0")}`;
          if (dayDateStr !== dateStr) return day;
          return { ...day, status: newStatus };
        });
        let fullDays = 0, halfDays = 0, absentDays = 0;
        updatedDays.forEach((d) => {
          if (d.status === 1) fullDays++;
          else if (d.status === 3) halfDays++;
          else if (d.status === 2) absentDays++;
        });
        return { ...md, days: updatedDays, fullDays, halfDays, absentDays };
      })
    );
  };

  // Overall monthly stats
  const overallStats = useMemo(() => {
    const totalStaff = mechanicsData.length;
    const totalFullDays = mechanicsData.reduce((s, m) => s + m.fullDays, 0);
    const totalHalfDays = mechanicsData.reduce((s, m) => s + m.halfDays, 0);
    const totalAbsent = mechanicsData.reduce((s, m) => s + m.absentDays, 0);
    const totalEffective = mechanicsData.reduce(
      (s, m) => s + m.fullDays + m.halfDays * 0.5,
      0
    );
    const daysInMonth =
      mechanicsData.length > 0 ? mechanicsData[0].days.filter((d) => d.status !== 0).length : 0;
    const overallRate =
      totalStaff > 0 && daysInMonth > 0
        ? ((totalFullDays + totalHalfDays * 0.5) / (totalStaff * daysInMonth)) * 100
        : 0;
    return { totalStaff, totalFullDays, totalHalfDays, totalAbsent, totalEffective, overallRate };
  }, [mechanicsData]);

  if (loading)
    return (
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-12 flex flex-col items-center justify-center gap-3">
        <Loader2 size={28} className="animate-spin text-blue-500" />
        <p className="text-slate-500 text-xs font-bold">Loading monthly report...</p>
      </div>
    );

  if (mechanicsData.length === 0)
    return (
      <div className="bg-[#161b27] border border-dashed border-[#21293d] rounded-2xl p-12 text-center">
        <Users size={24} className="text-slate-600 mx-auto mb-2" />
        <p className="text-slate-500 font-bold text-sm">
          {userRole === "staff"
            ? "No mechanic profile linked to your account. Contact admin."
            : "No active mechanics found."}
        </p>
      </div>
    );

  const firstDay = parseISTDate(month + "-01").getDay(); // 0 = Sunday
  const monthName = parseISTDate(month + "-01").toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const isCurrentMonth = month === currentMonthIST();
  const DOW_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="space-y-3.5">
      {/* ── Month Navigator + KPI Summary ── */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3 sm:p-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Month Switcher */}
        <div className="flex items-center gap-1 bg-[#0d1117] p-1 rounded-xl border border-[#21293d]">
          <button
            onClick={() => changeMonth(-1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            title="Previous Month"
          >
            <ChevronLeft size={15} />
          </button>
          <div className="relative flex items-center gap-1.5 px-2 py-0.5">
            <Calendar size={13} className="text-blue-400 flex-shrink-0" />
            <span className="text-xs font-bold text-white min-w-[120px] text-center">{monthName}</span>
            <input
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                router.push(`/attendance?view=report&month=${e.target.value}`);
              }}
              className="w-full h-full opacity-0 absolute inset-0 cursor-pointer [color-scheme:dark]"
              title="Pick Month"
            />
          </div>
          <button
            onClick={() => changeMonth(1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            title="Next Month"
          >
            <ChevronRight size={15} />
          </button>
          {!isCurrentMonth && (
            <button
              onClick={() => {
                const cur = currentMonthIST();
                setMonth(cur);
                router.push(`/attendance?view=report&month=${cur}`);
              }}
              className="ml-1 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold hover:bg-blue-500 hover:text-white transition-all"
            >
              This Month
            </button>
          )}
        </div>

        {/* Compact KPI Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-xl">
            <TrendingUp size={12} className="text-blue-400" />
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Rate</span>
            <span className="text-xs font-black text-white">{overallStats.overallRate.toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d1117] border border-emerald-500/20 rounded-xl">
            <CheckCircle2 size={12} className="text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-400">{overallStats.totalFullDays}</span>
            <span className="text-[9px] text-slate-500 font-bold uppercase">Full</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d1117] border border-amber-500/20 rounded-xl">
            <Clock size={12} className="text-amber-400" />
            <span className="text-[10px] font-bold text-amber-400">{overallStats.totalHalfDays}</span>
            <span className="text-[9px] text-slate-500 font-bold uppercase">Half</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d1117] border border-red-500/20 rounded-xl">
            <X size={12} className="text-red-400" />
            <span className="text-[10px] font-bold text-red-400">{overallStats.totalAbsent}</span>
            <span className="text-[9px] text-slate-500 font-bold uppercase">Absent</span>
          </div>
        </div>
      </div>

      {/* ── Desktop Heatmap Table (md+) ── */}
      <div className="hidden md:block bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            {/* Header: Staff | 1..N day numbers | P | H | A | Eff */}
            <thead>
              <tr className="bg-[#0d1117] border-b border-[#21293d]">
                <th className="py-2.5 px-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 sticky left-0 bg-[#0d1117] z-10 min-w-[160px]">
                  Staff Member
                </th>
                {mechanicsData[0]?.days.map((day) => (
                  <th
                    key={day.day}
                    className={`py-2 px-0 text-center text-[10px] font-bold w-7 ${
                      day.isSunday ? "text-red-500" : "text-slate-400"
                    }`}
                    title={DOW_LABELS[parseISTDate(`${month}-${day.day.toString().padStart(2, "0")}`).getDay()]}
                  >
                    {day.day}
                  </th>
                ))}
                <th className="py-2.5 px-2 text-center text-[10px] font-bold uppercase tracking-wider text-emerald-400 min-w-[32px]">P</th>
                <th className="py-2.5 px-2 text-center text-[10px] font-bold uppercase tracking-wider text-amber-400 min-w-[32px]">H</th>
                <th className="py-2.5 px-2 text-center text-[10px] font-bold uppercase tracking-wider text-red-400 min-w-[32px]">A</th>
                <th className="py-2.5 px-2 text-center text-[10px] font-bold uppercase tracking-wider text-blue-400 min-w-[42px]">Eff.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21293d]/50">
              {mechanicsData.map((md) => (
                <tr key={md.mechanic.id} className="hover:bg-blue-500/[0.02] transition-colors group">
                  {/* Staff Name */}
                  <td className="py-2 px-3 sticky left-0 bg-[#161b27] group-hover:bg-[#1a2030] z-10 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <MechAvatar image={md.mechanic.image} name={md.mechanic.name} cls="w-6 h-6 text-[9px]" />
                      <span className="text-white font-bold text-xs truncate max-w-[110px]">
                        {md.mechanic.name}
                      </span>
                    </div>
                  </td>
                  {/* Day Heatmap Cells */}
                  {md.days.map((day) => {
                    const dateStr = `${month}-${day.day.toString().padStart(2, "0")}`;
                    const statusLabel =
                      day.status === 0 ? "—" : day.status === 1 ? "P" : day.status === 3 ? "H" : "A";
                    const tooltip =
                      `${new Date(dateStr + "T00:00:00+05:30").toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                      })} — ${statusLabel === "P" ? "Present" : statusLabel === "H" ? "Half Day" : statusLabel === "A" ? "Absent" : "Upcoming"}` +
                      (day.timeIn && day.timeOut
                        ? ` | ${fmtTimeIST(day.timeIn)} – ${fmtTimeIST(day.timeOut)} (${day.hours})`
                        : "");
                    return (
                      <td key={day.day} className="py-1.5 px-0 text-center">
                        <div
                          title={tooltip}
                          onClick={() => handleDayClick(md.mechanic.id, md.mechanic.name, dateStr)}
                          className={`mx-auto w-6 h-6 flex items-center justify-center rounded-md text-[9px] font-black leading-none transition-all select-none ${dayPillCls(day.status, day.isSunday)} ${
                            userRole === "admin" && day.status !== 0
                              ? "cursor-pointer hover:scale-110 hover:ring-1 hover:ring-blue-400/50"
                              : "cursor-default"
                          }`}
                        >
                          {statusLabel}
                        </div>
                      </td>
                    );
                  })}
                  {/* Summary Columns */}
                  <td className="py-2 px-2 text-center">
                    <span className="text-xs font-black text-emerald-400">{md.fullDays}</span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="text-xs font-black text-amber-400">{md.halfDays}</span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="text-xs font-black text-red-400">{md.absentDays}</span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="text-xs font-black text-blue-400">
                      {(md.fullDays + md.halfDays * 0.5).toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Footer totals */}
            <tfoot>
              <tr className="bg-[#0d1117] border-t border-[#21293d]">
                <td className="py-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky left-0 bg-[#0d1117]">
                  Total ({mechanicsData.length})
                </td>
                {mechanicsData[0]?.days.map((_, i) => (
                  <td key={i} />
                ))}
                <td className="py-2 px-2 text-center text-xs font-black text-emerald-400">
                  {overallStats.totalFullDays}
                </td>
                <td className="py-2 px-2 text-center text-xs font-black text-amber-400">
                  {overallStats.totalHalfDays}
                </td>
                <td className="py-2 px-2 text-center text-xs font-black text-red-400">
                  {overallStats.totalAbsent}
                </td>
                <td className="py-2 px-2 text-center text-xs font-black text-blue-400">
                  {overallStats.totalEffective.toFixed(1)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Mobile Calendar Cards (< md) ── */}
      <div className="md:hidden grid grid-cols-1 gap-3">
        {mechanicsData.map((md) => {
          const effectiveDays = md.fullDays + md.halfDays * 0.5;
          const workingDays = md.days.filter((d) => d.status !== 0).length;
          const attendanceRate = workingDays > 0 ? (effectiveDays / workingDays) * 100 : 0;

          return (
            <div
              key={md.mechanic.id}
              className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3.5 shadow-sm space-y-3"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <MechAvatar image={md.mechanic.image} name={md.mechanic.name} cls="w-9 h-9 text-xs" />
                  <div className="min-w-0">
                    <p className="text-white font-black text-sm truncate">{md.mechanic.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{monthName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                    P:{md.fullDays}
                  </span>
                  <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
                    H:{md.halfDays}
                  </span>
                  <span className="text-[10px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-md">
                    A:{md.absentDays}
                  </span>
                </div>
              </div>

              {/* Attendance Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-slate-400">Attendance Rate</span>
                  <span className={attendanceRate >= 80 ? "text-emerald-400" : attendanceRate >= 50 ? "text-amber-400" : "text-red-400"}>
                    {attendanceRate.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#0d1117] rounded-full border border-[#21293d] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      attendanceRate >= 80 ? "bg-emerald-500" : attendanceRate >= 50 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(100, attendanceRate)}%` }}
                  />
                </div>
              </div>

              {/* Calendar Mini-Heatmap */}
              <div>
                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                  {DOW_LABELS.map((d, i) => (
                    <div
                      key={i}
                      className={`text-[9px] font-black text-center py-0.5 ${i === 0 ? "text-red-500" : "text-slate-600"}`}
                    >
                      {d}
                    </div>
                  ))}
                </div>
                {/* Empty offset cells + day cells */}
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  {md.days.map((day) => {
                    const dateStr = `${month}-${day.day.toString().padStart(2, "0")}`;
                    const statusLabel =
                      day.status === 0 ? "" : day.status === 1 ? "P" : day.status === 3 ? "H" : "A";
                    const tooltip =
                      `${day.day} — ${day.status === 1 ? "Present" : day.status === 3 ? "Half Day" : day.status === 2 ? "Absent" : "Upcoming"}` +
                      (day.timeIn && day.timeOut
                        ? ` | ${fmtTimeIST(day.timeIn)}–${fmtTimeIST(day.timeOut)}`
                        : "");
                    return (
                      <div
                        key={day.day}
                        title={tooltip}
                        onClick={() => handleDayClick(md.mechanic.id, md.mechanic.name, dateStr)}
                        className={`aspect-square flex items-center justify-center rounded-md text-[9px] font-black leading-none transition-all ${dayPillCls(day.status, day.isSunday)} ${
                          userRole === "admin" && day.status !== 0
                            ? "cursor-pointer hover:scale-105 hover:ring-1 hover:ring-blue-400/50"
                            : "cursor-default"
                        }`}
                      >
                        {statusLabel || <span className="text-[8px] font-bold text-slate-700">{day.day}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer summary */}
              <div className="flex items-center justify-between pt-2 border-t border-[#21293d] text-[10px] font-bold">
                <span className="text-slate-400">
                  Effective: <span className="text-blue-400">{effectiveDays.toFixed(1)} days</span>
                </span>
                {userRole === "admin" && (
                  <button
                    type="button"
                    onClick={() => handleDayClick(md.mechanic.id, md.mechanic.name, `${month}-01`)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-blue-600/10 border border-blue-500/20 rounded-lg text-blue-400 hover:bg-blue-600/20 transition-all"
                  >
                    <Edit3 size={10} />
                    Edit
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Admin edit modal */}
      {modalOpen && selected && userRole === "admin" && (
        <AttendanceModal
          mechanicId={selected.mechanicId}
          mechanicName={selected.mechanicName}
          mechanicImage={selected.mechanicImage}
          date={selected.date}
          initialTimeIn={selected.timeIn}
          initialTimeOut={selected.timeOut}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
          }}
          onUpdate={(newStatus) => {
            updateAttendanceInUI(selected.mechanicId, selected.date, newStatus);
            setModalOpen(false);
            setSelected(null);
            setTimeout(() => setRefreshKey((k) => k + 1), 100);
          }}
        />
      )}
    </div>
  );
}
