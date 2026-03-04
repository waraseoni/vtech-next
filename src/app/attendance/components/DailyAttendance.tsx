"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, Save, Check, Clock, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

interface Mechanic {
  id: number;
  name: string;
  designation: string;
}

interface AttendanceStatus {
  [mechanicId: number]: 0 | 1 | 2 | 3; // 0=unknown,1=present,2=absent,3=halfday
}

export default function DailyAttendance({ userRole, mechanicId }: { userRole: 'admin' | 'staff'; mechanicId: number | null }) {
  const searchParams = useSearchParams();
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(
    userRole === 'admin' ? searchParams.get('date') || today : today
  );
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [attendance, setAttendance] = useState<AttendanceStatus>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Fetch mechanics based on role
  useEffect(() => {
    const fetchMechanics = async () => {
      let query = supabase
        .from('mechanic_list')
        .select('id, firstname, lastname, designation')
        .eq('status', 1); // active only
      if (userRole === 'staff' && mechanicId) {
        query = query.eq('id', mechanicId);
      }
      const { data, error } = await query.order('firstname');
      if (!error && data) {
        const formatted = data.map(m => ({
          id: m.id,
          name: `${m.firstname} ${m.lastname}`.trim(),
          designation: m.designation || '',
        }));
        setMechanics(formatted);
      }
    };
    fetchMechanics();
  }, [userRole, mechanicId]);

  // Fetch attendance for selected date
  useEffect(() => {
    const fetchAttendance = async () => {
      if (!mechanics.length) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('attendance_list')
        .select('mechanic_id, status')
        .eq('curr_date', selectedDate);
      if (!error && data) {
        const attMap: AttendanceStatus = {};
        data.forEach(a => attMap[a.mechanic_id] = a.status as 1|2|3);
        mechanics.forEach(m => {
          if (!attMap[m.id]) attMap[m.id] = 0;
        });
        setAttendance(attMap);
      }
      setLoading(false);
    };
    fetchAttendance();
  }, [mechanics, selectedDate]);

  const handleStatusChange = (mechanicId: number, status: 1 | 2 | 3) => {
    setAttendance(prev => ({ ...prev, [mechanicId]: status }));
  };

  // 🔥 ROBUST HANDLER: manual check + update/insert per mechanic
  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setSaving(true);

  try {
    await Promise.all(mechanics.map(async (mechanic) => {
      const status = attendance[mechanic.id] || 2;

      console.log(`🔍 Checking mechanic ${mechanic.id} for date ${selectedDate}`);
      
      // 1. Check if record exists
      const { data: existing, error: checkError } = await supabase
        .from('attendance_list')
        .select('id')
        .eq('mechanic_id', mechanic.id)
        .eq('curr_date', selectedDate)
        .maybeSingle();

      if (checkError) {
        console.error(`❌ Check error for mechanic ${mechanic.id}:`, checkError);
        throw new Error(`Check failed: ${checkError.message}`);
      }

      console.log(`📦 Existing record:`, existing);

      if (existing) {
        // 2. Update
        console.log(`✏️ Updating mechanic ${mechanic.id} to status ${status}`);
        const { error: updateError } = await supabase
          .from('attendance_list')
          .update({ status })
          .eq('id', existing.id);

        if (updateError) {
          console.error(`❌ Update error for mechanic ${mechanic.id}:`, updateError);
          throw new Error(`Update failed: ${updateError.message}`);
        }
      } else {
        // 3. Insert
        console.log(`➕ Inserting mechanic ${mechanic.id} with status ${status}`);
        const { error: insertError } = await supabase
          .from('attendance_list')
          .insert({ mechanic_id: mechanic.id, curr_date: selectedDate, status });

        if (insertError) {
          console.error(`❌ Insert error for mechanic ${mechanic.id}:`, insertError);
          throw new Error(`Insert failed: ${insertError.message}`);
        }
      }
    }));

    alert('✅ Attendance saved successfully!');
  } catch (err: any) {
    console.error('🔥 Final error:', err);
    alert('❌ Error saving attendance: ' + err.message);
  } finally {
    setSaving(false);
  }
};

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <form onSubmit={handleSubmit}>
      {/* Date picker for admin */}
      {userRole === 'admin' && (
        <div className="mb-6 flex justify-center">
          <div className="relative w-full max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar size={18} className="text-gray-400" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={today}
              className="w-full pl-10 pr-4 py-2 bg-white border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none font-bold text-sm"
            />
          </div>
        </div>
      )}
      {userRole === 'staff' && (
        <div className="mb-4 text-center text-sm text-gray-600">
          <strong>{new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
        </div>
      )}

      {/* Desktop Table */}
      {!isMobile && (
        <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden shadow-md">
          <table className="w-full">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-extrabold uppercase tracking-wider">Staff Name</th>
                <th className="px-6 py-4 text-center text-xs font-extrabold uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mechanics.map((mech) => (
                <tr key={mech.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-black text-blue-700">
                        {mech.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-extrabold">{mech.name}</div>
                        <div className="text-xs text-gray-500">{mech.designation}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(mech.id, 1)}
                        className={`px-4 py-2 rounded-full text-xs font-extrabold uppercase transition-all border-2 ${
                          attendance[mech.id] === 1
                            ? 'bg-emerald-500 text-white border-emerald-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-emerald-50'
                        }`}
                      >
                        Present
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(mech.id, 3)}
                        className={`px-4 py-2 rounded-full text-xs font-extrabold uppercase transition-all border-2 ${
                          attendance[mech.id] === 3
                            ? 'bg-amber-500 text-white border-amber-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-amber-50'
                        }`}
                      >
                        Half Day
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(mech.id, 2)}
                        className={`px-4 py-2 rounded-full text-xs font-extrabold uppercase transition-all border-2 ${
                          attendance[mech.id] === 2
                            ? 'bg-red-500 text-white border-red-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-red-50'
                        }`}
                      >
                        Absent
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile Cards */}
      {isMobile && (
        <div className="space-y-4 pb-20">
          {mechanics.map((mech) => (
            <div key={mech.id} className="bg-white p-4 rounded-2xl border-2 border-gray-300 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-black text-blue-700">
                  {mech.name.charAt(0)}
                </div>
                <div>
                  <div className="font-extrabold">{mech.name}</div>
                  <div className="text-xs text-gray-500">{mech.designation}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleStatusChange(mech.id, 1)}
                  className={`py-3 rounded-xl text-sm font-extrabold uppercase border-2 transition-all ${
                    attendance[mech.id] === 1
                      ? 'bg-emerald-500 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  <Check size={16} className="inline mr-1" /> Present
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(mech.id, 3)}
                  className={`py-3 rounded-xl text-sm font-extrabold uppercase border-2 transition-all ${
                    attendance[mech.id] === 3
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  <Clock size={16} className="inline mr-1" /> Half
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(mech.id, 2)}
                  className={`py-3 rounded-xl text-sm font-extrabold uppercase border-2 transition-all ${
                    attendance[mech.id] === 2
                      ? 'bg-red-500 text-white border-red-600'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  <X size={16} className="inline mr-1" /> Absent
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit Button */}
      <div className="mt-6 text-center">
        {!isMobile && (
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-extrabold uppercase tracking-wider shadow-md disabled:bg-gray-300"
          >
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        )}
        {isMobile && (
          <button
            type="submit"
            disabled={saving}
            className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 rounded-full shadow-lg flex items-center justify-center text-white border-2 border-white z-50"
          >
            <Save size={24} />
          </button>
        )}
      </div>
    </form>
  );
}