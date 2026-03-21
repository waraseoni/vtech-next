"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";
import {
  Wrench, Clock, CheckCircle, IndianRupee, TrendingUp, TrendingDown,
  Users, ArrowRight, AlertCircle, Zap, Loader2, DollarSign, CreditCard,
  Filter, RotateCcw, Package, Activity, ChevronRight, ShieldCheck,
} from "lucide-react";
import Navbar from "./components/Navbar";

// ─── PUBLIC WEBSITE (shown when not logged in) ─────────────────────────────
function PublicWebsite() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        {/* Hero */}
        <section className="text-center" style={{
          background: "linear-gradient(rgba(15,15,26,0.92), rgba(15,15,26,0.95))",
          minHeight: "calc(100vh - 60px)", display: "flex", alignItems: "center",
        }}>
          <div className="max-w-5xl mx-auto px-4">
            <h1 style={{ fontSize: "3.5rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "20px" }}>
              Expert Stage Lighting &amp;<br/>Power Supply Repair Center
            </h1>
            <p style={{ fontSize: "1.2rem", maxWidth: "900px", margin: "0 auto 40px", lineHeight: 1.6, color: "#94a3b8" }}>
              SMPS | Sharpy | Moving Head | Par Lights | DMX | Laser | LED Wall | Fog Machine<br/>
              Fast Repair • Genuine Parts • Same Day Service
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a href="tel:9179105875" style={{ background: "#3b82f6", color: "white", padding: "16px 40px", fontSize: "1.1rem", borderRadius: "50px", textDecoration: "none", fontWeight: 600 }}>
                Call +91 917910 5875
              </a>
              <a href="https://wa.me/9179105875" target="_blank" rel="noopener" style={{ background: "#25d366", color: "white", padding: "16px 40px", fontSize: "1.1rem", borderRadius: "50px", textDecoration: "none", fontWeight: 600 }}>
                WhatsApp Us
              </a>
            </div>
          </div>
        </section>

        {/* Services */}
        <section className="py-20 px-4" style={{ background: "#0f0f1a" }}>
          <div className="max-w-6xl mx-auto">
            <h2 className="text-center mb-12" style={{ fontSize: "2.5rem", fontWeight: 700 }}>Our Professional <span style={{ color: "#3b82f6" }}>Repair Services</span></h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: "⚡", title: "SMPS & Power Supply", desc: "All types of Switch Mode Power Supply Repair" },
                { icon: "💡", title: "Sharpy & Moving Head", desc: "Beam, Color Wheel, Gobo, Motor Repair" },
                { icon: "🎤", title: "Par Light & LED Par", desc: "RGBW, Driver Board, LED Replacement" },
                { icon: "🎛️", title: "DMX Controller & Console", desc: "DMX 512, Motherboard, Touch Screen Repair" },
                { icon: "🌫️", title: "Fog & Smoke Machine", desc: "Pump, Heating Element, PCB Repair" },
                { icon: "📺", title: "LED Wall & Processor", desc: "Module, Receiving Card, Power Supply Fix" },
                { icon: "🔦", title: "Laser Light Repair", desc: "Galvo, Driver, Diode Replacement" },
                { icon: "🛠️", title: "All Stage Equipment", desc: "Strobe, Follow Spot, Effect Lights etc." },
              ].map((s, i) => (
                <div key={i} className="text-center p-5 rounded-xl border border-[#333] hover:border-[#3b82f6] transition" style={{ background: "#1a1a2e" }}>
                  <div className="text-3xl mb-3">{s.icon}</div>
                  <h4 className="text-sm font-bold mb-2">{s.title}</h4>
                  <p className="text-xs" style={{ color: "#94a3b8" }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-20 px-4" style={{ background: "#16213e" }}>
          <div className="max-w-6xl mx-auto">
            <h2 className="text-center mb-12" style={{ fontSize: "2.5rem", fontWeight: 700 }}>Why Choose <span style={{ color: "#3b82f6" }}>V-Technologies</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              {[
                { icon: "⚡", title: "Express Repair", desc: "Most jobs done same day" },
                { icon: "⚙️", title: "Genuine Parts", desc: "100% original spares used" },
                { icon: "💰", title: "Best Rates", desc: "Transparent & fair pricing" },
              ].map((f, i) => (
                <div key={i}>
                  <div className="text-3xl mb-3" style={{ color: "#3b82f6" }}>{f.icon}</div>
                  <h4 style={{ fontSize: "1.3rem", marginBottom: "10px" }}>{f.title}</h4>
                  <p style={{ color: "#94a3b8" }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="py-16 px-4 text-center" style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "white" }}>
          <div className="max-w-3xl mx-auto">
            <h2 style={{ fontSize: "2.2rem", marginBottom: "1.5rem" }}>Need Urgent Repair? Contact Us Now!</h2>
            <p style={{ fontSize: "1.2rem" }}>
              📞 +91 91791 05875<br/>📍 Marhatal, Jabalpur, MP
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 text-center" style={{ background: "#0f0f1a" }}>
          <p className="text-xs" style={{ color: "#94a3b8" }}>© {new Date().getFullYear()} V-Technologies. Made with ❤️ in Jabalpur</p>
        </footer>

        {/* Floating WhatsApp */}
        <a href="https://wa.me/+919179105875" target="_blank" rel="noopener" style={{
          position: "fixed", bottom: "20px", right: "20px", zIndex: 9999,
          background: "#25d366", width: "60px", height: "60px", borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "24px", color: "white", boxShadow: "0 8px 25px rgba(0,0,0,0.4)", textDecoration: "none",
        }}>💬</a>
      </div>
    </>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Profile      = { full_name: string; role: string };
type Stat         = { totalClients: number; pendingJobs: number; inProgressJobs: number; finishedJobs: number; deliveredJobs: number; totalMechanics: number; lowStock: number; todayRevenue: number; };
type Financial    = { totalSales: number; partsCost: number; grossProfit: number; discounts: number; salary: number; loanPaid: number; expenses: number; totalOutflow: number; netProfit: number; };
type RecentJob    = { id: number; job_id: string | null; client_name: string; item: string; amount: number; status: number; };
type RecentPayment = { id: number; amount: number; payment_mode: string; payment_date: string; client_name: string; };
type LowStockItem = { name: string; quantity: number; place: string };
type RevenuePoint = { month: string; revenue: number };
type StatusPoint  = { name: string; value: number; color: string };

const STATUS_META = [
  { label: "Pending",     color: "#94a3b8" },
  { label: "In Progress", color: "#f59e0b" },
  { label: "Finished",    color: "#06b6d4" },
  { label: "Paid",        color: "#10b981" },
  { label: "Cancelled",   color: "#ef4444" },
  { label: "Delivered",   color: "#3b82f6" },
];

import { todayIST, formatIST, parseISTDate, toISTString, toLocalStr, startOfMonthIST, endOfMonthIST } from "@/lib/dateUtils";

// ─── Timezone-safe helpers ────────────────────────────────────────────────────
// BUG FIX 3: Financial filter timestamps need explicit IST offset.
// from + 'T00:00:00' → server-local (likely UTC on Vercel) → wrong records.
// Fix: always append +05:30 so Supabase understands IST.
const istStart = (d: string) => `${d}T00:00:00+05:30`;
const istEnd   = (d: string) => `${d}T23:59:59+05:30`;

// BUG FIX 4: fmtDate — new Date('YYYY-MM-DD') parses as UTC midnight.
// In IST, UTC midnight = 5:30 AM → date shifts back 1 day in display.
// Fix: parse manually as local date.
const fmtDate = (d: string) =>
  formatIST(d, {
    day: "2-digit", month: "short", year: "numeric",
  });

const isoDate = (iso: string) => (iso ? iso.split("T")[0] : "");
const n = (v: unknown) => { const x = Number(v); return isNaN(x) ? 0 : x; };
const inr = (v: number, digits = 0) =>
  "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// ─── Recharts custom tooltips ─────────────────────────────────────────────────
const RevTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111520] border border-[#21293d] rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-500 mb-0.5 font-bold">{label}</p>
      <p className="text-blue-400 font-black text-sm">{inr(n(payload[0]?.value), 2)}</p>
    </div>
  );
};
const StatusTooltip = ({ active, payload }: any) => {
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
  const [isLoggedIn,  setIsLoggedIn]  = useState<boolean | null>(null);
  const [profile,        setProfile]        = useState<Profile | null>(null);
  const [stats,          setStats]          = useState<Stat>({ totalClients: 0, pendingJobs: 0, inProgressJobs: 0, finishedJobs: 0, deliveredJobs: 0, totalMechanics: 0, lowStock: 0, todayRevenue: 0 });
  const [financial,      setFinancial]      = useState<Financial>({ totalSales: 0, partsCost: 0, grossProfit: 0, discounts: 0, salary: 0, loanPaid: 0, expenses: 0, totalOutflow: 0, netProfit: 0 });
  const [revenueData,    setRevenueData]    = useState<RevenuePoint[]>([]);
  const [statusData,     setStatusData]     = useState<StatusPoint[]>([]);
  const [recentJobs,     setRecentJobs]     = useState<RecentJob[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [lowStockItems,  setLowStockItems]  = useState<LowStockItem[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [finLoading,     setFinLoading]     = useState(false);

  // ── AUTH CHECK ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
      setAuthChecked(true);
    });
  }, []);

  // BUG FIX 1 applied: use toLocalStr instead of .toISOString().split('T')[0]
  const [from, setFrom] = useState(() => startOfMonthIST());
  const [to, setTo] = useState(() => endOfMonthIST());

  // ── MAIN DATA FETCH ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: pd } = await supabase
            .from("profiles").select("full_name, role").eq("id", user.id).single();
          setProfile(pd ?? {
            full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
            role: "staff",
          });
        }

        // BUG FIX 2: use todayIST() — not new Date().toISOString().split('T')[0]
        const today = todayIST();

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
          supabase.from("transaction_list").select("id, status, amount, date_completed, client_name").eq("del_status", 0),
          supabase.from("client_list").select("*", { count: "exact", head: true }).eq("delete_flag", 0),
          supabase.from("mechanic_list").select("*", { count: "exact", head: true }).eq("delete_flag", 0).eq("status", 1),
          supabase.from("inventory_list").select("product_id").lte("quantity", 5),
          supabase.from("direct_sales").select("total_amount, date_created"),
          supabase.from("transaction_list").select("id, job_id, client_name, item, amount, status").eq("del_status", 0).order("id", { ascending: false }).limit(5),
          supabase.from("client_payments").select("id, amount, payment_mode, payment_date, client_id").order("payment_date", { ascending: false }).order("id", { ascending: false }).limit(10),
          supabase.from("inventory_list").select("quantity, place, product_id").lte("quantity", 5).order("quantity", { ascending: true }).limit(10),
        ]);

        const active   = allTrans    ?? [];
        const dirSales = dirSalesAll ?? [];

        const lowStock = lowInv
          ? [...new Set(lowInv.map((i: any) => i.product_id))].length : 0;

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

        setStatusData(
          STATUS_META.map((m, i) => ({
            name: m.label, color: m.color,
            value: active.filter((t: any) => t.status === i).length,
          })).filter(d => d.value > 0)
        );

        // BUG FIX 5: Monthly revenue chart — use toLocalStr not toISOString.split
        const pts: RevenuePoint[] = [];
        for (let i = 11; i >= 0; i--) {
          const md = new Date();
          md.setDate(1); // Set to 1st first to avoid month skipping
          md.setMonth(md.getMonth() - i);
          
          const start = startOfMonthIST(md);
          const end   = endOfMonthIST(md);
          const rep = active
            .filter((t: any) => t.status === 5 && isoDate(t.date_completed ?? "") >= start && isoDate(t.date_completed ?? "") <= end)
            .reduce((s: number, t: any) => s + n(t.amount), 0);
          const dir = dirSales
            .filter((d: any) => isoDate(d.date_created ?? "") >= start && isoDate(d.date_created ?? "") <= end)
            .reduce((s: number, d: any) => s + n(d.total_amount), 0);
          pts.push({
            month:   md.toLocaleString("default", { month: "short", year: "2-digit" }),
            revenue: rep + dir,
          });
        }
        setRevenueData(pts);

        // Recent jobs — resolve client names
        if (recentTransRaw?.length) {
          const cIds = [...new Set(recentTransRaw.map((t: any) => parseInt(t.client_name)).filter((x: number) => !isNaN(x)))];
          const { data: cls } = cIds.length
            ? await supabase.from("client_list").select("id, firstname, lastname").in("id", cIds)
            : { data: [] };
          const cMap = Object.fromEntries((cls ?? []).map((c: any) => [c.id, `${c.firstname ?? ""} ${c.lastname ?? ""}`.trim()]));
          setRecentJobs(recentTransRaw.map((t: any) => ({
            ...t, amount: n(t.amount),
            client_name: cMap[parseInt(t.client_name)] || "Walk-in",
          })));
        }

        // Recent payments — resolve client names
        if (paymentsRaw?.length) {
          const cIds2 = [...new Set(paymentsRaw.map((p: any) => p.client_id).filter(Boolean))];
          const { data: cls2 } = cIds2.length
            ? await supabase.from("client_list").select("id, firstname, lastname").in("id", cIds2)
            : { data: [] };
          const cMap2 = Object.fromEntries((cls2 ?? []).map((c: any) => [c.id, `${c.firstname ?? ""} ${c.lastname ?? ""}`.trim()]));
          setRecentPayments(paymentsRaw.map((p: any) => ({
            id: p.id, amount: n(p.amount), payment_mode: p.payment_mode ?? "Cash",
            payment_date: p.payment_date, client_name: cMap2[p.client_id] ?? "Unknown",
          })));
        }

        // Low stock — resolve product names
        if (lowInvDetail?.length) {
          const pIds = [...new Set(lowInvDetail.map((i: any) => i.product_id).filter(Boolean))];
          const { data: prods } = pIds.length
            ? await supabase.from("product_list").select("id, name").in("id", pIds)
            : { data: [] };
          const pMap = Object.fromEntries((prods ?? []).map((p: any) => [p.id, p.name]));
          setLowStockItems(lowInvDetail.map((i: any) => ({
            name: pMap[i.product_id] ?? "Unknown", quantity: n(i.quantity), place: i.place ?? "—",
          })));
        }
      } catch (e) {
        console.error("Dashboard fetch error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── FINANCIAL FETCH ──────────────────────────────────────────────────────
  const fetchFinancial = useCallback(async () => {
    if (!profile || profile.role !== "admin") return;
    setFinLoading(true);
    try {
      // BUG FIX 3: Use +05:30 suffix for IST-aware filtering.
      // Original: from + 'T00:00:00' → server local (UTC on Vercel) → wrong IST records.
      const f0 = istStart(from);
      const t0 = istEnd(to);

      const [
        { data: tD }, { data: dD },
        { data: txIds }, { data: dIds },
        { data: discD }, { data: attD },
        { data: loanD }, { data: expD },
      ] = await Promise.all([
        supabase.from("transaction_list").select("amount").eq("status", 5).eq("del_status", 0).gte("date_completed", f0).lte("date_completed", t0),
        supabase.from("direct_sales").select("total_amount").gte("date_created", f0).lte("date_created", t0),
        supabase.from("transaction_list").select("id").eq("status", 5).eq("del_status", 0).gte("date_completed", f0).lte("date_completed", t0),
        supabase.from("direct_sales").select("id").gte("date_created", f0).lte("date_created", t0),
        supabase.from("client_payments").select("discount").gte("payment_date", from).lte("payment_date", to),
        supabase.from("attendance_list").select("status, mechanic_id").gte("curr_date", from).lte("curr_date", to).in("status", [1, 3]),
        supabase.from("loan_payments").select("amount_paid").gte("payment_date", from).lte("payment_date", to),
        supabase.from("expense_list").select("amount").gte("date_created", f0).lte("date_created", t0),
      ]);

      const repairInc  = (tD ?? []).reduce((s: number, t: any) => s + n(t.amount), 0);
      const directInc  = (dD ?? []).reduce((s: number, d: any) => s + n(d.total_amount), 0);
      const totalSales = repairInc + directInc;

      const txList = (txIds ?? []).map((t: any) => t.id);
      let partsTrans = 0;
      if (txList.length) {
        const { data: tp } = await supabase.from("transaction_products").select("qty, price").in("transaction_id", txList);
        partsTrans = (tp ?? []).reduce((s: number, r: any) => s + n(r.qty) * n(r.price), 0);
      }
      const dList = (dIds ?? []).map((d: any) => d.id);
      let partsDirect = 0;
      if (dList.length) {
        const { data: di } = await supabase.from("direct_sale_items").select("qty, price").in("sale_id", dList);
        partsDirect = (di ?? []).reduce((s: number, r: any) => s + n(r.qty) * n(r.price), 0);
      }

      const partsCost   = (partsTrans + partsDirect) * 0.9;
      const grossProfit = totalSales - partsCost;
      const discounts   = (discD ?? []).reduce((s: number, p: any) => s + n(p.discount), 0);

      let salary = 0;
      if (attD?.length) {
        const mIds = [...new Set(attD.map((a: any) => a.mechanic_id).filter(Boolean))];
        const { data: mechs } = await supabase.from("mechanic_list").select("id, salary_per_day, daily_salary").in("id", mIds);
        const sMap = Object.fromEntries((mechs ?? []).map((m: any) => [m.id, n(m.salary_per_day) || n(m.daily_salary)]));
        salary = attD.reduce((s: number, a: any) => {
          const d = sMap[a.mechanic_id] ?? 0;
          return s + (a.status === 1 ? d : a.status === 3 ? d / 2 : 0);
        }, 0);
      }

      const loanPaid     = (loanD ?? []).reduce((s: number, l: any) => s + n(l.amount_paid), 0);
      const expenses     = (expD  ?? []).reduce((s: number, e: any) => s + n(e.amount), 0);
      const totalOutflow = discounts + salary + loanPaid + expenses;
      const netProfit    = grossProfit - totalOutflow;

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

  // If not logged in, show public website
  if (authChecked && !isLoggedIn) {
    return <PublicWebsite />;
  }

  const displayName = profile?.full_name ?? "User";
  const isAdmin     = profile?.role === "admin";
  const totalJobs   = statusData.reduce((s, d) => s + d.value, 0);
  const profitPct   = financial.totalSales > 0 ? ((financial.netProfit / financial.totalSales) * 100).toFixed(1) : "0";

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
          <Link
            href="/jobs/new"
            className="self-start sm:self-center flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-5 py-2.5 rounded-2xl font-bold text-sm shadow-lg shadow-blue-600/25 transition-all no-underline"
          >
            <Zap size={15} strokeWidth={2.5} /> New Job
          </Link>
        </div>
      </header>

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
        <StatCard label="Total Clients"  value={stats.totalClients}      icon={<Users size={18}/>}         color="blue"    href="/clients" />
        <StatCard label="Pending"        value={stats.pendingJobs}        icon={<Clock size={18}/>}         color="amber"   href="/jobs?status=0" />
        <StatCard label="In Progress"    value={stats.inProgressJobs}     icon={<Activity size={18}/>}     color="cyan"    href="/jobs?status=1" />
        <StatCard label="Finished"       value={stats.finishedJobs}       icon={<CheckCircle size={18}/>}  color="emerald" href="/jobs?status=2" />
        <StatCard label="Delivered"      value={stats.deliveredJobs}      icon={<ArrowRight size={18}/>}   color="violet"  href="/jobs?status=5" />
        <StatCard label="Mechanics"      value={stats.totalMechanics}     icon={<Users size={18}/>}        color="pink"    href="/mechanics" />
        <StatCard label="Low Stock"      value={stats.lowStock}           icon={<AlertCircle size={18}/>}  color="red"     href="/inventory" />
        <StatCard label="Today Revenue"  value={inr(stats.todayRevenue, 2)} icon={<IndianRupee size={18} strokeWidth={2.5}/>} color="indigo" />
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
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barCategoryGap="25%">
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.5}  />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2234" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={v => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`}
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
              <ResponsiveContainer width="100%" height={180}>
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
              <span className={`inline-flex items-center gap-1.5 text-xs font-black px-4 py-1.5 rounded-2xl border ${
                financial.netProfit >= 0
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
                <FinCard icon={<DollarSign size={18}/>}  label="Total Sales"      value={financial.totalSales}  color="blue" />
                <FinCard icon={<Wrench size={18}/>}      label="Parts Cost (90%)" value={financial.partsCost}   color="amber" isExpense />
                <FinCard icon={<Activity size={18}/>}    label="Gross Profit"     value={financial.grossProfit} color="cyan" />
                <FinCard icon={<AlertCircle size={18}/>} label="Discounts"        value={financial.discounts}   color="red"  isExpense />
                <FinCard icon={<Users size={18}/>}       label="Staff Salary"     value={financial.salary}      color="slate" isExpense />
                <FinCard icon={<CreditCard size={18}/>}  label="Loan Repaid"      value={financial.loanPaid}    color="violet" isExpense />
                <FinCard icon={<IndianRupee size={18}/>} label="Other Expenses"   value={financial.expenses}    color="rose" isExpense />
                {/* Net profit card */}
                <div className={`rounded-2xl border p-4 flex items-center gap-3 ${
                  financial.netProfit >= 0
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
                    className={`h-full rounded-full transition-all duration-700 ${
                      financial.netProfit >= 0
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
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-wider">Items with quantity ≤ 5</p>
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
              const u = item.quantity === 0
                ? { bg: "bg-red-500/8",    border: "border-red-500/20",    text: "text-red-400"    }
                : item.quantity <= 2
                ? { bg: "bg-orange-500/8", border: "border-orange-500/20", text: "text-orange-400" }
                : { bg: "bg-amber-500/8",  border: "border-amber-500/15",  text: "text-amber-400"  };
              return (
                <div key={i} className={`${u.bg} border ${u.border} rounded-2xl p-3.5 flex items-center gap-3 hover:brightness-110 transition`}>
                  <div className={`w-10 h-10 rounded-xl border ${u.border} flex items-center justify-center flex-shrink-0 font-black text-sm ${u.text}`}>
                    {item.quantity}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-bold truncate">{item.name}</p>
                    <p className="text-slate-600 text-xs truncate">{item.place}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

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

const STAT_C: Record<string, { border: string; icon: string }> = {
  blue:    { border: "border-blue-500/20",    icon: "text-blue-400    bg-blue-500/10"    },
  amber:   { border: "border-amber-500/20",   icon: "text-amber-400   bg-amber-500/10"   },
  cyan:    { border: "border-cyan-500/20",    icon: "text-cyan-400    bg-cyan-500/10"    },
  emerald: { border: "border-emerald-500/20", icon: "text-emerald-400 bg-emerald-500/10" },
  violet:  { border: "border-violet-500/20",  icon: "text-violet-400  bg-violet-500/10"  },
  pink:    { border: "border-pink-500/20",    icon: "text-pink-400    bg-pink-500/10"    },
  red:     { border: "border-red-500/20",     icon: "text-red-400     bg-red-500/10"     },
  indigo:  { border: "border-indigo-500/20",  icon: "text-indigo-400  bg-indigo-500/10"  },
};

function StatCard({ label, value, icon, color, href }: {
  label: string; value: string | number; icon: React.ReactNode; color: string; href?: string;
}) {
  const c = STAT_C[color] ?? STAT_C.blue;
  const inner = (
    <div className={`bg-[#161b27] rounded-2xl border ${c.border} p-4 flex items-center gap-3 hover:bg-[#1a2234] transition-all duration-200 group cursor-pointer`}>
      <div className={`p-2.5 rounded-xl ${c.icon} flex-shrink-0`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.15em] truncate">{label}</p>
        <p className="text-xl font-black text-white tracking-tight leading-none mt-0.5">{value}</p>
      </div>
      {href && <ChevronRight size={13} className="text-slate-700 group-hover:text-slate-500 flex-shrink-0 transition" />}
    </div>
  );
  return href ? <Link href={href} className="no-underline block">{inner}</Link> : inner;
}

const FIN_C: Record<string, { bg: string; icon: string }> = {
  blue:   { bg: "bg-blue-500/10",   icon: "text-blue-400"   },
  amber:  { bg: "bg-amber-500/10",  icon: "text-amber-400"  },
  cyan:   { bg: "bg-cyan-500/10",   icon: "text-cyan-400"   },
  red:    { bg: "bg-red-500/10",    icon: "text-red-400"    },
  slate:  { bg: "bg-slate-700/30",  icon: "text-slate-400"  },
  violet: { bg: "bg-violet-500/10", icon: "text-violet-400" },
  rose:   { bg: "bg-rose-500/10",   icon: "text-rose-400"   },
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