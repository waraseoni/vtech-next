"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { openImageLightbox } from "@/components/ImageLightbox";
import { safeImageSrc } from "@/lib/image-utils";
import { supabase } from "@/lib/supabase";
import { stockStatusStyle, alertThreshold, stockValue } from "@/lib/inventory";
import {
  ArrowLeft,
  Package,
  Plus,
  Edit3,
  Trash2,
  Boxes,
  MapPin,
  Calendar,
  Wrench,
  ShoppingCart,
  IndianRupee,
  BarChart3,
  Hash,
  ArrowDownToLine,
  ArrowUpFromLine,
  ExternalLink,
  Info,
  ChevronRight,
  Zap,
  CircleDot,
  Printer,
  Search,
  AlertTriangle,
  FileText,
} from "lucide-react";
import StockModal from "./components/StockModal";
import LocationPicker from "@/components/LocationPicker";
import { logActivity } from "@/lib/activity";
import { printBarcodeLabels, safeBarcode } from "@/lib/barcodePrint";
import { locPath, EMPTY_LOCATION, type LocationParts } from "@/lib/locations";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: number;
  name: string;
  description: string;
  cost_price: number;
  price: number;
  image_path: string | null;
  alert_quantity?: number;
  barcode?: string | null;
}

interface StockIn {
  id: number;
  quantity: number;
  place: string | null;
  stock_date: string;
  supplier_id?: number | null;
  purchase_order_id?: number | null;
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
const getStockStatus = (avail: number, alertQty = 5) => stockStatusStyle(avail, alertQty);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// ─── Mini radial-like progress ring using SVG ─────────────────────────────────
function StockRing({
  available,
  totalIn,
  alertQty = 5,
}: {
  available: number;
  totalIn: number;
  alertQty?: number;
}) {
  const pct = totalIn > 0 ? Math.max(0, Math.min(100, (available / totalIn) * 100)) : 0;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const st = getStockStatus(available, alertQty);
  const threshold = alertThreshold(alertQty);

  return (
    <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={available <= 0 ? "#ef4444" : available <= threshold ? "#f59e0b" : "#10b981"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-black ${st.color}`}>{Math.max(0, available)}</span>
        <span className="text-[8px] text-slate-700 font-bold uppercase tracking-widest">avail</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProductDetailPage() {
  const params = useParams();
  const productId = Number(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [stockIn, setStockIn] = useState<StockIn[]>([]);
  const [stockOut, setStockOut] = useState<StockOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<StockIn | null>(null);
  const [stats, setStats] = useState({
    totalIn: 0,
    totalSold: 0,
    available: 0,
    revenue: 0,
    stockValue: 0,
  });
  const [activeTab, setActiveTab] = useState<"in" | "out" | "ledger">("in");
  const [poCodes, setPoCodes] = useState<Map<number, string>>(new Map());
  const [locEditing, setLocEditing] = useState(false);
  const [editLoc, setEditLoc] = useState<LocationParts>({ ...EMPTY_LOCATION });
  const [locSaving, setLocSaving] = useState(false);
  const [productLocations, setProductLocations] = useState<
    { id: number; zone: string; rack: string; bin: string; box: string }[]
  >([]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Phase 1 — independent lookups in parallel
      const [prodRes, stockRes, jobRes, saleRes] = await Promise.all([
        supabase.from("product_list").select("*").eq("id", productId).single(),
        supabase
          .from("inventory_list")
          .select("*")
          .eq("product_id", productId)
          .order("stock_date", { ascending: false }),
        supabase
          .from("transaction_products")
          .select("qty, price, transaction_id")
          .eq("product_id", productId),
        supabase
          .from("direct_sale_items")
          .select("qty, price, sale_id")
          .eq("product_id", productId),
      ]);

      const { error: prodErr } = prodRes;
      if (prodErr) throw prodErr;
      const prod = prodRes.data as Product | null;
      setProduct(prod);

      const { data: plLocs } = await supabase
        .from("product_locations")
        .select("id, locations!inner(zone, rack, bin, box)")
        .eq("product_id", productId);
      const mappedLocs = (plLocs || []).map(
        (row: {
          id: number;
          locations: { zone: string; rack: string; bin: string; box: string }[];
        }) => ({
          id: row.id,
          zone: row.locations?.[0]?.zone || "",
          rack: row.locations?.[0]?.rack || "",
          bin: row.locations?.[0]?.bin || "",
          box: row.locations?.[0]?.box || "",
        })
      );
      setProductLocations(mappedLocs);

      const stockInData = stockRes.data || [];
      setStockIn(stockInData);
      const totalIn = stockInData.reduce((s, r) => s + r.quantity, 0);

      // Fetch PO codes for stock-in rows received from purchase orders
      const poIds = [
        ...new Set(
          stockInData
            .map((r: { purchase_order_id?: number | null }) => r.purchase_order_id)
            .filter(Boolean)
        ),
      ] as number[];
      const poCodes = new Map<number, string>();
      if (poIds.length) {
        const { data: poRows } = await supabase
          .from("purchase_orders")
          .select("id, po_code")
          .in("id", poIds);
        (poRows || []).forEach((r: { id: number; po_code: string }) =>
          poCodes.set(r.id, r.po_code)
        );
      }
      setPoCodes(poCodes);

      const jobItems = jobRes.data || [];
      const saleItems = saleRes.data || [];

      // Phase 2 — fetch parent transactions/sales for stock-out in parallel
      const jobTxns = jobItems.length
        ? (
            await supabase
              .from("transaction_list")
              .select("id, date_created, job_id, code, status, client_name")
              .in(
                "id",
                jobItems.map((i) => i.transaction_id)
              )
              .neq("status", 4)
          ).data || []
        : [];
      const sales = saleItems.length
        ? (
            await supabase
              .from("direct_sales")
              .select("id, date_created, sale_code, client_id")
              .in(
                "id",
                saleItems.map((i) => i.sale_id)
              )
          ).data || []
        : [];

      // Phase 3 — resolve client names in one batch
      const cids = [
        ...new Set([
          ...jobTxns.map((t) => Number(t.client_name)),
          ...sales.map((s) => s.client_id).filter(Boolean),
        ]),
      ];
      const clients = cids.length
        ? (
            await supabase
              .from("client_list")
              .select("id, firstname, middlename, lastname")
              .in("id", cids)
          ).data || []
        : [];
      const cMap = new Map(
        clients.map((c) => [
          c.id,
          [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" "),
        ])
      );

      // Build job stock-out rows
      const jobOut: StockOut[] = [];
      const tMap = new Map(jobTxns.map((t) => [t.id, t]));
      jobItems.forEach((item) => {
        const t = tMap.get(item.transaction_id);
        if (t)
          jobOut.push({
            id: t.id,
            date: t.date_created,
            reference: t.job_id || t.code,
            type: "Repair Job",
            client_name: cMap.get(Number(t.client_name)) || "N/A",
            qty: item.qty,
            price: item.price,
            total: item.qty * item.price,
            link: `/jobs/${t.id}`,
          });
      });

      // Build direct-sale stock-out rows
      const saleOut: StockOut[] = [];
      const sMap = new Map(sales.map((s) => [s.id, s]));
      saleItems.forEach((item) => {
        const s = sMap.get(item.sale_id);
        if (s)
          saleOut.push({
            id: s.id,
            date: s.date_created,
            reference: s.sale_code,
            type: "Direct Sale",
            client_name: cMap.get(s.client_id) || "Walk-in",
            qty: item.qty,
            price: item.price,
            total: item.qty * item.price,
            link: `/direct-sales/${s.id}/view`,
          });
      });

      const allOut = [...jobOut, ...saleOut].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setStockOut(allOut);

      const totalSold = allOut.reduce((s, o) => s + o.qty, 0);
      const revenue = allOut.reduce((s, o) => s + o.total, 0);
      const available = totalIn - totalSold;
      const stockVal = stockValue(available, prod?.price);
      setStats({ totalIn, totalSold, available, revenue, stockValue: stockVal });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteStock = async (id: number) => {
    if (!confirm("Delete this stock entry?")) return;
    const entry = stockIn.find((s) => s.id === id);
    const { error } = await supabase.from("inventory_list").delete().eq("id", id);
    if (!error) {
      await logActivity(
        "Deleted Stock Entry",
        "Inventory",
        productId,
        `Product: ${product?.name || "Unknown"} | Removed ${entry?.quantity} units | Stock ID: ${id}`
      );
      fetchData();
    } else alert("Failed to delete: " + error.message);
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const st = getStockStatus(stats.available, product?.alert_quantity);
  const costVal = Math.max(0, stats.available) * (product?.cost_price || 0);
  const productLoc = useMemo(
    () =>
      productLocations.length > 0
        ? {
            zone: productLocations[0].zone,
            rack: productLocations[0].rack,
            bin: productLocations[0].bin,
            box: productLocations[0].box,
          }
        : null,
    [productLocations]
  );

  // Running-balance ledger (stock-in + stock-out merged chronologically)
  const ledger = useMemo(() => {
    type L = {
      key: string;
      date: string;
      label: string;
      sub: string;
      link?: string;
      direction: "in" | "out";
      qty: number;
      balance?: number;
    };
    const rows: L[] = [];
    stockIn.forEach((s) =>
      rows.push({
        key: `in-${s.id}`,
        date: s.stock_date,
        direction: "in",
        qty: s.quantity,
        label: "Stock In",
        sub:
          (product ? locPath(productLoc) : null) ||
          (s.purchase_order_id && poCodes.get(s.purchase_order_id)
            ? `PO: ${poCodes.get(s.purchase_order_id)}`
            : "No location"),
      })
    );
    stockOut.forEach((o) =>
      rows.push({
        key: `out-${o.type}-${o.id}`,
        date: o.date,
        direction: "out",
        qty: o.qty,
        label: o.type,
        sub: o.client_name,
        link: o.link,
      })
    );
    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let bal = 0;
    return rows.map((r) => {
      bal += r.direction === "in" ? r.qty : -r.qty;
      return { ...r, balance: bal };
    });
  }, [stockIn, stockOut, poCodes, product, productLoc]);

  // Monthly movement chart data (last 6 months)
  const monthlyOut = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        label: d.toLocaleDateString("en-IN", { month: "short" }),
        year: d.getFullYear(),
        month: d.getMonth(),
        qty: 0,
      };
    });
    stockOut.forEach((o) => {
      const d = new Date(o.date);
      const m = months.find((m) => m.year === d.getFullYear() && m.month === d.getMonth());
      if (m) m.qty += o.qty;
    });
    const max = Math.max(...months.map((m) => m.qty), 1);
    return months.map((m) => ({ ...m, pct: (m.qty / max) * 100 }));
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
        <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.3em]">
          Loading Product...
        </p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center bg-[#161b27] border border-[#21293d] rounded-2xl p-10">
          <Package size={40} className="mx-auto text-slate-700 mb-3" />
          <h2 className="text-xl font-black text-white">Product not found</h2>
          <Link
            href="/inventory"
            className="text-blue-400 hover:text-blue-300 text-sm mt-3 inline-flex items-center gap-1"
          >
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
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-blue-600/8 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-700 mb-4 font-bold uppercase tracking-wider">
            <Link href="/inventory" className="hover:text-slate-500 transition-colors">
              Inventory
            </Link>
            <ChevronRight size={10} />
            <span className="text-slate-500 truncate max-w-[200px]">{product.name}</span>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-5">
            {/* Left: product identity */}
            <div className="flex items-start gap-4">
              <Link
                href="/inventory"
                className="mt-1 p-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] rounded-xl text-slate-500 hover:text-slate-300 transition-all flex-shrink-0"
              >
                <ArrowLeft size={16} />
              </Link>

              <div className="flex items-start gap-3">
                {safeImageSrc(product.image_path) ? (
                  <div className="relative flex-shrink-0">
                    <Image
                      src={safeImageSrc(product.image_path)}
                      alt={product.name}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-2xl object-cover border border-[#21293d] cursor-zoom-in"
                      onDoubleClick={() => openImageLightbox(product.image_path, product.name)}
                    />
                    <span
                      className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0d1117] ${st.bar}`}
                    />
                  </div>
                ) : (
                  <div
                    className={`relative w-14 h-14 rounded-2xl flex items-center justify-center border flex-shrink-0 ${st.bg}`}
                  >
                    <Package size={24} className={st.color} />
                    {/* Status dot */}
                    <span
                      className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0d1117] ${st.bar}`}
                    />
                  </div>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                    {product.name}
                  </h1>
                  <p className="text-slate-600 text-xs mt-0.5 max-w-sm leading-relaxed">
                    {product.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                      <Hash size={9} /> ID: {product.id}
                    </span>
                    {product.price > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-teal-600">
                        <IndianRupee size={9} /> MRP: ₹{product.price.toLocaleString("en-IN")}
                      </span>
                    )}
                    {product.cost_price > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                        Cost: ₹{product.cost_price.toLocaleString("en-IN")}
                      </span>
                    )}
                    {product.cost_price > 0 && product.price > 0 && (
                      <span
                        className={`flex items-center gap-1 text-[10px] font-extrabold ${
                          Math.round(
                            ((product.price - product.cost_price) / product.price) * 100
                          ) >= 30
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      >
                        {Math.round(((product.price - product.cost_price) / product.price) * 100)}%
                        margin
                      </span>
                    )}
                    <Link
                      href="/products"
                      className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-white border border-[#21293d] rounded-md px-2 py-0.5 transition-colors"
                    >
                      <Boxes size={9} /> Edit in Products
                    </Link>
                    <Link
                      href="/inventory/purchase-orders"
                      className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-white border border-[#21293d] rounded-md px-2 py-0.5 transition-colors"
                    >
                      <FileText size={9} /> Purchase Orders
                    </Link>
                    <span
                      className={`flex items-center gap-1 text-[10px] font-extrabold ${st.color}`}
                    >
                      <CircleDot size={9} /> {st.label}
                    </span>
                    {stats.available < 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-extrabold text-red-400">
                        {stats.available} oversold
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={() => {
                  const bc = safeBarcode(product.barcode);
                  if (!bc) {
                    alert(
                      "Is product ka koi barcode set nahi hai — pehle Products page me barcode add karein."
                    );
                    return;
                  }
                  printBarcodeLabels([{ value: bc, name: product.name }]);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-300 hover:text-white rounded-xl text-sm font-bold transition-all active:scale-95"
              >
                <Printer size={15} /> Print Label
              </button>
              <button
                onClick={() => {
                  setEditingStock(null);
                  setModalOpen(true);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                <Plus size={16} /> Add Stock
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* ── STATS GRID ── */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            {
              label: "Total In",
              value: stats.totalIn,
              icon: ArrowDownToLine,
              color: "text-blue-400",
              bg: "from-blue-600/15 to-blue-700/5",
              border: "border-blue-500/20",
            },
            {
              label: "Total Sold",
              value: stats.totalSold,
              icon: ArrowUpFromLine,
              color: "text-purple-400",
              bg: "from-purple-600/15 to-purple-700/5",
              border: "border-purple-500/20",
            },
            {
              label: "Available",
              value: Math.max(0, stats.available),
              icon: Boxes,
              color: st.color,
              bg: `${st.bg.split(" ")[0].replace("bg-", "from-")} to-transparent`,
              border: st.bg.split(" ")[1],
            },
            {
              label: "Revenue",
              value: `₹${(stats.revenue / 1000).toFixed(1)}K`,
              icon: IndianRupee,
              color: "text-teal-400",
              bg: "from-teal-600/15 to-teal-700/5",
              border: "border-teal-500/20",
            },
            {
              label: "Stock Value",
              value: `₹${(stats.stockValue / 1000).toFixed(1)}K`,
              icon: BarChart3,
              color: "text-indigo-400",
              bg: "from-indigo-600/15 to-indigo-700/5",
              border: "border-indigo-500/20",
            },
            {
              label: "Cost Value",
              value: `₹${(costVal / 1000).toFixed(1)}K`,
              icon: IndianRupee,
              color: "text-slate-400",
              bg: "from-slate-600/15 to-slate-700/5",
              border: "border-slate-500/20",
            },
          ].map(({ label, value, icon: Icon, color, bg, border }) => (
            <div
              key={label}
              className={`bg-gradient-to-br ${bg} border ${border} rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:scale-[1.02] transition-transform`}
            >
              <Icon size={18} className={`${color} flex-shrink-0`} />
              <div className="min-w-0">
                <div className={`text-xl font-black ${color} truncate`}>{value}</div>
                <div className="text-[9px] text-slate-700 font-bold uppercase tracking-widest mt-0.5">
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── STOCK LOCATION (Spare Finder) ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#21293d]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                <MapPin size={14} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Stock Location</h3>
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                  Zone ▸ Rack ▸ Bin ▸ Box
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!locEditing && (
                <button
                  onClick={() => {
                    setEditLoc(
                      productLocations.length > 0
                        ? {
                            zone: productLocations[0].zone,
                            rack: productLocations[0].rack,
                            bin: productLocations[0].bin,
                            box: productLocations[0].box,
                          }
                        : { ...EMPTY_LOCATION }
                    );
                    setLocEditing(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#111520] hover:bg-[#1e2740] border border-[#21293d] text-slate-400 hover:text-white rounded-lg text-[11px] font-bold transition-all"
                >
                  <Edit3 size={11} /> Edit Location
                </button>
              )}
              <Link
                href="/inventory/locate"
                className="flex items-center gap-1 px-3 py-1.5 bg-[#111520] hover:bg-[#1e2740] border border-[#21293d] text-slate-400 hover:text-white rounded-lg text-[11px] font-bold transition-all"
              >
                <Search size={11} /> Spare Finder
              </Link>
            </div>
          </div>
          <div className="p-3">
            {locEditing ? (
              <div className="space-y-3">
                <LocationPicker
                  value={editLoc}
                  onChange={setEditLoc}
                  suggestions={{ zone: [], rack: [], bin: [], box: [] }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setLocSaving(true);
                      try {
                        const z = editLoc.zone || null;
                        const r = editLoc.rack || null;
                        const b = editLoc.bin || null;
                        const bx = editLoc.box || null;

                        let locationId: number | null = null;

                        if (z || r || b || bx) {
                          const { data: existingLoc } = await supabase
                            .from("locations")
                            .select("id")
                            .eq("zone", z || "")
                            .eq("rack", r || "")
                            .eq("bin", b || "")
                            .eq("box", bx || "")
                            .maybeSingle();

                          if (existingLoc) {
                            locationId = existingLoc.id;
                          } else {
                            const { data: newLoc } = await supabase
                              .from("locations")
                              .insert({ zone: z, rack: r, bin: b, box: bx })
                              .select("id")
                              .single();
                            if (newLoc) locationId = newLoc.id;
                          }
                        }

                        if (productLocations.length > 0) {
                          const existing = productLocations[0];
                          if (locationId !== null) {
                            await supabase
                              .from("product_locations")
                              .update({ location_id: locationId })
                              .eq("id", existing.id);
                          } else {
                            await supabase.from("product_locations").delete().eq("id", existing.id);
                          }
                        } else if (locationId !== null) {
                          await supabase
                            .from("product_locations")
                            .insert({ product_id: productId, location_id: locationId });
                        }

                        await logActivity(
                          "Updated Product Location",
                          "Inventory",
                          productId,
                          `Product: ${product.name} | Location: ${locPath(editLoc) || "cleared"}`
                        );
                        setLocEditing(false);
                        fetchData();
                      } catch (err) {
                        alert("Failed: " + (err as Error).message);
                      }
                      setLocSaving(false);
                    }}
                    disabled={locSaving}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    {locSaving ? "Saving..." : "Save Location"}
                  </button>
                  <button
                    onClick={() => setLocEditing(false)}
                    className="py-2.5 px-4 bg-[#111520] hover:bg-white/5 border border-[#21293d] text-slate-500 hover:text-slate-300 rounded-xl font-bold text-xs transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : productLocations.length > 0 ? (
              <div className="space-y-1.5">
                {productLocations.map((loc) => (
                  <div
                    key={loc.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#111520] border border-[#21293d] hover:border-emerald-500/30 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <MapPin size={13} className="text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-black text-slate-200 truncate">
                        {locPath(loc)}
                      </div>
                      <div className="text-[9px] text-slate-600 font-bold mt-0.5">
                        Product location
                      </div>
                    </div>
                  </div>
                ))}
                {stats.available <= 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[10px] text-amber-400 font-bold">
                    <AlertTriangle size={11} /> Out of stock — location retained
                  </div>
                )}
              </div>
            ) : (
              <div className="px-3 py-4 text-center">
                <MapPin size={22} className="mx-auto text-slate-800 mb-2" />
                <p className="text-slate-600 text-xs font-bold">
                  Location set nahi hai — Edit Location click karke assign karein
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── STOCK VISUAL + MONTHLY CHART ── */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Stock gauge */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={13} className="text-blue-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                Stock Level
              </span>
            </div>
            <div className="flex items-center gap-5">
              <StockRing
                available={stats.available}
                totalIn={stats.totalIn}
                alertQty={product?.alert_quantity}
              />
              <div className="flex-1 space-y-2.5">
                {[
                  { label: "Total Received", value: stats.totalIn, color: "bg-blue-500" },
                  { label: "Total Used/Sold", value: stats.totalSold, color: "bg-purple-500" },
                  { label: "Available Now", value: Math.max(0, stats.available), color: st.bar },
                ].map(({ label, value, color }) => {
                  const barPct = stats.totalIn > 0 ? (value / stats.totalIn) * 100 : 0;
                  return (
                    <div key={label}>
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[10px] text-slate-600 font-bold">{label}</span>
                        <span className="text-[11px] font-black text-slate-300">{value}</span>
                      </div>
                      <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${color}`}
                          style={{ width: `${barPct}%` }}
                        />
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
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                Monthly Usage (6 mo.)
              </span>
            </div>
            <div className="flex items-end gap-2 h-20">
              {monthlyOut.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-slate-600 font-bold">{m.qty || ""}</span>
                  <div
                    className="w-full rounded-t-md transition-all duration-700 overflow-hidden"
                    style={{
                      height: `${Math.max(m.pct, m.qty > 0 ? 8 : 2)}%`,
                      minHeight: 4,
                      background:
                        m.qty > 0
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
              {
                key: "in",
                label: "Stock-In History",
                icon: ArrowDownToLine,
                count: stockIn.length,
                color: "blue",
              },
              {
                key: "out",
                label: "Stock-Out / Usage",
                icon: ArrowUpFromLine,
                count: stockOut.length,
                color: "purple",
              },
              {
                key: "ledger",
                label: "Ledger / Movement",
                icon: Hash,
                count: ledger.length,
                color: "teal",
              },
            ].map(({ key, label, icon: Icon, count, color }) => {
              const active = activeTab === key;
              const colors: Record<string, string> = {
                blue: active
                  ? "border-b-2 border-blue-500 text-blue-400"
                  : "text-slate-600 hover:text-slate-400",
                purple: active
                  ? "border-b-2 border-purple-500 text-purple-400"
                  : "text-slate-600 hover:text-slate-400",
                teal: active
                  ? "border-b-2 border-teal-500 text-teal-400"
                  : "text-slate-600 hover:text-slate-400",
              };
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as "in" | "out" | "ledger")}
                  className={`flex items-center gap-2 px-5 py-3.5 text-xs font-extrabold uppercase tracking-wider transition-all ${colors[color]}`}
                >
                  <Icon size={13} />
                  {label}
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${active ? "bg-white/10" : "bg-white/5 text-slate-700"}`}
                  >
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
                      <th
                        key={h}
                        className={`px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 ${
                          i === 2 ? "text-right" : i === 4 ? "text-center" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
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
                          <span className="text-slate-300 text-xs font-medium">
                            {fmtDate(s.stock_date)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xl font-black text-blue-400">{s.quantity}</span>
                        <span className="text-slate-600 text-xs ml-1">units</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1">
                          {locPath(productLoc) ? (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <MapPin size={10} className="text-emerald-500/70" />{" "}
                              {locPath(productLoc)}
                            </span>
                          ) : (
                            <span className="text-slate-700 text-xs">—</span>
                          )}
                          {s.purchase_order_id && poCodes.has(s.purchase_order_id) && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-blue-400 font-bold border border-blue-500/20 bg-blue-500/5 rounded-md px-1.5 py-0.5 w-fit">
                              <FileText size={8} /> {poCodes.get(s.purchase_order_id)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingStock(s);
                              setModalOpen(true);
                            }}
                            className="p-1.5 bg-[#21293d] hover:bg-blue-600 border border-[#21293d] hover:border-blue-500 rounded-lg text-slate-500 hover:text-white transition-all"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteStock(s.id)}
                            className="p-1.5 bg-[#21293d] hover:bg-red-600/30 border border-[#21293d] hover:border-red-500/40 rounded-lg text-slate-500 hover:text-red-400 transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {stockIn.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <ArrowDownToLine size={28} className="mx-auto text-slate-800 mb-2" />
                        <p className="text-slate-600 text-sm font-bold">No stock entries yet</p>
                        <button
                          onClick={() => {
                            setEditingStock(null);
                            setModalOpen(true);
                          }}
                          className="mt-3 text-xs text-blue-400 hover:text-blue-300 font-bold"
                        >
                          + Add first stock entry
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
                {stockIn.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#111520] border-t border-[#21293d]">
                      <td
                        colSpan={2}
                        className="px-5 py-2.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider"
                      >
                        {stockIn.length} entries
                      </td>
                      <td className="px-5 py-2.5 text-right font-black text-blue-400">
                        {stats.totalIn}{" "}
                        <span className="text-slate-600 font-bold text-xs">total units</span>
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
                    {["#", "Date", "Reference", "Type", "Client", "Rate", "Qty", "Total"].map(
                      (h, i) => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 ${
                            [5, 6, 7].includes(i) ? "text-right" : "text-left"
                          }`}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]">
                  {stockOut.map((s, idx) => (
                    <tr
                      key={`${s.type}-${s.id}`}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-700 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {fmtDate(s.date)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={s.link}
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-bold text-xs transition-colors group"
                        >
                          {s.reference}
                          <ExternalLink
                            size={9}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                            s.type === "Repair Job"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          }`}
                        >
                          {s.type === "Repair Job" ? (
                            <Wrench size={8} />
                          ) : (
                            <ShoppingCart size={8} />
                          )}
                          {s.type === "Repair Job" ? "Repair" : "Sale"}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-xs text-slate-400 max-w-[120px] truncate"
                        title={s.client_name}
                      >
                        {s.client_name}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">
                        ₹{s.price.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-purple-400">{s.qty}</td>
                      <td className="px-4 py-3 text-right font-bold text-teal-400 text-xs whitespace-nowrap">
                        ₹{s.total.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                  {stockOut.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <ArrowUpFromLine size={28} className="mx-auto text-slate-800 mb-2" />
                        <p className="text-slate-600 text-sm font-bold">No usage records yet</p>
                        <p className="text-slate-700 text-xs mt-1">
                          Records appear when this product is used in repair jobs or direct sales
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
                {stockOut.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#111520] border-t border-[#21293d]">
                      <td
                        colSpan={5}
                        className="px-4 py-2.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider"
                      >
                        {stockOut.length} transactions
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600 text-xs font-bold">
                        Total
                      </td>
                      <td className="px-4 py-2.5 text-right font-black text-purple-400">
                        {stats.totalSold}
                      </td>
                      <td className="px-4 py-2.5 text-right font-black text-teal-400 text-sm">
                        ₹{stats.revenue.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* ── LEDGER / MOVEMENT TABLE ── */}
          {activeTab === "ledger" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#21293d]">
                    {["#", "Date", "Type", "Detail", "Qty", "Balance"].map((h, i) => (
                      <th
                        key={h}
                        className={`px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 ${
                          i >= 4 ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]">
                  {ledger.map((l, idx) => (
                    <tr key={l.key} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 text-slate-700 text-xs">{idx + 1}</td>
                      <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {fmtDate(l.date)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                            l.direction === "in"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          }`}
                        >
                          {l.direction === "in" ? (
                            <ArrowDownToLine size={8} />
                          ) : (
                            <ArrowUpFromLine size={8} />
                          )}
                          {l.direction === "in" ? "IN" : "OUT"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col">
                          <span className="text-slate-300 text-xs font-semibold">{l.label}</span>
                          <span className="text-slate-600 text-[10px] truncate max-w-[160px]">
                            {l.sub}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`font-black ${l.direction === "in" ? "text-blue-400" : "text-purple-400"}`}
                        >
                          {l.direction === "in" ? "+" : "-"}
                          {l.qty}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`font-black text-sm ${
                            l.balance <= 0
                              ? "text-red-400"
                              : l.balance <= alertThreshold(product?.alert_quantity)
                                ? "text-amber-400"
                                : "text-emerald-400"
                          }`}
                        >
                          {Math.max(0, l.balance)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {ledger.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <Hash size={28} className="mx-auto text-slate-800 mb-2" />
                        <p className="text-slate-600 text-sm font-bold">No movement yet</p>
                        <p className="text-slate-700 text-xs mt-1">
                          Chronological stock-in and usage ledger appears here
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
                {ledger.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#111520] border-t border-[#21293d]">
                      <td
                        colSpan={4}
                        className="px-5 py-2.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider"
                      >
                        {ledger.length} movements
                      </td>
                      <td className="px-5 py-2.5 text-right text-slate-600 text-xs font-bold">
                        Net
                      </td>
                      <td className="px-5 py-2.5 text-right font-black text-emerald-400">
                        {stats.available}
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
            Stock-out records are auto-generated from repair jobs and direct sales. Only
            non-cancelled transactions are counted. Edit or delete stock-in entries to adjust
            quantity manually.
          </p>
        </div>
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <StockModal
          productId={productId}
          productName={product.name}
          stock={editingStock}
          productLocationLabel={locPath(productLoc)}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
