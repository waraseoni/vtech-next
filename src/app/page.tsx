"use client";
/**
 * V-TECH Dashboard — page.tsx
 *
 * CHART FIX: chart.js/auto → Recharts
 *   Chart.js canvas API is browser-only and breaks under Next.js SSR / React
 *   Strict Mode double-invoke. Recharts renders pure SVG inside
 *   <ResponsiveContainer> — zero canvas, zero SSR issues.
 *
 * OTHER FIXES:
 *   • client_payments discount filter → payment_date (not created_at)
 *   • direct_sale_items FK column     → sale_id (not direct_sale_id)
 *   • mechanic salary fallback        → salary_per_day || daily_salary
 *   • client_name int-parse before map lookup
 *   • fetchFinancial wrapped in useCallback + triggered by profile change
 *   • financialLoading spinner so user knows filter is working
 */

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  Wrench,
  Clock,
  CheckCircle,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Users,
  ArrowRight,
  AlertCircle,
  Zap,
  Loader2,
  DollarSign,
  CreditCard,
  Filter,
  RotateCcw,
  Package,
  Activity,
  ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Profile = { full_name: string; role: string };

type Stat = {
  totalClients: number;
  pendingJobs: number;
  inProgressJobs: number;
  finishedJobs: number;
  deliveredJobs: number;
  totalMechanics: number;
  lowStock: number;
  todayRevenue: number;
};

type Financial = {
  totalSales: number;
  partsCost: number;
  grossProfit: number;
  discounts: number;
  salary: number;
  loanPaid: number;
  expenses: number;
  totalOutflow: number;
  netProfit: number;
};

type RecentJob = {
  id: number;
  job_id: string | null;
  client_name: string;
  item: string;
  amount: number;
  status: number;
};

type RecentPayment = {
  id: number;
  amount: number;
  payment_mode: string;
  payment_date: string;
  client_name: string;
};

type LowStockItem = { name: string; quantity: number; place: string };
type RevenuePoint = { month: string; revenue: number };
type StatusPoint  = { name: string; value: number; color: string };

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_META = [
  { label: "Pending",     color: "#94a3b8" },
  { label: "In Progress", color: "#f59e0b" },
  { label: "Finished",    color: "#06b6d4" },
  { label: "Paid",        color: "#10b981" },
  { label: "Cancelled",   color: "#ef4444" },
  { label: "Delivered",   color: "#3b82f6" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const n = (v: unknown) => { const x = Number(v); return isNaN(x) ? 0 : x; };
const isoDate = (iso: string) => (iso ? iso.split("T")[0] : "");
const inr = (v: number, digits = 0) =>
  "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// ─── Custom Recharts Tooltips ─────────────────────────────────────────────────
const RevTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-gray-400 mb-0.5 font-semibold">{label}</p>
      <p className="text-blue-400 font-black text-sm">{inr(n(payload[0]?.value), 2)}</p>
    </div>
  );
};

const StatusTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as StatusPoint;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-bold mb-0.5" style={{ color: d.color }}>{d.name}</p>
      <p className="text-white font-black">{d.value} jobs</p>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [profile,          setProfile]          = useState<Profile | null>(null);
  const [stats,            setStats]            = useState<Stat>({
    totalClients: 0, pendingJobs: 0, inProgressJobs: 0,
    finishedJobs: 0, deliveredJobs: 0, totalMechanics: 0,
    lowStock: 0, todayRevenue: 0,
  });
  const [financial,        setFinancial]        = useState<Financial>({
    totalSales: 0, partsCost: 0, grossProfit: 0,
    discounts: 0, salary: 0, loanPaid: 0,
    expenses: 0, totalOutflow: 0, netProfit: 0,
  });
  const [revenueData,      setRevenueData]      = useState<RevenuePoint[]>([]);
  const [statusData,       setStatusData]       = useState<StatusPoint[]>([]);
  const [recentJobs,       setRecentJobs]       = useState<RecentJob[]>([]);
  const [recentPayments,   setRecentPayments]   = useState<RecentPayment[]>([]);
  const [lowStockItems,    setLowStockItems]    = useState<LowStockItem[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [finLoading,       setFinLoading]       = useState(false);

  const now0 = new Date();
  const [from, setFrom] = useState(
    new Date(now0.getFullYear(), now0.getMonth(), 1).toISOString().split("T")[0]
  );
  const [to, setTo] = useState(
    new Date(now0.getFullYear(), now0.getMonth() + 1, 0).toISOString().split("T")[0]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN DATA FETCH
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // Profile
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: pd } = await supabase
            .from("profiles").select("full_name, role").eq("id", user.id).single();
          setProfile(
            pd ?? {
              full_name:
                user.user_metadata?.full_name ||
                user.email?.split("@")[0] ||
                "User",
              role: "staff",
            }
          );
        }

        const today = new Date().toISOString().split("T")[0];

        // Parallel queries
        const [
          { data: allTrans },
          { count: clientCount },
          { count: mechCount },
          { data: lowInv },
          { data: dirSalesAll },
          { data: recentTransRaw },
          { data: paymentsRaw },
          { data: lowInvDetail },
        ] = await Promise.all([
          supabase
            .from("transaction_list")
            .select("id, status, amount, date_completed, client_name")
            .eq("del_status", 0),
          supabase
            .from("client_list")
            .select("*", { count: "exact", head: true })
            .eq("delete_flag", 0),
          supabase
            .from("mechanic_list")
            .select("*", { count: "exact", head: true })
            .eq("delete_flag", 0)
            .eq("status", 1),
          supabase.from("inventory_list").select("product_id").lte("quantity", 5),
          supabase.from("direct_sales").select("total_amount, date_created"),
          supabase
            .from("transaction_list")
            .select("id, job_id, client_name, item, amount, status")
            .eq("del_status", 0)
            .order("id", { ascending: false })
            .limit(5),
          supabase
            .from("client_payments")
            .select("id, amount, payment_mode, payment_date, client_id")
            .order("payment_date", { ascending: false })
            .order("id", { ascending: false })
            .limit(10),
          supabase
            .from("inventory_list")
            .select("quantity, place, product_id")
            .lte("quantity", 5)
            .order("quantity", { ascending: true })
            .limit(10),
        ]);

        const active   = allTrans   ?? [];
        const dirSales = dirSalesAll ?? [];

        // Low stock count
        const lowStock = lowInv
          ? [...new Set(lowInv.map((i: any) => i.product_id))].length
          : 0;

        // Today revenue
        const todayR = active
          .filter((t: any) => t.status === 5 && isoDate(t.date_completed ?? "") === today)
          .reduce((s: number, t: any) => s + n(t.amount), 0);
        const todayD = dirSales
          .filter((d: any) => isoDate(d.date_created ?? "") === today)
          .reduce((s: number, d: any) => s + n(d.total_amount), 0);

        setStats({
          totalClients:   clientCount ?? 0,
          totalMechanics: mechCount   ?? 0,
          lowStock,
          todayRevenue:   todayR + todayD,
          pendingJobs:    active.filter((t: any) => t.status === 0).length,
          inProgressJobs: active.filter((t: any) => t.status === 1).length,
          finishedJobs:   active.filter((t: any) => t.status === 2).length,
          deliveredJobs:  active.filter((t: any) => t.status === 5).length,
        });

        // Status pie data
        setStatusData(
          STATUS_META.map((m, i) => ({
            name:  m.label,
            color: m.color,
            value: active.filter((t: any) => t.status === i).length,
          })).filter((d) => d.value > 0)
        );

        // Monthly revenue — last 12 months
        const now = new Date();
        const pts: RevenuePoint[] = [];
        for (let i = 11; i >= 0; i--) {
          const md    = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const start = md.toISOString().split("T")[0];
          const end   = new Date(md.getFullYear(), md.getMonth() + 1, 0)
            .toISOString()
            .split("T")[0];
          const rep = active
            .filter(
              (t: any) =>
                t.status === 5 &&
                isoDate(t.date_completed ?? "") >= start &&
                isoDate(t.date_completed ?? "") <= end
            )
            .reduce((s: number, t: any) => s + n(t.amount), 0);
          const dir = dirSales
            .filter(
              (d: any) =>
                isoDate(d.date_created ?? "") >= start &&
                isoDate(d.date_created ?? "") <= end
            )
            .reduce((s: number, d: any) => s + n(d.total_amount), 0);
          pts.push({
            month:   md.toLocaleString("default", { month: "short", year: "2-digit" }),
            revenue: rep + dir,
          });
        }
        setRevenueData(pts);

        // Recent jobs — resolve client names
        if (recentTransRaw?.length) {
          const cIds = [
            ...new Set(
              recentTransRaw
                .map((t: any) => parseInt(t.client_name))
                .filter((x: number) => !isNaN(x))
            ),
          ];
          const { data: cls } = cIds.length
            ? await supabase
                .from("client_list")
                .select("id, firstname, lastname")
                .in("id", cIds)
            : { data: [] };
          const cMap = Object.fromEntries(
            (cls ?? []).map((c: any) => [
              c.id,
              `${c.firstname ?? ""} ${c.lastname ?? ""}`.trim(),
            ])
          );
          setRecentJobs(
            recentTransRaw.map((t: any) => ({
              ...t,
              amount:      n(t.amount),
              client_name: cMap[parseInt(t.client_name)] || "Walk-in",
            }))
          );
        }

        // Recent payments — resolve client names
        if (paymentsRaw?.length) {
          const cIds2 = [
            ...new Set(paymentsRaw.map((p: any) => p.client_id).filter(Boolean)),
          ];
          const { data: cls2 } = cIds2.length
            ? await supabase
                .from("client_list")
                .select("id, firstname, lastname")
                .in("id", cIds2)
            : { data: [] };
          const cMap2 = Object.fromEntries(
            (cls2 ?? []).map((c: any) => [
              c.id,
              `${c.firstname ?? ""} ${c.lastname ?? ""}`.trim(),
            ])
          );
          setRecentPayments(
            paymentsRaw.map((p: any) => ({
              id:           p.id,
              amount:       n(p.amount),
              payment_mode: p.payment_mode ?? "Cash",
              payment_date: p.payment_date,
              client_name:  cMap2[p.client_id] ?? "Unknown",
            }))
          );
        }

        // Low stock — resolve product names
        if (lowInvDetail?.length) {
          const pIds = [
            ...new Set(lowInvDetail.map((i: any) => i.product_id).filter(Boolean)),
          ];
          const { data: prods } = pIds.length
            ? await supabase
                .from("product_list")
                .select("id, name")
                .in("id", pIds)
            : { data: [] };
          const pMap = Object.fromEntries(
            (prods ?? []).map((p: any) => [p.id, p.name])
          );
          setLowStockItems(
            lowInvDetail.map((i: any) => ({
              name:     pMap[i.product_id] ?? "Unknown",
              quantity: n(i.quantity),
              place:    i.place ?? "—",
            }))
          );
        }
      } catch (e) {
        console.error("Dashboard fetch error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL DATA (admin only, re-runs on date or profile change)
  // ═══════════════════════════════════════════════════════════════════════════
  const fetchFinancial = useCallback(async () => {
    if (!profile || profile.role !== "admin") return;
    setFinLoading(true);
    try {
      const f0 = from + "T00:00:00";
      const t0 = to   + "T23:59:59";

      const [
        { data: tD }, { data: dD },
        { data: txIds }, { data: dIds },
        { data: discD }, { data: attD },
        { data: loanD }, { data: expD },
      ] = await Promise.all([
        supabase.from("transaction_list").select("amount")
          .eq("status", 5).eq("del_status", 0)
          .gte("date_completed", f0).lte("date_completed", t0),
        supabase.from("direct_sales").select("total_amount")
          .gte("date_created", f0).lte("date_created", t0),
        supabase.from("transaction_list").select("id")
          .eq("status", 5).eq("del_status", 0)
          .gte("date_completed", f0).lte("date_completed", t0),
        supabase.from("direct_sales").select("id")
          .gte("date_created", f0).lte("date_created", t0),
        // FIX: payment_date — schema mein created_at column nahi
        supabase.from("client_payments").select("discount")
          .gte("payment_date", from).lte("payment_date", to),
        supabase.from("attendance_list").select("status, mechanic_id")
          .gte("curr_date", from).lte("curr_date", to).in("status", [1, 3]),
        supabase.from("loan_payments").select("amount_paid")
          .gte("payment_date", from).lte("payment_date", to),
        supabase.from("expense_list").select("amount")
          .gte("date_created", f0).lte("date_created", t0),
      ]);

      const repairInc  = (tD ?? []).reduce((s: number, t: any) => s + n(t.amount), 0);
      const directInc  = (dD ?? []).reduce((s: number, d: any) => s + n(d.total_amount), 0);
      const totalSales = repairInc + directInc;

      // Parts cost — transaction_products
      const txList = (txIds ?? []).map((t: any) => t.id);
      let partsTrans = 0;
      if (txList.length) {
        const { data: tp } = await supabase
          .from("transaction_products").select("qty, price")
          .in("transaction_id", txList);
        partsTrans = (tp ?? []).reduce((s: number, r: any) => s + n(r.qty) * n(r.price), 0);
      }

      // Parts cost — direct_sale_items (FIX: sale_id not direct_sale_id)
      const dList = (dIds ?? []).map((d: any) => d.id);
      let partsDirect = 0;
      if (dList.length) {
        const { data: di } = await supabase
          .from("direct_sale_items").select("qty, price")
          .in("sale_id", dList);
        partsDirect = (di ?? []).reduce((s: number, r: any) => s + n(r.qty) * n(r.price), 0);
      }

      const partsCost   = (partsTrans + partsDirect) * 0.9;
      const grossProfit = totalSales - partsCost;
      const discounts   = (discD ?? []).reduce((s: number, p: any) => s + n(p.discount), 0);

      // Salary (FIX: salary_per_day || daily_salary fallback)
      let salary = 0;
      if (attD?.length) {
        const mIds = [...new Set(attD.map((a: any) => a.mechanic_id).filter(Boolean))];
        const { data: mechs } = await supabase
          .from("mechanic_list").select("id, salary_per_day, daily_salary").in("id", mIds);
        const sMap = Object.fromEntries(
          (mechs ?? []).map((m: any) => [
            m.id,
            n(m.salary_per_day) || n(m.daily_salary),
          ])
        );
        salary = attD.reduce((s: number, a: any) => {
          const d = sMap[a.mechanic_id] ?? 0;
          return s + (a.status === 1 ? d : a.status === 3 ? d / 2 : 0);
        }, 0);
      }

      const loanPaid    = (loanD ?? []).reduce((s: number, l: any) => s + n(l.amount_paid), 0);
      const expenses    = (expD  ?? []).reduce((s: number, e: any) => s + n(e.amount), 0);
      const totalOutflow = discounts + salary + loanPaid + expenses;
      const netProfit   = grossProfit - totalOutflow;

      setFinancial({
        totalSales, partsCost, grossProfit,
        discounts, salary, loanPaid,
        expenses, totalOutflow, netProfit,
      });
    } catch (e) {
      console.error("Financial fetch error:", e);
    } finally {
      setFinLoading(false);
    }
  }, [from, to, profile]);

  useEffect(() => { fetchFinancial(); }, [fetchFinancial]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950">
        <div className="relative w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/40">
          <Wrench className="text-white" size={30} />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-950 animate-ping" />
        </div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em]">
          V-TECH Loading…
        </p>
      </div>
    );
  }

  const displayName  = profile?.full_name ?? "User";
  const isAdmin      = profile?.role === "admin";
  const totalJobs    = statusData.reduce((s, d) => s + d.value, 0);
  const profitPct    = financial.totalSales > 0
    ? ((financial.netProfit / financial.totalSales) * 100).toFixed(1) : "0";

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });

  const resetDates = () => {
    const nw = new Date();
    setFrom(new Date(nw.getFullYear(), nw.getMonth(), 1).toISOString().split("T")[0]);
    setTo(new Date(nw.getFullYear(), nw.getMonth() + 1, 0).toISOString().split("T")[0]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ HEADER */}
        <header className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950/30 to-slate-900 rounded-3xl border border-slate-800 p-6 md:p-8">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-12 left-1/3 w-48 h-48 bg-indigo-600/8 rounded-full blur-2xl" />
          </div>
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-13 h-13 w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-600/30">
                  <Wrench className="text-white" size={26} />
                </div>
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white leading-none">
                  V-TECH&nbsp;
                  <span className="text-blue-400">COMMAND</span>
                </h1>
                <p className="text-slate-400 text-[11px] font-semibold mt-1.5 tracking-[0.18em] uppercase">
                  Swaagat hai, {displayName} ji!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {isAdmin && (
                <div className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-3.5 py-2">
                  <Activity size={13} className="text-emerald-400" />
                  <span className="text-emerald-400 text-[11px] font-bold tracking-wider uppercase">
                    Live
                  </span>
                </div>
              )}
              <Link
                href="/jobs/new"
                className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-5 py-2.5 rounded-2xl font-bold flex items-center gap-2 transition-all no-underline text-sm shadow-lg shadow-blue-600/25"
              >
                <Zap size={15} strokeWidth={2.5} />
                New Job
              </Link>
            </div>
          </div>
        </header>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ FILTER */}
        <section className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
          <div className="flex flex-wrap items-end justify-end gap-3">
            {[
              { label: "From", val: from, fn: setFrom },
              { label: "To",   val: to,   fn: setTo   },
            ].map(({ label, val, fn }) => (
              <div key={label} className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em]">
                  {label}
                </label>
                <input
                  type="date" value={val}
                  onChange={(e) => fn(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            ))}
            <button
              onClick={fetchFinancial}
              disabled={finLoading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl font-bold text-sm transition h-[38px]"
            >
              {finLoading
                ? <Loader2 size={14} className="animate-spin" />
                : <Filter size={14} />}
              Apply
            </button>
            <button
              onClick={resetDates}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-2 rounded-xl font-bold text-sm transition h-[38px]"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>
        </section>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ STAT CARDS */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard label="Total Clients"   value={stats.totalClients}                                           icon={<Users size={20}/>}                             color="blue"    href="/clients" />
          <StatCard label="Pending"         value={stats.pendingJobs}                                            icon={<Clock size={20}/>}                             color="amber"   href="/jobs?status=0" />
          <StatCard label="In Progress"     value={stats.inProgressJobs}                                         icon={<Activity size={20}/>}                          color="cyan"    href="/jobs?status=1" />
          <StatCard label="Finished"        value={stats.finishedJobs}                                           icon={<CheckCircle size={20}/>}                       color="emerald" href="/jobs?status=2" />
          <StatCard label="Delivered"       value={stats.deliveredJobs}                                          icon={<ArrowRight size={20}/>}                        color="violet"  href="/jobs?status=5" />
          <StatCard label="Mechanics"       value={stats.totalMechanics}                                         icon={<Users size={20}/>}                             color="pink"    href="/mechanics" />
          <StatCard label="Low Stock"       value={stats.lowStock}                                               icon={<AlertCircle size={20}/>}                       color="red"     href="/inventory" />
          <StatCard
            label="Today's Revenue"
            value={inr(stats.todayRevenue, 2)}
            icon={<IndianRupee size={20} strokeWidth={2.5}/>}
            color="indigo"
          />
        </section>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ CHARTS */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Revenue Bar Chart (Recharts – pure SVG, no canvas/SSR issues) */}
          <div className="lg:col-span-2 bg-slate-900 rounded-3xl border border-slate-800 p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-white">Monthly Revenue</h3>
                <p className="text-slate-500 text-xs mt-0.5">Last 12 months — Repair + Direct Sales</p>
              </div>
              <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-bold rounded-xl px-3 py-1">
                ₹ Revenue
              </span>
            </div>
            {revenueData.every((d) => d.revenue === 0) ? (
              <EmptyChart label="Is period mein koi revenue nahi" />
            ) : (
              <ResponsiveContainer width="100%" height={270}>
                <BarChart
                  data={revenueData}
                  margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
                  barCategoryGap="25%"
                >
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.65} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3" stroke="#1e293b" vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) =>
                      v >= 100000 ? `₹${(v / 100000).toFixed(1)}L`
                      : v >= 1000  ? `₹${(v / 1000).toFixed(0)}k`
                      : `₹${v}`
                    }
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false} tickLine={false} width={54}
                  />
                  <Tooltip content={<RevTooltip />} cursor={{ fill: "rgba(59,130,246,0.07)" }} />
                  <Bar dataKey="revenue" fill="url(#revGrad)" radius={[6, 6, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Status Donut Chart */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Job Status</h3>
                <p className="text-slate-500 text-xs mt-0.5">{totalJobs} total active jobs</p>
              </div>
              <span className="bg-slate-800 text-slate-400 text-[11px] font-bold rounded-xl px-3 py-1">
                All Time
              </span>
            </div>
            {statusData.length === 0 ? (
              <EmptyChart label="Koi job nahi mili" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%" cy="50%"
                      innerRadius={52} outerRadius={78}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<StatusTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Custom legend */}
                <div className="mt-3 space-y-2">
                  {statusData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: d.color }}
                        />
                        <span className="text-slate-400">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-white font-bold">{d.value}</span>
                        <span className="text-slate-600 text-[10px] w-7 text-right">
                          {totalJobs > 0
                            ? ((d.value / totalJobs) * 100).toFixed(0)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ FINANCIAL (admin) */}
        {isAdmin && (
          <section className="bg-slate-900 rounded-3xl border border-slate-800 p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-base font-bold text-white">Financial Summary</h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  {fmtDate(from)} — {fmtDate(to)}
                </p>
              </div>
              {!finLoading && (
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-bold px-4 py-1.5 rounded-2xl border ${
                    financial.netProfit >= 0
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
                      : "text-red-400 bg-red-500/10 border-red-500/25"
                  }`}
                >
                  {financial.netProfit >= 0
                    ? <TrendingUp size={15} />
                    : <TrendingDown size={15} />}
                  {profitPct}%&nbsp;
                  {financial.netProfit >= 0 ? "Profit Margin" : "Loss"}
                </span>
              )}
            </div>

            {finLoading ? (
              <div className="flex items-center justify-center py-14">
                <Loader2 className="animate-spin text-blue-400" size={32} />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <FinCard icon={<DollarSign size={20}/>}   label="Total Sales"      value={financial.totalSales}  color="blue" />
                  <FinCard icon={<Wrench size={20}/>}       label="Parts Cost (90%)" value={financial.partsCost}   color="amber" isExpense />
                  <FinCard icon={<Activity size={20}/>}     label="Gross Profit"     value={financial.grossProfit} color="cyan" />
                  <FinCard icon={<AlertCircle size={20}/>}  label="Discounts"        value={financial.discounts}   color="red"  isExpense />
                  <FinCard icon={<Users size={20}/>}        label="Staff Salary"     value={financial.salary}      color="slate" isExpense />
                  <FinCard icon={<CreditCard size={20}/>}   label="Loan Repaid"      value={financial.loanPaid}    color="violet" isExpense />
                  <FinCard icon={<IndianRupee size={20}/>}  label="Other Expenses"   value={financial.expenses}    color="rose" isExpense />
                  {/* Net profit card */}
                  <div
                    className={`rounded-2xl border p-4 flex items-center gap-3 ${
                      financial.netProfit >= 0
                        ? "bg-emerald-500/10 border-emerald-500/25"
                        : "bg-red-500/10 border-red-500/25"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl ${
                        financial.netProfit >= 0
                          ? "bg-emerald-500/20"
                          : "bg-red-500/20"
                      }`}
                    >
                      {financial.netProfit >= 0
                        ? <TrendingUp size={20} className="text-emerald-400" />
                        : <TrendingDown size={20} className="text-red-400" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Net Profit / Loss
                      </p>
                      <p
                        className={`text-xl font-black ${
                          financial.netProfit >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {inr(Math.abs(financial.netProfit), 2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cash-flow bar */}
                <div className="mt-5 bg-slate-800/50 rounded-2xl p-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-2">
                    <span>Revenue vs Outflow</span>
                    <span>Total Sales {inr(financial.totalSales)}</span>
                  </div>
                  <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        financial.netProfit >= 0
                          ? "bg-gradient-to-r from-blue-500 to-emerald-500"
                          : "bg-gradient-to-r from-red-600 to-orange-500"
                      }`}
                      style={{
                        width:
                          financial.totalSales > 0
                            ? `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  (financial.grossProfit / financial.totalSales) * 100
                                )
                              )}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-[10px] font-bold">
                    <span className="text-red-400">Outflow {inr(financial.totalOutflow)}</span>
                    <span
                      className={financial.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}
                    >
                      Net {inr(financial.netProfit)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ RECENT ACTIVITY */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Recent Jobs */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">Recent Jobs</h3>
                <p className="text-slate-500 text-xs">Latest 5 transactions</p>
              </div>
              <Link
                href="/jobs"
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-bold transition no-underline"
              >
                View All <ChevronRight size={13} />
              </Link>
            </div>
            <div className="divide-y divide-slate-800/70">
              {recentJobs.length === 0 ? (
                <EmptyRow icon={<Wrench size={28} />} label="Koi job nahi mili" />
              ) : (
                recentJobs.map((job) => {
                  const sc = STATUS_META[job.status] ?? { color: "#94a3b8", label: "Unknown" };
                  return (
                    <div
                      key={job.id}
                      className="flex items-center gap-3 px-6 py-3.5 hover:bg-slate-800/40 transition"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: sc.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="text-blue-400 hover:text-blue-300 font-bold text-sm no-underline"
                          >
                            {job.job_id ?? "N/A"}
                          </Link>
                          <span className="text-slate-400 text-xs truncate">
                            {job.client_name}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs truncate mt-0.5">{job.item}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="text-white font-bold text-sm">{inr(job.amount)}</p>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: sc.color + "33", color: sc.color }}
                        >
                          {sc.label}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Payments */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">Recent Payments</h3>
                <p className="text-slate-500 text-xs">Latest client payments</p>
              </div>
              <Link
                href="/payments"
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-bold transition no-underline"
              >
                View All <ChevronRight size={13} />
              </Link>
            </div>
            <div className="divide-y divide-slate-800/70">
              {recentPayments.length === 0 ? (
                <EmptyRow icon={<CreditCard size={28} />} label="Koi payment nahi mili" />
              ) : (
                recentPayments.map((pay) => (
                  <div
                    key={pay.id}
                    className="flex items-center gap-3 px-6 py-3.5 hover:bg-slate-800/40 transition"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <IndianRupee size={14} className="text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">
                        {pay.client_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                          {pay.payment_mode}
                        </span>
                        <span className="text-slate-600 text-[10px]">
                          {new Date(pay.payment_date).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short",
                          })}
                        </span>
                      </div>
                    </div>
                    <p className="text-emerald-400 font-black text-base flex-shrink-0">
                      {inr(pay.amount)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ LOW STOCK */}
        <section className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertCircle size={14} className="text-red-400" />
                Low Stock Alert
              </h3>
              <p className="text-slate-500 text-xs">Items with quantity ≤ 5</p>
            </div>
            <Link
              href="/inventory"
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-bold transition no-underline"
            >
              Manage <ChevronRight size={13} />
            </Link>
          </div>
          {lowStockItems.length === 0 ? (
            <div className="py-10 text-center">
              <Package className="mx-auto mb-2 text-emerald-500/40" size={30} />
              <p className="text-emerald-500/60 text-sm font-semibold">
                Sab stock theek hai ✓
              </p>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {lowStockItems.map((item, i) => {
                const urgency =
                  item.quantity === 0
                    ? { bg: "bg-red-900/40", border: "border-red-500/30", text: "text-red-400" }
                    : item.quantity <= 2
                    ? { bg: "bg-orange-900/30", border: "border-orange-500/25", text: "text-orange-400" }
                    : { bg: "bg-amber-900/20", border: "border-amber-500/20", text: "text-amber-400" };
                return (
                  <div
                    key={i}
                    className={`${urgency.bg} border ${urgency.border} rounded-2xl p-3.5 flex items-center gap-3 hover:brightness-110 transition`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl border ${urgency.border} flex items-center justify-center flex-shrink-0 font-black text-sm ${urgency.text}`}
                    >
                      {item.quantity}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold truncate">
                        {item.name}
                      </p>
                      <p className="text-slate-500 text-xs truncate">{item.place}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer */}
        <p className="text-center text-slate-700 text-xs font-semibold pb-2">
          V-TECH Management System &mdash; {new Date().getFullYear()}
        </p>

      </div>
    </div>
  );
}

// ─── Helper UI Components ─────────────────────────────────────────────────────

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-[270px] text-slate-600 text-xs font-semibold">
      {label}
    </div>
  );
}

function EmptyRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-600">
      <div className="opacity-25">{icon}</div>
      <p className="text-sm">{label}</p>
    </div>
  );
}

const STAT_C: Record<string, { border: string; icon: string }> = {
  blue:    { border: "border-blue-500/25",    icon: "text-blue-400   bg-blue-500/10"    },
  amber:   { border: "border-amber-500/25",   icon: "text-amber-400  bg-amber-500/10"   },
  cyan:    { border: "border-cyan-500/25",    icon: "text-cyan-400   bg-cyan-500/10"    },
  emerald: { border: "border-emerald-500/25", icon: "text-emerald-400 bg-emerald-500/10"},
  violet:  { border: "border-violet-500/25",  icon: "text-violet-400 bg-violet-500/10"  },
  pink:    { border: "border-pink-500/25",    icon: "text-pink-400   bg-pink-500/10"    },
  red:     { border: "border-red-500/25",     icon: "text-red-400    bg-red-500/10"     },
  indigo:  { border: "border-indigo-500/25",  icon: "text-indigo-400 bg-indigo-500/10"  },
};

function StatCard({
  label, value, icon, color, href,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  href?: string;
}) {
  const c = STAT_C[color] ?? STAT_C.blue;
  const inner = (
    <div
      className={`bg-slate-900 rounded-2xl border ${c.border} p-4 flex items-center gap-3.5 hover:bg-slate-800/70 transition-all duration-200 group cursor-pointer`}
    >
      <div className={`p-2.5 rounded-xl ${c.icon} flex-shrink-0`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] truncate">
          {label}
        </p>
        <p className="text-xl font-black text-white tracking-tight leading-none mt-0.5">
          {value}
        </p>
      </div>
      {href && (
        <ChevronRight
          size={14}
          className="text-slate-700 group-hover:text-slate-500 flex-shrink-0 transition"
        />
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="no-underline block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

const FIN_C: Record<string, { bg: string; icon: string }> = {
  blue:   { bg: "bg-blue-500/10",    icon: "text-blue-400"   },
  amber:  { bg: "bg-amber-500/10",   icon: "text-amber-400"  },
  cyan:   { bg: "bg-cyan-500/10",    icon: "text-cyan-400"   },
  red:    { bg: "bg-red-500/10",     icon: "text-red-400"    },
  slate:  { bg: "bg-slate-700/40",   icon: "text-slate-400"  },
  violet: { bg: "bg-violet-500/10",  icon: "text-violet-400" },
  rose:   { bg: "bg-rose-500/10",    icon: "text-rose-400"   },
};

function FinCard({
  icon, label, value, color, isExpense,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  isExpense?: boolean;
}) {
  const c = FIN_C[color] ?? FIN_C.blue;
  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/40 p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${c.bg} flex-shrink-0`}>
        <div className={c.icon}>{icon}</div>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em] truncate">
          {label}
        </p>
        <p
          className={`text-lg font-black truncate ${
            isExpense ? "text-red-400" : "text-white"
          }`}
        >
          {inr(value, 0)}
        </p>
      </div>
    </div>
  );
}