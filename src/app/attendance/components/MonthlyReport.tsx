"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import AttendanceModal from './AttendanceModal';

interface Mechanic {
  id: number;
  name: string;
}

interface DayData {
  day: number;
  status: 0 | 1 | 2 | 3;
  isSunday: boolean;
}

interface MechanicMonthData {
  mechanic: Mechanic;
  days: DayData[];
  fullDays: number;
  halfDays: number;
}

export default function MonthlyReport({ userRole, mechanicId }: { userRole: 'admin' | 'staff'; mechanicId: number | null }) {
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(searchParams.get('month') || new Date().toISOString().slice(0, 7));
  const [mechanicsData, setMechanicsData] = useState<MechanicMonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<{ mechanicId: number; mechanicName: string; date: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let mechQuery = supabase
        .from('mechanic_list')
        .select('id, firstname, lastname')
        .eq('status', 1);
      if (userRole === 'staff' && mechanicId) {
        mechQuery = mechQuery.eq('id', mechanicId);
      }
      const { data: mechs, error: mechErr } = await mechQuery.order('firstname');
      if (mechErr || !mechs) return;

      const startDate = `${month}-01`;
      const endDate = `${month}-${new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate()}`;
      const { data: attData } = await supabase
        .from('attendance_list')
        .select('mechanic_id, curr_date, status')
        .gte('curr_date', startDate)
        .lte('curr_date', endDate);

      const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
      const firstDay = new Date(month + '-01').getDay();

      const result: MechanicMonthData[] = mechs.map(mech => {
        const days: DayData[] = [];
        let fullDays = 0, halfDays = 0;

        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${month}-${d.toString().padStart(2, '0')}`;
          const att = attData?.find(a => a.mechanic_id === mech.id && a.curr_date === dateStr);
          const status = att ? (att.status as 1|2|3) : 0;
          if (status === 1) fullDays++;
          else if (status === 3) halfDays++;
          days.push({
            day: d,
            status,
            isSunday: new Date(dateStr).getDay() === 0,
          });
        }
        return {
          mechanic: { id: mech.id, name: `${mech.firstname} ${mech.lastname}`.trim() },
          days,
          fullDays,
          halfDays,
        };
      });

      setMechanicsData(result);
      setLoading(false);
    };
    fetchData();
  }, [month, userRole, mechanicId]);

  const handlePrevMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const newMonth = m === 1 ? `${y-1}-12` : `${y}-${(m-1).toString().padStart(2, '0')}`;
    setMonth(newMonth);
    window.history.pushState(null, '', `/attendance?view=report&month=${newMonth}`);
  };

  const handleNextMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const newMonth = m === 12 ? `${y+1}-01` : `${y}-${(m+1).toString().padStart(2, '0')}`;
    setMonth(newMonth);
    window.history.pushState(null, '', `/attendance?view=report&month=${newMonth}`);
  };

  const handleDayClick = (mechanicId: number, mechanicName: string, dateStr: string) => {
    if (userRole !== 'admin') return;
    setSelected({ mechanicId, mechanicName, date: dateStr });
    setModalOpen(true);
  };

  if (loading) return <div className="text-center py-10">Loading...</div>;

  const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
  const firstDay = new Date(month + '-01').getDay();

  return (
    <div>
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={handlePrevMonth} className="p-2 bg-gray-200 rounded-lg hover:bg-gray-300">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Calendar size={20} className="text-blue-600" />
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border-2 border-gray-300 rounded-lg px-3 py-2 font-bold"
          />
        </div>
        <button onClick={handleNextMonth} className="p-2 bg-gray-200 rounded-lg hover:bg-gray-300">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Mechanics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mechanicsData.map((md) => (
          <div key={md.mechanic.id} className="bg-white border-2 border-gray-300 rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-extrabold text-gray-800">{md.mechanic.name}</h3>
              <div className="text-xs space-x-2">
                <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">P: {md.fullDays}</span>
                <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full">H: {md.halfDays}</span>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-gray-500 py-1">{d}</div>
              ))}

              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square"></div>
              ))}

              {md.days.map((day) => {
                const dateStr = `${month}-${day.day.toString().padStart(2, '0')}`;
                let bgColor = 'bg-gray-100 text-gray-400';
                if (day.status === 1) bgColor = 'bg-emerald-500 text-white';
                else if (day.status === 3) bgColor = 'bg-amber-400 text-white';
                else if (day.status === 2) bgColor = 'bg-red-500 text-white';
                if (day.isSunday && day.status === 0) bgColor = 'bg-red-100 text-red-600';

                return (
                  <div
                    key={day.day}
                    onClick={() => handleDayClick(md.mechanic.id, md.mechanic.name, dateStr)}
                    className={`aspect-square flex items-center justify-center rounded-md cursor-pointer transition-all hover:scale-105 ${bgColor} ${userRole === 'admin' ? 'hover:ring-2 hover:ring-blue-400' : ''}`}
                  >
                    {day.day}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {modalOpen && selected && (
        <AttendanceModal
          mechanicId={selected.mechanicId}
          mechanicName={selected.mechanicName}
          date={selected.date}
          onClose={() => setModalOpen(false)}
          onUpdate={() => {
            setModalOpen(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}