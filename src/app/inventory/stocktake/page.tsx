"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase, getCachedUser } from "@/lib/supabase";
import { fetchStockByProducts, type StockRow } from "@/lib/inventoryStock";
import { logActivity } from "@/lib/activity";
import PageLoader from "@/components/PageLoader";
import {
  Package,
  Search,
  Save,
  RefreshCw,
  Loader2,
  ShieldCheck,
  ClipboardList,
  AlertTriangle,
  FileText,
  TrendingUp,
  TrendingDown,
  Check,
} from "lucide-react";

const REASONS = ["correction", "shrinkage", "damage", "return"] as const;
type Reason = (typeof REASONS)[number];

type RecentAdjustment = {
  id: number;
  product_id: number;
  delta: number;
  reason: string;
  remark: string | null;
  created_at: string | null;
  counted_qty: number | null;
};

export default function StocktakePage() {
  const [userRole, setUserRole] = useState<string>("staff");
  const [roleChecked, setRoleChecked] = useState(false);

  // product picker
  const [products, setProducts] = useState<
    { id: number; name: string; barcode: string | null; alert_quantity: number }[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selId, setSelId] = useState<number | null>(null);
  const [stockMap, setStockMap] = useState<Map<number, StockRow>>(new Map());

  // entry form
  const [countedQty, setCountedQty] = useState<string>("");
  const [reason, setReason] = useState<Reason>("correction");
  const [note, setNote] = useState("");
  const [remark, setRemark] = useState("");

  // save state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    delta: number;
    availableBefore: number;
    countedQty: number;
  } | null>(null);

  // recent history
  const [recent, setRecent] = useState<RecentAdjustment[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // ── Guard ─────────────────────────────────────────────────────────────────
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

  // ── Load product list + current stock ─────────────────────────────────────
  const loadProducts = async () => {
    const { data: pl } = await supabase
      .from("product_list")
      .select("id, name, barcode, alert_quantity")
      .eq("delete_flag", 0)
      .order("name");
    const list = (pl || []).map((p) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      alert_quantity: p.alert_quantity,
    }));
    setProducts(list);
    const ids = list.map((p) => p.id);
    try {
      setStockMap(await fetchStockByProducts(ids));
    } catch {
      setStockMap(new Map());
    }
  };

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.barcode || "").toLowerCase().includes(q)
    );
  }, [products, searchTerm]);

  const selected = selId != null ? products.find((p) => p.id === selId) : null;
  const selectedStock = selId != null ? stockMap.get(selId) : undefined;
  const available = selectedStock?.available ?? 0;
  const countedNum = parseInt(countedQty, 10);
  const countedValid = Number.isFinite(countedNum);
  const delta = countedValid ? countedNum - available : null;
  const deltaLabel =
    delta === null ? "—" : delta === 0 ? "0 (no change)" : delta > 0 ? `+${delta}` : `${delta}`;

  const pickProduct = (id: number) => {
    setSelId(id);
    setCountedQty("");
    setReason("correction");
    setNote("");
    setRemark("");
    setError(null);
    setLastResult(null);
  };

  // ── Recent adjustments ────────────────────────────────────────────────────
  const loadRecent = async () => {
    setLoadingRecent(true);
    const { data: adj } = await supabase
      .from("stock_adjustments")
      .select("id, product_id, delta, reason, remark, created_at")
      .order("created_at", { ascending: false })
      .limit(15);
    const adjRows = adj || [];
    const prodIds = [...new Set(adjRows.map((a) => a.product_id))];
    const { data: counts } =
      prodIds.length > 0
        ? await supabase
            .from("stock_counts")
            .select("product_id, counted_qty")
            .in("product_id", prodIds)
        : { data: null as unknown };
    const countByProd = new Map<number, number>();
    (((counts as unknown) || []) as { product_id: number; counted_qty: number }[]).forEach((c) =>
      countByProd.set(c.product_id, c.counted_qty)
    );
    setRecent(
      adjRows.map((a) => ({
        id: a.id as number,
        product_id: a.product_id as number,
        delta: a.delta as number,
        reason: a.reason as string,
        remark: (a.remark as string) ?? null,
        created_at: a.created_at as string | null,
        counted_qty: countByProd.get(a.product_id as number) ?? null,
      }))
    );
    setLoadingRecent(false);
  };

  useEffect(() => {
    loadProducts();
    loadRecent();
  }, []);

  // ── Save stocktake ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (selId == null) return;
    if (!countedValid) {
      setError("Enter a valid counted quantity.");
      return;
    }
    if (countedNum < 0) {
      setError("Counted quantity cannot be negative.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc("record_stocktake", {
        p_product_id: selId,
        p_counted_qty: countedNum,
        p_reason: reason,
        p_note: note.trim() || null,
        p_remark: remark.trim() || null,
      });
      if (rpcErr) throw rpcErr;
      const row = Array.isArray(data) ? data[0] : data;
      const appliedDelta = row?.delta ?? delta;
      setLastResult({
        delta: appliedDelta,
        availableBefore: available,
        countedQty: countedNum,
      });

      await logActivity(
        "Stocktake Adjustment",
        "Inventory",
        selId,
        `Product: ${selected?.name || selId} | Counted ${countedNum} | Delta ${appliedDelta > 0 ? "+" : ""}${appliedDelta} | Reason: ${reason}`
      );

      // refresh derived stock + recent history
      await loadProducts();
      await loadRecent();
      setCountedQty("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Gate ─────────────────────────────────────────────────────────────────
  if (!roleChecked) {
    return <PageLoader icon={ClipboardList} label="Loading Stocktake..." tone="cyan" />;
  }
  if (userRole !== "admin" && userRole !== "developer") {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0d1117] flex items-center justify-center px-6">
        <div className="text-center">
          <ShieldCheck size={40} className="text-slate-400 dark:text-slate-700 mx-auto mb-3" />
          <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Admin only</h1>
          <p className="text-slate-500 dark:text-slate-600 text-sm mt-1">
            Stocktake (physical count) sirf admin kar sakta hai.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0d1117] font-sans pb-16">
      {/* ── HERO HEADER ── */}
      <div className="relative overflow-hidden bg-white dark:bg-[#0d1117] border-b border-slate-200 dark:border-[#21293d]">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-teal-600/10 rounded-full blur-3xl" />
        <div className="absolute -top-10 right-10 w-48 h-48 bg-emerald-600/8 rounded-full blur-2xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-teal-600 to-emerald-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-teal-500/30">
                  <ClipboardList size={26} className="text-white" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Link href="/inventory" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 transition-colors">
                    Inventory
                  </Link>
                  <span className="text-slate-400 dark:text-slate-700 text-xs">/</span>
                  <span className="text-xs text-slate-800 dark:text-slate-300">Stocktake</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                  Stocktake &amp; Adjustment
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Physical count reconciliation — full audit trail.</p>
              </div>
            </div>
            <button
              onClick={() => {
                loadProducts();
                loadRecent();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#21293d] dark:hover:bg-[#2a3348] text-slate-600 dark:text-slate-300 text-sm font-semibold transition-colors"
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid lg:grid-cols-2 gap-6">
        {/* ── LEFT: pick a product ── */}
        <div className="bg-white dark:bg-[#161b25] border border-slate-200 dark:border-[#21293d] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Search size={16} className="text-slate-500 dark:text-slate-400" />
            <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Select a product</h2>
          </div>
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-600" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or barcode..."
              className="w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#21293d] rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-teal-500/60"
            />
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1 pr-1">
            {filtered.slice(0, 100).map((p) => {
              const s = stockMap.get(p.id);
              const av = s?.available ?? 0;
              const isSel = selId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => pickProduct(p.id)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    isSel ? "bg-teal-500/15 border border-teal-500/40" : "border border-transparent hover:bg-slate-100 dark:hover:bg-[#21293d]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm text-slate-900 dark:text-white font-semibold truncate">{p.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-500">{p.barcode || "no barcode"}</div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div
                      className={`text-sm font-black ${
                        av <= 0
                          ? "text-rose-600 dark:text-rose-400"
                          : av <= Math.max(1, p.alert_quantity)
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {av}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">available</div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center text-slate-500 dark:text-slate-600 text-sm py-8">No products match.</div>
            )}
          </div>
        </div>

        {/* ── RIGHT: count entry + recent ── */}
        <div className="space-y-6">
          {selected ? (
            <div className="bg-white dark:bg-[#161b25] border border-slate-200 dark:border-[#21293d] rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">{selected.name}</h2>
                  <div className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{selected.barcode || "no barcode"}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 dark:text-slate-500">System available</div>
                  <div className={`text-2xl font-black ${available <= 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {available}
                  </div>
                </div>
              </div>

              {lastResult && (
                <div className="mb-4 rounded-xl bg-teal-500/10 border border-teal-500/30 p-3 flex items-center gap-3">
                  <Check size={18} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                  <div className="text-sm text-teal-800 dark:text-teal-200">
                    Saved — {lastResult.countedQty} counted (was {lastResult.availableBefore}). Delta{" "}
                    <span className="font-black">
                      {lastResult.delta > 0 ? "+" : ""}
                      {lastResult.delta}
                    </span>
                    .
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Counted quantity</label>
                  <input
                    type="number"
                    value={countedQty}
                    onChange={(e) => setCountedQty(e.target.value)}
                    placeholder="e.g. 12"
                    className="mt-1 w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#21293d] rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-teal-500/60"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Reason</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as Reason)}
                    className="mt-1 w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#21293d] rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-teal-500/60"
                  >
                    {REASONS.map((r) => (
                      <option key={r} value={r} className="bg-white dark:bg-[#0d1117]">
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* delta preview */}
              <div className="mt-4 rounded-xl bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#21293d] p-4 flex items-center justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-500">
                  Counted {countedValid ? countedNum : "—"} vs {available} available
                </div>
                <div
                  className={`flex items-center gap-2 font-black text-lg ${
                    delta === null ? "text-slate-500 dark:text-slate-600" : delta > 0 ? "text-emerald-600 dark:text-emerald-400" : delta < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {delta !== null && delta > 0 && <TrendingUp size={18} />}
                  {delta !== null && delta < 0 && <TrendingDown size={18} />}
                  {deltaLabel}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-600 leading-relaxed">
                A new stock row is added with this {delta !== null ? (delta >= 0 ? "positive" : "negative") : ""} quantity so the
                derived available matches your physical count. History is never deleted.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Note (count)</label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="optional"
                    className="mt-1 w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#21293d] rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-teal-500/60"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Remark (adjustment)</label>
                  <input
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="optional"
                    className="mt-1 w-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#21293d] rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-teal-500/60"
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 flex items-start gap-2 text-sm text-rose-600 dark:text-rose-300">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving || !countedValid}
                className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-sm transition-color disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? "Saving..." : "Save Adjustment"}
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#161b25] border border-dashed border-slate-300 dark:border-[#21293d] rounded-2xl p-10 text-center">
              <ClipboardList size={32} className="text-slate-400 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">Select a product to start counting.</p>
            </div>
          )}

          {/* recent adjustments */}
          <div className="bg-white dark:bg-[#161b25] border border-slate-200 dark:border-[#21293d] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={16} className="text-slate-500 dark:text-slate-400" />
              <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Recent adjustments</h2>
            </div>
            {loadingRecent ? (
              <div className="flex justify-center py-6">
                <Loader2 size={20} className="animate-spin text-slate-500 dark:text-slate-600" />
              </div>
            ) : recent.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-600 text-sm py-4">No adjustments yet.</p>
            ) : (
              <div className="space-y-1.5">
                {recent.map((a) => {
                  const pl = products.find((p) => p.id === a.product_id);
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-[#21293d]">
                      <div className="min-w-0">
                        <div className="text-sm text-slate-900 dark:text-white font-semibold truncate">{pl?.name || `#${a.product_id}`}</div>
                        <div className="text-[11px] text-slate-500 capitalize">
                          {a.reason}
                          {a.counted_qty != null ? ` · counted ${a.counted_qty}` : ""}
                        </div>
                      </div>
                      <div className={`flex-shrink-0 font-black ${a.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : a.delta < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`}>
                        {a.delta > 0 ? "+" : ""}{a.delta}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="text-[11px] text-slate-500 dark:text-slate-600 mt-3">
              <Package size={11} className="inline mr-1" />
              Adjustments write a ledger row + reconciliation stock row.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}