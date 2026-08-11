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
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Calendar, Save, Check, Clock, X, AlertCircle, RotateCcw,
  LogIn, LogOut, Fingerprint, ArrowRight,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { todayIST, nowISTTime, hoursBetweenIST, fmtTimeIST, deriveStatusFromTimes } from '@/lib/dateUtils';
import { verifyAttendanceLocation, geoErrorMessage } from '@/lib/geofence';

interface Mechanic {
  id: number;
  name: string;
  designation: string;
}

// 0 = not yet marked, 1 = present, 2 = absent, 3 = half day
interface AttendanceStatus { [mechanicId: number]: 0 | 1 | 2 | 3; }
interface DayTimes { timeIn: string; timeOut: string; }
interface SelfAttn { status: number; time_in: string | null; time_out: string | null; }

const STATUS_BTNS = [
  { value: 1 as const, label: 'Present',  short: 'P', activeClass: 'bg-emerald-500 text-white border-emerald-500',  hoverClass: 'hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/40' },
  { value: 3 as const, label: 'Half Day', short: 'H', activeClass: 'bg-amber-500 text-white border-amber-500',    hoverClass: 'hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/40' },
  { value: 2 as const, label: 'Absent',   short: 'A', activeClass: 'bg-red-500 text-white border-red-500',        hoverClass: 'hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40' },
] as const;

