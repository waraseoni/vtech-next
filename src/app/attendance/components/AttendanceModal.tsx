"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X } from 'lucide-react';

interface Props {
  mechanicId: number;
  mechanicName: string;
  date: string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function AttendanceModal({ mechanicId, mechanicName, date, onClose, onUpdate }: Props) {
  const [loading, setLoading] = useState(false);

  const handleSetStatus = async (status: 1 | 2 | 3) => {
    setLoading(true);
    const { error } = await supabase
      .from('attendance_list')
      .upsert(
        { mechanic_id: mechanicId, curr_date: date, status },
        { onConflict: 'mechanic_id, curr_date' }
      );
    if (!error) {
      onUpdate();
    } else {
      alert('Error: ' + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-extrabold">Update Attendance</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="text-center mb-4">
          <p className="font-bold">{mechanicName}</p>
          <p className="text-sm text-gray-600">{date}</p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleSetStatus(1)}
            disabled={loading}
            className="py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-xl"
          >
            Present
          </button>
          <button
            onClick={() => handleSetStatus(3)}
            disabled={loading}
            className="py-3 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-xl"
          >
            Half Day
          </button>
          <button
            onClick={() => handleSetStatus(2)}
            disabled={loading}
            className="py-3 bg-red-500 hover:bg-red-600 text-white font-extrabold rounded-xl"
          >
            Absent
          </button>
          <button
            onClick={onClose}
            className="py-3 bg-gray-200 hover:bg-gray-300 font-bold rounded-xl"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}