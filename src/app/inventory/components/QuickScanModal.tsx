"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  X, ScanLine, Loader2, CheckCircle2, AlertCircle,
  Package, Search, ArrowDownToLine, MapPin, Calendar,
} from "lucide-react";
import { logActivity } from "@/lib/activity";
import { todayIST, toISTDatePart } from "@/lib/dateUtils";
import { stockStatusStyle } from "@/lib/inventory";

interface QuickScanProps {
  onClose: () => void;
  onSaved: () => void;
}

interface MatchedProduct {
  id: number;
  name: string;
  description: string;
  barcode: string | null;
  alert_quantity: number;
  available: number;
}

export default function QuickScanModal({ onClose, onSaved }: QuickScanProps) {
  const [code,     setCode]     = useState("");
  const [match,    setMatch]    = useState<MatchedProduct | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [place,    setPlace]    = useState("");
  const [stockDate,setStockDate] = useState(todayIST());
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const inputRef  = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const today = todayIST();

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60); }, []);

  const lookup = async (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    setMatch(null);
    setNotFound(false);
    setError(null);

    const { data } = await supabase
      .from("product_list")
      .select("id, name, description, barcode, alert_quantity")
      .eq("barcode", q)
      .eq("delete_flag", 0)
      .limit(1)
      .single();

    if (!data) { setNotFound(true); return; }

    const sold = await fetchSold(data.id);
    setMatch({ ...data, alert_quantity: data.alert_quantity || 5, available: sold.available });
    setQuantity(1);
    setPlace("");
    setStockDate(today);
  };

  const fetchSold = async (productId: number) => {
    const [stockRes, jobRes, saleRes] = await Promise.all([
      supabase.from("inventory_list").select("quantity").eq("product_id", productId),
      supabase.from("transaction_products").select("qty, transaction_id").eq("product_id", productId),
      supabase.from("direct_sale_items").select("qty").eq("product_id", productId),
    ]);
    const totalIn = (stockRes.data || []).reduce((s, r) => s + r.quantity, 0);

    const txnIds = [...new Set((jobRes.data || []).map(i => i.transaction_id))];
    let validJob = 0;
    if (txnIds.length) {
      const { data: txns } = await supabase
        .from("transaction_list").select("id").in("id", txnIds).neq("status", 4);
      const ok = new Set((txns || []).map(t => t.id));
      validJob = (jobRes.data || []).filter(i => ok.has(i.transaction_id)).reduce((s, i) => s + (i.qty || 0), 0);
    }
    const saleQty = (saleRes.data || []).reduce((s, r) => s + (r.qty || 0), 0);
    return { available: totalIn - validJob - saleQty };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match) return;
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("inventory_list")
        .insert([{
          product_id: match.id,
          quantity,
          place: place.trim() || "",
          stock_date: stockDate,
          supplier_id: null,
        }]);
      if (err) throw err;
      await logActivity('Added New Stock', 'Inventory', match.id, `${match.name}: Barcode quick-add ${quantity} units`);
      setSuccess(true);
      setTimeout(() => onSaved(), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  const st = match ? stockStatusStyle(match.available, match.alert_quantity) : null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative w-full sm:max-w-md bg-[#161b27] border border-[#21293d] sm:rounded-2xl rounded-t-3xl overflow-hidden shadow-2xl shadow-black/50"
        style={{ animation: "slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {success && (
          <div className="absolute inset-0 z-10 bg-[#161b27] flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <p className="text-white font-extrabold text-lg">Stock Added!</p>
            <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">
              {quantity} unit{quantity !== 1 ? "s" : ""} added
            </p>
          </div>
        )}

        <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 to-teal-600" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-[#21293d]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-emerald-500/10 border-emerald-500/25">
              <ScanLine size={16} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white leading-none">Quick Barcode Scan</h3>
              <p className="text-[10px] text-slate-600 font-bold mt-0.5 uppercase tracking-wider">
                Scan barcode → instant stock-in
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#111520] hover:bg-white/5 text-slate-500 hover:text-slate-300 border border-[#21293d] transition-all">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* ── Scan input ── */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-2.5">
              <span className="flex items-center gap-1.5">
                <ScanLine size={10} className="text-slate-700" /> Scan / Enter Barcode
              </span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                <input
                  ref={inputRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookup(code); } }}
                  placeholder="Point scanner here or type barcode..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-[#111520] border border-[#21293d] text-slate-200 placeholder-slate-700 rounded-xl outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm font-mono uppercase"
                />
              </div>
              <button type="button" onClick={() => lookup(code)}
                className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-sm transition-all active:scale-95">
                Lookup
              </button>
            </div>
          </div>

          {/* ── Result state ── */}
          {notFound && (
            <div className="flex items-center gap-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
              <p className="text-amber-400 text-xs font-bold">
                No product found with barcode <span className="font-mono uppercase">&quot;{code.trim()}&quot;</span>.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2.5 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-xs font-bold">{error}</p>
            </div>
          )}

          {/* ── Matched product card ── */}
          {match && st && (
            <div className="bg-[#111520] border border-[#21293d] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-black text-white text-sm truncate">{match.name}</div>
                  <div className="text-[11px] text-slate-600 truncate mt-0.5">{match.description}</div>
                  <div className="text-[9px] font-mono text-emerald-500/70 mt-1 uppercase">{match.barcode}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-xl font-black ${st.color}`}>{Math.max(0, match.available)}</div>
                  <div className="text-[8px] text-slate-700 font-bold uppercase tracking-widest">available</div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Quantity */}
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-2.5">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-full text-center text-3xl font-black text-white bg-[#111520] border border-[#21293d] rounded-xl py-3 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                {/* Place */}
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-2.5">
                    <span className="flex items-center gap-1.5">
                      <MapPin size={10} className="text-slate-700" /> Place / Location
                    </span>
                  </label>
                  <input
                    type="text"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    placeholder="e.g. Shelf A1, Drawer 3..."
                    className="w-full px-4 py-3 bg-[#111520] border border-[#21293d] text-slate-200 placeholder-slate-700 rounded-xl outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm"
                  />
                </div>

                {/* Stock date */}
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-2.5">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={10} className="text-slate-700" /> Stock Date <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    type="date"
                    required
                    value={stockDate}
                    max={today}
                    onChange={(e) => setStockDate(e.target.value)}
                    className="w-full px-4 py-3 bg-[#111520] border border-[#21293d] text-slate-200 rounded-xl outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm [color-scheme:dark]"
                  />
                  <div className="flex gap-2 mt-2">
                    {[
                      { label: "Today",     val: today },
                      { label: "Yesterday", val: toISTDatePart(new Date(Date.now() - 86400000)) },
                    ].map(({ label, val }) => (
                      <button key={label} type="button"
                        onClick={() => setStockDate(val)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-extrabold border transition-all ${
                          stockDate === val
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-[#111520] text-slate-600 border-[#21293d] hover:border-emerald-500/30 hover:text-slate-400"
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={saving || success}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-extrabold text-sm transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20">
                  {saving
                    ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                    : <><ArrowDownToLine size={16} /> Add {quantity} unit{quantity !== 1 ? "s" : ""} to Stock</>}
                </button>
              </form>
            </div>
          )}

          {/* ── Idle hint ── */}
          {!match && !notFound && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 flex items-center justify-center mb-3">
                <Package size={26} className="text-emerald-500/40" />
              </div>
              <p className="text-slate-500 text-xs font-bold max-w-[240px] leading-relaxed">
                USB barcode scanner se scan karein — ya barcode number type karke Enter dabayen
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}
