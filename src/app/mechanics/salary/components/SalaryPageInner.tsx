"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchAll } from "@/lib/fetch-all";
import Image from "next/image";
import {
  Loader2,
  Calculator,
  History,
  Calendar,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  CreditCard,
  Edit3,
  Search,
  Printer,
  TrendingUp,
  Users,
  Coins,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns/format";
import { startOfMonth } from "date-fns/startOfMonth";
import { endOfMonth } from "date-fns/endOfMonth";
import { addMonths } from "date-fns/addMonths";
import { subMonths } from "date-fns/subMonths";
import { logActivity } from "@/lib/activity";
import { downloadBlob } from "@/lib/nativePrint";
import type { SalaryRecord, MechanicRow } from "@/lib/server-salary";

const inr = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inrShort = (n: number) =>
  "₹" + Math.round(n || 0).toLocaleString("en-IN");

const mechInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || name.charAt(0);

const MechAvatar = ({
  image,
  name,
  cls = "w-6 h-6 text-[9px]",
}: {
  image?: string | null;
  name: string;
  cls?: string;
}) =>
  image ? (
    <Image
      src={image}
      alt={name}
      width={24}
      height={24}
      className={`${cls} rounded-full object-cover flex-shrink-0 border border-white/10 ring-1 ring-blue-500/20 shadow-sm`}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  ) : (
    <div
      className={`${cls} bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/30 rounded-full flex items-center justify-center font-bold text-blue-400 flex-shrink-0 shadow-inner`}
    >
      {mechInitials(name)}
    </div>
  );

type Props = {
  initialMonth: string;
  initialReportData: SalaryRecord[];
  initialMechanics: MechanicRow[];
};

type FilterStatus = "all" | "payable" | "settled" | "advance";
type SortField = "name" | "present" | "earned" | "commission" | "oldBalance" | "advance" | "netTotal";
type SortDirection = "asc" | "desc";

export default function SalaryPageInner({
  initialMonth,
  initialReportData,
  initialMechanics,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"report" | "master">("report");
  const [loading, setLoading] = useState(false);
  const currentMonthStr = format(new Date(), "yyyy-MM");
  const [month, setMonth] = useState(initialMonth || currentMonthStr);

  const [reportData, setReportData] = useState<SalaryRecord[]>(initialReportData);
  const [mechanics, setMechanics] = useState<MechanicRow[]>(initialMechanics);

  // Sync state if initial props change (e.g. on router.push or SSR change)
  useEffect(() => {
    if (initialMonth) {
      setMonth(initialMonth);
    }
  }, [initialMonth]);

  useEffect(() => {
    setReportData(initialReportData);
  }, [initialReportData]);

  useEffect(() => {
    setMechanics(initialMechanics);
  }, [initialMechanics]);

  // Search, Filter & Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});

  // Rate Modal State
  const [showRateModal, setShowRateModal] = useState(false);
  const [editingMech, setEditingMech] = useState<MechanicRow | null>(null);
  const [newRate, setNewRate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);

  // Payout Modal State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutData, setPayoutData] = useState<SalaryRecord | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutReason, setPayoutReason] = useState("");

  // Notification / Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const toggleCardExpand = (id: number) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "report") {
        const start = format(startOfMonth(new Date(month + "-01")), "yyyy-MM-dd");
        const end = format(endOfMonth(new Date(month + "-01")), "yyyy-MM-dd");
        const prevMonthEnd = format(
          endOfMonth(subMonths(new Date(month + "-01"), 1)),
          "yyyy-MM-dd"
        );

        const { data: mechs } = await supabase
          .from("mechanic_list")
          .select("id, firstname, lastname, daily_salary, image_path, designation")
          .eq("status", 1)
          .eq("delete_flag", 0);
        if (!mechs) return;

        const { data: salaryHist } = await supabase
          .from("mechanic_salary_history")
          .select("*")
          .order("effective_date", { ascending: false })
          .order("id", { ascending: false });

        const getRate = (mid: number, dateStr: string, defaultRate: number) => {
          const hist = (salaryHist || []).find(
            (h: { mechanic_id: number; effective_date: string; salary: string }) =>
              h.mechanic_id === mid && h.effective_date <= dateStr
          );
          return hist ? parseFloat(hist.salary) : defaultRate;
        };

        const [prevAttAll, currAttAll, prevCommAll, currCommAll, prevAdvAll, currAdvAll] =
          await Promise.all([
            fetchAll<{ mechanic_id: number; curr_date: string; status: number }>(
              supabase
                .from("attendance_list")
                .select("mechanic_id, curr_date, status")
                .in("status", [1, 3])
                .lte("curr_date", prevMonthEnd)
            ),
            fetchAll<{ mechanic_id: number; curr_date: string; status: number }>(
              supabase
                .from("attendance_list")
                .select("mechanic_id, curr_date, status")
                .in("status", [1, 3])
                .gte("curr_date", start)
                .lte("curr_date", end)
            ),
            fetchAll<{ mechanic_id: number; mechanic_commission_amount: string }>(
              supabase
                .from("transaction_list")
                .select("mechanic_id, mechanic_commission_amount")
                .eq("status", 5)
                .lte("date_completed", prevMonthEnd + " 23:59:59")
            ),
            fetchAll<{ mechanic_id: number; mechanic_commission_amount: string }>(
              supabase
                .from("transaction_list")
                .select("mechanic_id, mechanic_commission_amount")
                .eq("status", 5)
                .gte("date_completed", start + " 00:00:00")
                .lte("date_completed", end + " 23:59:59")
            ),
            fetchAll<{ mechanic_id: number; amount: string; date_paid: string }>(
              supabase
                .from("advance_payments")
                .select("mechanic_id, amount, date_paid")
                .lte("date_paid", prevMonthEnd)
            ),
            fetchAll<{ mechanic_id: number; amount: string; date_paid: string }>(
              supabase
                .from("advance_payments")
                .select("mechanic_id, amount, date_paid")
                .gte("date_paid", start)
                .lte("date_paid", end)
            ),
          ]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const groupByMech = (rows: any[]) => {
          const map = new Map<number, typeof rows>();
          for (const r of rows) {
            const arr = map.get(r.mechanic_id) || [];
            arr.push(r);
            map.set(r.mechanic_id, arr);
          }
          return map;
        };

        const pAtt = groupByMech(prevAttAll);
        const cAtt = groupByMech(currAttAll);
        const pComm = groupByMech(prevCommAll);
        const cComm = groupByMech(currCommAll);
        const pAdv = groupByMech(prevAdvAll);
        const cAdv = groupByMech(currAdvAll);

        const records: SalaryRecord[] = mechs.map((m) => {
          const mid = m.id;
          const defaultRate = m.daily_salary;

          const prevAttRows = pAtt.get(mid) || [];
          const currAttRows = cAtt.get(mid) || [];
          const prevCommRows = pComm.get(mid) || [];
          const currCommRows = cComm.get(mid) || [];
          const prevAdvRows = pAdv.get(mid) || [];
          const currAdvRows = cAdv.get(mid) || [];

          let earnedPrev = 0;
          prevAttRows.forEach((att) => {
            const rate = getRate(mid, att.curr_date, defaultRate);
            earnedPrev += att.status === 1 ? rate : rate / 2;
          });
          const commPrev = prevCommRows.reduce(
            (s, c) => s + (parseFloat(c.mechanic_commission_amount) || 0),
            0
          );
          const advPrev = prevAdvRows.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
          const oldBalance = earnedPrev + commPrev - advPrev;

          let earnedCurr = 0,
            pCount = 0,
            hdCount = 0;
          currAttRows.forEach((att) => {
            const rate = getRate(mid, att.curr_date, defaultRate);
            if (att.status === 1) {
              pCount++;
              earnedCurr += rate;
            } else {
              hdCount++;
              earnedCurr += rate / 2;
            }
          });
          const commCurr = currCommRows.reduce(
            (s, c) => s + (parseFloat(c.mechanic_commission_amount) || 0),
            0
          );
          const advCurr = currAdvRows.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

          return {
            id: mid,
            name: `${m.firstname} ${m.lastname}`,
            image: m.image_path || null,
            daily_salary: defaultRate,
            present: pCount,
            halfDays: hdCount,
            earnedSalary: earnedCurr,
            commission: commCurr,
            oldBalance,
            advance: advCurr,
            netTotal: oldBalance + earnedCurr + commCurr - advCurr,
          };
        });

        setReportData(records);
      } else {
        const { data: mechs } = await supabase
          .from("mechanic_list")
          .select("*")
          .eq("status", 1)
          .eq("delete_flag", 0)
          .order("firstname");
        const { data: hist } = await supabase
          .from("mechanic_salary_history")
          .select("mechanic_id, date_created")
          .order("id", { ascending: false });

        const formatted = (mechs || []).map((m) => ({
          ...m,
          last_updated: hist?.find((h) => h.mechanic_id === m.id)?.date_created || null,
        }));
        setMechanics(formatted);
      }
    } catch (err) {
      console.error(err);
      showToast("Error loading salary data", "error");
    } finally {
      setLoading(false);
    }
  }, [activeTab, month]);

  const updateSalaryRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMech || !newRate) return;
    setSaving(true);
    try {
      const rate = parseFloat(newRate);
      const { error: upErr } = await supabase
        .from("mechanic_list")
        .update({ daily_salary: rate })
        .eq("id", editingMech.id);
      if (upErr) throw upErr;

      const { error: histErr } = await supabase.from("mechanic_salary_history").insert([
        {
          mechanic_id: editingMech.id,
          salary: rate,
          effective_date: effectiveDate,
        },
      ]);
      if (histErr) throw histErr;

      await logActivity(
        "Updated Salary Rate",
        "Mechanics",
        editingMech.id,
        `Staff: ${editingMech.firstname} ${editingMech.lastname} | Daily wage → ${inr(rate)} | Effective: ${effectiveDate}`
      );
      setShowRateModal(false);
      showToast(`Daily rate for ${editingMech.firstname} updated to ${inr(rate)}`);
      loadData();
    } catch (err) {
      console.error(err);
      showToast("Failed to update salary rate", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutData || !payoutAmount) return;
    setSaving(true);
    try {
      const amt = parseFloat(payoutAmount);
      const { error } = await supabase.from("advance_payments").insert([
        {
          mechanic_id: payoutData.id,
          amount: amt,
          reason: payoutReason || `Salary Payout for ${format(new Date(month + "-01"), "MMMM yyyy")}`,
          date_paid: format(new Date(), "yyyy-MM-dd"),
        },
      ]);
      if (error) throw error;

      await logActivity(
        "Staff Payout",
        "Mechanics",
        payoutData.id,
        `Staff: ${payoutData.name} | Paid: ${inr(amt)}`
      );
      setShowPayoutModal(false);
      showToast(`Payment of ${inr(amt)} processed for ${payoutData.name}`);
      loadData();
    } catch (err) {
      console.error(err);
      showToast("Failed to process payment", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleMonthChange = (newMonth: string) => {
    setMonth(newMonth);
    router.push(`/mechanics/salary?month=${newMonth}`);
  };

  const changeMonth = (offset: number) => {
    const d = new Date(month + "-01");
    const next = offset > 0 ? addMonths(d, 1) : subMonths(d, 1);
    const nextMonth = format(next, "yyyy-MM");
    handleMonthChange(nextMonth);
  };

  const resetToCurrentMonth = () => {
    handleMonthChange(currentMonthStr);
  };

  // Filtered & Sorted Salary Report Data
  const filteredReportData = useMemo(() => {
    let list = [...reportData];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }

    // Status filter
    if (statusFilter === "payable") {
      list = list.filter((r) => r.netTotal > 0);
    } else if (statusFilter === "settled") {
      list = list.filter((r) => r.netTotal === 0);
    } else if (statusFilter === "advance") {
      list = list.filter((r) => r.netTotal < 0);
    }

    // Sort
    list.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      if (sortField === "name") {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
        return sortDir === "asc"
          ? (valA as string).localeCompare(valB as string)
          : (valB as string).localeCompare(valA as string);
      } else if (sortField === "present") {
        valA = a.present + a.halfDays * 0.5;
        valB = b.present + b.halfDays * 0.5;
      } else if (sortField === "earned") {
        valA = a.earnedSalary;
        valB = b.earnedSalary;
      } else if (sortField === "commission") {
        valA = a.commission;
        valB = b.commission;
      } else if (sortField === "oldBalance") {
        valA = a.oldBalance;
        valB = b.oldBalance;
      } else if (sortField === "advance") {
        valA = a.advance;
        valB = b.advance;
      } else if (sortField === "netTotal") {
        valA = a.netTotal;
        valB = b.netTotal;
      }

      return sortDir === "asc"
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    });

    return list;
  }, [reportData, searchQuery, statusFilter, sortField, sortDir]);

  // Filtered Mechanics for Rate Master
  const filteredMechanics = useMemo(() => {
    if (!searchQuery.trim()) return mechanics;
    const q = searchQuery.toLowerCase();
    return mechanics.filter((m) =>
      `${m.firstname} ${m.lastname} ${m.designation || ""}`.toLowerCase().includes(q)
    );
  }, [mechanics, searchQuery]);

  // Overall Statistics for Salary Report
  const stats = useMemo(() => {
    const totalStaff = reportData.length;
    const totalEarned = reportData.reduce((s, r) => s + r.earnedSalary, 0);
    const totalComm = reportData.reduce((s, r) => s + r.commission, 0);
    const totalAdv = reportData.reduce((s, r) => s + r.advance, 0);
    const totalPayable = reportData.reduce((s, r) => s + (r.netTotal > 0 ? r.netTotal : 0), 0);
    const totalOldBal = reportData.reduce((s, r) => s + r.oldBalance, 0);
    const totalPresentDays = reportData.reduce((s, r) => s + r.present, 0);
    const payableCount = reportData.filter((r) => r.netTotal > 0).length;
    const settledCount = reportData.filter((r) => r.netTotal === 0).length;
    const advanceCount = reportData.filter((r) => r.netTotal < 0).length;

    return {
      totalStaff,
      totalEarned,
      totalComm,
      totalAdv,
      totalPayable,
      totalOldBal,
      totalPresentDays,
      payableCount,
      settledCount,
      advanceCount,
    };
  }, [reportData]);

  // Rate Master Stats
  const rateStats = useMemo(() => {
    const count = mechanics.length;
    const totalDaily = mechanics.reduce((s, m) => s + (m.daily_salary || 0), 0);
    const avgRate = count > 0 ? totalDaily / count : 0;
    const maxRate = mechanics.reduce((max, m) => Math.max(max, m.daily_salary || 0), 0);
    const minRate =
      count > 0
        ? mechanics.reduce(
            (min, m) => Math.min(min, m.daily_salary || 0),
            mechanics[0]?.daily_salary || 0
          )
        : 0;

    return { count, avgRate, maxRate, minRate };
  }, [mechanics]);

  // CSV Export Handler
  const exportToCSV = () => {
    const monthFormatted = format(new Date(month + "-01"), "MMMM_yyyy");
    const headers = [
      "Staff Name",
      "Present Days",
      "Half Days",
      "Daily Rate (INR)",
      "Earned Wage (INR)",
      "Commission (INR)",
      "Old Balance (INR)",
      "Advance (INR)",
      "Net Payable (INR)",
    ];

    const rows = filteredReportData.map((r) => [
      `"${r.name}"`,
      r.present,
      r.halfDays,
      r.daily_salary,
      r.earnedSalary.toFixed(2),
      r.commission.toFixed(2),
      r.oldBalance.toFixed(2),
      r.advance.toFixed(2),
      r.netTotal.toFixed(2),
    ]);

    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `Salary_Report_${monthFormatted}.csv`);
    showToast("Salary CSV exported successfully");
  };

  const monthLabel = format(new Date(month + "-01"), "MMMM yyyy");
  const isCurrentMonth = month === currentMonthStr;

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={10} className="opacity-30 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp size={10} className="text-blue-400 ml-1 flex-shrink-0" />
    ) : (
      <ArrowDown size={10} className="text-blue-400 ml-1 flex-shrink-0" />
    );
  };

  return (
    <div className="space-y-3.5 w-full max-w-[1550px] mx-auto pb-12 px-2 sm:px-3 lg:px-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-bold backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-200 ${
            toastMessage.type === "success"
              ? "bg-emerald-950/95 border-emerald-500/40 text-emerald-300"
              : "bg-rose-950/95 border-rose-500/40 text-rose-300"
          }`}
        >
          {toastMessage.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-1 text-white/60 hover:text-white">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3 sm:p-3.5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20 border border-white/10 flex-shrink-0">
            <Calculator size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-black text-white tracking-tight">
                Salary Management
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 border border-blue-500/20 text-blue-400">
                {activeTab === "report" ? monthLabel : "Rate Master"}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
              Attendance wages, job commissions, advance adjustments & net payroll
            </p>
          </div>
        </div>

        {/* Top Controls: Tabs & Refresh */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex bg-[#0d1117] p-1 rounded-xl border border-[#21293d]">
            <button
              onClick={() => {
                setActiveTab("report");
                setSearchQuery("");
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === "report"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers size={12} />
              <span>Report</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                  activeTab === "report" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                {reportData.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab("master");
                setSearchQuery("");
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === "master"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Coins size={12} />
              <span>Rates</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                  activeTab === "master" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                {mechanics.length}
              </span>
            </button>
          </div>

          <button
            onClick={() => loadData()}
            disabled={loading}
            title="Refresh Data"
            className="p-1.5 bg-[#0d1117] hover:bg-[#1a2236] border border-[#21293d] rounded-xl text-slate-400 hover:text-white transition-all disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-blue-400" : ""} />
          </button>
        </div>
      </div>

      {activeTab === "report" ? (
        <>
          {/* ========================================================================= */}
          {/* COMPACT KPI SUMMARY CARDS                                                 */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
            {/* 1. Staff Count */}
            <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-0.5">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Staff Count</span>
                <Users size={13} className="text-blue-400" />
              </div>
              <p className="text-base sm:text-lg font-black text-white tracking-tight">{stats.totalStaff}</p>
              <p className="text-[9px] text-slate-500">{stats.totalPresentDays} present days</p>
            </div>

            {/* 2. Wages Earned */}
            <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-0.5">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Wages Earned</span>
                <IndianRupee size={13} className="text-indigo-400" />
              </div>
              <p className="text-base sm:text-lg font-black text-slate-200 tracking-tight">
                {inrShort(stats.totalEarned)}
              </p>
              <p className="text-[9px] text-slate-500">Fixed attendance</p>
            </div>

            {/* 3. Commissions */}
            <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3 shadow-sm">
              <div className="flex items-center justify-between text-amber-400/90 mb-0.5">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Commissions</span>
                <TrendingUp size={13} className="text-amber-400" />
              </div>
              <p className="text-base sm:text-lg font-black text-amber-300 tracking-tight">
                {inrShort(stats.totalComm)}
              </p>
              <p className="text-[9px] text-slate-500">Job incentives</p>
            </div>

            {/* 4. Advance Deductions */}
            <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3 shadow-sm">
              <div className="flex items-center justify-between text-rose-400/90 mb-0.5">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Advances</span>
                <CreditCard size={13} className="text-rose-400" />
              </div>
              <p className="text-base sm:text-lg font-black text-rose-400 tracking-tight">
                {inrShort(stats.totalAdv)}
              </p>
              <p className="text-[9px] text-slate-500">Deducted this month</p>
            </div>

            {/* 5. Net Payable */}
            <div className="col-span-2 sm:col-span-1 bg-[#161b27] border border-emerald-500/30 rounded-xl p-2.5 sm:p-3 shadow-sm bg-gradient-to-br from-emerald-950/20 to-transparent">
              <div className="flex items-center justify-between text-emerald-400 mb-0.5">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Net Payable</span>
                <Sparkles size={13} className="text-emerald-400" />
              </div>
              <p className="text-base sm:text-lg font-black text-emerald-400 tracking-tight">
                {inrShort(stats.totalPayable)}
              </p>
              <p className="text-[9px] text-emerald-400/70">{stats.payableCount} pending payout</p>
            </div>
          </div>

          {/* Month Selector & Controls Toolbar */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-2.5 sm:p-3 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            {/* Left: Month Switcher & Jump Button */}
            <div className="flex items-center justify-between sm:justify-start gap-1 bg-[#0d1117] p-1 rounded-xl border border-[#21293d]">
              <button
                onClick={() => changeMonth(-1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                title="Previous Month"
              >
                <ChevronLeft size={15} />
              </button>

              <div className="flex items-center gap-1.5 px-2 py-0.5 relative">
                <Calendar size={13} className="text-blue-400 flex-shrink-0" />
                <span className="text-xs font-bold text-white min-w-[100px] text-center">
                  {monthLabel}
                </span>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => {
                    if (e.target.value) handleMonthChange(e.target.value);
                  }}
                  className="w-full h-full opacity-0 absolute inset-0 cursor-pointer [color-scheme:dark]"
                  title="Pick Month"
                />
              </div>

              <button
                onClick={() => changeMonth(1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                title="Next Month"
              >
                <ChevronRight size={15} />
              </button>

              {!isCurrentMonth && (
                <button
                  onClick={resetToCurrentMonth}
                  className="ml-1 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold hover:bg-blue-500 hover:text-white transition-all"
                >
                  This Month
                </button>
              )}
            </div>

            {/* Right: Search, Filter Chips & Export Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search Bar */}
              <div className="relative flex-1 sm:w-48 sm:flex-initial">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search mechanic..."
                  className="w-full pl-7 pr-6 py-1 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-medium text-white placeholder:text-slate-500 outline-none focus:border-blue-500/60 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center bg-[#0d1117] p-0.5 rounded-xl border border-[#21293d] text-xs">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                    statusFilter === "all" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  All ({reportData.length})
                </button>
                <button
                  onClick={() => setStatusFilter("payable")}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                    statusFilter === "payable"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-400 hover:text-emerald-400"
                  }`}
                >
                  Payable ({stats.payableCount})
                </button>
                <button
                  onClick={() => setStatusFilter("settled")}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                    statusFilter === "settled" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Settled ({stats.settledCount})
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                <a
                  href={`/api/print-salary?month=${month}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#0d1117] hover:bg-[#1a2236] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all shadow-sm"
                  title="Print Salary Sheet"
                >
                  <Printer size={12} className="text-blue-400" />
                  <span className="hidden lg:inline text-[11px]">Print</span>
                </a>

                <button
                  onClick={exportToCSV}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#0d1117] hover:bg-[#1a2236] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all shadow-sm"
                  title="Export to CSV"
                >
                  <FileSpreadsheet size={12} className="text-emerald-400" />
                  <span className="hidden lg:inline text-[11px]">CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* DESKTOP (PC) VIEW: ZERO-OVERFLOW FRAME TABLE (100% IN FRAME)              */}
          {/* ========================================================================= */}
          <div className="hidden md:block bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden shadow-lg w-full">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: "3.5%" }} />
                  <col style={{ width: "23.5%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "10%" }} />
                </colgroup>
                <thead>
                  <tr className="bg-[#0d1117] border-b border-[#21293d] text-[10px] font-bold uppercase text-slate-400 tracking-wider select-none">
                    <th className="py-2.5 px-2 text-center">#</th>

                    {/* Staff Member (Sortable) */}
                    <th
                      className="py-2.5 px-2 cursor-pointer group hover:text-white transition-colors"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-0.5 truncate">
                        <span>Staff Member</span>
                        {renderSortIndicator("name")}
                      </div>
                    </th>

                    {/* Attendance (Sortable) */}
                    <th
                      className="py-2.5 px-1.5 text-center cursor-pointer group hover:text-white transition-colors"
                      onClick={() => handleSort("present")}
                    >
                      <div className="flex items-center justify-center gap-0.5 truncate">
                        <span>Attendance</span>
                        {renderSortIndicator("present")}
                      </div>
                    </th>

                    {/* Earned Wage (Sortable) */}
                    <th
                      className="py-2.5 px-2 text-right cursor-pointer group hover:text-white transition-colors"
                      onClick={() => handleSort("earned")}
                    >
                      <div className="flex items-center justify-end gap-0.5 truncate">
                        <span>Earned Wage</span>
                        {renderSortIndicator("earned")}
                      </div>
                    </th>

                    {/* Commission (Sortable) */}
                    <th
                      className="py-2.5 px-2 text-right text-amber-400/90 cursor-pointer group hover:text-amber-300 transition-colors"
                      onClick={() => handleSort("commission")}
                    >
                      <div className="flex items-center justify-end gap-0.5 truncate">
                        <span>Commission</span>
                        {renderSortIndicator("commission")}
                      </div>
                    </th>

                    {/* Old Balance (Sortable) */}
                    <th
                      className="py-2.5 px-1.5 text-right text-slate-400 cursor-pointer group hover:text-slate-200 transition-colors"
                      onClick={() => handleSort("oldBalance")}
                    >
                      <div className="flex items-center justify-end gap-0.5 truncate">
                        <span>Old Bal</span>
                        {renderSortIndicator("oldBalance")}
                      </div>
                    </th>

                    {/* Advance (Sortable) */}
                    <th
                      className="py-2.5 px-1.5 text-right text-rose-400/90 cursor-pointer group hover:text-rose-300 transition-colors"
                      onClick={() => handleSort("advance")}
                    >
                      <div className="flex items-center justify-end gap-0.5 truncate">
                        <span>Advance</span>
                        {renderSortIndicator("advance")}
                      </div>
                    </th>

                    {/* Net Payable (Sortable) */}
                    <th
                      className="py-2.5 px-2 text-right bg-blue-500/[0.03] cursor-pointer group hover:text-white transition-colors"
                      onClick={() => handleSort("netTotal")}
                    >
                      <div className="flex items-center justify-end gap-0.5 truncate">
                        <span className="text-emerald-400">Net Payable</span>
                        {renderSortIndicator("netTotal")}
                      </div>
                    </th>

                    {/* Actions */}
                    <th className="py-2.5 px-1.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]/50">
                  {loading ? (
                    Array(5)
                      .fill(0)
                      .map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={9} className="py-3 px-2">
                            <div className="h-3 bg-slate-800/60 rounded-full w-full"></div>
                          </td>
                        </tr>
                      ))
                  ) : filteredReportData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 px-2 text-center">
                        <div className="max-w-xs mx-auto text-center space-y-1.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                            <Search size={15} />
                          </div>
                          <p className="text-white font-bold text-xs">No records found</p>
                          <p className="text-slate-500 text-[10px]">Try adjusting your search or filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredReportData.map((row, idx) => (
                      <tr
                        key={row.id}
                        className="hover:bg-blue-500/[0.02] transition-colors group"
                      >
                        {/* Index */}
                        <td className="py-2 px-2 text-center text-slate-500 font-bold text-[10px]">
                          {idx + 1}
                        </td>

                        {/* Staff Name & Base Wage (Strictly Single Line) */}
                        <td className="py-2 px-2 overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0">
                            <MechAvatar image={row.image} name={row.name} cls="w-6 h-6 text-[9px]" />
                            <div className="min-w-0 flex items-center gap-1.5 truncate">
                              <Link
                                href={`/mechanics/ledger/${row.id}?month=${month}`}
                                className="text-white font-bold text-xs hover:text-blue-400 transition-colors truncate"
                                title={row.name}
                              >
                                {row.name}
                              </Link>
                              <span className="text-[10px] text-slate-500 font-medium flex-shrink-0">
                                ({inr(row.daily_salary)}/d)
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Attendance Badge */}
                        <td className="py-2 px-1.5 text-center overflow-hidden">
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#0d1117] border border-[#21293d] rounded-lg text-[10px] font-bold">
                            <span className="text-emerald-400 font-bold" title="Present">
                              {row.present}P
                            </span>
                            <span className="text-slate-600 font-light">/</span>
                            <span className="text-amber-400 font-bold" title="Half-day">
                              {row.halfDays}HD
                            </span>
                          </div>
                        </td>

                        {/* Earned Wage */}
                        <td className="py-2 px-2 text-right font-bold text-slate-200 text-xs truncate">
                          {inr(row.earnedSalary)}
                        </td>

                        {/* Commission */}
                        <td className="py-2 px-2 text-right font-bold text-amber-300 text-xs truncate">
                          {row.commission > 0 ? inr(row.commission) : <span className="text-slate-600 font-normal">—</span>}
                        </td>

                        {/* Old Balance */}
                        <td
                          className={`py-2 px-1.5 text-right font-bold text-[10px] truncate ${
                            row.oldBalance > 0
                              ? "text-blue-400"
                              : row.oldBalance < 0
                              ? "text-rose-400"
                              : "text-slate-500 font-normal"
                          }`}
                        >
                          {row.oldBalance !== 0 ? inr(row.oldBalance) : "—"}
                        </td>

                        {/* Advance Deductions */}
                        <td className="py-2 px-1.5 text-right font-bold text-rose-400 text-xs truncate">
                          {row.advance > 0 ? `-${inr(row.advance)}` : <span className="text-slate-600 font-normal">—</span>}
                        </td>

                        {/* Net Payable Badge */}
                        <td className="py-2 px-2 text-right bg-blue-500/[0.02] overflow-hidden">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md font-black text-xs tracking-tight ${
                              row.netTotal > 0
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : row.netTotal < 0
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                                : "bg-slate-800/60 text-slate-400 border border-slate-700/50"
                            }`}
                          >
                            {inr(Math.abs(row.netTotal))}
                            {row.netTotal < 0 && <span className="text-[8px] ml-1 font-bold">Adv</span>}
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-2 px-1.5 text-center overflow-hidden">
                          <div className="flex items-center justify-center gap-1">
                            {row.netTotal > 0 ? (
                              <button
                                onClick={() => {
                                  setPayoutData(row);
                                  setPayoutAmount(row.netTotal.toFixed(0));
                                  setPayoutReason(`Salary for ${format(new Date(month + "-01"), "MMMM yyyy")}`);
                                  setShowPayoutModal(true);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-md text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm"
                              >
                                <CreditCard size={10} /> Pay
                              </button>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                {row.netTotal === 0 ? "Settled" : "Excess"}
                              </span>
                            )}
                            <Link
                              href={`/mechanics/ledger/${row.id}?month=${month}`}
                              className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-all"
                              title="Ledger"
                            >
                              <ExternalLink size={11} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Table Footer Summary Totals */}
                {filteredReportData.length > 0 && !loading && (
                  <tfoot>
                    <tr className="bg-[#0d1117] border-t border-[#21293d] font-bold text-xs">
                      <td colSpan={3} className="py-2 px-2 text-right uppercase tracking-wider text-slate-400 text-[10px]">
                        Total ({filteredReportData.length}):
                      </td>
                      <td className="py-2 px-2 text-right text-slate-200 truncate">
                        {inr(filteredReportData.reduce((s, r) => s + r.earnedSalary, 0))}
                      </td>
                      <td className="py-2 px-2 text-right text-amber-400 truncate">
                        {inr(filteredReportData.reduce((s, r) => s + r.commission, 0))}
                      </td>
                      <td className="py-2 px-1.5 text-right text-slate-300 text-[10px] truncate">
                        {inr(filteredReportData.reduce((s, r) => s + r.oldBalance, 0))}
                      </td>
                      <td className="py-2 px-1.5 text-right text-rose-400 truncate">
                        {inr(filteredReportData.reduce((s, r) => s + r.advance, 0))}
                      </td>
                      <td className="py-2 px-2 text-right text-emerald-400 font-black bg-emerald-950/20 truncate">
                        {inr(
                          filteredReportData.reduce((s, r) => s + (r.netTotal > 0 ? r.netTotal : 0), 0)
                        )}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MOBILE VIEW (Smartphones & Tablets): Interactive Salary Cards              */}
          {/* ========================================================================= */}
          <div className="md:hidden space-y-3">
            {loading ? (
              Array(4)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 animate-pulse space-y-3">
                    <div className="h-5 bg-slate-800/60 rounded-full w-1/2"></div>
                    <div className="h-14 bg-slate-800/40 rounded-xl w-full"></div>
                  </div>
                ))
            ) : filteredReportData.length === 0 ? (
              <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-8 text-center space-y-2">
                <Search size={20} className="text-slate-500 mx-auto" />
                <p className="text-white font-bold text-xs">No records found</p>
                <p className="text-slate-500 text-[11px]">Try adjusting your search or filters.</p>
              </div>
            ) : (
              filteredReportData.map((row) => {
                const isExpanded = !!expandedCards[row.id];
                return (
                  <div
                    key={row.id}
                    className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3.5 shadow-md space-y-3 hover:border-slate-600 transition-all"
                  >
                    {/* Top Row: Avatar, Name & Net Payable */}
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MechAvatar image={row.image} name={row.name} cls="w-9 h-9 text-xs" />
                        <div className="min-w-0">
                          <Link
                            href={`/mechanics/ledger/${row.id}?month=${month}`}
                            className="text-white font-black text-sm hover:text-blue-400 transition-colors truncate block"
                          >
                            {row.name}
                          </Link>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Daily: {inr(row.daily_salary)}
                          </p>
                        </div>
                      </div>

                      {/* Net Payable Pill */}
                      <div className="text-right flex-shrink-0">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg font-black text-xs ${
                            row.netTotal > 0
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : row.netTotal < 0
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {inr(Math.abs(row.netTotal))}
                        </span>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                          {row.netTotal > 0 ? "Payable" : row.netTotal < 0 ? "Advance" : "Settled"}
                        </p>
                      </div>
                    </div>

                    {/* 2x2 Quick Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 bg-[#0d1117] p-2.5 rounded-xl border border-[#21293d]/80 text-xs">
                      {/* Attendance */}
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          Attendance
                        </span>
                        <p className="font-black text-white text-xs">
                          <span className="text-emerald-400">{row.present}P</span>
                          <span className="text-slate-600 mx-1">|</span>
                          <span className="text-amber-400">{row.halfDays}HD</span>
                        </p>
                      </div>

                      {/* Earned Wage */}
                      <div className="space-y-0.5 text-right">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          Earned Wage
                        </span>
                        <p className="font-black text-slate-200 text-xs">{inr(row.earnedSalary)}</p>
                      </div>

                      {/* Commission */}
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-bold text-amber-400/90 uppercase tracking-wider">
                          Commission
                        </span>
                        <p className="font-black text-amber-300 text-xs">
                          {row.commission > 0 ? inr(row.commission) : "₹0.00"}
                        </p>
                      </div>

                      {/* Advance */}
                      <div className="space-y-0.5 text-right">
                        <span className="text-[9px] font-bold text-rose-400/90 uppercase tracking-wider">
                          Advance Deduct
                        </span>
                        <p className="font-black text-rose-400 text-xs">
                          {row.advance > 0 ? `-${inr(row.advance)}` : "₹0.00"}
                        </p>
                      </div>
                    </div>

                    {/* Expandable Breakdown Drawer */}
                    {isExpanded && (
                      <div className="bg-[#0d1117]/60 p-3 rounded-xl border border-[#21293d] space-y-1.5 text-xs animate-in fade-in duration-200">
                        <div className="flex justify-between items-center text-slate-400">
                          <span>Previous Balance:</span>
                          <span
                            className={`font-bold ${
                              row.oldBalance >= 0 ? "text-blue-400" : "text-rose-400"
                            }`}
                          >
                            {inr(row.oldBalance)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400">
                          <span>Calculation:</span>
                          <span className="font-mono text-[10px] text-slate-500">
                            (Old + Wage + Comm) - Adv
                          </span>
                        </div>
                        <div className="pt-1.5 border-t border-[#21293d] flex justify-between items-center font-bold text-white">
                          <span>Final Balance:</span>
                          <span
                            className={row.netTotal >= 0 ? "text-emerald-400" : "text-rose-400"}
                          >
                            {inr(row.netTotal)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Card Actions Footer */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        onClick={() => toggleCardExpand(row.id)}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-2 bg-[#0d1117] hover:bg-[#1a2133] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all active:scale-95"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp size={13} /> Less
                          </>
                        ) : (
                          <>
                            <ChevronDown size={13} /> Details
                          </>
                        )}
                      </button>

                      <Link
                        href={`/mechanics/ledger/${row.id}?month=${month}`}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-xl text-xs font-bold text-blue-400 transition-all active:scale-95"
                      >
                        <FileSpreadsheet size={12} /> Ledger
                      </Link>

                      {row.netTotal > 0 && (
                        <button
                          onClick={() => {
                            setPayoutData(row);
                            setPayoutAmount(row.netTotal.toFixed(0));
                            setPayoutReason(`Salary for ${format(new Date(month + "-01"), "MMMM yyyy")}`);
                            setShowPayoutModal(true);
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm"
                        >
                          <CreditCard size={12} /> Pay
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        /* ========================================================================= */
        /* RATE MASTER TAB: Manage Mechanic Base Daily Wages                         */
        /* ========================================================================= */
        <div className="space-y-3.5">
          {/* Rate Master KPI Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
            <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3 shadow-sm">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active Staff
              </span>
              <p className="text-base sm:text-lg font-black text-white mt-0.5">{rateStats.count}</p>
            </div>
            <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3 shadow-sm">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Average Daily Wage
              </span>
              <p className="text-base sm:text-lg font-black text-blue-400 mt-0.5">
                {inr(rateStats.avgRate)}
              </p>
            </div>
            <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3 shadow-sm">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Highest Daily Wage
              </span>
              <p className="text-base sm:text-lg font-black text-emerald-400 mt-0.5">
                {inr(rateStats.maxRate)}
              </p>
            </div>
            <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3 shadow-sm">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Lowest Daily Wage
              </span>
              <p className="text-base sm:text-lg font-black text-amber-400 mt-0.5">
                {inr(rateStats.minRate)}
              </p>
            </div>
          </div>

          {/* Search Bar for Rate Master */}
          <div className="relative max-w-xs">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff in rate master..."
              className="w-full pl-7 pr-6 py-1 bg-[#161b27] border border-[#21293d] rounded-xl text-xs font-medium text-white placeholder:text-slate-500 outline-none focus:border-blue-500/60 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Rate Master Desktop Table */}
          <div className="hidden md:block bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden shadow-lg w-full">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: "35%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "13%" }} />
                </colgroup>
                <thead>
                  <tr className="bg-[#0d1117] border-b border-[#21293d] text-[10px] font-bold uppercase text-slate-400 tracking-wider select-none">
                    <th className="py-2.5 px-3">Staff Member</th>
                    <th className="py-2.5 px-3 text-right">Daily Wage</th>
                    <th className="py-2.5 px-3 text-right">Estimated 30-Day Monthly</th>
                    <th className="py-2.5 px-3 text-center">Last Updated</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]/50">
                  {loading ? (
                    Array(4)
                      .fill(0)
                      .map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={5} className="py-3 px-3">
                            <div className="h-3 bg-slate-800/60 rounded-full w-full"></div>
                          </td>
                        </tr>
                      ))
                  ) : filteredMechanics.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 px-3 text-center text-slate-400 text-xs">
                        No staff members found matching &quot;{searchQuery}&quot;
                      </td>
                    </tr>
                  ) : (
                    filteredMechanics.map((m) => (
                      <tr key={m.id} className="hover:bg-blue-500/[0.02] transition-colors group">
                        <td className="py-2 px-3 overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0">
                            <MechAvatar
                              image={m.image_path}
                              name={`${m.firstname} ${m.lastname}`}
                              cls="w-6 h-6 text-[9px]"
                            />
                            <div className="min-w-0 truncate">
                              <span className="text-white font-bold text-xs">
                                {m.firstname} {m.lastname}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium ml-1.5">
                                ({m.designation || "Mechanic"})
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right truncate">
                          <span className="text-xs font-black text-emerald-400">
                            {inr(m.daily_salary)}
                          </span>
                          <span className="text-[9px] text-slate-500 font-medium ml-1">/day</span>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-300 font-bold truncate text-xs">
                          ≈ {inr(m.daily_salary * 30)}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-400 text-[10px] font-medium truncate">
                          {m.last_updated
                            ? format(new Date(m.last_updated), "dd MMM, yyyy")
                            : "Initial Setup"}
                        </td>
                        <td className="py-2 px-3 text-center overflow-hidden">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setEditingMech(m);
                                setNewRate(String(m.daily_salary));
                                setEffectiveDate(format(new Date(), "yyyy-MM-dd"));
                                setShowRateModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm active:scale-95"
                            >
                              <Edit3 size={10} /> Update
                            </button>
                            <Link
                              href="/mechanics/commission"
                              className="p-1 bg-[#0d1117] hover:bg-[#1a2236] border border-[#21293d] text-slate-300 hover:text-white rounded-md text-xs font-bold transition-all"
                              title="Commission Settings"
                            >
                              <History size={11} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rate Master Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredMechanics.map((m) => (
              <div
                key={m.id}
                className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3.5 shadow-md space-y-3"
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <MechAvatar
                      image={m.image_path}
                      name={`${m.firstname} ${m.lastname}`}
                      cls="w-8 h-8 text-[10px]"
                    />
                    <div>
                      <p className="text-white font-bold text-xs">
                        {m.firstname} {m.lastname}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {m.designation || "Mechanic"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-black text-emerald-400">
                      {inr(m.daily_salary)}
                    </span>
                    <p className="text-[8px] font-bold text-slate-500 uppercase">per day</p>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-[#0d1117] p-2.5 rounded-xl border border-[#21293d] text-[11px]">
                  <span className="text-slate-400">30-Day Monthly Projection:</span>
                  <span className="font-bold text-slate-200">≈ {inr(m.daily_salary * 30)}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setEditingMech(m);
                      setNewRate(String(m.daily_salary));
                      setEffectiveDate(format(new Date(), "yyyy-MM-dd"));
                      setShowRateModal(true);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                  >
                    <Edit3 size={12} /> Update Daily Rate
                  </button>
                  <Link
                    href="/mechanics/commission"
                    className="p-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-slate-400 hover:text-white"
                  >
                    <History size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Update Daily Salary Rate (with Presets & Preview)                 */}
      {/* ========================================================================= */}
      {showRateModal && editingMech && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRateModal(false);
          }}
        >
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-4 py-3.5 bg-[#0d1117] border-b border-[#21293d] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Coins size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Update Salary Rate</h3>
                  <p className="text-[10px] text-slate-400">Set daily wage</p>
                </div>
              </div>
              <button
                onClick={() => setShowRateModal(false)}
                className="w-7 h-7 rounded-lg bg-[#161b27] border border-[#21293d] text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={updateSalaryRate} className="p-4 space-y-4">
              {/* Mechanic Info Card */}
              <div className="bg-[#0d1117] p-3 rounded-xl border border-[#21293d] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <MechAvatar
                    image={editingMech.image_path}
                    name={`${editingMech.firstname} ${editingMech.lastname}`}
                    cls="w-8 h-8 text-[10px]"
                  />
                  <div>
                    <p className="text-xs font-black text-white">
                      {editingMech.firstname} {editingMech.lastname}
                    </p>
                    <p className="text-[10px] text-slate-400">{editingMech.designation || "Mechanic"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-500 block font-bold">Current</span>
                  <span className="text-xs font-black text-blue-400">
                    {inr(editingMech.daily_salary)}/d
                  </span>
                </div>
              </div>

              {/* New Daily Wage Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-0.5">
                  New Daily Wage (₹)
                </label>
                <div className="relative">
                  <IndianRupee
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400"
                    size={16}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full pl-9 pr-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-base font-black text-white outline-none focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Quick Increment Preset Chips */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Quick Add:</span>
                  {[50, 100, 200, 500].map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => {
                        const base = parseFloat(newRate) || editingMech.daily_salary || 0;
                        setNewRate(String(base + inc));
                      }}
                      className="px-2 py-0.5 bg-[#0d1117] hover:bg-[#1a2133] border border-[#21293d] rounded-md text-[11px] font-bold text-slate-300 hover:text-white transition-all"
                    >
                      +{inc}
                    </button>
                  ))}
                </div>

                {/* Calculation Preview */}
                {parseFloat(newRate) > 0 && (
                  <div className="p-2 bg-blue-500/[0.04] border border-blue-500/20 rounded-lg text-[11px] text-slate-300 flex items-center justify-between mt-1">
                    <span>Estimated 30-Day Monthly:</span>
                    <span className="font-black text-emerald-400">
                      {inr(parseFloat(newRate) * 30)}
                    </span>
                  </div>
                )}
              </div>

              {/* Effective Date */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-0.5">
                  Effective From
                </label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500 transition-all [color-scheme:dark]"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving || !newRate}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-blue-600/25 flex items-center justify-center gap-1.5 active:scale-95"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Save Daily Rate</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Process Salary Payout (with Quick Amount Chips)                  */}
      {/* ========================================================================= */}
      {showPayoutModal && payoutData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPayoutModal(false);
          }}
        >
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-4 py-3.5 bg-emerald-950/30 border-b border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CreditCard size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Process Payout</h3>
                  <p className="text-[10px] text-emerald-300/80">Wage / Advance settlement</p>
                </div>
              </div>
              <button
                onClick={() => setShowPayoutModal(false)}
                className="w-7 h-7 rounded-lg bg-[#161b27] border border-[#21293d] text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handlePayout} className="p-4 space-y-4">
              {/* Employee Summary Card */}
              <div className="bg-[#0d1117] p-3 rounded-xl border border-[#21293d] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MechAvatar
                      image={payoutData.image}
                      name={payoutData.name}
                      cls="w-8 h-8 text-[10px]"
                    />
                    <div>
                      <p className="text-xs font-black text-white">{payoutData.name}</p>
                      <p className="text-[10px] text-slate-400">{monthLabel}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold uppercase text-slate-500 block">
                      Net Balance
                    </span>
                    <span className="text-sm font-black text-emerald-400">
                      {inr(payoutData.netTotal)}
                    </span>
                  </div>
                </div>

                {/* Mini breakdown */}
                <div className="pt-1.5 border-t border-[#21293d] grid grid-cols-3 gap-1 text-[10px] text-center text-slate-400">
                  <div>
                    <span className="block text-[8px] uppercase font-bold text-slate-500">Earned</span>
                    <span className="font-bold text-slate-200">{inrShort(payoutData.earnedSalary)}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase font-bold text-slate-500">Comm</span>
                    <span className="font-bold text-amber-300">{inrShort(payoutData.commission)}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase font-bold text-slate-500">Advance</span>
                    <span className="font-bold text-rose-400">{inrShort(payoutData.advance)}</span>
                  </div>
                </div>
              </div>

              {/* Amount Input & Quick Chips */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-0.5">
                  Payout Amount (₹)
                </label>
                <div className="relative">
                  <IndianRupee
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400"
                    size={16}
                  />
                  <input
                    type="number"
                    step="1"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    required
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-base font-black text-white outline-none focus:border-emerald-500 transition-all"
                  />
                </div>

                {/* Amount Quick-Fill Shortcuts */}
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setPayoutAmount(Math.max(0, payoutData.netTotal).toFixed(0))}
                    className="px-2.5 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-md text-[11px] font-black text-emerald-300 transition-all"
                  >
                    Full: {inrShort(payoutData.netTotal)}
                  </button>
                  {payoutData.netTotal > 1000 && (
                    <button
                      type="button"
                      onClick={() => setPayoutAmount(Math.round(payoutData.netTotal / 2).toFixed(0))}
                      className="px-2.5 py-0.5 bg-[#0d1117] hover:bg-[#1a2133] border border-[#21293d] rounded-md text-[11px] font-bold text-slate-300 transition-all"
                    >
                      50%: {inrShort(payoutData.netTotal / 2)}
                    </button>
                  )}
                  {[1000, 2000, 5000].map(
                    (v) =>
                      payoutData.netTotal >= v && (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setPayoutAmount(String(v))}
                          className="px-2 py-0.5 bg-[#0d1117] hover:bg-[#1a2133] border border-[#21293d] rounded-md text-[11px] font-bold text-slate-400 hover:text-white transition-all"
                        >
                          ₹{v}
                        </button>
                      )
                  )}
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-0.5">
                  Payment Remarks
                </label>
                <input
                  type="text"
                  value={payoutReason}
                  onChange={(e) => setPayoutReason(e.target.value)}
                  placeholder="e.g. Salary for August 2026"
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs text-white outline-none focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving || !payoutAmount || parseFloat(payoutAmount) <= 0}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-emerald-600/25 flex items-center justify-center gap-1.5 active:scale-95"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CreditCard size={14} />
                    <span>Confirm & Pay {payoutAmount ? inr(parseFloat(payoutAmount)) : ""}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
