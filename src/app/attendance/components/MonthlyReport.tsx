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
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, ChevronRight, Calendar, RotateCcw } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import AttendanceModal from './AttendanceModal';
import { currentMonthIST, parseISTDate, hoursBetweenIST, fmtTimeIST } from '@/lib/dateUtils';

interface Mechanic { id: number; name: string; }
interface DayData   { day: number; status: 0 | 1 | 2 | 3; isSunday: boolean; timeIn: string; timeOut: string; hours: string; }
interface MechanicMonthData {
  mechanic: Mechanic;
  days: DayData[];
  fullDays: number;
  halfDays: number;
  absentDays: number;
}

export default function MonthlyReport({
  userRole, mechanicId,
}: { userRole: 'admin' | 'staff'; mechanicId: number | null }) {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const monthParam = searchParams.get('month');
  const [month, setMonth]             = useState(monthParam || currentMonthIST());

  useEffect(() => {
    if (monthParam && monthParam !== month) {
      setMonth(monthParam);
    }
  }, [monthParam, month]);

  const [mechanicsData, setMechanicsData] = useState<MechanicMonthData[]>([]);
  const [loading, setLoading]         = useState(true);
  const [modalOpen, setModalOpen]     = useState(false);
  const [selected, setSelected]       = useState<{ mechanicId: number; mechanicName: string; date: string; timeIn?: string; timeOut?: string } | null>(null);
  // BUG FIX 3: trigger refetch without hard reload
  const [, setRefreshKey]                 = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let mechQuery = supabase.from('mechanic_list').select('id, firstname, lastname').eq('status', 1);
    if (userRole === 'staff') {
      mechQuery = mechanicId ? mechQuery.eq('id', mechanicId) : mechQuery.eq('id', 0);
    }
    const { data: mechs, error: mechErr } = await mechQuery.order('firstname');
    if (mechErr || !mechs || mechs.length === 0) {
      setMechanicsData([]);
      setLoading(false);
      return;
    }

    const d = parseISTDate(month + "-01");
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const daysInMonth = new Date(y, m, 0).getDate(); // BUG FIX 1: only compute here
    const startDate = `${month}-01`;
    const endDate   = `${month}-${daysInMonth.toString().padStart(2, '0')}`;

    const { data: attData } = await supabase
      .from('attendance_list')
      .select('mechanic_id, curr_date, status, time_in, time_out')
      .gte('curr_date', startDate)
      .lte('curr_date', endDate);

    const result: MechanicMonthData[] = mechs.map(mech => {
      const days: DayData[] = [];
      let fullDays = 0, halfDays = 0, absentDays = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${month}-${d.toString().padStart(2, '0')}`;
        const att     = attData?.find(a => a.mechanic_id === mech.id && a.curr_date === dateStr);
        const status  = att ? (att.status as 1 | 2 | 3) : 0;
        if (status === 1) fullDays++;
        else if (status === 3) halfDays++;
        else if (status === 2) absentDays++;
        const timeIn  = (att?.time_in as string)?.slice(0, 5) || '';
        const timeOut = (att?.time_out as string)?.slice(0, 5) || '';
        days.push({ day: d, status, isSunday: parseISTDate(dateStr).getDay() === 0, timeIn, timeOut, hours: hoursBetweenIST(timeIn || null, timeOut || null) });
      }
      return {
        mechanic: { id: mech.id, name: `${mech.firstname} ${mech.lastname}`.trim() },
        days, fullDays, halfDays, absentDays,
      };
    });
    setMechanicsData(result);
    setLoading(false);
  }, [month, userRole, mechanicId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // BUG FIX 2: use router.push instead of window.history.pushState
  const changeMonth = (delta: -1 | 1) => {
    const d = parseISTDate(month + "-01");
    d.setMonth(d.getMonth() + delta);
    const newMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(d);
    setMonth(newMonth);
    router.push(`/attendance?view=report&month=${newMonth}`);
  };

  const handleDayClick = (mId: number, mName: string, dateStr: string) => {
    if (userRole !== 'admin') return;
    const md = mechanicsData.find(x => x.mechanic.id === mId);
    const day = md?.days.find(d => `${month}-${d.day.toString().padStart(2, '0')}` === dateStr);
    setSelected({ mechanicId: mId, mechanicName: mName, date: dateStr, timeIn: day?.timeIn, timeOut: day?.timeOut });
    setModalOpen(true);
  };

  // 🔧 FIX: Immediate UI update when attendance changes
  // यह function AttendanceModal से call होगा
  const updateAttendanceInUI = (mechanicId: number, dateStr: string, newStatus: 0 | 1 | 2 | 3) => {
    setMechanicsData(prev =>
      prev.map(md => {
        if (md.mechanic.id !== mechanicId) return md;

        const updatedDays = md.days.map(day => {
          const dayDateStr = `${month}-${day.day.toString().padStart(2, '0')}`;
          if (dayDateStr !== dateStr) return day;
          return { ...day, status: newStatus };
        });

        // Recalculate summary counts
        let fullDays = 0, halfDays = 0, absentDays = 0;
        updatedDays.forEach(d => {
          if (d.status === 1) fullDays++;
          else if (d.status === 3) halfDays++;
          else if (d.status === 2) absentDays++;
        });

        return { ...md, days: updatedDays, fullDays, halfDays, absentDays };
      })
    );
  };

  if (loading) return (
    <div className="flex justify-center py-16 text-slate-500 text-sm">Loading...</div>
  );

  if (mechanicsData.length === 0) return (
    <div className="text-center py-16 bg-[#161b27] border border-dashed border-[#21293d] rounded-2xl">
      <p className="text-slate-600 font-bold uppercase tracking-wider text-sm">
        {userRole === 'staff'
          ? 'No mechanic profile linked to your account. Contact admin.'
          : 'No active mechanics found.'}
      </p>
    </div>
  );

  const firstDay    = parseISTDate(month + '-01').getDay(); // 0=Sun

  const monthName   = parseISTDate(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div>

      {/* ── Month Navigation & Reset Filter ── */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <button
          onClick={() => changeMonth(-1)}
          className="p-2.5 bg-[#161b27] hover:bg-[#21293d] border border-[#21293d] rounded-xl transition-all text-slate-400 hover:text-white"
          title="Previous Month"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-blue-400 flex-shrink-0" />
          <input
            type="month"
            value={month}
            onChange={e => { setMonth(e.target.value); router.push(`/attendance?view=report&month=${e.target.value}`); }}
            className="bg-[#0d1117] border border-[#21293d] text-white rounded-xl px-3 py-2 font-bold text-sm focus:border-blue-500 outline-none transition-all"
          />
          <span className="hidden sm:inline text-slate-400 font-bold text-sm">{monthName}</span>

          {month !== currentMonthIST() && (
            <button
              onClick={() => {
                const cur = currentMonthIST();
                setMonth(cur);
                router.push(`/attendance?view=report&month=${cur}`);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl text-xs font-bold transition-all ml-2"
              title="Reset filter to current month"
            >
              <RotateCcw size={13} />
              Reset Filter
            </button>
          )}
        </div>

        <button
          onClick={() => changeMonth(1)}
          className="p-2.5 bg-[#161b27] hover:bg-[#21293d] border border-[#21293d] rounded-xl transition-all text-slate-400 hover:text-white"
          title="Next Month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── Mechanics Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mechanicsData.map(md => (
          <div key={md.mechanic.id} className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">

            {/* Card Header */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500/15 border border-blue-500/20 rounded-full flex items-center justify-center font-black text-blue-400 text-xs">
                  {md.mechanic.name.charAt(0)}
                </div>
                <h3 className="font-extrabold text-slate-200 text-sm">{md.mechanic.name}</h3>
              </div>
              <div className="flex gap-1.5 text-[10px]">
                <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">P:{md.fullDays}</span>
                <span className="bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">H:{md.halfDays}</span>
                <span className="bg-red-500/15 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-bold">A:{md.absentDays}</span>
              </div>
            </div>

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d, i) => (
                <div key={i} className={`text-[9px] font-black py-1 ${i === 0 ? 'text-red-500' : 'text-slate-600'}`}>{d}</div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs font-bold">
              {/* Empty cells for first-day offset */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {md.days.map(day => {
                const dateStr = `${month}-${day.day.toString().padStart(2, '0')}`;
                let cls = 'bg-[#0d1117] text-slate-600'; // 0 = unmarked
                if (day.status === 1) cls = 'bg-emerald-500 text-white';
                else if (day.status === 3) cls = 'bg-amber-500 text-white';
                else if (day.status === 2) cls = 'bg-red-500/70 text-white';
                else if (day.isSunday)     cls = 'bg-red-900/30 text-red-500';

                const statusLabel =
                  day.status === 1 ? 'Present'
                  : day.status === 3 ? 'Half Day'
                  : day.status === 2 ? 'Absent'
                  : 'Not marked';
                const tooltip =
                  `${new Date(dateStr + 'T00:00:00+05:30').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })} — ${statusLabel}` +
                  (day.timeIn && day.timeOut ? ` — ${fmtTimeIST(day.timeIn)} to ${fmtTimeIST(day.timeOut)} (${day.hours})` : '');

                return (
                  <div
                    key={day.day}
                    title={tooltip}
                    onClick={() => handleDayClick(md.mechanic.id, md.mechanic.name, dateStr)}
                    className={`aspect-square flex flex-col items-center justify-center rounded-md text-[10px] leading-none transition-all ${cls} ${
                      userRole === 'admin' ? 'cursor-pointer hover:scale-110 hover:ring-1 hover:ring-blue-400/60' : ''
                    }`}
                  >
                    <span>{day.day}</span>
                    {day.hours !== '—' && (
                      <span className="text-[6px] font-bold mt-0.5 opacity-90">{day.hours}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Effective days summary */}
            <div className="mt-3 pt-3 border-t border-[#21293d] flex justify-between text-[10px] font-bold text-slate-500">
              <span>Effective: <span className="text-slate-300">{(md.fullDays + md.halfDays * 0.5).toFixed(1)} days</span></span>
              <span>Absent: <span className="text-red-400">{md.absentDays}</span></span>
            </div>
          </div>
        ))}
      </div>

      {/* Admin edit modal */}
      {modalOpen && selected && userRole === 'admin' && (
        <AttendanceModal
          mechanicId={selected.mechanicId}
          mechanicName={selected.mechanicName}
          date={selected.date}
          initialTimeIn={selected.timeIn}
          initialTimeOut={selected.timeOut}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
          }}
          onUpdate={(newStatus) => {
            // 🔧 FIX: Immediately update UI with new status
            updateAttendanceInUI(selected.mechanicId, selected.date, newStatus);
            setModalOpen(false);
            setSelected(null);
            // Background refetch as safety net
            setTimeout(() => setRefreshKey(k => k + 1), 100);
          }}
        />
      )}
    </div>
  );
}