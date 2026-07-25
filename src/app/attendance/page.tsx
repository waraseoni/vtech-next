"use client";
// ─────────────────────────────────────────────────────────────────
// BUG FIX: useSearchParams() must be inside a Suspense boundary.
// Moved tab-init + search-param logic into a separate inner component
// wrapped with <Suspense>, so the outer page doesn't crash on build.
// ─────────────────────────────────────────────────────────────────
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, ClipboardCheck, CalendarDays } from 'lucide-react';
import DailyAttendance from './components/DailyAttendance';
import MonthlyReport from './components/MonthlyReport';

// ── Inner component uses useSearchParams safely inside Suspense ──
function AttendanceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const viewParam = searchParams.get('view');
  const activeTab = viewParam === 'report' ? 'report' : 'daily';

  const [userRole, setUserRole]     = useState<'admin' | 'staff'>('staff');
  const [mechanicId, setMechanicId] = useState<number | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: profile } = await supabase
        .from('profiles').select('role, mechanic_id').eq('id', user.id).single();
      if (profile) {
        setUserRole(profile.role);
        setMechanicId(profile.mechanic_id);
      }
      setLoading(false);
    };
    getProfile();
  }, [router]);

  const handleTabChange = (tab: 'daily' | 'report') => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'report') {
      params.set('view', 'report');
      if (!params.has('month')) params.set('month', new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(new Date()));
    } else {
      params.delete('view');
      params.delete('month');
    }
    router.push(`/attendance?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-blue-500" size={36} />
        <p className="text-slate-600 text-xs font-extrabold uppercase tracking-[0.25em]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">

      {/* ── TABS ── */}
      <div className="flex border-b border-[#21293d] mb-6">
        {([
          { key: 'daily',  label: 'Mark Attendance', icon: ClipboardCheck },
          { key: 'report', label: 'Monthly Report',  icon: CalendarDays  },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`flex items-center gap-2 px-5 py-3.5 text-xs font-extrabold uppercase tracking-wider transition-all ${
              activeTab === key
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <Suspense fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      }>
        {activeTab === 'daily'
          ? <DailyAttendance userRole={userRole} mechanicId={mechanicId} />
          : <MonthlyReport   userRole={userRole} mechanicId={mechanicId} />
        }
      </Suspense>
    </div>
  );
}

// ── Page wrapper — Suspense required for useSearchParams ─────────
export default function AttendancePage() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans p-4 md:p-6">
      <Suspense fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" size={40} />
        </div>
      }>
        <AttendanceContent />
      </Suspense>
    </div>
  );
}