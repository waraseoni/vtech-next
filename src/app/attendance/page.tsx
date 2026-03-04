"use client";
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import DailyAttendance from './components/DailyAttendance';
import MonthlyReport from './components/MonthlyReport';

export default function AttendancePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'daily' | 'report'>(
    searchParams.get('view') === 'report' ? 'report' : 'daily'
  );
  const [userRole, setUserRole] = useState<'admin' | 'staff'>('staff');
  const [mechanicId, setMechanicId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, mechanic_id')
        .eq('id', user.id)
        .single();
      if (profile) {
        setUserRole(profile.role);
        setMechanicId(profile.mechanic_id);
      }
      setLoading(false);
    };
    getProfile();
  }, [router]);

  const handleTabChange = (tab: 'daily' | 'report') => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    if (tab === 'report') {
      params.set('view', 'report');
      if (!params.has('month')) {
        params.set('month', new Date().toISOString().slice(0, 7));
      }
    } else {
      params.delete('view');
      params.delete('month');
    }
    router.push(`/attendance?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-2">
            <button
              onClick={() => handleTabChange('daily')}
              className={`px-5 py-3 text-sm font-extrabold uppercase tracking-wider transition-all ${
                activeTab === 'daily'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="fas fa-clipboard-check mr-2"></i> Mark Attendance
            </button>
            <button
              onClick={() => handleTabChange('report')}
              className={`px-5 py-3 text-sm font-extrabold uppercase tracking-wider transition-all ${
                activeTab === 'report'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="fas fa-calendar-alt mr-2"></i> Monthly Report
            </button>
          </nav>
        </div>

        <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin mx-auto" /></div>}>
          {activeTab === 'daily' ? (
            <DailyAttendance userRole={userRole} mechanicId={mechanicId} />
          ) : (
            <MonthlyReport userRole={userRole} mechanicId={mechanicId} />
          )}
        </Suspense>
      </div>
    </div>
  );
}