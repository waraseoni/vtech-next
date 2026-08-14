"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";
import {
  Wrench, Clock, CheckCircle, IndianRupee, TrendingUp, TrendingDown,
  Users, ArrowRight, AlertCircle, Zap, Loader2, DollarSign, CreditCard,
  Filter, RotateCcw, Package, Activity, ChevronRight, CalendarClock, MessageCircle,
  QrCode, X,
} from "lucide-react";
import QRCode from "qrcode";
import { pageAll } from "@/lib/fetch-all";
import AIAlertsWidget from "@/app/components/AIAlertsWidget";
import LicenseInfoCard from "@/app/components/LicenseInfoCard";

// ─── Types ────────────────────────────────────────────────────────────────────
type Profile = { full_name: string; role: string };
type Stat = { totalJobs: number; totalClients: number; pendingJobs: number; inProgressJobs: number; finishedJobs: number; deliveredJobs: number; totalMechanics: number; lowStock: number; todayRevenue: number; };
type Financial = { totalSales: number; partsCost: number; grossProfit: number; discounts: number; salary: number; loanPaid: number; expenses: number; totalOutflow: number; netProfit: number; };
type RecentJob = { id: number; job_id: string | null; client_name: string; item: string; amount: number; status: number; };
type RecentPayment = { id: number; amount: number; payment_mode: string; payment_date: string; client_name: string; };
type LowStockItem = { name: string; quantity: number; place: string; alert: number };
type RevenuePoint = { month: string; revenue: number };
type StatusPoint = { name: string; value: number; color: string };
type TooltipItem = { value?: number | string; payload?: unknown };

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const STATUS_META = [
  { label: "Pending", color: "#94a3b8" },
  { label: "In Progress", color: "#f59e0b" },
  { label: "Finished", color: "#06b6d4" },
  { label: "Paid", color: "#10b981" },
  { label: "Cancelled", color: "#ef4444" },
  { label: "Delivered", color: "#3b82f6" },
];

import { todayIST, formatIST, startOfMonthIST, endOfMonthIST, parseISTDate } from "@/lib/dateUtils";

// ─── Timezone-safe helpers ────────────────────────────────────────────────────
// BUG FIX 4: fmtDate — new Date('YYYY-MM-DD') parses as UTC midnight.
// In IST, UTC midnight = 5:30 AM → date shifts back 1 day in display.
// Fix: parse manually as local date.
const fmtDate = (d: string) =>
  formatIST(d, {
    day: "2-digit", month: "short", year: "numeric",
  });

// isoDate replaced by toISTDatePart from dateUtils
const n = (v: unknown) => { const x = Number(v); return isNaN(x) ? 0 : x; };
const inr = (v: number, digits = 0) =>
  "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// ─── Recharts custom tooltips ─────────────────────────────────────────────────
const RevTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string | number }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111520] border border-[#21293d] rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-500 mb-0.5 font-bold">{label}</p>
      <p className="text-blue-400 font-black text-sm">{inr(n(payload[0]?.value), 2)}</p>
    </div>
  );
};
const StatusTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipItem[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as StatusPoint;
  return (
    <div className="bg-[#111520] border border-[#21293d] rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-bold mb-0.5" style={{ color: d.color }}>{d.name}</p>
      <p className="text-white font-black">{d.value} jobs</p>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone) {
      setIsInstalled(true);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // QR code — scan to open the site on mobile.
  // Domain/IP access → use that origin. localhost → swap in the machine's LAN IP
  // (via /api/device-info) so a phone on the same WiFi can reach the dev server.
  useEffect(() => {
    if (!qrOpen) return;
    let cancelled = false;
    (async () => {
      const { hostname, protocol, port } = window.location;
      let siteUrl = window.location.origin;
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
        try {
          const res = await fetch("/api/device-info");
          const { lanIp } = await res.json();
          if (lanIp) siteUrl = `${protocol}//${lanIp}${port ? `:${port}` : ""}`;
        } catch {}
      }
      if (cancelled) return;
      setQrUrl(siteUrl);
      QRCode.toDataURL(siteUrl, {
        width: 240,
        margin: 2,
        color: { dark: "#0d1117", light: "#ffffff" },
      }).then((url) => {
        if (!cancelled) setQrDataUrl(url);
      }).catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    })();
    return () => { cancelled = true; };
  }, [qrOpen]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stat>({ totalJobs: 0, totalClients: 0, pendingJobs: 0, inProgressJobs: 0, finishedJobs: 0, deliveredJobs: 0, totalMechanics: 0, lowStock: 0, todayRevenue: 0 });
  const [financial, setFinancial] = useState<Financial>({ totalSales: 0, partsCost: 0, grossProfit: 0, discounts: 0, salary: 0, loanPaid: 0, expenses: 0, totalOutflow: 0, netProfit: 0 });
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [statusData, setStatusData] = useState<StatusPoint[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [dueStats, setDueStats] = useState<{ overdue: number; today: number; upcoming: number; amount: number }>({ overdue: 0, today: 0, upcoming: 0, amount: 0 });
  const [loading, setLoading] = useState(true);
  const [finLoading, setFinLoading] = useState(false);

  // ── AUTH CHECK ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
      setAuthChecked(true);
    }).catch(() => {
      setIsLoggedIn(false);
      setAuthChecked(true);
    });
  }, []);

  // BUG FIX 1 applied: use toLocalStr instead of .toISOString().split('T')[0]
  const [from, setFrom] = useState(() => startOfMonthIST());
  const [to, setTo] = useState(() => endOfMonthIST());

  // ── MAIN DATA FETCH ──────────────────────────────────────────────────────
  useEffect(() => {
    // BUG FIX: koi bhi Supabase query network par atak jaye to bhi loader
    // hamesha nahi rukega — 10s baad page vese bhi dikha do (data partial).
    const watchdog = setTimeout(() => setLoading(false), 10000);
    (async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        // BUG FIX: logged-out user par heavy dashboard queries (transactions,
        // 12-month revenue loop ~24 calls, counts...) bilkul mat chalao — koi
        // query atak jaye to "V-TECH Loading…" hamesha ke liye ruk jata tha.
        // Logged out → turant loading khatam → (public) website dikhao.
        if (!user) return;

        {
          const { data: pd } = await supabase
            .from("profiles").select("full_name, role").eq("id", user.id).single();
          setProfile(pd ?? {
            full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
            role: "staff",
          });
        }

        // BUG FIX 2: use todayIST() — not new Date().toISOString().split('T')[0]
        const today = todayIST();

        // Fetch today's data for the summary stats
        const startToday = `${today}T00:00:00+05:30`;
        const endToday   = `${today}T23:59:59+05:30`;

        const [
          { data: todayRepairRes },
          { data: todayDirectRes },
          { count: clientCount },
          { count: mechCount },
          { data: lowProds },
          { data: lowInvAll },
          { data: lowJobItems },
          { data: lowSaleItems },
          { data: recentTransRaw },
          { data: paymentsRaw },
        ] = await Promise.all([
          // Today's Repair Income
          supabase.from("transaction_list").select("amount").eq("status", 5).eq("del_status", 0).gte("date_completed", startToday).lte("date_completed", endToday),
          // Today's Direct Sales
          supabase.from("direct_sales").select("total_amount").gte("date_created", startToday).lte("date_created", endToday),
          // Other stats
          supabase.from("client_list").select("*", { count: "exact", head: true }).eq("delete_flag", 0),
          supabase.from("mechanic_list").select("*", { count: "exact", head: true }).eq("delete_flag", 0).eq("status", 1),
          // Low stock — products with alert level
          pageAll(supabase.from("product_list").select("id, name, alert_quantity").eq("delete_flag", 0).gt("alert_quantity", 0)),
          pageAll(supabase.from("inventory_list").select("product_id, quantity, place")),
          pageAll(supabase.from("transaction_products").select("product_id, qty, transaction_id")),
          pageAll(supabase.from("direct_sale_items").select("product_id, qty")),
          supabase.from("transaction_list").select("id, job_id, client_name, item, amount, status").eq("del_status", 0).order("id", { ascending: false }).limit(5),
          supabase.from("client_payments").select("id, amount, payment_mode, payment_date, client_id").order("payment_date", { ascending: false }).order("id", { ascending: false }).limit(10),
        ]);

        const todayR = (todayRepairRes || []).reduce((s, r) => s + n(r.amount), 0);
        const todayD = (todayDirectRes || []).reduce((s, r) => s + n(r.total_amount), 0);

        // Fetch counts accurately using head-only count queries for ALL possible statuses
        const [
          { count: totalJobsCount },
          { count: pendingCount },
          { count: inProgressCount },
          { count: finishedCount },
          { count: paidCount },
          { count: cancelledCount },
          { count: deliveredCount },
        ] = await Promise.all([
          supabase.from("transaction_list").select("*", { count: "exact", head: true }).eq("del_status", 0),
          supabase.from("transaction_list").select("*", { count: "exact", head: true }).eq("del_status", 0).eq("status", 0),
          supabase.from("transaction_list").select("*", { count: "exact", head: true }).eq("del_status", 0).eq("status", 1),
          supabase.from("transaction_list").select("*", { count: "exact", head: true }).eq("del_status", 0).eq("status", 2),
          supabase.from("transaction_list").select("*", { count: "exact", head: true }).eq("del_status", 0).eq("status", 3),
          supabase.from("transaction_list").select("*", { count: "exact", head: true }).eq("del_status", 0).eq("status", 4),
          supabase.from("transaction_list").select("*", { count: "exact", head: true }).eq("del_status", 0).eq("status", 5),
        ]);


        let lowStock = 0;

        // todayR and todayD are already calculated above from targeted queries


        setStats({
          totalJobs: totalJobsCount || 0,
          totalClients: clientCount ?? 0,
          totalMechanics: mechCount ?? 0,
          lowStock,
          todayRevenue: todayR + todayD,
          pendingJobs: pendingCount || 0,
          inProgressJobs: inProgressCount || 0,
          finishedJobs: finishedCount || 0,
          deliveredJobs: deliveredCount || 0,
        });

        setStatusData(
          STATUS_META.map((m, i) => {
            let val = 0;
            if (i === 0) val = pendingCount || 0;
            else if (i === 1) val = inProgressCount || 0;
            else if (i === 2) val = finishedCount || 0;
            else if (i === 3) val = paidCount || 0;
            else if (i === 4) val = cancelledCount || 0;
            else if (i === 5) val = deliveredCount || 0;
            return { name: m.label, color: m.color, value: val };
          }).filter(d => d.value > 0)
        );

        // Monthly revenue chart - targeted queries for last 12 months
        const pts: RevenuePoint[] = [];
        for (let i = 11; i >= 0; i--) {
          const md = new Date();
          md.setDate(1); 
          md.setMonth(md.getMonth() - i);

          const start = `${startOfMonthIST(md)}T00:00:00+05:30`;
          const end = `${endOfMonthIST(md)}T23:59:59+05:30`;
          
          const [{data: repMonth}, {data: dirMonth}] = await Promise.all([
             pageAll(supabase.from("transaction_list").select("amount").eq("status", 5).eq("del_status", 0).gte("date_completed", start).lte("date_completed", end)),
             pageAll(supabase.from("direct_sales").select("total_amount").gte("date_created", start).lte("date_created", end))
          ]);

          pts.push({
            month: md.toLocaleString("default", { month: "short", year: "2-digit" }),
            revenue: ((repMonth || []).reduce((s, r) => s + n(r.amount), 0)) + ((dirMonth || []).reduce((s, r) => s + n(r.total_amount), 0)),
          });
        }
        setRevenueData(pts);

        // Recent jobs — resolve client names
        if (recentTransRaw?.length) {
          const cIds = [...new Set(recentTransRaw.map((t) => parseInt(t.client_name)).filter((x: number) => !isNaN(x)))];
          const { data: cls } = cIds.length
            ? await supabase.from("client_list").select("id, firstname, lastname").in("id", cIds)
            : { data: [] };
          const cMap = Object.fromEntries((cls ?? []).map((c) => [c.id, `${c.firstname ?? ""} ${c.lastname ?? ""}`.trim()]));
          setRecentJobs(recentTransRaw.map((t) => ({
            ...t, amount: n(t.amount),
            client_name: cMap[parseInt(t.client_name)] || "Walk-in",
          })));
        }

        // Recent payments — resolve client names
        if (paymentsRaw?.length) {
          const cIds2 = [...new Set(paymentsRaw.map((p) => p.client_id).filter(Boolean))];
          const { data: cls2 } = cIds2.length
            ? await supabase.from("client_list").select("id, firstname, lastname").in("id", cIds2)
            : { data: [] };
          const cMap2 = Object.fromEntries((cls2 ?? []).map((c) => [c.id, `${c.firstname ?? ""} ${c.lastname ?? ""}`.trim()]));
          setRecentPayments(paymentsRaw.map((p) => ({
            id: p.id, amount: n(p.amount), payment_mode: p.payment_mode ?? "Cash",
            payment_date: p.payment_date, client_name: cMap2[p.client_id] ?? "Unknown",
          })));
        }

        // Low stock — compute available stock (in − sold) vs alert_quantity
        if ((lowProds || []).length) {
          const txnIds = [...new Set((lowJobItems || []).map((i) => i.transaction_id))];
          let validTxnSet = new Set<number>();
          if (txnIds.length) {
            const { data: txns } = await supabase
              .from("transaction_list").select("id").in("id", txnIds).neq("status", 4);
            validTxnSet = new Set((txns || []).map((t) => t.id));
          }
          const stockMap = new Map<number, number>();
          (lowInvAll || []).forEach((i) => stockMap.set(i.product_id, (stockMap.get(i.product_id) || 0) + n(i.quantity)));
          const soldJobMap = new Map<number, number>();
          (lowJobItems || []).forEach((i) => {
            if (validTxnSet.has(i.transaction_id)) soldJobMap.set(i.product_id, (soldJobMap.get(i.product_id) || 0) + n(i.qty));
          });
          const soldSaleMap = new Map<number, number>();
          (lowSaleItems || []).forEach((i) => soldSaleMap.set(i.product_id, (soldSaleMap.get(i.product_id) || 0) + n(i.qty)));

          const placeMap = new Map<number, string>();
          (lowInvAll || []).forEach((i) => { if (i.place && !placeMap.has(i.product_id)) placeMap.set(i.product_id, i.place); });

          const builtLow = (lowProds || [])
            .map((p) => {
              const available = (stockMap.get(p.id) || 0) - (soldJobMap.get(p.id) || 0) - (soldSaleMap.get(p.id) || 0);
              return { name: p.name, quantity: available, place: placeMap.get(p.id) || "—", alert: n(p.alert_quantity) };
            })
            .filter((x) => x.quantity < x.alert)
            .sort((a, b) => (a.quantity - a.alert) - (b.quantity - b.alert));

          lowStock = builtLow.length;
          setLowStockItems(builtLow.slice(0, 12));
          setStats(prev => ({ ...prev, lowStock }));
        }
      } catch (e) {
        console.error("Dashboard fetch error:", e);
      } finally {
        clearTimeout(watchdog);
        setLoading(false);
      }
    })();
  }, []);

  // ── DUE REMINDERS WIDGET ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [{ data: clients }, { data: repairs }, { data: sales }, { data: loans }, { data: payments }] = await Promise.all([
          supabase.from("client_list").select("id, opening_balance, payment_due_date").eq("delete_flag", 0),
          pageAll(supabase.from("transaction_list").select("client_name, amount").eq("status", 5)),
          pageAll(supabase.from("direct_sales").select("client_id, total_amount")),
          pageAll(supabase.from("client_loans").select("client_id, total_payable")),
          pageAll(supabase.from("client_payments").select("client_id, amount, discount")),
        ]);
        const sumBy = <T,>(arr: T[] | null, key: keyof T, fn: (r: T) => number) => {
          const m = new Map<number, number>();
          (arr || []).forEach(r => { const id = Number(r[key]); if (id) m.set(id, (m.get(id) || 0) + fn(r)); });
          return m;
        };
        const rM = sumBy(repairs, "client_name", r => n(r.amount));
        const sM = sumBy(sales, "client_id", r => n(r.total_amount));
        const lM = sumBy(loans, "client_id", r => n(r.total_payable));
        const pM = sumBy(payments, "client_id", r => n(r.amount) + n(r.discount));
        const today = parseISTDate(todayIST()).getTime();
        let overdue = 0, todayC = 0, upcoming = 0, amount = 0;
        (clients || []).forEach((c) => {
          const bal = n(c.opening_balance) + (rM.get(c.id) || 0) + (sM.get(c.id) || 0) + (lM.get(c.id) || 0) - (pM.get(c.id) || 0);
          if (bal <= 0.01) return;
          amount += bal;
          if (!c.payment_due_date) return;
          const diff = Math.round((parseISTDate(c.payment_due_date).getTime() - today) / 86400000);
          if (diff < 0) overdue++;
          else if (diff === 0) todayC++;
          else if (diff <= 7) upcoming++;
        });
        setDueStats({ overdue, today: todayC, upcoming, amount });
      } catch (e) {
        console.error("Due stats fetch error:", e);
      }
    })();
  }, []);

  // ── FINANCIAL FETCH ──────────────────────────────────────────────────────
  const fetchFinancial = useCallback(async () => {
    if (!profile || profile.role !== "admin") return;
    setFinLoading(true);
    try {
      const f0 = `${from}T00:00:00+05:30`;
      const t0 = `${to}T23:59:59+05:30`;

      const [
        { data: tD }, { data: dD },
        { data: txIds }, { data: dIds },
        { data: discD }, { data: attD },
        { data: loanD }, { data: expD },
      ] = await Promise.all([
        pageAll(supabase.from("transaction_list").select("amount").eq("status", 5).eq("del_status", 0).gte("date_completed", f0).lte("date_completed", t0)),
        pageAll(supabase.from("direct_sales").select("total_amount").gte("date_created", f0).lte("date_created", t0)),
        pageAll(supabase.from("transaction_list").select("id").eq("status", 5).eq("del_status", 0).gte("date_completed", f0).lte("date_completed", t0)),
        pageAll(supabase.from("direct_sales").select("id").gte("date_created", f0).lte("date_created", t0)),
        pageAll(supabase.from("client_payments").select("discount").gte("payment_date", from).lte("payment_date", to)),
        pageAll(supabase.from("attendance_list").select("status, mechanic_id").gte("curr_date", from).lte("curr_date", to).in("status", [1, 3])),
        pageAll(supabase.from("loan_payments").select("amount_paid").gte("payment_date", from).lte("payment_date", to)),
        pageAll(supabase.from("expense_list").select("amount").gte("date_created", f0).lte("date_created", t0)),
      ]);

      const repairInc = (tD ?? []).reduce((s: number, t) => s + n(t.amount), 0);
      const directInc = (dD ?? []).reduce((s: number, d) => s + n(d.total_amount), 0);
      const totalSales = repairInc + directInc;

      const txList = (txIds ?? []).map((t) => t.id);
      let partsTrans = 0;
      if (txList.length) {
        const { data: tp } = await supabase.from("transaction_products").select("qty, price").in("transaction_id", txList);
        partsTrans = (tp ?? []).reduce((s: number, r) => s + n(r.qty) * n(r.price), 0);
      }
      const dList = (dIds ?? []).map((d) => d.id);
      let partsDirect = 0;
      if (dList.length) {
        const { data: di } = await supabase.from("direct_sale_items").select("qty, price").in("sale_id", dList);
        partsDirect = (di ?? []).reduce((s: number, r) => s + n(r.qty) * n(r.price), 0);
      }

      const partsCost = (partsTrans + partsDirect) * 0.9;
      const grossProfit = totalSales - partsCost;
      const discounts = (discD ?? []).reduce((s: number, p) => s + n(p.discount), 0);

      let salary = 0;
      if (attD?.length) {
        const mIds = [...new Set(attD.map((a) => a.mechanic_id).filter(Boolean))];
        const { data: mechs } = await supabase.from("mechanic_list").select("id, daily_salary").in("id", mIds);
        const sMap = Object.fromEntries((mechs ?? []).map((m) => [m.id, n(m.daily_salary)]));
        salary = attD.reduce((s: number, a) => {
          const d = sMap[a.mechanic_id] ?? 0;
          return s + (a.status === 1 ? d : a.status === 3 ? d / 2 : 0);
        }, 0);
      }

      const loanPaid = (loanD ?? []).reduce((s: number, l) => s + n(l.amount_paid), 0);
      const expenses = (expD ?? []).reduce((s: number, e) => s + n(e.amount), 0);
      const totalOutflow = discounts + salary + loanPaid + expenses;
      const netProfit = grossProfit - totalOutflow;

      setFinancial({ totalSales, partsCost, grossProfit, discounts, salary, loanPaid, expenses, totalOutflow, netProfit });
    } catch (e) {
      console.error("Financial fetch error:", e);
    } finally {
      setFinLoading(false);
    }
  }, [from, to, profile]);

  useEffect(() => { fetchFinancial(); }, [fetchFinancial]);

  // BUG FIX 1 applied in resetDates too
  const resetDates = () => {
    setFrom(startOfMonthIST());
    setTo(endOfMonthIST());
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0d1117]">
        <div className="relative">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/40">
            <Wrench className="text-white" size={30} />
          </div>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#0d1117] animate-ping" />
        </div>
        <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.35em]">V-TECH Loading…</p>
      </div>
    );
  }

  // Logged out — RootClient already redirects to /login. Guard here too
  // in case the dashboard is ever opened directly while signed out.
  if (authChecked && !isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-600" />
      </div>
    );
  }

  const displayName = profile?.full_name ?? "User";
  const isAdmin = profile?.role === "admin";
  const totalJobs = statusData.reduce((s, d) => s + d.value, 0);
  const profitPct = financial.totalSales > 0 ? ((financial.netProfit / financial.totalSales) * 100).toFixed(1) : "0";

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0d1117] text-white space-y-4 font-sans">

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━ HERO HEADER */}
      <header className="relative overflow-hidden rounded-3xl border border-[#21293d] bg-[#0d1117]">
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
        {/* Glows */}
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-1/4 w-56 h-56 bg-indigo-600/6 rounded-full blur-3xl pointer-events-none" />

        <div className="relative px-5 py-5 md:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-600/30">
                <Wrench className="text-white" size={24} />
              </div>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#0d1117] animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white leading-none">
                V-TECH <span className="text-blue-400">COMMAND</span>
              </h1>
              <p className="text-slate-600 text-[10px] font-black mt-1.5 tracking-[0.2em] uppercase">
                Swaagat hai, {displayName} ji!
              </p>
            </div>
          </div>
          <div className="self-start sm:self-center flex items-center gap-2">
            <button
              onClick={() => setQrOpen(true)}
              title="Phone pe site kholo"
              className="flex items-center gap-2 bg-[#111520] border border-[#21293d] hover:border-blue-500/50 text-slate-300 hover:text-white px-4 py-2.5 rounded-2xl font-bold text-xs transition-all active:scale-95"
            >
              <QrCode size={16} strokeWidth={2.5} /> QR
            </button>
            {installPrompt && !isInstalled && (
              <button
                onClick={async () => {
                  installPrompt.prompt();
                  const { outcome } = await installPrompt.userChoice;
                  if (outcome === 'accepted') setIsInstalled(true);
                  setInstallPrompt(null);
                }}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-4 py-2.5 rounded-2xl font-bold text-xs shadow-lg shadow-emerald-600/25 transition-all"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                Install App
              </button>
            )}
            <Link
              href="/jobs/new"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-5 py-2.5 rounded-2xl font-bold text-sm shadow-lg shadow-blue-600/25 transition-all no-underline"
            >
              <Zap size={15} strokeWidth={2.5} /> New Job
            </Link>
          </div>
        </div>
      </header>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━ LICENSE */}
      <LicenseInfoCard />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━ AI ALERTS */}
      <AIAlertsWidget />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━ FILTER */}
      <section className="bg-[#161b27] rounded-2xl border border-[#21293d] p-4">
        <div className="flex flex-wrap items-end gap-2.5">
          {[{ label: "From", val: from, fn: setFrom }, { label: "To", val: to, fn: setTo }].map(({ label, val, fn }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">{label}</label>
              <input type="date" value={val} onChange={e => fn(e.target.value)}
                className="bg-[#111520] border border-[#21293d] text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all [color-scheme:dark]" />
            </div>
          ))}
          <button onClick={fetchFinancial} disabled={finLoading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold text-sm transition h-[38px] shadow-lg shadow-blue-600/20">
            {finLoading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />} Apply
          </button>
          <button onClick={resetDates}
            className="flex items-center gap-2 bg-[#111520] border border-[#21293d] hover:border-slate-600 text-slate-400 hover:text-white px-4 py-2 rounded-xl font-bold text-sm transition h-[38px]">
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━ STAT CARDS */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Jobs" value={stats.totalJobs} icon={<Wrench size={18} />} color="slate" href="/jobs" />
        <StatCard label="Total Clients" value={stats.totalClients} icon={<Users size={18} />} color="blue" href="/clients" />
        <StatCard label="Pending" value={stats.pendingJobs} icon={<Clock size={18} />} color="amber" href="/jobs?status=0" />
        <StatCard label="In Progress" value={stats.inProgressJobs} icon={<Activity size={18} />} color="cyan" href="/jobs?status=1" />
        <StatCard label="Finished" value={stats.finishedJobs} icon={<CheckCircle size={18} />} color="emerald" href="/jobs?status=2" />
        <StatCard label="Delivered" value={stats.deliveredJobs} icon={<ArrowRight size={18} />} color="violet" href="/jobs?status=5" />
        <StatCard label="Mechanics" value={stats.totalMechanics} icon={<Users size={18} />} color="pink" href="/mechanics" />
        <StatCard label="Low Stock" value={stats.lowStock} icon={<AlertCircle size={18} />} color="red" href="/inventory" />
        <StatCard label="Today Revenue" value={inr(stats.todayRevenue, 2)} icon={<IndianRupee size={18} strokeWidth={2.5} />} color="indigo" />
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━ CHARTS */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Revenue Bar Chart */}
        <div className="lg:col-span-2 bg-[#161b27] rounded-3xl border border-[#21293d] p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-sm font-black text-white">Monthly Revenue</h3>
              <p className="text-slate-600 text-[10px] mt-0.5 font-bold uppercase tracking-wider">Last 12 months · Repair + Direct Sales</p>
            </div>
            <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black rounded-xl px-3 py-1 uppercase tracking-wider">₹ Revenue</span>
          </div>
          {revenueData.every(d => d.revenue === 0) ? (
            <EmptyChart label="Is period mein koi revenue nahi" />
          ) : (
            <ResponsiveContainer width="100%" minHeight={180} height={250}>
              <BarChart data={revenueData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barCategoryGap="25%">
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2234" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={v => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
                  tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} width={50}
                />
                <Tooltip content={<RevTooltip />} cursor={{ fill: "rgba(59,130,246,0.05)" }} />
                <Bar dataKey="revenue" fill="url(#revGrad)" radius={[5, 5, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status Donut */}
        <div className="bg-[#161b27] rounded-3xl border border-[#21293d] p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-white">Job Status</h3>
              <p className="text-slate-600 text-[10px] mt-0.5 font-bold uppercase tracking-wider">{totalJobs} total active jobs</p>
            </div>
            <span className="bg-[#111520] text-slate-600 text-[10px] font-black rounded-xl px-3 py-1 uppercase tracking-wider">All Time</span>
          </div>
          {statusData.length === 0 ? (
            <EmptyChart label="Koi job nahi mili" />
          ) : (
            <>
              <ResponsiveContainer width="100%" minHeight={150} height={180}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={74} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<StatusTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {statusData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-slate-500">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-black">{d.value}</span>
                      <span className="text-slate-700 text-[10px] w-7 text-right">{totalJobs > 0 ? ((d.value / totalJobs) * 100).toFixed(0) : 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━ FINANCIAL (admin only) */}
      {isAdmin && (
        <section className="bg-[#161b27] rounded-3xl border border-[#21293d] p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-sm font-black text-white">Financial Summary</h3>
              {/* BUG FIX 4 applied: fmtDate now parses local, not UTC */}
              <p className="text-slate-600 text-[10px] mt-0.5 font-bold uppercase tracking-wider">
                {fmtDate(from)} — {fmtDate(to)}
              </p>
            </div>
            {!finLoading && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-black px-4 py-1.5 rounded-2xl border ${financial.netProfit >= 0
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
                  : "text-red-400 bg-red-500/10 border-red-500/25"
                }`}>
                {financial.netProfit >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {profitPct}% {financial.netProfit >= 0 ? "Profit Margin" : "Loss"}
              </span>
            )}
          </div>

          {finLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-blue-400" size={28} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <FinCard icon={<DollarSign size={18} />} label="Total Sales" value={financial.totalSales} color="blue" />
                <FinCard icon={<Wrench size={18} />} label="Parts Cost (90%)" value={financial.partsCost} color="amber" isExpense />
                <FinCard icon={<Activity size={18} />} label="Gross Profit" value={financial.grossProfit} color="cyan" />
                <FinCard icon={<AlertCircle size={18} />} label="Discounts" value={financial.discounts} color="red" isExpense />
                <FinCard icon={<Users size={18} />} label="Staff Salary" value={financial.salary} color="slate" isExpense />
                <FinCard icon={<CreditCard size={18} />} label="Loan Repaid" value={financial.loanPaid} color="violet" isExpense />
                <FinCard icon={<IndianRupee size={18} />} label="Other Expenses" value={financial.expenses} color="rose" isExpense />
                {/* Net profit card */}
                <div className={`rounded-2xl border p-4 flex items-center gap-3 ${financial.netProfit >= 0
                    ? "bg-emerald-500/8 border-emerald-500/20"
                    : "bg-red-500/8 border-red-500/20"
                  }`}>
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${financial.netProfit >= 0 ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
                    {financial.netProfit >= 0
                      ? <TrendingUp size={18} className="text-emerald-400" />
                      : <TrendingDown size={18} className="text-red-400" />}
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Net Profit / Loss</p>
                    <p className={`text-xl font-black ${financial.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {inr(Math.abs(financial.netProfit), 2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 bg-[#111520] rounded-2xl p-4 border border-[#21293d]">
                <div className="flex justify-between text-[10px] text-slate-600 font-bold mb-2">
                  <span>Revenue vs Outflow</span>
                  <span>Total Sales {inr(financial.totalSales)}</span>
                </div>
                <div className="h-2 bg-[#21293d] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${financial.netProfit >= 0
                        ? "bg-gradient-to-r from-blue-500 to-emerald-500"
                        : "bg-gradient-to-r from-red-600 to-orange-500"
                      }`}
                    style={{
                      width: financial.totalSales > 0
                        ? `${Math.min(100, Math.max(0, (financial.grossProfit / financial.totalSales) * 100))}%`
                        : "0%",
                    }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-black">
                  <span className="text-red-400">Outflow {inr(financial.totalOutflow)}</span>
                  <span className={financial.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}>
                    Net {inr(financial.netProfit)}
                  </span>
                </div>
              </div>

              {/* Calculation Note */}
              <div className="mt-3 bg-slate-900/50 border border-slate-800 rounded-xl p-3">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2">Calculation Summary</p>
                <div className="space-y-1 text-[10px] text-slate-500 font-mono">
                  <div><span className="text-emerald-400">Total Sales</span> = Repair Jobs Income + Direct Sales Income</div>
                  <div><span className="text-cyan-400">Gross Profit</span> = Total Sales − Parts Cost (90%)</div>
                  <div><span className="text-red-400">Total Outflow</span> = Discounts + Staff Salary + Loan Repaid + Other Expenses</div>
                  <div><span className="text-blue-400">Net Profit</span> = Gross Profit − Total Outflow</div>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━ RECENT ACTIVITY */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recent Jobs */}
        <div className="bg-[#161b27] rounded-3xl border border-[#21293d] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#21293d]">
            <div>
              <h3 className="text-sm font-black text-white">Recent Jobs</h3>
              <p className="text-slate-600 text-[10px] font-bold uppercase tracking-wider">Latest 5 transactions</p>
            </div>
            <Link href="/jobs" className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-black transition no-underline uppercase tracking-wider">
              View All <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-[#1a2234]">
            {recentJobs.length === 0 ? (
              <EmptyRow icon={<Wrench size={26} />} label="Koi job nahi mili" />
            ) : recentJobs.map(job => {
              const sc = STATUS_META[job.status] ?? { color: "#94a3b8", label: "Unknown" };
              return (
                <div key={job.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sc.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <Link href={`/jobs/${job.id}`} className="text-blue-400 hover:text-blue-300 font-black text-sm no-underline">{job.job_id ?? "N/A"}</Link>
                      <span className="text-slate-500 text-xs truncate">{job.client_name}</span>
                    </div>
                    <p className="text-slate-600 text-xs truncate mt-0.5">{job.item}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-white font-black text-sm">{inr(job.amount)}</p>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: sc.color + "25", color: sc.color }}>
                      {sc.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-[#161b27] rounded-3xl border border-[#21293d] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#21293d]">
            <div>
              <h3 className="text-sm font-black text-white">Recent Payments</h3>
              <p className="text-slate-600 text-[10px] font-bold uppercase tracking-wider">Latest client payments</p>
            </div>
            <Link href="/payments" className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-black transition no-underline uppercase tracking-wider">
              View All <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-[#1a2234]">
            {recentPayments.length === 0 ? (
              <EmptyRow icon={<CreditCard size={26} />} label="Koi payment nahi mili" />
            ) : recentPayments.map(pay => (
              <div key={pay.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/8 border border-emerald-500/15 flex items-center justify-center flex-shrink-0">
                  <IndianRupee size={13} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-bold truncate">{pay.client_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="bg-[#111520] text-slate-500 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider">{pay.payment_mode}</span>
                    <span className="text-slate-600 text-[10px] font-bold">
                      {/* BUG FIX 4 applied to payment date too */}
                      {formatIST(pay.payment_date, { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                </div>
                <p className="text-emerald-400 font-black text-base flex-shrink-0">{inr(pay.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━ LOW STOCK */}
      <section className="bg-[#161b27] rounded-3xl border border-[#21293d] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#21293d]">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <AlertCircle size={13} className="text-red-400" /> Low Stock Alert
            </h3>
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-wider">Items below their alert level</p>
          </div>
          <Link href="/inventory" className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-black transition no-underline uppercase tracking-wider">
            Manage <ChevronRight size={12} />
          </Link>
        </div>
        {lowStockItems.length === 0 ? (
          <div className="py-10 text-center">
            <Package className="mx-auto mb-2 text-emerald-500/30" size={28} />
            <p className="text-emerald-500/50 text-sm font-bold">Sab stock theek hai ✓</p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {lowStockItems.map((item, i) => {
              const ratio = item.alert > 0 ? item.quantity / item.alert : 1;
              const u = item.quantity <= 0
                ? { bg: "bg-red-500/8", border: "border-red-500/20", text: "text-red-400" }
                : ratio <= 0.4
                  ? { bg: "bg-orange-500/8", border: "border-orange-500/20", text: "text-orange-400" }
                  : { bg: "bg-amber-500/8", border: "border-amber-500/15", text: "text-amber-400" };
              return (
                <div key={i} className={`${u.bg} border ${u.border} rounded-2xl p-3.5 flex items-center gap-3 hover:brightness-110 transition`}>
                  <div className={`w-10 h-10 rounded-xl border ${u.border} flex items-center justify-center flex-shrink-0 font-black text-sm ${u.text}`}>
                    {item.quantity}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-bold truncate">{item.name}</p>
                    <p className="text-slate-600 text-xs truncate">{item.place} · alert {item.alert}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━ DUE REMINDERS */}
      <section className="bg-[#161b27] rounded-3xl border border-[#21293d] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#21293d]">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <CalendarClock size={13} className="text-red-400" /> Payment Due Reminders
            </h3>
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-wider">
              Promised due dates · Overdue &amp; upcoming
            </p>
          </div>
          <Link href="/reports/due-reminders" className="flex items-center gap-1 text-red-400 hover:text-red-300 text-xs font-black transition no-underline uppercase tracking-wider">
            Open Report <ChevronRight size={12} />
          </Link>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-red-500/8 border border-red-500/20 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <AlertCircle size={12} /> Overdue
            </p>
            <p className="text-2xl font-black text-white mt-1">{dueStats.overdue}</p>
          </div>
          <div className="bg-orange-500/8 border border-orange-500/20 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
              <Clock size={12} /> Due Today
            </p>
            <p className="text-2xl font-black text-white mt-1">{dueStats.today}</p>
          </div>
          <div className="bg-cyan-500/8 border border-cyan-500/20 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <CalendarClock size={12} /> Upcoming 7d
            </p>
            <p className="text-2xl font-black text-white mt-1">{dueStats.upcoming}</p>
          </div>
          <div className="bg-violet-500/8 border border-violet-500/20 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
              <IndianRupee size={12} /> Total Due
            </p>
            <p className="text-2xl font-black text-white mt-1">{inr(dueStats.amount)}</p>
          </div>
        </div>
        {dueStats.overdue > 0 && (
          <div className="px-5 pb-4">
            <Link href="/reports/due-reminders?status=overdue"
              className="flex items-center justify-between gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-300 hover:bg-red-500/20 transition-all no-underline">
              <span className="text-xs font-bold flex items-center gap-2">
                <MessageCircle size={13} /> {dueStats.overdue} client{dueStats.overdue > 1 ? "s" : ""} ko WhatsApp reminder bhejein
              </span>
              <ChevronRight size={14} />
            </Link>
          </div>
        )}
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━ QR MODAL */}
      {qrOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setQrOpen(false)}>
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-xs shadow-2xl p-5 text-center"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2"><QrCode size={15} className="text-blue-400" /> Site QR</h3>
              <button onClick={() => setQrOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"><X size={16} /></button>
            </div>
            {qrDataUrl ? (
              <Image src={qrDataUrl} alt="Site QR Code" className="mx-auto rounded-xl bg-white p-2" width={220} height={220} unoptimized />
            ) : (
              <div className="h-[220px] flex items-center justify-center"><Loader2 className="animate-spin text-slate-600" /></div>
            )}
            <p className="text-slate-400 text-xs font-bold mt-3">Mobile camera se scan karke site kholo</p>
            <p className="text-slate-600 text-[10px] mt-1 break-all font-bold">{qrUrl || "…"}</p>
          </div>
        </div>
      )}

      <p className="text-center text-slate-800 text-xs font-bold pb-2">
        V-TECH Management System &mdash; {new Date().getFullYear()}
      </p>
    </div>
  );
}

// ─── Helper UI Components ─────────────────────────────────────────────────────
function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-[250px] text-slate-700 text-xs font-bold">{label}</div>
  );
}
function EmptyRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-700">
      <div className="opacity-20">{icon}</div>
      <p className="text-xs font-bold">{label}</p>
    </div>
  );
}

const STAT_C: Record<string, { border: string; icon: string; bg: string; value: string }> = {
  blue: { border: "border-blue-500/30", icon: "text-blue-400    bg-blue-500/15", bg: "bg-blue-500/10", value: "text-blue-400" },
  amber: { border: "border-amber-500/30", icon: "text-amber-400   bg-amber-500/15", bg: "bg-amber-500/10", value: "text-amber-400" },
  cyan: { border: "border-cyan-500/30", icon: "text-cyan-400    bg-cyan-500/15", bg: "bg-cyan-500/10", value: "text-cyan-400" },
  emerald: { border: "border-emerald-500/30", icon: "text-emerald-400 bg-emerald-500/15", bg: "bg-emerald-500/10", value: "text-emerald-400" },
  violet: { border: "border-violet-500/30", icon: "text-violet-400  bg-violet-500/15", bg: "bg-violet-500/10", value: "text-violet-400" },
  pink: { border: "border-pink-500/30", icon: "text-pink-400    bg-pink-500/15", bg: "bg-pink-500/10", value: "text-pink-400" },
  red: { border: "border-red-500/30", icon: "text-red-400     bg-red-500/15", bg: "bg-red-500/10", value: "text-red-400" },
  indigo: { border: "border-indigo-500/30", icon: "text-indigo-400  bg-indigo-500/15", bg: "bg-indigo-500/10", value: "text-indigo-400" },
  slate: { border: "border-slate-500/30", icon: "text-slate-400    bg-slate-500/15", bg: "bg-slate-500/10", value: "text-slate-300" },
};

function StatCard({ label, value, icon, color, href }: {
  label: string; value: string | number; icon: React.ReactNode; color: string; href?: string;
}) {
  const c = STAT_C[color] ?? STAT_C.blue;
  const inner = (
    <div className={`${c.bg} rounded-2xl border ${c.border} p-4 flex items-center gap-3 hover:brightness-110 transition-all duration-200 group cursor-pointer`}>
      <div className={`p-2.5 rounded-xl ${c.icon} flex-shrink-0`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] truncate">{label}</p>
        <p className={`text-xl font-black ${c.value} tracking-tight leading-none mt-0.5`}>{value}</p>
      </div>
      {href && <ChevronRight size={13} className="text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition" />}
    </div>
  );
  return href ? <Link href={href} className="no-underline block">{inner}</Link> : inner;
}

const FIN_C: Record<string, { bg: string; icon: string }> = {
  blue: { bg: "bg-blue-500/10", icon: "text-blue-400" },
  amber: { bg: "bg-amber-500/10", icon: "text-amber-400" },
  cyan: { bg: "bg-cyan-500/10", icon: "text-cyan-400" },
  red: { bg: "bg-red-500/10", icon: "text-red-400" },
  slate: { bg: "bg-slate-700/30", icon: "text-slate-400" },
  violet: { bg: "bg-violet-500/10", icon: "text-violet-400" },
  rose: { bg: "bg-rose-500/10", icon: "text-rose-400" },
};

function FinCard({ icon, label, value, color, isExpense }: {
  icon: React.ReactNode; label: string; value: number; color: string; isExpense?: boolean;
}) {
  const c = FIN_C[color] ?? FIN_C.blue;
  return (
    <div className="bg-[#111520] rounded-2xl border border-[#21293d] p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${c.bg} flex-shrink-0`}>
        <div className={c.icon}>{icon}</div>
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.12em] truncate">{label}</p>
        <p className={`text-lg font-black truncate ${isExpense ? "text-red-400" : "text-white"}`}>
          {inr(value, 0)}
        </p>
      </div>
    </div>
  );
}