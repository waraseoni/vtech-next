"use client";

import { useEffect, useState, useCallback } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import {
  Loader2, Users, Wrench, Clock, IndianRupee, TrendingUp, Calendar,
  ChevronLeft, ChevronRight, Award, AlertCircle,
} from "lucide-react";
import { todayIST, startOfMonthIST, endOfMonthIST, formatIST } from "@/lib/dateUtils";

type TechMetric = {
  id: number;
  name: string;
  designation: string | null;
  daily_salary: number;
  commission_percent: number;
  image_path: string | null;
  jobs_completed: number;
  jobs_revenue: number;
  jobs_commission: number;
  full_days: number;
  half_days: number;
  absent_days: number;
  total_attended: number;
  working_days: number;
  salary_earned: number;
  avg_repair_hours: number | null;
};

const inr = (v: number) => "₹" + (v || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 });
const mechInitials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || name.charAt(0);

export default function TechnicianPerformancePage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<TechMetric[]>([]);
  const [from, setFrom] = useState(startOfMonthIST());
  const [to, setTo] = useState(endOfMonthIST());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_technician_metrics", {
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      setMetrics((data ?? []) as TechMetric[]);
    } catch (e) {
      console.error("Technician metrics error:", e);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const shiftMonth = (dir: number) => {
    const d = new Date(from + "T00:00:00+05:30");
    d.setMonth(d.getMonth() + dir);
    setFrom(startOfMonthIST(d));
    setTo(endOfMonthIST(d));
  };

  // Summary totals
  const totals = metrics.reduce(
    (acc, m) => ({
      jobs: acc.jobs + m.jobs_completed,
      revenue: acc.revenue + m.jobs_revenue,
      commission: acc.commission + m.jobs_commission,
      salary: acc.salary + m.salary_earned,
      fullDays: acc.fullDays + m.full_days,
      halfDays: acc.halfDays + m.half_days,
    }),
    { jobs: 0, revenue: 0, commission: 0, salary: 0, fullDays: 0, halfDays: 0 }
  );

  return (
    <AdminPage title="Technician Performance">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button onClick={() => shiftMonth(-1)}
          className="p-2 bg-[#111520] border border-[#21293d] rounded-lg hover:border-blue-500/30 transition-all">
          <ChevronLeft size={16} className="text-slate-400" />
        </button>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
          <Calendar size={14} className="text-blue-400" />
          {formatIST(from + "T00:00:00+05:30", { month: "long", year: "numeric" })}
        </div>
        <button onClick={() => shiftMonth(1)}
          className="p-2 bg-[#111520] border border-[#21293d] rounded-lg hover:border-blue-500/30 transition-all">
          <ChevronRight size={16} className="text-slate-400" />
        </button>
        <div className="ml-auto flex gap-2">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="text-xs bg-[#111520] border border-[#21293d] rounded-lg px-3 py-1.5 text-slate-300 focus:border-blue-500/50 focus:outline-none" />
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="text-xs bg-[#111520] border border-[#21293d] rounded-lg px-3 py-1.5 text-slate-300 focus:border-blue-500/50 focus:outline-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-blue-400" />
          <span className="ml-3 text-sm text-slate-400">Loading metrics...</span>
        </div>
      ) : metrics.length === 0 ? (
        <div className="text-center py-20 text-slate-500 text-sm">
          <AlertCircle size={24} className="mx-auto mb-3 text-slate-600" />
          Koi mechanic data nahi mila is date range mein.
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { icon: <Wrench size={16} />, label: "Total Jobs", value: totals.jobs, color: "blue" },
              { icon: <IndianRupee size={16} />, label: "Total Revenue", value: inr(totals.revenue), color: "emerald" },
              { icon: <Award size={16} />, label: "Total Commission", value: inr(totals.commission), color: "amber" },
              { icon: <Clock size={16} />, label: "Full Days", value: totals.fullDays, color: "cyan" },
            ].map((card, i) => (
              <div key={i} className="bg-[#111520] border border-[#21293d] rounded-xl p-4">
                <div className={`text-${card.color}-400 mb-2`}>{card.icon}</div>
                <div className="text-lg font-black text-white">{card.value}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Technician Cards */}
          <div className="space-y-3">
            {metrics.map((m) => {
              const attendanceRate = m.working_days > 0
                ? Math.round((m.total_attended / m.working_days) * 100)
                : 0;
              return (
                <div key={m.id} className="bg-[#111520] border border-[#21293d] rounded-xl p-4 hover:border-blue-500/20 transition-all">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    {m.image_path ? (
                      <Image src={m.image_path} alt={m.name} width={40} height={40} unoptimized
                        className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-10 h-10 bg-blue-500/15 border border-blue-500/20 rounded-full flex items-center justify-center font-black text-blue-400 text-xs flex-shrink-0">
                        {mechInitials(m.name)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-black text-white truncate">{m.name}</h3>
                        {m.designation && (
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-500/10 px-2 py-0.5 rounded-full">
                            {m.designation}
                          </span>
                        )}
                      </div>

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        <div>
                          <div className="text-base font-black text-blue-400">{m.jobs_completed}</div>
                          <div className="text-[9px] font-bold text-slate-500 uppercase">Jobs Done</div>
                        </div>
                        <div>
                          <div className="text-base font-black text-emerald-400">{inr(m.jobs_revenue)}</div>
                          <div className="text-[9px] font-bold text-slate-500 uppercase">Revenue</div>
                        </div>
                        <div>
                          <div className="text-base font-black text-amber-400">{inr(m.jobs_commission)}</div>
                          <div className="text-[9px] font-bold text-slate-500 uppercase">Commission</div>
                        </div>
                        <div>
                          <div className="text-base font-black text-cyan-400">
                            {m.avg_repair_hours != null ? `${m.avg_repair_hours}h` : "—"}
                          </div>
                          <div className="text-[9px] font-bold text-slate-500 uppercase">Avg Repair</div>
                        </div>
                      </div>

                      {/* Attendance Bar */}
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1">
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                            {m.working_days > 0 && (
                              <>
                                <div className="h-full bg-emerald-500 transition-all"
                                  style={{ width: `${(m.full_days / m.working_days) * 100}%` }} />
                                <div className="h-full bg-amber-500 transition-all"
                                  style={{ width: `${(m.half_days / m.working_days) * 100}%` }} />
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                          <span className="text-emerald-400">{m.full_days}F</span>
                          {" / "}
                          <span className="text-amber-400">{m.half_days}H</span>
                          {" / "}
                          <span className="text-red-400">{m.absent_days}A</span>
                          {" · "}
                          <span className="text-slate-300">{attendanceRate}%</span>
                        </div>
                      </div>

                      {/* Salary */}
                      {m.salary_earned > 0 && (
                        <div className="mt-2 text-[10px] font-bold text-slate-500">
                          Salary earned: <span className="text-slate-300">{inr(m.salary_earned)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </AdminPage>
  );
}
