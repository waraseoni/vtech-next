"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import {
  Package, Search, Eye, Printer, MapPin,
  TrendingDown, AlertTriangle, CheckCircle, XCircle,
  BarChart3, RefreshCw, ArrowUpDown, X,
  Layers, Zap, ShoppingCart, Boxes,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProductStock {
  id: number;
  name: string;
  description: string;
  cost_price: number;
  price: number;
  image_path: string | null;
  total_in: number;
  total_sold: number;
  available: number;
  place: string | null;
  stock_value: number;
}

type FilterType = "all" | "in-stock" | "low-stock" | "out-of-stock";
type SortKey    = "name" | "available" | "total_sold" | "stock_value";

// ─── Stock status helper ──────────────────────────────────────────────────────
const getStockStatus = (avail: number) => {
  if (avail <= 0)  return { label: "Out of Stock", short: "OUT",  color: "text-red-400",     bg: "bg-red-500/10 border-red-500/25",     bar: "bg-red-500",     glow: "shadow-red-500/20"    };
  if (avail <= 5)  return { label: "Low Stock",    short: "LOW",  color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/25", bar: "bg-amber-400",   glow: "shadow-amber-500/20"  };
  return               { label: "In Stock",     short: "OK",   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25", bar: "bg-emerald-500", glow: "shadow-emerald-500/20" };
};

// ─── Mini sparkline bar ───────────────────────────────────────────────────────
function StockBar({ available, total_in }: { available: number; total_in: number }) {
  const pct = total_in > 0 ? Math.max(0, Math.min(100, (available / total_in) * 100)) : 0;
  const color = available <= 0 ? "bg-red-500" : available <= 5 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const [products,    setProducts]    = useState<ProductStock[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [searchTerm,  setSearchTerm]  = useState("");
  const [filter,      setFilter]      = useState<FilterType>("all");
  const [sortKey,     setSortKey]     = useState<SortKey>("name");
  const [sortAsc,     setSortAsc]     = useState(true);
  const [isMobile,    setIsMobile]    = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const h  = (e: MediaQueryList | MediaQueryListEvent) => setIsMobile(e.matches);
    h(mq); mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchProducts = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const { data: pl } = await supabase
        .from("product_list")
        .select("id, name, description, cost_price, price, image_path")
        .eq("delete_flag", 0)
        .order("name");

      if (!pl) { setProducts([]); return; }

      // Batch fetch all inventory + sold data at once (avoid N+1)
      const ids = pl.map(p => p.id);

      const [stockRes, jobItemsRes, saleItemsRes] = await Promise.all([
        supabase.from("inventory_list").select("product_id, quantity, place").in("product_id", ids),
        supabase.from("transaction_products").select("product_id, qty, transaction_id").in("product_id", ids),
        supabase.from("direct_sale_items").select("product_id, qty").in("product_id", ids),
      ]);

      // Get valid (non-cancelled) transaction IDs once
      const txnIds = [...new Set((jobItemsRes.data || []).map(i => i.transaction_id))];
      let validTxnSet = new Set<number>();
      if (txnIds.length > 0) {
        const { data: txns } = await supabase
          .from("transaction_list").select("id").in("id", txnIds).neq("status", 4);
        validTxnSet = new Set((txns || []).map(t => t.id));
      }

      // Build maps
      const stockMap   = new Map<number, { qty: number; place: string | null }>();
      (stockRes.data || []).forEach(r => {
        const prev = stockMap.get(r.product_id) || { qty: 0, place: null };
        stockMap.set(r.product_id, { qty: prev.qty + r.quantity, place: r.place || prev.place });
      });

      const soldJobMap = new Map<number, number>();
      (jobItemsRes.data || []).forEach(r => {
        if (validTxnSet.has(r.transaction_id)) {
          soldJobMap.set(r.product_id, (soldJobMap.get(r.product_id) || 0) + (r.qty || 0));
        }
      });

      const soldSaleMap = new Map<number, number>();
      (saleItemsRes.data || []).forEach(r => {
        soldSaleMap.set(r.product_id, (soldSaleMap.get(r.product_id) || 0) + (r.qty || 0));
      });

      const result: ProductStock[] = pl.map(p => {
        const s         = stockMap.get(p.id)    || { qty: 0, place: null };
        const soldJob   = soldJobMap.get(p.id)  || 0;
        const soldSale  = soldSaleMap.get(p.id) || 0;
        const totalSold = soldJob + soldSale;
        const available = s.qty - totalSold;
        return {
          id:          p.id,
          name:        p.name,
          description: p.description,
          cost_price:  p.cost_price || 0,
          price:       p.price || 0,
          image_path:  p.image_path || null,
          total_in:    s.qty,
          total_sold:  totalSold,
          available,
          place:       s.place,
          stock_value: available > 0 ? available * (p.price || 0) : 0,
        };
      });

      setProducts(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:      products.length,
    inStock:    products.filter(p => p.available > 5).length,
    lowStock:   products.filter(p => p.available > 0 && p.available <= 5).length,
    outOfStock: products.filter(p => p.available <= 0).length,
    totalValue: products.reduce((s, p) => s + p.stock_value, 0),
    totalSold:  products.reduce((s, p) => s + p.total_sold, 0),
  }), [products]);

  // ── Filtered + Sorted ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = products.filter(p => {
      const q = searchTerm.toLowerCase();
      if (q && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
      if (filter === "in-stock"     && !(p.available > 5))                         return false;
      if (filter === "low-stock"    && !(p.available > 0 && p.available <= 5))     return false;
      if (filter === "out-of-stock" && p.available > 0)                             return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      let diff = 0;
      if (sortKey === "name")        diff = a.name.localeCompare(b.name);
      if (sortKey === "available")   diff = a.available  - b.available;
      if (sortKey === "total_sold")  diff = a.total_sold - b.total_sold;
      if (sortKey === "stock_value") diff = a.stock_value - b.stock_value;
      return sortAsc ? diff : -diff;
    });

    return list;
  }, [products, searchTerm, filter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(p => !p);
    else { setSortKey(key); setSortAsc(true); }
  };

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Inventory Report</title><style>
      body{font-family:sans-serif;padding:20px}
      h1{font-size:1.4rem;margin-bottom:4px}
      p{color:#666;font-size:.85rem;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:.85rem}
      th{background:#f1f5f9;padding:8px 12px;text-align:left;border:1px solid #e2e8f0}
      td{padding:8px 12px;border:1px solid #e2e8f0}
    </style></head><body>
      <h1>Inventory Report — V-Technologies</h1>
      <p>Generated: ${new Date().toLocaleString("en-IN")}</p>
      <table><thead><tr>
        <th>#</th><th>Product</th><th>Total In</th><th>Sold</th><th>Available</th><th>Price</th><th>Stock Value</th><th>Status</th>
      </tr></thead><tbody>
        ${products.map((p, i) => `<tr>
          <td>${i + 1}</td><td><b>${p.name}</b><br><small>${p.description}</small></td>
          <td>${p.total_in}</td><td>${p.total_sold}</td>
          <td><b>${p.available}</b></td>
          <td>₹${p.price.toFixed(2)}</td>
          <td>₹${p.stock_value.toFixed(2)}</td>
          <td>${p.available <= 0 ? "Out of Stock" : p.available <= 5 ? "Low Stock" : "In Stock"}</td>
        </tr>`).join("")}
      </tbody></table>
    </body></html>`);
    w.document.close();
    w.print();
  };

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
        <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.3em]">Loading Inventory...</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-16">

      {/* ── HERO HEADER ── */}
      <div className="relative overflow-hidden bg-[#0d1117] border-b border-[#21293d]">
        {/* Background grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        {/* Glow orb */}
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -top-10 right-10 w-48 h-48 bg-indigo-600/8 rounded-full blur-2xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30">
                  <Boxes size={26} className="text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#0d1117]" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
                  Inventory
                </h1>
                <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.2em] mt-1">
                  {stats.total} Products · Stock Management
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <button onClick={() => fetchProducts(true)} disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all">
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all">
                <Printer size={13} /> Print
              </button>
            </div>
          </div>

          {/* ── STAT CARDS ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
            {[
              { label: "Total Items",   value: stats.total,                                     icon: Layers,      color: "from-blue-600/20 to-blue-700/5",    border: "border-blue-500/20",    text: "text-blue-400"    },
              { label: "In Stock",      value: stats.inStock,                                   icon: CheckCircle, color: "from-emerald-600/20 to-emerald-700/5", border: "border-emerald-500/20", text: "text-emerald-400" },
              { label: "Low Stock",     value: stats.lowStock,                                  icon: AlertTriangle, color: "from-amber-600/20 to-amber-700/5", border: "border-amber-500/20",  text: "text-amber-400"   },
              { label: "Out of Stock",  value: stats.outOfStock,                                icon: XCircle,     color: "from-red-600/20 to-red-700/5",       border: "border-red-500/20",     text: "text-red-400"     },
              { label: "Total Sold",    value: stats.totalSold,                                 icon: ShoppingCart, color: "from-purple-600/20 to-purple-700/5", border: "border-purple-500/20", text: "text-purple-400"  },
              { label: "Stock Value",   value: `₹${(stats.totalValue / 1000).toFixed(1)}K`,     icon: BarChart3,   color: "from-teal-600/20 to-teal-700/5",     border: "border-teal-500/20",    text: "text-teal-400"    },
            ].map(({ label, value, icon: Icon, color, border, text }) => (
              <div key={label}
                className={`relative bg-gradient-to-br ${color} border ${border} rounded-2xl px-4 py-3.5 overflow-hidden group hover:scale-[1.02] transition-transform`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`text-xl font-black ${text}`}>{value}</div>
                    <div className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">{label}</div>
                  </div>
                  <Icon size={16} className={`${text} opacity-50 group-hover:opacity-100 transition-opacity`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FILTER + SEARCH BAR ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" size={15} />
            <input
              type="text"
              placeholder="Search products, descriptions..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-[#161b27] border border-[#21293d] text-slate-200 placeholder-slate-600 rounded-xl text-sm focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex gap-1.5">
            {([
              { key: "all",           label: "All",      count: stats.total,      color: "blue"    },
              { key: "in-stock",      label: "In Stock", count: stats.inStock,    color: "emerald" },
              { key: "low-stock",     label: "Low",      count: stats.lowStock,   color: "amber"   },
              { key: "out-of-stock",  label: "Out",      count: stats.outOfStock, color: "red"     },
            ] as const).map(({ key, label, count, color }) => {
              const active = filter === key;
              const styles: Record<string, string> = {
                blue:    active ? "bg-blue-600 text-white border-blue-600"         : "bg-[#161b27] text-slate-500 border-[#21293d] hover:border-blue-500/40",
                emerald: active ? "bg-emerald-600 text-white border-emerald-600"   : "bg-[#161b27] text-slate-500 border-[#21293d] hover:border-emerald-500/40",
                amber:   active ? "bg-amber-500 text-white border-amber-500"       : "bg-[#161b27] text-slate-500 border-[#21293d] hover:border-amber-500/40",
                red:     active ? "bg-red-600 text-white border-red-600"           : "bg-[#161b27] text-slate-500 border-[#21293d] hover:border-red-500/40",
              };
              return (
                <button key={key} onClick={() => setFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border transition-all ${styles[color]}`}>
                  {label}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-white/5"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results indicator */}
        {(searchTerm || filter !== "all") && (
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            <span>Showing <span className="text-slate-400 font-bold">{filtered.length}</span> of {products.length} products</span>
            {(searchTerm || filter !== "all") && (
              <button onClick={() => { setSearchTerm(""); setFilter("all"); }}
                className="text-blue-500 hover:text-blue-400 font-bold">Clear filters</button>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* DESKTOP TABLE                                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {!isMobile && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111520] border-b border-[#21293d]">
                  <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-600 w-10">#</th>

                  {/* Sortable: Product */}
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => toggleSort("name")}
                      className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 hover:text-slate-400 transition-colors">
                      Product <ArrowUpDown size={10} className={sortKey === "name" ? "text-blue-400" : ""} />
                    </button>
                  </th>

                  <th className="px-4 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Stock</th>

                  {/* Sortable: Available */}
                  <th className="px-4 py-3 text-right">
                    <button onClick={() => toggleSort("available")}
                      className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 hover:text-slate-400 transition-colors ml-auto">
                      Avail <ArrowUpDown size={10} className={sortKey === "available" ? "text-blue-400" : ""} />
                    </button>
                  </th>

                  {/* Sortable: Sold */}
                  <th className="px-4 py-3 text-right">
                    <button onClick={() => toggleSort("total_sold")}
                      className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 hover:text-slate-400 transition-colors ml-auto">
                      Sold <ArrowUpDown size={10} className={sortKey === "total_sold" ? "text-blue-400" : ""} />
                    </button>
                  </th>

                  {/* Sortable: Value */}
                  <th className="px-4 py-3 text-right">
                    <button onClick={() => toggleSort("stock_value")}
                      className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 hover:text-slate-400 transition-colors ml-auto">
                      Value <ArrowUpDown size={10} className={sortKey === "stock_value" ? "text-blue-400" : ""} />
                    </button>
                  </th>

                  <th className="px-4 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Status</th>
                  <th className="px-4 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Place</th>
                  <th className="px-4 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-600">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#21293d]">
                {filtered.map((p, idx) => {
                  const st = getStockStatus(p.available);
                  return (
                    <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-slate-700 text-xs">{idx + 1}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.image_path ? (
                            <Image src={p.image_path} alt={p.name}
                              width={48} height={48} unoptimized
                              className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-[#21293d]"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${st.bg}`}>
                              <Package size={14} className={st.color} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-slate-200 text-sm truncate max-w-[200px]" title={p.name}>
                              {p.name}
                            </div>
                            <div className="text-xs text-slate-600 truncate max-w-[200px]" title={p.description}>
                              {p.description}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Stock bar cell */}
                      <td className="px-4 py-3 w-28">
                        <div className="flex flex-col gap-1 items-end">
                          <span className="text-[10px] text-slate-600">{p.total_in} in</span>
                          <StockBar available={p.available} total_in={p.total_in} />
                        </div>
                      </td>

                      <td className={`px-4 py-3 text-right font-black text-lg ${st.color}`}>
                        {p.available}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="text-slate-400 font-bold">{p.total_sold}</span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-bold ${p.stock_value > 0 ? "text-teal-400" : "text-slate-700"}`}>
                          {p.stock_value > 0 ? `₹${p.stock_value.toLocaleString("en-IN")}` : "—"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${st.bg} ${st.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.bar}`} />
                          {st.label}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        {p.place ? (
                          <span className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
                            <MapPin size={10} className="text-slate-700" /> {p.place}
                          </span>
                        ) : (
                          <span className="text-slate-700 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <Link href={`/inventory/${p.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95">
                          <Eye size={12} /> View
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-20 text-center">
                      <Package size={36} className="mx-auto text-slate-800 mb-3" />
                      <p className="text-slate-600 font-bold text-sm">No products found</p>
                      <p className="text-slate-700 text-xs mt-1">Try adjusting your search or filter</p>
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Table Footer Summary */}
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="bg-[#111520] border-t border-[#21293d]">
                    <td colSpan={3} className="px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                      {filtered.length} products shown
                    </td>
                    <td className="px-4 py-2.5 text-right font-black text-slate-400 text-sm">
                      {filtered.reduce((s, p) => s + p.available, 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-black text-slate-400 text-sm">
                      {filtered.reduce((s, p) => s + p.total_sold, 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-black text-teal-400 text-sm">
                      ₹{filtered.reduce((s, p) => s + p.stock_value, 0).toLocaleString("en-IN")}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MOBILE CARDS                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {isMobile && (
        <div className="px-3 space-y-3">
          {filtered.map(p => {
            const st  = getStockStatus(p.available);
            const pct = p.total_in > 0 ? Math.max(0, Math.min(100, (p.available / p.total_in) * 100)) : 0;

            return (
              <div key={p.id}
                className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden group">

                {/* Top accent bar — colored by status */}
                <div className={`h-0.5 w-full ${
                  p.available <= 0 ? "bg-red-500" : p.available <= 5 ? "bg-amber-400" : "bg-emerald-500"
                }`} />

                <div className="p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {p.image_path ? (
                        <Image src={p.image_path} alt={p.name}
                          width={48} height={48} unoptimized
                          className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-[#21293d]"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${st.bg}`}>
                          <Package size={16} className={st.color} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-black text-white text-sm truncate">{p.name}</div>
                        <div className="text-[11px] text-slate-600 truncate mt-0.5">{p.description}</div>
                      </div>
                    </div>
                    <span className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-extrabold border ${st.bg} ${st.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.bar}`} />
                      {st.short}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: "Available", value: p.available,  color: st.color },
                      { label: "Total In",  value: p.total_in,   color: "text-slate-400" },
                      { label: "Sold",      value: p.total_sold, color: "text-purple-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-[#111520] rounded-xl p-2.5 text-center">
                        <div className={`text-xl font-black ${color}`}>{value}</div>
                        <div className="text-[8px] text-slate-700 font-bold uppercase tracking-widest mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Stock bar */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-slate-700 font-bold uppercase tracking-wider">Stock Level</span>
                      <span className="text-[10px] font-bold text-slate-500">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${
                        p.available <= 0 ? "bg-red-500" : p.available <= 5 ? "bg-amber-400" : "bg-emerald-500"
                      }`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {/* Bottom row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {p.place && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-600">
                          <MapPin size={10} /> {p.place}
                        </span>
                      )}
                      {p.stock_value > 0 && (
                        <span className="text-[11px] text-teal-500 font-bold">
                          ₹{p.stock_value.toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                    <Link href={`/inventory/${p.id}`}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95">
                      <Eye size={12} /> View
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-20 text-center bg-[#161b27] border border-dashed border-[#21293d] rounded-2xl">
              <Package size={36} className="mx-auto text-slate-800 mb-3" />
              <p className="text-slate-600 font-bold text-sm">No products match</p>
              <button onClick={() => { setSearchTerm(""); setFilter("all"); }}
                className="mt-3 text-xs text-blue-500 hover:text-blue-400 font-bold">
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── LOW STOCK ALERT BANNER ── */}
      {stats.outOfStock > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4">
          <div className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
            <div className="w-8 h-8 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingDown size={14} className="text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-red-400 text-xs font-extrabold uppercase tracking-wide">
                {stats.outOfStock} product{stats.outOfStock > 1 ? "s" : ""} out of stock
              </p>
              <p className="text-slate-700 text-[11px] mt-0.5">Restock recommended to avoid service delays</p>
            </div>
            <button onClick={() => setFilter("out-of-stock")}
              className="text-[10px] font-extrabold text-red-400 hover:text-red-300 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
              View All
            </button>
          </div>
        </div>
      )}

      {stats.lowStock > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-2">
          <div className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
            <div className="w-8 h-8 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={14} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-amber-400 text-xs font-extrabold uppercase tracking-wide">
                {stats.lowStock} product{stats.lowStock > 1 ? "s" : ""} running low (≤5 units)
              </p>
              <p className="text-slate-700 text-[11px] mt-0.5">Consider restocking soon</p>
            </div>
            <button onClick={() => setFilter("low-stock")}
              className="text-[10px] font-extrabold text-amber-400 hover:text-amber-300 border border-amber-500/20 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
              View All
            </button>
          </div>
        </div>
      )}

      {/* ── LOW STOCK QUICK PANEL ── */}
      {products.some(p => p.available > 0 && p.available <= 5) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[#21293d] bg-[#111520]">
              <Zap size={13} className="text-amber-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Critical Low Stock</span>
            </div>
            <div className="flex flex-wrap gap-2 p-4">
              {products.filter(p => p.available > 0 && p.available <= 5).map(p => (
                <Link key={p.id} href={`/inventory/${p.id}`}
                  className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/40 px-3 py-2 rounded-xl transition-colors group">
                  <span className="w-5 h-5 bg-amber-500 text-white text-[10px] font-black rounded flex items-center justify-center flex-shrink-0 group-hover:bg-amber-400 transition-colors">
                    {p.available}
                  </span>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-slate-200 transition-colors max-w-[120px] truncate">{p.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}