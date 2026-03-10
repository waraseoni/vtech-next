"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Check, Clock, UserX } from 'lucide-react';

interface Props {
  mechanicId: number;
  mechanicName: string;
  date: string;
  onClose: () => void;
  onUpdate: () => void;
}

const STATUS_OPTIONS = [
  { value: 1 as const, label: 'Present',  icon: Check,  cls: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20' },
  { value: 3 as const, label: 'Half Day', icon: Clock,  cls: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20' },
  { value: 2 as const, label: 'Absent',   icon: UserX,  cls: 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20' },
];

export default function AttendanceModal({ mechanicId, mechanicName, date, onClose, onUpdate }: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSetStatus = async (status: 1 | 2 | 3) => {
    setLoading(true);
    setError(null);
    const { error: err } = await supabase
      .from('attendance_list')
      .upsert(
        { mechanic_id: mechanicId, curr_date: date, status },
        { onConflict: 'mechanic_id,curr_date' }
      );
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      onUpdate();
    }
  };

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
          <div className="text-center mb-5">
            <div className="w-12 h-12 bg-blue-500/15 border border-blue-500/20 rounded-full flex items-center justify-center font-black text-blue-400 text-lg mx-auto mb-2">
              {mechanicName.charAt(0)}
            </div>
            <p className="font-bold text-slate-200">{mechanicName}</p>
            <p className="text-xs text-slate-500 mt-0.5">{fmtDate}</p>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSetStatus(opt.value)}
                disabled={loading}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-extrabold text-sm shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${opt.cls}`}
              >
                <opt.icon size={16} />
                {opt.label}
              </button>
            ))}

            <button
              onClick={onClose}
              className="py-3 bg-[#21293d] hover:bg-[#2a3550] text-slate-300 font-bold rounded-xl text-sm transition-all mt-1"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}