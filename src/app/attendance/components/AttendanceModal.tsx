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
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Check, Clock, UserX, Save, Eraser, LogIn, LogOut } from 'lucide-react';
import { deriveStatusFromTimes, hoursBetweenIST } from '@/lib/dateUtils';

interface Props {
  mechanicId: number;
  mechanicName: string;
  date: string;
  initialTimeIn?: string;
  initialTimeOut?: string;
  onClose: () => void;
  onUpdate: (newStatus: 0 | 1 | 2 | 3) => void;  // 🔧 FIX: Now receives the new status
}

const STATUS_OPTIONS = [
  { value: 1 as const, label: 'Present',  icon: Check,  cls: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20' },
  { value: 3 as const, label: 'Half Day', icon: Clock,  cls: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20' },
  { value: 2 as const, label: 'Absent',   icon: UserX,  cls: 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20' },
];

const inputCls =
  "w-full px-2.5 py-2 bg-[#0d1117] border border-[#21293d] rounded-lg text-white text-sm font-bold text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all";

export default function AttendanceModal({ mechanicId, mechanicName, date, initialTimeIn, initialTimeOut, onClose, onUpdate }: Props) {
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [timeIn,     setTimeIn]     = useState(initialTimeIn ?? '');
  const [timeOut,    setTimeOut]    = useState(initialTimeOut ?? '');
  const [currentStatus, setCurrentStatus] = useState<0 | 1 | 2 | 3>(0);

  // Load existing record (status may not be passed in)
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('attendance_list')
        .select('status, time_in, time_out')
        .eq('mechanic_id', mechanicId)
        .eq('curr_date', date)
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
      .from('attendance_list')
      .upsert({ mechanic_id: mechanicId, curr_date: date, ...payload }, { onConflict: 'mechanic_id,curr_date' });
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
    if (ok) onUpdate(status);
  };

  const handleSaveTimes = async () => {
    const derived = deriveStatusFromTimes(timeIn || null, timeOut || null);
    // If times given, derive; otherwise keep current status (unmarked = 0, Absent nahi)
    const status: 0 | 1 | 2 | 3 = derived ?? (currentStatus !== 0 ? currentStatus as 1 | 2 | 3 : 0);
    const ok = await upsert({
      time_in:  timeIn  || null,
      time_out: timeOut || null,
      status,
    });
    if (ok) {
      setCurrentStatus(status);
      onUpdate(status);
    }
  };

  const handleClearTimes = async () => {
    const status: 0 | 1 | 2 | 3 = currentStatus !== 0 ? currentStatus as 1 | 2 | 3 : 0;
    setTimeIn('');
    setTimeOut('');
    const ok = await upsert({ time_in: null, time_out: null, status });
    if (ok) {
      setCurrentStatus(status);
      onUpdate(status);
    }
  };

  const hoursPreview = hoursBetweenIST(timeIn || null, timeOut || null);
  const statusLabel = currentStatus === 1 ? 'Present' : currentStatus === 3 ? 'Half Day' : currentStatus === 2 ? 'Absent' : 'Not Marked';

  const fmtDate = new Date(date).toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-sm shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#21293d]">
          <h3 className="font-extrabold text-white text-sm">Update Attendance</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <div className="text-center mb-4">
            <div className="w-12 h-12 bg-blue-500/15 border border-blue-500/20 rounded-full flex items-center justify-center font-black text-blue-400 text-lg mx-auto mb-2">
              {mechanicName.charAt(0)}
            </div>
            <p className="font-bold text-slate-200">{mechanicName}</p>
            <p className="text-xs text-slate-500 mt-0.5">{fmtDate}</p>
            <span className={`inline-block mt-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${
              currentStatus === 1 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : currentStatus === 3 ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              : currentStatus === 2 ? 'bg-red-500/15 text-red-400 border border-red-500/30'
              : 'bg-slate-700/60 text-slate-400 border border-slate-600/40'
            }`}>
              {statusLabel}
            </span>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-6 text-xs font-bold text-slate-500">Loading...</div>
          ) : (
            <>
              {/* ── Time inputs ── */}
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-black mb-1"><LogIn size={9} className="inline mr-0.5" /> Check In</label>
                  <input type="time" value={timeIn} onChange={e => setTimeIn(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-black mb-1"><LogOut size={9} className="inline mr-0.5" /> Check Out</label>
                  <input type="time" value={timeOut} onChange={e => setTimeOut(e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Live hours preview */}
              <div className={`text-center mb-4 ${hoursPreview !== '—' ? '' : 'opacity-0'}`}>
                <span className="inline-block px-4 py-1.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs font-extrabold">
                  Working Hours: {hoursPreview}
                </span>
              </div>

              <button
                onClick={handleSaveTimes}
                disabled={saving}
                className="w-full mb-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#001f3f] hover:bg-[#003366] text-white font-extrabold text-sm shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Save size={15} />
                Save In / Out Times
              </button>
              <p className="text-center text-[9px] text-slate-500 font-bold mb-4">
                Status auto-sets: &lt;6h = Half Day, check-in only = Present
              </p>

              <div className="flex flex-col gap-2">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleSetStatus(opt.value)}
                    disabled={saving}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-extrabold text-sm shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${opt.cls}`}
                  >
                    <opt.icon size={16} />
                    {opt.label}
                  </button>
                ))}

                <button
                  onClick={handleClearTimes}
                  disabled={saving}
                  className="py-2.5 bg-[#21293d] hover:bg-[#2a3550] text-slate-300 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 mt-1 disabled:opacity-50"
                >
                  <Eraser size={13} />
                  Clear Times
                </button>

                <button
                  onClick={onClose}
                  className="py-2.5 bg-transparent hover:bg-white/[0.04] text-slate-500 font-bold rounded-xl text-sm transition-all"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
