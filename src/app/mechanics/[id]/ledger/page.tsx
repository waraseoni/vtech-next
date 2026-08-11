"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Loader2, ArrowLeft, ChevronLeft, ChevronRight,
  Printer, Download, CheckCircle,
  Clock, XCircle
} from "lucide-react";

type Mechanic = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  daily_salary: number;
};

import { todayIST, startOfMonthIST, endOfMonthIST, parseISTDate, toISTDatePart } from "@/lib/dateUtils";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

type LedgerEntry = {
  date: string;
  status: string;
  statusClass: string;
  earned: number;
  commission: number;
  advance: number;
  running: number;
};

export default function MechanicLedgerPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [fromDate, setFromDate] = useState(() => startOfMonthIST());
  const [toDate, setToDate] = useState(() => todayIST());

  const [loading, setLoading] = useState(true);
  const [mechanic, setMechanic] = useState<Mechanic | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [totals, setTotals] = useState({ earned: 0, commission: 0, advance: 0 });

  const fetchMechanic = useCallback(async () => {
    const { data, error } = await supabase
      .from("mechanic_list")
      .select("id, firstname, middlename, lastname, daily_salary")
      .eq("id", id)
      .single();
    if (error || !data) {
      router.push("/mechanics");
      return;
    }
    setMechanic(data);
  }, [id, router]);

  const fetchLedger = useCallback(async () => {
    if (!mechanic) return;
    setLoading(true);

    // PHP: per-day rate from mechanic_salary_history (effective_date <= day)
    const { data: salaryHistData } = await supabase
      .from("mechanic_salary_history")
      .select("salary, effective_date")
      .eq("mechanic_id", mechanic.id)
      .order("effective_date", { ascending: false })
      .order("id", { ascending: false });
    const hist = salaryHistData || [];
    const getDailyRate = (dateStr: string) => {
      const h = hist.find(x => x.effective_date <= dateStr);
      return h ? parseFloat(h.salary) : (mechanic.daily_salary || 0);
    };

    // Calculate opening balance (before fromDate) — PHP salary logic:
    // attendance(status 1,3) w/ history rate + commission(status=5, date_completed) - advance(date_paid)
    const d = parseISTDate(fromDate);
    d.setDate(d.getDate() - 1);
    const prevDateStr = toISTDatePart(d);

    const { data: prevAtt } = await supabase
      .from("attendance_list")
      .select("curr_date, status")
      .eq("mechanic_id", mechanic.id)
      .in("status", [1, 3])
      .lte("curr_date", prevDateStr);

    const { data: prevComm } = await supabase
      .from("transaction_list")
      .select("mechanic_commission_amount")
      .eq("mechanic_id", mechanic.id)
      .eq("status", 5)
      .lte("date_completed", `${prevDateStr}T23:59:59+05:30`);

    const { data: prevAdv } = await supabase
      .from("advance_payments")
      .select("amount")
      .eq("mechanic_id", mechanic.id)
      .lte("date_paid", prevDateStr);

    let opening = 0;
    (prevAtt || []).forEach(a => {
      const rate = getDailyRate(a.curr_date);
      opening += a.status === 1 ? rate : rate / 2;
    });
    opening += (prevComm || []).reduce((s: number, c) => s + (c.mechanic_commission_amount || 0), 0);
    opening -= (prevAdv || []).reduce((s: number, a) => s + (a.amount || 0), 0);
    setOpeningBalance(opening);

    // Bulk-fetch the whole range in 3 queries (was N+1: 3 queries × every day ≈ 93 round-trips/month)
    const [periodAtt, periodComm, periodAdv] = await Promise.all([
      supabase.from("attendance_list")
        .select("curr_date, status")
        .eq("mechanic_id", mechanic.id).in("status", [1, 3])
        .gte("curr_date", fromDate).lte("curr_date", toDate),
      supabase.from("transaction_list")
        .select("date_completed, mechanic_commission_amount")
        .eq("mechanic_id", mechanic.id).eq("status", 5)
        .gte("date_completed", `${fromDate}T00:00:00+05:30`)
        .lte("date_completed", `${toDate}T23:59:59+05:30`),
      supabase.from("advance_payments")
        .select("date_paid, amount")
        .eq("mechanic_id", mechanic.id)
        .gte("date_paid", fromDate).lte("date_paid", toDate),
    ]);

    const attMap: Record<string, number> = {};
    (periodAtt.data || []).forEach(a => { attMap[a.curr_date] = a.status; });
    const commMap: Record<string, number> = {};
    (periodComm.data || []).forEach(c => {
      const ds = toISTDatePart(c.date_completed);
      commMap[ds] = (commMap[ds] || 0) + (c.mechanic_commission_amount || 0);
    });
    const advMap: Record<string, number> = {};
    (periodAdv.data || []).forEach(a => {
      advMap[a.date_paid] = (advMap[a.date_paid] || 0) + (a.amount || 0);
    });

    // Generate all dates in range
    const entries: LedgerEntry[] = [];
    let runningBalance = opening;
    let totalEarned = 0, totalCommission = 0, totalAdvance = 0;
    const currentDate = parseISTDate(fromDate);
    const endDate = parseISTDate(toDate);

    while (currentDate <= endDate) {
      const dateStr = toISTDatePart(currentDate);
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayName = dayNames[currentDate.getDay()];

      const attStatus = attMap[dateStr];
      const dailyComm = commMap[dateStr] || 0;
      const dailyAdv = advMap[dateStr] || 0;

      let dailyEarned = 0;
      let status = "Absent";
      let statusClass = "bg-red-500/10 text-red-400";

      if (attStatus === 1) {
        dailyEarned = getDailyRate(dateStr);
        status = "Full Day";
        statusClass = "bg-emerald-500/10 text-emerald-400";
      } else if (attStatus === 3) {
        dailyEarned = getDailyRate(dateStr) / 2;
        status = "Half Day";
        statusClass = "bg-amber-500/10 text-amber-400";
      }

      runningBalance += dailyEarned + dailyComm - dailyAdv;
      totalEarned += dailyEarned;
      totalCommission += dailyComm;
      totalAdvance += dailyAdv;

      entries.push({
        date: `${dateStr} (${dayName})`,
        status,
        statusClass,
        earned: dailyEarned,
        commission: dailyComm,
        advance: dailyAdv,
        running: runningBalance,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    setEntries(entries);
    setClosingBalance(runningBalance);
    setTotals({ earned: totalEarned, commission: totalCommission, advance: totalAdvance });
    setLoading(false);
  }, [mechanic, fromDate, toDate]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch mount effect; setLoading sync init legit hai
  useEffect(() => { fetchMechanic(); }, [fetchMechanic]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch; loading init sync legit hai
  useEffect(() => { if (mechanic) fetchLedger(); }, [mechanic, fetchLedger]);

  const shiftMonth = (dir: -1 | 1) => {
    const cur = parseISTDate(fromDate);
    cur.setMonth(cur.getMonth() + dir);
    setFromDate(startOfMonthIST(cur));
    setToDate(endOfMonthIST(cur));
  };

  const exportExcel = () => {
    if (!mechanic) return;
    const name = [mechanic.firstname, mechanic.middlename, mechanic.lastname].filter(Boolean).join(" ");
    const html = `<table border="1">
      <tr><th colspan="6" style="text-align:center">${name} - Daily Ledger</th></tr>
      <tr><th colspan="6" style="text-align:center">${fromDate} to ${toDate}</th></tr>
      <tr><th>Date</th><th>Status</th><th>Earned</th><th>Commission</th><th>Advance</th><th>Running Balance</th></tr>
      <tr><td colspan="5" style="text-align:right">Opening Balance:</td><td>${inr(openingBalance)}</td></tr>
      ${entries.map(e => `<tr><td>${e.date}</td><td>${e.status}</td><td>${inr(e.earned)}</td><td>${inr(e.commission)}</td><td>${inr(e.advance)}</td><td>${inr(e.running)}</td></tr>`).join("")}
      <tr><td colspan="5" style="text-align:right">Closing Balance:</td><td>${inr(closingBalance)}</td></tr>
    </table>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Ledger_${name.replace(" ", "_")}.xls`;
    a.click();
  };

  const name = mechanic ? [mechanic.firstname, mechanic.middlename, mechanic.lastname].filter(Boolean).join(" ") : "";
  const monthDisplay = new Date(fromDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/mechanics/${id}`}
            className="p-2 rounded-xl bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 transition no-underline">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-lg font-black text-white">Daily Ledger</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition">
            <Download size={13}/> Excel
          </button>
          <button onClick={() => window.open(`/api/print-mechanic-ledger?id=${id}&from=${fromDate}&to=${toDate}`, "_blank")}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition">
            <Printer size={13}/> Print
          </button>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <button onClick={() => shiftMonth(-1)}
            className="p-2 rounded-xl bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 transition">
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500"/>
            <span className="text-slate-600">—</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500"/>
          </div>
          <button onClick={() => shiftMonth(1)}
            className="p-2 rounded-xl bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 transition">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase text-slate-500">Opening Balance</p>
          <p className={`text-lg font-black ${openingBalance >= 0 ? "text-amber-400" : "text-red-400"}`}>{inr(openingBalance)}</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase text-slate-500">Total Earned</p>
          <p className="text-lg font-black text-emerald-400">{inr(totals.earned + totals.commission)}</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase text-slate-500">Total Advance</p>
          <p className="text-lg font-black text-red-400">{inr(totals.advance)}</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase text-slate-500">Closing Balance</p>
          <p className={`text-lg font-black ${closingBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>{inr(closingBalance)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#21293d]">
          <h2 className="text-sm font-bold text-slate-300 text-center">{monthDisplay}</h2>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center">
            <Loader2 size={24} className="animate-spin text-slate-600 mx-auto mb-2"/>
            <p className="text-slate-600 text-xs font-black uppercase">Loading...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Earned Wage</th>
                  <th className="text-right px-4 py-3">Commission</th>
                  <th className="text-right px-4 py-3">Advance/Paid</th>
                  <th className="text-right px-4 py-3">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                <tr className="bg-amber-500/5">
                  <td colSpan={5} className="px-4 py-3 text-right font-bold text-amber-400">Opening Balance:</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-400">{inr(openingBalance)}</td>
                </tr>
                {entries.map((entry, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-300">{entry.date}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${entry.statusClass}`}>
                        {entry.status === "Full Day" ? <CheckCircle size={9}/> : entry.status === "Half Day" ? <Clock size={9}/> : <XCircle size={9}/>}
                        {entry.status}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right ${entry.earned > 0 ? "text-emerald-400" : "text-slate-600"}`}>{inr(entry.earned)}</td>
                    <td className={`px-4 py-3 text-right ${entry.commission > 0 ? "text-blue-400" : "text-slate-600"}`}>{inr(entry.commission)}</td>
                    <td className={`px-4 py-3 text-right ${entry.advance > 0 ? "text-red-400" : "text-slate-600"}`}>{inr(entry.advance)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${entry.running >= 0 ? "text-slate-200" : "text-red-400"}`}>{inr(entry.running)}</td>
                  </tr>
                ))}
                <tr className="bg-[#111520]">
                  <td colSpan={5} className="px-4 py-3 text-right font-black text-slate-400">Closing Balance:</td>
                  <td className={`px-4 py-3 text-right font-black ${closingBalance >= 0 ? "text-emerald-400" : "text-red-400"}`} style={{ fontSize: "1rem" }}>{inr(closingBalance)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
