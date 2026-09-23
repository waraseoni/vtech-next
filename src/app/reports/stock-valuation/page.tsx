"use client";

import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { todayIST } from "@/lib/dateUtils";
import {
  fetchProductValuation,
  fetchLocationValuation,
  type ProductValuationRow,
  type LocationValuationRow,
} from "@/lib/stockValuation";
import {
  ArrowLeft,
  Printer,
  RefreshCw,
  Search,
  Loader2,
  Coins,
  Package,
  PackageX,
  MapPin,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react";
import Link from "next/link";

const fmtDay = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const inr = (n: number) =>
  "₹" +
  Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function StockValuationReport() {
  const today = todayIST();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductValuationRow[]>([]);
  const [locations, setLocations] = useState<LocationValuationRow[]>([]);
  const [locTotals, setLocTotals] = useState({ totalValue: 0, totalQty: 0, totalLocations: 0 });
  const [firmName, setFirmName] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: sys }, prodReport, locReport] = await Promise.all([
        supabase.from("system_info").select("meta_field, meta_value"),
        fetchProductValuation(),
        fetchLocationValuation(),
      ]);
      const info: Record<string, string> = {};
      (sys || []).forEach((r) => (info[r.meta_field] = r.meta_value));
      setFirmName(info.name || "V-Technologies");
      setProducts(prodReport.rows);
      setLocations(locReport.rows);
      setLocTotals({
        totalValue: locReport.totalValue,
        totalQty: locReport.totalQty,
        totalLocations: locReport.totalLocations,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const totalValue = products.reduce((s, p) => s + p.value, 0);
  const totalUnits = products.reduce((s, p) => s + p.available, 0);
  const inStockCount = products.filter((p) => p.available > 0).length;
  const outOfStockCount = products.length - inStockCount;

  const q = search.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.hsn.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q)
    );
  }, [products, q]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* Print header */}
      <div className="hidden print:block">
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
          <div>
            <div className="text-2xl font-black">{firmName}</div>
            <div className="text-sm">Stock Valuation — as on {fmtDay.format(new Date(today))}</div>
          </div>
          <div className="text-right text-sm">Generated: {fmtDay.format(new Date(today))}</div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-panel border border-app rounded-[2rem] p-6 shadow-2xl relative overflow-hidden no-print">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div className="flex items-center gap-5">
            <Link
              href="/reports"
              className="w-12 h-12 flex items-center justify-center bg-app border border-app rounded-2xl text-muted hover:text-white hover:bg-emerald-600/10 hover:border-emerald-500/40 transition-all group"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-500/10">
              <Coins size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Stock Valuation</h1>
              <p className="text-xs text-muted font-bold uppercase tracking-[0.3em]">
                Available basis + location-wise
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="flex items-center gap-2 px-5 py-3 bg-app border border-app rounded-2xl text-xs font-black uppercase tracking-widest text-muted hover:text-white transition-all"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-amber-600/20"
            >
              <Printer size={14} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-900 rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">
            Total Stock Value
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">{inr(totalValue)}</div>
          <div className="text-[10px] text-emerald-200/70 font-bold mt-1">
            available × avg purchase cost
          </div>
        </div>
        <div className="bg-gradient-to-br from-cyan-600 to-cyan-900 rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">
            Units Available
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">{totalUnits.toLocaleString("en-IN")}</div>
          <div className="text-[10px] text-cyan-200/70 font-bold mt-1">
            {products.length} active products
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-600 to-orange-800 rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">
            Products In Stock
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">{inStockCount}</div>
        </div>
        <div className="bg-gradient-to-br from-slate-600 to-slate-800 rounded-2xl p-4 sm:p-5 text-white shadow-xl">
          <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">
            Out Of Stock
          </div>
          <div className="text-2xl sm:text-3xl font-black mt-1">{outOfStockCount}</div>
        </div>
      </div>

      {/* Note */}
      <div className="flex items-start gap-3 bg-panel border border-app rounded-2xl p-4 no-print">
        <Info size={16} className="text-emerald-400 mt-0.5 shrink-0" />
        <p className="text-xs text-muted leading-relaxed">
          <span className="font-black text-app-2 uppercase tracking-widest">
            Do views ka farak:
          </span>{" "}
          <b>Product value</b> = available (sales kat ke) × weighted avg purchase cost — abhi
          sell karein to kitna. <b>Location value</b> = sankh me pada inbound stock (qty ×
          purchase cost) shelf ke hisaab se. Sales ko shelf-level par split nahi kiya ja sakta,
          isliye ye dono alag hain.
        </p>
      </div>

      {/* Product valuation */}
      <div className="bg-panel border border-app rounded-[2rem] p-5 no-print">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative w-full md:flex-1 lg:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-2" size={16} />
            <input
              type="text"
              placeholder="Search by product, HSN or shelf..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-app border border-app rounded-2xl text-sm text-app-2 outline-none focus:border-emerald-500 transition-all"
            />
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted">
            <Package size={13} className="text-emerald-400" />
            {filteredProducts.length} products
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-48">
          <Loader2 size={48} className="animate-spin text-emerald-500" />
        </div>
      ) : (
        <>
          {/* ── PRODUCT TABLE ── */}
          <div className="overflow-x-auto bg-panel border border-app rounded-[1.5rem] shadow-2xl">
            <table className="w-full text-sm">
              <thead className="theme-panel-2">
                <tr>
                  {["Product", "HSN", "Available", "Avg Cost", "Stock Value", "Location"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-muted whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21293d]">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <PackageX size={36} className="mx-auto text-app mb-3" />
                      <p className="text-muted font-bold text-sm">Koi product nahi mila</p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.productId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/inventory/${p.productId}`}
                          className="font-bold text-emerald-700 hover:text-emerald-600 hover:underline no-underline transition-colors dark:text-emerald-400/90 dark:hover:text-emerald-300"
                        >
                          {p.name}
                        </Link>
                        {p.description && (
                          <div className="text-[10px] text-muted-2 max-w-[320px] truncate">
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                        {p.hsn || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${
                            p.available <= 0
                              ? "bg-red-500/15 text-red-400 border-red-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          }`}
                        >
                          {p.available <= 0 ? "Out" : `${p.available} pcs`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-app-2 whitespace-nowrap">
                        {inr(p.avgCost)}
                      </td>
                      <td className="px-4 py-3 text-sm font-black text-white whitespace-nowrap">
                        {inr(p.value)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                          <MapPin size={11} className="text-emerald-400 shrink-0" />
                          <span className="truncate max-w-[240px]" title={p.location}>
                            {p.location}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── LOCATION VALUATION ── */}
          <div className="bg-panel border border-app rounded-[2rem] p-6 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-800 rounded-2xl flex items-center justify-center">
                  <MapPin size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight">
                    Location-wise Stock Value
                  </h2>
                  <p className="text-[10px] text-muted font-bold uppercase tracking-[0.3em]">
                    Zone ▸ Rack ▸ Bin ▸ Box — inbound purchase value
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-muted-2">
                    Locations
                  </div>
                  <div className="text-xl font-black text-white">{locTotals.totalLocations}</div>
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-muted-2">
                    Qty
                  </div>
                  <div className="text-xl font-black text-white">
                    {locTotals.totalQty.toLocaleString("en-IN")}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-muted-2">
                    Value
                  </div>
                  <div className="text-xl font-black text-emerald-400">{inr(locTotals.totalValue)}</div>
                </div>
              </div>
            </div>

            {locations.length === 0 ? (
              <div className="text-center py-16">
                <PackageX size={36} className="mx-auto text-app mb-3" />
                <p className="text-muted font-bold text-sm">Koi stock-in record nahi</p>
              </div>
            ) : (
              <div className="bg-app border border-app rounded-2xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {["Location", "Products", "Qty", "Value", ""].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-muted whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21293d]">
                    {locations.map((loc) => {
                      const open = expanded === loc.key;
                      return (
                        <Fragment key={loc.key}>
                          <tr
                            onClick={() => setExpanded(open ? null : loc.key)}
                            className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-2 font-bold text-app-2 text-sm">
                                {open ? (
                                  <ChevronDown size={15} className="text-emerald-400" />
                                ) : (
                                  <ChevronRight size={15} className="text-muted" />
                                )}
                                {loc.path}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted">
                              {loc.productCount} products
                            </td>
                            <td className="px-4 py-3 text-xs text-app-2 whitespace-nowrap">
                              {loc.qty.toLocaleString("en-IN")}
                            </td>
                            <td className="px-4 py-3 text-sm font-black text-emerald-400 whitespace-nowrap">
                              {inr(loc.value)}
                            </td>
                            <td className="px-4 py-3 text-right text-muted-2">
                              <span
                                className={`inline-block transition-transform ${
                                  open ? "rotate-180" : ""
                                }`}
                              >
                                ▾
                              </span>
                            </td>
                          </tr>
                          {open && (
                            <tr>
                              <td colSpan={5} className="px-4 pb-4 bg-black/20">
                                <div className="overflow-x-auto rounded-xl border border-app-2">
                                  <table className="w-full text-sm">
                                    <thead className="theme-panel-2">
                                      <tr>
                                        {["Product", "Qty", "Value"].map((h) => (
                                          <th
                                            key={h}
                                            className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-muted"
                                          >
                                            {h}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#161b27]">
                                      {loc.products.map((pl) => (
                                        <tr key={pl.productId}>
                                          <td className="px-3 py-2">
                                            <Link
                                              href={`/inventory/${pl.productId}`}
                                              className="text-emerald-700 dark:text-emerald-400 hover:underline no-underline transition-colors text-xs font-bold"
                                            >
                                              {pl.name}
                                            </Link>
                                          </td>
                                          <td className="px-3 py-2 text-xs text-app-2 whitespace-nowrap">
                                            {pl.qty.toLocaleString("en-IN")}
                                          </td>
                                          <td className="px-3 py-2 text-xs font-bold text-emerald-400 whitespace-nowrap">
                                            {inr(pl.value)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
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
          </div>
        </>
      )}

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>
    </div>
  );
}