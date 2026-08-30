"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { openImageLightbox } from "@/components/ImageLightbox";
import { safeImageSrc } from "@/lib/image-utils";
import { supabase, getCachedUser } from "@/lib/supabase";
import { stockStatusStyle, stockBarColor, alertThreshold, stockValue } from "@/lib/inventory";
import { locPath } from "@/lib/locations";
import {
  Package,
  Search,
  Eye,
  Printer,
  MapPin,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  RefreshCw,
  ArrowUpDown,
  X,
  Layers,
  Zap,
  ShoppingCart,
  Boxes,
  ScanLine,
  FileText,
  Minus,
  Plus,
  ShieldCheck,
} from "lucide-react";
import QuickScanModal from "./components/QuickScanModal";
import ProductFormModal from "@/components/ProductFormModal";
import PageLoader from "@/components/PageLoader";
import {
  printBarcodeLabels,
  safeBarcode,
  labelSheetCapacity,
  DEFAULT_PRINT_OPTIONS,
  type LabelSize,
  type Orientation,
  type PrintMargin,
  type BarcodeLabelItem,
} from "@/lib/barcodePrint";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProductStock {
  id: number;
  name: string;
  description: string;
  cost_price: number;
  price: number;
  image_path: string | null;
  barcode: string | null;
  alert_quantity: number;
  total_in: number;
  total_sold: number;
  available: number;
  oversold: number;
  place: string | null;
  places: string[];
  poCodes: string[];
  stock_value: number;
  cost_value: number;
  margin_pct: number;
}

type FilterType = "all" | "in-stock" | "low-stock" | "out-of-stock";
type SortKey = "name" | "available" | "total_sold" | "stock_value";

