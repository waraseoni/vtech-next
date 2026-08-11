"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Package, Plus, Edit3, Trash2,
  Boxes, MapPin, Calendar,
  Wrench, ShoppingCart, IndianRupee, BarChart3, Hash,
  ArrowDownToLine, ArrowUpFromLine, ExternalLink, Info,
  ChevronRight, Zap, CircleDot,
} from "lucide-react";
import StockModal from "./components/StockModal";
import { logActivity } from "@/lib/activity";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: number;
  name: string;
  description: string;
  cost_price: number;
  price: number;
  image_path: string | null;
}

interface StockIn {
  id: number;
  quantity: number;
  place: string | null;
  stock_date: string;
}

interface StockOut {
  id: number;
  date: string;
  reference: string;
  type: "Repair Job" | "Direct Sale";
  client_name: string;
  qty: number;
  price: number;
  total: number;
  link: string;
}

// ─── Stock status helper ──────────────────────────────────────────────────────
const getStockStatus = (avail: number) => {
  if (avail <= 0) return {
    label: "Out of Stock", color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/25", bar: "bg-red-500",
    barTrack: "bg-red-500/10", glow: "shadow-red-500/20",
  };
  if (avail <= 5) return {
    label: "Low Stock", color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/25", bar: "bg-amber-400",
    barTrack: "bg-amber-500/10", glow: "shadow-amber-500/20",
  };
  return {
    label: "In Stock", color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/25", bar: "bg-emerald-500",
    barTrack: "bg-emerald-500/10", glow: "shadow-emerald-500/20",
  };
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// ─── Mini radial-like progress ring using SVG ─────────────────────────────────
function StockRing({ available, totalIn }: { available: number; totalIn: number }) {
  const pct  = totalIn > 0 ? Math.max(0, Math.min(100, (available / totalIn) * 100)) : 0;
  const r    = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const st   = getStockStatus(available);

  return (
    <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none"
          stroke={available <= 0 ? "#ef4444" : available <= 5 ? "#f59e0b" : "#10b981"}
          strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-black ${st.color}`}>{available}</span>
        <span className="text-[8px] text-slate-700 font-bold uppercase tracking-widest">avail</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProductDetailPage() {
  const params    = useParams();
  const productId = Number(params.id);

  const [product,      setProduct]      = useState<Product | null>(null);
  const [stockIn,      setStockIn]      = useState<StockIn[]>([]);
  const [stockOut,     setStockOut]     = useState<StockOut[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editingStock, setEditingStock] = useState<StockIn | null>(null);
  const [stats,        setStats]        = useState({ totalIn: 0, totalSold: 0, available: 0, revenue: 0, stockValue: 0 });
  const [activeTab,    setActiveTab]    = useState<"in" | "out">("in");

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Product
      const { data: prod, error: prodErr } = await supabase
        .from("product_list").select("*").eq("id", productId).single();
      if (prodErr) throw prodErr;
      setProduct(prod);

      // Stock-in
      const { data: stockInData } = await supabase
        .from("inventory_list").select("*").eq("product_id", productId)
        .order("stock_date", { ascending: false });
      setStockIn(stockInData || []);
      const totalIn = stockInData?.reduce((s, r) => s + r.quantity, 0) || 0;

      // Stock-out: Repair Jobs
      const { data: jobItems } = await supabase
        .from("transaction_products")
        .select("qty, price, transaction_id").eq("product_id", productId);

      const jobOut: StockOut[] = [];
      if (jobItems?.length) {
        const txnIds = jobItems.map(i => i.transaction_id);
        const { data: txns } = await supabase
          .from("transaction_list")
          .select("id, date_created, job_id, code, status, client_name")
          .in("id", txnIds).neq("status", 4);

        if (txns) {
          const cids = [...new Set(txns.map(t => Number(t.client_name)))];
          const { data: clients } = await supabase
            .from("client_list").select("id, firstname, middlename, lastname").in("id", cids);
          const cMap = new Map(clients?.map(c => [
            c.id, [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ")
          ]));
          const tMap = new Map(txns.map(t => [t.id, t]));
          jobItems.forEach(item => {
            const t = tMap.get(item.transaction_id);
            if (t) jobOut.push({
              id: t.id, date: t.date_created,
              reference: t.job_id || t.code, type: "Repair Job",
              client_name: cMap.get(Number(t.client_name)) || "N/A",
              qty: item.qty, price: item.price, total: item.qty * item.price,
              link: `/jobs/${t.id}`,
            });
          });
        }
      }

      // Stock-out: Direct Sales
      const { data: saleItems } = await supabase
        .from("direct_sale_items")
        .select("qty, price, sale_id").eq("product_id", productId);

      const saleOut: StockOut[] = [];
      if (saleItems?.length) {
        const saleIds = saleItems.map(i => i.sale_id);
        const { data: sales } = await supabase
          .from("direct_sales").select("id, date_created, sale_code, client_id").in("id", saleIds);
        if (sales) {
          const cids = [...new Set(sales.map(s => s.client_id).filter(Boolean))];
          const { data: clients } = await supabase
            .from("client_list").select("id, firstname, middlename, lastname").in("id", cids);
          const cMap = new Map(clients?.map(c => [
            c.id, [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ")
          ]));
          const sMap = new Map(sales.map(s => [s.id, s]));
          saleItems.forEach(item => {
            const s = sMap.get(item.sale_id);
            if (s) saleOut.push({
              id: s.id, date: s.date_created,
              reference: s.sale_code, type: "Direct Sale",
              client_name: cMap.get(s.client_id) || "Walk-in",
              qty: item.qty, price: item.price, total: item.qty * item.price,
              link: `/direct-sales/${s.id}/view`,
            });
          });
        }
      }

      const allOut = [...jobOut, ...saleOut].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setStockOut(allOut);

      const totalSold  = allOut.reduce((s, o) => s + o.qty, 0);
      const revenue    = allOut.reduce((s, o) => s + o.total, 0);
      const stockValue = (totalIn - totalSold) * (prod?.price || 0);
      setStats({ totalIn, totalSold, available: totalIn - totalSold, revenue, stockValue });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeleteStock = async (id: number) => {
    if (!confirm("Delete this stock entry?")) return;
    const entry = stockIn.find(s => s.id === id);
    const { error } = await supabase.from("inventory_list").delete().eq("id", id);
    if (!error) {
      await logActivity('Deleted Stock Entry', 'Inventory', productId, `${product?.name || "Unknown"}: Removed entry of ${entry?.quantity} units (ID: ${id})`);
      fetchData();
    } else alert("Failed to delete: " + error.message);
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const st  = getStockStatus(stats.available);

  // Monthly movement chart data (last 6 months)
  const monthlyOut = useMemo(() => {
    const now    = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        label: d.toLocaleDateString("en-IN", { month: "short" }),
        year:  d.getFullYear(),
        month: d.getMonth(),
        qty:   0,
      };
    });
    stockOut.forEach(o => {
      const d = new Date(o.date);
      const m = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
      if (m) m.qty += o.qty;
    });
    const max = Math.max(...months.map(m => m.qty), 1);
    return months.map(m => ({ ...m, pct: (m.qty / max) * 100 }));
  }, [stockOut]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Package size={28} className="text-blue-500/60" />
          </div>
          <div className="absolute inset-0 rounded-2xl border border-blue-500/40 animate-ping" />
        </div>
        <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.3em]">Loading Product...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center bg-[#161b27] border border-[#21293d] rounded-2xl p-10">
          <Package size={40} className="mx-auto text-slate-700 mb-3" />
          <h2 className="text-xl font-black text-white">Product not found</h2>
          <Link href="/inventory" className="text-blue-400 hover:text-blue-300 text-sm mt-3 inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Back to Inventory
          </Link>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-16">

      {/* ── HERO HEADER ── */}
      <div className="relative overflow-hidden bg-[#0d1117] border-b border-[#21293d]">
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-blue-600/8 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-700 mb-4 font-bold uppercase tracking-wider">
            <Link href="/inventory" className="hover:text-slate-500 transition-colors">Inventory</Link>
            <ChevronRight size={10} />
            <span className="text-slate-500 truncate max-w-[200px]">{product.name}</span>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-5">
            {/* Left: product identity */}
            <div className="flex items-start gap-4">
              <Link href="/inventory"
                className="mt-1 p-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] rounded-xl text-slate-500 hover:text-slate-300 transition-all flex-shrink-0">
                <ArrowLeft size={16} />
              </Link>

              <div className="flex items-start gap-3">
                {product.image_path ? (
                  <div className="relative flex-shrink-0">
                    <Image src={product.image_path} alt={product.name}
                      width={64} height={64} unoptimized
                      className="w-16 h-16 rounded-2xl object-cover border border-[#21293d]" />
                    <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0d1117] ${st.bar}`} />
                  </div>
                ) : (
                  <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center border flex-shrink-0 ${st.bg}`}>
                    <Package size={24} className={st.color} />
                    {/* Status dot */}
                    <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0d1117] ${st.bar}`} />
                  </div>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                    {product.name}
                  </h1>
                  <p className="text-slate-600 text-xs mt-0.5 max-w-sm leading-relaxed">{product.description}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                      <Hash size={9} /> ID: {product.id}
                    </span>
                    {product.price > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-teal-600">
                        <IndianRupee size={9} /> MRP: ₹{product.price.toLocaleString("en-IN")}
                      </span>
                    )}
                    <span className={`flex items-center gap-1 text-[10px] font-extrabold ${st.color}`}>
                      <CircleDot size={9} /> {st.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Add stock CTA */}
            <button
              onClick={() => { setEditingStock(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-blue-500/20 transition-all active:scale-95">
              <Plus size={16} /> Add Stock
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ── STATS GRID ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Total In",     value: stats.totalIn,   icon: ArrowDownToLine, color: "text-blue-400",    bg: "from-blue-600/15 to-blue-700/5",    border: "border-blue-500/20"    },
            { label: "Total Sold",   value: stats.totalSold, icon: ArrowUpFromLine, color: "text-purple-400",  bg: "from-purple-600/15 to-purple-700/5", border: "border-purple-500/20"  },
            { label: "Available",    value: stats.available, icon: Boxes,           color: st.color,           bg: `${st.bg.split(" ")[0].replace("bg-", "from-")} to-transparent`, border: st.bg.split(" ")[1] },
            { label: "Revenue",      value: `₹${(stats.revenue / 1000).toFixed(1)}K`, icon: IndianRupee, color: "text-teal-400", bg: "from-teal-600/15 to-teal-700/5", border: "border-teal-500/20" },
            { label: "Stock Value",  value: `₹${(stats.stockValue / 1000).toFixed(1)}K`, icon: BarChart3, color: "text-indigo-400", bg: "from-indigo-600/15 to-indigo-700/5", border: "border-indigo-500/20" },
          ].map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label}
              className={`bg-gradient-to-br ${bg} border ${border} rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:scale-[1.02] transition-transform`}>
              <Icon size={18} className={`${color} flex-shrink-0`} />
              <div className="min-w-0">
                <div className={`text-xl font-black ${color} truncate`}>{value}</div>
                <div className="text-[9px] text-slate-700 font-bold uppercase tracking-widest mt-0.5">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── STOCK VISUAL + MONTHLY CHART ── */}
        <div className="grid sm:grid-cols-2 gap-4">

          {/* Stock gauge */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={13} className="text-blue-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Stock Level</span>
            </div>
            <div className="flex items-center gap-5">
              <StockRing available={stats.available} totalIn={stats.totalIn} />
              <div className="flex-1 space-y-2.5">
                {[
                  { label: "Total Received", value: stats.totalIn,   color: "bg-blue-500"   },
                  { label: "Total Used/Sold", value: stats.totalSold, color: "bg-purple-500" },
                  { label: "Available Now",   value: stats.available, color: st.bar          },
                ].map(({ label, value, color }) => {
                  const barPct = stats.totalIn > 0 ? (value / stats.totalIn) * 100 : 0;
                  return (
                    <div key={label}>
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[10px] text-slate-600 font-bold">{label}</span>
                        <span className="text-[11px] font-black text-slate-300">{value}</span>
                      </div>
                      <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Monthly usage chart */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={13} className="text-purple-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Monthly Usage (6 mo.)</span>
            </div>
            <div className="flex items-end gap-2 h-20">
              {monthlyOut.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-slate-600 font-bold">{m.qty || ""}</span>
                  <div className="w-full rounded-t-md transition-all duration-700 overflow-hidden"
                    style={{
                      height: `${Math.max(m.pct, m.qty > 0 ? 8 : 2)}%`,
                      minHeight: 4,
                      background: m.qty > 0
                        ? `linear-gradient(to top, #a855f7, #7c3aed)`
                        : "rgba(255,255,255,0.04)",
                    }}
                  />
                  <span className="text-[9px] text-slate-700 font-bold">{m.label}</span>
                </div>
              ))}
            </div>
            {stockOut.length === 0 && (
              <p className="text-center text-slate-700 text-xs mt-2">No usage data yet</p>
            )}
          </div>
        </div>

        {/* ── TABS: STOCK IN / STOCK OUT ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">

          {/* Tab header */}
          <div className="flex border-b border-[#21293d] bg-[#111520]">
            {[
              { key: "in",  label: "Stock-In History",   icon: ArrowDownToLine, count: stockIn.length,  color: "blue"   },
              { key: "out", label: "Stock-Out / Usage",  icon: ArrowUpFromLine, count: stockOut.length, color: "purple" },
            ].map(({ key, label, icon: Icon, count, color }) => {
              const active = activeTab === key;
              const colors: Record<string, string> = {
                blue:   active ? "border-b-2 border-blue-500 text-blue-400"     : "text-slate-600 hover:text-slate-400",
                purple: active ? "border-b-2 border-purple-500 text-purple-400" : "text-slate-600 hover:text-slate-400",
              };
              return (
                <button key={key} onClick={() => setActiveTab(key as "in" | "out")}
                  className={`flex items-center gap-2 px-5 py-3.5 text-xs font-extrabold uppercase tracking-wider transition-all ${colors[color]}`}>
                  <Icon size={13} />
                  {label}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${active ? "bg-white/10" : "bg-white/5 text-slate-700"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── STOCK IN TABLE ── */}
          {activeTab === "in" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#21293d]">
                    {["#", "Date", "Quantity", "Place", "Actions"].map((h, i) => (
                      <th key={h} className={`px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 ${
                        i === 2 ? "text-right" : i === 4 ? "text-center" : "text-left"
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]">
                  {stockIn.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-5 py-3 text-slate-700 text-xs">{idx + 1}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Calendar size={11} className="text-blue-400" />
                          </div>
                          <span className="text-slate-300 text-xs font-medium">{fmtDate(s.stock_date)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xl font-black text-blue-400">{s.quantity}</span>
                        <span className="text-slate-600 text-xs ml-1">units</span>
                      </td>
                      <td className="px-5 py-3">
                        {s.place ? (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <MapPin size={10} className="text-slate-700" /> {s.place}
                          </span>
                        ) : (
                          <span className="text-slate-700 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => { setEditingStock(s); setModalOpen(true); }}
                            className="p-1.5 bg-[#21293d] hover:bg-blue-600 border border-[#21293d] hover:border-blue-500 rounded-lg text-slate-500 hover:text-white transition-all">
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteStock(s.id)}
                            className="p-1.5 bg-[#21293d] hover:bg-red-600/30 border border-[#21293d] hover:border-red-500/40 rounded-lg text-slate-500 hover:text-red-400 transition-all">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {stockIn.length === 0 && (
                    <tr><td colSpan={5} className="py-16 text-center">
                      <ArrowDownToLine size={28} className="mx-auto text-slate-800 mb-2" />
                      <p className="text-slate-600 text-sm font-bold">No stock entries yet</p>
                      <button onClick={() => { setEditingStock(null); setModalOpen(true); }}
                        className="mt-3 text-xs text-blue-400 hover:text-blue-300 font-bold">
                        + Add first stock entry
                      </button>
                    </td></tr>
                  )}
                </tbody>
                {stockIn.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#111520] border-t border-[#21293d]">
                      <td colSpan={2} className="px-5 py-2.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                        {stockIn.length} entries
                      </td>
                      <td className="px-5 py-2.5 text-right font-black text-blue-400">
                        {stats.totalIn} <span className="text-slate-600 font-bold text-xs">total units</span>
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* ── STOCK OUT TABLE ── */}
          {activeTab === "out" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#21293d]">
                    {["#", "Date", "Reference", "Type", "Client", "Rate", "Qty", "Total"].map((h, i) => (
                      <th key={h} className={`px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 ${
                        [5, 6, 7].includes(i) ? "text-right" : "text-left"
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]">
                  {stockOut.map((s, idx) => (
                    <tr key={`${s.type}-${s.id}`} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-slate-700 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(s.date)}</td>
                      <td className="px-4 py-3">
                        <Link href={s.link}
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-bold text-xs transition-colors group">
                          {s.reference}
                          <ExternalLink size={9} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                          s.type === "Repair Job"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}>
                          {s.type === "Repair Job" ? <Wrench size={8} /> : <ShoppingCart size={8} />}
                          {s.type === "Repair Job" ? "Repair" : "Sale"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-[120px] truncate" title={s.client_name}>
                        {s.client_name}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">₹{s.price.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-right font-black text-purple-400">{s.qty}</td>
                      <td className="px-4 py-3 text-right font-bold text-teal-400 text-xs whitespace-nowrap">
                        ₹{s.total.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                  {stockOut.length === 0 && (
                    <tr><td colSpan={8} className="py-16 text-center">
                      <ArrowUpFromLine size={28} className="mx-auto text-slate-800 mb-2" />
                      <p className="text-slate-600 text-sm font-bold">No usage records yet</p>
                      <p className="text-slate-700 text-xs mt-1">Records appear when this product is used in repair jobs or direct sales</p>
                    </td></tr>
                  )}
                </tbody>
                {stockOut.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#111520] border-t border-[#21293d]">
                      <td colSpan={5} className="px-4 py-2.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                        {stockOut.length} transactions
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600 text-xs font-bold">Total</td>
                      <td className="px-4 py-2.5 text-right font-black text-purple-400">{stats.totalSold}</td>
                      <td className="px-4 py-2.5 text-right font-black text-teal-400 text-sm">
                        ₹{stats.revenue.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* ── INFO FOOTER ── */}
        <div className="flex items-start gap-3 bg-[#111520] border border-[#21293d] rounded-xl px-4 py-3">
          <Info size={13} className="text-slate-700 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-700 leading-relaxed">
            Stock-out records are auto-generated from repair jobs and direct sales.
            Only non-cancelled transactions are counted. Edit or delete stock-in entries to adjust quantity manually.
          </p>
        </div>

      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <StockModal
          productId={productId}
          productName={product.name}
          stock={editingStock}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); fetchData(); }}
        />
      )}
    </div>
  );
}