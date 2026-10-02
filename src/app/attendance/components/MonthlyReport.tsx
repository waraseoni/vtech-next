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
import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
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
import { currentMonthIST, parseISTDate, fmtTimeIST } from "@/lib/dateUtils";
import { computeDay, fmtMins, nowIST } from "@/lib/attendance-hours";
import { bizDutyFromMeta, dutyFor, fmtDuty, type Duty, type DutyScheduleRow } from "@/lib/duty";
import { logActivity } from "@/lib/activity";
import { toast } from "@/lib/toast";
import { requireAdmin } from "@/lib/requireAdmin";
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
  // P3 (engine): effective out / OT / duty — tooltip + audit ke liye
  outAuto: boolean;
  working: boolean;
  otMin: number;
  dutyMin: number;
  lateMin: number;
  /** Us din ki duty range "10:00 – 20:00" (mid-month change ho to alag ho sakta). */
  dutyRange: string;
}
interface MechanicMonthData {
  mechanic: Mechanic;
  days: DayData[];
  fullDays: number;
  halfDays: number;
  absentDays: number;
  /** Naam ke neeche dikhne ke liye — month-end tak applicable duty range. */
  dutyLabel: string;
}

/** Report header ke "Close pending days" button ke liye ek row. */
type PendingClose = {
  id: number; // attendance_list.id
  dateStr: string;
  mechName: string;
  timeIn: string; // "HH:MM:SS" — compute ke liye as-is chahiye
  duty: Duty;
};

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
      className={`${cls} rounded-full object-cover flex-shrink-0 border border-white/10 ring-1 ring-blue-500/10 cursor-zoom-in`}

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
  if (status === 0) return "bg-app text-muted-2 border border-app"; // future / no data
  if (status === 1) return "bg-emerald-500 text-white shadow-sm shadow-emerald-900/40";
  if (status === 3) return "bg-amber-500 text-white shadow-sm shadow-amber-900/30";
  if (isSunday) return "bg-[#1a0505] text-red-500 border border-red-900/30"; // Sunday absent
  return "bg-red-600/70 text-white shadow-sm shadow-red-900/30"; // Weekday absent
};

// ── Day helpers (cell rendering + detail tooltip) ───────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");

const STATUS_WORD: Record<number, string> = {
  0: "Upcoming",
  1: "Present",
  2: "Absent",
  3: "Half Day",
};

const STATUS_BADGE_CLS: Record<number, string> = {
  0: "border bg-app text-muted-2",
  1: "border bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
  2: "border bg-red-500/15 border-red-500/30 text-red-400",
  3: "border bg-amber-500/15 border-amber-500/30 text-amber-400",
};

const STATUS_LETTER: Record<number, string> = { 1: "P", 2: "A", 3: "H" };