// ─── Mini sparkline bar ───────────────────────────────────────────────────────
function StockBar({
  available,
  total_in,
  alert_quantity = 5,
}: {
  available: number;
  total_in: number;
  alert_quantity?: number;
}) {
  const pct = total_in > 0 ? Math.max(0, Math.min(100, (available / total_in) * 100)) : 0;
  const color = stockBarColor(available, alert_quantity);
  return (
    <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [printOpts, setPrintOpts] = useState(DEFAULT_PRINT_OPTIONS);
  const [printOpen, setPrintOpen] = useState(false);
  const [printCopies, setPrintCopies] = useState<Record<number, number>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>("staff");
  const [roleChecked, setRoleChecked] = useState(false);

  useEffect(() => {
    getCachedUser().then(({ data: { user } }) => {
      if (!user) {
        setRoleChecked(true);
        return;
      }
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          setUserRole(data?.role ?? "staff");
          setRoleChecked(true);
        });
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const h = (e: MediaQueryList | MediaQueryListEvent) => setIsMobile(e.matches);
    h(mq);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchProducts = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const { data: pl } = await supabase
        .from("product_list")
        .select("id, name, description, cost_price, price, image_path, alert_quantity, barcode")
        .eq("delete_flag", 0)
        .order("name");

      if (!pl) {
        setProducts([]);
        return;
      }

      // Batch fetch all inventory + sold data at once (avoid N+1)
      const ids = pl.map((p) => p.id);

      const [stockRes, jobItemsRes, saleItemsRes, plLocs] = await Promise.all([
        supabase
          .from("inventory_list")
          .select("product_id, quantity, purchase_order_id")
          .in("product_id", ids),
        supabase
          .from("transaction_products")
          .select("product_id, qty, transaction_id")
          .in("product_id", ids),
        supabase.from("direct_sale_items").select("product_id, qty").in("product_id", ids),
        // `product_locations`/`locations` RLS-gated hain → anon-client khali []
        // deta hai. Service-role server route se read hota hai.
        fetch(`/api/locations/by-product?ids=${ids.join(",")}`).then((r) =>
          r.ok ? r.json() : Promise.reject()
        ),
      ]);

      const locMap = new Map<
        number,
        { zone: string; rack: string; bin: string; box: string }[]
      >();
      const plLocsData = (plLocs as Record<string, unknown>) || {};
      Object.entries(plLocsData).forEach(([pid, locs]) => {
        const arr = Array.isArray(locs)
          ? (locs as { zone?: string | null; rack?: string | null; bin?: string | null; box?: string | null }[])
          : [];
        const mapped = (arr || []).map((loc) => ({
          zone: loc?.zone ?? "",
          rack: loc?.rack ?? "",
          bin: loc?.bin ?? "",
          box: loc?.box ?? "",
        }));
        if (mapped.length > 0) locMap.set(Number(pid), mapped);
      });

      // Get valid (non-cancelled) transaction IDs once
      const txnIds = [...new Set((jobItemsRes.data || []).map((i) => i.transaction_id))];
      let validTxnSet = new Set<number>();
      if (txnIds.length > 0) {
        const { data: txns } = await supabase
          .from("transaction_list")
          .select("id")
          .in("id", txnIds)
          .neq("status", 4);
        validTxnSet = new Set((txns || []).map((t) => t.id));
      }

      // Build maps
      const stockMap = new Map<number, number>();
      const poIdMap = new Map<number, Set<number>>();
      (stockRes.data || []).forEach((r) => {
        stockMap.set(r.product_id, (stockMap.get(r.product_id) || 0) + r.quantity);
        if (r.purchase_order_id) {
          const set = poIdMap.get(r.product_id) || new Set<number>();
          set.add(r.purchase_order_id);
          poIdMap.set(r.product_id, set);
        }
      });

      // Fetch PO codes for all referenced purchase orders
      const allPoIds = [...new Set([...poIdMap.values()].flatMap((s) => [...s]))];
      const poCodeMap = new Map<number, string>();
      if (allPoIds.length) {
        const { data: poRows } = await supabase
          .from("purchase_orders")
          .select("id, po_code")
          .in("id", allPoIds);
        (poRows || []).forEach((r: { id: number; po_code: string }) =>
          poCodeMap.set(r.id, r.po_code)
        );
      }

      const soldJobMap = new Map<number, number>();
      (jobItemsRes.data || []).forEach((r) => {
        if (validTxnSet.has(r.transaction_id)) {
          soldJobMap.set(r.product_id, (soldJobMap.get(r.product_id) || 0) + (r.qty || 0));
        }
      });

      const soldSaleMap = new Map<number, number>();
      (saleItemsRes.data || []).forEach((r) => {
        soldSaleMap.set(r.product_id, (soldSaleMap.get(r.product_id) || 0) + (r.qty || 0));
      });

      const result: ProductStock[] = pl.map((p) => {
        const qty = stockMap.get(p.id) || 0;
        const soldJob = soldJobMap.get(p.id) || 0;
        const soldSale = soldSaleMap.get(p.id) || 0;
        const totalSold = soldJob + soldSale;
        const available = qty - totalSold;
        const locs = locMap.get(p.id) || [];
        const placePaths = locs.map((l) => locPath(l)).filter(Boolean);
        const placePath = placePaths[0] || "";
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          cost_price: p.cost_price || 0,
          price: p.price || 0,
          image_path: p.image_path || null,
          barcode: p.barcode || null,
          alert_quantity: p.alert_quantity || 5,
          total_in: qty,
          total_sold: totalSold,
          available,
          oversold: Math.max(0, -available),
          place: placePath || null,
          places: placePaths,
          poCodes: [...(poIdMap.get(p.id) || [])]
            .map((id) => poCodeMap.get(id))
            .filter(Boolean) as string[],
          stock_value: stockValue(available, p.price),
          cost_value: stockValue(available, p.cost_price),
          margin_pct:
            p.price && p.cost_price != null && p.price > 0
              ? Math.round(((p.price - (p.cost_price || 0)) / p.price) * 100)
              : 0,
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

  useEffect(() => {
    fetchProducts();
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      total: products.length,
      inStock: products.filter((p) => p.available > alertThreshold(p.alert_quantity)).length,
      lowStock: products.filter(
        (p) => p.available > 0 && p.available <= alertThreshold(p.alert_quantity)
      ).length,
      outOfStock: products.filter((p) => p.available <= 0).length,
      totalValue: products.reduce((s, p) => s + p.stock_value, 0),
      totalSold: products.reduce((s, p) => s + p.total_sold, 0),
    }),
    [products]
  );

  // ── Filtered + Sorted ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      const q = searchTerm.toLowerCase();
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.description.toLowerCase().includes(q) &&
        !(p.barcode || "").toLowerCase().includes(q)
      )
        return false;
      const threshold = Math.max(1, p.alert_quantity);
      if (filter === "in-stock" && !(p.available > threshold)) return false;
      if (filter === "low-stock" && !(p.available > 0 && p.available <= threshold)) return false;
      if (filter === "out-of-stock" && p.available > 0) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      let diff = 0;
      if (sortKey === "name") diff = a.name.localeCompare(b.name);
      if (sortKey === "available") diff = a.available - b.available;
      if (sortKey === "total_sold") diff = a.total_sold - b.total_sold;
      if (sortKey === "stock_value") diff = a.stock_value - b.stock_value;
      return sortAsc ? diff : -diff;
    });

    return list;
  }, [products, searchTerm, filter, sortKey, sortAsc]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const pageCount = Math.max(
    1,
    Math.ceil(filtered.length / (pageSize === 0 ? filtered.length : pageSize))
  );
  const safePage = Math.min(page, pageCount);
  const paginated = useMemo(() => {
    if (pageSize === 0) return filtered; // "All"
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSize, safePage]);

  // Reset to page 1 whenever the dataset changes shape (search/filter/sort)
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filter, sortKey, sortAsc, pageSize]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((p) => !p);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
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
        <th>#</th><th>Product</th><th>Total In</th><th>Sold</th><th>Available</th><th>Price</th><th>Stock Value</th><th>Cost Value</th><th>Status</th>
      </tr></thead><tbody>
        ${products
          .map(
            (p, i) => `<tr>
          <td>${i + 1}</td><td><b>${p.name}</b><br><small>${p.description}</small></td>
          <td>${p.total_in}</td><td>${p.total_sold}</td>
          <td><b>${Math.max(0, p.available)}</b></td>
          <td>₹${p.price.toFixed(2)}</td>
          <td>₹${p.stock_value.toFixed(2)}</td>
          <td>₹${p.cost_value.toFixed(2)}</td>
          <td>${p.available <= 0 ? "Out of Stock" : p.available <= alertThreshold(p.alert_quantity) ? "Low Stock" : "In Stock"}</td>
        </tr>`
          )
          .join("")}
      </tbody></table>
    </body></html>`);
    w.document.close();
    w.print();
  };

  // ── Print barcode labels — selector modal ───────────────────────────────────
  const printableProducts = useMemo(
    () => filtered.filter((p) => safeBarcode(p.barcode)),
    [filtered]
  );

  const getCopies = (id: number) => printCopies[id] ?? 1;

  const adjustCopies = (id: number, delta: number) => {
    setPrintCopies((prev) => ({
      ...prev,
      [id]: Math.max(1, Math.min(999, (prev[id] ?? 1) + delta)),
    }));
  };

  const setCopies = (id: number, raw: string) => {
    const n = Math.max(1, Math.min(999, Number(raw) || 1));
    setPrintCopies((prev) => ({ ...prev, [id]: n }));
  };

  const totalLabels = printableProducts.reduce((s, p) => s + getCopies(p.id), 0);
  const perSheet = labelSheetCapacity(printOpts).perSheet;

  const openPrintModal = () => {
    if (!printableProducts.length) {
      alert(
        "Filtered list me kisi product ka barcode set nahi hai. Pehle Products page me barcodes add karein."
      );
      return;
    }
    const init: Record<number, number> = {};
    for (const p of printableProducts) init[p.id] = 1;
    setPrintCopies(init);
    setPrintOpen(true);
  };

  const handlePrintModal = () => {
    if (totalLabels === 0) return;
    if (totalLabels > 1000) {
      alert(`Bohot zyada labels (${totalLabels}) — total 1000 se kam rakhein.`);
      return;
    }
    const items: BarcodeLabelItem[] = [];
    for (const p of printableProducts) {
      for (let i = 0; i < getCopies(p.id); i++) items.push({ value: p.barcode!, name: p.name });
    }
    printBarcodeLabels(items, printOpts);
    setPrintOpen(false);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading || !roleChecked) {
    return <PageLoader icon={Package} label="Loading Inventory..." tone="blue" />;
  }

  // ── Role guard ── Stock Overview is admin-only ─────────────────────────
  if (userRole !== "admin" && userRole !== "developer") {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-6">
        <div className="text-center">
          <ShieldCheck size={40} className="text-slate-700 mx-auto mb-3" />
          <h1 className="text-lg font-black text-white tracking-tight">Admin only</h1>
          <p className="text-slate-600 text-sm mt-1">
            Stock Overview sirf admin dekh sakta hai.
          </p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-16">
      {/* ── HERO HEADER ── */}
      <div className="relative overflow-hidden bg-[#0d1117] border-b border-[#21293d]">
        {/* Background grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
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
            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
              >
                <Plus size={13} /> Add Product
              </button>
              <Link
                href="/inventory/locate"
                className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                <MapPin size={13} /> Spare Finder
              </Link>
              <Link
                href="/inventory/purchase-orders"
                className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                <FileText size={13} /> Purchase Orders
              </Link>
              <button
                onClick={openPrintModal}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                <Printer size={13} /> Labels
              </button>
              <button
                onClick={() => setScanOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                <ScanLine size={13} /> Scan
              </button>
              <button
                onClick={() => fetchProducts(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                <Printer size={13} /> Print
              </button>
            </div>
          </div>

          {/* ── STAT CARDS ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
            {[
              {
                label: "Total Items",
                value: stats.total,
                icon: Layers,
                color: "from-blue-600/20 to-blue-700/5",
                border: "border-blue-500/20",
                text: "text-blue-400",
              },
              {
                label: "In Stock",
                value: stats.inStock,
                icon: CheckCircle,
                color: "from-emerald-600/20 to-emerald-700/5",
                border: "border-emerald-500/20",
                text: "text-emerald-400",
              },
              {
                label: "Low Stock",
                value: stats.lowStock,
                icon: AlertTriangle,
                color: "from-amber-600/20 to-amber-700/5",
                border: "border-amber-500/20",
                text: "text-amber-400",
              },
              {
                label: "Out of Stock",
                value: stats.outOfStock,
                icon: XCircle,
                color: "from-red-600/20 to-red-700/5",
                border: "border-red-500/20",
                text: "text-red-400",
              },
              {
                label: "Total Sold",
                value: stats.totalSold,
                icon: ShoppingCart,
                color: "from-purple-600/20 to-purple-700/5",
                border: "border-purple-500/20",
                text: "text-purple-400",
              },
              {
                label: "Stock Value",
                value: `₹${(stats.totalValue / 1000).toFixed(1)}K`,
                icon: BarChart3,
                color: "from-teal-600/20 to-teal-700/5",
                border: "border-teal-500/20",
                text: "text-teal-400",
              },
            ].map(({ label, value, icon: Icon, color, border, text }) => (
              <div
                key={label}
                className={`relative bg-gradient-to-br ${color} border ${border} rounded-2xl px-4 py-3.5 overflow-hidden group hover:scale-[1.02] transition-transform`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`text-xl font-black ${text}`}>{value}</div>
                    <div className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">
                      {label}
                    </div>
                  </div>
                  <Icon
                    size={16}
                    className={`${text} opacity-50 group-hover:opacity-100 transition-opacity`}
                  />
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
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"
              size={15}
            />
            <input
              type="text"
              placeholder="Search products, descriptions, barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-[#161b27] border border-[#21293d] text-slate-200 placeholder-slate-600 rounded-xl text-sm focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex gap-1.5">
            {(
              [
                { key: "all", label: "All", count: stats.total, color: "blue" },
                { key: "in-stock", label: "In Stock", count: stats.inStock, color: "emerald" },
                { key: "low-stock", label: "Low", count: stats.lowStock, color: "amber" },
                { key: "out-of-stock", label: "Out", count: stats.outOfStock, color: "red" },
              ] as const
            ).map(({ key, label, count, color }) => {
              const active = filter === key;
              const styles: Record<string, string> = {
                blue: active
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-[#161b27] text-slate-500 border-[#21293d] hover:border-blue-500/40",
                emerald: active
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-[#161b27] text-slate-500 border-[#21293d] hover:border-emerald-500/40",
                amber: active
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-[#161b27] text-slate-500 border-[#21293d] hover:border-amber-500/40",
                red: active
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-[#161b27] text-slate-500 border-[#21293d] hover:border-red-500/40",
              };
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border transition-all ${styles[color]}`}
                >
                  {label}
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-white/5"}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results indicator */}
        {(searchTerm || filter !== "all" || pageSize !== 25) && (
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            <span>
              Showing{" "}
              <span className="text-slate-400 font-bold">
                {filtered.length === 0 ? 0 : (safePage - 1) * (pageSize || filtered.length) + 1}-
                {Math.min(safePage * (pageSize || filtered.length), filtered.length)}
              </span>{" "}
              of {filtered.length} products
            </span>
            {(searchTerm || filter !== "all") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilter("all");
                }}
                className="text-blue-500 hover:text-blue-400 font-bold"
              >
                Clear filters
              </button>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#111520] border-b border-[#21293d]">
                    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-600 w-10">
                      #
                    </th>

                    {/* Sortable: Product */}
                    <th className="px-4 py-3 text-left w-[280px]">
                      <button
                        onClick={() => toggleSort("name")}
                        className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 hover:text-slate-400 transition-colors"
                      >
                        Product{" "}
                        <ArrowUpDown
                          size={10}
                          className={sortKey === "name" ? "text-blue-400" : ""}
                        />
                      </button>
                    </th>

                    <th className="px-4 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-600 w-28">
                      Stock
                    </th>

                    {/* Sortable: Available */}
                    <th className="px-4 py-3 text-right w-20">
                      <button
                        onClick={() => toggleSort("available")}
                        className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 hover:text-slate-400 transition-colors ml-auto"
                      >
                        Avail{" "}
                        <ArrowUpDown
                          size={10}
                          className={sortKey === "available" ? "text-blue-400" : ""}
                        />
                      </button>
                    </th>

                    {/* Sortable: Sold */}
                    <th className="px-4 py-3 text-right w-20">
                      <button
                        onClick={() => toggleSort("total_sold")}
                        className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 hover:text-slate-400 transition-colors ml-auto"
                      >
                        Sold{" "}
                        <ArrowUpDown
                          size={10}
                          className={sortKey === "total_sold" ? "text-blue-400" : ""}
                        />
                      </button>
                    </th>

                    {/* Sortable: Value */}
                    <th className="px-4 py-3 text-right w-24">
                      <button
                        onClick={() => toggleSort("stock_value")}
                        className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 hover:text-slate-400 transition-colors ml-auto"
                      >
                        Value{" "}
                        <ArrowUpDown
                          size={10}
                          className={sortKey === "stock_value" ? "text-blue-400" : ""}
                        />
                      </button>
                    </th>

                    <th className="px-4 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-600 w-24">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-600 w-32">
                      Place
                    </th>
                    <th className="px-4 py-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-600 w-20">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#21293d]">
                  {paginated.map((p, idx) => {
                    const st = stockStatusStyle(p.available, p.alert_quantity);
                    return (
                      <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-slate-700 text-xs">
                          {pageSize === 0 ? idx + 1 : (safePage - 1) * pageSize + idx + 1}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {safeImageSrc(p.image_path) ? (
                              <Image
                                src={safeImageSrc(p.image_path)}
                                alt={p.name}
                                width={48}
                                height={48}
                                className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-[#21293d] cursor-zoom-in"
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  openImageLightbox(p.image_path, p.name);
                                }}
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${st.bg}`}
                              >
                                <Package size={14} className={st.color} />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div
                                className="font-bold text-slate-200 text-sm truncate max-w-[250px]"
                                title={p.name}
                              >
                                {p.name}
                              </div>
                              <div
                                className="text-xs text-slate-600 truncate max-w-[250px]"
                                title={p.description}
                              >
                                {p.description}
                              </div>
                              {p.barcode && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-mono text-purple-500/70 truncate max-w-[200px]">
                                    {p.barcode}
                                  </span>
                                  <button
                                    onClick={() =>
                                      printBarcodeLabels([{ value: p.barcode!, name: p.name }])
                                    }
                                    title="Print label"
                                    className="text-slate-700 hover:text-slate-300 transition-colors"
                                  >
                                    <Printer size={10} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Stock bar cell */}
                        <td className="px-4 py-3 w-28">
                          <div className="flex flex-col gap-1 items-end">
                            <span className="text-[10px] text-slate-600">{p.total_in} in</span>
                            <StockBar
                              available={p.available}
                              total_in={p.total_in}
                              alert_quantity={p.alert_quantity}
                            />
                          </div>
                        </td>

                        <td className={`px-4 py-3 text-right font-black text-lg ${st.color}`}>
                          {Math.max(0, p.available)}
                          {p.oversold > 0 && (
                            <span className="block text-[9px] font-extrabold text-red-400 uppercase tracking-wider">
                              -{p.oversold} oversold
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <span className="text-slate-400 font-bold">{p.total_sold}</span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <span
                            className={`text-xs font-bold ${p.stock_value > 0 ? "text-teal-400" : "text-slate-700"}`}
                          >
                            {p.stock_value > 0 ? `₹${p.stock_value.toLocaleString("en-IN")}` : "—"}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${st.bg} ${st.color}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${st.bar}`} />
                            {st.label}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1 max-w-[180px] mx-auto">
                            {p.places.length > 0 ? (
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                {p.places.slice(0, 2).map((pl) => (
                                  <Link
                                    key={pl}
                                    href={`/inventory/locate?loc=${encodeURIComponent(pl)}`}
                                    title={pl}
                                    className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 border border-[#21293d] rounded-md px-1.5 py-0.5 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors"
                                  >
                                    <MapPin size={9} className="text-slate-700" />{" "}
                                    {pl.split(" ▸ ").slice(-2).join(" ▸ ")}
                                  </Link>
                                ))}
                                {p.places.length > 2 && (
                                  <span className="text-[10px] text-slate-700 font-bold">
                                    +{p.places.length - 2}
                                  </span>
                                )}
                              </div>
                            ) : p.poCodes.length === 0 ? (
                              <span className="text-slate-700 text-[11px]">—</span>
                            ) : null}
                            {p.poCodes.length > 0 && (
                              <div
                                className="flex flex-wrap items-center justify-center gap-1"
                                title={`PO: ${p.poCodes.join(", ")}`}
                              >
                                {p.poCodes.slice(0, 2).map((code) => (
                                  <span
                                    key={code}
                                    className="inline-flex items-center gap-0.5 text-[10px] text-blue-400 font-bold border border-blue-500/20 bg-blue-500/5 rounded-md px-1.5 py-0.5"
                                  >
                                    <FileText size={8} /> {code}
                                  </span>
                                ))}
                                {p.poCodes.length > 2 && (
                                  <span className="text-[10px] text-slate-700 font-bold">
                                    +{p.poCodes.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <Link
                            href={`/inventory/${p.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                          >
                            <Eye size={12} /> View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}

                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-20 text-center">
                        <Package size={36} className="mx-auto text-slate-800 mb-3" />
                        <p className="text-slate-600 font-bold text-sm">No products found</p>
                        <p className="text-slate-700 text-xs mt-1">
                          Try adjusting your search or filter
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* Table Footer Summary */}
                {paginated.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#111520] border-t border-[#21293d]">
                      <td
                        colSpan={3}
                        className="px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-600"
                      >
                        {paginated.length} on this page
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

            {/* Pagination footer */}
            {filtered.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[#21293d] bg-[#111520]">
                <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold">
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-[#161b27] border border-[#21293d] text-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold outline-none focus:border-blue-500/60"
                  >
                    {[10, 25, 50, 100, 0].map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? "All" : n}
                      </option>
                    ))}
                  </select>
                  <span>rows · {filtered.length} total</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="px-3 py-1.5 bg-[#161b27] border border-[#21293d] hover:border-blue-500/40 text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  <span className="px-3 py-1.5 text-[11px] font-black text-slate-400 bg-[#161b27] border border-[#21293d] rounded-lg">
                    {safePage} / {pageCount}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={safePage >= pageCount}
                    className="px-3 py-1.5 bg-[#161b27] border border-[#21293d] hover:border-blue-500/40 text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MOBILE CARDS                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {isMobile && (
        <div className="px-3 space-y-3">
          {paginated.map((p) => {
            const st = stockStatusStyle(p.available, p.alert_quantity);
            const pct =
              p.total_in > 0 ? Math.max(0, Math.min(100, (p.available / p.total_in) * 100)) : 0;
            const threshold = alertThreshold(p.alert_quantity);

            return (
              <div
                key={p.id}
                className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden group"
              >
                {/* Top accent bar — colored by status */}
                <div
                  className={`h-0.5 w-full ${
                    p.available <= 0
                      ? "bg-red-500"
                      : p.available <= threshold
                        ? "bg-amber-400"
                        : "bg-emerald-500"
                  }`}
                />

                <div className="p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {safeImageSrc(p.image_path) ? (
                        <Image
                          src={safeImageSrc(p.image_path)}
                          alt={p.name}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-[#21293d] cursor-zoom-in"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            openImageLightbox(p.image_path, p.name);
                          }}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${st.bg}`}
                        >
                          <Package size={16} className={st.color} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-black text-white text-sm truncate">{p.name}</div>
                        <div className="text-[11px] text-slate-600 truncate mt-0.5">
                          {p.description}
                        </div>
                        {p.barcode && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] font-mono text-purple-500/70 truncate">
                              {p.barcode}
                            </span>
                            <button
                              onClick={() =>
                                printBarcodeLabels([{ value: p.barcode!, name: p.name }])
                              }
                              title="Print label"
                              className="text-slate-700 hover:text-slate-300 transition-colors"
                            >
                              <Printer size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-extrabold border ${st.bg} ${st.color}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${st.bar}`} />
                      {st.short}
                    </span>
                    {p.oversold > 0 && (
                      <span className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-extrabold border bg-red-500/10 border-red-500/25 text-red-400">
                        -{p.oversold} over
                      </span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: "Available", value: Math.max(0, p.available), color: st.color },
                      { label: "Total In", value: p.total_in, color: "text-slate-400" },
                      { label: "Sold", value: p.total_sold, color: "text-purple-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-[#111520] rounded-xl p-2.5 text-center">
                        <div className={`text-xl font-black ${color}`}>{value}</div>
                        <div className="text-[8px] text-slate-700 font-bold uppercase tracking-widest mt-0.5">
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Stock bar */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-slate-700 font-bold uppercase tracking-wider">
                        Stock Level
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          p.available <= 0
                            ? "bg-red-500"
                            : p.available <= threshold
                              ? "bg-amber-400"
                              : "bg-emerald-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Bottom row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-wrap">
                      {p.places.length > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-600">
                          <MapPin size={10} />
                          {p.places.slice(0, 2).join(", ")}
                          {p.places.length > 2 && (
                            <span className="text-slate-700 font-bold">+{p.places.length - 2}</span>
                          )}
                        </span>
                      )}
                      {p.poCodes.length > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-blue-400 font-bold">
                          <FileText size={10} />
                          {p.poCodes.slice(0, 2).join(", ")}
                          {p.poCodes.length > 2 && (
                            <span className="text-slate-700 font-bold">
                              +{p.poCodes.length - 2}
                            </span>
                          )}
                        </span>
                      )}
                      {p.stock_value > 0 && (
                        <span className="text-[11px] text-teal-500 font-bold">
                          ₹{p.stock_value.toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/inventory/${p.id}`}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                    >
                      <Eye size={12} /> View
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}

          {paginated.length === 0 && (
            <div className="py-20 text-center bg-[#161b27] border border-dashed border-[#21293d] rounded-2xl">
              <Package size={36} className="mx-auto text-slate-800 mb-3" />
              <p className="text-slate-600 font-bold text-sm">No products match</p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilter("all");
                }}
                className="mt-3 text-xs text-blue-500 hover:text-blue-400 font-bold"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Mobile pagination footer */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
              <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-[#161b27] border border-[#21293d] text-slate-300 rounded-lg px-2 py-1.5 text-[11px] font-bold outline-none focus:border-blue-500/60"
                >
                  {[10, 25, 50, 100, 0].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "All" : n}
                    </option>
                  ))}
                </select>
                <span>rows</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="px-3 py-1.5 bg-[#161b27] border border-[#21293d] hover:border-blue-500/40 text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="px-3 py-1.5 text-[11px] font-black text-slate-400 bg-[#161b27] border border-[#21293d] rounded-lg">
                  {safePage} / {pageCount}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={safePage >= pageCount}
                  className="px-3 py-1.5 bg-[#161b27] border border-[#21293d] hover:border-blue-500/40 text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
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
              <p className="text-slate-700 text-[11px] mt-0.5">
                Restock recommended to avoid service delays
              </p>
            </div>
            <button
              onClick={() => setFilter("out-of-stock")}
              className="text-[10px] font-extrabold text-red-400 hover:text-red-300 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
            >
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
                {stats.lowStock} product{stats.lowStock > 1 ? "s" : ""} running low
              </p>
              <p className="text-slate-700 text-[11px] mt-0.5">Consider restocking soon</p>
            </div>
            <button
              onClick={() => setFilter("low-stock")}
              className="text-[10px] font-extrabold text-amber-400 hover:text-amber-300 border border-amber-500/20 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
            >
              View All
            </button>
          </div>
        </div>
      )}

      {/* ── LOW STOCK QUICK PANEL ── */}
      {products.some((p) => p.available > 0 && p.available <= alertThreshold(p.alert_quantity)) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[#21293d] bg-[#111520]">
              <Zap size={13} className="text-amber-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Critical Low Stock
              </span>
            </div>
            <div className="flex flex-wrap gap-2 p-4">
              {products
                .filter((p) => p.available > 0 && p.available <= alertThreshold(p.alert_quantity))
                .map((p) => (
                  <Link
                    key={p.id}
                    href={`/inventory/${p.id}`}
                    className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/40 px-3 py-2 rounded-xl transition-colors group"
                  >
                    <span className="w-5 h-5 bg-amber-500 text-white text-[10px] font-black rounded flex items-center justify-center flex-shrink-0 group-hover:bg-amber-400 transition-colors">
                      {p.available}
                    </span>
                    <span className="text-xs font-bold text-slate-400 group-hover:text-slate-200 transition-colors max-w-[120px] truncate">
                      {p.name}
                    </span>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── QUICK SCAN MODAL ── */}
      {scanOpen && (
        <QuickScanModal
          onClose={() => setScanOpen(false)}
          onSaved={() => {
            setScanOpen(false);
            fetchProducts();
          }}
        />
      )}

      {/* ── ADD PRODUCT MODAL (shared component) ── */}
      <ProductFormModal
        open={addOpen}
        editing={null}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false);
          fetchProducts();
        }}
      />

      {/* ── PRINT LABELS MODAL ── */}
      {printOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#21293d] flex-shrink-0">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                <Printer size={16} className="text-blue-400" /> Print Barcode Labels
              </h3>
              <button
                onClick={() => setPrintOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Print options bar */}
            <div className="px-5 py-3 border-b border-[#21293d] bg-[#111520] flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
              <div className="text-[11px] text-slate-400 font-bold">
                {printableProducts.length} products me barcode hai
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Label
                  </span>
                  <select
                    value={printOpts.size}
                    onChange={(e) =>
                      setPrintOpts((p) => ({ ...p, size: e.target.value as LabelSize }))
                    }
                    className="bg-[#0d1117] border border-[#21293d] text-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold outline-none focus:border-blue-500/60 cursor-pointer"
                  >
                    <option value="medium">63.5 × 38mm</option>
                    <option value="small">63.5 × 25mm</option>
                    <option value="compact">50 × 20mm</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Orient
                  </span>
                  <select
                    value={printOpts.orientation}
                    onChange={(e) =>
                      setPrintOpts((p) => ({ ...p, orientation: e.target.value as Orientation }))
                    }
                    className="bg-[#0d1117] border border-[#21293d] text-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold outline-none focus:border-blue-500/60 cursor-pointer"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Margin
                  </span>
                  <select
                    value={printOpts.margin}
                    onChange={(e) =>
                      setPrintOpts((p) => ({ ...p, margin: e.target.value as PrintMargin }))
                    }
                    className="bg-[#0d1117] border border-[#21293d] text-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold outline-none focus:border-blue-500/60 cursor-pointer"
                  >
                    <option value="narrow">Narrow (3mm)</option>
                    <option value="normal">Normal (8mm)</option>
                    <option value="wide">Wide (14mm)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Product copies list */}
            <div className="overflow-y-auto min-h-0 flex-1 px-5 py-4 space-y-2">
              {printableProducts.map((p) => {
                const copies = getCopies(p.id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-200 truncate">{p.name}</div>
                      <div className="text-[10px] font-mono text-purple-500/70 truncate">
                        {p.barcode}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => adjustCopies(p.id, -1)}
                        disabled={copies <= 1}
                        className="w-7 h-7 rounded-lg bg-[#161b27] border border-[#21293d] text-slate-400 hover:text-white hover:border-blue-500/40 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={copies}
                        onChange={(e) => setCopies(p.id, e.target.value)}
                        className="w-14 h-7 text-center bg-[#161b27] border border-[#21293d] text-white rounded-lg text-xs font-bold outline-none focus:border-blue-500/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => adjustCopies(p.id, 1)}
                        disabled={copies >= 999}
                        className="w-7 h-7 rounded-lg bg-[#161b27] border border-[#21293d] text-slate-400 hover:text-white hover:border-blue-500/40 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#21293d] bg-[#111520] flex items-center justify-between gap-3 flex-shrink-0">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Total labels
                </div>
                <div className="text-lg font-black text-white leading-tight">
                  {totalLabels}
                  <span className="text-xs font-bold text-slate-500 ml-2">
                    ≈ {Math.ceil(totalLabels / perSheet)} A4 sheet(s)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handlePrintModal}
                disabled={totalLabels === 0}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all"
              >
                <Printer size={14} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
