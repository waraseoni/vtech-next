"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  IndianRupee,
  Layers,
  RotateCcw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { format } from "date-fns/format";
import { fmtMins } from "@/lib/attendance-hours";
import { exportToCSV } from "@/lib/exportUtils";
import { inr } from "@/app/mechanics/components/helpers";
import type { HoursSalaryData, HoursStaffRow } from "@/lib/server-hours-salary";
import type { HoursDayNote } from "@/lib/hours-salary";

const inrShort = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

const NOTE_LABEL: Record<HoursDayNote, string> = {
  full: "Full day",
  auto: "Auto-close",
  short: "Short day",
  overtime: "Extra hours",
  live: "In progress",
  fallback: "No punch → day rate",
  unpaid: "Absent / unpaid",
};

function shiftMonth(month: string, delta: number): string {
  const d = new Date(month + "-01");
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const pct = (c: number) => `${Math.round(c * 100)}%`;
const perMin = (r: number) => (r > 0 ? r.toFixed(4) : "—");
const deltaClass = (d: number) =>
  d > 0 ? "text-emerald-400" : d < 0 ? "text-rose-400" : "text-muted";

const dayDate = (iso: string) => format(new Date(iso + "T00:00:00"), "dd MMM");

export default function HoursSalaryView({ data }: { data: HoursSalaryData }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const monthLabel = format(new Date(data.month + "-01"), "MMMM yyyy");
  const totals = data.totals;

  const globalPunched = data.staff.reduce((s, x) => s + x.summary.punchedDays, 0);
  const globalEligible = data.staff.reduce((s, x) => s + x.summary.eligibleDays, 0);
  const globalCoverage = globalEligible === 0 ? 1 : globalPunched / globalEligible;

  const exportSummary = () =>
    exportToCSV(
      data.staff.map((s) => {
        const last = s.days[s.days.length - 1];
        return {
          Staff: s.name,
          "Daily Salary": s.currentRate,
          "Duty (min)": last?.dutyMin ?? "",
          "Per Min Rate": last?.perMinRate ? last.perMinRate.toFixed(4) : "",
          "Worked (min)": s.summary.workedMin,
          "Punch Days": s.summary.punchedDays,
          "Eligible Days": s.summary.eligibleDays,
          "Punch Coverage": pct(s.summary.coverage),
          "Fallback Days": s.summary.fallbackDays,
          "Hours Earned": s.summary.hoursEarned,
          "Day Earned": s.summary.dayEarned,
          Delta: s.summary.delta,
        };
      }),
      `Salary_Hours_${data.month}`
    );

  const exportDetail = (s: HoursStaffRow) =>
    exportToCSV(
      s.days.map((d) => ({
        Date: d.date,
        In: d.timeIn || "—",
        Out: d.effOut || (d.working ? "working…" : "—"),
        "Duty (min)": d.dutyMin,
        "Worked (min)": d.workedMin,
        "Per Min Rate": d.perMinRate.toFixed(4),
        "Hours Earned": d.hoursEarned,
        "Day Earned": d.dayEarned,
        Note: NOTE_LABEL[d.note],
      })),
      `Salary_Hours_${s.name.replace(/\s+/g, "_")}_${data.month}`
    );

  return (
    <div className="space-y-3.5 w-full max-w-[1550px] mx-auto pb-12 px-2 sm:px-3 lg:px-4">
      {/* Header Card */}
      <div className="bg-panel border border-app rounded-2xl p-3 sm:p-3.5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-sm sm:text-base font-black text-white tracking-tight">
            Salary — Hours Mode
          </h1>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 border border-blue-500/20 text-blue-400">
            {monthLabel}
          </span>
        </div>
        <p className="text-[10px] sm:text-[11px] text-muted font-medium">
          Daily salary ÷ duty hours = per-minute rate · day-wise earned (advisory view — payout
          unchanged)
        </p>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center justify-between gap-1 bg-app p-1 rounded-xl border border-app">
            <Link
              href={`/mechanics/salary/hours?month=${shiftMonth(data.month, -1)}`}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-all"
              title="Previous Month"
            >
              <ChevronLeft size={15} />
            </Link>
            <Link
              href={`/mechanics/salary/hours?month=${shiftMonth(data.month, 1)}`}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-all"
              title="Next Month"
            >
              <ChevronRight size={15} />
            </Link>
          </div>
          <button
            onClick={exportSummary}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-app hover:bg-panel-2 border border-app rounded-xl text-muted hover:text-white transition-all text-xs font-bold"
            title="Export staff summary CSV"
          >
            <Download size={13} />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <Link
            href={`/mechanics/salary?month=${data.month}`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-app hover:bg-panel-2 border border-app rounded-xl text-muted hover:text-white transition-all text-xs font-bold"
            title="Back to Salary Report (day mode)"
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">Day Report</span>
          </Link>
        </div>
      </div>

      {/* Advisory banner */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2 text-[11px] text-amber-300/90 flex items-start gap-2">
        <ShieldCheck size={13} className="flex-shrink-0 mt-px" />
        <span>
          Read-only comparison. Existing day-mode salary &amp; payout untouched. Days without
          punches use day-rate fallback (golden rule). Use as advisory before any mode switch — 1
          month dry-run recommended.
        </span>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
        <div className="bg-panel border border-app rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-muted mb-0.5">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
              Staff Count
            </span>
            <Users size={13} className="text-blue-400" />
          </div>
          <p className="text-base sm:text-lg font-black text-white tracking-tight">
            {data.staff.length}
          </p>
          <p className="text-[9px] text-muted">{globalPunched} punched days</p>
        </div>

        <div className="bg-panel border border-app rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-muted mb-0.5">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
              Hours Earned
            </span>
            <IndianRupee size={13} className="text-indigo-400" />
          </div>
          <p className="text-base sm:text-lg font-black text-app-2 tracking-tight">
            {inrShort(totals.totalHoursEarned)}
          </p>
          <p className="text-[9px] text-muted">By minutes worked</p>
        </div>

        <div className="bg-panel border border-app rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-muted mb-0.5">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
              Day-Mode Earned
            </span>
            <Layers size={13} className="text-slate-400" />
          </div>
          <p className="text-base sm:text-lg font-black text-white tracking-tight">
            {inrShort(totals.totalDayEarned)}
          </p>
          <p className="text-[9px] text-muted">Existing system (unchanged)</p>
        </div>

        <div className="bg-panel border border-app rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-muted mb-0.5">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
              Delta
            </span>
            {totals.delta > 0 ? (
              <TrendingUp size={13} className="text-emerald-400" />
            ) : totals.delta < 0 ? (
              <TrendingDown size={13} className="text-rose-400" />
            ) : (
              <RotateCcw size={13} className="text-muted" />
            )}
          </div>
          <p
            className={`text-base sm:text-lg font-black tracking-tight ${deltaClass(totals.delta)}`}
          >
            {totals.delta > 0 ? "+" : ""}
            {inrShort(totals.delta)}
          </p>
          <p className="text-[9px] text-muted">
            {totals.delta === 0
              ? "Identical"
              : totals.delta > 0
                ? "Hours pays more"
                : "Hours pays less"}
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-panel border border-app rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-muted mb-0.5">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
              Punch Coverage
            </span>
            <ShieldCheck
              size={13}
              className={globalCoverage < 1 ? "text-amber-400" : "text-emerald-400"}
            />
          </div>
          <p className="text-base sm:text-lg font-black text-white tracking-tight">
            {pct(globalCoverage)}
          </p>
          <p className="text-[9px] text-muted">
            {totals.fallbackDays > 0
              ? `${totals.fallbackDays} days → day-rate fallback`
              : "All paid days punched"}
          </p>
        </div>
      </div>

      {/* Month strip + table */}
      <div className="bg-panel border border-app rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-app">
          <div className="flex items-center gap-1.5 text-muted">
            <Calendar size={13} className="text-blue-400" />
            <span className="text-xs font-bold text-white">{monthLabel}</span>
            <span className="text-[10px]">
              · per-staff hours vs day-mode (tap row for day-wise detail)
            </span>
          </div>
        </div>

        {data.staff.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted">No staff found for this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-app text-left">
                  <th className="w-8" />
                  <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted">
                    Staff
                  </th>
                  <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted text-right">
                    Daily ₹
                  </th>
                  <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted text-right">
                    Duty
                  </th>
                  <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted text-right">
                    ₹/min
                  </th>
                  <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted text-right">
                    Worked
                  </th>
                  <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted text-right">
                    Hours Earned
                  </th>
                  <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted text-right">
                    Day Earned
                  </th>
                  <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted text-right">
                    Δ
                  </th>
                  <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted text-right">
                    Punch
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.staff.map((s) => {
                  const last = s.days[s.days.length - 1];
                  const open = expanded === s.id;
                  return (
                    <Fragment key={s.id}>
                      <tr
                        onClick={() => setExpanded(open ? null : s.id)}
                        className="border-b border-app/50 hover:bg-white/[0.02] cursor-pointer transition-colors"
                      >
                        <td className="pl-2 pr-1 text-muted">
                          <ChevronDown
                            size={14}
                            className={`transition-transform ${open ? "" : "-rotate-90"}`}
                          />
                        </td>
                        <td className="px-3 py-2.5 font-bold text-white">{s.name}</td>
                        <td className="px-3 py-2.5 text-right text-app-2">{inr(s.currentRate)}</td>
                        <td className="px-3 py-2.5 text-right text-muted">
                          {last ? fmtMins(last.dutyMin) || "—" : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted">
                          {last ? perMin(last.perMinRate) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted">
                          {fmtMins(s.summary.workedMin) || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-app-2">
                          {inr(s.summary.hoursEarned)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted">
                          {inr(s.summary.dayEarned)}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right font-bold ${deltaClass(s.summary.delta)}`}
                        >
                          {s.summary.delta > 0 ? "+" : ""}
                          {inr(s.summary.delta)}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right ${
                            s.summary.coverage < 1 ? "text-amber-400" : "text-muted"
                          }`}
                          title={`${s.summary.punchedDays}/${s.summary.eligibleDays} paid days punched`}
                        >
                          {pct(s.summary.coverage)}
                          {s.summary.coverage < 1 ? " ⚠" : ""}
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-app/50 bg-app/30">
                          <td colSpan={10} className="px-3 py-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                                Day-wise detail — {s.name}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  exportDetail(s);
                                }}
                                className="flex items-center gap-1 px-2 py-1 bg-panel hover:bg-panel-2 border border-app rounded-lg text-[10px] font-bold text-muted hover:text-white transition-all"
                              >
                                <Download size={11} />
                                Day CSV
                              </button>
                            </div>
                            {s.days.length === 0 ? (
                              <p className="text-[11px] text-muted py-2">
                                No attendance rows this month.
                              </p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-[11px]">
                                  <thead>
                                    <tr className="border-b border-app/50 text-left">
                                      <th className="py-1 pr-2 text-[9px] font-bold uppercase tracking-wider text-muted">
                                        Date
                                      </th>
                                      <th className="py-1 pr-2 text-[9px] font-bold uppercase tracking-wider text-muted">
                                        In–Out
                                      </th>
                                      <th className="py-1 pr-2 text-[9px] font-bold uppercase tracking-wider text-muted text-right">
                                        Duty
                                      </th>
                                      <th className="py-1 pr-2 text-[9px] font-bold uppercase tracking-wider text-muted text-right">
                                        Worked
                                      </th>
                                      <th className="py-1 pr-2 text-[9px] font-bold uppercase tracking-wider text-muted text-right">
                                        ₹/min
                                      </th>
                                      <th className="py-1 pr-2 text-[9px] font-bold uppercase tracking-wider text-muted text-right">
                                        Hours ₹
                                      </th>
                                      <th className="py-1 pr-2 text-[9px] font-bold uppercase tracking-wider text-muted text-right">
                                        Day ₹
                                      </th>
                                      <th className="py-1 text-[9px] font-bold uppercase tracking-wider text-muted">
                                        Note
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {s.days.map((d) => (
                                      <tr key={d.date} className="border-b border-app/30">
                                        <td className="py-1 pr-2 text-white font-bold">
                                          {dayDate(d.date)}
                                        </td>
                                        <td className="py-1 pr-2 text-muted">
                                          {d.timeIn ? `${d.timeIn} – ${d.effOut ?? "…"}` : "—"}
                                        </td>
                                        <td className="py-1 pr-2 text-right text-muted">
                                          {fmtMins(d.dutyMin) || "—"}
                                        </td>
                                        <td className="py-1 pr-2 text-right text-muted">
                                          {fmtMins(d.workedMin) || "—"}
                                        </td>
                                        <td className="py-1 pr-2 text-right text-muted">
                                          {perMin(d.perMinRate)}
                                        </td>
                                        <td className="py-1 pr-2 text-right font-bold text-app-2">
                                          {inr(d.hoursEarned)}
                                        </td>
                                        <td className="py-1 pr-2 text-right text-muted">
                                          {inr(d.dayEarned)}
                                        </td>
                                        <td
                                          className={`py-1 ${
                                            d.note === "fallback"
                                              ? "text-amber-400"
                                              : d.note === "unpaid"
                                                ? "text-rose-400/80"
                                                : d.note === "overtime"
                                                  ? "text-emerald-400"
                                                  : "text-muted"
                                          }`}
                                        >
                                          {NOTE_LABEL[d.note]}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer totals */}
        {data.staff.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 px-3 py-2.5 border-t border-app bg-app/40 text-xs">
            <span className="text-muted">
              Total worked: <b className="text-white">{fmtMins(totals.totalWorkedMin) || "—"}</b>
            </span>
            <span className="text-muted">
              Hours earned: <b className="text-app-2">{inr(totals.totalHoursEarned)}</b>
            </span>
            <span className="text-muted">
              Day earned: <b className="text-white">{inr(totals.totalDayEarned)}</b>
            </span>
            <span className="text-muted">
              Δ:{" "}
              <b className={deltaClass(totals.delta)}>
                {totals.delta > 0 ? "+" : ""}
                {inr(totals.delta)}
              </b>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