const STATUS_BADGE: Record<number, { label: string; cls: string }> = {
  0: { label: 'Not Marked', cls: 'bg-slate-700/60 text-slate-400 border border-slate-600/40' },
  1: { label: 'Present',    cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  2: { label: 'Absent',     cls: 'bg-red-500/15 text-red-400 border border-red-500/30' },
  3: { label: 'Half Day',   cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
};

export default function DailyAttendance({
  userRole, mechanicId,
}: { userRole: 'admin' | 'staff'; mechanicId: number | null }) {
  const searchParams = useSearchParams();
  const today = todayIST();

  const [selectedDate, setSelectedDate] = useState(
    userRole === 'admin' ? (searchParams.get('date') || today) : today
  );
  const [mechanics,  setMechanics]  = useState<Mechanic[]>([]);
  const [attendance, setAttendance] = useState<AttendanceStatus>({});
  const [times,      setTimes]      = useState<Record<number, DayTimes>>({});
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [isMobile,   setIsMobile]   = useState(false);
  const [saveMsg,    setSaveMsg]    = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── Self check-in / check-out ────────────────────────────────
  const [selfAttn, setSelfAttn] = useState<SelfAttn | null>(null);
  const [selfBusy, setSelfBusy] = useState<'in' | 'out' | null>(null);
  const [selfMsg,  setSelfMsg]  = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const selfName = mechanicId ? mechanics.find(m => m.id === mechanicId)?.name || '' : '';

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Fetch mechanics ──────────────────────────────────────────
  useEffect(() => {
    const fetchMechanics = async () => {
      let query = supabase
        .from('mechanic_list')
        .select('id, firstname, lastname, designation')
        .eq('status', 1);
      if (userRole === 'staff' && mechanicId) query = query.eq('id', mechanicId);
      const { data, error } = await query.order('firstname');
      if (!error && data) {
        setMechanics(data.map(m => ({
          id: m.id,
          name: `${m.firstname} ${m.lastname}`.trim(),
          designation: m.designation || '',
        })));
      }
    };
    fetchMechanics();
  }, [userRole, mechanicId]);

  // ── Fetch attendance for selected date ───────────────────────
  const fetchAttendance = useCallback(async () => {
    if (!mechanics.length) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('attendance_list')
      .select('mechanic_id, status, time_in, time_out')
      .eq('curr_date', selectedDate);
    const attMap: AttendanceStatus = {};
    const timesMap: Record<number, DayTimes> = {};
    if (!error && data) {
      data.forEach(a => {
        attMap[a.mechanic_id] = a.status as 1 | 2 | 3;
        timesMap[a.mechanic_id] = {
          timeIn: (a.time_in as string)?.slice(0, 5) || '',
          timeOut: (a.time_out as string)?.slice(0, 5) || '',
        };
      });
    }
    mechanics.forEach(m => { if (attMap[m.id] == null) attMap[m.id] = 0; });
    setAttendance(attMap);
    setTimes(timesMap);
    setLoading(false);
  }, [mechanics, selectedDate]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  // ── Self record for today ────────────────────────────────────
  const fetchSelf = useCallback(async () => {
    if (!mechanicId) { setSelfAttn(null); return; }
    const { data } = await supabase
      .from('attendance_list')
      .select('status, time_in, time_out')
      .eq('mechanic_id', mechanicId)
      .eq('curr_date', today)
      .maybeSingle();
    setSelfAttn(data || { status: 0, time_in: null, time_out: null });
  }, [mechanicId, today]);

  useEffect(() => { fetchSelf(); }, [fetchSelf]);

  const handleStatusChange = (mId: number, status: 1 | 2 | 3) =>
    setAttendance(prev => ({ ...prev, [mId]: status }));

  const handleTimeChange = (mId: number, field: 'timeIn' | 'timeOut', value: string) =>
    setTimes(prev => ({ ...prev, [mId]: { timeIn: prev[mId]?.timeIn ?? '', timeOut: prev[mId]?.timeOut ?? '', [field]: value } }));

  // ── Self check-in / check-out ────────────────────────────────
  const handleSelfAction = async (action: 'in' | 'out') => {
    if (!mechanicId) return;
    setSelfBusy(action);
    setSelfMsg(null);
    try {
      const now = nowISTTime();
      const { data: existing } = await supabase
        .from('attendance_list')
        .select('id, time_in, time_out')
        .eq('mechanic_id', mechanicId)
        .eq('curr_date', today)
        .maybeSingle();

      if (action === 'in') {
        if (existing?.time_in) {
          setSelfMsg({ type: 'ok', text: `Already checked in at ${fmtTimeIST(existing.time_in)}.` });
          return;
        }
      } else {
        if (!existing?.time_in) {
          setSelfMsg({ type: 'err', text: 'Pehle check-in karein, tabhi check-out hoga.' });
          return;
        }
        if (existing?.time_out) {
          setSelfMsg({ type: 'ok', text: `Already checked out at ${fmtTimeIST(existing.time_out)}.` });
          return;
        }
      }

      // GPS geofence check — only enforced when actually writing a stamp
      const geo = await verifyAttendanceLocation();
      if (!geo.ok) {
        setSelfMsg({ type: 'err', text: geoErrorMessage(geo) });
        return;
      }
      const coords = geo.coords;

      if (action === 'in') {
        const { error } = await supabase
          .from('attendance_list')
          .upsert({
            mechanic_id: mechanicId, curr_date: today, time_in: now, status: 1,
            ...(coords ? { lat_in: coords.lat, lng_in: coords.lng } : {}),
          }, { onConflict: 'mechanic_id,curr_date' });
        if (error) throw error;
        setSelfMsg({ type: 'ok', text: `Checked in at ${fmtTimeIST(now)}. Have a nice day!` });
      } else {
        const derived = deriveStatusFromTimes(existing?.time_in ?? null, now) ?? 1;
        const { error } = await supabase
          .from('attendance_list')
          .upsert({
            mechanic_id: mechanicId, curr_date: today, time_out: now, status: derived,
            ...(coords ? { lat_out: coords.lat, lng_out: coords.lng } : {}),
          }, { onConflict: 'mechanic_id,curr_date' });
        if (error) throw error;
        const hours = hoursBetweenIST(existing?.time_in ?? null, now);
        setSelfMsg({
          type: 'ok',
          text: `Checked out at ${fmtTimeIST(now)}. Working hours: ${hours}${derived === 3 ? ' (Half Day - under 6 hours)' : ''}`,
        });
      }
      await fetchSelf();
      await fetchAttendance();
    } catch (err) {
      setSelfMsg({ type: 'err', text: (err instanceof Error ? err.message : String(err)) || 'Error performing check-in/out.' });
    } finally {
      setSelfBusy(null);
    }
  };

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMsg(null);

    if (selectedDate > today) {
      setSaveMsg({ type: 'err', text: 'Cannot save attendance for a future date.' });
      return;
    }

    setSaving(true);
    try {
      await Promise.all(mechanics.map(async (mech) => {
        // Status 0 (unmarked) → skip. Unmarked ko silently Absent mat karo —
        // sirf explicitly marked (1 Present / 2 Absent / 3 Half Day) save hote hain.
        const s = attendance[mech.id];
        if (s !== 1 && s !== 2 && s !== 3) return;
        let status: number = s;
        const t = times[mech.id];
        let timeIn: string | null = null;
        let timeOut: string | null = null;

        if (userRole === 'admin' && t) {
          timeIn  = t.timeIn  || null;
          timeOut = t.timeOut || null;
          if (timeIn) status = deriveStatusFromTimes(timeIn, timeOut) ?? status;
        }

        const payload: Record<string, unknown> = {
          mechanic_id: mech.id,
          curr_date: selectedDate,
          status,
        };
        if (userRole === 'admin') {
          payload.time_in  = timeIn;
          payload.time_out = timeOut;
        }

        const { data: existing, error: checkErr } = await supabase
          .from('attendance_list')
          .select('id')
          .eq('mechanic_id', mech.id)
          .eq('curr_date', selectedDate)
          .maybeSingle();
        if (checkErr) throw new Error(`Check failed for ${mech.name}: ${checkErr.message}`);

        if (existing) {
          const { error: updErr } = await supabase
            .from('attendance_list')
            .update(payload)
            .eq('id', existing.id);
          if (updErr) throw new Error(`Update failed for ${mech.name}: ${updErr.message}`);
        } else {
          const { error: insErr } = await supabase
            .from('attendance_list')
            .insert(payload);
          if (insErr) throw new Error(`Insert failed for ${mech.name}: ${insErr.message}`);
        }
      }));
      setSaveMsg({ type: 'ok', text: 'Attendance saved successfully!' });
    } catch (err) {
      setSaveMsg({ type: 'err', text: (err instanceof Error ? err.message : String(err)) || 'Error saving attendance.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-16 text-slate-500 text-sm">Loading...</div>
  );

  const presentCount = Object.values(attendance).filter(s => s === 1).length;
  const halfdayCount = Object.values(attendance).filter(s => s === 3).length;
  const absentCount  = Object.values(attendance).filter(s => s === 2).length;
  const totalStaff   = mechanics.length;
  const unmarkedCount = mechanics.filter(m => attendance[m.id] === 0).length;

  const selfStatus = selfAttn || { status: 0, time_in: null, time_out: null };
  const selfBadge = STATUS_BADGE[selfStatus.status] ?? STATUS_BADGE[0];

  const timeInputCls =
    "w-full px-2 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-lg text-white text-xs font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all text-center";

  return (
    <form onSubmit={handleSubmit}>

      {/* ── Self Check-In / Check-Out Card ── */}
      {selfName && (
        <div className="mb-6 rounded-2xl overflow-hidden bg-gradient-to-r from-[#001f3f] to-[#003d7a] border border-[#1a3a5f] shadow-lg">
          <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center font-black text-white text-lg flex-shrink-0">
                {selfName.charAt(0)}
              </div>
              <div className="min-w-0">
                <h6 className="text-white font-extrabold text-sm flex items-center gap-1.5">
                  <Fingerprint size={13} className="opacity-70" />
                  {selfName}
                </h6>
                <p className="text-white/60 text-[11px] mb-1">
                  {new Date(`${today}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${selfBadge.cls}`}>
                  {selfBadge.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-center min-w-[84px]">
                <span className="block text-[9px] uppercase tracking-wider text-white/70 font-bold"><LogIn size={9} className="inline mr-0.5" /> In</span>
                <span className="block text-white font-extrabold text-sm">{fmtTimeIST(selfStatus.time_in)}</span>
              </div>
              <ArrowRight size={14} className="text-white/40" />
              <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-center min-w-[84px]">
                <span className="block text-[9px] uppercase tracking-wider text-white/70 font-bold"><LogOut size={9} className="inline mr-0.5" /> Out</span>
                <span className="block text-white font-extrabold text-sm">{fmtTimeIST(selfStatus.time_out)}</span>
              </div>
              <div className="bg-emerald-600 rounded-xl px-3 py-2 text-center min-w-[78px]">
                <span className="block text-white font-extrabold text-sm">{hoursBetweenIST(selfStatus.time_in, selfStatus.time_out)}</span>
                <span className="block text-[9px] uppercase tracking-wider text-white/85 font-bold">Hours</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSelfAction('in')}
                disabled={!!selfStatus.time_in || selfBusy !== null}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[#001f3f] hover:bg-white/90 text-xs font-extrabold transition-all disabled:opacity-40"
              >
                <LogIn size={13} />
                Check In
              </button>
              <button
                type="button"
                onClick={() => handleSelfAction('out')}
                disabled={!selfStatus.time_in || !!selfStatus.time_out || selfBusy !== null}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#f44336] hover:bg-[#ff5252] text-white text-xs font-extrabold transition-all disabled:opacity-40"
              >
                <LogOut size={13} />
                Check Out
              </button>
            </div>
          </div>

          {selfMsg && (
            <div className={`mx-5 mb-3 px-3 py-2 rounded-lg text-xs font-bold border ${
              selfMsg.type === 'ok'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/15 border-red-500/30 text-red-300'
            }`}>
              {selfMsg.text}
            </div>
          )}

          {selfBusy && (
            <div className="mx-5 mb-3 text-white/60 text-xs font-bold">
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin align-middle mr-1.5" />
              Processing...
            </div>
          )}
        </div>
      )}

      {/* ── Date picker (admin only) ── */}
      {userRole === 'admin' && (
        <div className="mb-5 flex items-center justify-center gap-3 flex-wrap">
          <div className="relative w-full max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Calendar size={16} className="text-slate-500" />
            </div>
            <input
              type="date" value={selectedDate} max={today}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0d1117] border border-[#21293d] text-white rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none font-bold text-sm transition-all"
            />
          </div>
          {selectedDate !== today && (
            <button
              type="button"
              onClick={() => setSelectedDate(today)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl text-xs font-bold transition-all"
              title="Reset date to today"
            >
              <RotateCcw size={13} />
              Back to Today
            </button>
          )}

          {/* ── Daily stats pills ── */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-xs font-extrabold">
              <Check size={11} /> {presentCount} <span className="text-emerald-500/60 font-bold text-[10px] uppercase">Present</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 text-xs font-extrabold">
              <Clock size={11} /> {halfdayCount} <span className="text-amber-500/60 font-bold text-[10px] uppercase">Half Day</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/25 text-xs font-extrabold">
              <X size={11} /> {absentCount} <span className="text-red-500/60 font-bold text-[10px] uppercase">Absent</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/25 text-xs font-extrabold">
              <Calendar size={11} /> {totalStaff} <span className="text-blue-500/60 font-bold text-[10px] uppercase">Total</span>
            </span>
          </div>
        </div>
      )}

      {userRole === 'staff' && (
        <div className="mb-5 text-center text-sm text-slate-400 font-bold">
          {new Date(`${selectedDate}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      )}

      {/* ── Save message ── */}
      {saveMsg && (
        <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border ${
          saveMsg.type === 'ok'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          <AlertCircle size={15} />
          {saveMsg.text}
        </div>
      )}

      {/* ── Unmarked warning (admin) ── */}
      {userRole === 'admin' && unmarkedCount > 0 && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <AlertCircle size={13} />
          {unmarkedCount} mechanic{unmarkedCount > 1 ? 's' : ''} not yet marked — will default to <strong className="ml-1">Absent</strong> on save.
        </div>
      )}

      {/* ── Desktop Table ── */}
      {!isMobile && (
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#111520] border-b border-[#21293d]">
                <th className="px-6 py-4 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Staff Member</th>
                <th className="px-4 py-4 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  {userRole === 'admin' ? 'Mark Status' : 'Attendance Status'}
                </th>
                <th className="px-4 py-4 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-500">In</th>
                <th className="px-4 py-4 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Out</th>
                <th className="px-4 py-4 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21293d]">
              {mechanics.map(mech => {
                const st = attendance[mech.id];
                const t = times[mech.id];
                const tIn = t?.timeIn ?? '';
                const tOut = t?.timeOut ?? '';
                return (
                  <tr key={mech.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/15 border border-blue-500/20 rounded-full flex items-center justify-center font-black text-blue-400 text-sm">
                          {mech.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-200 text-sm">{mech.name}</div>
                          <div className="text-xs text-slate-600">{mech.designation}</div>
                        </div>
                        {userRole === 'admin' && st === 0 && (
                          <span className="ml-2 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-500 border border-slate-600/30">
                            Unmarked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {userRole === 'admin' ? (
                        <div className="flex justify-center gap-1.5">
                          {STATUS_BTNS.map(btn => (
                            <button
                              key={btn.value}
                              type="button"
                              onClick={() => handleStatusChange(mech.id, btn.value)}
                              className={`px-3.5 py-1.5 rounded-full text-[10px] font-extrabold uppercase transition-all border ${
                                st === btn.value
                                  ? btn.activeClass
                                  : `bg-transparent text-slate-500 border-[#21293d] ${btn.hoverClass}`
                              }`}
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-full ${STATUS_BADGE[st]?.cls ?? STATUS_BADGE[0].cls}`}>
                          {STATUS_BADGE[st]?.label ?? 'Not Marked'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {userRole === 'admin' ? (
                        <input
                          type="time"
                          value={tIn}
                          onChange={e => handleTimeChange(mech.id, 'timeIn', e.target.value)}
                          className={timeInputCls}
                        />
                      ) : (
                        <span className="inline-block text-[11px] font-black px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400">{fmtTimeIST(tIn) || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {userRole === 'admin' ? (
                        <input
                          type="time"
                          value={tOut}
                          onChange={e => handleTimeChange(mech.id, 'timeOut', e.target.value)}
                          className={timeInputCls}
                        />
                      ) : (
                        <span className="inline-block text-[11px] font-black px-2.5 py-1 rounded-md bg-red-500/10 text-red-400">{fmtTimeIST(tOut) || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block text-[11px] font-black px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400">
                        {hoursBetweenIST(tIn, tOut)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Mobile Cards ── */}
      {isMobile && (
        <div className="space-y-3 pb-28">
          {mechanics.map(mech => {
            const st = attendance[mech.id];
            const t = times[mech.id];
            const tIn = t?.timeIn ?? '';
            const tOut = t?.timeOut ?? '';
            return (
              <div key={mech.id} className="bg-[#161b27] border border-[#21293d] p-4 rounded-2xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-500/15 border border-blue-500/20 rounded-full flex items-center justify-center font-black text-blue-400 text-sm">
                    {mech.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-200 text-sm truncate">{mech.name}</div>
                    <div className="text-xs text-slate-600">{mech.designation}</div>
                  </div>
                  {userRole === 'admin' && st === 0 && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-500 border border-slate-600/30 flex-shrink-0">
                      Unmarked
                    </span>
                  )}
                </div>

                {userRole === 'staff' && (
                  <div className="flex items-center justify-center gap-2 mb-3 text-xs font-black">
                    <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-full ${STATUS_BADGE[st]?.cls ?? STATUS_BADGE[0].cls}`}>
                      {STATUS_BADGE[st]?.label ?? 'Not Marked'}
                    </span>
                    <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md"><LogIn size={10} className="inline mr-0.5" />{fmtTimeIST(tIn) || '—'}</span>
                    <span className="text-[11px] text-red-400 bg-red-500/10 px-2 py-1 rounded-md"><LogOut size={10} className="inline mr-0.5" />{fmtTimeIST(tOut) || '—'}</span>
                    <span className="text-[11px] text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md">{hoursBetweenIST(tIn, tOut)}</span>
                  </div>
                )}

                {userRole === 'admin' && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-black mb-1">In</label>
                      <input type="time" value={tIn} onChange={e => handleTimeChange(mech.id, 'timeIn', e.target.value)} className={timeInputCls} />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-black mb-1">Out</label>
                      <input type="time" value={tOut} onChange={e => handleTimeChange(mech.id, 'timeOut', e.target.value)} className={timeInputCls} />
                    </div>
                  </div>
                )}

                {userRole === 'admin' ? (
                  <div className="grid grid-cols-3 gap-2">
                    {STATUS_BTNS.map(btn => (
                      <button
                        key={btn.value}
                        type="button"
                        onClick={() => handleStatusChange(mech.id, btn.value)}
                        className={`py-2.5 rounded-xl text-[10px] font-extrabold uppercase border transition-all ${
                          st === btn.value
                            ? btn.activeClass
                            : `bg-transparent text-slate-500 border-[#21293d] ${btn.hoverClass}`
                        }`}
                      >
                        {btn.short === 'P' && <Check size={12} className="inline mr-0.5" />}
                        {btn.short === 'H' && <Clock size={12} className="inline mr-0.5" />}
                        {btn.short === 'A' && <X size={12} className="inline mr-0.5" />}
                        {btn.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-[11px] font-bold text-slate-500">
                    Working Hours: <span className="text-blue-400">{hoursBetweenIST(tIn, tOut)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Submit buttons (admin only) ── */}
      {userRole === 'admin' && !isMobile && (
        <div className="mt-6 text-center">
          <button
            type="submit" disabled={saving}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-full font-extrabold uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
          >
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        </div>
      )}

      {userRole === 'admin' && isMobile && (
        <button
          type="submit" disabled={saving}
          className="fixed bottom-24 right-5 w-14 h-14 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-full shadow-2xl shadow-blue-500/30 flex items-center justify-center text-white border-2 border-[#0d1117] z-50 transition-all active:scale-95"
        >
          {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={22} />}
        </button>
      )}
    </form>
  );
}