/** "Thu, 01 Oct, 2026" — IST date string ko sahi timezone me render. */
const dayLabel = (dateStr: string): string =>
  new Date(`${dateStr}T00:00:00+05:30`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/**
 * Cell ki dusri line (D1): worked hours — kyunki aage salary hours se banegi.
 * Hours na ho (status-only row) to status letter; status 0 to kuch nahi.
 */
const cellSub = (day: DayData): string | null => {
  if (day.status === 0) return null;
  if (day.hours !== "—") return day.hours.replace(/\s+/g, "");
  return STATUS_LETTER[day.status] ?? null;
};

const cellAria = (day: DayData): string => {
  const parts = [`${day.day} ${STATUS_WORD[day.status]}`];
  if (day.timeIn) parts.push(`in ${fmtTimeIST(day.timeIn)}`);
  if (day.timeOut) parts.push(`out ${fmtTimeIST(day.timeOut)}${day.outAuto ? " (auto)" : ""}`);
  if (day.hours !== "—") parts.push(`total ${day.hours}`);
  if (day.otMin > 0) parts.push(`ot ${fmtMins(day.otMin)}`);
  return parts.join(", ");
};

type TipAnchor = { left: number; top: number; width: number; height: number };

type TipState = {
  mechanicId: number;
  dateStr: string;
  day: DayData;
  anchor: TipAnchor;
  pinned: boolean;
};

/**
 * Detail tooltip — hover (desktop) + tap (mobile) dono isi se.
 * portal + fixed positioning kyunki table `overflow-x-auto` hai → absolute
 * tooltip edge cells par clip ho jata.
 */
function DayTip({
  tip,
  isAdmin,
  onEdit,
  onClose,
  onEnter,
  onLeave,
}: {
  tip: TipState;
  isAdmin: boolean;
  onEdit: () => void;
  onClose: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0, ready: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const W = el.offsetWidth || 200;
    const H = el.offsetHeight || 150;
    const PAD = 8;
    let left = tip.anchor.left + tip.anchor.width / 2 - W / 2;
    left = Math.min(Math.max(PAD, left), Math.max(PAD, window.innerWidth - W - PAD));
    let top = tip.anchor.top + tip.anchor.height + PAD;
    if (top + H > window.innerHeight - PAD) top = Math.max(PAD, tip.anchor.top - PAD - H);
    setPos({ left, top, ready: true });
  }, [tip]);

  const d = tip.day;
  const rows = [
    { label: "In", value: fmtTimeIST(d.timeIn || null), cls: "text-emerald-400" },
    { label: "Out", value: fmtTimeIST(d.timeOut || null), cls: "text-red-400" },
    { label: "Total", value: d.hours, cls: "text-blue-400" },
  ];
  // P3: duty/OT/late — salary isi data se banegi, pehle se tooltip me.
  const meta = [
    {
      label: "Duty",
      // Duty TIME (range) + uske neeche lambai — mid-month change bhi dikh jata.
      value: d.dutyRange || "—",
      sub: d.dutyMin > 0 ? fmtMins(d.dutyMin) : "",
      cls: "text-indigo-300",
    },
    {
      label: "OT",
      value: d.otMin > 0 ? fmtMins(d.otMin) : "—",
      sub: "",
      cls: d.otMin > 0 ? "text-amber-400" : "text-muted-2",
    },
    {
      label: "Late",
      value: d.lateMin > 0 ? `${d.lateMin}m` : "—",
      sub: "",
      cls: d.lateMin > 0 ? "text-red-400" : "text-muted-2",
    },
  ];

  return createPortal(
    <div
      ref={ref}
      data-testid="day-tip"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="w-[200px] rounded-xl border border-app bg-panel p-2.5 shadow-2xl"
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        zIndex: 60,
        visibility: pos.ready ? "visible" : "hidden",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white font-black text-[11px] leading-tight">{dayLabel(tip.dateStr)}</p>
          <span
            className={`mt-1 inline-block text-[9px] font-black px-1.5 py-0.5 rounded-md ${STATUS_BADGE_CLS[d.status]}`}
          >
            {STATUS_WORD[d.status]}
          </span>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="text-muted-2 hover:text-white transition-colors shrink-0"
        >
          <X size={12} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1">
        {rows.map((r) => (
          <div
            key={r.label}
            className="bg-app border border-app rounded-lg px-1 py-1.5 text-center"
          >
            <p className="text-[8px] font-black uppercase tracking-wider text-muted-2">{r.label}</p>
            <p className={`text-[11px] font-black tabular-nums ${r.cls}`}>{r.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1">
        {meta.map((r) => (
          <div key={r.label} className="bg-app border border-app rounded-lg px-1 py-1 text-center">
            <p className="text-[8px] font-black uppercase tracking-wider text-muted-2">{r.label}</p>
            <p className={`text-[10px] font-black tabular-nums ${r.cls}`}>{r.value}</p>
            {r.sub && <p className="text-[8px] font-bold text-muted-2">{r.sub}</p>}
          </div>
        ))}
      </div>
      {d.outAuto && (
        <p className="mt-1.5 text-[9px] font-black text-amber-400/90">
          Auto-checkout @ duty end · OT 0
        </p>
      )}
      {d.working && (
        <p className="mt-1.5 text-[9px] font-black text-emerald-400/90">Working now…</p>
      )}
      {isAdmin && (
        <button
          type="button"
          onClick={onEdit}
          className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-lg text-blue-400 text-[10px] font-bold hover:bg-blue-600/20 transition-all"
        >
          <Edit3 size={10} />
          Edit
        </button>
      )}
    </div>,
    document.body
  );
}

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
  // P3: purane din jisme check-in hai par checkout nahi → header button se close.
  const [pendingClose, setPendingClose] = useState<PendingClose[]>([]);
  const [closing, setClosing] = useState(false);
  // P3: is mahine kitni duty changes hui (header note).
  const [dutyChanges, setDutyChanges] = useState(0);
  // Detail tooltip — hover (desktop) / tap (mobile). pinned = click se khula.
  const [tip, setTip] = useState<TipState | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setPendingClose([]);
      setDutyChanges(0);
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
      .select("id, mechanic_id, curr_date, status, time_in, time_out")
      .gte("curr_date", startDate)
      .lte("curr_date", endDate);

    const now = new Date();
    const todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    // P3: duty history (batch — N+1 nahi) + shop fallback, dono ek saath.
    const mechIds = mechs.map((m) => m.id);
    const [dutyRes, sysRes] = await Promise.all([
      supabase
        .from("staff_duty_schedule")
        .select("mechanic_id, duty_start, duty_end, break_minutes, effective_from")
        .in("mechanic_id", mechIds)
        .lte("effective_from", endDate)
        .order("effective_from", { ascending: false }),
      supabase
        .from("system_info")
        .select("meta_field, meta_value")
        .in("meta_field", ["biz_open", "biz_close"]),
    ]);
    const bizDuty = bizDutyFromMeta(
      (sysRes.data as Array<{ meta_field: string; meta_value: string | null }>) || []
    );
    const dutyRows = (dutyRes.data || []) as DutyScheduleRow[];
    // Mahine ke beech me duty badli? (effective_from strictly 01 tarikh ke baad)
    setDutyChanges(
      dutyRows.filter((r) => r.effective_from > startDate && r.effective_from <= endDate).length
    );
    const nowInfo = nowIST();
    const pending: PendingClose[] = [];

    const result: MechanicMonthData[] = mechs.map((mech) => {
      const sched = dutyRows.filter((r) => r.mechanic_id === mech.id);
      const mechName = `${mech.firstname} ${mech.lastname}`.trim();
      const days: DayData[] = [];
      let fullDays = 0,
        halfDays = 0,
        absentDays = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${month}-${day.toString().padStart(2, "0")}`;
        const att = attData?.find((a) => a.mechanic_id === mech.id && a.curr_date === dateStr);
        const isFuture = dateStr >= todayStr;
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
        const rawOut = (att?.time_out as string)?.slice(0, 5) || "";
        // Us din ki applicable duty (history se) → engine (auto-checkout + OT).
        const duty = dutyFor(sched, dateStr, bizDuty);
        const c = att
          ? computeDay(
              {
                curr_date: dateStr,
                status: Number(att.status),
                time_in: (att.time_in as string) ?? null,
                time_out: (att.time_out as string) ?? null,
              },
              duty,
              nowInfo
            )
          : null;

        // P3 "Close pending days": purana din + check-in ho chuka + checkout nahi.
        if (
          att?.id != null &&
          att.time_in &&
          !att.time_out &&
          dateStr < todayStr &&
          (att.status === 1 || att.status === 3)
        ) {
          pending.push({
            id: Number(att.id),
            dateStr,
            mechName,
            timeIn: att.time_in as string,
            duty,
          });
        }

        days.push({
          day,
          status,
          isSunday: parseISTDate(dateStr).getDay() === 0,
          timeIn,
          timeOut: c?.effOut ?? rawOut, // effective (auto ya real)
          hours: c && c.workedMin > 0 ? fmtMins(c.workedMin) : "—",
          outAuto: c?.isAutoClosed ?? false,
          working: c?.working ?? false,
          otMin: c?.otMin ?? 0,
          dutyMin: c?.dutyMin ?? 0,
          lateMin: c?.lateInMin ?? 0,
          dutyRange: fmtDuty(duty),
        });
      }
      return {
        mechanic: {
          id: mech.id,
          name: mechName,
          image: (mech.image_path as string) || null,
        },
        days,
        fullDays,
        halfDays,
        absentDays,
        // Naam ke neeche: us mahine ki applicable duty (month-end wali).
        dutyLabel: fmtDuty(dutyFor(sched, endDate, bizDuty)),
      };
    });
    setMechanicsData(result);
    setPendingClose(pending);
    setLoading(false);
  }, [month, userRole, mechanicId]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Tooltip: Esc se band + unmount par hover-timer cleanup.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTip(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (tipTimer.current) clearTimeout(tipTimer.current);
    };
  }, []);

  useEffect(() => {
    setTip(null);
  }, [month]);

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

  // ── Detail tooltip (D2): hover (desktop) se khulta, click/tap se pin hota.
  const anchorOf = (el: HTMLDivElement): TipAnchor => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };

  const clearTipTimer = () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = null;
  };

  const hoverTip = (el: HTMLDivElement, mId: number, dateStr: string, day: DayData) => {
    const anchor = anchorOf(el);
    setTip((prev) =>
      prev?.pinned ? prev : { mechanicId: mId, dateStr, day, anchor, pinned: false }
    );
  };

  const hoverIn = () => clearTipTimer();

  const hoverOut = () => {
    clearTipTimer();
    tipTimer.current = setTimeout(() => {
      setTip((prev) => (prev && !prev.pinned ? null : prev));
    }, 140);
  };

  const clickTip = (el: HTMLDivElement, mId: number, dateStr: string, day: DayData) => {
    const anchor = anchorOf(el);
    setTip((prev) =>
      prev && prev.pinned && prev.mechanicId === mId && prev.dateStr === dateStr
        ? null
        : { mechanicId: mId, dateStr, day, anchor, pinned: true }
    );
  };

  const closeTip = () => {
    clearTipTimer();
    setTip(null);
  };

  // Popover ke andar Edit (admin) — data hamesha fresh `mechanicsData` se.
  const openEditFromTip = () => {
    if (!tip) return;
    if (!requireAdmin(userRole, "manage")) return;
    const md = mechanicsData.find((m) => m.mechanic.id === tip.mechanicId);
    if (!md) return;
    const day = md.days.find((d) => `${month}-${pad2(d.day)}` === tip.dateStr);
    setSelected({
      mechanicId: md.mechanic.id,
      mechanicName: md.mechanic.name,
      mechanicImage: md.mechanic.image ?? null,
      date: tip.dateStr,
      timeIn: day?.timeIn,
      timeOut: day?.timeOut,
    });
    setTip(null);
    setModalOpen(true);
  };

  // P3: ek click me saare purane pending din close — time_out = duty_end,
  // worked_min = engine output, OT 0 (auto-close par OT band). Ek-ek karke
  // batch (supabase-js me bulk-in-row-update nahi), log bhi ek hi.
  const closePendingDays = async () => {
    if (!requireAdmin(userRole, "manage")) return;
    if (!pendingClose.length || closing) return;
    const ok = window.confirm(
      `${pendingClose.length} pending day(s) close karein?\n` +
        `Har staff ka time_out duty_end set hoga (auto-checkout, OT 0).`
    );
    if (!ok) return;
    setClosing(true);
    const nowInfo = nowIST();
    let done = 0;
    for (const p of pendingClose) {
      const c = computeDay(
        { curr_date: p.dateStr, status: 1, time_in: p.timeIn, time_out: null },
        p.duty,
        nowInfo
      );
      // Safety: sirf wahi din jo engine ki auto-close rule me aata hai.
      if (!c.effOut || !c.isAutoClosed) continue;
      const { error } = await supabase
        .from("attendance_list")
        .update({
          time_out: c.effOut,
          worked_min: c.workedMin,
          ot_min: c.otMin, // auto = 0
          duty_min: c.dutyMin,
          is_auto_closed: true,
        })
        .eq("id", p.id);
      if (!error) done++;
    }
    setClosing(false);
    if (done > 0) {
      await logActivity(
        "Closed Pending Attendance Days",
        "Attendance",
        undefined,
        `${done} day(s) auto-closed (time_out = duty_end)`
      );
      toast.success(`${done} pending day(s) closed (auto-checkout).`);
      setRefreshKey((k) => k + 1);
    } else {
      toast.error("Koi day close nahi hua.");
    }
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
        let fullDays = 0,
          halfDays = 0,
          absentDays = 0;
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
    const totalEffective = mechanicsData.reduce((s, m) => s + m.fullDays + m.halfDays * 0.5, 0);
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
      <div className="bg-panel border border-app rounded-2xl p-12 flex flex-col items-center justify-center gap-3">
        <Loader2 size={28} className="animate-spin text-blue-500" />
        <p className="text-muted text-xs font-bold">Loading monthly report...</p>
      </div>
    );

  if (mechanicsData.length === 0)
    return (
      <div className="bg-panel border border-dashed border-app rounded-2xl p-12 text-center">
        <Users size={24} className="text-muted-2 mx-auto mb-2" />
        <p className="text-muted font-bold text-sm">
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
      <div className="bg-panel border border-app rounded-2xl p-3 sm:p-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Month Switcher */}
        <div className="flex items-center gap-1 bg-app p-1 rounded-xl border border-app">
          <button
            onClick={() => changeMonth(-1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-all"
            title="Previous Month"
          >
            <ChevronLeft size={15} />
          </button>
          <div className="relative flex items-center gap-1.5 px-2 py-0.5">
            <Calendar size={13} className="text-blue-400 flex-shrink-0" />
            <span className="text-xs font-bold text-white min-w-[120px] text-center">
              {monthName}
            </span>
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
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-all"
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

        {/* P3: auto-checkout — purane pending din ek click me band (admin only) */}
        {(userRole === "admin" || userRole === "developer") && pendingClose.length > 0 && (
          <button
            onClick={closePendingDays}
            disabled={closing}
            className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider hover:bg-amber-500 hover:text-black transition-all disabled:opacity-50 disabled:pointer-events-none"
            title="In purane dinon ka time_out duty_end set hoga (auto-checkout, OT 0)"
          >
            <Clock size={12} />
            {closing ? "Closing..." : `Close ${pendingClose.length} pending`}
          </button>
        )}

        {/* P3: duty month ke beech me badli → hours har din us din ki duty se */}
        {dutyChanges > 0 && (
          <div
            className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider"
            title="Kuch staff ki duty is mahine ke beech me badli — har din us din ki applicable duty se hours/OT nikale gaye."
          >
            <Clock size={12} />
            Duty changed ×{dutyChanges}
          </div>
        )}

        {/* Compact KPI Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-app border border-app rounded-xl">
            <TrendingUp size={12} className="text-blue-400" />
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
              Rate
            </span>
            <span className="text-xs font-black text-white">
              {overallStats.overallRate.toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-app border border-emerald-500/20 rounded-xl">
            <CheckCircle2 size={12} className="text-emerald-400" />
            <span className="text-[10px] font-bold text-emerald-400">
              {overallStats.totalFullDays}
            </span>
            <span className="text-[9px] text-muted font-bold uppercase">Full</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-app border border-amber-500/20 rounded-xl">
            <Clock size={12} className="text-amber-400" />
            <span className="text-[10px] font-bold text-amber-400">
              {overallStats.totalHalfDays}
            </span>
            <span className="text-[9px] text-muted font-bold uppercase">Half</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-app border border-red-500/20 rounded-xl">
            <X size={12} className="text-red-400" />
            <span className="text-[10px] font-bold text-red-400">{overallStats.totalAbsent}</span>
            <span className="text-[9px] text-muted font-bold uppercase">Absent</span>
          </div>
        </div>
      </div>

      {/* ── Desktop Heatmap Table (md+) ── */}
      <div className="hidden md:block bg-panel border border-app rounded-2xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            {/* Header: Staff | 1..N day numbers | P | H | A | Eff */}
            <thead>
              <tr className="bg-app border-b border-app">
                <th className="py-2.5 px-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted sticky left-0 bg-app z-10 min-w-[160px]">
                  Staff Member
                </th>
                {mechanicsData[0]?.days.map((day) => (
                  <th
                    key={day.day}
                    className={`py-2 px-0 text-center text-[10px] font-bold w-7 ${
                      day.isSunday ? "text-red-500" : "text-muted"
                    }`}
                    title={
                      DOW_LABELS[
                        parseISTDate(`${month}-${day.day.toString().padStart(2, "0")}`).getDay()
                      ]
                    }
                  >
                    {day.day}
                  </th>
                ))}
                <th className="py-2.5 px-2 text-center text-[10px] font-bold uppercase tracking-wider text-emerald-400 min-w-[32px]">
                  P
                </th>
                <th className="py-2.5 px-2 text-center text-[10px] font-bold uppercase tracking-wider text-amber-400 min-w-[32px]">
                  H
                </th>
                <th className="py-2.5 px-2 text-center text-[10px] font-bold uppercase tracking-wider text-red-400 min-w-[32px]">
                  A
                </th>
                <th className="py-2.5 px-2 text-center text-[10px] font-bold uppercase tracking-wider text-blue-400 min-w-[42px]">
                  Eff.
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21293d]/50">
              {mechanicsData.map((md) => (
                <tr
                  key={md.mechanic.id}
                  className="hover:bg-blue-500/[0.02] transition-colors group"
                >
                  {/* Staff Name + duty (naam ke sath hi) */}
                  <td className="py-2 px-3 sticky left-0 bg-panel group-hover:bg-panel-2 z-10 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <MechAvatar
                        image={md.mechanic.image}
                        name={md.mechanic.name}
                        cls="w-6 h-6 text-[9px]"
                      />
                      <div className="min-w-0">
                        <span className="block text-white font-bold text-xs truncate max-w-[110px]">
                          {md.mechanic.name}
                        </span>
                        <span
                          className="block text-[9px] font-bold text-indigo-300 truncate max-w-[110px]"
                          title="Us mahine ki applicable duty (month-end tak)"
                        >
                          Duty {md.dutyLabel}
                        </span>
                      </div>
                    </div>
                  </td>
                  {/* Day Heatmap Cells */}
                  {md.days.map((day) => {
                    const dateStr = `${month}-${pad2(day.day)}`;
                    const sub = cellSub(day);
                    const isActive = tip?.mechanicId === md.mechanic.id && tip.dateStr === dateStr;
                    return (
                      <td key={day.day} className="py-1.5 px-0 text-center">
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={cellAria(day)}
                          aria-pressed={isActive}
                          onMouseEnter={(e) =>
                            hoverTip(e.currentTarget, md.mechanic.id, dateStr, day)
                          }
                          onMouseLeave={hoverOut}
                          onClick={(e) => clickTip(e.currentTarget, md.mechanic.id, dateStr, day)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              clickTip(e.currentTarget, md.mechanic.id, dateStr, day);
                            }
                          }}
                          className={`mx-auto w-7 h-7 flex flex-col items-center justify-center gap-[1px] rounded-md font-black leading-none transition-all select-none cursor-pointer ${dayPillCls(day.status, day.isSunday)} ${
                            isActive ? "ring-2 ring-blue-400" : "hover:scale-110"
                          }`}
                        >
                          <span
                            className={day.status === 0 ? "text-[10px] text-app" : "text-[9px]"}
                          >
                            {day.day}
                          </span>
                          {sub && <span className="text-[7px]">{sub}</span>}
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
              <tr className="bg-app border-t border-app">
                <td className="py-2 px-3 text-[10px] font-bold text-muted uppercase tracking-wider sticky left-0 bg-app">
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
              className="bg-panel border border-app rounded-2xl p-3.5 shadow-sm space-y-3"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <MechAvatar
                    image={md.mechanic.image}
                    name={md.mechanic.name}
                    cls="w-9 h-9 text-xs"
                  />
                  <div className="min-w-0">
                    <p className="text-white font-black text-sm truncate">{md.mechanic.name}</p>
                    <p className="text-[10px] text-muted font-medium">
                      {monthName} ·{" "}
                      <span className="font-bold text-indigo-300">Duty {md.dutyLabel}</span>
                    </p>
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
                  <span className="text-muted">Attendance Rate</span>
                  <span
                    className={
                      attendanceRate >= 80
                        ? "text-emerald-400"
                        : attendanceRate >= 50
                          ? "text-amber-400"
                          : "text-red-400"
                    }
                  >
                    {attendanceRate.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 bg-app rounded-full border border-app overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      attendanceRate >= 80
                        ? "bg-emerald-500"
                        : attendanceRate >= 50
                          ? "bg-amber-500"
                          : "bg-red-500"
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
                      className={`text-[9px] font-black text-center py-0.5 ${i === 0 ? "text-red-500" : "text-muted-2"}`}
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
                    const dateStr = `${month}-${pad2(day.day)}`;
                    const sub = cellSub(day);
                    const isActive = tip?.mechanicId === md.mechanic.id && tip.dateStr === dateStr;
                    return (
                      <div
                        key={day.day}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isActive}
                        aria-label={cellAria(day)}
                        onMouseEnter={(e) =>
                          hoverTip(e.currentTarget, md.mechanic.id, dateStr, day)
                        }
                        onMouseLeave={hoverOut}
                        onClick={(e) => clickTip(e.currentTarget, md.mechanic.id, dateStr, day)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            clickTip(e.currentTarget, md.mechanic.id, dateStr, day);
                          }
                        }}
                        className={`aspect-square flex flex-col items-center justify-center gap-[1px] rounded-md font-black leading-none transition-all cursor-pointer ${dayPillCls(
                          day.status,
                          day.isSunday
                        )} ${isActive ? "ring-2 ring-blue-400" : "hover:scale-105"}`}
                      >
                        {/* Date HAMESHA visible — attendance lagne par bhi kabhi hide nahi hota */}
                        <span className={day.status === 0 ? "text-[10px] text-app" : "text-[9px]"}>
                          {day.day}
                        </span>
                        {sub && <span className="text-[8px]">{sub}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer summary — Edit sirf detail strip me (wahi source of truth) */}
              <div className="pt-2 border-t border-app text-[10px] font-bold">
                <span className="text-muted">
                  Effective: <span className="text-blue-400">{effectiveDays.toFixed(1)} days</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail tooltip — hover (desktop) / tap (mobile), portal → body */}
      {tip && (
        <DayTip
          tip={tip}
          isAdmin={userRole === "admin"}
          onEdit={openEditFromTip}
          onClose={closeTip}
          onEnter={hoverIn}
          onLeave={hoverOut}
        />
      )}

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
            setTip(null);
            setTimeout(() => setRefreshKey((k) => k + 1), 100);
          }}
        />
      )}
    </div>
  );
}
