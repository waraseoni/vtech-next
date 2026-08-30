"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase, getCachedUser } from "@/lib/supabase";
import {
  Loader2,
  ClipboardCheck,
  CalendarDays,
  CalendarCheck,
  Clock,
  Sparkles,
} from "lucide-react";
import DailyAttendance from "./components/DailyAttendance";
import MonthlyReport from "./components/MonthlyReport";
import PageLoader from "@/components/PageLoader";

// ── Inner component uses useSearchParams safely inside Suspense ──
function AttendanceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const viewParam = searchParams.get("view");
  const activeTab = viewParam === "report" ? "report" : "daily";

  const [userRole, setUserRole] = useState<"admin" | "staff" | "developer">("staff");
  const [mechanicId, setMechanicId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Live IST Time
  const [liveTime, setLiveTime] = useState("");

  useEffect(() => {
    const updateLiveTime = () => {
      const now = new Date();
      setLiveTime(
        new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(now)
      );
    };
    updateLiveTime();
    const interval = setInterval(updateLiveTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const getProfile = async () => {
      const {
        data: { user },
      } = await getCachedUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, mechanic_id")
        .eq("id", user.id)
        .single();
      if (profile) {
        setUserRole(profile.role);
        setMechanicId(profile.mechanic_id);
      }
      setLoading(false);
    };
    getProfile();
  }, [router]);

  const handleTabChange = (tab: "daily" | "report") => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "report") {
      params.set("view", "report");
      if (!params.has("month"))
        params.set(
          "month",
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
          }).format(new Date())
        );
    } else {
      params.delete("view");
      params.delete("month");
    }
    router.push(`/attendance?${params.toString()}`);
  };

  if (loading) {
    return <PageLoader icon={CalendarCheck} label="loading attendance..." tone="blue" />;
  }

  return (
    <div className="w-full max-w-[1550px] mx-auto space-y-4">
      {/* ── HEADER & TABS CARD ── */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3 sm:p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20 border border-white/10 flex-shrink-0">
            <ClipboardCheck size={20} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                Attendance Hub
              </h1>
              {liveTime && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{liveTime} IST</span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Daily staff check-in/out, GPS geofence punch & monthly attendance register
            </p>
          </div>
        </div>

        {/* Pill Navigation Tabs */}
        <div className="flex bg-[#0d1117] p-1 rounded-xl border border-[#21293d] self-start sm:self-auto">
          {(
            [
              { key: "daily", label: "Mark Attendance", icon: ClipboardCheck },
              { key: "report", label: "Monthly Report", icon: CalendarDays },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
                activeTab === key
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        }
      >
        {activeTab === "daily" ? (
          <DailyAttendance userRole={userRole} mechanicId={mechanicId} />
        ) : (
          <MonthlyReport userRole={userRole} mechanicId={mechanicId} />
        )}
      </Suspense>
    </div>
  );
}

// ── Page wrapper — Suspense required for useSearchParams ─────────
export default function AttendancePage() {
  return (
    <div className="attendance-page min-h-screen bg-[#0d1117] text-white font-sans p-2.5 sm:p-4 lg:p-6">
      <Suspense
        fallback={
          <div className="min-h-[60vh] flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-500" size={40} />
          </div>
        }
      >
        <AttendanceContent />
      </Suspense>
    </div>
  );
}
